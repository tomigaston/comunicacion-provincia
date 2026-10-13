// Semáforo (🟢/🟡/🔴) -- Medios Tradicionales y Pauta Digital únicamente (spec
// Alertas de vencimiento + Semáforo, 31/08/2026; rediseño 11/10/2026). Medios
// Tradicionales alerta por ANTIGÜEDAD del tema: el emoji ya viene calculado
// desde la planilla (scripts/generar_datos.py lo lee tal cual de
// Maestro_Vigente). Pauta Digital alerta por VENCIMIENTO (proximidad a FIN) y
// se calcula acá al vuelo, ver al final del archivo. Acá solo se interpreta
// para pintar y agregar.

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

export function etiquetaAlerta(alerta) {
  const color = colorDeAlerta(alerta);
  return color ? ETIQUETA_COLOR[color] : null;
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

function colorFrescura(dias) {
  if (dias === null) return '🔴';
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
 * @returns {{ color, frescura: {color, dias}, cobertura: {color, tipos, total},
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
  if (colorF !== '🟢') {
    motivo.push(
      dias === null
        ? 'Frescura baja: sin contenido activo con fecha'
        : `Frescura ${colorF === '🔴' ? 'baja' : 'a revisar'}: el tema activo más reciente lleva ${dias} días`
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
    frescura: { color: colorF, dias },
    cobertura: { color: colorC, tipos: tiposActivos, total: totalTipos },
    motivo,
    estancados,
  };
}

// --- Semáforo de Pauta Digital por vencimiento (spec 11/10/2026, Regla 2) ---
// PD no se mide por antigüedad sino por cuánto falta para `finalizacion` (FIN).
// El color se calcula acá, al vuelo contra la fecha de hoy, no viene del JSON:
// una banda por proximidad no puede quedar congelada en la fecha de la carga.
// Mismo predicado de "viva" que usa el mail (lib/vencimientos.js), así 🔴 + 🟡
// del semáforo == lo que lista el mail en su ventana hoy..hoy+7.

export const PD_DIAS_ROJO = 3;
export const PD_DIAS_AMARILLO = 7;

/** D2 (spec 11/10/2026): solo la pieza DIRIGIDA a la zona cuenta para una
 * localidad (cobertura y color). multiple_provincia (provincial expandida a las
 * 60), departamento y sin_ambito no. Las provinciales siguen en el mail. */
export const SUB_AMBITOS_QUE_CUENTAN = ['localidad_directa', 'circuito_capital', 'multiple_depto'];
export const cuentaParaLocalidad = (p) => SUB_AMBITOS_QUE_CUENTAN.includes(p.sub_ambito);

/** Predicado único de pieza de PD "viva": Estado=Vigente (ESTADO crudo) y
 * INICIO <= hoy <= FIN (`vigente_por_fecha`). Observada, Programada, Finalizada
 * y las piezas sin INICIO/FIN no calculan: quedan fuera de toda alerta. */
export function esPiezaPDViva(p) {
  return p.estado === 'Vigente' && p.vigente_por_fecha === true && !!p.finalizacion;
}

/** Días enteros de `hoyIso` a `finIso` (ISO YYYY-MM-DD). Negativo si ya venció. */
export function diasHastaVencer(finIso, hoyIso) {
  const [fy, fm, fd] = finIso.split('-').map(Number);
  const [hy, hm, hd] = hoyIso.split('-').map(Number);
  return Math.round((Date.UTC(fy, fm - 1, fd) - Date.UTC(hy, hm - 1, hd)) / 86400000);
}

/** 🔴 vence en <= 3 días (o ya vencida pero aún Vigente), 🟡 4-7, 🟢 > 7.
 * null si la pieza no está viva -- nunca verde por default. */
export function colorVencimientoPD(p, hoyIso) {
  if (!esPiezaPDViva(p)) return null;
  const dias = diasHastaVencer(p.finalizacion, hoyIso);
  if (dias <= PD_DIAS_ROJO) return '🔴';
  if (dias <= PD_DIAS_AMARILLO) return '🟡';
  return '🟢';
}
