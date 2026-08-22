import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import FilterBar from '../components/FilterBar';
import Autocomplete from '../components/Autocomplete';
import FiltroPeriodo from '../components/FiltroPeriodo';
import VerMaterial from '../components/VerMaterial';
import { useApiData } from '../lib/useApiData';
import { normalizarTexto } from '../lib/texto';
import { formatearFechaCorta, calcularVentana, fechaDentroDeVentana } from '../lib/fechas';

const PERIODO_DEFAULT = { tipo: 'preset', valor: 'ultimo_mes' };
const TAMANO_PAGINA = 50;
const TODA_LA_PROVINCIA_LABEL = 'Toda la provincia';

/**
 * Una publicación puede tener varias localidades resueltas en LUGAR (ej.
 * "Carlos Paz, Malagueño") -> se explota en una fila por lugar, para poder
 * filtrar/ordenar directo por Localidad (mismo patrón que SMS, ver
 * pages/sms.js). A diferencia de SMS acá no hay ninguna cantidad numérica que
 * sumar por publicación -no hay riesgo de inflar un KPI al repetir filas-,
 * así que no hace falta conservar un índice para deduplicar nada; se guarda
 * igual (pubIndex) solo para el conteo de "publicaciones únicas" del resumen.
 *
 * Una publicación sin ninguna localidad resuelta y sin ámbito provincial no
 * genera ninguna fila -> no entra al tablero (mismo criterio que el resto
 * del proyecto, ver CONTEXTO_PROYECTO_TABLERO_COMUNICACION.md 3.5: sin match
 * a las 60 ni a "toda la provincia", afuera, invisible, sin excepción). No
 * se muestra con Lugar vacío ni se cuenta en ningún total de esta vista.
 */
function explotarEnFilas(publicaciones) {
  const filas = [];
  publicaciones.forEach((p, pubIndex) => {
    const base = {
      pubIndex,
      fecha: p.fecha,
      red_social: p.red_social,
      nombre_contenido: p.nombre_contenido,
      link: p.link,
    };
    const localidades = p.localidades || [];
    localidades.forEach((l) => filas.push({ ...base, lugar: l }));
    if (p.ambito_provincial) {
      filas.push({ ...base, lugar: TODA_LA_PROVINCIA_LABEL });
    }
  });
  return filas;
}

export default function ContenidoOrganico() {
  const { cargando, error, datos } = useApiData(['/api/data/contenido-organico']);
  const [busquedaLugar, setBusquedaLugar] = useState('');
  const [periodo, setPeriodo] = useState(PERIODO_DEFAULT);
  const [visibles, setVisibles] = useState(TAMANO_PAGINA);

  const publicaciones = datos ? datos[0].publicaciones : [];
  const filas = useMemo(() => explotarEnFilas(publicaciones), [publicaciones]);

  const ventana = useMemo(() => calcularVentana(periodo), [periodo]);
  const fechasDisponibles = useMemo(() => publicaciones.map((p) => p.fecha), [publicaciones]);

  const itemsLugares = useMemo(() => {
    const vistos = new Set();
    const salida = [];
    for (const f of filas) {
      if (!f.lugar) continue;
      const clave = normalizarTexto(f.lugar);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push({ value: clave, label: f.lugar });
    }
    return salida.sort((a, b) => a.label.localeCompare(b.label));
  }, [filas]);

  const filtradas = useMemo(() => {
    const qLugar = normalizarTexto(busquedaLugar);
    return filas.filter((f) => {
      if (!fechaDentroDeVentana(f.fecha, ventana)) return false;
      if (qLugar && !normalizarTexto(f.lugar || '').includes(qLugar)) return false;
      return true;
    });
  }, [filas, ventana, busquedaLugar]);

  const publicacionesUnicas = useMemo(() => new Set(filtradas.map((f) => f.pubIndex)).size, [filtradas]);

  return (
    <Layout title="Contenido Orgánico">
      {cargando && <p>Cargando datos del tablero...</p>}
      {error && <p style={{ color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>}

      {datos && publicaciones.length === 0 && (
        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
          Todavía no se cargó ningún export de Contenido Orgánico.
        </p>
      )}

      {datos && publicaciones.length > 0 && (
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
            </FilterBar>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {filtradas.length} fila{filtradas.length === 1 ? '' : 's'} · {publicacionesUnicas} publicación
            {publicacionesUnicas === 1 ? '' : 'es'} única{publicacionesUnicas === 1 ? '' : 's'}
            {filtradas.length === 0 && filas.length > 0 && ' — probá un período más amplio o "Todo"'}
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Una publicación con varias localidades en su alcance aparece repetida, una fila por
            localidad. El dato de Lugar solo está cargado desde el 29/07/2026 — una publicación sin
            ninguna localidad resuelta ni ámbito provincial no entra a esta vista.
          </p>

          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--bg-secondary)' }}>
                  <th style={th}>Fecha</th>
                  <th style={th}>Red Social</th>
                  <th style={{ ...th, minWidth: 260 }}>Nombre del contenido</th>
                  <th style={th}>Lugar</th>
                  <th style={th}>Link</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(0, visibles).map((f, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={td}>{formatearFechaCorta(f.fecha) || '—'}</td>
                    <td style={td}>{f.red_social || '—'}</td>
                    <td style={td}>{f.nombre_contenido || '—'}</td>
                    <td style={td}>{f.lugar || '—'}</td>
                    <td style={td}>
                      <VerMaterial links={f.link ? [f.link] : []} />
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
