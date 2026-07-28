/**
 * Lista de links de material, uno por renglón, como texto simple seleccionable
 * (no clickeable) — reemplaza el <a> único de antes, que solo mostraba/abría
 * el primer link cuando la celda traía varios separados por salto de línea.
 * No todos los renglones son URLs (a veces vienen etiquetas tipo "VERSIÓN 1 -
 * Estudiante adulto mayor" intercaladas), por eso texto plano y no <a>.
 */
export default function ListaLinks({ links }) {
  if (!links || links.length === 0) {
    return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '6px 8px',
        maxWidth: 280,
      }}
    >
      {links.map((link, i) => (
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
  );
}
