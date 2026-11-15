import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import CoverageBadge from '../../components/CoverageBadge';
import StatusBadge from '../../components/StatusBadge';
import FiltroPeriodo from '../../components/FiltroPeriodo';
import VerMaterial, { enlaceEstilo } from '../../components/VerMaterial';
import ModalLineaTiempoMedios from '../../components/ModalLineaTiempoMedios';
import MensajeTruncado from '../../components/MensajeTruncado';
import SemaforoBadge from '../../components/SemaforoBadge';
import { ResumenLocalidad } from '../../components/ResumenCards';
import { resumenLocalidad } from '../../lib/resumen';
import { isoDe } from '../../lib/vencimientos';
import { useApiData } from '../../lib/useApiData';
import { normalizarTexto, slugificar } from '../../lib/texto';
import { formatearFechaCorta, calcularVentana, fechaDentroDeVentana, rangoDentroDeVentana, rangoFechaDesdeHasta } from '../../lib/fechas';
import { TIPOS_MEDIO } from '../../lib/tiposMedio';
import { claveTipoMedio } from '../../lib/resumen';
import { nombreCampana, PD_DIAS_VENTANA } from '../../lib/semaforo';
import { BANDA_COBERTURA, textoActivasPD, textoVencimiento } from '../../lib/coverage';

const PERIODO_DEFAULT = { tipo: 'preset', valor: 'ultimo_mes' };

// Chips de canal del bloque Pauta digital, mismo patrón visual que los chips
// de TIPOS_MEDIO de Medios tradicionales. IG/FB/YT salen de las columnas de
// link propias (ya vienen resueltas a null salvo que contengan un link http
// real, ver limpiar_link() en generar_datos.py); Google Ads no tiene columna
// de link propia en el excel fuente, así que se usa PLATAFORMA="Google Ads"
// como señal de que la pieza es de ese canal.
const CANALES_PAUTA = [
  { key: 'ig', label: 'Instagram' },
  { key: 'fb', label: 'Facebook' },
  { key: 'yt', label: 'YouTube' },
  { key: 'google', label: 'Google (Search/Display)' },
];

function canalesDePieza(p) {
  const canales = [];
  if (p.link_ig) canales.push('ig');
  if (p.link_fb) canales.push('fb');
  if (p.link_yt) canales.push('yt');
  if (p.plataforma === 'Google Ads') canales.push('google');
  return canales;
}

/** Badges de canal para una fila de la tabla (subconjunto de CANALES_PAUTA
 * que aplica a esa pieza puntual, no toda la localidad). */
function CanalBadges({ pieza }) {
  const canales = canalesDePieza(pieza);
  if (canales.length === 0) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {canales.map((key) => (
        <span key={key} style={badgeCanal}>
          {CANALES_PAUTA.find((c) => c.key === key).label.split(' ')[0]}
        </span>
      ))}
    </div>
  );
}

// Vistas de la tabla de Pauta digital (2.4): "piezas" es la de siempre.
const VISTAS_PD = [
  { key: 'piezas', label: 'Todas las piezas' },
  { key: 'campana', label: 'Por campaña' },
];
const SIN_PLATAFORMA = 'Sin plataforma';

export default function DetalleLocalidad() {
  const router = useRouter();
  const slug = typeof router.query.localidad === 'string' ? router.query.localidad : '';

  const { cargando, error, datos } = useApiData([
    '/api/data/localidades',
    '/api/data/medios-tradicionales',
    '/api/data/pauta-digital',
    '/api/data/sms',
    '/api/data/contenido-organico',
  ]);

  const [periodo, setPeriodo] = useState(PERIODO_DEFAULT);
  const ventana = useMemo(() => calcularVentana(periodo), [periodo]);
  const [modalTimelineAbierto, setModalTimelineAbierto] = useState(false);
  // Recorte de la tabla de MT pedido desde las cards: solo temas ACTIVOS, de un
  // tipo (o de todos). null = sin recorte.
  const [filtroTemas, setFiltroTemas] = useState(null);
  // Buscador por tema de la tabla de MT (2.5).
  const [busquedaTema, setBusquedaTema] = useState('');
  // Tabla de Pauta digital (2.4): vista, buscador y filtros. Por defecto se
  // muestra todo, como siempre.
  const [vistaPD, setVistaPD] = useState('piezas');
  const [busquedaPD, setBusquedaPD] = useState('');
  const [estadoPD, setEstadoPD] = useState('Todos');
  const [plataformaPD, setPlataformaPD] = useState('Todas');
  const refSeccionMT = useRef(null);

  // Datos base de la localidad, SIN filtrar por período — de acá sale tanto
  // lo que se termina mostrando (una vez aplicado el filtro) como la lista
  // de meses reales para el dropdown "mes puntual".
  const info = useMemo(() => {
    if (!datos || !slug) return null;
    const [localidadesData, mediosData, pautaData, smsData, contenidoOrganicoData] = datos;

    const base = localidadesData.localidades.find((l) => slugificar(l.localidad) === slug);
    if (!base) return { noEncontrada: true };

    const clave = normalizarTexto(base.localidad);
    const medios = mediosData.localidades.find((l) => normalizarTexto(l.localidad) === clave);

    const piezasPauta = pautaData.piezas
      .filter(
        (p) =>
          p.en_60_localidades &&
          // alcance_tipo (derivado de Alcance_Detectado en generar_datos.py) manda:
          // solo LOCALIDAD/CAPITAL/BARRIO ('localidad') atan por texto de Localidad.
          // Regla sin excepciones: una pieza se atribuye a esta Localidad SOLO si su
          // Localidad puntual es una de las 60 y coincide con esta. Todo lo demás
          // (DEPARTAMENTO, PROVINCIA, y lo que quedó sin tipo: REGION/CIRCUITO/
          // CODIGO_AUDIENCIA/OTRO) no se atribuye a ninguna localidad — ni siquiera
          // por Departamento en común.
          p.alcance_tipo === 'localidad' && normalizarTexto(p.localidad) === clave
      )
      .sort((a, b) => (b.finalizacion || '').localeCompare(a.finalizacion || ''));

    // Mismo criterio que Pauta digital: solo se atribuye a ESTA localidad
    // cuando algún alcance del envío es tipo "localidad" y coincide por
    // nombre — un alcance "departamento" en el mismo envío no cuenta acá
    // (eso es lo que ve el Departamento contenedor, no esta localidad puntual).
    const enviosSms = (smsData.envios || [])
      .filter((e) => e.alcances.some((a) => a.tipo === 'localidad' && normalizarTexto(a.localidad) === clave))
      .sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || ''));

    // Solo cuenta como atribuida a ESTA localidad si su LUGAR resolvió
    // exactamente a esta localidad (una de las 60) — igual que Pauta Digital
    // y SMS, acá tampoco hay fallback a Departamento (ver 3.5 del CONTEXTO):
    // el ámbito provincial ("Toda la provincia") nunca cuenta como esta
    // localidad puntual.
    const publicacionesOrganico = (contenidoOrganicoData.publicaciones || [])
      .filter((p) => (p.localidades || []).some((l) => normalizarTexto(l) === clave))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    return { base, medios, piezasPauta, enviosSms, publicacionesOrganico };
  }, [datos, slug]);

  // Fechas reales de esta localidad (las 3 áreas juntas), para armar el
  // dropdown "mes puntual" del filtro — nunca una lista de meses hardcodeada.
  const fechasDisponibles = useMemo(() => {
    if (!info || info.noEncontrada) return [];
    const fechas = [];
    if (info.medios) info.medios.vigentes.forEach((v) => fechas.push(v.fecha_hasta || v.fecha_desde));
    info.piezasPauta.forEach((p) => fechas.push(p.finalizacion));
    info.enviosSms.forEach((e) => fechas.push(e.fecha_inicio));
    info.publicacionesOrganico.forEach((p) => fechas.push(p.fecha));
    return fechas;
  }, [info]);

  // Cards de resumen de esta localidad: no dependen del filtro de período
  // (estado actual), mismas fuentes que la grilla y el semáforo (lib/resumen.js).
  const resumen = useMemo(() => {
    if (!info || !info.base || !datos) return null;
    return resumenLocalidad(info.medios, datos[2].piezas, info.base.localidad, isoDe(new Date()), datos[2].generado_el);
  }, [info, datos]);

  // 2.2: tema activo más reciente de cada tipo de medio. Se elige la fila
  // Activa con la Fecha_Desde más nueva de cada tipo y se muestra tal cual,
  // con la alerta de antigüedad que esa fila ya trae de la planilla
  // (Maestro_Vigente: Antiguedad_Dias y Alerta, contra Fecha_Desde). Sin
  // Fecha_Desde no hay antigüedad: esas filas no participan.
  const recientePorTipo = useMemo(() => {
    const salida = {};
    if (!info || !info.medios) return salida;
    for (const v of info.medios.vigentes) {
      if ((v.estado || '').trim().toLowerCase() !== 'activo' || !v.fecha_desde) continue;
      const k = claveTipoMedio(v.tipo_medio);
      if (!salida[k] || v.fecha_desde > salida[k].fecha_desde) {
        salida[k] = { fecha_desde: v.fecha_desde, alerta: v.alerta, antiguedad_dias: v.antiguedad_dias };
      }
    }
    return salida;
  }, [info]);

  // Click en un número de la card de MT: muestra en la tabla exactamente esos
  // temas (Estado=Activo, de ese tipo), con el período en "Todo" para que el
  // conteo de la tabla sea el de la card, y baja hasta la tabla.
  function filtrarTemas({ tipo }) {
    setFiltroTemas({ tipo });
    setBusquedaTema('');
    setPeriodo({ tipo: 'preset', valor: 'todo' });
    setTimeout(() => {
      if (refSeccionMT.current) {
        refSeccionMT.current.open = true;
        refSeccionMT.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

  // Listas efectivamente visibles, ya con el filtro de período aplicado.
  const visible = useMemo(() => {
    if (!info || info.noEncontrada) return null;
    return {
      vigentes: info.medios
        ? info.medios.vigentes.filter(
            (v) =>
              fechaDentroDeVentana(v.fecha_hasta || v.fecha_desde, ventana) &&
              (!filtroTemas ||
                ((v.estado || '').trim().toLowerCase() === 'activo' &&
                  (!filtroTemas.tipo || claveTipoMedio(v.tipo_medio) === filtroTemas.tipo)))
          )
        : [],
      // Programada (INICIO futuro): con un preset (siempre hacia atrás desde hoy) se
      // muestra igual; mes/rango personalizado sí se respetan.
      piezasPauta: info.piezasPauta.filter(
        (p) =>
          (p.estado === 'Programada' && periodo.tipo === 'preset') ||
          rangoDentroDeVentana(p.inicio, p.finalizacion, ventana)
      ),
      enviosSms: info.enviosSms.filter((e) => fechaDentroDeVentana(e.fecha_inicio, ventana)),
      publicacionesOrganico: info.publicacionesOrganico.filter((p) => fechaDentroDeVentana(p.fecha, ventana)),
    };
  }, [info, ventana, periodo, filtroTemas]);

  // 2.5: buscador por tema sobre la tabla de MT (después del período y del
  // recorte por tipo que viene de las cards).
  const vigentesBuscados = useMemo(() => {
    if (!visible) return [];
    const q = normalizarTexto(busquedaTema);
    if (!q) return visible.vigentes;
    return visible.vigentes.filter((v) => normalizarTexto(v.tema).includes(q));
  }, [visible, busquedaTema]);

  // Canales con al menos una pieza dentro del período elegido (mismo cálculo
  // que ya filtra visible.piezasPauta), para los chips del bloque Pauta
  // digital.
  const canalesActivos = useMemo(
    () => new Set(visible ? visible.piezasPauta.filter((p) => p.estado !== 'Programada').flatMap(canalesDePieza) : []),
    [visible]
  );
  // Programadas (aún no empezaron) van en un bloque aparte: no cuentan como
  // pauta vigente ni marcan canales como presentes.
  const piezasProgramadas = useMemo(
    () => (visible ? visible.piezasPauta.filter((p) => p.estado === 'Programada') : []),
    [visible]
  );
  const piezasPautaActual = useMemo(
    () => (visible ? visible.piezasPauta.filter((p) => p.estado !== 'Programada') : []),
    [visible]
  );

  // 2.4: opciones de los filtros (de las piezas reales del período) y listas
  // filtradas por buscador, estado y plataforma. Sin nada elegido se ve todo.
  const estadosPD = useMemo(
    () => (visible ? Array.from(new Set(visible.piezasPauta.map((p) => p.estado).filter(Boolean))).sort() : []),
    [visible]
  );
  const plataformasPD = useMemo(
    () => (visible ? Array.from(new Set(visible.piezasPauta.map((p) => p.plataforma || SIN_PLATAFORMA))).sort() : []),
    [visible]
  );
  const hayFiltroPD = !!busquedaPD.trim() || estadoPD !== 'Todos' || plataformaPD !== 'Todas';
  const filtrarPD = (lista) => {
    const q = normalizarTexto(busquedaPD);
    return lista.filter(
      (p) =>
        (!q || normalizarTexto(p.titulo_pieza).includes(q) || normalizarTexto(nombreCampana(p)).includes(q)) &&
        (estadoPD === 'Todos' || p.estado === estadoPD) &&
        (plataformaPD === 'Todas' || (p.plataforma || SIN_PLATAFORMA) === plataformaPD)
    );
  };
  const piezasActualFiltradas = useMemo(() => filtrarPD(piezasPautaActual), [piezasPautaActual, busquedaPD, estadoPD, plataformaPD]);
  const programadasFiltradas = useMemo(() => filtrarPD(piezasProgramadas), [piezasProgramadas, busquedaPD, estadoPD, plataformaPD]);

  // Vista "Por campaña": las mismas piezas filtradas, agrupadas por el nombre
  // de campaña que ya usan las cards (nombreCampana). Solo se agrupan y se
  // cuentan; no se calcula nada nuevo.
  const porCampana = useMemo(() => {
    const grupos = new Map();
    for (const p of piezasActualFiltradas) {
      const n = nombreCampana(p);
      if (!grupos.has(n)) grupos.set(n, { campana: n, piezas: [], plataformas: new Set(), estados: new Set() });
      const g = grupos.get(n);
      g.piezas.push(p);
      g.plataformas.add(p.plataforma || SIN_PLATAFORMA);
      g.estados.add(p.estado);
    }
    return Array.from(grupos.values())
      .map((g) => ({ ...g, plataformas: Array.from(g.plataformas).sort(), estados: Array.from(g.estados).sort() }))
      .sort((a, b) => b.piezas.length - a.piezas.length || a.campana.localeCompare(b.campana, 'es'));
  }, [piezasActualFiltradas]);

  function limpiarFiltrosPD() {
    setBusquedaPD('');
    setEstadoPD('Todos');
    setPlataformaPD('Todas');
  }

  // Resúmenes para el encabezado de cada sección (2.1): mismos valores que
  // las cards de arriba y los conteos de las listas.
  const resumenMT = resumen && resumen.mt
    ? `${resumen.mt.temasActivos} tema${resumen.mt.temasActivos === 1 ? '' : 's'} activo${resumen.mt.temasActivos === 1 ? '' : 's'} · ${resumen.mt.tipos} de ${resumen.mt.total} tipos · ${BANDA_COBERTURA[resumen.mt.banda].label.toLowerCase()}`
    : 'sin datos';
  const resumenPD = resumen
    ? resumen.pd.semaforo.activas > 0
      ? `${textoActivasPD(resumen.pd.semaforo, { desglose: false })} · ${resumen.pd.campanasActivas} campaña${resumen.pd.campanasActivas === 1 ? '' : 's'} · próxima ${textoVencimiento(resumen.pd.semaforo.diasProximoVencimiento)}`
      : '0 activas'
    : '';

  return (
    <Layout title={info && info.base ? info.base.localidad : 'Localidad'}>
      <Link href="/localidades" style={{ fontSize: 13.5, color: 'var(--accent)' }}>
        &larr; Volver a Localidades
      </Link>

      {cargando && <p style={{ marginTop: 16 }}>Cargando...</p>}
      {error && (
        <p style={{ marginTop: 16, color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>
      )}
      {info && info.noEncontrada && (
        <p style={{ marginTop: 16 }}>No encontramos esta localidad entre las 60 prioritarias.</p>
      )}

      {info && info.base && (
        <div style={{ marginTop: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{info.base.localidad}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Departamento {info.base.departamento}
            {info.base.poblacion ? ` · ${info.base.poblacion.toLocaleString('es-AR')} habitantes` : ''}
          </p>

          {resumen && <ResumenLocalidad r={resumen} recientePorTipo={recientePorTipo} onFiltrarTemas={filtrarTemas} />}

          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '14px 18px',
              marginBottom: 20,
            }}
          >
            <FiltroPeriodo periodo={periodo} onChange={setPeriodo} fechasDisponibles={fechasDisponibles} />
            <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8 }}>
              Se aplica a las 3 áreas de esta localidad. Los datos de Medios tradicionales y Pauta
              digital sin fecha de referencia dentro del período elegido quedan afuera.
            </p>
          </div>

          <Seccion id="seccion-mt" titulo="Medios tradicionales" resumen={resumenMT} refDetails={refSeccionMT}>
            {info.medios ? (
              <>
                <div style={{ marginBottom: 14 }}>
                  <CoverageBadge banda={info.medios.banda_cobertura} totalTipos={info.medios.total_tipos} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                  {TIPOS_MEDIO.map((tipo) => {
                    const presente = !!info.medios.cobertura[tipo.key];
                    return (
                      <span
                        key={tipo.key}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 999,
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: presente ? 'var(--cov-alta-bg)' : 'var(--bg-secondary)',
                          color: presente ? 'var(--cov-alta)' : 'var(--text-tertiary)',
                        }}
                      >
                        {presente ? '✓' : '—'} {tipo.label}
                      </span>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                  <button type="button" onClick={() => setModalTimelineAbierto(true)} style={enlaceEstilo}>
                    Ver línea de tiempo completa
                  </button>
                  <input
                    type="search"
                    value={busquedaTema}
                    onChange={(e) => setBusquedaTema(e.target.value)}
                    placeholder="Buscar tema..."
                    aria-label="Buscar tema"
                    style={{ ...inputEstilo, marginLeft: 'auto' }}
                  />
                </div>

                {filtroTemas && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Mostrando {visible.vigentes.length} tema{visible.vigentes.length === 1 ? '' : 's'} activo
                    {visible.vigentes.length === 1 ? '' : 's'}
                    {filtroTemas.tipo ? ` de ${TIPOS_MEDIO.find((t) => t.key === filtroTemas.tipo).label}` : ''}
                    {' · '}
                    <button type="button" onClick={() => setFiltroTemas(null)} style={enlaceEstilo}>
                      Quitar filtro
                    </button>
                  </p>
                )}
                {busquedaTema.trim() && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    {vigentesBuscados.length} de {visible.vigentes.length} tema{visible.vigentes.length === 1 ? '' : 's'} con «{busquedaTema.trim()}»
                    {' · '}
                    <button type="button" onClick={() => setBusquedaTema('')} style={enlaceEstilo}>
                      Limpiar búsqueda
                    </button>
                  </p>
                )}
                {info.medios.vigentes.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                    No hay ningún tema vigente cargado para esta localidad.
                  </p>
                ) : visible.vigentes.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                    Ningún tema vigente cae dentro del período elegido (hay {info.medios.vigentes.length}{' '}
                    en total). Probá con "Todo".
                  </p>
                ) : vigentesBuscados.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>Ningún tema coincide con la búsqueda.</p>
                ) : (
                  <div className="tabla-desplazable">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                        <th style={th}>Tipo de medio</th>
                        <th style={th}>Tema</th>
                        <th style={th}>Vigencia</th>
                        <th style={th}>Material</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vigentesBuscados.map((v, i) => {
                        const rangoVigencia = rangoFechaDesdeHasta(v.fecha_desde, v.fecha_hasta);
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={td}>{v.tipo_medio}</td>
                            <td style={{ ...td, whiteSpace: 'pre-wrap' }}>{v.tema}</td>
                            <td style={td}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {v.sin_fecha ? (
                                  <span style={{ color: 'var(--text-tertiary)' }}>Sin fecha cargada</span>
                                ) : (
                                  <span>{rangoVigencia || '—'}</span>
                                )}
                                <SemaforoBadge alerta={v.alerta} antiguedadDias={v.antiguedad_dias} />
                              </div>
                            </td>
                            <td style={td}>
                              <VerMaterial links={v.links_material} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>Sin datos de medios tradicionales.</p>
            )}
          </Seccion>

          {modalTimelineAbierto && info.medios && (
            <ModalLineaTiempoMedios
              localidad={info.base.localidad}
              semanasCargadas={datos[1].semanas_cargadas}
              onCerrar={() => setModalTimelineAbierto(false)}
            />
          )}

          {info.piezasPauta.length > 0 && (
            <Seccion titulo="Pauta digital" resumen={resumenPD}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                {CANALES_PAUTA.map((canal) => {
                  const presente = canalesActivos.has(canal.key);
                  return (
                    <span
                      key={canal.key}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 999,
                        fontSize: 12.5,
                        fontWeight: 600,
                        background: presente ? 'var(--cov-alta-bg)' : 'var(--bg-secondary)',
                        color: presente ? 'var(--cov-alta)' : 'var(--text-tertiary)',
                      }}
                    >
                      {presente ? '✓' : '—'} {canal.label}
                    </span>
                  );
                })}
              </div>

              {visible.piezasPauta.length === 0 ? (
                <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                  Ninguna pieza de pauta digital cae dentro del período elegido (hay{' '}
                  {info.piezasPauta.length} en total). Probá con "Todo".
                </p>
              ) : (
                <>
                  {/* 2.4: vista, buscador y filtros. Por defecto, todo. */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 999, padding: 3 }}>
                      {VISTAS_PD.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => setVistaPD(v.key)}
                          aria-pressed={vistaPD === v.key}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 999,
                            border: 'none',
                            background: vistaPD === v.key ? 'var(--bg-primary)' : 'transparent',
                            color: vistaPD === v.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: vistaPD === v.key ? 700 : 500,
                            fontSize: 13,
                            cursor: 'pointer',
                            boxShadow: vistaPD === v.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                          }}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="search"
                      value={busquedaPD}
                      onChange={(e) => setBusquedaPD(e.target.value)}
                      placeholder="Buscar título o campaña..."
                      aria-label="Buscar título o campaña"
                      style={{ ...inputEstilo, flex: '1 1 220px' }}
                    />
                    <select value={estadoPD} onChange={(e) => setEstadoPD(e.target.value)} aria-label="Estado" style={selectEstilo}>
                      <option value="Todos">Todos los estados</option>
                      {estadosPD.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                    <select value={plataformaPD} onChange={(e) => setPlataformaPD(e.target.value)} aria-label="Plataforma" style={selectEstilo}>
                      <option value="Todas">Todas las plataformas</option>
                      {plataformasPD.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hayFiltroPD && (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      {piezasActualFiltradas.length} de {piezasPautaActual.length} pieza{piezasPautaActual.length === 1 ? '' : 's'}
                      {piezasProgramadas.length > 0 ? ` · ${programadasFiltradas.length} de ${piezasProgramadas.length} programadas` : ''}
                      {' · '}
                      <button type="button" onClick={limpiarFiltrosPD} style={enlaceEstilo}>
                        Limpiar filtros
                      </button>
                    </p>
                  )}

                  {piezasPautaActual.length === 0 ? null : piezasActualFiltradas.length === 0 ? (
                    <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>Ninguna pieza coincide con los filtros.</p>
                  ) : vistaPD === 'piezas' ? (
                    <TablaPiezas piezas={piezasActualFiltradas} />
                  ) : (
                    <div>
                      {porCampana.map((g) => (
                        <details key={g.campana} className="desplegable" style={{ borderBottom: '1px solid var(--border)' }}>
                          <summary>
                            <span style={{ flex: '1 1 260px' }}>{g.campana}</span>
                            <span style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: 13 }}>
                              {g.piezas.length} pieza{g.piezas.length === 1 ? '' : 's'} · {g.plataformas.join(', ')} · {g.estados.join(', ')}
                            </span>
                          </summary>
                          <div style={{ margin: '4px 0 10px' }}>
                            <TablaPiezas piezas={g.piezas} sinCampana />
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </>
              )}

              {programadasFiltradas.length > 0 && (
                <div style={{ marginTop: 22 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--accent)' }}>
                    Programadas ({programadasFiltradas.length})
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '0 0 8px' }}>
                    Todavía no empezaron: no cuentan como pauta vigente.
                  </p>
                  <TablaPiezas piezas={programadasFiltradas} programadas />
                </div>
              )}
            </Seccion>
          )}

          {info.enviosSms.length > 0 && (
            <Seccion titulo="SMS" resumen={`${info.enviosSms.length} envío${info.enviosSms.length === 1 ? '' : 's'}`}>
              {visible.enviosSms.length === 0 ? (
                <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                  Ningún envío de SMS cae dentro del período elegido (hay {info.enviosSms.length}{' '}
                  en total). Probá con "Todo".
                </p>
              ) : (
                <div className="tabla-desplazable">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={th}>Fecha</th>
                      <th style={th}>Eje</th>
                      <th style={th}>Temática</th>
                      <th style={{ ...th, minWidth: 220 }}>Mensaje</th>
                      <th style={th}>SMS entregados</th>
                      <th style={th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.enviosSms.map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={td}>{formatearFechaCorta(e.fecha_inicio) || '—'}</td>
                        <td style={td}>{e.eje || '—'}</td>
                        <td style={td}>{e.tematica || '—'}</td>
                        <td style={{ ...td, maxWidth: 340 }}>
                          <MensajeTruncado mensaje={e.mensaje} />
                        </td>
                        <td style={td}>
                          {typeof e.cantidad_sms_entregados === 'number'
                            ? e.cantidad_sms_entregados.toLocaleString('es-AR')
                            : '—'}
                        </td>
                        <td style={td}>{e.estado || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </Seccion>
          )}

          {info.publicacionesOrganico.length > 0 && (
            <Seccion
              titulo="Contenido Orgánico"
              resumen={`${info.publicacionesOrganico.length} publicaci${info.publicacionesOrganico.length === 1 ? 'ón' : 'ones'}`}
            >
              {visible.publicacionesOrganico.length === 0 ? (
                <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                  Ninguna publicación cae dentro del período elegido (hay{' '}
                  {info.publicacionesOrganico.length} en total). Probá con "Todo".
                </p>
              ) : (
                <div className="tabla-desplazable">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={th}>Fecha</th>
                      <th style={th}>Red Social</th>
                      <th style={{ ...th, minWidth: 220 }}>Nombre del contenido</th>
                      <th style={th}>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.publicacionesOrganico.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={td}>{formatearFechaCorta(p.fecha) || '—'}</td>
                        <td style={td}>{p.red_social || '—'}</td>
                        <td style={td}>{p.nombre_contenido || '—'}</td>
                        <td style={td}>
                          <VerMaterial links={p.link ? [p.link] : []} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </Seccion>
          )}
        </div>
      )}
    </Layout>
  );
}

/** Tabla de piezas de Pauta digital (2.4): misma de siempre más la columna
 * Campaña. `programadas`: columna Inicio – Fin en vez de Vigente hasta.
 * `sinCampana`: dentro de la vista "Por campaña" la columna sobra. */
function TablaPiezas({ piezas, programadas = false, sinCampana = false }) {
  return (
    <div className="tabla-desplazable">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
            <th style={th}>Título de la pieza</th>
            {!sinCampana && <th style={th}>Campaña</th>}
            <th style={th}>Canal</th>
            <th style={th}>Tipo de pauta</th>
            <th style={th}>Plataforma</th>
            <th style={th}>{programadas ? 'Inicio – Fin' : 'Vigente hasta'}</th>
            <th style={th}>Material</th>
          </tr>
        </thead>
        <tbody>
          {piezas.map((p, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={td}>{p.titulo_pieza || '—'}</td>
              {!sinCampana && <td style={{ ...td, color: 'var(--text-secondary)' }}>{p.campana || '—'}</td>}
              <td style={td}>
                <CanalBadges pieza={p} />
              </td>
              <td style={td}>{p.tipo_pauta || '—'}</td>
              <td style={td}>{p.plataforma || '—'}</td>
              <td style={td}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>
                    {programadas
                      ? `${formatearFechaCorta(p.inicio) || '—'} – ${formatearFechaCorta(p.finalizacion) || '—'}`
                      : formatearFechaCorta(p.finalizacion) || '—'}
                  </span>
                  <StatusBadge estado={p.estado} />
                </div>
              </td>
              <td style={td}>
                <VerMaterial links={p.links_material} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sección plegable (2.1): el encabezado muestra el título y un resumen
 * aunque esté cerrada. Arranca abierta. */
function Seccion({ id, titulo, resumen, children, refDetails }) {
  return (
    <details id={id} ref={refDetails} open className="desplegable seccion">
      <summary>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{titulo}</h2>
        {resumen && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>· {resumen}</span>}
      </summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  );
}

const th = { padding: '8px 10px', fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 };
const td = { padding: '10px 10px', fontSize: 13.5 };
const badgeCanal = {
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 600,
  background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)',
};
const inputEstilo = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 13.5,
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  minWidth: 180,
};
const selectEstilo = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 13,
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
};
