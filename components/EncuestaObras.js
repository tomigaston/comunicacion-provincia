import EncuestaBarraHorizontal from './EncuestaBarraHorizontal';

// "Obras" (entrega 3c, sin equivalente en circuitos) -> una tarjeta por
// obra, con una barra horizontal (EncuestaBarraHorizontal, mismo estilo que
// Problemas) por cada pregunta de esa obra (Conocimiento de Obra / Opinión
// sobre Obra / lo que traiga).

const tarjetaObra = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '14px 16px',
};

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 };

// Orden preferido cuando están presentes; cualquier otra clave (ej.
// "Importancia de Obra") va al final, en orden alfabético entre ellas.
const ORDEN_PREFERIDO = ['Conocimiento de Obra', 'Opinión sobre Obra'];

function ordenarClavesPreguntas(preguntas) {
  return Object.keys(preguntas).sort((a, b) => {
    const ia = ORDEN_PREFERIDO.indexOf(a);
    const ib = ORDEN_PREFERIDO.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, 'es');
  });
}

export default function EncuestaObras({ obras }) {
  if (!obras || obras.length === 0) return null;

  return (
    <div style={grid}>
      {obras.map((obra) => (
        <div key={obra.nombre_obra} style={tarjetaObra}>
          {/* nombre_obra puede ser largo -> wrap normal, nunca truncar con
              ellipsis ni forzar nowrap (pedido explícito del usuario). */}
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12, overflowWrap: 'break-word' }}>
            {obra.nombre_obra}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ordenarClavesPreguntas(obra.preguntas).map((clave) => (
              <div key={clave}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{clave}</div>
                <EncuestaBarraHorizontal
                  items={Object.entries(obra.preguntas[clave]).map(([label, pct]) => ({ label, pct }))}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
