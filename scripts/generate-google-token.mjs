/**
 * Script de uso único para obtener el refresh_token de Google OAuth2.
 *
 * Pasos:
 *   1. Crea credenciales OAuth 2.0 en Google Cloud Console:
 *      - Ve a: https://console.cloud.google.com/apis/credentials
 *      - Clic en "Crear credenciales" → "ID de cliente OAuth"
 *      - Tipo de aplicación: "Aplicación web"
 *      - Nombre: venndelo-backend (o el que quieras)
 *      - En "URIs de redireccionamiento autorizados" agrega: http://localhost:3001/callback
 *      - Guarda el Client ID y Client Secret
 *
 *   2. Agrega al .env:
 *      GOOGLE_OAUTH_CLIENT_ID=tu-client-id
 *      GOOGLE_OAUTH_CLIENT_SECRET=tu-client-secret
 *
 *   3. Ejecuta este script:
 *      node scripts/generate-google-token.mjs
 *
 *   4. Abre la URL que aparece en el navegador, autoriza y espera.
 *
 *   5. Copia el GOOGLE_OAUTH_REFRESH_TOKEN que aparece en consola y agrégalo al .env.
 */

import http from 'http';
import { readFileSync } from 'fs';
import { google } from 'googleapis';

// ── Leer .env manualmente ────────────────────────────────────────────────────
const envContent = readFileSync(new URL('../.env', import.meta.url), 'utf-8');
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const CLIENT_ID = env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/callback';
const PORT = 3001;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Faltan GOOGLE_OAUTH_CLIENT_ID y/o GOOGLE_OAUTH_CLIENT_SECRET en el .env\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // Fuerza que Google devuelva siempre el refresh_token
  scope: ['https://www.googleapis.com/auth/drive'],
});

console.log('\n🔗 Abre esta URL en tu navegador para autorizar:\n');
console.log(authUrl);
console.log('\n⏳ Esperando autorización en http://localhost:' + PORT + '...\n');

// ── Servidor local para capturar el callback ─────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/callback')) return;

  const code = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('No se encontró el código de autorización.');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>✅ ¡Autorización exitosa! Ya puedes cerrar esta pestaña.</h2>');

    console.log('\n✅ ¡Token obtenido exitosamente!\n');
    console.log('Agrega esta línea a tu archivo .env:\n');
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    if (!tokens.refresh_token) {
      console.warn(
        '⚠️  No se recibió refresh_token. Asegúrate de haber usado prompt=consent\n' +
          '   y de que la cuenta no tenga autorización previa para esta app.\n' +
          '   Revoca el acceso en https://myaccount.google.com/permissions y vuelve a ejecutar.\n',
      );
    }
  } catch (err) {
    res.writeHead(500);
    res.end('Error al obtener el token.');
    console.error('❌ Error:', err.message);
  } finally {
    server.close();
  }
});

server.listen(PORT);
