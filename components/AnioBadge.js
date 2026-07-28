import { anioDe, formatearFechaCorta } from '../lib/fechas';

/**
 * Antigüedad a simple vista para piezas de Audiovisuales: badge de año
 * (destacado si es el año en curso, gris si es anterior) + el rango de
 * fechas completo al lado. Si no hay fecha_inicio ni fecha_fin, se muestra
 * "Sin fecha" explícito — nunca se inventa ni se completa en silencio.
 */
export default function AnioBadge({ fechaInicio, fechaFin }) {
  const anio = anioDe(fechaFin) ?? anioDe(fechaInicio);

  if (!anio) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '3px 10px',
          borderRadius: 999,
          fontSize: 12.5,
          fontWeight: 600,
          background: 'var(--bg-secondary)',
          color: 'var(--text-tertiary)',
        }}
      >
        Sin fecha
      </span>
    );
  }

  const anioActual = new Date().getFullYear();
  const destacado = anio >= anioActual;
  const rango =
    fechaInicio && fechaFin
      ? `${formatearFechaCorta(fechaInicio)} – ${formatearFechaCorta(fechaFin)}`
      : formatearFechaCorta(fechaFin || fechaInicio);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
      <span
        style={{
          padding: '3px 10px',
          borderRadius: 999,
          fontSize: 12.5,
          fontWeight: 700,
          background: destacado ? 'var(--cov-alta-bg)' : 'var(--bg-secondary)',
          color: destacado ? 'var(--cov-alta)' : 'var(--text-tertiary)',
        }}
      >
        {anio}
      </span>
      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{rango}</span>
    </span>
  );
}
