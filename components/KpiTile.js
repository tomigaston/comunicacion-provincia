export default function KpiTile({ valor, etiqueta, subtitulo }) {
  return (
    <div
      style={{
        flex: '1 1 200px',
        minWidth: 200,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3 }}>{valor}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6 }}>{etiqueta}</div>
      {subtitulo && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitulo}</div>
      )}
    </div>
  );
}
