import nodemailer from 'nodemailer';

/** "2026-09-04" -> "Jueves 04/09". */
const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function formatearFechaLarga(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const dia = DIAS_ES[fecha.getDay()];
  return `${dia} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function escaparHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/** Arma el HTML del reporte semanal (spec sección 1.4): agrupado por
 * localidad/departamento, un bloque por zona, cada vencimiento con fecha,
 * tipo/plataforma, título entre comillas y área de origen. */
export function armarHtmlVencimientos(vencimientos) {
  const { total, zonas } = vencimientos;

  if (total === 0) {
    return `
      <div style="font-family: -apple-system, Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color:#111;">Vencimientos de pauta — próximos 7 días</h2>
        <p style="color:#444; font-size:15px;">Sin vencimientos esta semana en Medios Tradicionales ni Pauta Digital.</p>
        <p style="color:#999; font-size:12.5px; margin-top: 24px;">Reporte automático — Tablero de Comunicación, Gobierno de Córdoba.</p>
      </div>`;
  }

  const bloques = zonas.map((z) => {
    const filas = z.items.map((it) => `
      <li style="margin-bottom: 6px;">
        <strong>${formatearFechaLarga(it.fecha_vencimiento)}</strong>
        — ${escaparHtml(it.tipo || it.area)} —
        "${escaparHtml(it.titulo || 'Sin título')}"
        <span style="color:#888;">(${escaparHtml(it.area)})</span>
      </li>`).join('');
    return `
      <div style="margin-bottom: 18px;">
        <div style="font-weight:700; font-size:15px; color:#111; text-transform: uppercase; margin-bottom: 6px;">
          ${escaparHtml(z.zona)}
        </div>
        <ul style="margin:0; padding-left: 18px; font-size: 14px; color:#333;">${filas}</ul>
      </div>`;
  }).join('');

  return `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color:#111;">Vencimientos de pauta — próximos 7 días</h2>
      <p style="color:#444; font-size:14px;">${total} vencimiento${total === 1 ? '' : 's'} entre ${formatearFechaLarga(vencimientos.hoyIso)} y ${formatearFechaLarga(vencimientos.ventanaHasta)}.</p>
      ${bloques}
      <p style="color:#999; font-size:12.5px; margin-top: 24px;">Reporte automático — Tablero de Comunicación, Gobierno de Córdoba.</p>
    </div>`;
}

function crearTransporte() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
}

/** Envía el reporte semanal a EMAIL_TO (uno o más destinatarios separados por
 * coma). fechaLunesIso ("YYYY-MM-DD") va en el asunto. */
export async function enviarEmailVencimientos(vencimientos, fechaLunesIso) {
  const destinatarios = (process.env.EMAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (destinatarios.length === 0) {
    throw new Error('EMAIL_TO no está configurado (env var vacía o ausente).');
  }
  const transporte = crearTransporte();
  const [y, m, d] = fechaLunesIso.split('-');
  await transporte.sendMail({
    from: process.env.EMAIL_USER,
    to: destinatarios.join(','),
    subject: `Vencimientos de pauta — semana del ${d}/${m}/${y}`,
    html: armarHtmlVencimientos(vencimientos),
  });
}
