import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateOrderDto, GetOrdersDto, UpdateOrderStatusDto } from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los pedidos de Venndelo' })
  getAll(@Query() query: GetOrdersDto) {
    return this.ordersService.getAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un pedido por ID' })
  @ApiParam({ name: 'id', description: 'ID del pedido' })
  getById(@Param('id') id: string) {
    return this.ordersService.getById(id);
  }

  @Get(':id/tracking')
  @ApiOperation({ summary: 'Obtener tracking de un pedido' })
  @ApiParam({ name: 'id', description: 'ID del pedido' })
  getTracking(@Param('id') id: string) {
    return this.ordersService.getTracking(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo pedido en Venndelo' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Actualizar el estado de un pedido' })
  @ApiParam({ name: 'id', description: 'ID del pedido' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar un pedido' })
  @ApiParam({ name: 'id', description: 'ID del pedido' })
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string) {
    return this.ordersService.cancel(id);
  }
}
