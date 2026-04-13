import { Module } from '@nestjs/common';
import { VenndeloHttpModule } from '../venndelo-http.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [VenndeloHttpModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
