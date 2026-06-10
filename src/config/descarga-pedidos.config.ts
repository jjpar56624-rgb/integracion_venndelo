import { registerAs } from '@nestjs/config';

export default registerAs('descargaPedidos', () => ({
  cali: {
    webEmail: process.env.VENNDELO_CALI_WEB_EMAIL,
    webPassword: process.env.VENNDELO_CALI_WEB_PASSWORD,
    driveFolderId: process.env.VENNDELO_CALI_DRIVE_FOLDER_ID,
  },
  bogota: {
    webEmail: process.env.VENNDELO_BOGOTA_WEB_EMAIL,
    webPassword: process.env.VENNDELO_BOGOTA_WEB_PASSWORD,
    driveFolderId: process.env.VENNDELO_BOGOTA_DRIVE_FOLDER_ID,
  },
  consolidadoFileId: process.env.CONSOLIDADO_FILE_ID,
  startAt: '2026-03-19',
}));
