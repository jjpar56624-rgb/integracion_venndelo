import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { OrdersService } from '../venndelo/orders/orders.service';
import { ShippingService } from '../venndelo/shipping/shipping.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { ShipmentLogService, ShipmentLogRow } from '../shipment-log/shipment-log.service';
import { StoresConfigService } from '../stores/stores-config.service';
import { StoreConfig, StoreKey } from '../stores/store.types';
import { LabelFormat, LabelOutput } from '../venndelo/shipping/shipping.dto';
import { OrderStatus } from '../venndelo/orders/orders.dto';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface LineItem {
  name: string;
  sku: string;
  quantity: number;
}

interface Shipment {
  tracking_number?: string;
}

interface Order {
  id: string;
  pin: string;
  line_items: LineItem[];
  shipments?: Shipment | Shipment[];
}

interface OrdersResponse {
  items?: Order[];
  data?: Order[];
}

interface LabelsResponse {
  status?: string;
  data?: string; // URL del PDF — presente solo cuando status === 'SUCCESS'
}

export interface ShipmentResult {
  ordersProcessed: number;
  orderIds: string[];
  driveFolder: { id: string | null; name: string | null; webViewLink: string | null };
  driveSheet: { id: string | null; name: string | null; webViewLink: string | null };
  shipments: unknown;
  labels: unknown;
  pickup: unknown;
  pickupError?: string;
}

// ─── Polling config ───────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 60_000; // 60 segundos entre intentos
const POLL_MAX_ATTEMPTS = 30;    // máx 30 minutos de espera total

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class OperationsService {
  private readonly logger = new Logger(OperationsService.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly shippingService: ShippingService,
    private readonly googleDriveService: GoogleDriveService,
    private readonly storesConfigService: StoresConfigService,
    private readonly shipmentLogService: ShipmentLogService,
  ) {}

  // ── Proceso completo diario (todas las órdenes PENDING) ───────────────────

  async runDailyShipment(storeKey: StoreKey): Promise<ShipmentResult> {
    const storeConfig = this.storesConfigService.getConfig(storeKey);
    this.logger.log(`[1/7] Fetching PENDING orders for store: ${storeConfig.name}...`);
    const ordersRaw = await this.ordersService.getAll({
      status: OrderStatus.PENDING,
      page: 1,
      limit: 500,
    }, storeConfig) as OrdersResponse;

    const orders: Order[] = ordersRaw?.items ?? ordersRaw?.data ?? [];

    if (!orders.length) {
      throw new Error(`No hay órdenes en estado PENDING para procesar en ${storeConfig.name}`);
    }

    this.logger.log(`[1/7] Found ${orders.length} PENDING orders`);
    return this.processShipments(orders, storeConfig);
  }

  // ── Prueba con una sola orden por ID ──────────────────────────────────────

  async runTestShipment(orderId: string, storeKey: StoreKey): Promise<ShipmentResult> {
    const storeConfig = this.storesConfigService.getConfig(storeKey);
    this.logger.log(`[1/7] Fetching order ${orderId} for store: ${storeConfig.name}...`);
    const order = await this.ordersService.getById(orderId, storeConfig) as Order;

    if (!order?.id) {
      throw new Error(`No se encontró la orden con ID: ${orderId}`);
    }

    this.logger.log(`[1/7] Order found - PIN: ${order.pin}`);
    return this.processShipments([order], storeConfig);
  }

  // ── Lógica compartida: pasos 2 al 7 ──────────────────────────────────────

  private async processShipments(orders: Order[], storeConfig: StoreConfig): Promise<ShipmentResult> {
    const orderIds = orders.map((o) => o.id);

    // ── Step 2: Create shipments ───────────────────────────────────────────
    this.logger.log('[2/7] Creating shipments...');
    const shipments = await this.shippingService.createShipments({ order_ids: orderIds }, storeConfig);
    this.logger.log('[2/7] Shipments created');

    // ── Step 3: Generate labels (con polling hasta SUCCESS) ────────────────
    this.logger.log('[3/7] Generating labels...');
    const { labelUrl, labelsRaw } = await this.pollGenerateLabels(orderIds, storeConfig);
    this.logger.log(`[3/7] Labels URL: ${labelUrl}`);

    // ── Step 3b: Polling del tracking number por orden ─────────────────────
    this.logger.log('[3b] Fetching tracking numbers...');
    const trackingByOrderId = await this.pollTrackingNumbers(orderIds, storeConfig);

    // ── Step 4: Build CSV ──────────────────────────────────────────────────
    const now = new Date();
    const carpetaNombre = this.folderName(now);
    const sheetNombre   = this.sheetName(now);
    this.logger.log('[4/7] Building CSV...');
    const csvContent = this.buildCsv(orders, labelUrl, trackingByOrderId, now);
    const csvLocalPath = path.join(os.tmpdir(), `${sheetNombre}.csv`);
    fs.writeFileSync(csvLocalPath, csvContent, 'utf-8');
    this.logger.log(`[4/7] CSV guardado localmente en: ${csvLocalPath}`);

    // ── Step 5: Buscar carpeta del día o crearla si no existe ─────────────
    this.logger.log(`[5/7] Buscando carpeta "${carpetaNombre}" en Drive...`);
    let folder = await this.googleDriveService.findFolderByName(carpetaNombre, storeConfig.driveRootFolderId);
    if (folder) {
      this.logger.log(`[5/7] Carpeta existente reutilizada: "${carpetaNombre}" (${folder.id})`);
    } else {
      folder = await this.googleDriveService.createFolder(carpetaNombre, storeConfig.driveRootFolderId);
      this.logger.log(`[5/7] Carpeta nueva creada: "${carpetaNombre}" (${folder.id})`);
    }

    // ── Step 6: Upload CSV as Google Sheet ─────────────────────────────────
    this.logger.log('[6/7] Uploading sheet to Drive...');
    const csvBuffer = Buffer.from(csvContent, 'utf-8');
    const sheet = await this.googleDriveService.uploadSheet(sheetNombre, csvBuffer, folder.id ?? undefined);
    this.logger.log(`[6/7] Sheet uploaded: "${sheetNombre}" (${sheet.id})`);

    // ── Step 7: Request pickup ─────────────────────────────────────────────
    this.logger.log('[7/7] Requesting pickup...');
    let pickup: unknown = null;
    let pickupError: string | undefined;
    try {
      pickup = await this.shippingService.requestPickup({ order_ids: orderIds }, storeConfig);
      this.logger.log('[7/7] Pickup requested successfully');
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? 'Error al solicitar pickup';
      pickupError = message;
      this.logger.warn(`[7/7] Pickup no procesado: ${message}`);
    }

    // ── Log: guardar en BD las filas procesadas exitosamente ──────────────────
    this.logger.log('[Log] Guardando log en BD...');
    const logRows = this.buildLogRows(orders, labelUrl, trackingByOrderId, storeConfig.name);
    await this.shipmentLogService.saveBatch(logRows);

    return {
      ordersProcessed: orders.length,
      orderIds,
      driveFolder: {
        id: folder.id ?? null,
        name: folder.name ?? null,
        webViewLink: folder.webViewLink ?? null,
      },
      driveSheet: {
        id: sheet.id ?? null,
        name: sheet.name ?? null,
        webViewLink: sheet.webViewLink ?? null,
      },
      shipments,
      labels: labelsRaw,
      pickup,
      ...(pickupError && { pickupError }),
    };
  }

  // ── Polling: generateLabels hasta SUCCESS ─────────────────────────────────

  private async pollGenerateLabels(
    orderIds: string[],
    storeConfig: StoreConfig,
  ): Promise<{ labelUrl: string; labelsRaw: LabelsResponse }> {
    for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
      const labelsRaw = await this.shippingService.generateLabels(
        { output: LabelOutput.URL, format: LabelFormat.LABEL_10x15, order_ids: orderIds },
        90_000, // 90s — generate-labels puede tardar más que el timeout global
        storeConfig,
      ) as LabelsResponse;

      if (labelsRaw?.status === 'SUCCESS' && labelsRaw?.data) {
        this.logger.log(`[3/7] Labels SUCCESS en intento ${attempt}`);
        return { labelUrl: labelsRaw.data, labelsRaw };
      }

      this.logger.log(
        `[3/7] Labels status: ${labelsRaw?.status ?? 'desconocido'} — reintentando (${attempt}/${POLL_MAX_ATTEMPTS}) en ${POLL_INTERVAL_MS / 1000}s...`,
      );
      await this.sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      `No se pudo obtener la URL de etiquetas tras ${POLL_MAX_ATTEMPTS} intentos (${(POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS) / 60_000} minutos). Proceso detenido en paso 3.`,
    );
  }

  // ── Polling: tracking_number por orden hasta que esté asignado ────────────

  private async pollTrackingNumbers(
    orderIds: string[],
    storeConfig: StoreConfig,
  ): Promise<Map<string, string>> {
    const trackingByOrderId = new Map<string, string>();
    const pending = new Set(orderIds);

    for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS && pending.size > 0; attempt++) {
      for (const orderId of [...pending]) {
        const updated = await this.ordersService.getById(orderId, storeConfig) as Order;
        const shipment = Array.isArray(updated.shipments) ? updated.shipments[0] : updated.shipments;
        const tracking = shipment?.tracking_number ?? '';

        if (tracking) {
          trackingByOrderId.set(orderId, tracking);
          pending.delete(orderId);
          this.logger.log(`[3b] Order ${orderId} → tracking: ${tracking}`);
        }
      }

      if (pending.size > 0) {
        this.logger.log(
          `[3b] ${pending.size} orden(es) sin tracking — reintentando (${attempt}/${POLL_MAX_ATTEMPTS}) en ${POLL_INTERVAL_MS / 1000}s...`,
        );
        await this.sleep(POLL_INTERVAL_MS);
      }
    }

    if (pending.size > 0) {
      this.logger.warn(`[3b] Sin tracking tras todos los intentos: ${[...pending].join(', ')}`);
      for (const orderId of pending) {
        trackingByOrderId.set(orderId, '');
      }
    }

    this.logger.log(`[3b] Tracking fetched: ${trackingByOrderId.size}/${orderIds.length}`);
    return trackingByOrderId;
  }

  // ── CSV Builder ───────────────────────────────────────────────────────────

  private buildCsv(
    orders: Order[],
    labelUrl: string,
    trackingByOrderId: Map<string, string>,
    date: Date,
  ): string {
    const fecha = this.isoDate(date);
    const headers = ['pin', 'No Guia', 'name', 'sku', 'quantity', 'label_url', 'fecha'];
    const rows: string[][] = [headers];

    for (const order of orders) {
      const trackingNumber = trackingByOrderId.get(order.id) ?? '';
      const lineItems = order.line_items ?? [];

      if (!lineItems.length) {
        rows.push([this.csvCell(order.pin), this.csvCell(trackingNumber), '', '', '', this.csvCell(labelUrl), fecha]);
        continue;
      }

      for (const item of lineItems) {
        rows.push([
          this.csvCell(order.pin),
          this.csvCell(trackingNumber),
          this.csvCell(item.name),
          this.csvCell(item.sku),
          String(item.quantity ?? ''),
          this.csvCell(labelUrl),
          fecha,
        ]);
      }
    }

    return rows.map((r) => r.join(',')).join('\n');
  }

  // ── Log rows builder ──────────────────────────────────────────────────────

  private buildLogRows(
    orders: Order[],
    labelUrl: string,
    trackingByOrderId: Map<string, string>,
    tienda: string,
  ): ShipmentLogRow[] {
    const rows: ShipmentLogRow[] = [];

    for (const order of orders) {
      const numeroGuia = trackingByOrderId.get(order.id) ?? '';
      const lineItems = order.line_items ?? [];

      if (!lineItems.length) {
        rows.push({ pin: order.pin, numeroGuia, nombre: '', cantidad: 0, labelUrl, tienda });
        continue;
      }

      for (const item of lineItems) {
        rows.push({
          pin: order.pin,
          numeroGuia,
          nombre: item.name ?? '',
          cantidad: item.quantity ?? 0,
          labelUrl,
          tienda,
        });
      }
    }

    return rows;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private readonly MESES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  /** "Guías 10 Abril 2026" */
  private folderName(date: Date): string {
    const day = date.getDate();
    const month = this.MESES_ES[date.getMonth()];
    const year = date.getFullYear();
    return `Guías ${day} ${month} ${year}`;
  }

  /** "VE-SB 10 Abril 2026_5:00pm" */
  private sheetName(date: Date): string {
    const day = date.getDate();
    const month = this.MESES_ES[date.getMonth()];
    const year = date.getFullYear();
    const rawHour = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = rawHour >= 12 ? 'pm' : 'am';
    const hour = rawHour % 12 || 12;
    return `VE-SB ${day} ${month} ${year}_${hour}:${minutes}${ampm}`;
  }

  /** "2026-04-07" */
  private isoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private csvCell(value: string | undefined | null): string {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
