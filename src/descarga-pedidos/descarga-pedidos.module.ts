import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DescargaPedidosController } from './descarga-pedidos.controller';
import { DescargaPedidosService } from './descarga-pedidos.service';

@Module({
  imports: [HttpModule],
  controllers: [DescargaPedidosController],
  providers: [DescargaPedidosService],
})
export class DescargaPedidosModule {}
