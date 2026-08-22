import { useState } from 'react';
import Modal from './Modal';

const LARGO_CORTE = 90;

/** Texto largo (ej. mensaje de SMS) truncado con "ver completo" -> abre el
 * texto entero en un Modal. Si el texto ya entra en LARGO_CORTE, se muestra
 * entero sin botón. */
export default function MensajeTruncado({ mensaje }) {
  const [abierto, setAbierto] = useState(false);

  if (!mensaje) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  if (mensaje.length <= LARGO_CORTE) return <span>{mensaje}</span>;

  return (
    <>
      <span>
        {mensaje.slice(0, LARGO_CORTE)}…{' '}
        <button type="button" onClick={() => setAbierto(true)} style={botonEstilo}>
          ver completo
        </button>
      </span>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Mensaje completo" anchoMax={560}>
        <p style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{mensaje}</p>
      </Modal>
    </>
  );
}

const botonEstilo = {
  border: 'none',
  background: 'none',
  color: 'var(--accent)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
};
