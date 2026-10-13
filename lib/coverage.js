import {
  esPiezaPDViva,
  cuentaParaLocalidad,
  colorVencimientoPD,
  diasHastaVencer,
  pesoDeColor,
  nombreCampana,
  PD_DIAS_ROJO,
} from './semaforo';
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
 * @returns {Map<string, {color: string, dias: number, piezas: number, sigueAlAire: number}>}
 *   clave = normalizarTexto(localidad). `dias` = los que faltan para el
 *   próximo vencimiento. `sigueAlAire` = campañas distintas con alguna pieza viva
 *   dirigida que sigue más allá de la ventana roja (> PD_DIAS_ROJO días): lo que
 *   le queda a la localidad cuando venza lo que hoy la pinta de 🔴. 0 = quedaría
 *   sin PD dirigida viva (riesgo real). Es contexto del 🔴, no cambia el color.
 *   Una localidad ausente del mapa = sin PD viva.
 */
export function calcularEjePDPorLocalidad(piezas, hoyIso) {
  const porClave = new Map();
  for (const p of piezas) {
    if (!p.localidad || !cuentaParaLocalidad(p) || !esPiezaPDViva(p, hoyIso)) continue;
    const clave = normalizarTexto(p.localidad);
    const color = colorVencimientoPD(p, hoyIso);
    const dias = diasHastaVencer(p.finalizacion, hoyIso);
    const actual = porClave.get(clave);
    if (!actual) {
      porClave.set(clave, { color, dias, piezas: 1, _siguen: new Set() });
    } else {
      actual.piezas += 1;
      if (pesoDeColor(color) > pesoDeColor(actual.color)) actual.color = color;
      if (dias < actual.dias) actual.dias = dias;
    }
    if (dias > PD_DIAS_ROJO) porClave.get(clave)._siguen.add(nombreCampana(p));
  }
  for (const v of porClave.values()) {
    v.sigueAlAire = v._siguen.size;
    delete v._siguen;
  }
  return porClave;
}

/** Contexto que acompaña al 🔴 de PD: lo que le queda al aire a la localidad
 * (o, para una campaña, a la que menos le queda entre las que toca). Vacío si no
 * queda ninguna: ahí el rojo va solo, es riesgo real (se queda sin PD dirigida). */
export function textoSigueAlAire(n, { deCampana = false } = {}) {
  if (!n || n < 1) return '';
  const base = `${n} campaña${n === 1 ? '' : 's'} al aire`;
  return deCampana ? `sus localidades siguen con al menos ${base}` : `sigue con ${base}`;
}

export function textoVencimiento(dias) {
  if (dias < 0) return 'vencida';
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `vence en ${dias}d`;
}
