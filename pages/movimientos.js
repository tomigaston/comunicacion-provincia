import Layout from '../components/Layout';
import KpiTile from '../components/KpiTile';
import { useApiData } from '../lib/useApiData';
import { formatearFechaCorta } from '../lib/fechas';

export default function Movimientos() {
  const { cargando, error, datos } = useApiData(['/api/data/movimientos']);
  const movimientos = datos ? datos[0] : null;

  // Semana comparada: las fechas ya vienen en cada fila del JSON
  // (fecha_semana_anterior / fecha_semana_actual); se toman de la primera.
  const primerCambio = movimientos && movimientos.cambios.length > 0 ? movimientos.cambios[0] : null;
  const semana =
    primerCambio && primerCambio.fecha_semana_anterior && primerCambio.fecha_semana_actual
      ? `${formatearFechaCorta(primerCambio.fecha_semana_anterior)} → ${formatearFechaCorta(primerCambio.fecha_semana_actual)}`
      : null;

  return (
    <Layout title="Movimientos de la semana">
      {cargando && <p>Cargando datos del tablero...</p>}
      {error && <p style={{ color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>}

      {movimientos && (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.2, marginBottom: 4 }}>Movimientos de la semana</h1>
          {semana && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Comparación entre las cargas del {semana}.
            </p>
          )}
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

const th = { padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 };
const td = { padding: '8px 12px', fontSize: 13 };
