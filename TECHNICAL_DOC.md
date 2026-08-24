# Venndelo Backend — Documentación Técnica

> **Última actualización:** Este documento vive en el repositorio y se actualiza junto con el código.
> Para usar como fuente en Google NotebookLM: copiar la URL raw de GitHub de este archivo.

---

## Tabla de contenido

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitectura de módulos](#3-arquitectura-de-módulos)
4. [Multi-tienda: Bogotá y Cali](#4-multi-tienda-bogotá-y-cali)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Endpoints disponibles](#6-endpoints-disponibles)
7. [Proceso A — Cargue de guías (7 pasos)](#7-proceso-a--cargue-de-guías-7-pasos)
8. [Proceso B — Descarga de pedidos](#8-proceso-b--descarga-de-pedidos)
9. [Base de datos PostgreSQL](#9-base-de-datos-postgresql)
10. [Notificaciones por correo](#10-notificaciones-por-correo)
11. [Google Drive y Google Sheets](#11-google-drive-y-google-sheets)
12. [Cron jobs en servidor](#12-cron-jobs-en-servidor)
13. [Estructura de carpetas](#13-estructura-de-carpetas)
14. [Flujo de datos completo](#14-flujo-de-datos-completo)

---

## 1. Visión general

**Venndelo Backend** es una API REST construida en NestJS 10 que automatiza dos procesos diarios de logística para la empresa Partnershop Colombia, que opera como vendedor en la plataforma de e-commerce Venndelo con dos tiendas:

- **Bogotá** (store ID 72824)
- **Cali** (store ID 72787)

### Dos procesos principales

| Proceso | Disparador | Qué hace |
|---|---|---|
| **Cargue de guías** | Cron o POST manual | Toma órdenes PENDING → crea envíos → genera etiquetas → sube CSV a Drive → solicita pickup |
| **Descarga de pedidos** | Cron o POST manual | Exporta reporte Excel de Venndelo → procesa totales → sube a Drive + consolida en Sheets |

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | NestJS 10 (Node.js) |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL (via `pg` — sin ORM) |
| Automatización browser | Playwright + Chromium (headless) |
| Google APIs | `googleapis` (Drive v3, Sheets v4) — OAuth2 |
| Archivos Excel | ExcelJS |
| HTTP externo | `@nestjs/axios` + `axios` |
| Correo | Nodemailer + Gmail App Password |
| Validación | `class-validator` + Joi |
| Documentación API | Swagger (`@nestjs/swagger`) |
| Servidor de producción | Ubuntu (AWS EC2) |

---

## 3. Arquitectura de módulos

```
AppModule (raíz)
├── ConfigModule (global) — carga 4 configs + validación Joi
├── DatabaseModule (global) — provee pg.Pool como PG_POOL
├── MailModule (global) — MailService disponible en toda la app
├── VenndeloModule
│   ├── VenndeloHttpService — cliente HTTP base con API key
│   ├── OrdersModule → OrdersService
│   ├── ShippingModule → ShippingService
│   ├── ProductsModule → ProductsService
│   ├── CategoriesModule → CategoriesService
│   └── UsersModule → UsersService
├── GoogleDriveModule → GoogleDriveService
├── StoresConfigModule → StoresConfigService
├── ShipmentLogModule → ShipmentLogService
├── OperationsModule → OperationsService (orquesta el Proceso A)
└── DescargaPedidosModule → DescargaPedidosService (orquesta el Proceso B)
```

### Módulos globales

- **ConfigModule**: disponible en todos los módulos sin necesidad de importarlo.
- **DatabaseModule**: provee el pool de PostgreSQL como token `PG_POOL`. Se inyecta con `@Inject(PG_POOL)`.
- **MailModule**: `MailService` disponible en todos los módulos.

---

## 4. Multi-tienda: Bogotá y Cali

Cada proceso soporta ambas tiendas de forma independiente. El parámetro `store` en el body del request selecciona la tienda.

### Tipos clave (`src/stores/store.types.ts`)

```typescript
enum StoreKey { BOGOTA = 'bogota', CALI = 'cali' }

interface StoreCredentials {
  apiKey: string;   // X-Venndelo-Api-Key para la API REST
  storeId: string;  // ID de la tienda en Venndelo
}

interface StoreConfig extends StoreCredentials {
  name: string;              // 'Venndelo Bogotá' | 'Venndelo Cali'
  driveRootFolderId: string; // ID de la carpeta raíz en Google Drive
}
```

### Resolución de configuración

`StoresConfigService.getConfig(storeKey)` lee del `ConfigService` y retorna el `StoreConfig` completo. Todas las llamadas a la API de Venndelo y a Google Drive reciben este objeto.

### Cómo fluye el `storeKey`

```
Controller (body.store) → OperationsService.runDailyShipment(storeKey)
  → storesConfigService.getConfig(storeKey) → StoreConfig
    → ordersService.getAll(query, storeConfig)
    → shippingService.createShipments(dto, storeConfig)
    → googleDriveService.findFolderByName(name, storeConfig.driveRootFolderId)
    → shipmentLogService.saveBatch(rows) — incluye tienda como string
```

---

## 5. Variables de entorno

El archivo `.env` (no versionado) contiene:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default 3000) |
| `NODE_ENV` | `development` / `production` |
| `VENNDELO_BASE_URL` | `https://api.venndelo.com/v1/admin` |
| `VENNDELO_TIMEOUT` | Timeout en ms para llamadas API (default 120000) |
| `VENNDELO_BOGOTA_API_KEY` | API key de la tienda Bogotá |
| `VENNDELO_BOGOTA_STORE_ID` | ID tienda Bogotá (72824) |
| `VENNDELO_BOGOTA_DRIVE_FOLDER_ID` | Carpeta Drive raíz de Bogotá |
| `VENNDELO_CALI_API_KEY` | API key de la tienda Cali |
| `VENNDELO_CALI_STORE_ID` | ID tienda Cali (72787) |
| `VENNDELO_CALI_DRIVE_FOLDER_ID` | Carpeta Drive raíz de Cali |
| `VENNDELO_BOGOTA_WEB_EMAIL` | Email web admin Bogotá (para scraping de reportes) |
| `VENNDELO_BOGOTA_WEB_PASSWORD` | Contraseña web admin Bogotá |
| `VENNDELO_CALI_WEB_EMAIL` | Email web admin Cali |
| `VENNDELO_CALI_WEB_PASSWORD` | Contraseña web admin Cali |
| `CONSOLIDADO_FILE_ID` | ID del Google Sheet consolidado de pedidos |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth2 Client ID de Google Cloud |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth2 Client Secret |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Refresh token con scopes Drive + Sheets |
| `MAIL_FROM` | Email remitente (Gmail) |
| `MAIL_TO` | Email destinatario de reportes |
| `MAIL_APP_PASSWORD` | Gmail App Password (no es la contraseña de cuenta) |
| `DB_HOST` | Host PostgreSQL |
| `DB_PORT` | Puerto PostgreSQL (default 5432) |
| `DB_NAME` | Nombre de la base de datos |
| `DB_USER` | Usuario PostgreSQL |
| `DB_PASSWORD` | Contraseña PostgreSQL |

### Configuraciones registradas (`registerAs`)

| Archivo | Namespace |
|---|---|
| `venndelo.config.ts` | `venndelo.*` |
| `google.config.ts` | `google.*` |
| `database.config.ts` | `database.*` |
| `descarga-pedidos.config.ts` | `descargaPedidos.*` |

---

## 6. Endpoints disponibles

Base URL: `http://<host>:3000/api/v1`
Swagger: `http://<host>:3000/docs`

### Operations

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/operations/daily-shipment` | Proceso completo de cargue de guías para una tienda |
| POST | `/operations/test-shipment` | Mismo proceso pero para una sola orden (prueba) |

Body `daily-shipment`:
```json
{ "store": "bogota" }
```

Body `test-shipment`:
```json
{ "order_id": "10161802", "store": "bogota" }
```

### Descarga Pedidos

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/descarga-pedidos/ejecutar` | Descarga y consolida pedidos de ambas tiendas |

### Mail

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/mail/test` | Envía correo de prueba con datos ficticios |

### Venndelo (CRUD)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/orders` | Lista órdenes con filtros (status, page, limit, dateFrom, dateTo) |
| GET | `/orders/:id` | Orden por ID |
| GET | `/orders/:id/tracking` | Tracking de una orden |
| POST | `/orders` | Crear orden |
| PATCH | `/orders/:id/status` | Actualizar estado de orden |
| PATCH | `/orders/:id/cancel` | Cancelar orden |
| POST | `/shipping/create-shipments` | Crear envíos para órdenes |
| POST | `/shipping/generate-labels` | Generar etiquetas |
| POST | `/shipping/request-pickup` | Solicitar recolección |
| GET | `/shipping/exceptions` | Listar excepciones de envío |
| GET | `/products` | Lista de productos |
| GET | `/categories` | Lista de categorías |
| GET | `/users` | Lista de usuarios |

### Health

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Verifica que el servidor está corriendo |

---

## 7. Proceso A — Cargue de guías (7 pasos)

Orquestado por `OperationsService`. Se ejecuta por tienda de forma independiente.

### Punto de entrada

```
POST /api/v1/operations/daily-shipment
Body: { "store": "bogota" | "cali" }
```

### Flujo detallado

```
Inicio
  │
  ▼
[Paso 1] Obtener órdenes PENDING
  │  → GET /orders?status=PENDING&page=1&limit=500
  │  → Si no hay órdenes → lanza Error (proceso detenido)
  │  → Registra: StepReport #1 "Órdenes obtenidas"
  │
  ▼
[Paso 2] Crear envíos
  │  → POST /shipping/create-shipments { order_ids: [...] }
  │  → Registra: StepReport #2 "Envíos creados"
  │
  ▼
[Paso 3] Generar etiquetas (con polling)
  │  → POST /shipping/generate-labels
  │       { output: 'URL', format: 'LABEL_10x15', order_ids: [...] }
  │  → Polling: cada 60s, máximo 30 intentos (30 minutos)
  │  → Timeout por intento: 180s (3 minutos)
  │  → Espera status == 'SUCCESS' en la respuesta
  │  → Retorna URL de las etiquetas en PDF
  │  → Si timeout → lanza Error (proceso detenido)
  │  → Registra: StepReport #3 "Etiquetas generadas"
  │
  ▼
[Paso 3b] Obtener tracking numbers (con polling)
  │  → GET /orders/:id para cada orden (en paralelo iterativo)
  │  → Polling: cada 60s, máximo 30 intentos
  │  → Espera que order.shipments[0].tracking_number esté disponible
  │  → Construye Map<orderId, trackingNumber>
  │  → Si alguna orden no obtiene tracking → se registra vacío (no detiene el proceso)
  │  → Registra: StepReport #3b "Tracking numbers"
  │
  ▼
[Paso 4] Construir CSV en memoria
  │  → Columnas: pin | No Guia | name | sku | quantity | label_url | fecha
  │  → Una fila por line_item de cada orden
  │  → fecha formato: YYYY-MM-DD
  │  → Guarda temporalmente en OS tmp dir
  │  → Registra: StepReport #4 "CSV generado"
  │
  ▼
[Paso 5] Buscar o crear carpeta en Google Drive
  │  → Nombre: "Guías {día} {Mes} {año}" (ej: "Guías 30 Julio 2026")
  │  → Busca en la carpeta raíz de la tienda
  │  → Si existe → reutiliza; si no → crea nueva
  │  → Registra: StepReport #5 "Carpeta Drive"
  │
  ▼
[Paso 6] Subir CSV como Google Sheet
  │  → Nombre del archivo: "VE-SB {día} {Mes} {año}_{hora}am/pm"
  │     (ej: "VE-SB 30 Julio 2026_9:30am")
  │  → Sube como Google Sheet (convierte CSV automáticamente)
  │  → Retorna webViewLink del sheet
  │  → Registra: StepReport #6 "Sheet subido a Drive"
  │
  ▼
[Paso 7] Solicitar pickup
  │  → POST /shipping/request-pickup { order_ids: [...] }
  │  → Si falla → registra error pero NO detiene el proceso
  │  → Registra: StepReport #7 "Pickup solicitado"
  │
  ▼
[Log BD] Guardar en PostgreSQL
  │  → INSERT en tabla "Envio_bodegas" por cada line_item
  │  → Transacción BEGIN/COMMIT — rollback si falla
  │
  ▼
[Email] Enviar reporte de éxito
  │  → Asunto: "Cargue guias-{día} {Mes} {año}"
  │  → Incluye estado de cada paso + link al Sheet + órdenes procesadas
  │
  ▼
Respuesta JSON al cliente
```

### Manejo de errores

Si cualquier paso 2–6 lanza una excepción:
1. El catch captura el error.
2. Se envía un **correo de error** con los pasos completados hasta ese momento.
3. El error se re-lanza (el cliente recibe un HTTP 500).

El **paso 7 (pickup)** tiene su propio try-catch interno — un fallo en pickup NO detiene el proceso; se registra como `status: 'error'` en el reporte.

### Resultado JSON exitoso

```json
{
  "ordersProcessed": 8,
  "orderIds": ["10161802", "..."],
  "driveFolder": { "id": "...", "name": "Guías 30 Julio 2026", "webViewLink": "..." },
  "driveSheet":  { "id": "...", "name": "VE-SB 30 Julio 2026_9:30am", "webViewLink": "..." },
  "shipments": { ... },
  "labels": { "status": "SUCCESS", "data": "https://..." },
  "pickup": { ... }
}
```

---

## 8. Proceso B — Descarga de pedidos

Orquestado por `DescargaPedidosService`. Procesa **ambas tiendas** (Cali y Bogotá) en secuencia dentro de una sola llamada.

### Punto de entrada

```
POST /api/v1/descarga-pedidos/ejecutar
```

### Configuración de fechas

- `startAt`: definido en `descarga-pedidos.config.ts` → valor actual: `'2026-03-19'`
- `endAt`: fecha actual del día en que se ejecuta el proceso
- Se descarga el rango completo `startAt → hoy` en cada ejecución

### Flujo detallado por tienda

```
Para cada tienda (Cali → Bogotá):
  │
  ▼
[Sub-paso 1] Login con Playwright (headless Chromium)
  │  → Abre https://app.venndelo.com/web/#/login
  │  → Llena email y password
  │  → Hace clic en botón "Ingresar"
  │  → Espera redirección post-login
  │  → Extrae JWT de localStorage
  │  → Cierra el browser
  │  → Si no hay JWT → lanza Error
  │
  ▼
[Sub-paso 2] Exportar reporte vía JSON-RPC
  │  → POST https://app.venndelo.com/v2/admin/rpc
  │       method: Admin_Order_Export.export
  │       params: { start_at: '2026-03-19', end_at: 'hoy' }
  │  → Header: x-venndelo-admin-token: {JWT}
  │  → Respuesta: { result: { url: "https://..." } }
  │
  ▼
[Sub-paso 3] Descargar archivo Excel
  │  → GET a la URL del resultado
  │  → responseType: 'arraybuffer'
  │  → Retorna Buffer con el .xlsx
  │
  ▼
[Sub-paso 4] Procesar Excel en memoria (ExcelJS)
  │  → Lee hoja "Items":
  │       col A = PIN, col G = Unidades
  │       Acumula total de unidades por PIN → Map<pin, total>
  │  → Lee hoja "Detalle de ordenes":
  │       col A = PIN, col I = Total Items
  │       Escribe el total acumulado en col I de cada fila
  │  → Genera nombre: pedidos_{tienda}_procesado_{YYYY-MM-DD}.xlsx
  │  → Retorna nuevo Buffer con el Excel modificado
  │
  ▼
[Sub-paso 5] Subir a Google Drive
  │  → Sube como .xlsx a la carpeta de Drive de la tienda
  │  → Retorna webViewLink
  │
  ▼
Siguiente tienda...
```

### Consolidación final

Después de procesar ambas tiendas (si al menos una fue exitosa):

```
[Consolidado] Unir ambos Excel en Google Sheets
  │  → Abre el Google Sheet de consolidado (CONSOLIDADO_FILE_ID)
  │  → Lee la hoja "Detalle de ordenes" de cada Excel procesado
  │  → Limpia el Sheet (clear)
  │  → Escribe todas las filas: Cali (con header) + Bogotá (sin header)
  │  → Retorna enlace al Sheet consolidado
```

### Respuesta JSON

```json
{
  "resultados": [
    { "tienda": "Cali",      "ok": true,  "enlace": "https://drive.google.com/..." },
    { "tienda": "Bogotá",    "ok": true,  "enlace": "https://drive.google.com/..." },
    { "tienda": "Consolidado", "ok": true, "enlace": "https://docs.google.com/spreadsheets/d/..." }
  ],
  "duracion": "47.3s"
}
```

Si una tienda falla, el campo `ok` es `false` y tiene campo `error` con el mensaje. El proceso continúa con la siguiente tienda.

---

## 9. Base de datos PostgreSQL

### Conexión

- Host: `api.admin.partnershopcol.com` (AWS)
- Puerto: `5432`
- Base de datos: `partnershopdb`
- Proveedor: `pg.Pool` (máx 5 conexiones, SSL desactivado)
- Se crea automáticamente en `onModuleInit` de `ShipmentLogService`

### Tabla `Envio_bodegas`

Creada automáticamente al arrancar si no existe:

```sql
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
);
```

**Relación FK:** `pin` referencia `orden_venta(id_orden_tienda)`. La tabla `orden_venta` debe tener un índice UNIQUE en `id_orden_tienda`.

### Campos

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | SERIAL | PK autoincremental |
| `pin` | VARCHAR(50) | Identificador de la orden en Venndelo (FK) |
| `numero_guia` | VARCHAR(100) | Número de tracking asignado por la transportadora |
| `nombre` | TEXT | Nombre del producto (line_item.name) |
| `cantidad` | INTEGER | Unidades del producto |
| `label_url` | TEXT | URL del PDF de etiquetas |
| `tienda` | VARCHAR(50) | Nombre de la tienda ('Venndelo Bogotá' o 'Venndelo Cali') |
| `fecha_proceso` | TIMESTAMPTZ | Fecha/hora de inserción (automática) |

### Inserción

Se realiza en una transacción `BEGIN/COMMIT`. Si alguna fila falla, se hace `ROLLBACK` de todo el lote. Una fila por cada `line_item` de cada orden.

---

## 10. Notificaciones por correo

### Configuración

- Proveedor: Gmail SMTP via Nodemailer
- Autenticación: Gmail App Password (no OAuth2)
- Remitente: `MAIL_FROM` (jjpar56624@gmail.com)
- Destinatario: `MAIL_TO` (atencion.partnershop@gmail.com)

### Correos enviados

#### 1. Reporte de cargue de guías (`sendShipmentReport`)

**Asunto:** `Cargue guias-{día} {Mes} {año}`

Incluye:
- Encabezado con nombre de tienda y hora
- Banner verde (éxito) o rojo (error)
- Tabla con estado de cada paso (1 al 7)
- Resumen: total de órdenes procesadas y link al Google Sheet

**Cuándo se envía:**
- Al finalizar exitosamente (después de `saveBatch`)
- En el catch si el proceso falla (con los pasos completados hasta ese momento)
- Nunca aborta el proceso principal — los errores de email se silencian

#### 2. Reporte de descarga de pedidos (`sendDescargaPedidosReport`)

Al finalizar el proceso B, con el resultado de cada tienda y el tiempo total.

#### 3. Email de prueba (`sendTestEmail`)

Se activa desde `POST /mail/test`. Envía datos ficticios para verificar la configuración.

---

## 11. Google Drive y Google Sheets

### Autenticación

El sistema soporta dos modos, seleccionados automáticamente:

1. **OAuth2** (modo activo): usa `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` y `GOOGLE_OAUTH_REFRESH_TOKEN`. El refresh token debe tener scopes de Drive y Sheets.

2. **Service Account** (legado): usa `GOOGLE_CLIENT_EMAIL` y `GOOGLE_PRIVATE_KEY`. Solo para Drive.

### Operaciones en el Proceso A (OperationsService → GoogleDriveService)

| Operación | Descripción |
|---|---|
| `findFolderByName(name, parentId)` | Busca carpeta por nombre dentro de una carpeta padre |
| `createFolder(name, parentId)` | Crea carpeta nueva |
| `uploadSheet(name, buffer, folderId)` | Sube un CSV y lo convierte a Google Sheets |

### Operaciones en el Proceso B (DescargaPedidosService — googleapis directo)

| Operación | Descripción |
|---|---|
| `drive.files.create(...)` | Sube un .xlsx a una carpeta de Drive |
| `sheets.spreadsheets.get(...)` | Lee metadata del Sheet consolidado |
| `sheets.spreadsheets.values.clear(...)` | Limpia el contenido del Sheet |
| `sheets.spreadsheets.values.update(...)` | Escribe las filas consolidadas |

### Estructura en Google Drive

```
📁 [Carpeta raíz Bogotá] (VENNDELO_BOGOTA_DRIVE_FOLDER_ID)
  └── 📁 Guías 30 Julio 2026
        └── 📊 VE-SB 30 Julio 2026_9:30am  ← Google Sheet con guías

📁 [Carpeta raíz Cali] (VENNDELO_CALI_DRIVE_FOLDER_ID)
  └── 📁 Guías 30 Julio 2026
        └── 📊 VE-SB 30 Julio 2026_9:35am

📁 [Descargas Bogotá] (descargaPedidos.bogota.driveFolderId)
  └── 📄 pedidos_Bogotá_procesado_2026-07-30.xlsx

📁 [Descargas Cali] (descargaPedidos.cali.driveFolderId)
  └── 📄 pedidos_Cali_procesado_2026-07-30.xlsx

📊 [Sheet Consolidado] (CONSOLIDADO_FILE_ID) ← siempre el mismo archivo, se sobreescribe
```

---

## 12. Cron jobs en servidor

Los procesos NO tienen cron interno en el código. Se ejecutan desde el crontab de Ubuntu en el servidor AWS.

### Configuración actual

```cron
# Descarga de pedidos — ambas tiendas
30 9 * * 1-5  curl -s -X POST http://localhost:3000/api/v1/descarga-pedidos/ejecutar

# Cargue de guías — Bogotá
35 13 * * 1-5  curl -s -X POST http://localhost:3000/api/v1/operations/daily-shipment \
                 -H "Content-Type: application/json" \
                 -d '{"store":"bogota"}'

# Cargue de guías — Cali
10 14 * * 1-5  curl -s -X POST http://localhost:3000/api/v1/operations/daily-shipment \
                 -H "Content-Type: application/json" \
                 -d '{"store":"cali"}'
```

### Horarios (lunes a viernes)

| Hora | Proceso |
|---|---|
| 9:30 a.m. | Descarga de pedidos (ambas tiendas) |
| 1:35 p.m. | Cargue de guías — Bogotá |
| 2:10 p.m. | Cargue de guías — Cali |

> Se recomienda una separación mínima de 30-35 minutos entre los dos cargues de guías para evitar solapamiento.

---

## 13. Estructura de carpetas

```
src/
├── app.module.ts                  — módulo raíz, imports y validación Joi
├── main.ts                        — bootstrap: prefix 'api', versión URI '1', Swagger, CORS
├── health.controller.ts           — GET /health
│
├── config/
│   ├── venndelo.config.ts         — namespace venndelo.*
│   ├── google.config.ts           — namespace google.*
│   ├── database.config.ts         — namespace database.*
│   └── descarga-pedidos.config.ts — namespace descargaPedidos.* (incluye startAt)
│
├── stores/
│   ├── store.types.ts             — StoreKey enum, StoreCredentials, StoreConfig
│   ├── stores-config.service.ts   — resuelve StoreConfig por StoreKey
│   └── stores-config.module.ts
│
├── database/
│   └── database.module.ts         — global, provee PG_POOL (pg.Pool)
│
├── mail/
│   ├── mail.module.ts             — global
│   ├── mail.service.ts            — sendShipmentReport, sendDescargaPedidosReport, sendTestEmail
│   ├── mail.controller.ts         — POST /mail/test
│   └── templates/
│       ├── shipment-report.template.ts       — HTML email cargue de guías
│       └── descarga-pedidos-report.template.ts — HTML email descarga pedidos
│
├── venndelo/
│   ├── venndelo-http.service.ts   — cliente HTTP base (Axios), inyecta API key y storeId
│   ├── venndelo-http.module.ts
│   ├── venndelo.module.ts
│   ├── orders/                    — CRUD órdenes vía API Venndelo
│   ├── shipping/                  — envíos, etiquetas, pickup, excepciones
│   ├── products/                  — productos
│   ├── categories/                — categorías
│   └── users/                     — usuarios
│
├── google-drive/
│   ├── google-drive.service.ts    — findFolderByName, createFolder, uploadSheet
│   ├── google-drive.module.ts
│   └── google-drive.controller.ts — endpoints manuales de Drive
│
├── shipment-log/
│   ├── shipment-log.service.ts    — onModuleInit (crea tabla), saveBatch
│   └── shipment-log.module.ts
│
├── operations/
│   ├── operations.service.ts      — orquesta los 7 pasos del Proceso A
│   ├── operations.controller.ts   — POST daily-shipment, POST test-shipment
│   └── operations.module.ts
│
└── descarga-pedidos/
    ├── descarga-pedidos.service.ts  — orquesta el Proceso B (Playwright + ExcelJS + Drive)
    ├── descarga-pedidos.controller.ts — POST ejecutar
    └── descarga-pedidos.module.ts
```

---

## 14. Flujo de datos completo

### Proceso A — Cargue de guías

```
Cliente / Cron
     │ POST /operations/daily-shipment { store: "bogota" }
     ▼
OperationsController
     │ dto.store → OperationsService.runDailyShipment("bogota")
     ▼
StoresConfigService.getConfig("bogota")
     │ → { apiKey, storeId, name, driveRootFolderId }
     ▼
OrdersService.getAll({ status: PENDING }, storeConfig)
     │ → GET https://api.venndelo.com/v1/admin/orders?status=PENDING
     │   Header: X-Venndelo-Api-Key: {apiKey}, X-Venndelo-Store-Id: {storeId}
     │ → orders[]
     ▼
ShippingService.createShipments({ order_ids }, storeConfig)
     │ → POST /shipping/create-shipments
     ▼
ShippingService.generateLabels (polling cada 60s × 30 intentos)
     │ → POST /shipping/generate-labels
     │ → espera status == 'SUCCESS'
     │ → labelUrl
     ▼
OrdersService.getById (polling por tracking_number)
     │ → GET /orders/:id por cada orden
     │ → Map<orderId, trackingNumber>
     ▼
buildCsv() — construcción en memoria
     │ → pin | No Guia | name | sku | quantity | label_url | fecha
     ▼
GoogleDriveService.findFolderByName / createFolder
     │ → googleapis drive v3
     │ → carpeta en Drive de la tienda
     ▼
GoogleDriveService.uploadSheet
     │ → sube CSV → convierte a Google Sheets
     │ → webViewLink del Sheet
     ▼
ShippingService.requestPickup
     │ → POST /shipping/request-pickup (try-catch independiente)
     ▼
ShipmentLogService.saveBatch
     │ → INSERT en PostgreSQL "Envio_bodegas"
     │   (transacción BEGIN/COMMIT/ROLLBACK)
     ▼
MailService.sendShipmentReport
     │ → Gmail SMTP → atencion.partnershop@gmail.com
     │ → Asunto: "Cargue guias-30 Julio 2026"
     ▼
Respuesta JSON → Cliente / Cron
```

### Proceso B — Descarga de pedidos

```
Cliente / Cron
     │ POST /descarga-pedidos/ejecutar
     ▼
DescargaPedidosController → DescargaPedidosService.ejecutar()
     │
     │ Para Cali y Bogotá (en secuencia):
     ▼
Playwright (Chromium headless)
     │ → https://app.venndelo.com/web/#/login
     │ → fill email + password → click Ingresar
     │ → extrae localStorage['token'] → JWT
     ▼
HttpService.post (JSON-RPC)
     │ → POST https://app.venndelo.com/v2/admin/rpc
     │   method: Admin_Order_Export.export
     │   params: { start_at: '2026-03-19', end_at: 'hoy' }
     │   Header: x-venndelo-admin-token: {JWT}
     │ → { result: { url: "https://..." } }
     ▼
HttpService.get (arraybuffer)
     │ → GET url del Excel
     │ → Buffer del .xlsx
     ▼
ExcelJS (procesamiento en memoria)
     │ → hoja "Items": acumula unidades por PIN
     │ → hoja "Detalle de ordenes": escribe totales en col I
     │ → nuevo Buffer procesado
     ▼
googleapis drive.files.create
     │ → sube .xlsx a carpeta Drive de la tienda
     │ → webViewLink
     │
     │ (repite para la otra tienda)
     ▼
googleapis sheets (consolidado — si al menos 1 tienda OK)
     │ → lee "Detalle de ordenes" de cada Excel
     │ → clear Sheet consolidado
     │ → write todas las filas
     ▼
MailService.sendDescargaPedidosReport
     │ → Gmail SMTP → atencion.partnershop@gmail.com
     ▼
Respuesta JSON → Cliente / Cron
```

---

*Documento generado desde el código fuente del repositorio `venndelo-backend`.*
