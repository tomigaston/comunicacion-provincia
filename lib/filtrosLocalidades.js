// Grilla de Localidades: armado de filas y filtros, fuera del componente para
// que la auditoría (interaccion-audit.md) pruebe el MISMO código que usa la
// pantalla. Mismas fuentes que las cards, el semáforo y el mail.

import { calcularEjePDPorLocalidad } from './coverage';
import { normalizarTexto } from './texto';
import { TIPOS_MEDIO } from './tiposMedio';

/** Una fila por localidad: banda MT (eje A, del JSON) + eje B de PD (viva y
 * dirigida, D2) calculado contra `hoyIso`. */
export function combinarLocalidades(localidadesData, mediosData, pautaData, hoyIso) {
  const coberturaPorClave = new Map(mediosData.localidades.map((l) => [normalizarTexto(l.localidad), l]));
  const ejePD = calcularEjePDPorLocalidad(pautaData.piezas, hoyIso);
  return localidadesData.localidades.map((loc) => {
    const clave = normalizarTexto(loc.localidad);
    const cobertura = coberturaPorClave.get(clave);
    return {
      ...loc,
      bandaCobertura: cobertura ? cobertura.banda_cobertura : 'Sin',
      totalTipos: cobertura ? cobertura.total_tipos : 0,
      cobertura: cobertura ? cobertura.cobertura : {},
      ejePD: ejePD.get(clave) || null,
    };
  });
}

/** Categoría de PD de una fila: color de la próxima vencimiento ('🔴'|'🟡'|'🟢')
 * o 'sin' (sin pauta viva dirigida). */
export const categoriaPD = (l) => (l.ejePD ? l.ejePD.color : 'sin');

/**
 * AND entre grupos, OR dentro de cada grupo:
 *  - Cobertura MT: la banda está entre las activas (`bandasActivas`).
 *  - Tipo de medio MT: con ALGUNO de los "✓ incluir" (OR) y sin NINGUNO de los
 *    "✕ excluir". Sin ninguno marcado, el grupo no filtra.
 *  - Pauta digital: la categoría está entre las elegidas (`pdActivos`). Vacío =
 *    no filtra.
 *  - Búsqueda por nombre de localidad / departamento.
 */
export function filtrarLocalidades(filas, { busqueda = '', bandasActivas, mediosEstado = {}, pdActivos = new Set() }) {
  const q = normalizarTexto(busqueda);
  const incluidos = TIPOS_MEDIO.filter((t) => mediosEstado[t.key] === 'incluir');
  const excluidos = TIPOS_MEDIO.filter((t) => mediosEstado[t.key] === 'excluir');
  return filas.filter((l) => {
    if (q && !normalizarTexto(l.localidad).includes(q) && !normalizarTexto(l.departamento).includes(q)) return false;
    if (!bandasActivas.has(l.bandaCobertura)) return false;
    if (incluidos.length > 0 && !incluidos.some((t) => l.cobertura[t.key])) return false;
    if (excluidos.some((t) => l.cobertura[t.key])) return false;
    if (pdActivos.size > 0 && !pdActivos.has(categoriaPD(l))) return false;
    return true;
  });
}
