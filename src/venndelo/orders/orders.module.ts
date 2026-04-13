import { Module } from '@nestjs/common';
import { VenndeloHttpModule } from '../venndelo-http.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [VenndeloHttpModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
