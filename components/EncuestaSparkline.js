import { useState } from 'react';
import { formatearFechaCorta } from '../lib/fechas';

// Sparkline SVG a mano (sin librerías de charts), curva suave vía spline de
// Catmull-Rom convertida a segmentos Bezier cúbicos (factor 1/6, la
// conversión estándar). Con exactamente 2 puntos se dibuja una recta lisa y
// lisa nomás -> con 2 rondas es una recta, no es un bug, no hay que
// disimularlo (pedido explícito del usuario).
const ANCHO = 240;
const ALTO = 56;
const PAD_X = 6;
const PAD_Y = 8;

function construirPuntos(serie) {
  const n = serie.length;
  return serie.map((s, i) => ({
    x: PAD_X + (n > 1 ? (i / (n - 1)) * (ANCHO - PAD_X * 2) : (ANCHO - PAD_X * 2) / 2),
    y: PAD_Y + (1 - s.valor / 100) * (ALTO - PAD_Y * 2),
    fecha: s.fecha,
    valor: s.valor,
  }));
}

function trazarCurva(puntos) {
  if (puntos.length < 2) return '';
  if (puntos.length === 2) {
    return `M ${puntos[0].x} ${puntos[0].y} L ${puntos[1].x} ${puntos[1].y}`;
  }
  let d = `M ${puntos[0].x} ${puntos[0].y}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] || puntos[i];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[i + 2] || puntos[i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** serie: [{fecha, valor}] (valor en %, 0-100), ya en orden ascendente de
 * fecha real de aparición (no necesariamente todas las rondas). */
export default function EncuestaSparkline({ serie, color = 'var(--accent)' }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const puntos = construirPuntos(serie);
  const d = trazarCurva(puntos);
  const activo = hoverIdx != null ? puntos[hoverIdx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        height={ALTO}
        style={{ display: 'block', overflow: 'visible' }}
        role="img"
        aria-label="Evolución a través de las rondas"
      >
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {puntos.map((p, i) => (
          <circle
            key={p.fecha}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === i ? 4.5 : 3}
            fill={color}
            stroke="var(--bg-primary)"
            strokeWidth={1.5}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx((h) => (h === i ? null : h))}
          />
        ))}
      </svg>
      {activo && (
        <div
          style={{
            position: 'absolute',
            left: `${(activo.x / ANCHO) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -100%)',
            marginTop: -4,
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 7px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          {formatearFechaCorta(activo.fecha)} · {activo.valor}%
        </div>
      )}
    </div>
  );
}
