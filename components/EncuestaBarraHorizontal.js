// Barra horizontal genérica. SVG a mano (sin librerías de charts), mismo
// criterio que el resto del proyecto.
//
// Generalización de lo que en 3a era EncuestaBarraProblemas.js (dict
// {Categoria_Respuesta: pct} de "Principales problemas"): acá recibe
// directamente `items: [{label, pct}]` para poder reusarse tal cual en
// Obras (categorías por pregunta de cada obra), Candidatos (array ya
// ordenado por pct, no un dict) y Otra — mismo estilo visual en las 4,
// mismo componente. El único caller de la vuelta anterior
// (EncuestaResumenRonda, sección "Principales problemas") arma `items` a
// partir del dict de categorías (ordenado descendente ahí) antes de pasarlo
// acá.
//
// Contraste (corrige el caso de borde documentado en 3a): con porcentajes
// chicos el relleno queda más angosto que el texto, y el texto blanco de
// siempre se salía del relleno sobre el fondo claro. Se probó primero un
// umbral fijo por % (ej. "adentro si pct >= 35"), pero un label largo con
// pct apenas arriba de ese umbral (caso real: "Fernando Ramdaldi — 37.6%")
// igual se salía del relleno -> el ancho del texto depende del label, no
// solo del %. Por eso acá se MIDE el ancho real del texto con Canvas
// (measureText, mismo font-size/weight que el <text> del SVG) y se compara
// contra el ancho del relleno: si entra con margen, blanco DENTRO; si no,
// var(--text-primary) A LA DERECHA del relleno, nunca encima.
//
// Este componente solo se monta después de que useApiData resuelve el fetch
// client-side (ver EncuestasLocalidades: `datos` es null durante el render
// de servidor) -> nunca corre en SSR, así que usar `document`/Canvas acá
// directamente es seguro (sin mismatch de hidratación). El guard de
// `typeof document` es solo un fallback defensivo, no se espera que se use.
const ANCHO = 400;
const ALTO = 28;
const FONT_SIZE = 12.5;
const FONT_WEIGHT = 600;
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MARGEN_TEXTO = 20; // padding izq+der dentro del relleno para que el texto no quede pegado a los bordes

let ctxMedicion = null;
function medirAnchoTexto(texto) {
  if (typeof document === 'undefined') return texto.length * FONT_SIZE * 0.55;
  if (!ctxMedicion) ctxMedicion = document.createElement('canvas').getContext('2d');
  ctxMedicion.font = `${FONT_WEIGHT} ${FONT_SIZE}px ${FONT_FAMILY}`;
  return ctxMedicion.measureText(texto).width;
}

export default function EncuestaBarraHorizontal({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(({ label, pct }) => {
        const anchoRelleno = Math.max((pct / 100) * ANCHO, 2);
        const textoCompleto = `${label} — ${pct}%`;
        const textoDentro = anchoRelleno >= medirAnchoTexto(textoCompleto) + MARGEN_TEXTO;
        return (
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
            <rect x={0} y={0} width={anchoRelleno} height={ALTO} rx={6} fill="var(--accent)" />
            <text
              x={textoDentro ? 10 : anchoRelleno + 8}
              y={ALTO / 2}
              dominantBaseline="middle"
              fontSize={FONT_SIZE}
              fill={textoDentro ? '#ffffff' : 'var(--text-primary)'}
              fontWeight={FONT_WEIGHT}
            >
              {textoCompleto}
            </text>
          </svg>
        );
      })}
    </div>
  );
}
