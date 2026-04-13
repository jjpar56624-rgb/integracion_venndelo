export enum StoreKey {
  BOGOTA = 'bogota',
  CALI = 'cali',
}

export interface StoreCredentials {
  apiKey: string;
  storeId: string;
}

export interface StoreConfig extends StoreCredentials {
  name: string;
  driveRootFolderId: string;
}
