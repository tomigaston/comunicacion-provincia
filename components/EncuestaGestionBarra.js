import { useId } from 'react';
import { ORDEN_GRUPOS_GESTION, COLOR_GRUPO_GESTION, agruparGestion } from '../lib/encuestasLocalidades';

// "Calificación de gestión" (Tipo_Pregunta=Imagen_Funcionario, clave
// "Gestión del X") -> barra apilada de 4 categorías (Positiva/Regular/
// Negativa/Ns-Nc). OJO: esto NO es "Aprobación de gestión" (ver
// EncuestaAprobacionGauge.js) — son preguntas distintas de la fuente.
const ANCHO = 400;
const ALTO = 28;

export default function EncuestaGestionBarra({ etiqueta, categorias }) {
  const clipId = useId();
  const grupos = agruparGestion(categorias);
  const total = grupos.reduce((acc, g) => acc + g.pct, 0);
  if (total <= 0) return null;

  let acumulado = 0;
  const segmentos = grupos
    .map((g) => {
      const ancho = (g.pct / 100) * ANCHO;
      const seg = { ...g, x: acumulado, ancho };
      acumulado += ancho;
      return seg;
    })
    .filter((s) => s.ancho > 0);

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{etiqueta}</div>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} width="100%" height={ALTO} style={{ display: 'block' }}>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={ANCHO} height={ALTO} rx={6} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          {segmentos.map((s) => (
            <rect key={s.grupo} x={s.x} y={0} width={s.ancho} height={ALTO} fill={COLOR_GRUPO_GESTION[s.grupo]} />
          ))}
        </g>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        {/* Con porcentaje en la leyenda (decisión explícita del usuario,
            prioridad sobre la spec heredada de tablero-electoral que la
            sacaba): "Gestión del X" y "Regular" 32%", etc. */}
        {grupos.map(({ grupo, pct }) => (
          <span
            key={grupo}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: COLOR_GRUPO_GESTION[grupo],
                display: 'inline-block',
              }}
            />
            {grupo} {pct}%
          </span>
        ))}
      </div>
    </div>
  );
}
