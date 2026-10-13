// Cards de resumen (spec 11/10/2026, Regla 4 / 4b). Cero cálculo nuevo de
// reglas: todo sale de los predicados y ejes que ya usan la grilla, el
// semáforo y el mail (banda_cobertura del JSON, esPiezaPDViva,
// cuentaParaLocalidad, colorVencimientoPD, calcularEjePDPorLocalidad,
// calcularVencimientos*). PD se cuenta en CAMPAÑAS (nombre distinto), no en
// piezas: una campaña provincial o departamental expandida a muchas
// localidades es UNA.

import {
  esPiezaPDViva,
  esPiezaPDVencidaSinRenovar,
  cuentaParaLocalidad,
  calcularSemaforoMedios,
  diasHastaVencer,
  pesoDeColor,
} from './semaforo';
import { calcularEjePDPorLocalidad } from './coverage';
import {
  calcularVencimientosMediosTradicionales,
  calcularVencimientosPautaDigital,
  calcularLocalidadesSinCobertura,
  nombreCampana,
} from './vencimientos';
import { normalizarTexto } from './texto';
import { TIPOS_MEDIO } from './tiposMedio';

const RANGO_BANDA = { Sin: 0, Baja: 1, Media: 2, Alta: 3 };

/** Pieza que cuenta como PD "dirigida" a una localidad de las 60: viva (Vigente
 * + INICIO<=hoy<=FIN) y dirigida a la zona (D2: sin provincial ni departamental). */
const esPiezaDirigidaViva = (p, hoyIso) =>
  p.en_60_localidades &&
  p.alcance_tipo === 'localidad' &&
  !!p.localidad &&
  cuentaParaLocalidad(p) &&
  esPiezaPDViva(p, hoyIso);

/** Pieza dirigida (D2) de una localidad de las 60, Vigente en la fuente pero con
 * FIN anterior al corte del dato: anomalía "vencida sin renovar". */
const esPiezaDirigidaVencidaSinRenovar = (p, generadoEl) =>
  p.en_60_localidades &&
  p.alcance_tipo === 'localidad' &&
  !!p.localidad &&
  cuentaParaLocalidad(p) &&
  esPiezaPDVencidaSinRenovar(p, generadoEl);

/** Campañas distintas que vencen en la ventana de 7 días (mismo conjunto de
 * piezas que el mail), cada una con su peor color y los días al primer FIN.
 * `continua`: la campaña sigue con otras piezas vivas DESPUÉS de la ventana
 * (el vencimiento es parcial, no corta la campaña entera). Orden: 🔴 primero,
 * después los que vencen antes, después por nombre. */
function campanasQueVencen(pautaData, hoyIso) {
  const venc = calcularVencimientosPautaDigital(pautaData, hoyIso);
  const porCampana = new Map();
  for (const g of venc.grupos) {
    const dias = diasHastaVencer(g.fecha_vencimiento, hoyIso);
    const actual = porCampana.get(g.campana);
    if (!actual) {
      porCampana.set(g.campana, { campana: g.campana, color: g.color, dias });
    } else {
      if (pesoDeColor(g.color) > pesoDeColor(actual.color)) actual.color = g.color;
      if (dias < actual.dias) actual.dias = dias;
    }
  }
  const siguen = new Set();
  for (const p of pautaData.piezas) {
    if (esPiezaPDViva(p, hoyIso) && p.finalizacion > venc.ventanaHasta) siguen.add(nombreCampana(p));
  }
  const lista = Array.from(porCampana.values()).map((c) => ({ ...c, continua: siguen.has(c.campana) }));
  lista.sort(
    (a, b) =>
      pesoDeColor(b.color) - pesoDeColor(a.color) || a.dias - b.dias || a.campana.localeCompare(b.campana, 'es')
  );
  return lista;
}

/** Movimiento de cobertura MT contra la foto de la carga anterior
 * (`snapshot_anterior`, ver snapshot_anterior_mt en scripts/generar_datos.py).
 * null si no hay foto: el front oculta el delta, no inventa un 0. */
function movimientoMT(mediosData) {
  const prev = mediosData.snapshot_anterior;
  if (!prev || !prev.localidades) return null;
  const locs = mediosData.localidades;
  let antesMediaOAlta = 0;
  let ahoraMediaOAlta = 0;
  const cambios = [];
  for (const l of locs) {
    const antes = prev.localidades[l.localidad];
    if (!antes) continue; // sin foto de esa localidad: no se compara
    if (RANGO_BANDA[antes.banda] >= RANGO_BANDA.Media) antesMediaOAlta += 1;
    if (RANGO_BANDA[l.banda_cobertura] >= RANGO_BANDA.Media) ahoraMediaOAlta += 1;
    if (antes.banda !== l.banda_cobertura) {
      cambios.push({
        localidad: l.localidad,
        de: antes.banda,
        a: l.banda_cobertura,
        empeoro: RANGO_BANDA[l.banda_cobertura] < RANGO_BANDA[antes.banda],
      });
    }
  }
  // Las que empeoraron primero, después las que mejoraron; por nombre dentro de cada grupo.
  cambios.sort((a, b) => Number(b.empeoro) - Number(a.empeoro) || a.localidad.localeCompare(b.localidad, 'es'));
  return { fecha: prev.fecha, variacion: ahoraMediaOAlta - antesMediaOAlta, cambios };
}

export function resumenGeneral(mediosData, pautaData, hoyIso) {
  const locs = mediosData.localidades;
  const total = locs.length;

  const bandas = { Alta: 0, Media: 0, Baja: 0, Sin: 0 };
  for (const l of locs) bandas[l.banda_cobertura] += 1;

  // Las más débiles (Sin primero, después Baja con menos tipos), nombradas.
  const debiles = locs
    .filter((l) => l.banda_cobertura === 'Sin' || l.banda_cobertura === 'Baja')
    .sort((a, b) => a.total_tipos - b.total_tipos || a.localidad.localeCompare(b.localidad, 'es'))
    .map((l) => ({ localidad: l.localidad, banda: l.banda_cobertura, tipos: l.total_tipos }));

  const frescuraMT = calcularVencimientosMediosTradicionales(mediosData);
  const temas = frescuraMT.grupos.map((g) => ({
    tema: g.tema,
    color: g.color,
    dias: g.antiguedad_dias,
    tipo: g.tipoVarios ? 'Varios' : g.tipo_medio,
    localidades: g.localidades.length,
  }));

  const sinCobertura = calcularLocalidadesSinCobertura(mediosData, pautaData, hoyIso).localidades;

  const vencen = campanasQueVencen(pautaData, hoyIso);
  const rojas = vencen.filter((c) => c.color === '🔴').length;
  const amarillas = vencen.filter((c) => c.color === '🟡').length;

  const campanasDirigidas = new Set();
  for (const p of pautaData.piezas) if (esPiezaDirigidaViva(p, hoyIso)) campanasDirigidas.add(nombreCampana(p));

  const vencidas = new Map();
  for (const p of pautaData.piezas) {
    if (esPiezaDirigidaVencidaSinRenovar(p, pautaData.generado_el)) {
      const n = nombreCampana(p);
      if (!vencidas.has(n) || p.finalizacion > vencidas.get(n)) vencidas.set(n, p.finalizacion);
    }
  }

  return {
    total,
    sinCobertura: sinCobertura.length,
    sinCoberturaNombres: sinCobertura.map((l) => l.localidad),
    mt: {
      bandas,
      conCoberturaMediaOAlta: bandas.Media + bandas.Alta,
      debiles,
      temas,
      temasPorRevisar: temas.length,
      rojos: frescuraMT.resumen.rojas,
      amarillos: frescuraMT.resumen.amarillas,
      movimiento: movimientoMT(mediosData),
    },
    pd: {
      vencen,
      vencenTotal: vencen.length,
      vencenRojas: rojas,
      vencenAmarillas: amarillas,
      vencenSinContinuidad: vencen.filter((c) => !c.continua).length,
      campanasVivasDirigidas: campanasDirigidas.size,
      vencidasSinRenovar: Array.from(vencidas, ([campana, finalizacion]) => ({ campana, finalizacion })),
    },
  };
}

export function resumenLocalidad(medios, pautaPiezas, localidad, hoyIso, generadoEl) {
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
  const propias = pautaPiezas.filter((p) => normalizarTexto(p.localidad) === clave && esPiezaDirigidaViva(p, hoyIso));
  const eje = calcularEjePDPorLocalidad(propias, hoyIso).get(clave) || null;
  const vencidas = new Set(
    pautaPiezas
      .filter((p) => normalizarTexto(p.localidad) === clave && esPiezaDirigidaVencidaSinRenovar(p, generadoEl))
      .map(nombreCampana)
  );
  return {
    mt,
    pd: {
      campanasVivasDirigidas: new Set(propias.map(nombreCampana)).size,
      proxima: eje, // {color, dias, piezas} | null => sin pauta viva dirigida
      vencidasSinRenovar: Array.from(vencidas),
    },
  };
}
