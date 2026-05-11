import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  buildHtml,
  buildSubject,
  ProcessReport,
  StepReport,
} from './templates/shipment-report.template';
import {
  buildDescargaHtml,
  buildDescargaSubject,
  DescargaPedidosReport,
} from './templates/descarga-pedidos-report.template';

export { ProcessReport, StepReport, DescargaPedidosReport };

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private readonly mailFrom: string;
  private readonly mailTo: string;
  private readonly appPassword: string;

  constructor(private readonly configService: ConfigService) {
    this.mailFrom    = configService.getOrThrow<string>('MAIL_FROM');
    this.mailTo      = configService.getOrThrow<string>('MAIL_TO');
    this.appPassword = configService.getOrThrow<string>('MAIL_APP_PASSWORD');
  }

  // ── Transporter reutilizable ───────────────────────────────────────────────

  private createTransporter() {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.mailFrom,
        pass: this.appPassword,
      },
    });
  }

  // ── Envía el reporte de un proceso ────────────────────────────────────────

  async sendShipmentReport(report: ProcessReport): Promise<void> {
    try {
      await this.createTransporter().sendMail({
        from: `"Venndelo Backend" <${this.mailFrom}>`,
        to: this.mailTo,
        subject: buildSubject(report),
        html: buildHtml(report),
      });
      this.logger.log(`[Mail] Reporte enviado a ${this.mailTo} — ${buildSubject(report)}`);
    } catch (err) {
      this.logger.error(`[Mail] Error enviando reporte: ${(err as Error).message}`);
      // No re-lanzamos — el fallo de email no debe abortar el proceso principal
    }
  }

  // ── Envía el reporte de descarga de pedidos ──────────────────────────────

  async sendDescargaPedidosReport(report: DescargaPedidosReport): Promise<void> {
    try {
      await this.createTransporter().sendMail({
        from: `"Venndelo Backend" <${this.mailFrom}>`,
        to: this.mailTo,
        subject: buildDescargaSubject(report),
        html: buildDescargaHtml(report),
      });
      this.logger.log(`[Mail] Reporte descarga pedidos enviado a ${this.mailTo}`);
    } catch (err) {
      this.logger.error(`[Mail] Error enviando reporte descarga: ${(err as Error).message}`);
    }
  }

  // ── Email de prueba con datos ficticios ───────────────────────────────────

  async sendTestEmail(to?: string): Promise<void> {
    const fakeDate = new Date();

    const report: ProcessReport = {
      store: 'Venndelo Bogotá',
      date: fakeDate,
      overallSuccess: true,
      ordersProcessed: 8,
      sheetLink: 'https://docs.google.com/spreadsheets/d/EJEMPLO',
      steps: [
        { number: '1',  label: 'Órdenes obtenidas',   status: 'success', detail: '8 órdenes en PENDING' },
        { number: '2',  label: 'Envíos creados',       status: 'success', detail: 'OK' },
        { number: '3',  label: 'Etiquetas generadas',  status: 'success', detail: 'URL obtenida (intento 2/30)' },
        { number: '3b', label: 'Tracking numbers',     status: 'success', detail: '8/8 obtenidos' },
        { number: '4',  label: 'CSV generado',         status: 'success', detail: '8 filas' },
        { number: '5',  label: 'Carpeta Drive',        status: 'success', detail: '"Guías 8 Mayo 2026"' },
        { number: '6',  label: 'Sheet subido a Drive', status: 'success', detail: 'VE-SB 8 Mayo 2026_9:00am' },
        { number: '7',  label: 'Pickup solicitado',    status: 'success', detail: 'OK' },
      ],
    };

    const recipient = to ?? this.mailTo;

    await this.createTransporter().sendMail({
      from: `"Venndelo Backend" <${this.mailFrom}>`,
      to: recipient,
      subject: `[PRUEBA] ${buildSubject(report)}`,
      html: buildHtml(report),
    });

    this.logger.log(`[Mail] Email de prueba enviado a ${recipient}`);
  }
}
