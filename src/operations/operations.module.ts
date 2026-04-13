import { Module } from '@nestjs/common';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { StoresConfigModule } from '../stores/stores-config.module';
import { OrdersModule } from '../venndelo/orders/orders.module';
import { ShippingModule } from '../venndelo/shipping/shipping.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [OrdersModule, ShippingModule, GoogleDriveModule, StoresConfigModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
