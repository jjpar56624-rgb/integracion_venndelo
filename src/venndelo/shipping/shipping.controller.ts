import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  CollectionPointsByExceptionDto,
  CreateShipmentsDto,
  GenerateLabelsDto,
  GetCarrierCollectionPointsDto,
  GetShipmentExceptionsDto,
  RequestPickupDto,
  ResolveShippingExceptionDto,
} from './shipping.dto';
import { ShippingService } from './shipping.service';

@ApiTags('Shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('create-shipments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Crear envíos',
    description: 'Crea envíos para las órdenes especificadas.',
  })
  createShipments(@Body() dto: CreateShipmentsDto) {
    return this.shippingService.createShipments(dto);
  }

  @Post('generate-labels')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar etiquetas de envío (PDF)',
    description:
      'Genera etiquetas de envío en formato PDF. Puede retornar una URL o un string en Base64.',
  })
  generateLabels(@Body() dto: GenerateLabelsDto) {
    return this.shippingService.generateLabels(dto);
  }

  @Post('request-pickup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar recolección',
    description: 'Solicita la recolección de los paquetes de las órdenes especificadas.',
  })
  requestPickup(@Body() dto: RequestPickupDto) {
    return this.shippingService.requestPickup(dto);
  }

  @Get('exceptions')
  @ApiOperation({
    summary: 'Listar novedades de envío',
    description: 'Obtiene la lista de novedades (excepciones) de envío con filtros opcionales.',
  })
  getExceptions(@Query() query: GetShipmentExceptionsDto) {
    return this.shippingService.getExceptions(query);
  }

  @Get('exceptions/:id')
  @ApiOperation({
    summary: 'Obtener novedad de envío por ID',
    description: 'Retorna el detalle de una novedad de envío, incluyendo las posibles respuestas.',
  })
  @ApiParam({ name: 'id', description: 'ID UUID de la novedad de envío' })
  getExceptionById(@Param('id') id: string) {
    return this.shippingService.getExceptionById(id);
  }

  @Post('exceptions/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolver novedad de envío',
    description: 'Envía una respuesta al transportador para resolver la novedad.',
  })
  @ApiParam({ name: 'id', description: 'ID UUID de la novedad de envío' })
  resolveException(
    @Param('id') id: string,
    @Body() dto: ResolveShippingExceptionDto,
  ) {
    return this.shippingService.resolveException(id, dto);
  }

  @Post('collection-points-by-exception')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener puntos de recolección por novedad',
    description:
      'Retorna los puntos de recolección disponibles para resolver una novedad de envío.',
  })
  getCollectionPointsByException(@Body() dto: CollectionPointsByExceptionDto) {
    return this.shippingService.getCollectionPointsByException(dto);
  }

  @Get('carrier-collection-points')
  @ApiOperation({
    summary: 'Listar puntos de recolección del transportador',
    description: 'Obtiene los puntos de recolección disponibles (Puntos Droop Coordinadora).',
  })
  getCarrierCollectionPoints(@Query() query: GetCarrierCollectionPointsDto) {
    return this.shippingService.getCarrierCollectionPoints(query);
  }
}
