import EncuestaBarraProblemas from './EncuestaBarraProblemas';
import EncuestaGestionBarra from './EncuestaGestionBarra';
import EncuestaAprobacionGauge from './EncuestaAprobacionGauge';
import EncuestaReeleccionDonut from './EncuestaReeleccionDonut';
import { clasificarPreguntas } from '../lib/encuestasLocalidades';

const tarjeta = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '18px 20px',
};

const tituloTarjeta = { fontSize: 14.5, fontWeight: 700, marginBottom: 14 };

/**
 * "Resumen" de una ronda puntual (entrega 3a). Cada una de las 4 secciones
 * se omite por completo si la ronda no trae ese tipo de pregunta — nunca se
 * muestra un bloque vacío ni un "sin datos" (pedido explícito del usuario,
 * ej. la ronda de LA CALERA del 06/02 que solo tiene candidatos_gobernador).
 *
 * A propósito NO renderiza obras/dirigentes/candidatos_gobernador/
 * candidatos_intendente/otras_preguntas: quedan para la entrega 3c (esos
 * campos ya vienen en `ronda` porque la API devuelve el JSON completo sin
 * recortar, pero esta vista todavía no los usa).
 */
export default function EncuestaResumenRonda({ ronda }) {
  const { problemas, gestion, aprobacion, reeleccion } = clasificarPreguntas(ronda.preguntas);

  const sinDatos =
    problemas.length === 0 && gestion.length === 0 && aprobacion.length === 0 && reeleccion.length === 0;

  if (sinDatos) {
    return (
      <div style={tarjeta}>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          Esta ronda no tiene preguntas de imagen, aprobación, reelección ni problemas — puede traer
          candidatos, obras o dirigentes (ver próxima entrega).
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {problemas.length > 0 && (
        <div style={tarjeta}>
          <div style={tituloTarjeta}>Principales problemas</div>
          {problemas.map(({ clave, categorias }) => (
            <EncuestaBarraProblemas key={clave} categorias={categorias} />
          ))}
        </div>
      )}

      {gestion.length > 0 && (
        <div style={tarjeta}>
          <div style={tituloTarjeta}>Calificación de gestión</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {gestion.map(({ clave, categorias }) => (
              <EncuestaGestionBarra key={clave} etiqueta={clave} categorias={categorias} />
            ))}
          </div>
        </div>
      )}

      {aprobacion.length > 0 && (
        <div style={tarjeta}>
          <div style={tituloTarjeta}>Aprobación de gestión</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {aprobacion.map(({ clave, categorias }) => (
              <EncuestaAprobacionGauge key={clave} etiqueta={clave} pctApruebo={categorias.Apruebo ?? 0} />
            ))}
          </div>
        </div>
      )}

      {reeleccion.length > 0 && (
        <div style={tarjeta}>
          <div style={tituloTarjeta}>Reelección</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {reeleccion.map(({ clave, categorias }) => (
              <EncuestaReeleccionDonut key={clave} etiqueta={clave} categorias={categorias} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
