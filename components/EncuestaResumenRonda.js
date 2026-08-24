import EncuestaBarraHorizontal from './EncuestaBarraHorizontal';
import EncuestaGestionBarra from './EncuestaGestionBarra';
import EncuestaAprobacionGauge from './EncuestaAprobacionGauge';
import EncuestaReeleccionDonut from './EncuestaReeleccionDonut';
import EncuestaObras from './EncuestaObras';
import EncuestaDirigentes from './EncuestaDirigentes';
import EncuestaCandidatos from './EncuestaCandidatos';
import EncuestaOtras from './EncuestaOtras';
import { clasificarPreguntas, hayCandidatos } from '../lib/encuestasLocalidades';

const tarjeta = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '18px 20px',
};

const tituloTarjeta = { fontSize: 14.5, fontWeight: 700, marginBottom: 14 };

/**
 * "Resumen" de una ronda puntual. Cada sección se omite por completo si la
 * ronda no trae ese tipo de pregunta — nunca se muestra un bloque vacío ni
 * un "sin datos" (pedido explícito del usuario, ej. la ronda de LA CALERA
 * del 06/02 que solo tiene candidatos_gobernador: hoy ya se muestra esa
 * sección directamente, no un mensaje de "sin datos").
 *
 * 8 secciones en total:
 *   - Las 4 "compatibles con circuitos" (entrega 3a): Principales problemas,
 *     Calificación de gestión, Aprobación de gestión, Reelección.
 *   - Las 4 sin equivalente en el proyecto hermano (entrega 3c): Obras,
 *     Dirigentes, Candidatos (Gobernador/Intendente), Otra.
 * Candidatos (EncuestaCandidatos) arma sus propias tarjetas con título
 * -algunas rondas traen Gobernador sin Intendente o viceversa, ver ese
 * componente- así que se renderiza siempre, sin wrapper `tarjeta` acá.
 */
export default function EncuestaResumenRonda({ ronda }) {
  const { problemas, gestion, aprobacion, reeleccion } = clasificarPreguntas(ronda.preguntas);
  const tieneObras = (ronda.obras || []).length > 0;
  const tieneDirigentes = (ronda.dirigentes || []).length > 0;
  const tieneCandidatos = hayCandidatos(ronda.candidatos_gobernador) || hayCandidatos(ronda.candidatos_intendente);
  const tieneOtras = (ronda.otras_preguntas || []).length > 0;

  const sinDatos =
    problemas.length === 0 &&
    gestion.length === 0 &&
    aprobacion.length === 0 &&
    reeleccion.length === 0 &&
    !tieneObras &&
    !tieneDirigentes &&
    !tieneCandidatos &&
    !tieneOtras;

  if (sinDatos) {
    return (
      <div style={tarjeta}>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          Esta ronda no tiene ninguna pregunta procesada para esta localidad.
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
            <EncuestaBarraHorizontal
              key={clave}
              items={Object.entries(categorias).map(([label, pct]) => ({ label, pct }))}
            />
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

      {tieneObras && (
        <div style={tarjeta}>
          <div style={tituloTarjeta}>Obras</div>
          <EncuestaObras obras={ronda.obras} />
        </div>
      )}

      {tieneDirigentes && (
        <div style={tarjeta}>
          <div style={tituloTarjeta}>Dirigentes locales</div>
          <EncuestaDirigentes dirigentes={ronda.dirigentes} />
        </div>
      )}

      {tieneCandidatos && (
        <EncuestaCandidatos
          candidatosGobernador={ronda.candidatos_gobernador}
          candidatosIntendente={ronda.candidatos_intendente}
        />
      )}

      {tieneOtras && (
        <div style={tarjeta}>
          <div style={tituloTarjeta}>Otras preguntas</div>
          <EncuestaOtras otrasPreguntas={ronda.otras_preguntas} />
        </div>
      )}
    </div>
  );
}
