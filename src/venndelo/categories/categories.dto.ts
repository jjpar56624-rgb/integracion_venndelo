import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetCategoriesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Buscar por nombre de categoría' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'ID de categoría padre' })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class CreateCategoryDto {
  @ApiProperty({ description: 'Nombre de la categoría' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Descripción de la categoría' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ID de categoría padre (subcategoría)' })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Nombre de la categoría' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Descripción de la categoría' })
  @IsOptional()
  @IsString()
  description?: string;
}
