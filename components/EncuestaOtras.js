import EncuestaBarraHorizontal from './EncuestaBarraHorizontal';

// "Otra" (entrega 3c, sin equivalente en circuitos) -> una barra horizontal
// por pregunta, título = Pregunta_Original completo (puede ser largo, wrap
// normal, nunca truncar con ellipsis).
export default function EncuestaOtras({ otrasPreguntas }) {
  if (!otrasPreguntas || otrasPreguntas.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {otrasPreguntas.map(({ pregunta_original: preguntaOriginal, categorias }) => (
        <div key={preguntaOriginal}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, overflowWrap: 'break-word' }}>
            {preguntaOriginal}
          </div>
          <EncuestaBarraHorizontal items={Object.entries(categorias).map(([label, pct]) => ({ label, pct }))} />
        </div>
      ))}
    </div>
  );
}
