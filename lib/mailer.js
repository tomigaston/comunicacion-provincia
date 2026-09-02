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
 * tipo/plataforma, título entre comillas y área de origen. `tituloArea`
 * (opcional) distingue el mail general de los mails por área -- ej. "Medios
 * Tradicionales — próximos 7 días" en vez del genérico. */
export function armarHtmlVencimientos(vencimientos, tituloArea) {
  const { total, zonas } = vencimientos;
  const titulo = tituloArea ? `Vencimientos de pauta — ${tituloArea}` : 'Vencimientos de pauta — próximos 7 días';
  const sinVencimientosTexto = tituloArea
    ? `Sin vencimientos esta semana en ${tituloArea}.`
    : 'Sin vencimientos esta semana en Medios Tradicionales ni Pauta Digital.';

  if (total === 0) {
    return `
      <div style="font-family: -apple-system, Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color:#111;">${titulo}</h2>
        <p style="color:#444; font-size:15px;">${sinVencimientosTexto}</p>
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
      <h2 style="color:#111;">${titulo}</h2>
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

function destinatariosDesdeEnv(nombreEnvVar) {
  return (process.env[nombreEnvVar] || '').split(',').map((s) => s.trim()).filter(Boolean);
}

async function enviarA(destinatarios, asunto, html) {
  const transporte = crearTransporte();
  await transporte.sendMail({
    from: process.env.EMAIL_USER,
    to: destinatarios.join(','),
    subject: asunto,
    html,
  });
}

/** Envía el reporte semanal general (Medios Tradicionales + Pauta Digital
 * juntos) a EMAIL_TO (uno o más destinatarios separados por coma).
 * fechaLunesIso ("YYYY-MM-DD") va en el asunto. Sin cambios de comportamiento
 * respecto a la v1 -- sigue siendo obligatoria (si falta EMAIL_TO, corta el
 * cron con error, no se saltea en silencio como sí hacen los mails por área). */
export async function enviarEmailVencimientos(vencimientos, fechaLunesIso) {
  const destinatarios = destinatariosDesdeEnv('EMAIL_TO');
  if (destinatarios.length === 0) {
    throw new Error('EMAIL_TO no está configurado (env var vacía o ausente).');
  }
  const [y, m, d] = fechaLunesIso.split('-');
  await enviarA(
    destinatarios,
    `Vencimientos de pauta — semana del ${d}/${m}/${y}`,
    armarHtmlVencimientos(vencimientos)
  );
}

/**
 * Envía el reporte semanal de UN área puntual (Medios Tradicionales o Pauta
 * Digital) a la env var de destinatarios que corresponda
 * (EMAIL_TO_MEDIOS_TRADICIONALES / EMAIL_TO_PAUTA_DIGITAL). Si esa env var
 * todavía no está cargada, NO rompe el cron -- loguea un console.warn y no
 * manda nada, para no bloquear el mail general por un destinatario que Tomás
 * todavía no cargó (a diferencia de enviarEmailVencimientos(), que si es
 * obligatoria).
 */
export async function enviarEmailVencimientosPorArea(vencimientosDelArea, fechaLunesIso, area, nombreEnvVar) {
  const destinatarios = destinatariosDesdeEnv(nombreEnvVar);
  if (destinatarios.length === 0) {
    console.warn(
      `Reporte de vencimientos: ${nombreEnvVar} no está configurado -- se salteó el mail de ${area}.`
    );
    return;
  }
  const [y, m, d] = fechaLunesIso.split('-');
  await enviarA(
    destinatarios,
    `Vencimientos de pauta — ${area} — semana del ${d}/${m}/${y}`,
    armarHtmlVencimientos(vencimientosDelArea, `${area} — próximos 7 días`)
  );
}
