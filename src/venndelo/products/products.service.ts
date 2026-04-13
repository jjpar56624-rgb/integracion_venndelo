import { Injectable } from '@nestjs/common';
import { VenndeloHttpService } from '../venndelo-http.service';
import { CreateProductDto, GetProductsDto, UpdateProductDto } from './products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly venndeloHttp: VenndeloHttpService) {}

  getAll(query: GetProductsDto) {
    return this.venndeloHttp.get('/products', {
      page: query.page,
      limit: query.limit,
      category_id: query.categoryId,
      search: query.search,
    });
  }

  getById(id: string) {
    return this.venndeloHttp.get(`/products/${id}`);
  }

  create(dto: CreateProductDto) {
    return this.venndeloHttp.post('/products', dto);
  }

  update(id: string, dto: UpdateProductDto) {
    return this.venndeloHttp.put(`/products/${id}`, dto);
  }

  remove(id: string) {
    return this.venndeloHttp.delete(`/products/${id}`);
  }
}
