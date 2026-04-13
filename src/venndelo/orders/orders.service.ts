import { Injectable, Logger } from '@nestjs/common';
import { VenndeloHttpService } from '../venndelo-http.service';
import { CreateOrderDto, GetOrdersDto, UpdateOrderStatusDto } from './orders.dto';
import { StoreCredentials } from '../../stores/store.types';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly venndeloHttp: VenndeloHttpService) {}

  getAll(query: GetOrdersDto, creds?: StoreCredentials) {
    this.logger.log('Fetching orders...', { query });
    return this.venndeloHttp.get('/orders', {
      page: query.page,
      limit: query.limit,
      status: query.status,
      user_id: query.userId,
      date_from: query.dateFrom,
      date_to: query.dateTo,
    }, creds);
  }

  getById(id: string, creds?: StoreCredentials) {
    return this.venndeloHttp.get(`/orders/${id}`, undefined, creds);
  }

  getTracking(id: string, creds?: StoreCredentials) {
    return this.venndeloHttp.get(`/orders/${id}/tracking`, undefined, creds);
  }

  create(dto: CreateOrderDto, creds?: StoreCredentials) {
    return this.venndeloHttp.post('/orders', dto, undefined, creds);
  }

  updateStatus(id: string, dto: UpdateOrderStatusDto, creds?: StoreCredentials) {
    return this.venndeloHttp.patch(`/orders/${id}/status`, dto, creds);
  }

  cancel(id: string, creds?: StoreCredentials) {
    return this.venndeloHttp.patch(`/orders/${id}/cancel`, undefined, creds);
  }
}
