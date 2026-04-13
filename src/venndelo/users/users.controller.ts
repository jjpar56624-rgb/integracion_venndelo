import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateUserDto, GetUsersDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuarios de Venndelo' })
  getAll(@Query() query: GetUsersDto) {
    return this.usersService.getAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  getById(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Obtener pedidos de un usuario' })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getOrders(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.getOrders(id, +page, +limit);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un usuario en Venndelo' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar datos de un usuario' })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desactivar un usuario' })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }
}
