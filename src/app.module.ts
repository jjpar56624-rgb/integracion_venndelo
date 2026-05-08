import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import databaseConfig from './config/database.config';
import googleConfig from './config/google.config';
import venndeloConfig from './config/venndelo.config';
import { DatabaseModule } from './database/database.module';
import { GoogleDriveModule } from './google-drive/google-drive.module';
import { HealthController } from './health.controller';
import { OperationsModule } from './operations/operations.module';
import { VenndeloModule } from './venndelo/venndelo.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [venndeloConfig, googleConfig, databaseConfig],
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
        // Google Drive - Service Account (legado)
        GOOGLE_CLIENT_EMAIL: Joi.string().email().optional(),
        GOOGLE_PRIVATE_KEY: Joi.string().optional(),
        // Google Drive - OAuth2 (recomendado)
        GOOGLE_OAUTH_CLIENT_ID: Joi.string().optional(),
        GOOGLE_OAUTH_CLIENT_SECRET: Joi.string().optional(),
        GOOGLE_OAUTH_REFRESH_TOKEN: Joi.string().optional(),
        GOOGLE_DRIVE_ROOT_FOLDER_ID: Joi.string().allow('').optional(),
        // PostgreSQL
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_NAME: Joi.string().required(),
        DB_USER: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    VenndeloModule,
    GoogleDriveModule,
    OperationsModule,
  ],
})
export class AppModule {}
