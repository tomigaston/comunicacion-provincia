import EncuestaSparkline from './EncuestaSparkline';
import { construirSeriesComparativo, calcularDelta, clasificarSignificancia } from '../lib/encuestasLocalidades';

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

/** Flecha + texto de delta, o "Estable" sin flecha por debajo del umbral de
 * significancia (leído de localidades_metadata.json, nunca hardcodeado). */
function DeltaEtiqueta({ delta, umbralPp }) {
  const significancia = clasificarSignificancia(delta, umbralPp);
  if (significancia === 'estable') {
    return <span style={{ color: 'var(--text-tertiary)' }}>Estable</span>;
  }
  const flecha = significancia === 'aumento' ? '🔺' : '🔻';
  const signo = delta > 0 ? '+' : '';
  return (
    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
      {flecha} {signo}
      {delta.toFixed(1)} pp
    </span>
  );
}

function TarjetaMetrica({ etiqueta, serie, umbralPp, color, estilo }) {
  const delta = calcularDelta(serie);
  const valorActual = serie[serie.length - 1].valor;
  return (
    <div style={estilo || tarjetaMetrica}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{etiqueta}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 700 }}>{valorActual}%</span>
        <span style={{ fontSize: 12.5 }}>
          <DeltaEtiqueta delta={delta} umbralPp={umbralPp} />
        </span>
      </div>
      <EncuestaSparkline serie={serie} color={color} />
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>vs. ronda anterior</div>
    </div>
  );
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 };

/**
 * "Comparativo" (entrega 3b): a diferencia de "Resumen", recibe TODAS las
 * rondas de la localidad, no una sola. Cada tarjeta que entra acá ya tiene
 * >= 2 apariciones de esa pregunta/categoría a través de las rondas (ver
 * construirSeriesComparativo) — si una pregunta solo aparece en 1 ronda de
 * toda la localidad, no hay nada que comparar y no genera tarjeta.
 *
 * NO renderiza obras/dirigentes/candidatos/otras_preguntas (entrega 3c).
 */
export default function EncuestaComparativo({ rondas, umbralPp }) {
  const { metricas, problemasCategorias } = construirSeriesComparativo(rondas);

  const gestion = metricas.filter((m) => m.tipo === 'gestion');
  const aprobacion = metricas.filter((m) => m.tipo === 'aprobacion');
  const reeleccion = metricas.filter((m) => m.tipo === 'reeleccion');

  const sinNada =
    problemasCategorias.length === 0 && gestion.length === 0 && aprobacion.length === 0 && reeleccion.length === 0;

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

  const enAumento = problemasCategorias.filter(
    (p) => clasificarSignificancia(calcularDelta(p.serie), umbralPp) === 'aumento'
  ).length;
  const enBaja = problemasCategorias.filter(
    (p) => clasificarSignificancia(calcularDelta(p.serie), umbralPp) === 'baja'
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {problemasCategorias.length > 0 && (
        <div style={tarjetaGrande}>
          <div style={tituloTarjeta}>Principales problemas — evolución</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            🔺 {enAumento} en aumento · 🔻 {enBaja} en baja
          </p>
          <div style={grid}>
            {problemasCategorias.map((p) => (
              <TarjetaMetrica key={p.categoria} etiqueta={p.categoria} serie={p.serie} umbralPp={umbralPp} color="var(--accent)" />
            ))}
          </div>
        </div>
      )}

      {gestion.length > 0 && (
        <div style={tarjetaGrande}>
          <div style={tituloTarjeta}>Calificación de gestión</div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
            % de imagen Positiva a través de las rondas
          </p>
          <div style={grid}>
            {gestion.map((m) => (
              <TarjetaMetrica key={m.clave} etiqueta={m.clave} serie={m.serie} umbralPp={umbralPp} color="#22C55E" />
            ))}
          </div>
        </div>
      )}

      {aprobacion.length > 0 && (
        <div style={tarjetaGrande}>
          <div style={tituloTarjeta}>Aprobación de gestión</div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
            % que Aprueba a través de las rondas
          </p>
          <div style={grid}>
            {aprobacion.map((m) => (
              <TarjetaMetrica key={m.clave} etiqueta={m.clave} serie={m.serie} umbralPp={umbralPp} color="var(--accent)" />
            ))}
          </div>
        </div>
      )}

      {reeleccion.length > 0 && (
        <div style={tarjetaGrande}>
          <div style={tituloTarjeta}>Reelección</div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
            % de Sí a la reelección a través de las rondas
          </p>
          <div style={grid}>
            {reeleccion.map((m) => (
              <TarjetaMetrica key={m.clave} etiqueta={m.clave} serie={m.serie} umbralPp={umbralPp} color="#22C55E" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
