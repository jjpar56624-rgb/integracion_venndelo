import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Enums ─────────────────────────────────────────────────────────────────

export enum LabelOutput {
  URL = 'URL',
  BASE64 = 'BASE64',
}

export enum LabelFormat {
  LETTER_2PP = 'LETTER_2PP',
  LABEL_10x10 = 'LABEL_10x10',
  LABEL_10x15 = 'LABEL_10x15',
}

export enum ShipmentExceptionStatus {
  ANY = 'ANY',
  PENDING = 'PENDING',
  TRANSMITTING = 'TRANSMITTING',
  REPLIED = 'REPLIED',
  ERROR = 'ERROR',
  REJECTED = 'REJECTED',
  APPROVED = 'APPROVED',
}

export enum CarrierCode {
  COORDINADORA = 'COORDINADORA',
}

export enum CarrierCollectionPointStatus {
  ANY = 'ANY',
  DISABLED = 'DISABLED',
  ENABLED = 'ENABLED',
}

// ─── Create Shipments ───────────────────────────────────────────────────────

export class CreateShipmentsDto {
  @ApiProperty({
    description: 'IDs de las órdenes para crear envíos',
    type: [String],
    example: ['10150055', '10150056'],
  })
  @IsArray()
  @IsString({ each: true })
  order_ids: string[];
}

// ─── Generate Labels ────────────────────────────────────────────────────────

export class GenerateLabelsDto {
  @ApiProperty({
    enum: LabelOutput,
    description:
      'BASE64: El contenido del PDF se devuelve como cadena base64. URL: se devuelve como URL descargable.',
    example: LabelOutput.URL,
  })
  @IsEnum(LabelOutput)
  output: LabelOutput;

  @ApiProperty({
    enum: LabelFormat,
    description:
      'LETTER_2PP: Media página carta. LABEL_10x10: 10x10 cm. LABEL_10x15: 10x15 cm.',
    example: LabelFormat.LABEL_10x15,
  })
  @IsEnum(LabelFormat)
  format: LabelFormat;

  @ApiProperty({
    description: 'IDs de las órdenes para generar etiquetas',
    type: [String],
    example: ['10150055'],
  })
  @IsArray()
  @IsString({ each: true })
  order_ids: string[];
}

// ─── Request Pickup ─────────────────────────────────────────────────────────

export class RequestPickupDto {
  @ApiProperty({
    description: 'IDs de las órdenes para solicitar recolección',
    type: [String],
    example: ['10150055'],
  })
  @IsArray()
  @IsString({ each: true })
  order_ids: string[];
}

// ─── Get Shipment Exceptions ─────────────────────────────────────────────────

export class GetShipmentExceptionsDto {
  @ApiPropertyOptional({
    description: 'Token de página (vacío para la primera página)',
    default: '',
    example: '',
  })
  @IsOptional()
  @IsString()
  page_token?: string;

  @ApiPropertyOptional({
    description: 'Número de elementos por página',
    default: 250,
    example: 250,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_size?: number;

  @ApiPropertyOptional({
    description: 'Fecha mínima de creación (ISO 8601 UTC). Ej: 2025-10-01T12:00:00Z',
    example: '2025-10-01T12:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  created_min?: string;

  @ApiPropertyOptional({
    description: 'Fecha máxima de creación (ISO 8601 UTC). Ej: 2025-10-01T12:00:00Z',
    example: '2025-10-01T12:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  created_max?: string;

  @ApiPropertyOptional({
    enum: ShipmentExceptionStatus,
    description:
      'ANY: Todos | PENDING: Pendiente | TRANSMITTING: Enviando | REPLIED: Respondida | ERROR | REJECTED: Rechazada | APPROVED: Aprobada',
    default: ShipmentExceptionStatus.ANY,
  })
  @IsOptional()
  @IsEnum(ShipmentExceptionStatus)
  status?: ShipmentExceptionStatus;
}

// ─── Resolve Shipping Exception ──────────────────────────────────────────────

export class ResolveShippingExceptionDto {
  @ApiProperty({
    description: 'ID del tipo de resolución de la excepción de envío',
    example: 1,
  })
  @IsInt()
  @Type(() => Number)
  type_id: number;

  @ApiProperty({
    description: 'Notas adicionales sobre la resolución',
    example: 'El cliente reprogramó la entrega',
  })
  @IsString()
  notes: string;

  @ApiPropertyOptional({
    description: 'Fecha de entrega del paquete (ISO 8601). Ej: 2025-10-01',
    example: '2025-10-01',
  })
  @IsOptional()
  @IsString()
  delivery_date?: string;

  @ApiPropertyOptional({
    description: 'Dirección de entrega',
    example: 'Calle 123 # 45 - 67',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'ID del punto de recogida (Punto Droop Coordinadora)',
    example: 'abc123',
  })
  @IsOptional()
  @IsString()
  collection_point_id?: string;
}

// ─── Collection Points by Shipping Exception ─────────────────────────────────

export class CollectionPointsByExceptionDto {
  @ApiProperty({
    description: 'ID de la novedad de transporte',
    example: 'uuid-exception-id',
  })
  @IsString()
  shipping_exception_id: string;
}

// ─── Get Carrier Collection Points ───────────────────────────────────────────

export class GetCarrierCollectionPointsDto {
  @ApiPropertyOptional({
    description: 'Token de página (vacío para la primera página)',
    default: '',
  })
  @IsOptional()
  @IsString()
  page_token?: string;

  @ApiPropertyOptional({
    description: 'Número de elementos por página',
    default: 250,
    example: 250,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_size?: number;

  @ApiPropertyOptional({
    enum: CarrierCode,
    description: 'Código del transportador',
    default: CarrierCode.COORDINADORA,
  })
  @IsOptional()
  @IsEnum(CarrierCode)
  carrier_code?: CarrierCode;

  @ApiPropertyOptional({
    enum: CarrierCollectionPointStatus,
    description: 'Estado del punto de recolección',
    default: CarrierCollectionPointStatus.ANY,
  })
  @IsOptional()
  @IsEnum(CarrierCollectionPointStatus)
  status?: CarrierCollectionPointStatus;
}
