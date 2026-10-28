// Semáforo (🟢/🟡/🔴) -- Medios Tradicionales y Pauta Digital únicamente (spec
// Alertas de vencimiento + Semáforo, 31/08/2026; rediseño 11/10/2026). Medios
// Tradicionales alerta por ANTIGÜEDAD del tema: el emoji ya viene calculado
// desde la planilla (scripts/generar_datos.py lo lee tal cual de
// Maestro_Vigente). Pauta Digital se pinta por CANTIDAD de piezas activas en
// la localidad (28/10/2026) y se calcula acá al vuelo, ver al final del
// archivo. Acá solo se interpreta para pintar y agregar.

const PESO_COLOR = { '🔴': 2, '🟡': 1, '🟢': 0 };

/** Algunas filas de origen traen el emoji seguido de texto libre (ej. "🔴 SIN
 * CAMBIOS HACE 184 DIAS") en vez del emoji solo -- se busca el emoji adonde
 * esté, no se asume que la celda es un solo carácter. */
function colorDeAlerta(alerta) {
  if (!alerta) return null;
  if (alerta.includes('🔴')) return '🔴';
  if (alerta.includes('🟡')) return '🟡';
  if (alerta.includes('🟢')) return '🟢';
  return null;
}

const ETIQUETA_COLOR = {
  '🔴': 'Sin cambios hace mucho',
  '🟡': 'A revisar',
  '🟢': 'Reciente',
};

/** Peor color entre una lista de alertas (algunas pueden ser null -- se
 * ignoran, no cuentan como verde por default). null si ninguna tiene alerta. */
export function peorAlerta(alertas) {
  let peor = null;
  for (const a of alertas) {
    const color = colorDeAlerta(a);
    if (!color) continue;
    if (peor === null || PESO_COLOR[color] > PESO_COLOR[peor]) peor = color;
  }
  return peor;
}

/** Etiqueta de una alerta de antigüedad de MT (el badge de PD tiene su texto
 * propio, components/SemaforoPDBadge.js). */
export function etiquetaAlerta(alerta) {
  const color = colorDeAlerta(alerta);
  if (!color) return null;
  return ETIQUETA_COLOR[color];
}

/** Peso de un color ya resuelto (🔴/🟡/🟢), para ordenar de peor a mejor.
 * -1 para null/sin alerta -- siempre el último en un sort descendente. */
export function pesoDeColor(color) {
  return color ? PESO_COLOR[color] : -1;
}

export { colorDeAlerta };

// --- Semáforo de Medios Tradicionales a dos ejes (Frescura + Cobertura) ---
// La frescura se calcula desde las filas de Maestro_Vigente (`vigentes`); la
// cobertura se lee del JSON (única definición: MT con Estado=Activo).
// Pauta Digital no usa esto: sigue con peorAlerta().

// Borde único de antigüedad de MT (spec 11/10/2026, confirmado por el gobernador
// el 31/08/2026 y contra el mail real del 05/10): 0-29 🟢, 30-49 🟡, 50+ 🔴. El
// umbral pertenece a la banda de arriba (>=), igual que la planilla y
// calcular_alerta() en scripts/generar_datos.py. Si cambian en Parametros,
// cambiar acá también (llevarlos a Parametros/JSON es un cambio de dato aparte).
const UMBRAL_AMARILLA_DIAS = 30;
const UMBRAL_ROJA_DIAS = 50;

const esActivo = (v) => (v.estado || '').trim().toLowerCase() === 'activo';
const conFecha = (v) => !!v.fecha_desde && typeof v.antiguedad_dias === 'number';

// null = "sin dato de frescura": ningún tema Activo con Fecha_Desde, así que no
// hay antigüedad que medir. NO es rojo (no se inventa una mala nota por falta
// de dato); peorAlerta() ignora los null, entonces el color de la localidad lo
// deciden la cobertura (y PD) cuando la frescura no es medible.
function colorFrescura(dias) {
  if (dias === null) return null;
  if (dias >= UMBRAL_ROJA_DIAS) return '🔴';
  if (dias >= UMBRAL_AMARILLA_DIAS) return '🟡';
  return '🟢';
}

// La banda ya viene calculada en el JSON (banda_cobertura, ver
// scripts/generar_datos.py): acá solo se traduce a color, no se recalcula.
const COLOR_POR_BANDA = { Alta: '🟢', Media: '🟡', Baja: '🔴', Sin: '🔴' };

/**
 * @param {{vigentes: Array, cobertura: Object, total_tipos: number, banda_cobertura: string}} medios
 *   registro de MT de una localidad (data/medios_tradicionales.json)
 * @returns {{ color, frescura: {color|null, dias|null, sinDato}, cobertura: {color, tipos, total},
 *   motivo: string[], estancados: Array }}
 * `estancados`: temas Activos con fecha y antigüedad >= 30, del más viejo al
 * más nuevo. Cartelería/Gráfica/parte de Vía Pública sin Fecha_Desde no cuentan
 * acá (ni como 0 días) -- pero sí cuentan para cobertura si están Activos
 * (la cobertura pide solo Estado=Activo; las alertas, además, Fecha_Desde).
 */
export function calcularSemaforoMedios(medios) {
  const activas = ((medios && medios.vigentes) || []).filter(esActivo);

  const conFechaActivas = activas.filter(conFecha);
  const dias = conFechaActivas.length
    ? Math.min(...conFechaActivas.map((v) => v.antiguedad_dias))
    : null;
  const colorF = colorFrescura(dias);

  const tiposActivos = medios.total_tipos;
  const totalTipos = Object.keys(medios.cobertura).length;
  const colorC = COLOR_POR_BANDA[medios.banda_cobertura] || '🔴';

  const motivo = [];
  if (colorF === null) {
    motivo.push('Sin dato de frescura: ningún tema activo con fecha de inicio');
  } else if (colorF !== '🟢') {
    motivo.push(
      `Frescura ${colorF === '🔴' ? 'baja' : 'a revisar'}: el tema activo más reciente lleva ${dias} días`
    );
  }
  if (colorC !== '🟢') {
    motivo.push(
      `Cobertura ${colorC === '🔴' ? 'baja' : 'media'}: ${tiposActivos} de ${totalTipos} tipos de medio con tema activo`
    );
  }

  const estancados = conFechaActivas
    .filter((v) => v.antiguedad_dias >= UMBRAL_AMARILLA_DIAS)
    .sort((a, b) => b.antiguedad_dias - a.antiguedad_dias);

  return {
    color: peorAlerta([colorF, colorC]),
    frescura: { color: colorF, dias, sinDato: colorF === null },
    cobertura: { color: colorC, tipos: tiposActivos, total: totalTipos },
    motivo,
    estancados,
  };
}

// --- Pauta Digital: predicados de pieza ---
// Se calculan al vuelo contra la fecha de hoy, no vienen del JSON.

/** Nombre de campaña de una pieza de PD (único criterio: mail, cards y cobertura). */
export function nombreCampana(p) {
  return p.campana || p.titulo_pieza || 'Sin campaña';
}

/** Pieza DIRIGIDA a la zona: una localidad de las 60, un circuito de Capital o
 * "TODAS LAS LOCALIDADES" de un departamento. La provincial repartida a las 60
 * (multiple_provincia) no es dirigida. `departamento` y `sin_ambito` solo
 * existen en el histórico, que nunca tiene piezas activas. Desde el 28/10/2026
 * no decide si una pieza cuenta (cuentan todas las activas de la localidad):
 * solo separa dirigidas de provinciales en el desglose. */
export const SUB_AMBITOS_DIRIGIDOS = ['localidad_directa', 'circuito_capital', 'multiple_depto'];
export const esPiezaPDDirigida = (p) => SUB_AMBITOS_DIRIGIDOS.includes(p.sub_ambito);

/** Predicado único de pieza de PD "viva" o "activa": Estado=Vigente (ESTADO
 * crudo ACTIVO) e INICIO <= hoy <= FIN. La vigencia por fecha se evalúa contra
 * `hoyIso` en el momento de mirar, no contra el `vigente_por_fecha` congelado
 * al generar el JSON: ese campo queda viejo apenas pasa un día (una pieza con
 * FIN de ayer seguiría "viva" hasta la próxima carga). Con el dato recién
 * generado ambos dan igual. Observada, Programada, Finalizada y las piezas sin
 * INICIO/FIN no son activas. */
export function esPiezaPDViva(p, hoyIso) {
  return (
    p.estado === 'Vigente' && !!p.inicio && !!p.finalizacion && p.inicio <= hoyIso && hoyIso <= p.finalizacion
  );
}

/** Anomalía de la fuente: pieza Vigente (ESTADO=ACTIVO) cuyo FIN ya había pasado
 * al generar el dato (`generadoEl`). "Vencida sin renovar": se señala para
 * renovar o cerrar, no se resuelve en silencio. Distinta de la que venció
 * después de la carga (esa solo está desactualizada hasta la próxima). */
export function esPiezaPDVencidaSinRenovar(p, generadoEl) {
  return p.estado === 'Vigente' && !!p.finalizacion && !!generadoEl && p.finalizacion < generadoEl;
}

/** Días enteros de `hoyIso` a `finIso` (ISO YYYY-MM-DD). Negativo si ya venció. */
export function diasHastaVencer(finIso, hoyIso) {
  const [fy, fm, fd] = finIso.split('-').map(Number);
  const [hy, hm, hd] = hoyIso.split('-').map(Number);
  return Math.round((Date.UTC(fy, fm - 1, fd) - Date.UTC(hy, hm - 1, hd)) / 86400000);
}

// --- Semáforo de Pauta Digital por cantidad de piezas activas (28/10/2026) ---
// Unidad: una fila = una pieza (COD. CONTENIDO no se usa para contar ni para
// identificar). Cuentan todas las piezas activas de la localidad, dirigidas y
// provinciales (multiple_provincia). Las Programadas nunca definen el color:
// solo entran en la proyección (ii). El color general de la localidad sigue
// siendo el peor entre MT y PD (lib/useAlertas.js).

/** Límites incluidos: 0-5 🔴 · 6-10 🟡 · 11+ 🟢. */
export const PD_MIN_AMARILLO = 6;
export const PD_MIN_VERDE = 11;
/** Ventana de la proyección y de los avisos: hoy..hoy+7. */
export const PD_DIAS_VENTANA = 7;

export function colorPorCantidadPD(n) {
  if (n >= PD_MIN_VERDE) return '🟢';
  if (n >= PD_MIN_AMARILLO) return '🟡';
  return '🔴';
}

/** Pieza de PD atribuida a una localidad de las 60 (dirigida o provincial). Las
 * piezas del histórico con ámbito departamento no tienen localidad puntual. */
export const esPiezaPDDeLocalidad = (p) => !!p.en_60_localidades && p.alcance_tipo === 'localidad' && !!p.localidad;

/** Programada (ESTADO crudo PROGRAMADO) con INICIO anterior a la carga: se
 * señala para que el área la revise. No cuenta como activa. */
export function esPiezaPDProgramadaConInicioVencido(p, generadoEl) {
  return p.estado === 'Programada' && !!p.inicio && !!generadoEl && p.inicio < generadoEl;
}

/** "YYYY-MM-DD" + `dias`, en UTC (solo aritmética de fecha, sin hora local). */
function sumarDiasIso(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}-${String(f.getUTCDate()).padStart(2, '0')}`;
}

export const AVISO_PD = { ATENCION: 'atencion', CUBIERTO: 'cubierto_por_programadas' };

/**
 * Semáforo de PD de una localidad a partir de SUS piezas (ya filtradas por
 * localidad con esPiezaPDDeLocalidad).
 *  - color: por cantidad de activas hoy.
 *  - (i) `activasDespues`: activas con FIN > hoy+7 (lo que queda al aire si no
 *    se renueva nada de lo que vence en la ventana).
 *  - (ii) `conProgramadas`: (i) + Programadas con INICIO <= hoy+7 y FIN > hoy+7,
 *    sin las de inicio vencido (esas solo se listan aparte).
 *  - aviso: 'atencion' si el color de (i) y el de (ii) son peores que el
 *    actual; 'cubierto_por_programadas' si el de (i) es peor y el de (ii) no;
 *    null en cualquier otro caso (un vencimiento que no cambia el color no
 *    avisa).
 *  - informativo: días al próximo vencimiento de una activa y Programadas que
 *    arrancan en la ventana (cantidad y fecha más próxima).
 */
export function calcularSemaforoPD(piezas, hoyIso, generadoEl = null) {
  const ventanaHasta = sumarDiasIso(hoyIso, PD_DIAS_VENTANA);
  let activas = 0;
  let dirigidas = 0;
  let activasDespues = 0;
  let programadasQueCubren = 0;
  let proximoFin = null;
  let programadasVentana = 0;
  let programadaMasProxima = null;
  const vencenEnVentana = [];
  for (const p of piezas) {
    if (esPiezaPDViva(p, hoyIso)) {
      activas += 1;
      if (esPiezaPDDirigida(p)) dirigidas += 1;
      if (p.finalizacion > ventanaHasta) activasDespues += 1;
      else vencenEnVentana.push(p);
      if (proximoFin === null || p.finalizacion < proximoFin) proximoFin = p.finalizacion;
    } else if (
      p.estado === 'Programada' &&
      p.inicio &&
      p.finalizacion &&
      p.inicio <= ventanaHasta &&
      // Las de inicio vencido no cuentan en (ii) ni como "arrancan en la ventana":
      // se listan aparte (esPiezaPDProgramadaConInicioVencido).
      !esPiezaPDProgramadaConInicioVencido(p, generadoEl)
    ) {
      if (p.finalizacion > ventanaHasta) programadasQueCubren += 1;
      programadasVentana += 1;
      if (programadaMasProxima === null || p.inicio < programadaMasProxima) programadaMasProxima = p.inicio;
    }
  }
  const color = colorPorCantidadPD(activas);
  const conProgramadas = activasDespues + programadasQueCubren;
  const colorActivasDespues = colorPorCantidadPD(activasDespues);
  const colorConProgramadas = colorPorCantidadPD(conProgramadas);
  const peor = (c) => PESO_COLOR[c] > PESO_COLOR[color];
  let aviso = null;
  if (peor(colorActivasDespues)) aviso = peor(colorConProgramadas) ? AVISO_PD.ATENCION : AVISO_PD.CUBIERTO;
  return {
    color,
    activas,
    dirigidas,
    provinciales: activas - dirigidas,
    ventanaHasta,
    activasDespues,
    colorActivasDespues,
    conProgramadas,
    colorConProgramadas,
    aviso,
    vencenEnVentana,
    diasProximoVencimiento: proximoFin === null ? null : diasHastaVencer(proximoFin, hoyIso),
    proximoVencimiento: proximoFin,
    programadasVentana: { cantidad: programadasVentana, fechaMasProxima: programadaMasProxima },
  };
}

/** calcularSemaforoPD() para cada localidad con piezas. Map clave -> resultado,
 * clave = `claveDe(p.localidad)` (normalizarTexto en quien llama). Una
 * localidad sin piezas no está en el mapa: usar calcularSemaforoPD([], hoyIso). */
export function calcularSemaforoPDPorLocalidad(piezas, hoyIso, generadoEl, claveDe) {
  const porClave = new Map();
  for (const p of piezas) {
    if (!esPiezaPDDeLocalidad(p)) continue;
    const clave = claveDe(p.localidad);
    if (!porClave.has(clave)) porClave.set(clave, []);
    porClave.get(clave).push(p);
  }
  const resultado = new Map();
  for (const [clave, lista] of porClave) resultado.set(clave, calcularSemaforoPD(lista, hoyIso, generadoEl));
  return resultado;
}
