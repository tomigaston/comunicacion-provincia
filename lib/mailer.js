import nodemailer from 'nodemailer';
import { PD_MIN_AMARILLO, PD_MIN_VERDE, PD_DIAS_VENTANA } from './semaforo';

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

const TOTAL_TIPOS_MEDIO = 7;

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
 * real. Solo en el mail general (el mail propio de PD ya no lista vencimientos). */
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

/** Contenido (sin título de página) del bloque de vencimientos de Pauta
 * Digital del mail general. */
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

/** Una localidad del desglose de cobertura MT: qué tipos le faltan. */
function filaFaltanteMT(l) {
  const falta = l.faltantes.length ? escaparHtml(l.faltantes.join(', ')) : 'sin otros tipos pendientes';
  return `
    <li style="margin-bottom: 6px;">
      <strong>${escaparHtml(l.localidad)}</strong>
      <span style="color:#888;">(${escaparHtml(l.banda)} — ${l.tipos} de ${TOTAL_TIPOS_MEDIO} tipos con tema activo)</span>
      <br><span style="color:#888; font-size:13px;">Falta: ${falta}</span>
    </li>`;
}

/** Cobertura MT (D5): nota provincial arriba (tipos sin pauta activa en toda la
 * provincia), lista principal Sin + Baja con el desglose por tipo que varía, y
 * debajo, claramente aparte, las de cobertura Media "para completar". */
function contenidoCoberturaMT(cobertura) {
  const { notaProvincial, principales, paraCompletar, resumen } = cobertura;
  const nota = notaProvincial.length
    ? `<p style="color:#444; font-size:14px;"><strong>Nota provincial:</strong> ${escaparHtml(
        notaProvincial
          .map((t) => `${t.label}: sin pauta activa en la provincia`)
          .join('; ')
      )}. No se repiten en el detalle por localidad.</p>`
    : '';
  const principal = principales.length
    ? `
    <p style="color:#444; font-size:14px;">${principales.length} de ${resumen.total} localidades con cobertura baja o sin cobertura
      (${resumen.sinCobertura} sin cobertura, ${resumen.baja} baja):</p>
    <ul style="margin:0; padding-left: 18px; font-size: 14px; color:#333;">${principales.map(filaFaltanteMT).join('')}</ul>`
    : `<p style="color:#444; font-size:14px;">Ninguna localidad con cobertura baja o sin cobertura en Medios Tradicionales.</p>`;
  const secundario = paraCompletar.length
    ? `
    <h4 style="color:#555; font-size:14px; margin: 22px 0 6px;">Para completar — cobertura media (${paraCompletar.length} localidades)</h4>
    <ul style="margin:0; padding-left: 18px; font-size: 14px; color:#333;">${paraCompletar.map(filaFaltanteMT).join('')}</ul>`
    : '';
  return nota + principal + secundario;
}

/** "2026-11-06" -> "06/11". */
function diaMes(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

const plural = (n, uno, varios) => `${n.toLocaleString('es-AR')} ${n === 1 ? uno : varios}`;

const RANGO_COLOR_PD = {
  '🔴': `0 a ${PD_MIN_AMARILLO - 1} activas`,
  '🟡': `${PD_MIN_AMARILLO} a ${PD_MIN_VERDE - 1} activas`,
  '🟢': `${PD_MIN_VERDE} o más activas`,
};

/** Bloque de aviso (Atención / Cubierto por programadas): un renglón por fecha
 * de FIN y, abajo, la lista compacta de localidades "activas hoy -> proyectadas
 * (con Programadas) y su color". `bloque` = armarBloqueAvisoPD(). */
function contenidoBloqueAvisoPD(bloque) {
  const fechas = bloque.fechas
    .map(
      (f) => `
      <li style="margin-bottom: 6px;"><strong>${diaMes(f.fecha)}:</strong> vencen ${plural(f.piezas, 'pieza', 'piezas')} de
        ${plural(f.campanas.length, 'campaña', 'campañas')}: ${escaparHtml(f.campanas.join(', '))}</li>`
    )
    .join('');
  const localidades = bloque.localidades
    .map((l) => `${escaparHtml(l.localidad)} ${l.activas} → ${l.proyectadas} ${l.colorProyectado}`)
    .join(' · ');
  return `
    <ul style="margin:0; padding-left: 18px; font-size: 14px; color:#333;">${fechas}</ul>
    <p style="color:#888; font-size:13px; margin: 10px 0 4px;">Localidades (activas hoy → activas al cierre de la ventana, con Programadas):</p>
    <p style="color:#333; font-size:13px; margin: 0;">${localidades}</p>`;
}

/** Bloque de PD del mail general (28/10/2026): distribución por color y
 * localidades con aviso de atención, mismo cálculo que el mail de PD
 * (calcularCoberturaPD). No lista vencimientos. */
function contenidoResumenCoberturaPD(c) {
  const { porColor, total } = c.resumen;
  const atencion = c.atencion.total
    ? `<strong>⚠️ ${plural(c.atencion.total, 'localidad baja', 'localidades bajan')} de color</strong> en los próximos ${PD_DIAS_VENTANA} días si no se renueva lo que vence.`
    : `Ninguna localidad baja de color en los próximos ${PD_DIAS_VENTANA} días.`;
  return `
    <p style="color:#444; font-size:14px;">Piezas activas por localidad (dirigidas y provinciales):
      <strong>${porColor['🔴']} 🔴</strong> ${RANGO_COLOR_PD['🔴']} · <strong>${porColor['🟡']} 🟡</strong> ${RANGO_COLOR_PD['🟡']} ·
      <strong>${porColor['🟢']} 🟢</strong> ${RANGO_COLOR_PD['🟢']}, de ${total} localidades.</p>
    <p style="color:#444; font-size:14px;">${atencion}</p>`;
}

/** Mail de PD (28/10/2026): nivel de cobertura por localidad (color + N
 * activas), avisos de la ventana de 7 días y Programadas con inicio vencido.
 * Tono neutral: describe el estado, no reprocha. */
function contenidoCoberturaPD(c) {
  const { porColor, total } = c.resumen;
  const resumen = `
    <p style="color:#444; font-size:14px;">Piezas de pauta digital activas por localidad al ${formatearFechaLarga(c.hoyIso)}
      (dirigidas y provinciales; ${RANGO_COLOR_PD['🔴']} 🔴 · ${RANGO_COLOR_PD['🟡']} 🟡 · ${RANGO_COLOR_PD['🟢']} 🟢):
      <strong>${porColor['🔴']} 🔴 · ${porColor['🟡']} 🟡 · ${porColor['🟢']} 🟢</strong> de ${total} localidades.</p>`;

  const atencion = c.atencion.total
    ? `
    <p style="color:#444; font-size:14px;">${plural(c.atencion.total, 'localidad baja', 'localidades bajan')} de color
      si no se renueva lo que vence entre ${formatearFechaLarga(c.hoyIso)} y ${formatearFechaLarga(c.ventanaHasta)},
      aun contando las Programadas que arrancan en esos días.</p>
    ${contenidoBloqueAvisoPD(c.atencion)}`
    : `<p style="color:#444; font-size:14px;">Ninguna localidad baja de color en los próximos ${PD_DIAS_VENTANA} días.</p>`;

  const cubiertas = c.cubiertas.total
    ? `
    <h3 style="color:#111; font-size:15px; margin: 24px 0 8px;">ℹ️ Cubiertas por Programadas</h3>
    <p style="color:#444; font-size:14px;">${plural(c.cubiertas.total, 'localidad bajaría', 'localidades bajarían')} de color
      por lo que vence en la ventana, pero las Programadas que arrancan en esos días la${c.cubiertas.total === 1 ? '' : 's'} sostienen.</p>
    ${contenidoBloqueAvisoPD(c.cubiertas)}`
    : '';

  const inicioVencido = c.programadasInicioVencido.length
    ? `
    <p style="color:#444; font-size:14px;">Piezas con ESTADO Programado cuyo INICIO es anterior a la carga del
      ${diaMes(c.generadoEl)}. No cuentan como activas; conviene revisar el ESTADO en la planilla:</p>
    <ul style="margin:0; padding-left: 18px; font-size: 14px; color:#333;">${c.programadasInicioVencido
      .map(
        (g) => `
      <li style="margin-bottom: 6px;">"${escaparHtml(g.campana)}"${g.titulo ? ` — ${escaparHtml(g.titulo)}` : ''}
        <span style="color:#888;">(INICIO ${diaMes(g.inicio)} · ${plural(g.piezas, 'pieza', 'piezas')} en ${plural(g.localidades, 'localidad', 'localidades')})</span></li>`
      )
      .join('')}</ul>`
    : `<p style="color:#444; font-size:14px;">Ninguna en esta carga.</p>`;

  const nivel = ['🔴', '🟡', '🟢']
    .map((color) => {
      const locs = c.localidades.filter((l) => l.color === color);
      if (locs.length === 0) return '';
      return `
    <p style="color:#333; font-size:14px; margin: 10px 0 4px;"><strong>${color} ${RANGO_COLOR_PD[color]}</strong> — ${plural(locs.length, 'localidad', 'localidades')}</p>
    <p style="color:#555; font-size:13px; margin: 0;">${escaparHtml(locs.map((l) => `${l.localidad} (${l.activas})`).join(', '))}</p>`;
    })
    .join('');

  return `${resumen}
    <h3 style="color:#111; font-size:15px; margin: 24px 0 8px;">⚠️ Atención — próximos ${PD_DIAS_VENTANA} días</h3>
    ${atencion}
    ${cubiertas}
    <h3 style="color:#111; font-size:15px; margin: 24px 0 8px;">Programadas con inicio vencido</h3>
    ${inicioVencido}
    <h3 style="color:#111; font-size:15px; margin: 24px 0 8px;">Nivel de cobertura por localidad</h3>
    <p style="color:#888; font-size:13px; margin: 0;">Entre paréntesis, las piezas activas.</p>
    ${nivel}`;
}

/** Global (caso severo): sin MT activo y sin piezas de PD activas. Se muestra siempre,
 * también cuando está vacío -- que no haya ninguna es la señal de que anda. */
function contenidoSinCobertura(sinCobertura) {
  const { localidades, total } = sinCobertura;
  if (localidades.length === 0) {
    return `<p style="color:#444; font-size:14px;">🟢 Ninguna de las ${total} localidades está sin cobertura (todas tienen Medios Tradicionales activos o Pauta Digital activa).</p>`;
  }
  const lista = escaparHtml(localidades.map((l) => l.localidad).join(', '));
  return `
    <p style="color:#b00020; font-size:14px;"><strong>🔴 ${localidades.length} de ${total} localidades sin cobertura</strong>
      (ni Medios Tradicionales activos ni Pauta Digital activa):</p>
    <p style="color:#333; font-size:14px;">${lista}</p>`;
}

/** Mail general (Medios Tradicionales + Pauta Digital juntos, sección 4 del
 * pedido): dos bloques con headers bien diferenciados para que no se lean
 * como el mismo tipo de alerta -- MT por antigüedad, PD por cobertura
 * (28/10/2026). `coberturaPD` = calcularCoberturaPD(). */
export function armarHtmlVencimientos(datosMT, coberturaPD, sinCobertura) {
  const bloqueSinCobertura = sinCobertura
    ? `
    <div style="margin-bottom: 24px;">
      <h3 style="color:#111; font-size:15px; margin-bottom:8px;">Localidades sin cobertura</h3>
      ${contenidoSinCobertura(sinCobertura)}
    </div>`
    : '';
  const contenido = `${bloqueSinCobertura}
    <div style="margin-bottom: 24px;">
      <h3 style="color:#111; font-size:15px; margin-bottom:8px;">Medios Tradicionales — sin actualización</h3>
      ${contenidoMediosTradicionales(datosMT)}
    </div>
    <div>
      <h3 style="color:#111; font-size:15px; margin-bottom:8px;">Pauta Digital — cobertura por localidad</h3>
      ${contenidoResumenCoberturaPD(coberturaPD)}
    </div>`;
  return envolverHtml('Vencimientos de pauta — próximos 7 días', contenido);
}

/** Mail propio de Medios Tradicionales (solo antigüedad). */
export function armarHtmlVencimientosMediosTradicionales(datosMT, coberturaMT) {
  const bloqueCobertura = coberturaMT
    ? `
    <div style="margin-top: 24px;">
      <h3 style="color:#111; font-size:15px; margin-bottom:8px;">Cobertura — localidades a las que les falta Medios Tradicionales</h3>
      ${contenidoCoberturaMT(coberturaMT)}
    </div>`
    : '';
  return envolverHtml(
    'Medios Tradicionales — sin actualización reciente',
    contenidoMediosTradicionales(datosMT) + bloqueCobertura
  );
}

/** Mail propio de Pauta Digital (28/10/2026): cobertura por localidad y avisos,
 * sin lista de vencimientos. */
export function armarHtmlCoberturaPautaDigital(coberturaPD) {
  return envolverHtml('Pauta Digital — cobertura por localidad', contenidoCoberturaPD(coberturaPD));
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
export async function enviarEmailVencimientos(datosMT, coberturaPD, fechaLunesIso, sinCobertura) {
  const destinatarios = destinatariosDesdeEnv('EMAIL_TO');
  if (destinatarios.length === 0) {
    throw new Error('EMAIL_TO no está configurado (env var vacía o ausente).');
  }
  const [y, m, d] = fechaLunesIso.split('-');
  await enviarA(
    destinatarios,
    `Vencimientos de pauta — semana del ${d}/${m}/${y}`,
    armarHtmlVencimientos(datosMT, coberturaPD, sinCobertura)
  );
}

/**
 * Envía el reporte semanal de Medios Tradicionales (antigüedad, agrupado por
 * Tema) a EMAIL_TO_MEDIOS_TRADICIONALES. Si esa env var todavía no está
 * cargada, NO rompe el cron -- loguea un console.warn y no manda nada.
 */
export async function enviarEmailVencimientosMediosTradicionales(datosMT, fechaLunesIso, coberturaMT) {
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
    `Actualización de pauta — Medios Tradicionales — semana del ${d}/${m}/${y}`,
    armarHtmlVencimientosMediosTradicionales(datosMT, coberturaMT)
  );
}

/**
 * Envía el reporte semanal de Pauta Digital (cobertura por localidad y avisos,
 * 28/10/2026) a EMAIL_TO_PAUTA_DIGITAL. Si esa env var todavía no está
 * cargada, NO rompe el cron -- loguea un console.warn y no manda nada.
 */
export async function enviarEmailCoberturaPautaDigital(coberturaPD, fechaLunesIso) {
  const destinatarios = destinatariosDesdeEnv('EMAIL_TO_PAUTA_DIGITAL');
  if (destinatarios.length === 0) {
    console.warn(
      'Reporte semanal: EMAIL_TO_PAUTA_DIGITAL no está configurado -- se salteó el mail de Pauta Digital.'
    );
    return;
  }
  const [y, m, d] = fechaLunesIso.split('-');
  await enviarA(
    destinatarios,
    `Cobertura de pauta — Pauta Digital — semana del ${d}/${m}/${y}`,
    armarHtmlCoberturaPautaDigital(coberturaPD)
  );
}
