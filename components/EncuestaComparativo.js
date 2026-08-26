import { Fragment, useId } from 'react';
import {
  construirSeriesComparativo,
  construirEvolucionGestion,
  calcularDelta,
  clasificarSignificancia,
  ORDEN_GRUPOS_GESTION,
  COLOR_GRUPO_GESTION,
  medirAnchoTexto,
} from '../lib/encuestasLocalidades';
import { formatearFechaCorta } from '../lib/fechas';

// Rediseño completo (calcado de la referencia visual del proyecto hermano
// tablero-electoral/circuitos que pasó el usuario) — reemplaza la versión
// con sparkline. Sin curva: "no muestra niveles" (pedido explícito del
// usuario). Ver EncuestaSparkline.js -> se borra en este mismo cambio, era
// el único caller.

const tarjetaGrande = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '18px 20px',
};

const tituloTarjeta = { fontSize: 14.5, fontWeight: 700, marginBottom: 14 };

const tarjetaMetrica = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '14px 16px',
};

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 };

const VERDE = '#22C55E';
const ROJO = '#EF4444';
// Borde de las tarjetas de Reelección en "Indicadores": NO puede ser VERDE
// (esa constante está reservada para "buena noticia" en DeltaTexto — un
// borde verde ahí sugería que el número es positivo incluso cuando bajó,
// caso real: "Reelección Llaryora" -3.0 p.p con borde verde). Tampoco
// var(--accent) (ya la usa Aprobación, se confundirían). Violeta neutro que
// no compite con la semántica verde/rojo de DeltaTexto.
const MORADO_REELECCION = '#8B5CF6';

// Medición de texto vía Canvas: medirAnchoTexto vive en
// lib/encuestasLocalidades.js, compartida con EncuestaBarraHorizontal,
// EncuestaGestionBarra y EncuestaDirigentes (mismo criterio en las 4). Este
// componente -como todo lo que cuelga de EncuestasLocalidades- solo se monta
// después del fetch client-side (nunca en SSR), así que usar `document`
// (dentro del helper) acá es seguro.
const FONT_SIZE_SEGMENTO = 12;

/**
 * "▲ Subió X.X p.p" / "▼ Bajó X.X p.p" / "Estable", coloreado según si la
 * dirección es buena o mala noticia para esta métrica en particular.
 * Aprobación/Reelección/Gestión (Positiva): subir es bueno -> verde.
 * Problemas: subir significa que más gente reporta ese problema -> mala
 * noticia -> `invertido` da vuelta el color (nunca la clasificación en sí,
 * clasificarSignificancia() no se toca).
 */
function DeltaTexto({ delta, umbralPp, invertido = false }) {
  const significancia = clasificarSignificancia(delta, umbralPp);
  if (significancia === 'estable') {
    return <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Estable</span>;
  }
  const subio = significancia === 'aumento';
  const buenaNoticia = invertido ? !subio : subio;
  return (
    <span style={{ color: buenaNoticia ? VERDE : ROJO, fontWeight: 600 }}>
      {subio ? '▲' : '▼'} {subio ? 'Subió' : 'Bajó'} {Math.abs(delta).toFixed(1)} p.p
    </span>
  );
}

/** Tarjeta chica reusada por "Indicadores" (Aprobación/Reelección, con fecha
 * + cantidad de respuestas) y por "Principales problemas — evolución" (sin
 * esos metadatos, misma sección de siempre). */
function TarjetaValor({ etiqueta, serie, umbralPp, invertido, casosPorFecha, colorBorde }) {
  const n = serie.length;
  const actual = serie[n - 1];
  const anterior = serie[n - 2];
  const delta = calcularDelta(serie);
  const estilo = colorBorde ? { ...tarjetaMetrica, borderColor: colorBorde } : tarjetaMetrica;

  return (
    <div style={estilo}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{etiqueta}</div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <DeltaTexto delta={delta} umbralPp={umbralPp} invertido={invertido} />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
        De {anterior.valor}% a {actual.valor}%
      </div>
      {casosPorFecha && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
          {formatearFechaCorta(actual.fecha)} · Respuestas: {casosPorFecha.get(actual.fecha) ?? '—'}
        </div>
      )}
    </div>
  );
}

/** [{clave/categoria, delta}] con significancia != 'estable', ordenado
 * descendente por variación absoluta -> para las 2 líneas 🔺/🔻 de arriba
 * de todo. A diferencia del resumen propio de "Principales problemas"
 * (que sigue siendo solo un conteo), acá entran TODAS las métricas:
 * problemas + gestión (Positiva) + aprobación + reelección. */
function construirResumenGeneral(metricas, problemasCategorias, umbralPp) {
  const items = [
    ...metricas.map((m) => ({ etiqueta: m.clave, delta: calcularDelta(m.serie) })),
    ...problemasCategorias.map((p) => ({ etiqueta: p.categoria, delta: calcularDelta(p.serie) })),
  ]
    .map((it) => ({ ...it, significancia: clasificarSignificancia(it.delta, umbralPp) }))
    .filter((it) => it.significancia !== 'estable');

  const porVariacionDesc = (a, b) => Math.abs(b.delta) - Math.abs(a.delta);
  return {
    subieron: items.filter((it) => it.significancia === 'aumento').sort(porVariacionDesc),
    bajaron: items.filter((it) => it.significancia === 'baja').sort(porVariacionDesc),
  };
}

function ResumenGeneral({ subieron, bajaron }) {
  if (subieron.length === 0 && bajaron.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {subieron.length > 0 && (
        <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
          🔺 Subió: {subieron.map((it) => `${it.etiqueta} (+${Math.abs(it.delta).toFixed(1)}pp)`).join(' · ')}
        </p>
      )}
      {bajaron.length > 0 && (
        <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
          🔻 Bajó: {bajaron.map((it) => `${it.etiqueta} (-${Math.abs(it.delta).toFixed(1)}pp)`).join(' · ')}
        </p>
      )}
    </div>
  );
}

// --- Calificación de gestión: barras apiladas por ronda + delta entre pares ---

const ANCHO_BARRA = 400;
const ALTO_BARRA = 32;

/** Mismo cálculo que EncuestaGestionBarra (x acumulado por pct), duplicado
 * acá por la misma razón que medirAnchoTexto: ese componente es de
 * "Resumen" y no se toca acá. */
function segmentosDe(grupos) {
  let acumulado = 0;
  return grupos
    .map((g) => {
      const ancho = (g.pct / 100) * ANCHO_BARRA;
      const seg = { ...g, x: acumulado, ancho };
      acumulado += ancho;
      return seg;
    })
    .filter((s) => s.ancho > 0);
}

function FilaBarraGestion({ punto }) {
  const clipId = useId();
  const segmentos = segmentosDe(punto.grupos);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 180, flexShrink: 0 }}>
        {formatearFechaCorta(punto.fecha)} · Respuestas: {punto.casosTotales ?? '—'}
      </div>
      <div style={{ flex: 1, minWidth: 120 }}>
        <svg
          viewBox={`0 0 ${ANCHO_BARRA} ${ALTO_BARRA}`}
          width="100%"
          height={ALTO_BARRA}
          style={{ display: 'block' }}
        >
          <clipPath id={clipId}>
            <rect x={0} y={0} width={ANCHO_BARRA} height={ALTO_BARRA} rx={6} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            {segmentos.map((s) => (
              <rect key={s.grupo} x={s.x} y={0} width={s.ancho} height={ALTO_BARRA} fill={COLOR_GRUPO_GESTION[s.grupo]} />
            ))}
          </g>
          {/* Número del segmento solo si entra adentro (medido con Canvas) —
              si no entra (ej. una franja de 0.8%) se omite en vez de
              desbordar: acá no hay "afuera a la derecha" como en
              EncuestaBarraHorizontal, son segmentos pegados unos a otros. */}
          {segmentos.map((s) => {
            const texto = `${s.pct}%`;
            if (s.ancho < medirAnchoTexto(texto, { fontSize: FONT_SIZE_SEGMENTO }) + 10) return null;
            return (
              <text
                key={s.grupo}
                x={s.x + s.ancho / 2}
                y={ALTO_BARRA / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={FONT_SIZE_SEGMENTO}
                fontWeight={600}
                fill="#ffffff"
              >
                {texto}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/** Fila de deltas entre dos rondas consecutivas, un texto por segmento,
 * ANCLADO a la posición x de ese segmento en la ronda más nueva (mismo
 * viewBox 0 0 400 x que la barra -> misma escala, así el texto queda
 * arriba de su franja tal como en la referencia). Coloreado con el color
 * propio de cada grupo (COLOR_GRUPO_GESTION) en vez de verde/rojo
 * semántico: el texto ya está posicionado sobre su franja de color, así
 * que repetir ese mismo color ahí es lo que se lee mejor.
 */
function FilaDeltaGestion({ anterior, actual, umbralPp }) {
  const segmentosActual = segmentosDe(actual.grupos);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ minWidth: 180, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 120 }}>
        <svg viewBox={`0 0 ${ANCHO_BARRA} 16`} width="100%" height={16} style={{ display: 'block' }}>
          {ORDEN_GRUPOS_GESTION.map((grupo) => {
            const seg = segmentosActual.find((s) => s.grupo === grupo);
            // Sin ancho en la ronda más nueva -> nada visible arriba de qué
            // anclar el texto, se omite (no se inventa una posición).
            if (!seg) return null;
            const valorAnterior = anterior.grupos.find((g) => g.grupo === grupo)?.pct ?? 0;
            const valorActual = actual.grupos.find((g) => g.grupo === grupo)?.pct ?? 0;
            const delta = calcularDelta([
              { fecha: anterior.fecha, valor: valorAnterior },
              { fecha: actual.fecha, valor: valorActual },
            ]);
            const significancia = clasificarSignificancia(delta, umbralPp);
            const texto =
              significancia === 'estable'
                ? '· Estable'
                : `${significancia === 'aumento' ? '▲ +' : '▼ '}${delta.toFixed(1)} pp`;
            return (
              <text
                key={grupo}
                x={seg.x + seg.ancho / 2}
                y={11}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={significancia === 'estable' ? 'var(--text-tertiary)' : COLOR_GRUPO_GESTION[grupo]}
              >
                {texto}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * "Comparativo" (entrega 3b, rediseño calcado de tablero-electoral): recibe
 * TODAS las rondas de la localidad, no una sola. Cada tarjeta que entra acá
 * ya tiene >= 2 apariciones de esa pregunta/categoría a través de las
 * rondas (ver construirSeriesComparativo/construirEvolucionGestion) — si
 * una pregunta solo aparece en 1 ronda de toda la localidad, no hay nada
 * que comparar y no genera nada.
 *
 * NO renderiza obras/dirigentes/candidatos/otras_preguntas (entrega 3c).
 */
export default function EncuestaComparativo({ rondas, umbralPp }) {
  const { metricas, problemasCategorias } = construirSeriesComparativo(rondas);
  const gestionEvolucion = construirEvolucionGestion(rondas);

  const gestionResumen = metricas.filter((m) => m.tipo === 'gestion');
  const aprobacion = metricas.filter((m) => m.tipo === 'aprobacion');
  const reeleccion = metricas.filter((m) => m.tipo === 'reeleccion');
  const indicadores = [
    ...aprobacion.map((m) => ({ ...m, colorBorde: 'var(--accent)' })),
    ...reeleccion.map((m) => ({ ...m, colorBorde: MORADO_REELECCION })),
  ];

  const sinNada =
    problemasCategorias.length === 0 && gestionEvolucion.length === 0 && aprobacion.length === 0 && reeleccion.length === 0;

  if (sinNada) {
    return (
      <div style={tarjetaGrande}>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          Ninguna pregunta de imagen, aprobación, reelección o problemas aparece en 2 o más rondas de esta
          localidad — no hay nada que comparar todavía.
        </p>
      </div>
    );
  }

  const casosPorFecha = new Map((rondas || []).map((r) => [r.fecha, r.casos_totales]));
  const { subieron, bajaron } = construirResumenGeneral(gestionResumen.concat(aprobacion, reeleccion), problemasCategorias, umbralPp);

  const enAumento = problemasCategorias.filter(
    (p) => clasificarSignificancia(calcularDelta(p.serie), umbralPp) === 'aumento'
  ).length;
  const enBaja = problemasCategorias.filter(
    (p) => clasificarSignificancia(calcularDelta(p.serie), umbralPp) === 'baja'
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ResumenGeneral subieron={subieron} bajaron={bajaron} />

      {indicadores.length > 0 && (
        <div style={tarjetaGrande}>
          <div style={tituloTarjeta}>Indicadores</div>
          <div style={grid}>
            {indicadores.map((m) => (
              <TarjetaValor
                key={m.clave}
                etiqueta={m.clave}
                serie={m.serie}
                umbralPp={umbralPp}
                invertido={false}
                casosPorFecha={casosPorFecha}
                colorBorde={m.colorBorde}
              />
            ))}
          </div>
        </div>
      )}

      {gestionEvolucion.length > 0 && (
        <div style={tarjetaGrande}>
          <div style={tituloTarjeta}>Calificación de gestión</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {gestionEvolucion.map(({ clave, puntos }) => (
              <div key={clave}>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>{clave}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {puntos.map((punto, i) => (
                    <Fragment key={punto.fecha}>
                      {i > 0 && <FilaDeltaGestion anterior={puntos[i - 1]} actual={punto} umbralPp={umbralPp} />}
                      <FilaBarraGestion punto={punto} />
                    </Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            {ORDEN_GRUPOS_GESTION.map((grupo) => (
              <span
                key={grupo}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}
              >
                <span
                  style={{ width: 9, height: 9, borderRadius: 2, background: COLOR_GRUPO_GESTION[grupo], display: 'inline-block' }}
                />
                {grupo}
              </span>
            ))}
          </div>
        </div>
      )}

      {problemasCategorias.length > 0 && (
        <div style={tarjetaGrande}>
          <div style={tituloTarjeta}>Principales problemas — evolución</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            🔺 {enAumento} en aumento · 🔻 {enBaja} en baja
          </p>
          <div style={grid}>
            {problemasCategorias.map((p) => (
              <TarjetaValor key={p.categoria} etiqueta={p.categoria} serie={p.serie} umbralPp={umbralPp} invertido />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
