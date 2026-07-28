// Fila de filtros a ancho completo, con altura y espaciado generosos.
// Requisito de UX: nada de filtros angostos apretados en el medio de la pantalla.
export default function FilterBar({ children }) {
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 14,
        padding: '16px 24px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        minHeight: 64,
      }}
    >
      {children}
    </div>
  );
}
