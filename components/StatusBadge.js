const ESTILOS = {
  Vigente: { bg: 'var(--cov-alta-bg)', fg: 'var(--cov-alta)' },
  Finalizada: { bg: 'var(--bg-secondary)', fg: 'var(--text-secondary)' },
};

export default function StatusBadge({ estado }) {
  if (!estado) {
    return (
      <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Sin fecha registrada</span>
    );
  }
  const cfg = ESTILOS[estado] || ESTILOS.Finalizada;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.fg,
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      {estado}
    </span>
  );
}
