// Cards de resumen (spec 11/10/2026, Regla 4 / 4b). Cero cálculo nuevo de
// reglas: todo sale de los predicados y ejes que ya usan la grilla, el
// semáforo y el mail (banda_cobertura del JSON, esPiezaPDViva,
// esPiezaPDDirigida, calcularSemaforoPD, calcularCoberturaPD,
// calcularVencimientosMediosTradicionales). PD cuenta PIEZAS activas
// (dirigidas y provinciales, igual que el semáforo desde el 28/10/2026) y
// lista las campañas de esas piezas.

import {
  esPiezaPDViva,
  esPiezaPDVencidaSinRenovar,
  esPiezaPDDirigida,
  esPiezaPDDeLocalidad,
  calcularSemaforoPD,
  calcularSemaforoMedios,
  diasHastaVencer,
} from './semaforo';
import {
  calcularVencimientosMediosTradicionales,
  calcularCoberturaPD,
  calcularLocalidadesSinCobertura,
  nombreCampana,
} from './vencimientos';
import { normalizarTexto } from './texto';
import { TIPOS_MEDIO } from './tiposMedio';

const RANGO_BANDA = { Sin: 0, Baja: 1, Media: 2, Alta: 3 };

/** Pieza dirigida de una localidad de las 60, Vigente en la fuente pero con FIN
 * anterior al corte del dato: anomalía "vencida sin renovar" (resumen general). */
const esPiezaDirigidaVencidaSinRenovar = (p, generadoEl) =>
  esPiezaPDDeLocalidad(p) && esPiezaPDDirigida(p) && esPiezaPDVencidaSinRenovar(p, generadoEl);

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

  // PD (28/10/2026): Atención de los próximos 7 días con el mismo cálculo que
  // el semáforo y el mail (calcularCoberturaPD), y piezas activas de las 60
  // (dirigidas y provinciales) por campaña. Las piezas se cuentan por
  // localidad (pieza-localidad): una fila provincial suma una en cada una.
  const coberturaPD = calcularCoberturaPD(mediosData, pautaData, hoyIso);
  let activas = 0;
  let dirigidas = 0;
  const porCampana = new Map();
  for (const p of pautaData.piezas) {
    if (!esPiezaPDDeLocalidad(p) || !esPiezaPDViva(p, hoyIso)) continue;
    activas += 1;
    if (esPiezaPDDirigida(p)) dirigidas += 1;
    const n = nombreCampana(p);
    if (!porCampana.has(n)) porCampana.set(n, { piezas: 0, localidades: new Set() });
    porCampana.get(n).piezas += 1;
    porCampana.get(n).localidades.add(p.localidad);
  }
  const campanas = Array.from(porCampana, ([campana, c]) => ({ campana, piezas: c.piezas, localidades: c.localidades.size })).sort(
    (a, b) => b.piezas - a.piezas || a.campana.localeCompare(b.campana, 'es')
  );

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
      ventanaHasta: coberturaPD.ventanaHasta,
      atencion: coberturaPD.atencion,
      cubiertas: coberturaPD.cubiertas,
      activas,
      dirigidas,
      provinciales: activas - dirigidas,
      campanas,
      vencidasSinRenovar: Array.from(vencidas, ([campana, finalizacion]) => ({ campana, finalizacion })),
    },
  };
}

/** "VIA PÚBLICA" -> "VIA_PUBLICA": misma clave que `cobertura` / TIPOS_MEDIO. */
export const claveTipoMedio = (t) =>
  normalizarTexto(t)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

export function resumenLocalidad(medios, pautaPiezas, localidad, hoyIso, generadoEl) {
  const clave = normalizarTexto(localidad);
  let mt = null;
  if (medios) {
    const sm = calcularSemaforoMedios(medios);
    // Temas activos por tipo: filas de `vigentes` con Estado=Activo (mismo
    // criterio que la cobertura, incluye los Activos sin fecha), por tipo_medio.
    const activos = (medios.vigentes || []).filter((v) => (v.estado || '').trim().toLowerCase() === 'activo');
    const porTipo = {};
    for (const v of activos) porTipo[claveTipoMedio(v.tipo_medio)] = (porTipo[claveTipoMedio(v.tipo_medio)] || 0) + 1;
    mt = {
      tipos: medios.total_tipos,
      total: TIPOS_MEDIO.length,
      banda: medios.banda_cobertura,
      temasActivos: activos.length,
      chips: TIPOS_MEDIO.map((t) => ({
        key: t.key,
        label: t.label,
        presente: !!medios.cobertura[t.key],
        temas: porTipo[t.key] || 0,
      })),
      frescura: sm.frescura,
    };
  }
  // PD: mismas piezas que el semáforo (todas las de la localidad, dirigidas y
  // provinciales); `semaforo` = calcularSemaforoPD().
  const deLaLocalidad = pautaPiezas.filter((p) => esPiezaPDDeLocalidad(p) && normalizarTexto(p.localidad) === clave);
  const activas = deLaLocalidad.filter((p) => esPiezaPDViva(p, hoyIso));
  const semaforo = calcularSemaforoPD(deLaLocalidad, hoyIso, generadoEl);
  const vencidas = new Set(deLaLocalidad.filter((p) => esPiezaPDVencidaSinRenovar(p, generadoEl)).map(nombreCampana));
  // Campañas distintas por plataforma (una campaña puede estar en varias, así
  // que la suma puede superar el total de campañas).
  const porPlataforma = new Map();
  for (const p of activas) {
    const pl = p.plataforma || 'Sin plataforma';
    if (!porPlataforma.has(pl)) porPlataforma.set(pl, new Set());
    porPlataforma.get(pl).add(nombreCampana(p));
  }
  // Campañas de las piezas activas de la localidad: FIN más próximo, piezas y
  // plataformas de cada una.
  const porCampana = new Map();
  for (const p of activas) {
    const n = nombreCampana(p);
    const dias = diasHastaVencer(p.finalizacion, hoyIso);
    if (!porCampana.has(n)) porCampana.set(n, { campana: n, dias, piezas: 0, plataformas: new Set() });
    const c = porCampana.get(n);
    c.piezas += 1;
    if (dias < c.dias) c.dias = dias;
    c.plataformas.add(p.plataforma || 'Sin plataforma');
  }
  const campanas = Array.from(porCampana.values())
    .map((c) => ({ ...c, plataformas: Array.from(c.plataformas) }))
    .sort((a, b) => a.dias - b.dias || a.campana.localeCompare(b.campana, 'es'));
  return {
    mt,
    pd: {
      campanasActivas: campanas.length,
      campanas,
      plataformas: Array.from(porPlataforma, ([plataforma, set]) => ({ plataforma, campanas: set.size })).sort(
        (a, b) => b.campanas - a.campanas || a.plataforma.localeCompare(b.plataforma, 'es')
      ),
      semaforo,
      vencidasSinRenovar: Array.from(vencidas),
    },
  };
}
