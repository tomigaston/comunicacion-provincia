// Solo formateo/orden de fechas ya calculadas por scripts/generar_datos.py.
// El cálculo de Vigente/Finalizada NO se toca ni se duplica acá — vive en
// estado_por_fecha() del script y llega ya resuelto en el campo "estado".

/** "2026-01-05" -> "05/01/2026". Manipulación de string a propósito: parsear
 * con `new Date(iso)` corre el riesgo de mostrar el día anterior según la
 * zona horaria del navegador (medianoche UTC). */
export function formatearFechaCorta(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** "2026-01-05" -> "05/01", sin año -- para texto secundario chico (ej. rango
 * Fecha_Desde-Fecha_Hasta de una campaña vigente). Mismo motivo que
 * formatearFechaCorta para manipular el string en vez de parsear con Date. */
export function formatearFechaDiaMes(iso) {
  if (!iso) return null;
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** Arma "12/08 – 07/09" a partir de (fecha_desde, fecha_hasta), ambas ISO o
 * null. Ninguna de las dos es obligatoria (muchas filas todavía no las
 * tienen cargadas): si falta una sola, muestra solo la que hay ("Desde
 * 12/08" / "Hasta 07/09"); si faltan las dos, devuelve null -- el caller no
 * debe mostrar ningún placeholder en ese caso. */
export function rangoFechaDesdeHasta(fechaDesde, fechaHasta) {
  const desde = formatearFechaDiaMes(fechaDesde);
  const hasta = formatearFechaDiaMes(fechaHasta);
  if (desde && hasta) return `${desde} – ${hasta}`;
  if (desde) return `Desde ${desde}`;
  if (hasta) return `Hasta ${hasta}`;
  return null;
}

export function anioDe(iso) {
  if (!iso) return null;
  const anio = Number(iso.slice(0, 4));
  return Number.isNaN(anio) ? null : anio;
}

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** "Hoy" en fecha LOCAL (no UTC) como "YYYY-MM-DD", para comparar contra
 * fechas del dataset con simple comparación de strings. */
function isoHoy() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${pad2(hoy.getMonth() + 1)}-${pad2(hoy.getDate())}`;
}

/** iso menos `dias` días, calculado con el constructor de 3 argumentos
 * (fecha LOCAL) a propósito: `new Date(isoString)` interpreta el string
 * como medianoche UTC y puede correr el día según la zona horaria. */
function restarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  fecha.setDate(fecha.getDate() - dias);
  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}-${pad2(fecha.getDate())}`;
}

/**
 * Convierte un `periodo` (elegido en FiltroPeriodo) en una ventana {desde,
 * hasta} de fechas ISO, o null si es "todo" (sin límite). La comparación
 * final se hace con simple `>=`/`<=` de strings ISO, que ordenan igual que
 * las fechas reales.
 */
export function calcularVentana(periodo) {
  if (!periodo) return null;
  const hoy = isoHoy();

  if (periodo.tipo === 'preset') {
    if (periodo.valor === 'ultimas_2_semanas') return { desde: restarDias(hoy, 14), hasta: hoy };
    if (periodo.valor === 'ultimo_mes') return { desde: restarDias(hoy, 30), hasta: hoy };
    if (periodo.valor === 'ultimos_3_meses') return { desde: restarDias(hoy, 90), hasta: hoy };
    return null; // 'todo'
  }
  if (periodo.tipo === 'mes') {
    return { desde: `${periodo.valor}-01`, hasta: `${periodo.valor}-31` };
  }
  if (periodo.tipo === 'rango' && periodo.valor.desde && periodo.valor.hasta) {
    return { desde: periodo.valor.desde, hasta: periodo.valor.hasta };
  }
  return null;
}

/**
 * ¿La fecha `iso` cae dentro de la ventana? Si no hay ventana (periodo
 * "todo"), siempre true. Si hay ventana pero `iso` es null/vacío, false: un
 * dato sin fecha no se puede afirmar que esté dentro de ningún período. En
 * Medios tradicionales las filas sin Fecha_Desde ni Fecha_Hasta se descartan
 * en el pipeline (scripts/generar_datos.py), así que acá no llegan.
 */
export function fechaDentroDeVentana(iso, ventana) {
  if (!ventana) return true;
  if (!iso) return false;
  return iso >= ventana.desde && iso <= ventana.hasta;
}

/**
 * Igual que fechaDentroDeVentana, pero para un dato que tiene un rango propio
 * [inicioIso, finIso] en vez de una sola fecha puntual — caso de las piezas
 * de Pauta digital de la fuente nueva (Pauta RRSS_GLOBAL), que tienen INICIO
 * y FIN reales y pueden seguir vigentes con `finIso` en el futuro. Todos los
 * presets de período (calcularVentana) miran para atrás desde "hoy"
 * ({desde: hoy-N, hasta: hoy}); con fechaDentroDeVentana (que solo mira
 * `finIso`) una pieza vigente con fin futuro queda afuera de cualquier
 * preset por defecto, aunque esté activa ahora mismo. Acá en cambio se
 * muestra si el rango [inicioIso, finIso] SE SOLAPA con la ventana, no solo
 * si finIso cae adentro.
 *
 * Si `inicioIso` no está disponible (piezas del histórico, que nunca tuvo
 * fecha de inicio propia) el rango colapsa a un punto (`inicioIso = finIso`)
 * y el resultado es idéntico al de fechaDentroDeVentana — mismo
 * comportamiento de siempre para todo lo que no sea la fuente nueva.
 */
export function rangoDentroDeVentana(inicioIso, finIso, ventana) {
  if (!ventana) return true;
  if (!finIso) return false;
  const desde = inicioIso || finIso;
  return desde <= ventana.hasta && finIso >= ventana.desde;
}

/** Meses calendario distintos presentes en una lista de fechas ISO (para el
 * dropdown "mes puntual"), generado a partir de los datos reales — nunca
 * hardcodeado. Orden descendente (más reciente primero). */
export function mesesDisponibles(fechasIso) {
  const claves = new Set();
  for (const f of fechasIso) {
    if (f) claves.add(f.slice(0, 7));
  }
  return Array.from(claves)
    .sort()
    .reverse()
    .map((clave) => {
      const [anio, mes] = clave.split('-').map(Number);
      const nombre = MESES_ES[mes - 1];
      return { value: clave, label: `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}` };
    });
}
