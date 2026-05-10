import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drive_v3, google, sheets_v4 } from 'googleapis';
import * as ExcelJS from 'exceljs';
import { chromium } from 'playwright';
import axios from 'axios';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface TiendaConfig {
  nombre: string;
  webEmail: string;
  webPassword: string;
  driveFolderId: string;
}

interface ArchivoProcessado {
  tienda: string;
  xlsxPath: string;
  tmpDir: string;
}

export interface ResultadoTienda {
  tienda: string;
  ok: boolean;
  enlace?: string;
  error?: string;
}

export interface ResultadoDescarga {
  resultados: ResultadoTienda[];
  duracion: string;
}

// Índices de columna (1-based): A=1, G=7, I=9
const EXCEL = {
  hojaItems: 'Items',
  hojaDetalle: 'Detalle de ordenes',
  colPinItems: 1,
  colUnidades: 7,
  colPinDetalle: 1,
  colTotalItems: 9,
};

@Injectable()
export class DescargaPedidosService implements OnModuleInit {
  private readonly logger = new Logger(DescargaPedidosService.name);
  private drive: drive_v3.Drive;
  private sheets: sheets_v4.Sheets;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const auth = this.buildGoogleAuth([
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
    ]);
    this.drive = google.drive({ version: 'v3', auth });
    this.sheets = google.sheets({ version: 'v4', auth });
    this.logger.log('Google Drive + Sheets inicializados');
  }

  // ─── Endpoint principal ───────────────────────────────────────────────────

  async ejecutar(): Promise<ResultadoDescarga> {
    const inicio = Date.now();
    this.logger.log('▶ Iniciando descarga de pedidos');

    const tiendas = this.getTiendas();
    const resultados: ResultadoTienda[] = [];
    const archivosProcessados: ArchivoProcessado[] = [];

    for (const tienda of tiendas) {
      this.logger.log(`── Tienda: ${tienda.nombre}`);
      const tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `pedidos-${tienda.nombre.toLowerCase()}-`),
      );

      try {
        const xlsxPath = await this.descargarPedidos(tienda, tmpDir);
        const procesadoPath = await this.procesarExcel(xlsxPath, tienda, tmpDir);
        const enlace = await this.subirADrive(procesadoPath, tienda.driveFolderId);

        this.logger.log(`✔ ${tienda.nombre} subido: ${enlace}`);
        archivosProcessados.push({ tienda: tienda.nombre, xlsxPath: procesadoPath, tmpDir });
        resultados.push({ tienda: tienda.nombre, ok: true, enlace });
      } catch (err) {
        this.logger.error(`✘ ${tienda.nombre}: ${err.message}`);
        resultados.push({ tienda: tienda.nombre, ok: false, error: err.message });
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }

    // Consolidar ambas tiendas en el Sheets único
    if (archivosProcessados.length > 0) {
      try {
        const enlace = await this.consolidarEnSheets(archivosProcessados);
        this.logger.log(`✔ Consolidado: ${enlace}`);
        resultados.push({ tienda: 'Consolidado', ok: true, enlace });
      } catch (err) {
        this.logger.error(`✘ Consolidado: ${err.message}`);
        resultados.push({ tienda: 'Consolidado', ok: false, error: err.message });
      } finally {
        for (const { tmpDir } of archivosProcessados) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      }
    }

    const duracion = `${((Date.now() - inicio) / 1000).toFixed(1)}s`;
    this.logger.log(`✅ Proceso completado en ${duracion}`);
    return { resultados, duracion };
  }

  // ─── Paso 1: login → JWT → API export → descarga xlsx ────────────────────

  private async descargarPedidos(tienda: TiendaConfig, tmpDir: string): Promise<string> {
    const jwt = await this.obtenerJWT(tienda.webEmail, tienda.webPassword);
    this.logger.log(`  · JWT obtenido (${tienda.nombre})`);

    const hoy = this.isoFecha(new Date());
    const startAt = this.configService.get<string>('descargaPedidos.startAt', '2025-11-01');

    const exportRes = await axios.post(
      'https://app.venndelo.com/v2/admin/rpc',
      {
        jsonrpc: '2.0',
        id: -1,
        method: 'Admin_Order_Export.export',
        params: { start_at: startAt, end_at: hoy },
      },
      {
        params: { s: 'default', m: 'Admin_Order_Export.export' },
        headers: {
          'x-venndelo-admin-token': jwt,
          'Content-Type': 'application/json;charset=UTF-8',
          Accept: 'application/json, text/plain, */*',
        },
      },
    );

    if (exportRes.data?.error) {
      throw new Error(`API export (${tienda.nombre}): ${exportRes.data.error.message}`);
    }

    const downloadUrl: string = exportRes.data?.result?.url;
    if (!downloadUrl) throw new Error(`Sin URL de descarga para ${tienda.nombre}`);

    const fileRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    const destino = path.join(tmpDir, `pedidos_${tienda.nombre}_${hoy}.xlsx`);
    fs.writeFileSync(destino, Buffer.from(fileRes.data));

    this.logger.log(`  · Rango: ${startAt} → ${hoy} (${tienda.nombre})`);
    return destino;
  }

  private async obtenerJWT(email: string, password: string): Promise<string> {
    const browser = await chromium.launch({
      headless: true,
      channel: 'chrome', // usa el Chrome instalado en el sistema
    });
    const page = await browser.newPage();
    try {
      await page.goto('https://app.venndelo.com/web/#/login', { waitUntil: 'networkidle' });
      await page.fill('input[placeholder="Correo Electrónico"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button.x-button-ingresar');
      await page.waitForFunction(
        () => !window.location.hash.includes('/login'),
        { timeout: 30000 },
      );
      await page.waitForLoadState('networkidle');
      const raw: string | null = await page.evaluate(() => localStorage.getItem('token'));
      return raw ? (JSON.parse(raw) as string) : '';
    } finally {
      await browser.close();
    }
  }

  // ─── Paso 2: calcular Total Items por PIN y escribir en Detalle ───────────

  private async procesarExcel(
    xlsxPath: string,
    tienda: TiendaConfig,
    tmpDir: string,
  ): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxPath);

    const hojaItems = workbook.getWorksheet(EXCEL.hojaItems);
    if (!hojaItems) throw new Error(`Hoja "${EXCEL.hojaItems}" no encontrada (${tienda.nombre})`);

    const totalPorPin = new Map<string, number>();
    hojaItems.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const pin = String(row.getCell(EXCEL.colPinItems).value ?? '').trim();
      const cant = Number(row.getCell(EXCEL.colUnidades).value) || 0;
      if (pin) totalPorPin.set(pin, (totalPorPin.get(pin) ?? 0) + cant);
    });
    this.logger.log(`  · ${tienda.nombre}: ${totalPorPin.size} PINs únicos`);

    const hojaDetalle = workbook.getWorksheet(EXCEL.hojaDetalle);
    if (!hojaDetalle) throw new Error(`Hoja "${EXCEL.hojaDetalle}" no encontrada (${tienda.nombre})`);

    let actualizadas = 0;
    hojaDetalle.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const pin = String(row.getCell(EXCEL.colPinDetalle).value ?? '').trim();
      if (pin && totalPorPin.has(pin)) {
        row.getCell(EXCEL.colTotalItems).value = totalPorPin.get(pin);
        row.commit();
        actualizadas++;
      }
    });
    this.logger.log(`  · ${tienda.nombre}: ${actualizadas} filas actualizadas`);

    const hoy = this.isoFecha(new Date());
    const destino = path.join(tmpDir, `pedidos_${tienda.nombre}_procesado_${hoy}.xlsx`);
    await workbook.xlsx.writeFile(destino);
    return destino;
  }

  // ─── Paso 3: subir xlsx a Google Drive ───────────────────────────────────

  private async subirADrive(filePath: string, folderId: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    const response = await this.drive.files.create({
      requestBody: {
        name: path.basename(filePath),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ...(folderId && { parents: [folderId] }),
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Readable.from(buffer),
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });
    return response.data.webViewLink ?? '';
  }

  // ─── Paso 4: consolidar hojas "Detalle de ordenes" en Sheets único ────────

  private async consolidarEnSheets(archivos: ArchivoProcessado[]): Promise<string> {
    const fileId = this.configService.getOrThrow<string>('descargaPedidos.consolidadoFileId');

    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: fileId,
      fields: 'sheets.properties.title',
    });
    const hojaNombre = (meta.data.sheets ?? [])[0]?.properties?.title ?? 'Hoja 1';

    const todasLasFilas: (string | number)[][] = [];
    for (let i = 0; i < archivos.length; i++) {
      const filas = await this.leerDetalleComoArray(archivos[i].xlsxPath);
      const data = i > 0 ? filas.slice(1) : filas; // solo primera tienda lleva encabezado
      todasLasFilas.push(...data);
      this.logger.log(`  · ${archivos[i].tienda}: ${data.length} filas`);
    }

    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: fileId,
      range: hojaNombre,
    });

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: fileId,
      range: `${hojaNombre}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: todasLasFilas as string[][] },
    });

    this.logger.log(`  · Total filas escritas: ${todasLasFilas.length}`);
    return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
  }

  private async leerDetalleComoArray(xlsxPath: string): Promise<(string | number)[][]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxPath);

    const hoja = workbook.getWorksheet(EXCEL.hojaDetalle);
    if (!hoja) throw new Error(`Hoja "${EXCEL.hojaDetalle}" no encontrada en ${path.basename(xlsxPath)}`);

    const filas: (string | number)[][] = [];
    hoja.eachRow(row => {
      const valores: (string | number)[] = [];
      row.eachCell({ includeEmpty: true }, cell => {
        if (cell.value instanceof Date) {
          valores.push(cell.value.toISOString().split('T')[0]);
        } else if (cell.value && typeof cell.value === 'object' && 'result' in cell.value) {
          valores.push((cell.value as ExcelJS.CellFormulaValue).result as string | number ?? '');
        } else {
          valores.push((cell.value as string | number) ?? '');
        }
      });
      filas.push(valores);
    });
    return filas;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getTiendas(): TiendaConfig[] {
    return [
      {
        nombre: 'Cali',
        webEmail: this.configService.getOrThrow('descargaPedidos.cali.webEmail'),
        webPassword: this.configService.getOrThrow('descargaPedidos.cali.webPassword'),
        driveFolderId: this.configService.get('descargaPedidos.cali.driveFolderId', ''),
      },
      {
        nombre: 'Bogotá',
        webEmail: this.configService.getOrThrow('descargaPedidos.bogota.webEmail'),
        webPassword: this.configService.getOrThrow('descargaPedidos.bogota.webPassword'),
        driveFolderId: this.configService.get('descargaPedidos.bogota.driveFolderId', ''),
      },
    ];
  }

  private buildGoogleAuth(scopes: string[]) {
    const oauthClientId = this.configService.get<string>('google.oauthClientId');
    const oauthClientSecret = this.configService.get<string>('google.oauthClientSecret');
    const oauthRefreshToken = this.configService.get<string>('google.oauthRefreshToken');

    if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
      const oauth2Client = new google.auth.OAuth2(oauthClientId, oauthClientSecret);
      oauth2Client.setCredentials({ refresh_token: oauthRefreshToken });
      return oauth2Client;
    }

    return new google.auth.GoogleAuth({
      credentials: {
        client_email: this.configService.get<string>('google.clientEmail'),
        private_key: (this.configService.get<string>('google.privateKey') ?? '').replace(/\\n/g, '\n'),
      },
      scopes,
    });
  }

  private isoFecha(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
