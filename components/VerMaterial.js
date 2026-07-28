import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ANCHO_POPOVER = 320;

/**
 * Reemplaza la caja de links siempre visible (ListaLinks) por un botón
 * "Ver material": con un solo link abre directo en pestaña nueva, sin
 * popover; con varios, abre un popover anclado al botón.
 *
 * El popover se renderiza con un portal a document.body y position:fixed
 * (no absolute) a propósito: la tabla de Campañas (pages/campanas.js) tiene
 * `overflow: hidden` en su wrapper para redondear esquinas, y un popover
 * absolute posicionado se recortaría en filas cerca del borde inferior.
 * Con portal + fixed se evita ese problema sin importar en qué tabla se use.
 */
export default function VerMaterial({ links }) {
  const lista = links || [];
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState(null);
  const botonRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!abierto) return;

    function onClickFuera(e) {
      if (botonRef.current && botonRef.current.contains(e.target)) return;
      if (popoverRef.current && popoverRef.current.contains(e.target)) return;
      setAbierto(false);
    }
    function onEscape(e) {
      if (e.key === 'Escape') setAbierto(false);
    }

    document.addEventListener('mousedown', onClickFuera);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickFuera);
      document.removeEventListener('keydown', onEscape);
    };
  }, [abierto]);

  if (lista.length === 0) {
    return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  }

  if (lista.length === 1) {
    return (
      <a href={lista[0]} target="_blank" rel="noreferrer" style={enlaceEstilo}>
        Ver material
      </a>
    );
  }

  function abrir() {
    const rect = botonRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - ANCHO_POPOVER - 8);
    const espacioAbajo = window.innerHeight - rect.bottom;
    const abrirArriba = espacioAbajo < 180 && rect.top > 180;

    setPosicion({
      left,
      top: abrirArriba ? null : rect.bottom + 6,
      bottom: abrirArriba ? window.innerHeight - rect.top + 6 : null,
    });
    setAbierto(true);
  }

  return (
    <>
      <button type="button" ref={botonRef} onClick={abrir} style={enlaceEstilo}>
        Ver material
      </button>
      {abierto &&
        posicion &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              left: posicion.left,
              top: posicion.top ?? undefined,
              bottom: posicion.bottom ?? undefined,
              width: ANCHO_POPOVER,
              zIndex: 1000,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Material
              </span>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                style={cerrarEstilo}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lista.map((link, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    wordBreak: 'break-all',
                    userSelect: 'text',
                  }}
                >
                  {link}
                </span>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

const enlaceEstilo = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--accent)',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
};

const cerrarEstilo = {
  border: 'none',
  background: 'none',
  color: 'var(--text-tertiary)',
  fontSize: 16,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
};
