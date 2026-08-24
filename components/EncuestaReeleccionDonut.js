// "Reelección" (Tipo_Pregunta=Reeleccion, categorías Si/No) -> un donut por
// clave presente en la ronda (puede ser 1 o más, no se asume que son
// siempre exactamente 2 — ver reporte). Sí en verde, No en rojo.
const R = 42;
const STROKE = 14;
const CIRCUNFERENCIA = 2 * Math.PI * R;

export default function EncuestaReeleccionDonut({ etiqueta, categorias }) {
  const si = categorias?.Si ?? 0;
  const largoSi = (si / 100) * CIRCUNFERENCIA;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 140 }}>
      <svg viewBox="0 0 100 100" width={110} height={110} role="img" aria-label={`${etiqueta}: ${si}% Sí`}>
        <circle cx={50} cy={50} r={R} fill="none" stroke="#EF4444" strokeWidth={STROKE} />
        <circle
          cx={50}
          cy={50}
          r={R}
          fill="none"
          stroke="#22C55E"
          strokeWidth={STROKE}
          strokeDasharray={`${largoSi} ${CIRCUNFERENCIA - largoSi}`}
          strokeLinecap={largoSi > 0 && largoSi < CIRCUNFERENCIA ? 'butt' : 'round'}
          transform="rotate(-90 50 50)"
        />
        <text x={50} y={50} textAnchor="middle" dominantBaseline="middle" fontSize={18} fontWeight={700}>
          {si}%
        </text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{etiqueta}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sí a la reelección</div>
    </div>
  );
}
