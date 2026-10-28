import { textoActivasPD } from '../lib/coverage';

const ESTILOS = {
  '🔴': { bg: 'var(--cov-baja-bg)', fg: 'var(--cov-baja)' },
  '🟡': { bg: 'var(--cov-media-bg)', fg: 'var(--cov-media)' },
  '🟢': { bg: 'var(--cov-alta-bg)', fg: 'var(--cov-alta)' },
};

/** Badge del semáforo de Pauta Digital: color + "N activas" (28/10/2026). Propio
 * de PD: SemaforoBadge sigue siendo el de Medios Tradicionales. `pd` es el
 * resultado de calcularSemaforoPD(). */
export default function SemaforoPDBadge({ pd, desglose = false }) {
  const cfg = ESTILOS[pd.color];
  return (
    <span
      title={textoActivasPD(pd)}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.fg,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {pd.color} {textoActivasPD(pd, { desglose })}
    </span>
  );
}
