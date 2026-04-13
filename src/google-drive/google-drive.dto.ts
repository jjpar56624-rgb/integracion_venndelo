import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ description: 'Nombre de la carpeta', example: '2026-04-07' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'ID de la carpeta padre en Google Drive. Si se omite, se usa la carpeta raíz configurada en el servidor.',
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class CreateEmptySheetDto {
  @ApiProperty({ description: 'Nombre del archivo Google Sheets', example: 'Órdenes 2026-04-07' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'ID de la carpeta padre en Google Drive. Si se omite, se usa la carpeta raíz configurada en el servidor.',
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class ListFilesDto {
  @ApiPropertyOptional({
    description: 'ID de la carpeta a listar. Si se omite, se usa la carpeta raíz configurada en el servidor.',
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}
