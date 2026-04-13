import { Module } from '@nestjs/common';
import { VenndeloHttpModule } from '../venndelo-http.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [VenndeloHttpModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
