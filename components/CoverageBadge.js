import { BANDA_COBERTURA } from '../lib/coverage';

const TOTAL_TIPOS_POSIBLES = 7;

export default function CoverageBadge({ banda, totalTipos, compacto = false }) {
  const cfg = BANDA_COBERTURA[banda] || BANDA_COBERTURA.Sin;
  const detalle =
    typeof totalTipos === 'number' ? `${totalTipos} de ${TOTAL_TIPOS_POSIBLES} tipos de medio` : null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compacto ? '3px 9px' : '5px 12px',
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.fg,
        fontSize: compacto ? 12 : 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
      title={detalle || cfg.label}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.fg, flexShrink: 0 }} />
      {cfg.label}
      {detalle && !compacto ? ` · ${detalle}` : ''}
    </span>
  );
}
