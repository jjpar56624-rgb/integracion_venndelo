import { Module } from '@nestjs/common';
import { DescargaPedidosController } from './descarga-pedidos.controller';
import { DescargaPedidosService } from './descarga-pedidos.service';

@Module({
  controllers: [DescargaPedidosController],
  providers: [DescargaPedidosService],
})
export class DescargaPedidosModule {}
