import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import { AxiosRequestConfig } from 'axios';
import { StoreCredentials } from '../stores/store.types';

@Injectable()
export class VenndeloHttpService {
  private readonly logger = new Logger(VenndeloHttpService.name);
  private readonly baseUrl: string;
  private readonly defaultApiKey: string;
  private readonly defaultStoreId: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.getOrThrow<string>('venndelo.baseUrl');
    this.defaultApiKey = this.configService.getOrThrow<string>('venndelo.stores.bogota.apiKey');
    this.defaultStoreId = this.configService.getOrThrow<string>('venndelo.stores.bogota.storeId');
    this.timeoutMs = this.configService.get<number>('venndelo.timeout', 30000);
  }

  private getHeaders(creds?: StoreCredentials): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Venndelo-Api-Key': creds?.apiKey ?? this.defaultApiKey,
      'X-Store-Id': creds?.storeId ?? this.defaultStoreId,
    };
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  async get<T>(path: string, params?: Record<string, unknown>, creds?: StoreCredentials): Promise<T> {
    const url = this.buildUrl(path);
    const config: AxiosRequestConfig = {
      headers: this.getHeaders(creds),
      params,
    };

    try {
      this.logger.debug(`GET ${url}`);
      const response = await firstValueFrom(
        this.httpService.get<T>(url, config).pipe(timeout(this.timeoutMs)),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'GET', url);
    }
  }

  async post<T>(path: string, body: unknown, timeoutMs?: number, creds?: StoreCredentials): Promise<T> {
    const url = this.buildUrl(path);
    const config: AxiosRequestConfig = { headers: this.getHeaders(creds) };

    try {
      this.logger.debug(`POST ${url}`);
      const response = await firstValueFrom(
        this.httpService.post<T>(url, body, config).pipe(timeout(timeoutMs ?? this.timeoutMs)),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'POST', url);
    }
  }

  async put<T>(path: string, body: unknown, creds?: StoreCredentials): Promise<T> {
    const url = this.buildUrl(path);
    const config: AxiosRequestConfig = { headers: this.getHeaders(creds) };

    try {
      this.logger.debug(`PUT ${url}`);
      const response = await firstValueFrom(
        this.httpService.put<T>(url, body, config).pipe(timeout(this.timeoutMs)),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'PUT', url);
    }
  }

  async patch<T>(path: string, body?: unknown, creds?: StoreCredentials): Promise<T> {
    const url = this.buildUrl(path);
    const config: AxiosRequestConfig = { headers: this.getHeaders(creds) };

    try {
      this.logger.debug(`PATCH ${url}`);
      const response = await firstValueFrom(
        this.httpService.patch<T>(url, body, config).pipe(timeout(this.timeoutMs)),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'PATCH', url);
    }
  }

  async delete<T>(path: string, creds?: StoreCredentials): Promise<T> {
    const url = this.buildUrl(path);
    const config: AxiosRequestConfig = { headers: this.getHeaders(creds) };

    try {
      this.logger.debug(`DELETE ${url}`);
      const response = await firstValueFrom(
        this.httpService.delete<T>(url, config).pipe(timeout(this.timeoutMs)),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'DELETE', url);
    }
  }

  private handleError(error: unknown, method: string, url: string): never {
    const axiosError = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
    const status = axiosError?.response?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const message = axiosError?.response?.data?.message ?? axiosError?.message ?? 'Error al conectar con Venndelo';

    this.logger.error(`[${method}] ${url} - ${status}: ${message}`);

    throw new HttpException(
      {
        message,
        venndeloError: axiosError?.response?.data ?? null,
      },
      status,
    );
  }
}
