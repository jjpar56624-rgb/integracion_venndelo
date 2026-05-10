export interface StepReport {
  number: string;
  label: string;
  status: 'success' | 'error';
  detail: string;
}

export interface ProcessReport {
  store: string;
  date: Date;
  steps: StepReport[];
  ordersProcessed: number;
  sheetLink?: string;
  overallSuccess: boolean;
  errorMessage?: string;
}

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function buildSubject(report: ProcessReport): string {
  const d = report.date;
  return `Cargue guias-${d.getDate()} ${MESES_ES[d.getMonth()]} ${d.getFullYear()}`;
}

export function buildHtml(report: ProcessReport): string {
  const d = report.date;
  const rawHour = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = rawHour >= 12 ? 'pm' : 'am';
  const hour = rawHour % 12 || 12;
  const dateStr = `${d.getDate()} ${MESES_ES[d.getMonth()]} ${d.getFullYear()} · ${hour}:${minutes}${ampm}`;

  const headerBg = report.overallSuccess ? '#16a34a' : '#dc2626';
  const statusIcon = report.overallSuccess ? '✅' : '❌';
  const statusText = report.overallSuccess ? 'PROCESO EXITOSO' : 'PROCESO CON ERRORES';
  const statusBg = report.overallSuccess ? '#f0fdf4' : '#fef2f2';
  const statusBorder = report.overallSuccess ? '#bbf7d0' : '#fecaca';
  const statusColor = report.overallSuccess ? '#15803d' : '#b91c1c';

  const stepsHtml = report.steps.map((step) => {
    const isOk = step.status === 'success';
    const rowBg = isOk ? '#f0fdf4' : '#fef2f2';
    const borderColor = isOk ? '#22c55e' : '#ef4444';
    const icon = isOk ? '✅' : '❌';
    return `
      <tr>
        <td style="padding:4px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:${rowBg};border-left:4px solid ${borderColor};border-radius:4px;">
            <tr>
              <td style="padding:10px 14px;">
                <span style="font-size:14px;">${icon}</span>
                <span style="margin-left:8px;font-weight:bold;color:#1e293b;font-size:13px;">
                  Paso ${step.number} &mdash; ${step.label}
                </span>
                <span style="float:right;font-size:12px;color:#64748b;">${step.detail}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="height:6px;"></td></tr>`;
  }).join('');

  const summaryRows = [
    `<tr>
       <td style="padding:6px 0;font-size:13px;color:#475569;">
         📦 &nbsp;<strong>Órdenes procesadas:</strong> &nbsp;${report.ordersProcessed}
       </td>
     </tr>`,
    report.sheetLink
      ? `<tr>
           <td style="padding:6px 0;font-size:13px;color:#475569;">
             📄 &nbsp;<strong>Google Sheet:</strong> &nbsp;
             <a href="${report.sheetLink}" style="color:#2563eb;text-decoration:none;">Ver en Drive →</a>
           </td>
         </tr>`
      : '',
    report.errorMessage
      ? `<tr>
           <td style="padding:6px 0;font-size:13px;color:#b91c1c;">
             ⚠️ &nbsp;<strong>Error:</strong> &nbsp;${report.errorMessage}
           </td>
         </tr>`
      : '',
  ].join('');

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
            Sistema de despachos &mdash; ${report.store}
          </p>
          <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;font-weight:bold;">
            Cargue guias &mdash; ${d.getDate()} ${MESES_ES[d.getMonth()]} ${d.getFullYear()}
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

      <!-- Steps title -->
      <tr>
        <td style="padding:20px 32px 8px;">
          <p style="margin:0;font-size:11px;font-weight:bold;color:#94a3b8;
                    text-transform:uppercase;letter-spacing:1px;">
            Detalle de pasos
          </p>
        </td>
      </tr>

      <!-- Steps rows -->
      ${stepsHtml}

      <!-- Summary box -->
      <tr>
        <td style="padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
            <tr>
              <td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${summaryRows}
                </table>
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
