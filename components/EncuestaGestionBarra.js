import { useId } from 'react';
import { ORDEN_GRUPOS_GESTION, COLOR_GRUPO_GESTION, agruparGestion, medirAnchoTexto } from '../lib/encuestasLocalidades';

// "Calificación de gestión" (Tipo_Pregunta=Imagen_Funcionario, clave
// "Gestión del X") -> barra apilada de 4 categorías (Positiva/Regular/
// Negativa/Ns-Nc). OJO: esto NO es "Aprobación de gestión" (ver
// EncuestaAprobacionGauge.js) — son preguntas distintas de la fuente.
const ANCHO = 400;
const ALTO = 28;
// Espacio reservado arriba de la barra para el % de un segmento angosto que
// no entra adentro (label + leader line corta hasta el borde superior de su
// franja) — caso real: un "Ns-Nc" de 1%, prácticamente invisible.
const ALTO_ETIQUETA_AFUERA = 20;
// Más grande que el tamaño de la vieja leyenda (12px) — pedido explícito del
// usuario, ahora que el número vive en la barra y no se repite abajo.
const FONT_SIZE_SEGMENTO = 14;
const MARGEN_TEXTO = 10; // padding izq+der dentro del segmento para decidir si el número entra

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
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO_ETIQUETA_AFUERA + ALTO}`}
        width="100%"
        height={ALTO_ETIQUETA_AFUERA + ALTO}
        style={{ display: 'block' }}
      >
        <clipPath id={clipId}>
          <rect x={0} y={ALTO_ETIQUETA_AFUERA} width={ANCHO} height={ALTO} rx={6} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          {segmentos.map((s) => (
            <rect key={s.grupo} x={s.x} y={ALTO_ETIQUETA_AFUERA} width={s.ancho} height={ALTO} fill={COLOR_GRUPO_GESTION[s.grupo]} />
          ))}
        </g>
        {/* Número de cada segmento: adentro (blanco, centrado, grande) si el
            segmento es ancho suficiente para contenerlo con margen. Si no
            (ej. Ns-Nc de 1%), nunca se omite: va afuera arriba, con una
            leader line corta que lo conecta a su franja, para que quede
            claro a qué grupo pertenece aun siendo angosta. */}
        {segmentos.map((s) => {
          const texto = `${s.pct}%`;
          const cx = s.x + s.ancho / 2;
          const entraAdentro = s.ancho >= medirAnchoTexto(texto, { fontSize: FONT_SIZE_SEGMENTO }) + MARGEN_TEXTO;
          if (entraAdentro) {
            return (
              <text
                key={s.grupo}
                x={cx}
                y={ALTO_ETIQUETA_AFUERA + ALTO / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={FONT_SIZE_SEGMENTO}
                fontWeight={700}
                fill="#ffffff"
              >
                {texto}
              </text>
            );
          }
          return (
            <g key={s.grupo}>
              <line
                x1={cx}
                y1={ALTO_ETIQUETA_AFUERA - 3}
                x2={cx}
                y2={ALTO_ETIQUETA_AFUERA}
                stroke={COLOR_GRUPO_GESTION[s.grupo]}
                strokeWidth={1.5}
              />
              <text
                x={cx}
                y={ALTO_ETIQUETA_AFUERA - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="var(--text-primary)"
              >
                {texto}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        {/* Sin porcentaje acá (cambio de criterio explícito del usuario): el
            número ya está en la barra, más grande — repetirlo en la leyenda
            era redundante. Vuelve a ser solo punto de color + nombre del
            grupo, igual que la leyenda de EncuestaDirigentes. */}
        {grupos.map(({ grupo }) => (
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
            {grupo}
          </span>
        ))}
      </div>
    </div>
  );
}
