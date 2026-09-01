import { useId } from 'react';
import { medirAnchoTexto, calcularFilasEtiquetasAfuera } from '../lib/encuestasLocalidades';

// Barra apilada compartida por EncuestaGestionBarra ("Calificación de
// gestión") y EncuestaDirigentes ("Dirigentes locales") — antes cada una
// tenía su propia copia de este SVG (mismo layout, distinta escala). Se
// unifica acá para que el fix de colisión de etiquetas (ver más abajo) viva
// en un solo lugar en vez de haber que parchear las dos vistas por separado.
//
// Criterio de cada número de segmento: adentro (blanco, centrado) si el
// segmento es ancho suficiente para contenerlo con margen (medido con
// Canvas, medirAnchoTexto). Si no, afuera arriba con leader line corta que
// lo conecta a su franja.
//
// Bug real que motivó el zigzag: con 2+ segmentos angostos consecutivos, sus
// etiquetas afuera quedaban todas a la misma altura y se superponían/pegaban
// (ej. "5%5%13.9%" en Dirigentes locales — Ariel Alexandrof; "12.1%2.4%" en
// Calificación de gestión — Gestión del Vicegobernador). Fix: cuando
// calcularFilasEtiquetasAfuera detecta que colisionarían, alterna cada
// etiqueta en colisión a una 2da fila más alejada de la barra — sin línea
// guía especial, el propio desplazamiento vertical + posición horizontal ya
// deja clara la asociación con su segmento.
export default function EncuestaBarraApilada({
  grupos, // [{grupo, pct}], ya agrupado (agruparGestion) y filtrado por el caller
  colorPorGrupo,
  ancho = 400,
  alto = 28,
  radio = 6,
  altoEtiquetaAfuera = 20,
  filaExtra = 14, // separación vertical de la 2da fila cuando hay zigzag
  fontSizeSegmento = 14,
  fontSizeEtiquetaAfuera = 11,
  margenTexto = 10,
  offsetTextoAfuera = 6, // distancia del texto de la fila 0 al borde superior de la barra
  offsetLinea = 3, // gap entre el texto y el inicio de la leader line
  grosorLinea = 1.5,
}) {
  const clipId = useId();

  let acumulado = 0;
  const segmentos = grupos
    .map((g) => {
      const anchoSeg = (g.pct / 100) * ancho;
      const seg = { ...g, x: acumulado, ancho: anchoSeg };
      acumulado += anchoSeg;
      return seg;
    })
    .filter((s) => s.ancho > 0);

  const conEtiqueta = segmentos.map((s) => ({
    ...s,
    entraAdentro: s.ancho >= medirAnchoTexto(`${s.pct}%`, { fontSize: fontSizeSegmento }) + margenTexto,
  }));

  const afuera = conEtiqueta.filter((s) => !s.entraAdentro);
  const filaPorGrupo = calcularFilasEtiquetasAfuera(afuera, { fontSize: fontSizeEtiquetaAfuera });
  const necesitaZigzag = [...filaPorGrupo.values()].some((fila) => fila === 1);

  const reservado = altoEtiquetaAfuera + (necesitaZigzag ? filaExtra : 0);
  const altoTotal = reservado + alto;

  return (
    <svg viewBox={`0 0 ${ancho} ${altoTotal}`} width="100%" height={altoTotal} style={{ display: 'block' }}>
      <clipPath id={clipId}>
        <rect x={0} y={reservado} width={ancho} height={alto} rx={radio} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {segmentos.map((s) => (
          <rect key={s.grupo} x={s.x} y={reservado} width={s.ancho} height={alto} fill={colorPorGrupo[s.grupo]} />
        ))}
      </g>
      {conEtiqueta.map((s) => {
        const texto = `${s.pct}%`;
        const cx = s.x + s.ancho / 2;
        if (s.entraAdentro) {
          return (
            <text
              key={s.grupo}
              x={cx}
              y={reservado + alto / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={fontSizeSegmento}
              fontWeight={700}
              fill="#ffffff"
            >
              {texto}
            </text>
          );
        }
        const fila = filaPorGrupo.get(s.grupo) ?? 0;
        const textoY = reservado - offsetTextoAfuera - fila * filaExtra;
        return (
          <g key={s.grupo}>
            <line
              x1={cx}
              y1={textoY + offsetLinea}
              x2={cx}
              y2={reservado}
              stroke={colorPorGrupo[s.grupo]}
              strokeWidth={grosorLinea}
            />
            <text x={cx} y={textoY} textAnchor="middle" fontSize={fontSizeEtiquetaAfuera} fontWeight={700} fill="var(--text-primary)">
              {texto}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
