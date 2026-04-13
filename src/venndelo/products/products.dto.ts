import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetProductsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por ID de categoría' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Buscar por nombre' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateProductDto {
  @ApiProperty({ description: 'Nombre del producto' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Descripción del producto' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Precio del producto', minimum: 0 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;

  @ApiProperty({ description: 'Stock disponible', minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stock: number;

  @ApiPropertyOptional({ description: 'ID de categoría' })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ description: 'Nombre del producto' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Descripción del producto' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Precio del producto', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({ description: 'Stock disponible', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stock?: number;

  @ApiPropertyOptional({ description: 'ID de categoría' })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
