import { Injectable } from '@nestjs/common';
import { VenndeloHttpService } from '../venndelo-http.service';
import { CreateUserDto, GetUsersDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly venndeloHttp: VenndeloHttpService) {}

  getAll(query: GetUsersDto) {
    return this.venndeloHttp.get('/users', {
      page: query.page,
      limit: query.limit,
      search: query.search,
      role: query.role,
    });
  }

  getById(id: string) {
    return this.venndeloHttp.get(`/users/${id}`);
  }

  getOrders(id: string, page = 1, limit = 20) {
    return this.venndeloHttp.get(`/users/${id}/orders`, { page, limit });
  }

  create(dto: CreateUserDto) {
    return this.venndeloHttp.post('/users', dto);
  }

  update(id: string, dto: UpdateUserDto) {
    return this.venndeloHttp.put(`/users/${id}`, dto);
  }

  deactivate(id: string) {
    return this.venndeloHttp.patch(`/users/${id}/deactivate`);
  }
}
