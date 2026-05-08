import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ShipmentLogRow {
  pin: string;
  numeroGuia: string;
  nombre: string;
  cantidad: number;
  labelUrl: string;
  tienda: string;
}

@Injectable()
export class ShipmentLogService implements OnModuleInit {
  private readonly logger = new Logger(ShipmentLogService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ── Crea la tabla si no existe al arrancar ─────────────────────────────────

  async onModuleInit() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS "Envio_bodegas" (
        id            SERIAL       PRIMARY KEY,
        pin           VARCHAR(50)  NOT NULL
                        REFERENCES orden_venta(id_orden_tienda)
                        ON UPDATE CASCADE
                        ON DELETE RESTRICT,
        numero_guia   VARCHAR(100),
        nombre        TEXT,
        cantidad      INTEGER,
        label_url     TEXT,
        tienda        VARCHAR(50)  NOT NULL,
        fecha_proceso TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    this.logger.log('Tabla "Envio_bodegas" verificada/creada');
  }

  // ── Inserta múltiples filas en una sola transacción ────────────────────────

  async saveBatch(rows: ShipmentLogRow[]): Promise<void> {
    if (!rows.length) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const row of rows) {
        await client.query(
          `INSERT INTO "envio_bodegas" (pin, numero_guia, nombre, cantidad, label_url, tienda)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            row.pin,
            row.numeroGuia || null,
            row.nombre || null,
            row.cantidad ?? null,
            row.labelUrl || null,
            row.tienda,
          ],
        );
      }

      await client.query('COMMIT');
      this.logger.log(`[Log] ${rows.length} fila(s) guardadas en "Envio_bodegas"`);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`[Log] Error al guardar en "Envio_bodegas": ${(err as Error).message}`);
      throw err;
    } finally {
      client.release();
    }
  }
}
