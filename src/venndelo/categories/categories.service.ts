import { Injectable } from '@nestjs/common';
import { VenndeloHttpService } from '../venndelo-http.service';
import { CreateCategoryDto, GetCategoriesDto, UpdateCategoryDto } from './categories.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly venndeloHttp: VenndeloHttpService) {}

  getAll(query: GetCategoriesDto) {
    return this.venndeloHttp.get('/categories', {
      page: query.page,
      limit: query.limit,
      search: query.search,
      parent_id: query.parentId,
    });
  }

  getById(id: string) {
    return this.venndeloHttp.get(`/categories/${id}`);
  }

  getProducts(id: string, page = 1, limit = 20) {
    return this.venndeloHttp.get(`/categories/${id}/products`, { page, limit });
  }

  create(dto: CreateCategoryDto) {
    return this.venndeloHttp.post('/categories', dto);
  }

  update(id: string, dto: UpdateCategoryDto) {
    return this.venndeloHttp.put(`/categories/${id}`, dto);
  }

  remove(id: string) {
    return this.venndeloHttp.delete(`/categories/${id}`);
  }
}
