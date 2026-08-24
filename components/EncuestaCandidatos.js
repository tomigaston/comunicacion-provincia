import { useState } from 'react';
import EncuestaBarraHorizontal from './EncuestaBarraHorizontal';
import { hayCandidatos } from '../lib/encuestasLocalidades';

// "Candidatos_Gobernador"/"Candidatos_Intendente" (entrega 3c, sin
// equivalente en circuitos) -> dos sub-secciones independientes ("Candidatos
// a Gobernador" / "Candidatos a Intendente"), cada una omitida si no trae
// datos. Con más de un escenario, tabs para elegir cuál ver (default: el
// primero en el orden de aparición real del JSON -> no se reordena).

const tarjeta = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '18px 20px',
};

const tituloTarjeta = { fontSize: 14.5, fontWeight: 700, marginBottom: 14 };

function BloqueCandidatos({ titulo, porEscenario }) {
  // Object.keys ya preserva el orden de aparición real en el JSON (no se
  // reordena). Se descarta cualquier escenario cuyo array venga vacío (no
  // debería pasar, pero por las dudas no genera una tab sin nada adentro).
  const escenarios = Object.keys(porEscenario || {}).filter((esc) => (porEscenario[esc] || []).length > 0);
  const [escenarioElegido, setEscenarioElegido] = useState(escenarios[0]);

  if (escenarios.length === 0) return null;
  const activo = escenarios.includes(escenarioElegido) ? escenarioElegido : escenarios[0];
  const items = porEscenario[activo].map((c) => ({ label: c.candidato, pct: c.pct }));

  return (
    <div style={tarjeta}>
      <div style={tituloTarjeta}>{titulo}</div>
      {escenarios.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {escenarios.map((esc) => {
            const on = esc === activo;
            return (
              <button
                key={esc}
                type="button"
                onClick={() => setEscenarioElegido(esc)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? '#e0edfb' : 'var(--bg-secondary)',
                  color: on ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {esc}
              </button>
            );
          })}
        </div>
      )}
      {/* Ranking ya viene ordenado descendente por pct desde el pipeline
          (Python) -> NO se reordena de nuevo acá. */}
      <EncuestaBarraHorizontal items={items} />
    </div>
  );
}

export default function EncuestaCandidatos({ candidatosGobernador, candidatosIntendente }) {
  const gob = hayCandidatos(candidatosGobernador);
  const int = hayCandidatos(candidatosIntendente);

  if (!gob && !int) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {gob && <BloqueCandidatos titulo="Candidatos a Gobernador" porEscenario={candidatosGobernador} />}
      {int && <BloqueCandidatos titulo="Candidatos a Intendente" porEscenario={candidatosIntendente} />}
    </div>
  );
}
