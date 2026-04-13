import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drive_v3, google } from 'googleapis';
import { Readable } from 'stream';

@Injectable()
export class GoogleDriveService implements OnModuleInit {
  private readonly logger = new Logger(GoogleDriveService.name);
  private drive: drive_v3.Drive;

  constructor(private readonly configService: ConfigService) {}

  /** Google Drive IDs tienen al menos 10 caracteres alfanuméricos/guiones bajos */
  private resolveParentId(parentId?: string): string | undefined {
    const rootFolderId = this.configService.get<string>('google.driveRootFolderId');
    const isValid = parentId && /^[a-zA-Z0-9_-]{10,}$/.test(parentId);
    return isValid ? parentId : (rootFolderId || undefined);
  }

  onModuleInit() {
    const oauthClientId = this.configService.get<string>('google.oauthClientId');
    const oauthClientSecret = this.configService.get<string>('google.oauthClientSecret');
    const oauthRefreshToken = this.configService.get<string>('google.oauthRefreshToken');

    if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
      // ── OAuth2: archivos quedan en la cuenta personal del usuario ─────────
      const oauth2Client = new google.auth.OAuth2(oauthClientId, oauthClientSecret);
      oauth2Client.setCredentials({ refresh_token: oauthRefreshToken });
      this.drive = google.drive({ version: 'v3', auth: oauth2Client });
      this.logger.log('Google Drive service initialized (OAuth2 - cuenta personal)');
    } else {
      // ── Service Account (fallback) ─────────────────────────────────────────
      const clientEmail = this.configService.getOrThrow<string>('google.clientEmail');
      const privateKey = this.configService.getOrThrow<string>('google.privateKey');
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      this.drive = google.drive({ version: 'v3', auth });
      this.logger.log('Google Drive service initialized (Service Account)');
    }
  }

  // ─── Folders ───────────────────────────────────────────────────────────────

  async createFolder(name: string, parentId?: string): Promise<drive_v3.Schema$File> {
    try {
      const resolvedParent = this.resolveParentId(parentId);
      const metadata: drive_v3.Schema$File = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(resolvedParent && { parents: [resolvedParent] }),
      };

      const response = await this.drive.files.create({
        requestBody: metadata,
        fields: 'id, name, webViewLink, createdTime',
        supportsAllDrives: true,
      });

      this.logger.log(`Folder created: "${name}" (${response.data.id})`);
      return response.data;
    } catch (error) {
      this.handleError(error, `createFolder("${name}")`);
    }
  }

  async findFolderByName(name: string, parentId?: string): Promise<drive_v3.Schema$File | null> {
    try {
      const resolvedParent = this.resolveParentId(parentId);
      const query = [
        "mimeType = 'application/vnd.google-apps.folder'",
        'trashed = false',
        `name = '${name}'`,
        ...(resolvedParent ? [`'${resolvedParent}' in parents`] : []),
      ].join(' and ');

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink, createdTime)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const found = response.data.files?.[0] ?? null;
      if (found) {
        this.logger.log(`Folder found: "${name}" (${found.id})`);
      }
      return found;
    } catch (error) {
      this.handleError(error, `findFolderByName("${name}")`);
    }
  }

  async listFolders(parentId?: string): Promise<drive_v3.Schema$File[]> {
    try {
      const parent = this.resolveParentId(parentId);

      const query = [
        "mimeType = 'application/vnd.google-apps.folder'",
        'trashed = false',
        ...(parent ? [`'${parent}' in parents`] : []),
      ].join(' and ');

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink, createdTime)',
        orderBy: 'name',
      });

      return response.data.files ?? [];
    } catch (error) {
      this.handleError(error, 'listFolders');
    }
  }

  async listFiles(parentId?: string): Promise<drive_v3.Schema$File[]> {
    try {
      const parent = this.resolveParentId(parentId);

      const query = [
        "mimeType != 'application/vnd.google-apps.folder'",
        'trashed = false',
        ...(parent ? [`'${parent}' in parents`] : []),
      ].join(' and ');

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, size, webViewLink, createdTime)',
        orderBy: 'name',
      });

      return response.data.files ?? [];
    } catch (error) {
      this.handleError(error, 'listFiles');
    }
  }

  // ─── Upload PDF ────────────────────────────────────────────────────────────

  async uploadPdf(
    fileName: string,
    buffer: Buffer,
    parentId?: string,
  ): Promise<drive_v3.Schema$File> {
    try {
      const parent = this.resolveParentId(parentId);

      const name = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

      const response = await this.drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/pdf',
          ...(parent && { parents: [parent] }),
        },
        media: {
          mimeType: 'application/pdf',
          body: Readable.from(buffer),
        },
        fields: 'id, name, size, webViewLink, createdTime',
        supportsAllDrives: true,
      });

      this.logger.log(`PDF uploaded: "${name}" (${response.data.id})`);
      return response.data;
    } catch (error) {
      this.handleError(error, `uploadPdf("${fileName}")`);
    }
  }

  // ─── Storage ───────────────────────────────────────────────────────────────

  async getStorageMetrics(): Promise<{ limit: number; usage: number; available: number } | null> {
    try {
      const res = await this.drive.about.get({ fields: 'storageQuota' });
      const quota = res.data.storageQuota ?? {};
      const limit = Number(quota.limit ?? 0);
      const usage = Number(quota.usage ?? 0);
      return { limit, usage, available: limit - usage };
    } catch {
      // Las Service Accounts no tienen cuota propia en Google Drive.
      // Se omite la validación y se permite continuar con la subida.
      this.logger.warn(
        'No se pudo obtener la cuota de almacenamiento (Service Account sin cuota propia). Se omite la validación.',
      );
      return null;
    }
  }

  // ─── Upload / Create Google Sheet ─────────────────────────────────────────

  async uploadSheet(
    fileName: string,
    csvBuffer: Buffer,
    parentId?: string,
  ): Promise<drive_v3.Schema$File> {
    try {
      const MIN_REQUIRED_BYTES = 100 * 1024 * 1024; // 100 MB
      const metrics = await this.getStorageMetrics();
      if (metrics !== null && metrics.available < MIN_REQUIRED_BYTES) {
        const availableMB = (metrics.available / 1024 / 1024).toFixed(1);
        throw new InternalServerErrorException(
          `Espacio insuficiente en Google Drive: solo quedan ${availableMB} MB disponibles (mínimo requerido: 100 MB).`,
        );
      }

      const parent = this.resolveParentId(parentId);

      // Upload CSV and convert to Google Sheets format automatically
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          ...(parent && { parents: [parent] }),
        },
        media: {
          mimeType: 'text/csv',
          body: Readable.from(csvBuffer),
        },
        fields: 'id, name, webViewLink, createdTime',
        supportsAllDrives: true,
      });

      this.logger.log(`Sheet uploaded: "${fileName}" (${response.data.id})`);
      return response.data;
    } catch (error) {
      this.handleError(error, `uploadSheet("${fileName}")`);
    }
  }

  async createEmptySheet(
    fileName: string,
    parentId?: string,
  ): Promise<drive_v3.Schema$File> {
    try {
      const parent = this.resolveParentId(parentId);

      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          ...(parent && { parents: [parent] }),
        },
        fields: 'id, name, webViewLink, createdTime',
        supportsAllDrives: true,
      });

      this.logger.log(`Empty sheet created: "${fileName}" (${response.data.id})`);
      return response.data;
    } catch (error) {
      this.handleError(error, `createEmptySheet("${fileName}")`);
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({ fileId });
      this.logger.log(`File deleted: ${fileId}`);
    } catch (error) {
      this.handleError(error, `deleteFile("${fileId}")`);
    }
  }

  // ─── Error handler ─────────────────────────────────────────────────────────

  private handleError(error: unknown, context: string): never {
    const err = error as { message?: string; code?: number; errors?: { message: string }[] };
    const message =
      err?.errors?.[0]?.message ?? err?.message ?? 'Error al comunicarse con Google Drive';

    this.logger.error(`[GoogleDrive] ${context} - ${message}`);
    throw new InternalServerErrorException({ message, context });
  }
}
