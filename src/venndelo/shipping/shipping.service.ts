import { Injectable } from '@nestjs/common';
import { VenndeloHttpService } from '../venndelo-http.service';
import {
  CollectionPointsByExceptionDto,
  CreateShipmentsDto,
  GenerateLabelsDto,
  GetCarrierCollectionPointsDto,
  GetShipmentExceptionsDto,
  RequestPickupDto,
  ResolveShippingExceptionDto,
} from './shipping.dto';
import { StoreCredentials } from '../../stores/store.types';

@Injectable()
export class ShippingService {
  constructor(private readonly venndeloHttp: VenndeloHttpService) {}

  createShipments(dto: CreateShipmentsDto, creds?: StoreCredentials) {
    return this.venndeloHttp.post('/shipping/create-shipments', dto, undefined, creds);
  }

  generateLabels(dto: GenerateLabelsDto, timeoutMs?: number, creds?: StoreCredentials) {
    return this.venndeloHttp.post('/shipping/generate-labels', dto, timeoutMs, creds);
  }

  requestPickup(dto: RequestPickupDto, creds?: StoreCredentials) {
    return this.venndeloHttp.post('/shipping/request-pickup', dto, undefined, creds);
  }

  getExceptions(query: GetShipmentExceptionsDto, creds?: StoreCredentials) {
    return this.venndeloHttp.get('/shipping/exceptions', {
      page_token: query.page_token,
      page_size: query.page_size,
      created_min: query.created_min,
      created_max: query.created_max,
      status: query.status,
    }, creds);
  }

  getExceptionById(id: string, creds?: StoreCredentials) {
    return this.venndeloHttp.get(`/shipping/exceptions/${id}`, undefined, creds);
  }

  resolveException(id: string, dto: ResolveShippingExceptionDto, creds?: StoreCredentials) {
    return this.venndeloHttp.post(`/shipping/exceptions/${id}/resolve`, dto, undefined, creds);
  }

  getCollectionPointsByException(dto: CollectionPointsByExceptionDto, creds?: StoreCredentials) {
    return this.venndeloHttp.post('/shipping/collection-points-by-shipping-exception', dto, undefined, creds);
  }

  getCarrierCollectionPoints(query: GetCarrierCollectionPointsDto, creds?: StoreCredentials) {
    return this.venndeloHttp.get('/shipping/carrier-collection-points', {
      page_token: query.page_token,
      page_size: query.page_size,
      carrier_code: query.carrier_code,
      status: query.status,
    }, creds);
  }
}
