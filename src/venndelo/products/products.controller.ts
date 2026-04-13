import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateProductDto, GetProductsDto, UpdateProductDto } from './products.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar productos de Venndelo' })
  getAll(@Query() query: GetProductsDto) {
    return this.productsService.getAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un producto por ID' })
  @ApiParam({ name: 'id', description: 'ID del producto en Venndelo' })
  getById(@Param('id') id: string) {
    return this.productsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un producto en Venndelo' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un producto en Venndelo' })
  @ApiParam({ name: 'id', description: 'ID del producto en Venndelo' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un producto de Venndelo' })
  @ApiParam({ name: 'id', description: 'ID del producto en Venndelo' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
