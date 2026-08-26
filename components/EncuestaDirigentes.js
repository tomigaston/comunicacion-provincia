import { useId, useMemo, useState } from 'react';
import { agruparGestion, COLOR_GRUPO_GESTION, ORDEN_GRUPOS_GESTION } from '../lib/encuestasLocalidades';
import { normalizarTexto } from '../lib/texto';

// "Dirigentes_Locales" (entrega 3c, sin equivalente en circuitos) -> lista
// ordenada alfabéticamente, cada uno con nombre + barra apilada compacta.
// Reusa agruparGestion()/COLOR_GRUPO_GESTION/ORDEN_GRUPOS_GESTION de
// lib/encuestasLocalidades.js -> misma paleta y agrupación que "Calificación
// de gestión" del Resumen (Dirigentes_Locales usa las mismas 5 categorías:
// Muy buena/Buena/Regular/Mala/No se, confirmado contra la fuente real).
//
// A diferencia de EncuestaGestionBarra (una barra por Gestión del X, con su
// propia leyenda debajo), acá la leyenda va UNA sola vez arriba de toda la
// lista -> por eso la barra compacta se dibuja directo acá, sin reusar ese
// componente (que trae su leyenda propia repetida por instancia).

const ANCHO_BARRA = 300;
const ALTO_BARRA = 20;
const UMBRAL_FILTRO = 8;

function BarraCompacta({ categorias }) {
  const clipId = useId();
  const grupos = agruparGestion(categorias);

  let acumulado = 0;
  const segmentos = grupos
    .map((g) => {
      const ancho = (g.pct / 100) * ANCHO_BARRA;
      const seg = { ...g, x: acumulado, ancho };
      acumulado += ancho;
      return seg;
    })
    .filter((s) => s.ancho > 0);

  return (
    <svg viewBox={`0 0 ${ANCHO_BARRA} ${ALTO_BARRA}`} width="100%" height={ALTO_BARRA} style={{ display: 'block' }}>
      <clipPath id={clipId}>
        <rect x={0} y={0} width={ANCHO_BARRA} height={ALTO_BARRA} rx={5} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {segmentos.map((s) => (
          <rect key={s.grupo} x={s.x} y={0} width={s.ancho} height={ALTO_BARRA} fill={COLOR_GRUPO_GESTION[s.grupo]} />
        ))}
      </g>
    </svg>
  );
}

export default function EncuestaDirigentes({ dirigentes }) {
  const [busqueda, setBusqueda] = useState('');

  // Alfabético por nombre (no depender del orden de aparición en la fuente
  // -> lectura difícil en localidades con muchos dirigentes, ej. Villa
  // Dolores con 16 en una sola ronda).
  const ordenados = useMemo(
    () => [...(dirigentes || [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [dirigentes]
  );

  // normalizarTexto (mismo criterio que Autocomplete/buscador de
  // Localidades en todo el proyecto): sin tildes ni mayúsculas -> "martin"
  // encuentra "Martín Llaryora", no solo "Martino".
  const filtrados = useMemo(() => {
    const q = normalizarTexto(busqueda);
    if (!q) return ordenados;
    return ordenados.filter((d) => normalizarTexto(d.nombre).includes(q));
  }, [ordenados, busqueda]);

  if (!dirigentes || dirigentes.length === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {ORDEN_GRUPOS_GESTION.map((grupo) => (
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

      {dirigentes.length > UMBRAL_FILTRO && (
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar dirigente..."
          style={{
            width: '100%',
            maxWidth: 320,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 13.5,
            marginBottom: 14,
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
          }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtrados.map((d) => (
          <div key={d.nombre} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 13, minWidth: 170, flexShrink: 0 }}>{d.nombre}</div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <BarraCompacta categorias={d.categorias} />
            </div>
          </div>
        ))}
        {filtrados.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Sin resultados para «{busqueda}»</p>
        )}
      </div>
    </div>
  );
}
