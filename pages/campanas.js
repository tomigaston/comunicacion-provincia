import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import FilterBar from '../components/FilterBar';
import Autocomplete from '../components/Autocomplete';
import CampanaRow from '../components/CampanaRow';
import { useApiData } from '../lib/useApiData';
import { normalizarTexto } from '../lib/texto';

const AREAS = ['Todas', 'Medios tradicionales', 'Pauta digital', 'Audiovisuales'];
const TAMANO_PAGINA = 50;

export default function Campanas() {
  const { cargando, error, datos } = useApiData(['/api/data/campanas']);
  const [area, setArea] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');
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

  const filtrados = useMemo(() => {
    const q = normalizarTexto(busqueda);
    return items.filter((it) => {
      if (area !== 'Todas' && it.area_origen !== area) return false;
      if (!q) return true;
      return (
        normalizarTexto(it.campana).includes(q) ||
        normalizarTexto(it.localidad).includes(q) ||
        normalizarTexto(it.departamento).includes(q)
      );
    });
  }, [items, area, busqueda]);

  return (
    <Layout title="Campañas">
      {cargando && <p>Cargando datos del tablero...</p>}
      {error && <p style={{ color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>}

      {datos && (
        <>
          <div style={{ marginBottom: 20 }}>
            <FilterBar>
              <Autocomplete
                items={itemsBusqueda}
                placeholder="Buscar campaña, localidad o departamento..."
                onQueryChange={(q) => {
                  setBusqueda(q);
                  setVisibles(TAMANO_PAGINA);
                }}
                onSelect={(it) => {
                  setBusqueda(it.label);
                  setVisibles(TAMANO_PAGINA);
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
                        setVisibles(TAMANO_PAGINA);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 999,
                        border: `1.5px solid ${activa ? 'var(--accent)' : 'var(--border)'}`,
                        background: activa ? '#e0edfb' : 'var(--bg-secondary)',
                        color: activa ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
            </FilterBar>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {filtrados.length} campañas encontradas
          </p>

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
              Mostrar más ({filtrados.length - visibles} restantes)
            </button>
          )}
        </>
      )}
    </Layout>
  );
}

const th = { padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 };
