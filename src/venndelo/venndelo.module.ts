import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { ShippingModule } from './shipping/shipping.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [ProductsModule, CategoriesModule, OrdersModule, UsersModule, ShippingModule],
})
export class VenndeloModule {}
