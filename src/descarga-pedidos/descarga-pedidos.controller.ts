import { Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DescargaPedidosService, ResultadoDescarga } from './descarga-pedidos.service';

@ApiTags('Descarga Pedidos')
@Controller('descarga-pedidos')
export class DescargaPedidosController {
  private readonly logger = new Logger(DescargaPedidosController.name);

  constructor(private readonly descargaPedidosService: DescargaPedidosService) {}

  @Post('ejecutar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar descarga de pedidos Venndelo',
    description:
      'Descarga pedidos de Cali y Bogotá, procesa Total Items por PIN, ' +
      'sube cada archivo a su carpeta de Drive y consolida ambas tiendas en un Google Sheets único. ' +
      'El proceso puede tardar entre 2 y 5 minutos.',
  })
  @ApiResponse({ status: 200, description: 'Proceso completado (con o sin errores por tienda)' })
  async ejecutar(): Promise<ResultadoDescarga> {
    this.logger.log('POST /descarga-pedidos/ejecutar recibido');
    return this.descargaPedidosService.ejecutar();
  }
}
