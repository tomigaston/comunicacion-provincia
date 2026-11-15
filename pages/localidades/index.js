import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import FilterBar from '../../components/FilterBar';
import MedioFilterChip from '../../components/MedioFilterChip';
import Autocomplete from '../../components/Autocomplete';
import { ResumenGeneral } from '../../components/ResumenCards';
import LocalidadCard from '../../components/LocalidadCard';
import { useApiData } from '../../lib/useApiData';
import { slugificar } from '../../lib/texto';
import { ORDEN_BANDAS, BANDA_COBERTURA } from '../../lib/coverage';
import { combinarLocalidades, filtrarLocalidades } from '../../lib/filtrosLocalidades';
import { isoDe } from '../../lib/vencimientos';
import { resumenGeneral } from '../../lib/resumen';
import { TIPOS_MEDIO } from '../../lib/tiposMedio';
import { PD_MIN_AMARILLO, PD_MIN_VERDE, esPiezaPDDeLocalidad, esPiezaPDDirigida, esPiezaPDViva, diasHastaVencer } from '../../lib/semaforo';
import { normalizarTexto } from '../../lib/texto';

// Umbral del dato "contenido vigente hace dos meses o más" de Pauta Digital
// (pedido de Catalina, 6/11/2026): 60 días.
const DIAS_CONTENIDO_ANTIGUO = 60;

// Categorías del grupo "Pauta digital" (eje B de la cobertura): color por
// cantidad de piezas activas en la localidad (dirigidas y provinciales).
const OPCIONES_PD = [
  { key: '🔴', label: `0–${PD_MIN_AMARILLO - 1} activas 🔴`, fg: 'var(--cov-baja)', bg: 'var(--cov-baja-bg)' },
  { key: '🟡', label: `${PD_MIN_AMARILLO}–${PD_MIN_VERDE - 1} activas 🟡`, fg: 'var(--cov-media)', bg: 'var(--cov-media-bg)' },
  { key: '🟢', label: `${PD_MIN_VERDE}+ activas 🟢`, fg: 'var(--cov-alta)', bg: 'var(--cov-alta-bg)' },
];

const etiquetaGrupo = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  marginBottom: 6,
};

export default function LocalidadesIndex() {
  const router = useRouter();
  // PROPUESTA DE INICIO (6/11/2026): se piden además SMS, Orgánico,
  // Audiovisuales y Movimientos solo para la línea "Datos:" y las tarjetas
  // "Áreas sin carga reciente" y "Movimientos de la semana". Si se aplica,
  // conviene que el script deje esas fechas en un JSON chico en vez de bajar
  // los archivos enteros.
  const { cargando, error, datos } = useApiData([
    '/api/data/localidades',
    '/api/data/medios-tradicionales',
    '/api/data/pauta-digital',
    '/api/data/sms',
    '/api/data/contenido-organico',
    '/api/data/audiovisuales',
    '/api/data/movimientos',
  ]);

  const [busqueda, setBusqueda] = useState('');
  const [bandasActivas, setBandasActivas] = useState(new Set(ORDEN_BANDAS));
  // Grupo "Pauta digital": vacío = sin filtro; si hay opciones, OR entre ellas.
  const [pdActivos, setPdActivos] = useState(new Set());
  const [mediosEstado, setMediosEstado] = useState(() =>
    Object.fromEntries(TIPOS_MEDIO.map((m) => [m.key, 'off']))
  );

  const combinado = useMemo(() => {
    if (!datos) return null;
    const [localidadesData, mediosData, pautaData] = datos;
    return combinarLocalidades(localidadesData, mediosData, pautaData, isoDe(new Date()));
  }, [datos]);

  const itemsBusqueda = useMemo(() => {
    if (!combinado) return [];
    return combinado.map((l) => ({
      value: slugificar(l.localidad),
      label: l.localidad,
      sublabel: l.departamento,
    }));
  }, [combinado]);

  const filtrados = useMemo(() => {
    if (!combinado) return [];
    return filtrarLocalidades(combinado, { busqueda, bandasActivas, mediosEstado, pdActivos });
  }, [combinado, busqueda, bandasActivas, mediosEstado, pdActivos]);

  const hayFiltros =
    bandasActivas.size !== ORDEN_BANDAS.length ||
    pdActivos.size > 0 ||
    Object.values(mediosEstado).some((e) => e !== 'off');

  function limpiarFiltros() {
    setBandasActivas(new Set(ORDEN_BANDAS));
    setPdActivos(new Set());
    setMediosEstado(Object.fromEntries(TIPOS_MEDIO.map((m) => [m.key, 'off'])));
  }

  // Cards de resumen: salen de los mismos predicados y ejes que la grilla, el
  // semáforo y el mail (ver lib/resumen.js), no de un cálculo propio.
  const resumen = useMemo(() => {
    if (!datos) return null;
    const [, mediosData, pautaData] = datos;
    return resumenGeneral(mediosData, pautaData, isoDe(new Date()));
  }, [datos]);

  // Contenido de Pauta Digital vigente hace dos meses o más (pedido de
  // Catalina, 6/11/2026). Definición: un contenido es CAMPAÑA + TÍTULO de la
  // pieza. Solo cuentan los contenidos con alguna pieza activa hoy (mismo
  // predicado que el semáforo, esPiezaPDViva). Los días activo se cuentan
  // desde el primer INICIO registrado de ese contenido en cualquier pieza de
  // las 60 localidades (vigente o finalizada): una renovación con fechas
  // nuevas no reinicia el conteo. Queda marcado si lleva 60 días o más. Se
  // separa lo provincial (repartido a las 60) de lo dirigido a localidades
  // puntuales. Es un conteo nuevo: no sale de ninguna regla existente.
  const repetidosPD = useMemo(() => {
    if (!datos) return null;
    const pautaData = datos[2];
    const hoy = isoDe(new Date());
    const claveDe = (p) => `${normalizarTexto(p.campana)}|${normalizarTexto(p.titulo_pieza)}`;
    // Primer INICIO de cada contenido, mirando todas sus piezas con fecha.
    const primerInicio = new Map();
    for (const p of pautaData.piezas) {
      if (!esPiezaPDDeLocalidad(p) || !p.inicio) continue;
      const clave = claveDe(p);
      if (!primerInicio.has(clave) || p.inicio < primerInicio.get(clave)) primerInicio.set(clave, p.inicio);
    }
    const grupos = new Map();
    for (const p of pautaData.piezas) {
      if (!esPiezaPDDeLocalidad(p) || !esPiezaPDViva(p, hoy)) continue;
      const clave = claveDe(p);
      if (!grupos.has(clave)) {
        grupos.set(clave, {
          clave,
          campana: p.campana || 'Sin campaña',
          titulo: p.titulo_pieza || '(sin título)',
          inicio: primerInicio.get(clave) || p.inicio,
          localidades: new Set(),
          dirigidas: new Set(),
          provincial: false,
          piezas: 0,
        });
      }
      const g = grupos.get(clave);
      g.piezas += 1;
      g.localidades.add(normalizarTexto(p.localidad));
      if (esPiezaPDDirigida(p)) g.dirigidas.add(normalizarTexto(p.localidad));
      else g.provincial = true;
    }
    const antiguos = Array.from(grupos.values())
      .map((g) => ({ ...g, localidades: g.localidades.size, dirigidas: g.dirigidas.size, dias: diasHastaVencer(hoy, g.inicio) }))
      .filter((g) => g.dias >= DIAS_CONTENIDO_ANTIGUO)
      .sort((a, b) => b.dias - a.dias || a.titulo.localeCompare(b.titulo, 'es'));
    return {
      hoy,
      dias: DIAS_CONTENIDO_ANTIGUO,
      vigentes: grupos.size,
      antiguos,
      provinciales: antiguos.filter((g) => g.provincial).length,
      soloDirigidos: antiguos.filter((g) => !g.provincial).length,
    };
  }, [datos]);

  // Datos de la propuesta de inicio (6/11/2026). Todos son conteos sobre datos
  // que ya existen; ninguno cambia una regla. Cada uno dice de dónde sale.
  const propuesta = useMemo(() => {
    if (!datos) return null;
    const [, mediosData, pautaData, smsData, organicoData, avData, movData] = datos;
    const hoy = isoDe(new Date());
    const clave = (s) => normalizarTexto(s).replace(/\s+/g, ' ');

    // Piezas de PD activas hoy en las 60 (mismo predicado que el semáforo).
    const activas = pautaData.piezas.filter((p) => esPiezaPDDeLocalidad(p) && esPiezaPDViva(p, hoy));
    // Pieza distinta = campaña + título + plataforma (mismo criterio que el
    // bloque Atención, clavePiezaDistinta en lib/vencimientos.js).
    const distintas = new Map();
    for (const p of activas) {
      const k = JSON.stringify([clave(p.campana), clave(p.titulo_pieza), clave(p.plataforma)]);
      if (!distintas.has(k)) distintas.set(k, p);
    }
    const contarAreas = (lista) => {
      const m = new Map();
      for (const p of lista) {
        const a = p.area_tematica || 'Sin área';
        m.set(a, (m.get(a) || 0) + 1);
      }
      return Array.from(m, ([area, n]) => ({ area, n })).sort((a, b) => b.n - a.n || a.area.localeCompare(b.area, 'es'));
    };
    const piezasDistintas = Array.from(distintas.values());
    const areas = {
      distintas: contarAreas(piezasDistintas),
      porLocalidad: contarAreas(activas),
      totalDistintas: piezasDistintas.length,
      totalPorLocalidad: activas.length,
    };

    // Provinciales: contenidos distintos entre las piezas no dirigidas (un
    // mismo contenido puede existir además como dirigido: se cuenta igual), y
    // cuántas piezas provinciales cuenta cada localidad.
    const provClaves = new Set();
    const provPorLoc = new Map();
    for (const p of activas) {
      if (esPiezaPDDirigida(p)) continue;
      provClaves.add(JSON.stringify([clave(p.campana), clave(p.titulo_pieza), clave(p.plataforma)]));
      const l = normalizarTexto(p.localidad);
      provPorLoc.set(l, (provPorLoc.get(l) || 0) + 1);
    }
    const provDistintas = provClaves.size;
    const provValores = Array.from(provPorLoc.values());
    const provMax = provValores.length ? Math.max(...provValores) : 0;
    const provMin = provValores.length ? Math.min(...provValores) : 0;

    // Antigüedad de los temas activos de MT (mismas filas y umbrales que
    // calcularSemaforoMedios: Activo, con fecha y antigüedad numérica).
    const tramos = { verde: 0, amarillo: 0, rojo: 0, sinFecha: 0 };
    const sinFechaPorTipo = new Map();
    const amarilla = mediosData.umbral_alerta_amarilla_dias;
    const roja = mediosData.umbral_alerta_roja_dias;
    for (const loc of mediosData.localidades) {
      for (const v of loc.vigentes || []) {
        if ((v.estado || '').trim().toLowerCase() !== 'activo') continue;
        if (v.fecha_desde && typeof v.antiguedad_dias === 'number') {
          if (v.antiguedad_dias >= roja) tramos.rojo += 1;
          else if (v.antiguedad_dias >= amarilla) tramos.amarillo += 1;
          else tramos.verde += 1;
        } else {
          tramos.sinFecha += 1;
          sinFechaPorTipo.set(v.tipo_medio, (sinFechaPorTipo.get(v.tipo_medio) || 0) + 1);
        }
      }
    }
    const antiguedadMT = {
      tramos,
      total: tramos.verde + tramos.amarillo + tramos.rojo + tramos.sinFecha,
      sinFechaPorTipo: Array.from(sinFechaPorTipo, ([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
    };

    // Fechas de cada fuente (mismo cálculo que el aviso de SMS y de Orgánico).
    const maxDe = (lista, campo) => lista.reduce((max, x) => (x[campo] && x[campo] > max ? x[campo] : max), '');
    const avItems = (avData && avData.items) || [];
    const fechas = {
      mt: mediosData.generado_el,
      pd: pautaData.generado_el,
      sms: smsData ? maxDe(smsData.envios || [], 'fecha_inicio') : '',
      organico: organicoData ? maxDe(organicoData.publicaciones || [], 'fecha') : '',
      avTotal: avItems.length,
      avVigentes: avItems.filter((i) => i.fecha_inicio && i.fecha_fin && i.fecha_inicio <= hoy && hoy <= i.fecha_fin).length,
      avUltimaCarga: maxDe(avItems, 'fecha_carga'),
    };

    // Movimientos: mismo dato que la pestaña (total_avisos_cambiaron y las
    // fechas de la primera fila).
    const primer = movData && movData.cambios && movData.cambios[0];
    const movimientos = movData
      ? { total: movData.total_avisos_cambiaron, anterior: primer ? primer.fecha_semana_anterior : null, actual: primer ? primer.fecha_semana_actual : null }
      : null;

    return {
      hoy,
      areas,
      provinciales: provDistintas ? { distintas: provDistintas, porLocalidad: provMin === provMax ? provMax : `${provMin} a ${provMax}` } : null,
      antiguedadMT,
      fechas,
      movimientos,
      cortes: mediosData.cortes_cobertura || null,
      umbralesMT: { amarilla, roja },
    };
  }, [datos]);

  // Drill-down desde las cards: deja activas solo esas bandas y baja a la grilla.
  function filtrarBandas(bandas) {
    setBandasActivas(new Set(bandas));
    const grilla = typeof document !== 'undefined' && document.getElementById('grilla-localidades');
    if (grilla) grilla.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Indicador "Sin cobertura": grilla en banda Sin + Pauta Digital 🔴 (0–5
  // activas). Es el recorte más cercano al criterio del indicador (Sin MT y
  // 0 piezas activas): puede incluir localidades con 1 a 5 activas.
  function filtrarSinCobertura() {
    setBandasActivas(new Set(['Sin']));
    setPdActivos(new Set(['🔴']));
    const grilla = typeof document !== 'undefined' && document.getElementById('grilla-localidades');
    if (grilla) grilla.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function alternarPD(clave) {
    setPdActivos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });
  }

  function alternarBanda(banda) {
    setBandasActivas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(banda)) nuevo.delete(banda);
      else nuevo.add(banda);
      return nuevo.size === 0 ? new Set(ORDEN_BANDAS) : nuevo;
    });
  }

  return (
    <Layout title="Localidades">
      {cargando && <p>Cargando datos del tablero...</p>}
      {error && <p style={{ color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>}

      {resumen && (
        <ResumenGeneral
          r={resumen}
          repetidosPD={repetidosPD}
          propuesta={propuesta}
          filas={combinado}
          onFiltrarBandas={filtrarBandas}
          onFiltrarSinCobertura={filtrarSinCobertura}
        />
      )}

      <div style={{ marginBottom: 20 }}>
        <FilterBar>
          <Autocomplete
            items={itemsBusqueda}
            placeholder="Buscar localidad o departamento..."
            onQueryChange={setBusqueda}
            onSelect={(item) => router.push(`/localidades/${item.value}`)}
          />
          <div>
            <div style={etiquetaGrupo}>Cobertura MT</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ORDEN_BANDAS.map((banda) => {
                const activa = bandasActivas.has(banda);
                const cfg = BANDA_COBERTURA[banda];
                return (
                  <button
                    key={banda}
                    type="button"
                    onClick={() => alternarBanda(banda)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: `1.5px solid ${activa ? cfg.fg : 'var(--border)'}`,
                      background: activa ? cfg.bg : 'var(--bg-secondary)',
                      color: activa ? cfg.fg : 'var(--text-tertiary)',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={etiquetaGrupo}>Tipo de medio MT</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIPOS_MEDIO.map((tipo) => (
                <MedioFilterChip
                  key={tipo.key}
                  medio={tipo.label}
                  estado={mediosEstado[tipo.key]}
                  onChange={(nuevo) => setMediosEstado((actual) => ({ ...actual, [tipo.key]: nuevo }))}
                />
              ))}
            </div>
          </div>
          <div>
            <div style={etiquetaGrupo}>Pauta digital</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {OPCIONES_PD.map((op) => {
                const activa = pdActivos.has(op.key);
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => alternarPD(op.key)}
                    aria-pressed={activa}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: `1.5px solid ${activa ? op.fg : 'var(--border)'}`,
                      background: activa ? op.bg : 'var(--bg-secondary)',
                      color: activa ? op.fg : 'var(--text-secondary)',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {op.label}
                  </button>
                );
              })}
            </div>
          </div>
        </FilterBar>
      </div>

      {combinado && (
        <>
          <p id="grilla-localidades" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Mostrando {filtrados.length} de {combinado.length} localidades
            {hayFiltros && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Limpiar filtros
                </button>
              </>
            )}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            {filtrados.map((l) => (
              <LocalidadCard
                key={l.localidad}
                localidad={l.localidad}
                departamento={l.departamento}
                bandaCobertura={l.bandaCobertura}
                totalTipos={l.totalTipos}
                ejePD={l.ejePD}
              />
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
