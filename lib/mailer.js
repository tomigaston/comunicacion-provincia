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

/** Header por color de antigüedad -- copy corregido para que se lea como
 * notificación de estado, no como reproche (nada de "estancada" ni tono
 * acusatorio). */
const ETIQUETA_ANTIGUEDAD = {
  '🔴': 'Sin actualización hace 50+ días',
  '🟡': 'Próximas a revisar (30-49 días)',
};

function envolverHtml(titulo, contenidoHtml) {
  return `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color:#111;">${titulo}</h2>
      ${contenidoHtml}
      <p style="color:#999; font-size:12.5px; margin-top: 24px;">Reporte automático — Tablero de Comunicación, Gobierno de Córdoba.</p>
    </div>`;
}

/** Una fila por grupo (Tema) de Medios Tradicionales -- ambos niveles de
 * alerta (🟡/🔴) con el mismo tratamiento visual, la etiqueta de cada fila
 * refleja el color propio de ese grupo. */
function filaMediosTradicionales(g) {
  const localidadesTexto = escaparHtml(g.localidades.join(', '));
  const tipoTexto = g.tipoVarios ? 'Varios tipos de medio' : escaparHtml(g.tipo_medio || 'Sin tipo');
  return `
    <li style="margin-bottom: 10px;">
      <strong>${g.color} ${escaparHtml(ETIQUETA_ANTIGUEDAD[g.color])}</strong>
      — "${escaparHtml(g.tema)}" — ${tipoTexto}
      <span style="color:#888;">(hace ${g.antiguedad_dias} día${g.antiguedad_dias === 1 ? '' : 's'})</span>
      <br><span style="color:#888; font-size:13px;">${localidadesTexto} — ${g.localidades.length} localidad${g.localidades.length === 1 ? '' : 'es'}</span>
    </li>`;
}

/** Contenido (sin título de página) del bloque de Medios Tradicionales --
 * reusado tanto en el mail general como en el mail propio del área. */
function contenidoMediosTradicionales(datosMT) {
  const { grupos, resumen } = datosMT;
  if (grupos.length === 0) {
    return `<p style="color:#444; font-size:14px;">Sin novedades de actualización esta semana en Medios Tradicionales.</p>`;
  }
  const resumenTexto =
    `${grupos.length} tema${grupos.length === 1 ? '' : 's'} sin actualización reciente ` +
    `(${resumen.rojas} 🔴, ${resumen.amarillas} 🟡) en ${resumen.localidadesAfectadas} ` +
    `localidad${resumen.localidadesAfectadas === 1 ? '' : 'es'}.`;
  const filas = grupos.map(filaMediosTradicionales).join('');
  return `
    <p style="color:#444; font-size:14px;">${resumenTexto}</p>
    <ul style="margin:0; padding-left: 18px; font-size: 14px; color:#333;">${filas}</ul>`;
}

/** Una fila por grupo (Campaña) de Pauta Digital -- criterio de vencimiento
 * real, sin cambios de lenguaje respecto a la v1. */
function filaPautaDigital(g) {
  const zonasTexto = escaparHtml(g.zonas.join(', '));
  const plataformaTexto = g.plataformaVarios ? 'Varias plataformas' : escaparHtml(g.plataforma || 'Sin plataforma');
  return `
    <li style="margin-bottom: 10px;">
      <strong>${formatearFechaLarga(g.fecha_vencimiento)}</strong>
      — "${escaparHtml(g.campana)}" — ${plataformaTexto}
      <br><span style="color:#888; font-size:13px;">${zonasTexto} — ${g.zonas.length} zona${g.zonas.length === 1 ? '' : 's'}</span>
    </li>`;
}

/** Contenido (sin título de página) del bloque de Pauta Digital -- reusado
 * tanto en el mail general como en el mail propio del área. */
function contenidoPautaDigital(datosPD) {
  const { grupos, resumen, hoyIso, ventanaHasta } = datosPD;
  if (grupos.length === 0) {
    return `<p style="color:#444; font-size:14px;">Sin vencimientos esta semana en Pauta Digital.</p>`;
  }
  const resumenTexto =
    `${resumen.totalCampanas} campaña${resumen.totalCampanas === 1 ? '' : 's'} con vencimiento entre ` +
    `${formatearFechaLarga(hoyIso)} y ${formatearFechaLarga(ventanaHasta)}, en ${resumen.zonasAfectadas} ` +
    `zona${resumen.zonasAfectadas === 1 ? '' : 's'}.`;
  const filas = grupos.map(filaPautaDigital).join('');
  return `
    <p style="color:#444; font-size:14px;">${resumenTexto}</p>
    <ul style="margin:0; padding-left: 18px; font-size: 14px; color:#333;">${filas}</ul>`;
}

/** Mail general (Medios Tradicionales + Pauta Digital juntos, sección 4 del
 * pedido): dos bloques con headers bien diferenciados para que no se lean
 * como el mismo tipo de alerta -- uno es antigüedad, el otro vencimiento
 * real. */
export function armarHtmlVencimientos(datosMT, datosPD) {
  const contenido = `
    <div style="margin-bottom: 24px;">
      <h3 style="color:#111; font-size:15px; margin-bottom:8px;">Medios Tradicionales — sin actualización</h3>
      ${contenidoMediosTradicionales(datosMT)}
    </div>
    <div>
      <h3 style="color:#111; font-size:15px; margin-bottom:8px;">Pauta Digital — vencimientos próximos</h3>
      ${contenidoPautaDigital(datosPD)}
    </div>`;
  return envolverHtml('Vencimientos de pauta — próximos 7 días', contenido);
}

/** Mail propio de Medios Tradicionales (solo antigüedad). */
export function armarHtmlVencimientosMediosTradicionales(datosMT) {
  return envolverHtml('Medios Tradicionales — sin actualización reciente', contenidoMediosTradicionales(datosMT));
}

/** Mail propio de Pauta Digital (solo vencimiento real, sin cambios de criterio). */
export function armarHtmlVencimientosPautaDigital(datosPD) {
  return envolverHtml('Pauta Digital — próximos vencimientos', contenidoPautaDigital(datosPD));
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
 * fechaLunesIso ("YYYY-MM-DD") va en el asunto. Sigue siendo obligatoria (si
 * falta EMAIL_TO, corta el cron con error, no se saltea en silencio como sí
 * hacen los mails por área). */
export async function enviarEmailVencimientos(datosMT, datosPD, fechaLunesIso) {
  const destinatarios = destinatariosDesdeEnv('EMAIL_TO');
  if (destinatarios.length === 0) {
    throw new Error('EMAIL_TO no está configurado (env var vacía o ausente).');
  }
  const [y, m, d] = fechaLunesIso.split('-');
  await enviarA(
    destinatarios,
    `Vencimientos de pauta — semana del ${d}/${m}/${y}`,
    armarHtmlVencimientos(datosMT, datosPD)
  );
}

/**
 * Envía el reporte semanal de Medios Tradicionales (antigüedad, agrupado por
 * Tema) a EMAIL_TO_MEDIOS_TRADICIONALES. Si esa env var todavía no está
 * cargada, NO rompe el cron -- loguea un console.warn y no manda nada.
 */
export async function enviarEmailVencimientosMediosTradicionales(datosMT, fechaLunesIso) {
  const destinatarios = destinatariosDesdeEnv('EMAIL_TO_MEDIOS_TRADICIONALES');
  if (destinatarios.length === 0) {
    console.warn(
      'Reporte de vencimientos: EMAIL_TO_MEDIOS_TRADICIONALES no está configurado -- se salteó el mail de Medios Tradicionales.'
    );
    return;
  }
  const [y, m, d] = fechaLunesIso.split('-');
  await enviarA(
    destinatarios,
    `Vencimientos de pauta — Medios Tradicionales — semana del ${d}/${m}/${y}`,
    armarHtmlVencimientosMediosTradicionales(datosMT)
  );
}

/**
 * Envía el reporte semanal de Pauta Digital (vencimiento real, agrupado por
 * Campaña) a EMAIL_TO_PAUTA_DIGITAL. Si esa env var todavía no está cargada,
 * NO rompe el cron -- loguea un console.warn y no manda nada.
 */
export async function enviarEmailVencimientosPautaDigital(datosPD, fechaLunesIso) {
  const destinatarios = destinatariosDesdeEnv('EMAIL_TO_PAUTA_DIGITAL');
  if (destinatarios.length === 0) {
    console.warn(
      'Reporte de vencimientos: EMAIL_TO_PAUTA_DIGITAL no está configurado -- se salteó el mail de Pauta Digital.'
    );
    return;
  }
  const [y, m, d] = fechaLunesIso.split('-');
  await enviarA(
    destinatarios,
    `Vencimientos de pauta — Pauta Digital — semana del ${d}/${m}/${y}`,
    armarHtmlVencimientosPautaDigital(datosPD)
  );
}
