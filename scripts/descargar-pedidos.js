'use strict';

/**
 * Descarga diaria de pedidos desde Venndelo (Cali + Bogotá) → procesa Excel → sube a Google Drive
 * → consolida ambas hojas "Detalle de ordenes" en un archivo Google Sheets único.
 *
 * Variables de entorno requeridas en .env:
 *   VENNDELO_CALI_WEB_EMAIL        VENNDELO_CALI_WEB_PASSWORD
 *   VENNDELO_BOGOTA_WEB_EMAIL      VENNDELO_BOGOTA_WEB_PASSWORD
 *   VENNDELO_CALI_DRIVE_FOLDER_ID  VENNDELO_BOGOTA_DRIVE_FOLDER_ID
 *   CONSOLIDADO_FILE_ID            (ID del Google Sheets consolidado)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { chromium } = require('playwright');
const ExcelJS = require('exceljs');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ═══════════════════════════════════════════════════════════════════════════════
// TIENDAS — se procesan en orden (Cali primero, luego Bogotá)
// ═══════════════════════════════════════════════════════════════════════════════
const TIENDAS = [
  {
    nombre: 'Cali',
    email: process.env.VENNDELO_CALI_WEB_EMAIL,
    password: process.env.VENNDELO_CALI_WEB_PASSWORD,
    driveFolderId: process.env.VENNDELO_CALI_DRIVE_FOLDER_ID,
  },
  {
    nombre: 'Bogotá',
    email: process.env.VENNDELO_BOGOTA_WEB_EMAIL,
    password: process.env.VENNDELO_BOGOTA_WEB_PASSWORD,
    driveFolderId: process.env.VENNDELO_BOGOTA_DRIVE_FOLDER_ID,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE COLUMNAS (índices 1-based, A=1, B=2, …)
// ═══════════════════════════════════════════════════════════════════════════════
const EXCEL = {
  hojaItems: 'Items',
  hojaDetalle: 'Detalle de ordenes',
  colPinItems: 1,    // col A → PIN en Items
  colUnidades: 7,    // col G → unidades en Items
  colPinDetalle: 1,  // col A → PIN en Detalle
  colTotalItems: 9,  // col I → Total Items (destino)
};

const START_AT = '2025-11-01';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  validarEnv();
  console.log('▶ Iniciando descarga de pedidos — ' + new Date().toLocaleString('es-CO'));

  const resultados = [];
  const archivosProcessados = []; // acumula rutas para la consolidación

  for (const tienda of TIENDAS) {
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`  TIENDA: ${tienda.nombre}`);
    console.log(`${'═'.repeat(55)}`);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `pedidos-${tienda.nombre.toLowerCase()}-`));

    try {
      const xlsxPath = await descargarPedidos(tienda, tmpDir);
      console.log('✔ Archivo descargado:', path.basename(xlsxPath));

      const procesadoPath = await procesarExcel(xlsxPath, tienda, tmpDir);
      console.log('✔ Excel procesado:', path.basename(procesadoPath));

      const enlace = await subirADrive(procesadoPath, tienda.driveFolderId);
      console.log('✔ Subido a Google Drive:', enlace);

      archivosProcessados.push({ tienda: tienda.nombre, xlsxPath: procesadoPath, tmpDir });
      resultados.push({ tienda: tienda.nombre, ok: true, enlace });

    } catch (err) {
      console.error(`❌ Error en ${tienda.nombre}:`, err.message);
      resultados.push({ tienda: tienda.nombre, ok: false, error: err.message });
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // ── Paso 4: consolidar ambas tiendas en el archivo único ─────────────────
  if (archivosProcessados.length > 0) {
    console.log(`\n${'═'.repeat(55)}`);
    console.log('  CONSOLIDADO');
    console.log(`${'═'.repeat(55)}`);
    try {
      const enlaceConsolidado = await consolidarEnSheets(archivosProcessados);
      console.log('✔ Consolidado actualizado:', enlaceConsolidado);
      resultados.push({ tienda: 'Consolidado', ok: true, enlace: enlaceConsolidado });
    } catch (err) {
      console.error('❌ Error al consolidar:', err.message);
      resultados.push({ tienda: 'Consolidado', ok: false, error: err.message });
    } finally {
      for (const { tmpDir } of archivosProcessados) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  }

  console.log('\n' + '═'.repeat(55));
  console.log('  RESUMEN FINAL');
  console.log('═'.repeat(55));
  for (const r of resultados) {
    console.log(r.ok
      ? `  ✅ ${r.tienda}: ${r.enlace}`
      : `  ❌ ${r.tienda}: ${r.error}`);
  }

  const hayErrores = resultados.some(r => !r.ok);
  if (hayErrores) process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASO 1 — Login → JWT → API de exportación → descarga xlsx
// ═══════════════════════════════════════════════════════════════════════════════
async function descargarPedidos(tienda, tmpDir) {
  const jwt = await obtenerJWT(tienda.email, tienda.password);
  console.log('  · JWT obtenido');

  const hoy = isoFecha(new Date());
  const { default: axios } = await import('axios');

  const exportRes = await axios.post(
    'https://app.venndelo.com/v2/admin/rpc',
    {
      jsonrpc: '2.0',
      id: -1,
      method: 'Admin_Order_Export.export',
      params: { start_at: START_AT, end_at: hoy },
    },
    {
      params: { s: 'default', m: 'Admin_Order_Export.export' },
      headers: {
        'x-venndelo-admin-token': jwt,
        'Content-Type': 'application/json;charset=UTF-8',
        'Accept': 'application/json, text/plain, */*',
      },
    }
  );

  if (exportRes.data?.error) throw new Error('API export: ' + exportRes.data.error.message);
  const downloadUrl = exportRes.data?.result?.url;
  if (!downloadUrl) throw new Error('Sin URL de descarga: ' + JSON.stringify(exportRes.data));

  console.log(`  · Rango: ${START_AT} → ${hoy}`);

  const fileRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
  const destino = path.join(tmpDir, `pedidos_${tienda.nombre}_${hoy}.xlsx`);
  fs.writeFileSync(destino, Buffer.from(fileRes.data));

  return destino;
}

/** Login en Venndelo y retorna el JWT del localStorage. */
async function obtenerJWT(email, password) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('https://app.venndelo.com/web/#/login', { waitUntil: 'networkidle' });
    await page.fill('input[placeholder="Correo Electrónico"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button.x-button-ingresar');
    await page.waitForFunction(() => !window.location.hash.includes('/login'), { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    const raw = await page.evaluate(() => localStorage.getItem('token'));
    return raw ? JSON.parse(raw) : null;
  } finally {
    await browser.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASO 2 — ExcelJS: Total Items por PIN
// ═══════════════════════════════════════════════════════════════════════════════
async function procesarExcel(xlsxPath, tienda, tmpDir) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  // Sumar unidades (col G) agrupadas por PIN (col A) en hoja Items
  const hojaItems = workbook.getWorksheet(EXCEL.hojaItems);
  if (!hojaItems) throw new Error(`Hoja "${EXCEL.hojaItems}" no encontrada.`);

  const totalPorPin = new Map();
  hojaItems.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const pin = String(row.getCell(EXCEL.colPinItems).value ?? '').trim();
    const cant = Number(row.getCell(EXCEL.colUnidades).value) || 0;
    if (pin) totalPorPin.set(pin, (totalPorPin.get(pin) ?? 0) + cant);
  });
  console.log(`  · PINs únicos en Items: ${totalPorPin.size}`);

  // Escribir total en col I de Detalle de ordenes según PIN (col A)
  const hojaDetalle = workbook.getWorksheet(EXCEL.hojaDetalle);
  if (!hojaDetalle) throw new Error(`Hoja "${EXCEL.hojaDetalle}" no encontrada.`);

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
  console.log(`  · Filas actualizadas en Detalle de ordenes: ${actualizadas}`);

  const hoy = isoFecha(new Date());
  const destino = path.join(tmpDir, `pedidos_${tienda.nombre}_procesado_${hoy}.xlsx`);
  await workbook.xlsx.writeFile(destino);

  return destino;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASO 3 — Google Drive: subir el archivo procesado
// ═══════════════════════════════════════════════════════════════════════════════
async function subirADrive(filePath, folderId) {
  const drive = inicializarDrive();
  const { Readable } = require('stream');
  const buffer = fs.readFileSync(filePath);

  const response = await drive.files.create({
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

  return response.data.webViewLink;
}

function inicializarDrive() {
  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    const oauth2Client = new google.auth.OAuth2(oauthClientId, oauthClientSecret);
    oauth2Client.setCredentials({ refresh_token: oauthRefreshToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASO 4 — Google Sheets: limpiar y escribir el consolidado
// ═══════════════════════════════════════════════════════════════════════════════
async function consolidarEnSheets(archivos) {
  const fileId = process.env.CONSOLIDADO_FILE_ID;
  const sheets = inicializarSheets();

  // Obtener el nombre real de la primera hoja del archivo consolidado
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: fileId,
    fields: 'sheets.properties.title',
  });
  const hojaNombre = meta.data.sheets[0].properties.title;

  // Leer filas de cada archivo xlsx (Cali con encabezado, Bogotá sin él)
  const todasLasFilas = [];
  for (let i = 0; i < archivos.length; i++) {
    const { tienda, xlsxPath } = archivos[i];
    const filas = await leerDetalleComoArray(xlsxPath);
    const omitirEncabezado = i > 0; // solo la primera tienda incluye encabezado
    const data = omitirEncabezado ? filas.slice(1) : filas;
    todasLasFilas.push(...data);
    console.log(`  · ${tienda}: ${data.length} filas`);
  }

  // Limpiar toda la hoja
  await sheets.spreadsheets.values.clear({
    spreadsheetId: fileId,
    range: hojaNombre,
  });

  // Escribir todas las filas desde A1
  await sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: `${hojaNombre}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: todasLasFilas },
  });

  console.log(`  · Total filas escritas: ${todasLasFilas.length}`);
  return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
}

/** Lee la hoja "Detalle de ordenes" de un xlsx y la convierte en array de arrays. */
async function leerDetalleComoArray(xlsxPath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const hoja = workbook.getWorksheet(EXCEL.hojaDetalle);
  if (!hoja) throw new Error(`Hoja "${EXCEL.hojaDetalle}" no encontrada en ${path.basename(xlsxPath)}`);

  const filas = [];
  hoja.eachRow(row => {
    const valores = [];
    row.eachCell({ includeEmpty: true }, cell => {
      // Convertir fechas de Excel a string legible
      if (cell.value instanceof Date) {
        valores.push(cell.value.toISOString().split('T')[0]);
      } else if (cell.value && typeof cell.value === 'object' && cell.value.result !== undefined) {
        valores.push(cell.value.result ?? ''); // fórmulas: usar resultado
      } else {
        valores.push(cell.value ?? '');
      }
    });
    filas.push(valores);
  });
  return filas;
}

function inicializarSheets() {
  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    const oauth2Client = new google.auth.OAuth2(oauthClientId, oauthClientSecret);
    oauth2Client.setCredentials({ refresh_token: oauthRefreshToken });
    return google.sheets({ version: 'v4', auth: oauth2Client });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════════
function isoFecha(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function validarEnv() {
  const requeridas = [
    'VENNDELO_CALI_WEB_EMAIL', 'VENNDELO_CALI_WEB_PASSWORD',
    'VENNDELO_BOGOTA_WEB_EMAIL', 'VENNDELO_BOGOTA_WEB_PASSWORD',
    'CONSOLIDADO_FILE_ID',
  ];
  const faltantes = requeridas.filter(k => !process.env[k]);
  if (faltantes.length) {
    console.error('❌ Faltan variables de entorno:', faltantes.join(', '));
    process.exit(1);
  }
  for (const t of TIENDAS) {
    if (!t.driveFolderId) console.warn(`⚠  Sin DRIVE_FOLDER_ID para ${t.nombre} — se subirá a la raíz.`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
main().catch(err => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
