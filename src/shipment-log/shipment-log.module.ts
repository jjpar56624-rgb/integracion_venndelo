import { Module } from '@nestjs/common';
import { ShipmentLogService } from './shipment-log.service';

@Module({
  providers: [ShipmentLogService],
  exports: [ShipmentLogService],
})
export class ShipmentLogModule {}
