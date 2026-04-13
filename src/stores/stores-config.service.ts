import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoreConfig, StoreKey } from './store.types';

@Injectable()
export class StoresConfigService {
  private readonly stores: Record<StoreKey, StoreConfig>;

  constructor(private readonly configService: ConfigService) {
    this.stores = {
      [StoreKey.BOGOTA]: {
        name: 'Venndelo Bogotá',
        apiKey: this.configService.getOrThrow('venndelo.stores.bogota.apiKey'),
        storeId: this.configService.getOrThrow('venndelo.stores.bogota.storeId'),
        driveRootFolderId: this.configService.get('venndelo.stores.bogota.driveRootFolderId', ''),
      },
      [StoreKey.CALI]: {
        name: 'Venndelo Cali',
        apiKey: this.configService.getOrThrow('venndelo.stores.cali.apiKey'),
        storeId: this.configService.getOrThrow('venndelo.stores.cali.storeId'),
        driveRootFolderId: this.configService.get('venndelo.stores.cali.driveRootFolderId', ''),
      },
    };
  }

  getConfig(storeKey: StoreKey): StoreConfig {
    return this.stores[storeKey];
  }

  getAll(): Record<StoreKey, StoreConfig> {
    return this.stores;
  }
}
