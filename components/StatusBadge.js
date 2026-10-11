const ESTILOS = {
  Vigente: { bg: 'var(--cov-alta-bg)', fg: 'var(--cov-alta)' },
  Finalizada: { bg: 'var(--bg-secondary)', fg: 'var(--text-secondary)' },
  Observada: { bg: 'var(--cov-media-bg)', fg: 'var(--cov-media)' },
  Programada: { bg: '#e0edfb', fg: '#1976d2' },
  'S/D': { bg: 'var(--cov-sin-bg)', fg: 'var(--cov-sin)' },
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
