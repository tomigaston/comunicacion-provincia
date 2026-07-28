export default function KpiTile({ valor, etiqueta, subtitulo }) {
  return (
    <div
      style={{
        flex: '1 1 200px',
        minWidth: 200,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '18px 20px',
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6 }}>{etiqueta}</div>
      {subtitulo && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitulo}</div>
      )}
    </div>
  );
}
