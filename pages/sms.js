import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import FilterBar from '../components/FilterBar';
import Autocomplete from '../components/Autocomplete';
import FiltroPeriodo from '../components/FiltroPeriodo';
import { useApiData } from '../lib/useApiData';
import { normalizarTexto } from '../lib/texto';
import { formatearFechaCorta, calcularVentana, fechaDentroDeVentana } from '../lib/fechas';

const PERIODO_DEFAULT = { tipo: 'preset', valor: 'ultimo_mes' };
const TAMANO_PAGINA = 50;

// Desde el cambio de regla del 22/08/2026 ya no existe ningún alcance de
// tipo Departamento (ver CONTEXTO 3.4) -> el único ámbito posible con lugar
// es "Localidad". Se mantiene igual un segundo estado, "Sin desagregar",
// para las filas cuya única fuente geográfica (ZONA/AUDIENCIA) no matcheó
// ninguna de las 60 (ver sin_desagregacion_geografica en generar_datos.py).
// Esas filas siguen contando para los totales generales pero no tienen
// "Localidad".
const AMBITOS = [
  { key: 'localidad', label: 'Localidad' },
  { key: 'sin_desagregar', label: 'Sin desagregar' },
];

function ambitoLabel(key) {
  return AMBITOS.find((a) => a.key === key)?.label || key;
}

/**
 * Un envío de SMS puede tener varios "alcances" en AUDIENCIA (ej. La
 * Carlota + Laboulaye). Acá se explota cada envío en una fila por alcance
 * -para poder filtrar/ordenar directo por localidad- conservando el índice
 * del envío de origen (envioIndex) para poder deduplicar
 * cantidad_sms_entregados en los totales: esa cantidad vive a nivel del
 * envío completo, no se reparte entre sus alcances (regla de negocio
 * confirmada, ver CONTEXTO_PROYECTO_TABLERO_COMUNICACION.md 3.4), así que
 * sumar directo las filas visibles triplicaría un envío con 3 lugares.
 *
 * Todo alcance es de tipo "localidad" (ya no existe "departamento", cambio
 * de regla del 22/08/2026) -> "ambito" solo distingue si la fila tiene una
 * localidad puntual o quedó sin desagregación geográfica.
 */
function explotarEnFilas(envios) {
  const filas = [];
  envios.forEach((e, envioIndex) => {
    const base = {
      envioIndex,
      fecha_inicio: e.fecha_inicio,
      eje: e.eje,
      tematica: e.tematica,
      categoria: e.categoria,
      mensaje: e.mensaje,
      estado: e.estado,
      cantidad_sms_entregados: e.cantidad_sms_entregados,
    };
    const alcances = e.alcances || [];
    if (e.sin_desagregacion_geografica || alcances.length === 0) {
      filas.push({ ...base, ambito: 'sin_desagregar', lugar: null });
    } else {
      alcances.forEach((a) => {
        filas.push({ ...base, ambito: 'localidad', lugar: a.localidad });
      });
    }
  });
  return filas;
}

export default function Sms() {
  const { cargando, error, datos } = useApiData(['/api/data/sms']);
  const [ambitos, setAmbitos] = useState(new Set());
  const [eje, setEje] = useState('Todos');
  const [busquedaTematica, setBusquedaTematica] = useState('');
  const [estado, setEstado] = useState('Todos');
  const [busquedaLugar, setBusquedaLugar] = useState('');
  const [periodo, setPeriodo] = useState(PERIODO_DEFAULT);
  const [visibles, setVisibles] = useState(TAMANO_PAGINA);

  const envios = datos ? datos[0].envios : [];
  const filas = useMemo(() => explotarEnFilas(envios), [envios]);

  const ventana = useMemo(() => calcularVentana(periodo), [periodo]);
  const fechasDisponibles = useMemo(() => envios.map((e) => e.fecha_inicio), [envios]);

  // Vocabularios de filtro generados de los datos reales -nunca hardcodeados-
  // porque Eje/Temática/Estado son texto libre de la fuente, a diferencia de
  // Ámbito que sí es un eje fijo de 2 valores conocidos (AMBITOS arriba).
  const ejes = useMemo(
    () => Array.from(new Set(envios.map((e) => e.eje).filter(Boolean))).sort(),
    [envios]
  );
  const tematicas = useMemo(
    () => Array.from(new Set(envios.map((e) => e.tematica).filter(Boolean))).sort(),
    [envios]
  );
  const estados = useMemo(
    () => Array.from(new Set(envios.map((e) => e.estado).filter(Boolean))).sort(),
    [envios]
  );
  const itemsTematicas = useMemo(() => tematicas.map((t) => ({ value: t, label: t })), [tematicas]);

  const itemsLugares = useMemo(() => {
    const vistos = new Set();
    const salida = [];
    for (const f of filas) {
      if (!f.lugar) continue;
      const clave = normalizarTexto(f.lugar);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push({ value: clave, label: f.lugar, sublabel: ambitoLabel(f.ambito) });
    }
    return salida.sort((a, b) => a.label.localeCompare(b.label));
  }, [filas]);

  const filtradas = useMemo(() => {
    const qLugar = normalizarTexto(busquedaLugar);
    const qTematica = normalizarTexto(busquedaTematica);
    return filas.filter((f) => {
      if (!fechaDentroDeVentana(f.fecha_inicio, ventana)) return false;
      if (ambitos.size > 0 && !ambitos.has(f.ambito)) return false;
      if (eje !== 'Todos' && f.eje !== eje) return false;
      if (qTematica && !normalizarTexto(f.tematica || '').includes(qTematica)) return false;
      if (estado !== 'Todos' && f.estado !== estado) return false;
      if (qLugar && !normalizarTexto(f.lugar || '').includes(qLugar)) return false;
      return true;
    });
  }, [filas, ventana, ambitos, eje, busquedaTematica, estado, busquedaLugar]);

  // KPI dedup: cada envío único aporta su cantidad_sms_entregados una sola
  // vez, sin importar cuántas filas (alcances) tenga visibles -ver comentario
  // de explotarEnFilas().
  const { totalEntregados, enviosUnicos } = useMemo(() => {
    const vistos = new Set();
    let total = 0;
    for (const f of filtradas) {
      if (vistos.has(f.envioIndex)) continue;
      vistos.add(f.envioIndex);
      if (typeof f.cantidad_sms_entregados === 'number') total += f.cantidad_sms_entregados;
    }
    return { totalEntregados: total, enviosUnicos: vistos.size };
  }, [filtradas]);

  function alternarAmbito(key) {
    setAmbitos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(key)) nuevo.delete(key);
      else nuevo.add(key);
      return nuevo;
    });
    setVisibles(TAMANO_PAGINA);
  }

  return (
    <Layout title="SMS">
      {cargando && <p>Cargando datos del tablero...</p>}
      {error && <p style={{ color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>}

      {datos && envios.length === 0 && (
        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
          Todavía no se cargó ningún export de SMS.
        </p>
      )}

      {datos && envios.length > 0 && (
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
                items={itemsLugares}
                placeholder="Buscar localidad..."
                onQueryChange={(q) => {
                  setBusquedaLugar(q);
                  setVisibles(TAMANO_PAGINA);
                }}
                onSelect={(it) => setBusquedaLugar(it.label)}
              />
              <select
                value={eje}
                onChange={(e) => {
                  setEje(e.target.value);
                  setVisibles(TAMANO_PAGINA);
                }}
                style={selectEstilo}
              >
                <option value="Todos">Todos los ejes</option>
                {ejes.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <Autocomplete
                items={itemsTematicas}
                placeholder="Buscar temática..."
                onQueryChange={(q) => {
                  setBusquedaTematica(q);
                  setVisibles(TAMANO_PAGINA);
                }}
                onSelect={(it) => {
                  setBusquedaTematica(it.label);
                  setVisibles(TAMANO_PAGINA);
                }}
              />
              <select
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value);
                  setVisibles(TAMANO_PAGINA);
                }}
                style={selectEstilo}
              >
                <option value="Todos">Todos los estados</option>
                {estados.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
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

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {filtradas.length} fila{filtradas.length === 1 ? '' : 's'} · {enviosUnicos} envío
            {enviosUnicos === 1 ? '' : 's'} único{enviosUnicos === 1 ? '' : 's'} ·{' '}
            {totalEntregados.toLocaleString('es-AR')} SMS entregados
            {filtradas.length === 0 && filas.length > 0 && ' — probá un período más amplio o "Todo"'}
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Un envío con varios lugares en su alcance aparece repetido, una fila por lugar — el total
            de SMS entregados ya está sumado una sola vez por envío, no por fila.
          </p>

          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 840 }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--bg-secondary)' }}>
                  <th style={th}>Fecha de inicio</th>
                  <th style={th}>Eje</th>
                  <th style={th}>Categoría</th>
                  <th style={{ ...th, minWidth: 260 }}>Mensaje</th>
                  <th style={th}>Localidad</th>
                  <th style={th}>SMS entregados</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(0, visibles).map((f, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={td}>{formatearFechaCorta(f.fecha_inicio) || '—'}</td>
                    <td style={td}>{f.eje || '—'}</td>
                    <td style={td}>{f.categoria || '—'}</td>
                    <td style={{ ...td, maxWidth: 380, whiteSpace: 'pre-wrap' }}>{f.mensaje || '—'}</td>
                    <td style={td}>{f.lugar || '—'}</td>
                    <td style={td}>
                      {typeof f.cantidad_sms_entregados === 'number'
                        ? f.cantidad_sms_entregados.toLocaleString('es-AR')
                        : '—'}
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
const selectEstilo = {
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 13,
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
};
