import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';

@ApiTags('Mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar email de prueba',
    description: 'Envía un correo de reporte ficticio a la dirección configurada en MAIL_TO para verificar la integración.',
  })
  async sendTest() {
    await this.mailService.sendTestEmail();
    return { message: 'Email de prueba enviado correctamente' };
  }
}
