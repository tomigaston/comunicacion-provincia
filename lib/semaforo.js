// Semáforo de antigüedad (🟢/🟡/🔴) -- Medios Tradicionales y Pauta Digital
// únicamente (spec Alertas de vencimiento + Semáforo, 31/08/2026). El emoji ya
// viene calculado desde scripts/generar_datos.py (Medios Tradicionales lo lee
// tal cual de Maestro_Vigente; Pauta Digital lo calcula al vuelo con los mismos
// umbrales de Parametros) -- acá solo se interpreta para pintar y agregar.

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
// Se calcula siempre desde las filas de Maestro_Vigente (`vigentes`), no desde
// la hoja Cobertura. Pauta Digital no usa esto: sigue con peorAlerta().

const TIPOS_MEDIO_VALIDOS = [
  'TV',
  'RADIO',
  'WEB',
  'CARTELERIA',
  'VIA PUBLICA',
  'GRAFICA',
  'PANTALLA LED',
];

const UMBRAL_TEMA_ESTANCADO_DIAS = 30;

function claveTipoMedio(tipo) {
  return (tipo || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim()
    .toUpperCase();
}

const esActivo = (v) => (v.estado || '').trim().toLowerCase() === 'activo';
const conFecha = (v) => !!v.fecha_desde && typeof v.antiguedad_dias === 'number';

function colorFrescura(dias) {
  if (dias === null) return '🔴';
  if (dias <= 30) return '🟢';
  if (dias <= 50) return '🟡';
  return '🔴';
}

function colorCobertura(tipos) {
  if (tipos >= 5) return '🟢';
  if (tipos >= 3) return '🟡';
  return '🔴';
}

/**
 * @param {Array} vigentes filas de MT de una localidad (Maestro_Vigente)
 * @returns {{ color, frescura: {color, dias}, cobertura: {color, tipos, total},
 *   motivo: string[], estancados: Array }}
 * `estancados`: temas Activos con fecha y antigüedad >= 30, del más viejo al
 * más nuevo. Cartelería/Gráfica/parte de Vía Pública sin Fecha_Desde no cuentan
 * acá (ni como 0 días) -- pero sí cuentan para cobertura si están Activos.
 */
export function calcularSemaforoMedios(vigentes) {
  const activas = (vigentes || []).filter(esActivo);

  const conFechaActivas = activas.filter(conFecha);
  const dias = conFechaActivas.length
    ? Math.min(...conFechaActivas.map((v) => v.antiguedad_dias))
    : null;
  const colorF = colorFrescura(dias);

  const tiposActivos = new Set(
    activas.map((v) => claveTipoMedio(v.tipo_medio)).filter((t) => TIPOS_MEDIO_VALIDOS.includes(t))
  );
  const colorC = colorCobertura(tiposActivos.size);

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
      `Cobertura ${colorC === '🔴' ? 'baja' : 'media'}: ${tiposActivos.size} de ${TIPOS_MEDIO_VALIDOS.length} tipos de medio con tema activo`
    );
  }

  const estancados = conFechaActivas
    .filter((v) => v.antiguedad_dias >= UMBRAL_TEMA_ESTANCADO_DIAS)
    .sort((a, b) => b.antiguedad_dias - a.antiguedad_dias);

  return {
    color: peorAlerta([colorF, colorC]),
    frescura: { color: colorF, dias },
    cobertura: { color: colorC, tipos: tiposActivos.size, total: TIPOS_MEDIO_VALIDOS.length },
    motivo,
    estancados,
  };
}
