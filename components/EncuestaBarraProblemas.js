// "Principales problemas" (Tipo_Pregunta=Problemas) -> una barra horizontal
// por categoría, texto en blanco dentro del relleno. SVG a mano (sin
// librerías de charts), mismo criterio que el resto del proyecto.
//
// Nota: con porcentajes muy chicos (pocos puntos) el relleno puede quedar
// más angosto que el texto -> el texto blanco se sale del relleno sobre el
// fondo claro y pierde contraste. Es un caso de borde cosmético (no pasa
// con los "problemas principales" reales, que rondan 5-40%); se deja así
// por ahora, a criterio del usuario si conviene ajustarlo más adelante.
const ANCHO = 400;
const ALTO = 28;

export default function EncuestaBarraProblemas({ categorias }) {
  const entradas = Object.entries(categorias || {});
  if (entradas.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entradas.map(([categoria, pct]) => (
        <svg
          key={categoria}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          width="100%"
          height={ALTO}
          style={{ display: 'block' }}
          role="img"
          aria-label={`${categoria}: ${pct}%`}
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
            {categoria} — {pct}%
          </text>
        </svg>
      ))}
    </div>
  );
}
