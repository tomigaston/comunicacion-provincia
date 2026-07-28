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

export function anioDe(iso) {
  if (!iso) return null;
  const anio = Number(iso.slice(0, 4));
  return Number.isNaN(anio) ? null : anio;
}
