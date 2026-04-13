import { registerAs } from '@nestjs/config';

export default registerAs('google', () => ({
  // Service Account (legado)
  clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  privateKey: process.env.GOOGLE_PRIVATE_KEY,
  // OAuth2 (recomendado para cuentas personales)
  oauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  oauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  oauthRefreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  // Carpeta raíz de Drive
  driveRootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
}));
