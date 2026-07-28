import Layout from '../components/Layout';
import KpiTile from '../components/KpiTile';
import { useApiData } from '../lib/useApiData';

export default function Movimientos() {
  const { cargando, error, datos } = useApiData(['/api/data/movimientos']);
  const movimientos = datos ? datos[0] : null;

  return (
    <Layout title="Movimientos de la semana">
      {cargando && <p>Cargando datos del tablero...</p>}
      {error && <p style={{ color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>}

      {movimientos && (
        <>
          <div style={{ marginBottom: 20 }}>
            <KpiTile
              valor={movimientos.total_avisos_cambiaron}
              etiqueta="avisos cambiaron de tema esta semana"
              subtitulo="Medios tradicionales — un aviso es una combinación de localidad y tipo de medio (TV, radio, etc.)"
            />
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            Por ahora este seguimiento es solo de Medios tradicionales. Pauta digital y
            Audiovisuales todavía no están incluidas en esta vista.
          </p>

          {movimientos.cambios.length === 0 ? (
            <p style={{ fontSize: 14 }}>No hubo cambios de tema esta semana.</p>
          ) : (
            <div
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: 'var(--bg-secondary)' }}>
                    <th style={th}>Localidad</th>
                    <th style={th}>Departamento</th>
                    <th style={th}>Tipo de medio</th>
                    <th style={th}>Tema anterior</th>
                    <th style={th}>Tema actual</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.cambios.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={td}>{c.localidad}</td>
                      <td style={td}>{c.departamento}</td>
                      <td style={td}>{c.tipo_medio}</td>
                      <td style={{ ...td, whiteSpace: 'pre-wrap', color: 'var(--text-tertiary)' }}>{c.tema_anterior}</td>
                      <td style={{ ...td, whiteSpace: 'pre-wrap' }}>{c.tema_actual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

const th = { padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 };
const td = { padding: '10px 14px', fontSize: 13.5 };
