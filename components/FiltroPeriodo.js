import { useState } from 'react';
import { mesesDisponibles } from '../lib/fechas';

const PRESETS = [
  { valor: 'ultimas_2_semanas', label: 'Últimas 2 semanas' },
  { valor: 'ultimo_mes', label: 'Último mes' },
  { valor: 'ultimos_3_meses', label: 'Últimos 3 meses' },
  { valor: 'todo', label: 'Todo' },
];

/**
 * Filtro de período con dos grupos separados visualmente:
 * Grupo A (ventanas relativas a hoy, chips prominentes) + "Personalizado..."
 * y Grupo B (mes calendario puntual, dropdown secundario más chico, generado
 * a partir de las fechas reales que trae `fechasDisponibles` — nunca una
 * lista fija).
 */
export default function FiltroPeriodo({ periodo, onChange, fechasDisponibles }) {
  const [personalizadoAbierto, setPersonalizadoAbierto] = useState(periodo.tipo === 'rango');
  const meses = mesesDisponibles(fechasDisponibles || []);

  const esPreset = (valor) => periodo.tipo === 'preset' && periodo.valor === valor;
  const rangoActual = periodo.tipo === 'rango' ? periodo.valor : { desde: '', hasta: '' };

  function elegirPreset(valor) {
    setPersonalizadoAbierto(false);
    onChange({ tipo: 'preset', valor });
  }

  function actualizarRango(campo, valor) {
    const nuevo = { ...rangoActual, [campo]: valor };
    onChange({ tipo: 'rango', valor: nuevo });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 2 }}>
          Período:
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.valor}
            type="button"
            onClick={() => elegirPreset(p.valor)}
            style={chipEstilo(esPreset(p.valor))}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPersonalizadoAbierto((v) => !v)}
          style={chipEstilo(periodo.tipo === 'rango')}
        >
          Personalizado…
        </button>
      </div>

      {personalizadoAbierto && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 2 }}>
          <input
            type="date"
            value={rangoActual.desde}
            onChange={(e) => actualizarRango('desde', e.target.value)}
            style={inputFechaEstilo}
          />
          <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>hasta</span>
          <input
            type="date"
            value={rangoActual.hasta}
            onChange={(e) => actualizarRango('hasta', e.target.value)}
            style={inputFechaEstilo}
          />
        </div>
      )}

      {meses.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Mes puntual:</span>
          <select
            value={periodo.tipo === 'mes' ? periodo.valor : ''}
            onChange={(e) => {
              setPersonalizadoAbierto(false);
              if (e.target.value) onChange({ tipo: 'mes', valor: e.target.value });
            }}
            style={selectEstilo}
          >
            <option value="">Elegir mes…</option>
            {meses.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function chipEstilo(activo) {
  return {
    padding: '7px 13px',
    borderRadius: 999,
    border: `1.5px solid ${activo ? 'var(--accent)' : 'var(--border)'}`,
    background: activo ? '#e0edfb' : 'var(--bg-secondary)',
    color: activo ? 'var(--accent)' : 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

const inputFechaEstilo = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 13,
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
};

const selectEstilo = {
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  fontSize: 12.5,
  background: 'var(--bg-primary)',
  color: 'var(--text-secondary)',
};
