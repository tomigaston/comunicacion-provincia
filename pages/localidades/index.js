import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import FilterBar from '../../components/FilterBar';
import MedioFilterChip from '../../components/MedioFilterChip';
import Autocomplete from '../../components/Autocomplete';
import { ResumenGeneral } from '../../components/ResumenCards';
import LocalidadCard from '../../components/LocalidadCard';
import { CruceMTPD, GrillaLocalidades } from '../../components/InicioPropuesta';
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

// Filtros más chicos (19/11/2026): el título de cada grupo va al costado de
// sus botones, no arriba, y los botones son más bajos.
const etiquetaGrupo = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  whiteSpace: 'nowrap',
};
const grupoEnLinea = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };

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
  // Filtro desde un gráfico de la derecha: { tipo: 'antiguedad' | 'area',
  // clave, etiqueta } o null.
  const [filtroGrafico, setFiltroGrafico] = useState(null);
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
    filtroGrafico !== null ||
    Object.values(mediosEstado).some((e) => e !== 'off');

  function limpiarFiltros() {
    setBandasActivas(new Set(ORDEN_BANDAS));
    setPdActivos(new Set());
    setMediosEstado(Object.fromEntries(TIPOS_MEDIO.map((m) => [m.key, 'off'])));
    setFiltroGrafico(null);
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
      // Sin INICIO (pasa en la fuente del interior) no hay con qué contar los
      // días: ese contenido no entra en esta cuenta.
      .map((g) => ({ ...g, localidades: g.localidades.size, dirigidas: g.dirigidas.size, dias: g.inicio ? diasHastaVencer(hoy, g.inicio) : null }))
      .filter((g) => g.dias !== null && g.dias >= DIAS_CONTENIDO_ANTIGUO)
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
    // Áreas con alguna pieza activa en cada localidad (mismas piezas que el
    // semáforo: las provinciales vienen repetidas en cada localidad).
    const areasPorLocalidad = new Map();
    for (const p of activas) {
      const k = normalizarTexto(p.localidad);
      if (!areasPorLocalidad.has(k)) areasPorLocalidad.set(k, new Set());
      areasPorLocalidad.get(k).add(p.area_tematica || 'Sin área');
    }
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
    // Para filtrar la grilla desde el gráfico (19/11/2026): tramos presentes en
    // cada localidad, con las mismas filas y umbrales que el gráfico.
    const tramosPorLocalidad = new Map();
    const marcarTramo = (loc, tramo) => {
      const k = normalizarTexto(loc.localidad);
      if (!tramosPorLocalidad.has(k)) tramosPorLocalidad.set(k, new Set());
      tramosPorLocalidad.get(k).add(tramo);
    };
    const amarilla = mediosData.umbral_alerta_amarilla_dias;
    const roja = mediosData.umbral_alerta_roja_dias;
    for (const loc of mediosData.localidades) {
      for (const v of loc.vigentes || []) {
        if ((v.estado || '').trim().toLowerCase() !== 'activo') continue;
        if (v.fecha_desde && typeof v.antiguedad_dias === 'number') {
          const tramo = v.antiguedad_dias >= roja ? 'rojo' : v.antiguedad_dias >= amarilla ? 'amarillo' : 'verde';
          tramos[tramo] += 1;
          marcarTramo(loc, tramo);
        } else {
          tramos.sinFecha += 1;
          marcarTramo(loc, 'sinFecha');
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
      porLocalidad: { tramos: tramosPorLocalidad, areas: areasPorLocalidad },
    };
  }, [datos]);

  // Lleva hasta la grilla solo si no está a la vista (en dos columnas suele
  // estarlo y no conviene que la página salte).
  function irAGrilla() {
    const grilla = typeof document !== 'undefined' && document.getElementById('grilla-localidades');
    if (!grilla) return;
    const { top } = grilla.getBoundingClientRect();
    if (top < 0 || top > window.innerHeight * 0.6) grilla.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Filtros que vienen de los resúmenes (19/11/2026): dejan solo ese recorte
  // (limpian los demás filtros, así la grilla muestra la misma cantidad que el
  // número que se tocó). Si ese recorte ya estaba elegido, lo limpian.
  const sinOtrosFiltros = filtroGrafico === null && Object.values(mediosEstado).every((e) => e === 'off');
  const mismo = (set, lista) => set.size === lista.length && lista.every((x) => set.has(x));
  function filtrarRecorte(bandas, colores) {
    if (sinOtrosFiltros && mismo(bandasActivas, bandas) && mismo(pdActivos, colores)) {
      limpiarFiltros();
      return;
    }
    setBandasActivas(new Set(bandas));
    setPdActivos(new Set(colores));
    setMediosEstado(Object.fromEntries(TIPOS_MEDIO.map((m) => [m.key, 'off'])));
    setFiltroGrafico(null);
    irAGrilla();
  }

  // Filtro desde los gráficos de antigüedad de MT y de áreas de PD: deja las
  // localidades con al menos un tema o una pieza de ese tramo o área (y limpia
  // los demás filtros). Si ya estaba elegido, lo saca.
  function filtrarGrafico(tipo, clave, etiqueta) {
    if (filtroGrafico && filtroGrafico.tipo === tipo && filtroGrafico.clave === clave) {
      limpiarFiltros();
      return;
    }
    setBandasActivas(new Set(ORDEN_BANDAS));
    setPdActivos(new Set());
    setMediosEstado(Object.fromEntries(TIPOS_MEDIO.map((m) => [m.key, 'off'])));
    setFiltroGrafico({ tipo, clave, etiqueta });
    irAGrilla();
  }

  // Grilla final: filtros de arriba + el del gráfico, si hay uno.
  const filtradosFinal = useMemo(() => {
    if (!filtroGrafico || !propuesta) return filtrados;
    const mapa = filtroGrafico.tipo === 'antiguedad' ? propuesta.porLocalidad.tramos : propuesta.porLocalidad.areas;
    return filtrados.filter((l) => {
      const set = mapa.get(normalizarTexto(l.localidad));
      return !!set && set.has(filtroGrafico.clave);
    });
  }, [filtrados, filtroGrafico, propuesta]);

  // Drill-down desde las cards: deja activas solo esas bandas y baja a la grilla.
  function filtrarBandas(bandas) {
    filtrarRecorte(bandas, []);
  }
  // Banda que hoy filtra sola la grilla (para marcarla en la barra de MT).
  const bandaActiva = bandasActivas.size === 1 && pdActivos.size === 0 && sinOtrosFiltros ? Array.from(bandasActivas)[0] : null;

  // Indicador "Sin cobertura": grilla en banda Sin + Pauta Digital 🔴 (0–5
  // activas). Es el recorte más cercano al criterio del indicador (Sin MT y
  // 0 piezas activas): puede incluir localidades con 1 a 5 activas.
  function filtrarSinCobertura() {
    filtrarRecorte(['Sin'], ['🔴']);
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
          bandaActiva={bandaActiva}
          filtroGrafico={filtroGrafico}
          onFiltrarGrafico={filtrarGrafico}
          ladoIzquierdo={
            <>
              {/* Resumen de estados arriba de las localidades (19/11/2026): las 60, sin filtros; cada una filtra la grilla. */}
              {combinado && (
                <CruceMTPD filas={combinado} filtro={{ bandas: bandasActivas, pd: pdActivos, sinOtros: sinOtrosFiltros }} onFiltrar={filtrarRecorte} />
              )}

              <div style={{ marginBottom: 14 }}>
                <FilterBar compacto>
                  <Autocomplete
                    compacto
                    items={itemsBusqueda}
                    placeholder="Buscar localidad o departamento..."
                    onQueryChange={setBusqueda}
                    onSelect={(item) => router.push(`/localidades/${item.value}`)}
                  />
                  <div style={grupoEnLinea}>
                    <div style={etiquetaGrupo}>Cobertura MT</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {ORDEN_BANDAS.map((banda) => {
                        const activa = bandasActivas.has(banda);
                        const cfg = BANDA_COBERTURA[banda];
                        return (
                          <button
                            key={banda}
                            type="button"
                            onClick={() => alternarBanda(banda)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 999,
                              border: `1.5px solid ${activa ? cfg.fg : 'var(--border)'}`,
                              background: activa ? cfg.bg : 'var(--bg-secondary)',
                              color: activa ? cfg.fg : 'var(--text-tertiary)',
                              fontSize: 12.5,
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
                  <div style={grupoEnLinea}>
                    <div style={etiquetaGrupo}>Tipo de medio MT</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                  <div style={grupoEnLinea}>
                    <div style={etiquetaGrupo}>Pauta digital</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {OPCIONES_PD.map((op) => {
                        const activa = pdActivos.has(op.key);
                        return (
                          <button
                            key={op.key}
                            type="button"
                            onClick={() => alternarPD(op.key)}
                            aria-pressed={activa}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 999,
                              border: `1.5px solid ${activa ? op.fg : 'var(--border)'}`,
                              background: activa ? op.bg : 'var(--bg-secondary)',
                              color: activa ? op.fg : 'var(--text-secondary)',
                              fontSize: 12.5,
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
                <div id="grilla-localidades">
                  {/* Vista resumida / completa y orden (19/11/2026): mismas filas filtradas. */}
                  <GrillaLocalidades
                    filas={filtradosFinal}
                    Tarjeta={LocalidadCard}
                    encabezado={
                      <>
                        Mostrando {filtradosFinal.length} de {combinado.length} localidades
                        {filtroGrafico && <> con {filtroGrafico.etiqueta}</>}
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
                      </>
                    }
                  />
                </div>
              )}
            </>
          }
        />
      )}

    </Layout>
  );
}
