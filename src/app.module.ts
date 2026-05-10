import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import databaseConfig from './config/database.config';
import descargaPedidosConfig from './config/descarga-pedidos.config';
import googleConfig from './config/google.config';
import venndeloConfig from './config/venndelo.config';
import { DatabaseModule } from './database/database.module';
import { DescargaPedidosModule } from './descarga-pedidos/descarga-pedidos.module';
import { GoogleDriveModule } from './google-drive/google-drive.module';
import { HealthController } from './health.controller';
import { MailModule } from './mail/mail.module';
import { OperationsModule } from './operations/operations.module';
import { VenndeloModule } from './venndelo/venndelo.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [venndeloConfig, googleConfig, databaseConfig, descargaPedidosConfig],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        // Venndelo
        VENNDELO_BASE_URL: Joi.string().uri().required(),
        VENNDELO_TIMEOUT: Joi.number().default(30000),
        // Venndelo - Bogotá
        VENNDELO_BOGOTA_API_KEY: Joi.string().required(),
        VENNDELO_BOGOTA_STORE_ID: Joi.string().required(),
        VENNDELO_BOGOTA_DRIVE_FOLDER_ID: Joi.string().allow('').optional(),
        // Venndelo - Cali
        VENNDELO_CALI_API_KEY: Joi.string().required(),
        VENNDELO_CALI_STORE_ID: Joi.string().required(),
        VENNDELO_CALI_DRIVE_FOLDER_ID: Joi.string().allow('').optional(),
        // Descarga automática de pedidos
        VENNDELO_CALI_WEB_EMAIL: Joi.string().email().optional(),
        VENNDELO_CALI_WEB_PASSWORD: Joi.string().optional(),
        VENNDELO_BOGOTA_WEB_EMAIL: Joi.string().email().optional(),
        VENNDELO_BOGOTA_WEB_PASSWORD: Joi.string().optional(),
        CONSOLIDADO_FILE_ID: Joi.string().optional(),
        // Google Drive - Service Account (legado)
        GOOGLE_CLIENT_EMAIL: Joi.string().email().optional(),
        GOOGLE_PRIVATE_KEY: Joi.string().optional(),
        // Google Drive - OAuth2 (recomendado)
        GOOGLE_OAUTH_CLIENT_ID: Joi.string().optional(),
        GOOGLE_OAUTH_CLIENT_SECRET: Joi.string().optional(),
        GOOGLE_OAUTH_REFRESH_TOKEN: Joi.string().optional(),
        GOOGLE_DRIVE_ROOT_FOLDER_ID: Joi.string().allow('').optional(),
        // Mail
        MAIL_FROM: Joi.string().email().required(),
        MAIL_TO: Joi.string().email().required(),
        MAIL_APP_PASSWORD: Joi.string().required(),
        // PostgreSQL
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_NAME: Joi.string().required(),
        DB_USER: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    MailModule,
    VenndeloModule,
    GoogleDriveModule,
    OperationsModule,
    DescargaPedidosModule,
  ],
})
export class AppModule {}
