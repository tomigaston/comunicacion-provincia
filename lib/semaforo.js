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
