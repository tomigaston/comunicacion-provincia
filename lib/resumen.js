// Cards de resumen (spec 11/10/2026, Regla 4). Cero cálculo nuevo: todo sale de
// los predicados y ejes que ya usan la grilla, el semáforo y el mail
// (banda_cobertura del JSON, esPiezaPDViva, cuentaParaLocalidad,
// colorVencimientoPD, calcularEjePDPorLocalidad, calcularVencimientos*). PD se
// cuenta en CAMPAÑAS (nombre distinto), no en piezas: una campaña provincial o
// departamental expandida a muchas localidades es UNA.

import { esPiezaPDViva, cuentaParaLocalidad, calcularSemaforoMedios, pesoDeColor } from './semaforo';
import { calcularEjePDPorLocalidad } from './coverage';
import {
  calcularVencimientosMediosTradicionales,
  calcularVencimientosPautaDigital,
  calcularLocalidadesSinCobertura,
  nombreCampana,
} from './vencimientos';
import { normalizarTexto } from './texto';
import { TIPOS_MEDIO } from './tiposMedio';

/** Pieza que cuenta como PD "dirigida" a una localidad de las 60: viva (Vigente
 * + INICIO<=hoy<=FIN) y dirigida a la zona (D2: sin provincial ni departamental). */
const esPiezaDirigidaViva = (p) =>
  p.en_60_localidades && p.alcance_tipo === 'localidad' && !!p.localidad && cuentaParaLocalidad(p) && esPiezaPDViva(p);

/** Peor color por campaña (una campaña con piezas en dos bandas cuenta una vez,
 * en la peor). */
function peorColorPorCampana(grupos) {
  const porCampana = new Map();
  for (const g of grupos) {
    const actual = porCampana.get(g.campana);
    if (!actual || pesoDeColor(g.color) > pesoDeColor(actual)) porCampana.set(g.campana, g.color);
  }
  return porCampana;
}

export function resumenGeneral(mediosData, pautaData, hoyIso) {
  const locs = mediosData.localidades;
  const total = locs.length;

  const bandas = { Alta: 0, Media: 0, Baja: 0, Sin: 0 };
  for (const l of locs) bandas[l.banda_cobertura] += 1;

  const frescuraMT = calcularVencimientosMediosTradicionales(mediosData);
  const sinCobertura = calcularLocalidadesSinCobertura(mediosData, pautaData, hoyIso).localidades;

  // Vencimientos: mismo conjunto de piezas que el mail (calcularVencimientosPautaDigital),
  // contado en campañas distintas, cada una en su peor color.
  const venc = calcularVencimientosPautaDigital(pautaData, hoyIso);
  const colorPorCampana = peorColorPorCampana(venc.grupos);
  let rojas = 0;
  let amarillas = 0;
  for (const color of colorPorCampana.values()) {
    if (color === '🔴') rojas += 1;
    else if (color === '🟡') amarillas += 1;
  }

  const campanasDirigidas = new Set();
  for (const p of pautaData.piezas) if (esPiezaDirigidaViva(p)) campanasDirigidas.add(nombreCampana(p));
  const eje = calcularEjePDPorLocalidad(pautaData.piezas, hoyIso);
  const localidadesConPauta = locs.filter((l) => eje.get(normalizarTexto(l.localidad))).length;

  return {
    total,
    sinCobertura: sinCobertura.length,
    vencenEstaSemana: colorPorCampana.size,
    mt: {
      bandas,
      conCoberturaMediaOAlta: bandas.Media + bandas.Alta,
      temasPorRevisar: frescuraMT.grupos.length,
      rojos: frescuraMT.resumen.rojas,
      amarillos: frescuraMT.resumen.amarillas,
    },
    pd: {
      campanasVivasDirigidas: campanasDirigidas.size,
      vencenRojas: rojas,
      vencenAmarillas: amarillas,
      localidadesConPauta,
    },
  };
}

export function resumenLocalidad(medios, pautaPiezas, localidad, hoyIso) {
  const clave = normalizarTexto(localidad);
  let mt = null;
  if (medios) {
    const sm = calcularSemaforoMedios(medios);
    mt = {
      tipos: medios.total_tipos,
      total: TIPOS_MEDIO.length,
      banda: medios.banda_cobertura,
      chips: TIPOS_MEDIO.map((t) => ({ label: t.label, presente: !!medios.cobertura[t.key] })),
      frescura: sm.frescura,
    };
  }
  const propias = pautaPiezas.filter((p) => normalizarTexto(p.localidad) === clave && esPiezaDirigidaViva(p));
  const eje = calcularEjePDPorLocalidad(propias, hoyIso).get(clave) || null;
  return {
    mt,
    pd: {
      campanasVivasDirigidas: new Set(propias.map(nombreCampana)).size,
      proxima: eje, // {color, dias, piezas} | null => sin pauta viva dirigida
    },
  };
}
