import { calcularSemaforoPD, calcularSemaforoPDPorLocalidad } from './semaforo';
import { normalizarTexto } from './texto';

// Escala Sin/Baja/Media/Alta con salto de matiz real (gris → rojo → ámbar → verde),
// no variaciones de un mismo tono — requisito de UX explícito.
export const BANDA_COBERTURA = {
  Sin: { fg: 'var(--cov-sin)', bg: 'var(--cov-sin-bg)', label: 'Sin cobertura' },
  Baja: { fg: 'var(--cov-baja)', bg: 'var(--cov-baja-bg)', label: 'Cobertura baja' },
  Media: { fg: 'var(--cov-media)', bg: 'var(--cov-media-bg)', label: 'Cobertura media' },
  Alta: { fg: 'var(--cov-alta)', bg: 'var(--cov-alta-bg)', label: 'Cobertura alta' },
};

export const ORDEN_BANDAS = ['Sin', 'Baja', 'Media', 'Alta'];

/**
 * Eje B de la cobertura: semáforo de Pauta Digital por cantidad de piezas
 * ACTIVAS en la localidad (28/10/2026; calcularSemaforoPD en lib/semaforo.js),
 * dirigidas y provinciales. Es independiente del eje A (banda MT): nunca se
 * fusionan en un número único.
 *
 * @returns {(localidad: string) => object} resultado de calcularSemaforoPD()
 *   para esa localidad; una localidad sin piezas da 0 activas (🔴), nunca null.
 */
export function calcularEjePDPorLocalidad(pautaData, hoyIso) {
  const porClave = calcularSemaforoPDPorLocalidad(pautaData.piezas, hoyIso, pautaData.generado_el, normalizarTexto);
  const vacio = calcularSemaforoPD([], hoyIso, pautaData.generado_el);
  return (localidad) => porClave.get(normalizarTexto(localidad)) || vacio;
}

/** "34 activas (26 dirigidas · 8 provinciales)" -- mismo texto en la grilla,
 * la ficha y el semáforo. */
export function textoActivasPD(eje, { desglose = true } = {}) {
  const base = `${eje.activas} activa${eje.activas === 1 ? '' : 's'}`;
  if (!desglose || eje.activas === 0) return base;
  return `${base} (${eje.dirigidas} dirigida${eje.dirigidas === 1 ? '' : 's'} · ${eje.provinciales} provincial${eje.provinciales === 1 ? '' : 'es'})`;
}

export function textoVencimiento(dias) {
  if (dias < 0) return 'vencida';
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `vence en ${dias}d`;
}
