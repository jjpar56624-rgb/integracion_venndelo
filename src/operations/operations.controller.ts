import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { StoreKey } from '../stores/store.types';
import { OperationsService } from './operations.service';

export class DailyShipmentDto {
  @ApiProperty({
    description: 'Tienda a procesar',
    enum: StoreKey,
    example: StoreKey.BOGOTA,
  })
  @IsEnum(StoreKey)
  store: StoreKey;
}

export class TestShipmentDto {
  @ApiProperty({
    description: 'ID de la orden en estado PENDING a procesar',
    example: '10161802',
  })
  @IsString()
  order_id: string;

  @ApiProperty({
    description: 'Tienda a la que pertenece la orden',
    enum: StoreKey,
    example: StoreKey.BOGOTA,
  })
  @IsEnum(StoreKey)
  store: StoreKey;
}

@ApiTags('Operations')
@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Post('daily-shipment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Proceso diario de envíos',
    description: `Ejecuta el flujo completo de envíos del día en 7 pasos:
1. Obtiene todas las órdenes en estado PENDING
2. Crea los envíos para esas órdenes
3. Genera las etiquetas (formato LABEL_10x15, salida URL)
4. Construye un CSV con pin, No Guia, producto, SKU, cantidad y URL de etiqueta
5. Crea una carpeta en Google Drive con la fecha actual
6. Sube el CSV como Google Sheet en esa carpeta
7. Solicita la recolección de las órdenes`,
  })
  @ApiBody({ type: DailyShipmentDto })
  runDailyShipment(@Body() dto: DailyShipmentDto) {
    return this.operationsService.runDailyShipment(dto.store);
  }

  @Post('test-shipment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Prueba del proceso con una sola orden',
    description: `Ejecuta el mismo flujo de 7 pasos que daily-shipment pero para una única orden específica.
Útil para validar el proceso sin afectar el lote completo de órdenes PENDING.`,
  })
  @ApiBody({ type: TestShipmentDto })
  runTestShipment(@Body() dto: TestShipmentDto) {
    return this.operationsService.runTestShipment(dto.order_id, dto.store);
  }
}
