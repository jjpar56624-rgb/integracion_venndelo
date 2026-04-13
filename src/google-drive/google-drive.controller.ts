import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CreateEmptySheetDto, CreateFolderDto, ListFilesDto } from './google-drive.dto';
import { GoogleDriveService } from './google-drive.service';

@ApiTags('Google Drive')
@Controller('google-drive')
export class GoogleDriveController {
  constructor(private readonly googleDriveService: GoogleDriveService) {}

  // ─── Folders ───────────────────────────────────────────────────────────────

  @Post('folders')
  @ApiOperation({
    summary: 'Crear carpeta en Google Drive',
    description: 'Crea una carpeta. Si no se indica parentId, se crea en la carpeta raíz configurada.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: '2026-04-07' },
        parentId: {
          type: 'string',
          nullable: true,
          description: 'ID de la carpeta padre (opcional). Si se omite, se usa la carpeta raíz del servidor.',
        },
      },
      example: { name: '2026-04-07' },
    },
  })
  createFolder(@Body() dto: CreateFolderDto) {
    return this.googleDriveService.createFolder(dto.name, dto.parentId);
  }

  @Get('folders')
  @ApiOperation({
    summary: 'Listar carpetas',
    description: 'Lista las carpetas dentro de una carpeta padre (o la raíz si no se especifica).',
  })
  listFolders(@Query() query: ListFilesDto) {
    return this.googleDriveService.listFolders(query.parentId);
  }

  @Get('files')
  @ApiOperation({
    summary: 'Listar archivos',
    description: 'Lista los archivos dentro de una carpeta (o la raíz si no se especifica).',
  })
  listFiles(@Query() query: ListFilesDto) {
    return this.googleDriveService.listFiles(query.parentId);
  }

  // ─── Upload PDF ────────────────────────────────────────────────────────────

  @Post('upload/pdf')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Subir archivo PDF',
    description: 'Sube un PDF a Google Drive. Si no se indica parentId, se sube a la carpeta raíz.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Archivo PDF' },
        parentId: { type: 'string', description: 'ID de la carpeta destino (opcional)' },
        fileName: { type: 'string', description: 'Nombre del archivo (opcional, por defecto usa el nombre del archivo subido)' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('parentId') parentId?: string,
    @Body('fileName') fileName?: string,
  ) {
    if (!file) throw new BadRequestException('Se requiere un archivo PDF');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('El archivo debe ser un PDF');
    }
    const name = fileName ?? file.originalname;
    return this.googleDriveService.uploadPdf(name, file.buffer, parentId);
  }

  // ─── Upload / Create Sheet ─────────────────────────────────────────────────

  @Post('upload/sheet')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Subir CSV y convertir a Google Sheets',
    description: 'Sube un archivo CSV y lo convierte automáticamente a Google Sheets.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Archivo CSV' },
        parentId: { type: 'string', description: 'ID de la carpeta destino (opcional)' },
        fileName: { type: 'string', description: 'Nombre del archivo en Drive (opcional)' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadSheet(
    @UploadedFile() file: Express.Multer.File,
    @Body('parentId') parentId?: string,
    @Body('fileName') fileName?: string,
  ) {
    if (!file) throw new BadRequestException('Se requiere un archivo CSV');
    const allowedMimes = ['text/csv', 'text/plain', 'application/csv'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('El archivo debe ser un CSV');
    }
    const name = fileName ?? file.originalname.replace(/\.csv$/i, '');
    return this.googleDriveService.uploadSheet(name, file.buffer, parentId);
  }

  @Post('sheets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear Google Sheet vacío',
    description: 'Crea un archivo Google Sheets vacío en la carpeta especificada.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Órdenes 2026-04-07' },
        parentId: {
          type: 'string',
          nullable: true,
          description: 'ID de la carpeta padre (opcional). Si se omite, se usa la carpeta raíz del servidor.',
        },
      },
      example: { name: 'Órdenes 2026-04-07' },
    },
  })
  createEmptySheet(@Body() dto: CreateEmptySheetDto) {
    return this.googleDriveService.createEmptySheet(dto.name, dto.parentId);
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  @Delete('files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar archivo o carpeta',
    description: 'Elimina permanentemente un archivo o carpeta de Google Drive por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del archivo o carpeta en Google Drive' })
  deleteFile(@Param('id') id: string) {
    return this.googleDriveService.deleteFile(id);
  }
}
