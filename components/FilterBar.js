// Fila de filtros a ancho completo, con altura y espaciado generosos.
// Requisito de UX: nada de filtros angostos apretados en el medio de la pantalla.
// `compacto` (19/11/2026, solo el inicio): menos relleno y separación.
export default function FilterBar({ children, compacto = false }) {
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: compacto ? 8 : 14,
        padding: compacto ? '10px 16px' : '16px 24px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
        minHeight: compacto ? 0 : 64,
      }}
    >
      {children}
    </div>
  );
}
