import { esPiezaPDViva, cuentaParaLocalidad, colorVencimientoPD, diasHastaVencer, pesoDeColor } from './semaforo';
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
 * Eje B de la cobertura (spec 11/10/2026, Regla 3): presencia de Pauta Digital
 * VIVA dirigida a la localidad + su peor color de vencimiento. Es independiente
 * del eje A (banda MT): nunca se fusionan en un número único.
 * Solo cuenta lo dirigido a la zona (cuentaParaLocalidad: localidad_directa,
 * circuito_capital, multiple_depto) y vivo (esPiezaPDViva); la provincial
 * expandida a las 60 y lo departamental no cubren una localidad.
 *
 * @returns {Map<string, {color: string, dias: number, piezas: number}>}
 *   clave = normalizarTexto(localidad). `dias` = los que faltan para el
 *   próximo vencimiento. Una localidad ausente del mapa = sin PD viva.
 */
export function calcularEjePDPorLocalidad(piezas, hoyIso) {
  const porClave = new Map();
  for (const p of piezas) {
    if (!p.localidad || !cuentaParaLocalidad(p) || !esPiezaPDViva(p)) continue;
    const clave = normalizarTexto(p.localidad);
    const color = colorVencimientoPD(p, hoyIso);
    const dias = diasHastaVencer(p.finalizacion, hoyIso);
    const actual = porClave.get(clave);
    if (!actual) {
      porClave.set(clave, { color, dias, piezas: 1 });
    } else {
      actual.piezas += 1;
      if (pesoDeColor(color) > pesoDeColor(actual.color)) actual.color = color;
      if (dias < actual.dias) actual.dias = dias;
    }
  }
  return porClave;
}

export function textoVencimiento(dias) {
  if (dias < 0) return 'vencida';
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `vence en ${dias}d`;
}
