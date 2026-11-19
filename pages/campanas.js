import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import FilterBar from '../components/FilterBar';
import Autocomplete from '../components/Autocomplete';
import CampanaRow from '../components/CampanaRow';
import { useApiData } from '../lib/useApiData';
import { normalizarTexto } from '../lib/texto';
import { formatearFechaDiaMes, rangoDentroDeVentana } from '../lib/fechas';

const AREAS = ['Todas', 'Medios tradicionales', 'Pauta digital', 'Audiovisuales'];
// Vocabulario de Pauta digital. Medios tradicionales se mapea para el filtro
// (Activo -> Vigente, Inactivo -> Finalizada) sin cambiar lo que se muestra;
// Audiovisuales ya trae Vigente/Finalizada; Programada/Observada/S/D solo
// existen en Pauta digital.
const ESTADO_MT_A_FILTRO = { Activo: 'Vigente', Inactivo: 'Finalizada' };

function estadoParaFiltro(it) {
  const e = it.detalle?.estado;
  return it.area_origen === 'Medios tradicionales' ? ESTADO_MT_A_FILTRO[e] || e : e;
}

const ESTADOS = ['Todos', 'Vigente', 'Finalizada', 'Observada', 'Programada', 'S/D'];
const TAMANO_PAGINA = 50;

// Fase 3 (3.2): vistas de la tabla. "detalle" es la de siempre (una fila por
// área + campaña + localidad); "campana" agrupa esas mismas filas por campaña.
const VISTAS = [
  { key: 'detalle', label: 'Detalle' },
  { key: 'campana', label: 'Por campaña' },
];

/** Fechas de una fila según su área, tal como ya vienen en el JSON: Medios
 * tradicionales trae Fecha_Desde y Fecha_Hasta; Pauta digital solo FIN
 * (finalización); Audiovisuales, inicio y fin. */
function fechasDeFila(it) {
  const d = it.detalle || {};
  if (it.area_origen === 'Medios tradicionales') return { desde: d.fecha_desde, hasta: d.fecha_hasta };
  if (it.area_origen === 'Pauta digital') return { desde: null, hasta: d.finalizacion };
  if (it.area_origen === 'Audiovisuales') return { desde: d.fecha_inicio, hasta: d.fecha_fin };
  return { desde: null, hasta: null };
}

/** Campañas distintas de una lista de filas, por nombre normalizado (mismo
 * criterio que el buscador con sugerencias). */
function campanasDistintas(filas) {
  const vistas = new Set();
  for (const it of filas) if (it.campana) vistas.add(normalizarTexto(it.campana));
  return vistas.size;
}

export default function Campanas() {
  const router = useRouter();
  const { cargando, error, datos } = useApiData(['/api/data/campanas']);
  const [area, setArea] = useState('Todas');
  const [estado, setEstado] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
  // Fase 3 (3.3): filtros nuevos. Vacíos o en "Todos" no filtran.
  const [departamento, setDepartamento] = useState('Todos');
  const [localidad, setLocalidad] = useState('Todas');
  const [tipoMedio, setTipoMedio] = useState('Todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [vista, setVista] = useState('detalle');
  // ?q=<campaña>: llegada desde las cards de resumen de Localidades.
  const [qInicial, setQInicial] = useState('');
  useEffect(() => {
    if (router.isReady && typeof router.query.q === 'string') {
      setQInicial(router.query.q);
      setBusqueda(router.query.q);
    }
  }, [router.isReady, router.query.q]);
  const [visibles, setVisibles] = useState(TAMANO_PAGINA);

  const items = datos ? datos[0].items : [];

  const itemsBusqueda = useMemo(() => {
    const vistos = new Set();
    const salida = [];
    for (const it of items) {
      const clave = normalizarTexto(it.campana);
      if (!it.campana || vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push({ value: clave, label: it.campana, sublabel: it.area_origen });
    }
    return salida;
  }, [items]);

  // Opciones de los filtros nuevos, sacadas de las filas reales.
  const departamentos = useMemo(
    () => Array.from(new Set(items.map((it) => it.departamento).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [items]
  );
  const localidades = useMemo(
    () => Array.from(new Set(items.map((it) => it.localidad).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [items]
  );
  // Tipo de medio existe solo en Medios tradicionales (Pauta digital no trae
  // plataforma en campanas.json; ver generar_datos.py, construir_campanas).
  const tiposMedio = useMemo(
    () =>
      Array.from(new Set(items.filter((it) => it.area_origen === 'Medios tradicionales').map((it) => it.detalle?.tipo_medio).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, 'es')
      ),
    [items]
  );

  const ventana = fechaDesde && fechaHasta ? { desde: fechaDesde, hasta: fechaHasta } : null;

  const filtrados = useMemo(() => {
    const q = normalizarTexto(busqueda);
    return items.filter((it) => {
      if (area !== 'Todas' && it.area_origen !== area) return false;
      if (estado !== 'Todos' && estadoParaFiltro(it) !== estado) return false;
      if (departamento !== 'Todos' && it.departamento !== departamento) return false;
      if (localidad !== 'Todas' && it.localidad !== localidad) return false;
      if (tipoMedio !== 'Todos' && it.detalle?.tipo_medio !== tipoMedio) return false;
      if (ventana) {
        const { desde, hasta } = fechasDeFila(it);
        if (!rangoDentroDeVentana(desde, hasta, ventana)) return false;
      }
      if (!q) return true;
      return (
        normalizarTexto(it.campana).includes(q) ||
        normalizarTexto(it.localidad).includes(q) ||
        normalizarTexto(it.departamento).includes(q)
      );
    });
  }, [items, area, estado, busqueda, departamento, localidad, tipoMedio, fechaDesde, fechaHasta]);

  const cantidadCampanas = useMemo(() => campanasDistintas(filtrados), [filtrados]);

  // Vista "Por campaña": las filas filtradas agrupadas por nombre. Solo se
  // agrupan, se cuentan y se toman la fecha más temprana y la más tardía de
  // las filas del grupo; no se calcula ningún estado ni regla nueva.
  const grupos = useMemo(() => {
    if (vista !== 'campana') return [];
    const mapa = new Map();
    for (const it of filtrados) {
      const clave = normalizarTexto(it.campana);
      if (!mapa.has(clave)) {
        mapa.set(clave, { clave, campana: it.campana, filas: [], areas: new Set(), estados: new Set(), localidades: new Set(), desde: null, hasta: null });
      }
      const g = mapa.get(clave);
      g.filas.push(it);
      g.areas.add(it.area_origen);
      g.estados.add(estadoParaFiltro(it) || 'S/D');
      if (it.localidad) g.localidades.add(normalizarTexto(it.localidad));
      const { desde, hasta } = fechasDeFila(it);
      const inicio = desde || hasta;
      if (inicio && (!g.desde || inicio < g.desde)) g.desde = inicio;
      if (hasta && (!g.hasta || hasta > g.hasta)) g.hasta = hasta;
    }
    return Array.from(mapa.values())
      .map((g) => ({
        ...g,
        areas: AREAS.filter((a) => g.areas.has(a)),
        estados: ESTADOS.filter((e) => g.estados.has(e)),
        localidades: g.localidades.size,
      }))
      .sort((a, b) => b.filas.length - a.filas.length || a.campana.localeCompare(b.campana, 'es'));
  }, [filtrados, vista]);

  const hayFiltrosNuevos = departamento !== 'Todos' || localidad !== 'Todas' || tipoMedio !== 'Todos' || !!ventana;
  function limpiarFiltrosNuevos() {
    setDepartamento('Todos');
    setLocalidad('Todas');
    setTipoMedio('Todos');
    setFechaDesde('');
    setFechaHasta('');
    setVisibles(TAMANO_PAGINA);
  }
  const reiniciarPagina = () => setVisibles(TAMANO_PAGINA);

  return (
    <Layout title="Campañas">
      {cargando && <p>Cargando datos del tablero...</p>}
      {error && <p style={{ color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>}

      {datos && (
        <>
          <div style={{ marginBottom: 20 }}>
            <FilterBar>
              <Autocomplete
                key={qInicial}
                valorInicial={qInicial}
                items={itemsBusqueda}
                placeholder="Buscar campaña, localidad o departamento..."
                onQueryChange={(q) => {
                  setBusqueda(q);
                  reiniciarPagina();
                }}
                onSelect={(it) => {
                  setBusqueda(it.label);
                  reiniciarPagina();
                }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {AREAS.map((a) => {
                  const activa = area === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        setArea(a);
                        reiniciarPagina();
                      }}
                      aria-pressed={activa}
                      style={chipEstilo(activa)}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ESTADOS.map((e) => {
                  const activo = estado === e;
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setEstado(e);
                        reiniciarPagina();
                      }}
                      aria-pressed={activo}
                      style={chipEstilo(activo)}
                    >
                      {e === 'Todos' ? 'Todos los estados' : e}
                    </button>
                  );
                })}
              </div>
              {/* 3.3: departamento, localidad, tipo de medio y rango de fechas. */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
                <select value={departamento} onChange={(e) => { setDepartamento(e.target.value); reiniciarPagina(); }} aria-label="Departamento" style={selectEstilo}>
                  <option value="Todos">Todos los departamentos</option>
                  {departamentos.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select value={localidad} onChange={(e) => { setLocalidad(e.target.value); reiniciarPagina(); }} aria-label="Localidad" style={selectEstilo}>
                  <option value="Todas">Todas las localidades</option>
                  {localidades.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <select value={tipoMedio} onChange={(e) => { setTipoMedio(e.target.value); reiniciarPagina(); }} aria-label="Tipo de medio" title="Solo Medios tradicionales: Pauta digital y Audiovisuales no traen tipo de medio en esta vista" style={selectEstilo}>
                  <option value="Todos">Todos los tipos de medio</option>
                  {tiposMedio.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  Fechas
                  <input type="date" value={fechaDesde} onChange={(e) => { setFechaDesde(e.target.value); reiniciarPagina(); }} aria-label="Fecha desde" style={inputFechaEstilo} />
                  hasta
                  <input type="date" value={fechaHasta} onChange={(e) => { setFechaHasta(e.target.value); reiniciarPagina(); }} aria-label="Fecha hasta" style={inputFechaEstilo} />
                </span>
                {hayFiltrosNuevos && (
                  <button type="button" onClick={limpiarFiltrosNuevos} style={enlace}>
                    Limpiar estos filtros
                  </button>
                )}
              </div>
            </FilterBar>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            {/* 3.1: la cifra cuenta filas (área + campaña + localidad), no
                campañas; al lado, las campañas distintas por nombre. */}
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }} title="Una fila es una combinación de área, campaña y localidad (en Medios tradicionales, también por tipo de medio). Una misma campaña aparece en varias filas.">
              {filtrados.length.toLocaleString('es-AR')} fila{filtrados.length === 1 ? '' : 's'} · {cantidadCampanas.toLocaleString('es-AR')} campaña
              {cantidadCampanas === 1 ? '' : 's'} distinta{cantidadCampanas === 1 ? '' : 's'}
            </p>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 999, padding: 3 }}>
              {VISTAS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => {
                    setVista(v.key);
                    reiniciarPagina();
                  }}
                  aria-pressed={vista === v.key}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: 'none',
                    background: vista === v.key ? 'var(--bg-primary)' : 'transparent',
                    color: vista === v.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: vista === v.key ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: vista === v.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {vista === 'detalle' ? (
            <>
              <div
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: 'var(--bg-secondary)' }}>
                      <th style={th}>Área</th>
                      <th style={th}>Campaña</th>
                      <th style={th}>Ámbito</th>
                      <th style={th}>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.slice(0, visibles).map((it, i) => (
                      <CampanaRow key={i} item={it} />
                    ))}
                  </tbody>
                </table>
              </div>

              {visibles < filtrados.length && (
                <button type="button" onClick={() => setVisibles((v) => v + TAMANO_PAGINA)} style={botonMas}>
                  Mostrar más ({(filtrados.length - visibles).toLocaleString('es-AR')} restantes)
                </button>
              )}
            </>
          ) : (
            <>
              <div
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '4px 16px',
                }}
              >
                <div style={{ display: 'flex', gap: 12, padding: '8px 0', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ flex: '1 1 280px' }}>Campaña</span>
                  <span style={{ flex: '0 0 170px' }}>Área</span>
                  <span style={{ flex: '0 0 150px' }}>Estado</span>
                  <span style={{ flex: '0 0 110px' }}>Localidades</span>
                  <span style={{ flex: '0 0 130px' }}>Fechas</span>
                  <span style={{ flex: '0 0 80px' }}>Filas</span>
                </div>
                {grupos.slice(0, visibles).map((g) => (
                  <details key={g.clave} className="desplegable" style={{ borderBottom: '1px solid var(--border)' }}>
                    <summary style={{ gap: 12 }}>
                      <span style={{ flex: '1 1 280px', whiteSpace: 'pre-wrap' }}>{g.campana}</span>
                      <span style={{ flex: '0 0 170px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {g.areas.map((a) => (
                          <span key={a} style={badgeArea}>
                            {a}
                          </span>
                        ))}
                      </span>
                      <span style={{ flex: '0 0 150px', fontWeight: 500, color: 'var(--text-secondary)' }}>{g.estados.join(', ')}</span>
                      <span style={{ flex: '0 0 110px', fontWeight: 500 }}>
                        {g.localidades} localidad{g.localidades === 1 ? '' : 'es'}
                      </span>
                      <span style={{ flex: '0 0 130px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {g.desde || g.hasta ? `${formatearFechaDiaMes(g.desde) || '—'} – ${formatearFechaDiaMes(g.hasta) || '—'}` : '—'}
                      </span>
                      <span style={{ flex: '0 0 80px', fontWeight: 500, color: 'var(--text-secondary)' }}>{g.filas.length}</span>
                    </summary>
                    <FilasDeGrupo filas={g.filas} />
                  </details>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                Localidades: distintas entre las filas de la campaña. Fechas: la más temprana y la más tardía de sus filas (Pauta digital solo
                tiene fecha de finalización). Filas: cuántas filas de la vista Detalle agrupa.
              </p>
              {visibles < grupos.length && (
                <button type="button" onClick={() => setVisibles((v) => v + TAMANO_PAGINA)} style={botonMas}>
                  Mostrar más ({(grupos.length - visibles).toLocaleString('es-AR')} campañas restantes)
                </button>
              )}
            </>
          )}
        </>
      )}
    </Layout>
  );
}

/** Filas de una campaña dentro de la vista agrupada, de a 50: una campaña
 * provincial puede tener miles de filas (Comunicación Institucional, 3.872) y
 * dibujarlas todas de golpe cuelga el navegador. */
function FilasDeGrupo({ filas }) {
  const [visibles, setVisibles] = useState(TAMANO_PAGINA);
  return (
    <div className="tabla-desplazable" style={{ margin: '4px 0 10px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', background: 'var(--bg-secondary)' }}>
            <th style={th}>Área</th>
            <th style={th}>Campaña</th>
            <th style={th}>Ámbito</th>
            <th style={th}>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {filas.slice(0, visibles).map((it, i) => (
            <CampanaRow key={i} item={it} />
          ))}
        </tbody>
      </table>
      {visibles < filas.length && (
        <button type="button" onClick={() => setVisibles((v) => v + TAMANO_PAGINA)} style={{ ...botonMas, marginTop: 10 }}>
          Mostrar más ({(filas.length - visibles).toLocaleString('es-AR')} filas restantes de esta campaña)
        </button>
      )}
    </div>
  );
}

function chipEstilo(activo) {
  return {
    padding: '8px 14px',
    borderRadius: 999,
    border: `1.5px solid ${activo ? 'var(--accent)' : 'var(--border)'}`,
    background: activo ? 'var(--accent-bg)' : 'var(--bg-secondary)',
    color: activo ? 'var(--accent)' : 'var(--text-secondary)',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

const th = { padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 };
const selectEstilo = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 13,
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  maxWidth: 240,
};
const inputFechaEstilo = {
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 12.5,
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
};
const enlace = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  fontSize: 13,
  color: 'var(--accent)',
  cursor: 'pointer',
  textDecoration: 'underline',
};
const botonMas = {
  marginTop: 16,
  padding: '10px 20px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-primary)',
  cursor: 'pointer',
  fontSize: 13.5,
};
const badgeArea = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)',
  fontSize: 11.5,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};
