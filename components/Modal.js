import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Overlay genérico (portal a document.body): backdrop + tarjeta centrada.
 * Cierra con click en el backdrop, Escape, o el botón "×" — mismo patrón de
 * listeners que ya usa VerMaterial.js/Autocomplete.js. Reutilizable para
 * cualquier modal futuro, no es específico de la línea de tiempo.
 */
export default function Modal({ abierto, onCerrar, titulo, children, anchoMax = 720 }) {
  useEffect(() => {
    if (!abierto) return;
    function onEscape(e) {
      if (e.key === 'Escape') onCerrar();
    }
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return createPortal(
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          borderRadius: 14,
          boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
          width: '100%',
          maxWidth: anchoMax,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '20px 24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={cerrarEstilo}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

const cerrarEstilo = {
  border: 'none',
  background: 'none',
  color: 'var(--text-tertiary)',
  fontSize: 22,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
};
