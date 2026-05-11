import { ResultadoTienda } from '../../descarga-pedidos/descarga-pedidos.service';

export interface DescargaPedidosReport {
  date: Date;
  resultados: ResultadoTienda[];
  duracion: string;
}

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function buildDescargaSubject(report: DescargaPedidosReport): string {
  const d = report.date;
  const overallOk = report.resultados.every(r => r.ok);
  const prefix = overallOk ? '✅' : '⚠️';
  return `${prefix} Descarga pedidos — ${d.getDate()} ${MESES_ES[d.getMonth()]} ${d.getFullYear()}`;
}

export function buildDescargaHtml(report: DescargaPedidosReport): string {
  const d = report.date;
  const rawHour = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = rawHour >= 12 ? 'pm' : 'am';
  const hour = rawHour % 12 || 12;
  const dateStr = `${d.getDate()} ${MESES_ES[d.getMonth()]} ${d.getFullYear()} · ${hour}:${minutes}${ampm}`;

  const overallOk = report.resultados.every(r => r.ok);
  const statusIcon = overallOk ? '✅' : '⚠️';
  const statusText = overallOk ? 'PROCESO EXITOSO' : 'PROCESO CON ERRORES';
  const statusBg = overallOk ? '#f0fdf4' : '#fefce8';
  const statusBorder = overallOk ? '#bbf7d0' : '#fde68a';
  const statusColor = overallOk ? '#15803d' : '#92400e';

  const filasHtml = report.resultados.map(r => {
    const icon = r.ok ? '✅' : '❌';
    const enlaceHtml = r.enlace
      ? `<a href="${r.enlace}" style="color:#2563eb;text-decoration:none;font-size:12px;">Ver archivo →</a>`
      : `<span style="color:#b91c1c;font-size:12px;">${r.error ?? 'Error desconocido'}</span>`;

    return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 16px;font-size:13px;color:#1e293b;font-weight:bold;">${icon} ${r.tienda}</td>
        <td style="padding:10px 16px;font-size:13px;color:${r.ok ? '#15803d' : '#b91c1c'};">${r.ok ? 'OK' : 'Error'}</td>
        <td style="padding:10px 16px;">${enlaceHtml}</td>
      </tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:#1e293b;padding:26px 32px;">
          <p style="margin:0;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;">
            Sistema automatizado &mdash; Venndelo
          </p>
          <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;font-weight:bold;">
            Descarga de Pedidos
          </h1>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${dateStr}</p>
        </td>
      </tr>

      <!-- Status banner -->
      <tr>
        <td style="background:${statusBg};border-bottom:2px solid ${statusBorder};padding:14px 32px;">
          <span style="font-size:15px;font-weight:bold;color:${statusColor};">
            ${statusIcon} &nbsp;${statusText}
          </span>
        </td>
      </tr>

      <!-- Table title -->
      <tr>
        <td style="padding:20px 32px 8px;">
          <p style="margin:0;font-size:11px;font-weight:bold;color:#94a3b8;
                    text-transform:uppercase;letter-spacing:1px;">
            Resultado por tienda
          </p>
        </td>
      </tr>

      <!-- Results table -->
      <tr>
        <td style="padding:0 32px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f8fafc;">
              <th style="padding:10px 16px;font-size:11px;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Tienda</th>
              <th style="padding:10px 16px;font-size:11px;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Estado</th>
              <th style="padding:10px 16px;font-size:11px;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Detalle</th>
            </tr>
            ${filasHtml}
          </table>
        </td>
      </tr>

      <!-- Duration -->
      <tr>
        <td style="padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
            <tr>
              <td style="padding:14px 20px;font-size:13px;color:#475569;">
                ⏱️ &nbsp;<strong>Duración total:</strong> &nbsp;${report.duracion}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;border-top:1px solid #e2e8f0;
                   padding:14px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">
            Venndelo Backend &nbsp;&bull;&nbsp; Sistema automatizado de despachos
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`.trim();
}
