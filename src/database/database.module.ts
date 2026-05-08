import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({
          host: config.getOrThrow<string>('database.host'),
          port: config.getOrThrow<number>('database.port'),
          database: config.getOrThrow<string>('database.name'),
          user: config.getOrThrow<string>('database.user'),
          password: config.getOrThrow<string>('database.password'),
          max: 5,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          ssl: false,
        }),
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor() {}

  async onApplicationShutdown() {
    // El pool se cierra automáticamente al terminar el proceso
  }
}
