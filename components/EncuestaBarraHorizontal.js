// Barra horizontal genérica, texto blanco dentro del relleno. SVG a mano
// (sin librerías de charts), mismo criterio que el resto del proyecto.
//
// Generalización de lo que en 3a era EncuestaBarraProblemas.js (dict
// {Categoria_Respuesta: pct} de "Principales problemas"): acá recibe
// directamente `items: [{label, pct}]` para poder reusarse tal cual en
// Obras (categorías por pregunta de cada obra), Candidatos (array ya
// ordenado por pct, no un dict) y Otra — mismo estilo visual en las 4,
// mismo componente. El único caller de la vuelta anterior
// (EncuestaResumenRonda, sección "Principales problemas") ahora arma
// `items` a partir del dict de categorías antes de pasarlo acá.
//
// Nota: con porcentajes muy chicos (pocos puntos) el relleno puede quedar
// más angosto que el texto -> el texto blanco se sale del relleno sobre el
// fondo claro y pierde contraste. Es un caso de borde cosmético (ya
// documentado en 3a); se deja así por ahora.
const ANCHO = 400;
const ALTO = 28;

export default function EncuestaBarraHorizontal({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(({ label, pct }) => (
        <svg
          key={label}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          width="100%"
          height={ALTO}
          style={{ display: 'block' }}
          role="img"
          aria-label={`${label}: ${pct}%`}
        >
          <rect x={0} y={0} width={ANCHO} height={ALTO} rx={6} fill="var(--bg-secondary)" />
          <rect
            x={0}
            y={0}
            width={Math.max((pct / 100) * ANCHO, 2)}
            height={ALTO}
            rx={6}
            fill="var(--accent)"
          />
          <text x={10} y={ALTO / 2} dominantBaseline="middle" fontSize={12.5} fill="#ffffff" fontWeight={600}>
            {label} — {pct}%
          </text>
        </svg>
      ))}
    </div>
  );
}
