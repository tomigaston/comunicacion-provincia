import { colorAprobacion } from '../lib/encuestasLocalidades';

// "Aprobación de gestión" (Tipo_Pregunta=Aprobacion, clave "Aprobación X",
// categorías Apruebo/Desapruebo) -> gauge semicircular semáforo, calculado
// sobre "Apruebo". OJO: esto NO es "Calificación de gestión" (ver
// EncuestaGestionBarra.js) — son preguntas distintas de la fuente.

const CX = 100;
const CY = 100;
const R = 80;

// Convención de ángulo tipo reloj: 0° = arriba (12), 90° = derecha (3),
// clockwise. El semicírculo del gauge va de -90° (izquierda, 9) a +90°
// (derecha, 3) pasando por 0° (arriba) -> exactamente la mitad superior.
function puntoEnArco(angulo) {
  const rad = ((angulo - 90) * Math.PI) / 180;
  // -90 desplaza el 0° de referencia a la derecha (convención matemática
  // estándar) -> con este ajuste, angulo=-90 cae a la izquierda y
  // angulo=90 cae a la derecha, pasando por arriba en angulo=0.
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

function describirArco(anguloInicio, anguloFin) {
  const inicio = puntoEnArco(anguloFin);
  const fin = puntoEnArco(anguloInicio);
  const largeArcFlag = anguloFin - anguloInicio <= 180 ? '0' : '1';
  return `M ${inicio.x} ${inicio.y} A ${R} ${R} 0 ${largeArcFlag} 0 ${fin.x} ${fin.y}`;
}

export default function EncuestaAprobacionGauge({ etiqueta, pctApruebo }) {
  const pct = pctApruebo || 0;
  const color = colorAprobacion(pct);
  const anguloFin = -90 + 180 * (pct / 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 160 }}>
      <svg viewBox="0 0 200 110" width={180} height={99} role="img" aria-label={`${etiqueta}: ${pct}% aprueba`}>
        <path d={describirArco(-90, 90)} stroke="var(--bg-secondary)" strokeWidth={16} fill="none" strokeLinecap="round" />
        {pct > 0 && (
          <path d={describirArco(-90, anguloFin)} stroke={color} strokeWidth={16} fill="none" strokeLinecap="round" />
        )}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize={26} fontWeight={700} fill={color}>
          {pct}%
        </text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', marginTop: -6 }}>{etiqueta}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>aprueba</div>
    </div>
  );
}
