import { registerAs } from '@nestjs/config';

export default registerAs('venndelo', () => ({
  baseUrl: process.env.VENNDELO_BASE_URL,
  timeout: parseInt(process.env.VENNDELO_TIMEOUT ?? '30000', 10),
  stores: {
    bogota: {
      apiKey: process.env.VENNDELO_BOGOTA_API_KEY,
      storeId: process.env.VENNDELO_BOGOTA_STORE_ID,
      driveRootFolderId: process.env.VENNDELO_BOGOTA_DRIVE_FOLDER_ID,
    },
    cali: {
      apiKey: process.env.VENNDELO_CALI_API_KEY,
      storeId: process.env.VENNDELO_CALI_STORE_ID,
      driveRootFolderId: process.env.VENNDELO_CALI_DRIVE_FOLDER_ID,
    },
  },
}));
