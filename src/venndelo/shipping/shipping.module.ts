import { Module } from '@nestjs/common';
import { VenndeloHttpModule } from '../venndelo-http.module';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [VenndeloHttpModule],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
