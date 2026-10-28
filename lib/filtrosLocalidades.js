// Grilla de Localidades: armado de filas y filtros, fuera del componente para
// que la auditoría (interaccion-audit.md) pruebe el MISMO código que usa la
// pantalla. Mismas fuentes que las cards, el semáforo y el mail.

import { calcularEjePDPorLocalidad } from './coverage';
import { normalizarTexto } from './texto';
import { TIPOS_MEDIO } from './tiposMedio';

/** Una fila por localidad: banda MT (eje A, del JSON) + eje B de PD (semáforo
 * por cantidad de piezas activas, dirigidas y provinciales) contra `hoyIso`. */
export function combinarLocalidades(localidadesData, mediosData, pautaData, hoyIso) {
  const coberturaPorClave = new Map(mediosData.localidades.map((l) => [normalizarTexto(l.localidad), l]));
  const ejePD = calcularEjePDPorLocalidad(pautaData, hoyIso);
  return localidadesData.localidades.map((loc) => {
    const clave = normalizarTexto(loc.localidad);
    const cobertura = coberturaPorClave.get(clave);
    return {
      ...loc,
      bandaCobertura: cobertura ? cobertura.banda_cobertura : 'Sin',
      totalTipos: cobertura ? cobertura.total_tipos : 0,
      cobertura: cobertura ? cobertura.cobertura : {},
      ejePD: ejePD(loc.localidad),
    };
  });
}

/** Categoría de PD de una fila: color por cantidad de piezas activas
 * ('🔴'|'🟡'|'🟢'; 0 activas es 🔴). */
export const categoriaPD = (l) => l.ejePD.color;

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
