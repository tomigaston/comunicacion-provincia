import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import FilterBar from '../components/FilterBar';
import Autocomplete from '../components/Autocomplete';
import StatusBadge from '../components/StatusBadge';
import FiltroPeriodo from '../components/FiltroPeriodo';
import VerMaterial from '../components/VerMaterial';
import { useApiData } from '../lib/useApiData';
import { normalizarTexto } from '../lib/texto';
import { formatearFechaCorta, calcularVentana, rangoDentroDeVentana } from '../lib/fechas';

const PERIODO_DEFAULT = { tipo: 'preset', valor: 'ultimo_mes' };

// Localidad/Departamento/Provincia: mismo eje de ámbito que Medios
// tradicionales y Audiovisuales (antes era un filtro de 9 buckets crudos del
// excel viejo). Se filtra por alcance_tipo (ya normalizado en
// generar_datos.py), no por alcance_detectado — así agrupa también las
// piezas históricas de Capital (bucket "CAPITAL") dentro de "Localidad".
const AMBITOS = [
  { key: 'localidad', label: 'Localidad puntual' },
  { key: 'departamento', label: 'Departamento' },
  { key: 'provincia', label: 'Provincia entera' },
];

function ambitoLabel(p) {
  if (p.alcance_tipo === 'provincia') return 'Toda la provincia';
  if (p.alcance_tipo === 'departamento') return `Depto. ${p.departamento}`;
  if (p.alcance_tipo === 'localidad') return 'Localidad';
  return AMBITOS.find((a) => a.key === p.alcance_tipo)?.label || p.alcance_detectado || '—';
}

const ESTADOS = ['Todas', 'Vigente', 'Finalizada'];
const TAMANO_PAGINA = 50;

function valorDeOrden(pieza, campo) {
  const v = pieza[campo];
  return typeof v === 'number' ? v : v || '';
}

export default function PautaDigital() {
  const { cargando, error, datos } = useApiData(['/api/data/pauta-digital']);
  const [ambitos, setAmbitos] = useState(new Set());
  const [estado, setEstado] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');
  const [periodo, setPeriodo] = useState(PERIODO_DEFAULT);
  const [orden, setOrden] = useState({ campo: 'finalizacion', direccion: 'desc' });
  const [visibles, setVisibles] = useState(TAMANO_PAGINA);

  const piezas = datos ? datos[0].piezas : [];
  const ventana = useMemo(() => calcularVentana(periodo), [periodo]);
  const fechasDisponibles = useMemo(() => piezas.map((p) => p.finalizacion), [piezas]);

  const itemsBusqueda = useMemo(() => {
    const vistos = new Set();
    const salida = [];
    for (const p of piezas) {
      const clave = normalizarTexto(p.campana);
      if (!p.campana || vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push({ value: clave, label: p.campana, sublabel: p.area_tematica });
    }
    return salida;
  }, [piezas]);

  const filtradas = useMemo(() => {
    const q = normalizarTexto(busqueda);
    let salida = piezas.filter((p) => {
      if (!rangoDentroDeVentana(p.inicio, p.finalizacion, ventana)) return false;
      if (ambitos.size > 0 && !ambitos.has(p.alcance_tipo)) return false;
      if (estado !== 'Todas' && p.estado !== estado) return false;
      if (!q) return true;
      return (
        normalizarTexto(p.campana).includes(q) ||
        normalizarTexto(p.localidad).includes(q) ||
        normalizarTexto(p.departamento).includes(q)
      );
    });
    salida = [...salida].sort((a, b) => {
      const va = valorDeOrden(a, orden.campo);
      const vb = valorDeOrden(b, orden.campo);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return orden.direccion === 'asc' ? cmp : -cmp;
    });
    return salida;
  }, [piezas, ventana, ambitos, estado, busqueda, orden]);

  function alternarAmbito(key) {
    setAmbitos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(key)) nuevo.delete(key);
      else nuevo.add(key);
      return nuevo;
    });
    setVisibles(TAMANO_PAGINA);
  }

  function ordenarPor(campo) {
    setOrden((actual) =>
      actual.campo === campo
        ? { campo, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' }
        : { campo, direccion: 'desc' }
    );
  }

  function encabezado(campo, etiqueta) {
    const activo = orden.campo === campo;
    return (
      <th
        style={{ ...th, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => ordenarPor(campo)}
        title="Ordenar"
      >
        {etiqueta} {activo ? (orden.direccion === 'asc' ? '▲' : '▼') : ''}
      </th>
    );
  }

  return (
    <Layout title="Pauta Digital">
      {cargando && <p>Cargando datos del tablero...</p>}
      {error && <p style={{ color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>}

      {datos && (
        <>
          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '14px 18px',
              marginBottom: 16,
            }}
          >
            <FiltroPeriodo periodo={periodo} onChange={setPeriodo} fechasDisponibles={fechasDisponibles} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <FilterBar>
              <Autocomplete
                items={itemsBusqueda}
                placeholder="Buscar campaña, localidad o departamento..."
                onQueryChange={(q) => {
                  setBusqueda(q);
                  setVisibles(TAMANO_PAGINA);
                }}
                onSelect={(it) => setBusqueda(it.label)}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                {ESTADOS.map((e) => {
                  const activo = estado === e;
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setEstado(e);
                        setVisibles(TAMANO_PAGINA);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 999,
                        border: `1.5px solid ${activo ? 'var(--accent)' : 'var(--border)'}`,
                        background: activo ? '#e0edfb' : 'var(--bg-secondary)',
                        color: activo ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {e}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {AMBITOS.map((a) => {
                  const activo = ambitos.has(a.key);
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => alternarAmbito(a.key)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: 999,
                        border: `1.5px solid ${activo ? 'var(--accent)' : 'var(--border)'}`,
                        background: activo ? '#e0edfb' : 'var(--bg-secondary)',
                        color: activo ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </FilterBar>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {filtradas.length} de {piezas.length} piezas de pauta digital
            {filtradas.length === 0 && piezas.length > 0 && ' — probá un período más amplio o "Todo"'}
          </p>

          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--bg-secondary)' }}>
                  <th style={th}>Campaña</th>
                  <th style={th}>Área temática</th>
                  <th style={th}>Ámbito</th>
                  <th style={th}>Localidad / Depto.</th>
                  <th style={th}>Plataforma</th>
                  <th style={th}>Estado</th>
                  {encabezado('fecha_creacion', 'Creación')}
                  {encabezado('finalizacion', 'Finalización')}
                  {encabezado('alcance', 'Alcance')}
                  <th style={th}>Material</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(0, visibles).map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...td, maxWidth: 320 }}>{p.campana}</td>
                    <td style={td}>{p.area_tematica || '—'}</td>
                    <td style={td}>{ambitoLabel(p)}</td>
                    <td style={td}>{p.localidad || p.departamento || '—'}</td>
                    <td style={td}>{p.plataforma || '—'}</td>
                    <td style={td}>
                      <StatusBadge estado={p.estado} />
                    </td>
                    <td style={td}>{formatearFechaCorta(p.fecha_creacion) || '—'}</td>
                    <td style={td}>{formatearFechaCorta(p.finalizacion) || '—'}</td>
                    <td style={td}>{p.alcance ? p.alcance.toLocaleString('es-AR') : '—'}</td>
                    <td style={td}>
                      <VerMaterial links={p.links_material} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibles < filtradas.length && (
            <button
              type="button"
              onClick={() => setVisibles((v) => v + TAMANO_PAGINA)}
              style={{
                marginTop: 16,
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                cursor: 'pointer',
                fontSize: 13.5,
              }}
            >
              Mostrar más ({filtradas.length - visibles} restantes)
            </button>
          )}
        </>
      )}
    </Layout>
  );
}

const th = { padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 };
const td = { padding: '10px 14px', fontSize: 13.5 };
