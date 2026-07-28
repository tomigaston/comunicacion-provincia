import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizarTexto as normalizar } from '../lib/texto';

/**
 * Buscador con sugerencias en vivo. `onQueryChange` avisa cada tecla (para
 * filtrar una lista en tiempo real); `onSelect` avisa cuando se elige un ítem
 * puntual del desplegable. Cuando hay texto y ninguna sugerencia matchea, se
 * muestra "sin resultados" en vez de una lista vacía silenciosa — así se
 * distingue "no existe" de "lo escribí mal".
 */
export default function Autocomplete({ items, placeholder, onSelect, onQueryChange, valorInicial = '' }) {
  const [query, setQuery] = useState(valorInicial);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const contenedorRef = useRef(null);

  const sugerencias = useMemo(() => {
    const q = normalizar(query);
    if (!q) return [];
    return items.filter((it) => normalizar(it.label).includes(q)).slice(0, 8);
  }, [items, query]);

  useEffect(() => {
    function onClickFuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  function elegir(item) {
    setQuery(item.label);
    setAbierto(false);
    setActivo(-1);
    onSelect && onSelect(item);
  }

  function onKeyDown(e) {
    if (!abierto || sugerencias.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((a) => Math.min(a + 1, sugerencias.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && activo >= 0) {
      e.preventDefault();
      elegir(sugerencias[activo]);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  }

  return (
    <div ref={contenedorRef} style={{ position: 'relative', minWidth: 240 }}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setAbierto(true);
          setActivo(-1);
          onQueryChange && onQueryChange(e.target.value);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          fontSize: 14,
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
        }}
      />
      {abierto && query.trim() && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            zIndex: 20,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {sugerencias.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 13.5, color: 'var(--text-tertiary)' }}>
              Sin resultados para «{query}» — revisá que esté bien escrito
            </div>
          ) : (
            sugerencias.map((it, i) => (
              <div
                key={it.value}
                onMouseDown={() => elegir(it)}
                style={{
                  padding: '9px 14px',
                  fontSize: 14,
                  cursor: 'pointer',
                  background: i === activo ? 'var(--bg-secondary)' : 'transparent',
                }}
              >
                <div>{it.label}</div>
                {it.sublabel && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{it.sublabel}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
