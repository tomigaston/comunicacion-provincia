// Chip de 3 estados por clic: apagado -> incluir -> excluir -> apagado.
// El nombre del medio queda siempre visible adentro del propio chip, con el
// prefijo que indica qué está haciendo el filtro — nunca un chip ambiguo al
// lado de otro control separado.
const ORDEN = ['off', 'incluir', 'excluir'];

const ESTILOS = {
  off: { bg: 'var(--bg-secondary)', fg: 'var(--text-secondary)', border: 'var(--border)', prefijo: '' },
  incluir: { bg: '#e0edfb', fg: '#1976d2', border: '#1976d2', prefijo: '✓ ' },
  excluir: { bg: 'var(--cov-baja-bg)', fg: '#b91c1c', border: '#b91c1c', prefijo: '✕ Sin ' },
};

export default function MedioFilterChip({ medio, estado = 'off', onChange }) {
  const cfg = ESTILOS[estado] || ESTILOS.off;

  function siguienteEstado() {
    const idx = ORDEN.indexOf(estado);
    return ORDEN[(idx + 1) % ORDEN.length];
  }

  return (
    <button
      type="button"
      onClick={() => onChange(siguienteEstado())}
      title={
        estado === 'off'
          ? `Clic para incluir solo localidades con ${medio}`
          : estado === 'incluir'
          ? `Mostrando solo localidades CON ${medio}. Clic para invertir a "sin ${medio}"`
          : `Mostrando solo localidades SIN ${medio}. Clic para desactivar este filtro`
      }
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        border: `1.5px solid ${cfg.border}`,
        background: cfg.bg,
        color: cfg.fg,
        fontSize: 13.5,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {cfg.prefijo}
      {medio}
    </button>
  );
}
