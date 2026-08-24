import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { drive_v3, google, sheets_v4 } from 'googleapis';
import * as ExcelJS from 'exceljs';
import { chromium } from 'playwright';
import { firstValueFrom } from 'rxjs';
import { Readable } from 'stream';

interface TiendaConfig {
  nombre: string;
  webEmail: string;
  webPassword: string;
  driveFolderId: string;
}

interface ArchivoProcessado {
  tienda: string;
  buffer: Buffer;
  nombre: string;
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

const EXCEL = {
  hojaItems: 'Items',
  hojaDetalle: 'Detalle de ordenes',
  colPinItems: 1,   // col A
  colUnidades: 7,   // col G
  colPinDetalle: 1, // col A
  colTotalItems: 9, // col I
};

@Injectable()
export class DescargaPedidosService implements OnModuleInit {
  private readonly logger = new Logger(DescargaPedidosService.name);
  private drive: drive_v3.Drive;
  private sheets: sheets_v4.Sheets;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly mailService: MailService,
  ) {}

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
      try {
        const rawBuffer = await this.descargarPedidos(tienda);
        const { buffer, nombre } = await this.procesarExcel(rawBuffer, tienda);
        const enlace = await this.subirADrive(buffer, nombre, tienda.driveFolderId);

        this.logger.log(`✔ ${tienda.nombre} subido: ${enlace}`);
        archivosProcessados.push({ tienda: tienda.nombre, buffer, nombre });
        resultados.push({ tienda: tienda.nombre, ok: true, enlace });
      } catch (err) {
        this.logger.error(`✘ ${tienda.nombre}: ${err.message}`);
        resultados.push({ tienda: tienda.nombre, ok: false, error: err.message });
      }
    }

    if (archivosProcessados.length > 0) {
      try {
        const enlace = await this.consolidarEnSheets(archivosProcessados);
        this.logger.log(`✔ Consolidado: ${enlace}`);
        resultados.push({ tienda: 'Consolidado', ok: true, enlace });
      } catch (err) {
        this.logger.error(`✘ Consolidado: ${err.message}`);
        resultados.push({ tienda: 'Consolidado', ok: false, error: err.message });
      }
    }

    const duracion = `${((Date.now() - inicio) / 1000).toFixed(1)}s`;
    this.logger.log(`✅ Proceso completado en ${duracion}`);

    await this.mailService.sendDescargaPedidosReport({ date: new Date(), resultados, duracion });

    return { resultados, duracion };
  }

  // ─── Paso 1: login → JWT → API export → Buffer ────────────────────────────

  private async descargarPedidos(tienda: TiendaConfig): Promise<Buffer> {
    this.logger.log(`  · [${tienda.nombre}] Iniciando login con ${tienda.webEmail}`);

    const MAX_LOGIN_ATTEMPTS = 3;
    const LOGIN_RETRY_DELAY  = 10_000; // 10 s entre reintentos

    let jwt = '';
    for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt++) {
      try {
        this.logger.log(`  · [${tienda.nombre}] Login intento ${attempt}/${MAX_LOGIN_ATTEMPTS}`);
        jwt = await this.obtenerJWT(tienda.webEmail, tienda.webPassword);
        if (jwt) break;
        throw new Error('Token vacío en localStorage');
      } catch (err: any) {
        this.logger.error(`  · [${tienda.nombre}] Login intento ${attempt} falló: ${err.message}`);
        if (attempt < MAX_LOGIN_ATTEMPTS) {
          this.logger.log(`  · [${tienda.nombre}] Reintentando login en ${LOGIN_RETRY_DELAY / 1000}s...`);
          await new Promise((r) => setTimeout(r, LOGIN_RETRY_DELAY));
        } else {
          throw new Error(`Login fallido tras ${MAX_LOGIN_ATTEMPTS} intentos (${tienda.nombre}): ${err.message}`);
        }
      }
    }

    if (!jwt) throw new Error(`JWT vacío para ${tienda.nombre} — login fallido`);
    this.logger.log(`  · [${tienda.nombre}] JWT obtenido (${jwt.length} chars)`);

    const hoy = this.isoFecha(new Date());
    const startAt = this.configService.get<string>('descargaPedidos.startAt', '2026-03-01');
    this.logger.log(`  · [${tienda.nombre}] Llamando API export: ${startAt} → ${hoy}`);

    const MAX_EXPORT_ATTEMPTS = 3;
    const EXPORT_TIMEOUT_MS   = 120_000; // 2 minutos por intento
    const EXPORT_RETRY_DELAY  = 10_000;  // 10 s entre reintentos

    let exportRes: any;
    let lastExportError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_EXPORT_ATTEMPTS; attempt++) {
      try {
        this.logger.log(`  · [${tienda.nombre}] API export (intento ${attempt}/${MAX_EXPORT_ATTEMPTS})`);
        exportRes = await firstValueFrom(
          this.httpService.post(
            'https://app.venndelo.com/v2/admin/rpc',
            {
              jsonrpc: '2.0',
              id: -1,
              method: 'Admin_Order_Export.export',
              params: { start_at: startAt, end_at: hoy },
            },
            {
              timeout: EXPORT_TIMEOUT_MS,
              params: { s: 'default', m: 'Admin_Order_Export.export' },
              headers: {
                'x-venndelo-admin-token': jwt,
                'Content-Type': 'application/json;charset=UTF-8',
                Accept: 'application/json, text/plain, */*',
              },
            },
          ),
        );
        lastExportError = null;
        break; // éxito
      } catch (httpErr: any) {
        const status  = httpErr?.response?.status ?? 'sin respuesta';
        const code    = httpErr?.code ?? '';
        const message = httpErr?.message ?? '';
        const body    = JSON.stringify(httpErr?.response?.data ?? {}).slice(0, 300);
        this.logger.error(`  · [${tienda.nombre}] Error export intento ${attempt}: status=${status} code=${code} message=${message} body=${body}`);
        lastExportError = new Error(`API export falló con status ${status} code=${code} (${tienda.nombre})`);
        if (attempt < MAX_EXPORT_ATTEMPTS) {
          this.logger.log(`  · [${tienda.nombre}] Reintentando export en ${EXPORT_RETRY_DELAY / 1000}s...`);
          await new Promise((r) => setTimeout(r, EXPORT_RETRY_DELAY));
        }
      }
    }

    if (lastExportError) throw lastExportError;

    this.logger.log(`  · [${tienda.nombre}] Respuesta export HTTP 200 — analizando resultado`);

    if (exportRes.data?.error) {
      const msg = exportRes.data.error.message ?? JSON.stringify(exportRes.data.error);
      this.logger.error(`  · [${tienda.nombre}] Error JSON-RPC: ${msg}`);
      throw new Error(`API export (${tienda.nombre}): ${msg}`);
    }

    const downloadUrl: string = exportRes.data?.result?.url;
    if (!downloadUrl) {
      this.logger.error(`  · [${tienda.nombre}] Respuesta sin URL: ${JSON.stringify(exportRes.data).slice(0, 300)}`);
      throw new Error(`Sin URL de descarga para ${tienda.nombre}`);
    }

    this.logger.log(`  · [${tienda.nombre}] URL de descarga obtenida: ${downloadUrl.slice(0, 120)}...`);

    // ── Descarga con reintentos ───────────────────────────────────────────────
    const MAX_DOWNLOAD_ATTEMPTS = 3;
    const DOWNLOAD_TIMEOUT_MS   = 300_000; // 5 minutos por intento
    const DOWNLOAD_RETRY_DELAY  = 15_000;  // 15 s entre reintentos

    let lastDownloadError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
      this.logger.log(`  · [${tienda.nombre}] Descargando archivo (intento ${attempt}/${MAX_DOWNLOAD_ATTEMPTS})...`);
      try {
        const fileRes = await firstValueFrom(
          this.httpService.get<ArrayBuffer>(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: DOWNLOAD_TIMEOUT_MS,
          }),
        );
        const bytes = (fileRes.data as ArrayBuffer)?.byteLength ?? 0;
        this.logger.log(`  · [${tienda.nombre}] Archivo descargado: ${(bytes / 1024).toFixed(1)} KB`);
        return Buffer.from(fileRes.data);

      } catch (httpErr: any) {
        const status  = httpErr?.response?.status ?? 'sin respuesta';
        const code    = httpErr?.code ?? '';
        const message = httpErr?.message ?? '';
        const rawBody = httpErr?.response?.data;
        let body = '';
        if (rawBody instanceof ArrayBuffer) {
          body = Buffer.from(new Uint8Array(rawBody)).toString('utf8').slice(0, 500);
        } else if (Buffer.isBuffer(rawBody)) {
          body = (rawBody as Buffer).toString('utf8').slice(0, 500);
        } else if (typeof rawBody === 'string') {
          body = rawBody.slice(0, 500);
        } else if (rawBody) {
          body = JSON.stringify(rawBody).slice(0, 500);
        }

        this.logger.error(`  · [${tienda.nombre}] Error en intento ${attempt}: status=${status} code=${code} message=${message}`);
        if (body) this.logger.error(`    body: ${body}`);

        lastDownloadError = new Error(
          `Descarga del archivo falló (intento ${attempt}/${MAX_DOWNLOAD_ATTEMPTS}) — status=${status} code=${code} (${tienda.nombre})`,
        );

        if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
          this.logger.log(`  · [${tienda.nombre}] Reintentando en ${DOWNLOAD_RETRY_DELAY / 1000}s...`);
          await new Promise((r) => setTimeout(r, DOWNLOAD_RETRY_DELAY));
        }
      }
    }

    throw lastDownloadError ?? new Error(`Descarga fallida tras ${MAX_DOWNLOAD_ATTEMPTS} intentos (${tienda.nombre})`);
  }

  private async obtenerJWT(email: string, password: string): Promise<string> {
    this.logger.log(`  · [Login] Lanzando Chromium (platform=${process.platform})`);
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' && { channel: 'chrome' }),
    });
    const page = await browser.newPage();
    try {
      this.logger.log(`  · [Login] Navegando a login`);
      await page.goto('https://app.venndelo.com/web/#/login', {
        waitUntil: 'load',
        timeout: 60_000,
      });
      this.logger.log(`  · [Login] Página cargada — llenando credenciales`);
      await page.fill('input[placeholder="Correo Electrónico"]', email);
      await page.fill('input[type="password"]', password);
      this.logger.log(`  · [Login] Haciendo clic en Ingresar`);
      await page.click('button.x-button-ingresar');
      this.logger.log(`  · [Login] Esperando redirección post-login`);
      await page.waitForFunction(
        () => !window.location.hash.includes('/login'),
        { timeout: 60_000 },
      );
      await page.waitForLoadState('load', { timeout: 30_000 });
      this.logger.log(`  · [Login] Redireccionado — extrayendo token de localStorage`);
      const raw: string | null = await page.evaluate(() => localStorage.getItem('token'));
      const token = raw ? (JSON.parse(raw) as string) : '';
      this.logger.log(`  · [Login] Token ${token ? 'encontrado' : 'NO encontrado en localStorage'}`);
      return token;
    } finally {
      await browser.close();
      this.logger.log(`  · [Login] Browser cerrado`);
    }
  }

  // ─── Paso 2: procesar Excel en memoria ───────────────────────────────────

  private async procesarExcel(
    buffer: Buffer,
    tienda: TiendaConfig,
  ): Promise<{ buffer: Buffer; nombre: string }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

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
    const nombre = `pedidos_${tienda.nombre}_procesado_${hoy}.xlsx`;
    const processedBuffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(processedBuffer), nombre };
  }

  // ─── Paso 3: subir xlsx a Google Drive ───────────────────────────────────

  private async subirADrive(buffer: Buffer, nombre: string, folderId: string): Promise<string> {
    const response = await this.drive.files.create({
      requestBody: {
        name: nombre,
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

  // ─── Paso 4: consolidar en Google Sheets ─────────────────────────────────

  private async consolidarEnSheets(archivos: ArchivoProcessado[]): Promise<string> {
    const fileId = this.configService.getOrThrow<string>('descargaPedidos.consolidadoFileId');

    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: fileId,
      fields: 'sheets.properties.title',
    });
    const hojaNombre = (meta.data.sheets ?? [])[0]?.properties?.title ?? 'Hoja 1';

    const todasLasFilas: (string | number)[][] = [];
    for (let i = 0; i < archivos.length; i++) {
      const filas = await this.leerDetalleComoArray(archivos[i].buffer);
      const data = i > 0 ? filas.slice(1) : filas;
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

  private async leerDetalleComoArray(buffer: Buffer): Promise<(string | number)[][]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

    const hoja = workbook.getWorksheet(EXCEL.hojaDetalle);
    if (!hoja) throw new Error(`Hoja "${EXCEL.hojaDetalle}" no encontrada en el buffer`);

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
