import { formatearFechaDiaMes } from '../lib/fechas';
import { esPiezaPDInterior, esPiezaPDVencidaEnLaSemana } from '../lib/semaforo';

// Pauta Digital del interior (PRUEBA en la rama nuevaversion, 19/11/2026):
// renglón chico debajo del título con el código, "Al aire desde" y la pausa
// programada (no es el estado Programada). En las que dejaron de figurar en
// la base, "No figura desde" (fecha de la primera base sin la pieza, no es
// una fecha exacta de fin). Si el fin previsto pasó después de la base, se
// avisa. Nada para las piezas de las otras fuentes.
export default function DetallePiezaInterior({ pieza, hoyIso }) {
  if (!esPiezaPDInterior(pieza)) return null;
  const partes = [
    pieza.codigo_pieza ? `Código ${pieza.codigo_pieza}` : null,
    pieza.al_aire_desde ? `Al aire desde ${formatearFechaDiaMes(pieza.al_aire_desde)}` : null,
    pieza.pausa_programada ? `Pausa programada ${formatearFechaDiaMes(pieza.pausa_programada)}` : null,
    pieza.estado === 'Finalizada' && pieza.fecha_baja_detectada
      ? `No figura desde ${formatearFechaDiaMes(pieza.fecha_baja_detectada)}`
      : null,
  ].filter(Boolean);
  const vencio = esPiezaPDVencidaEnLaSemana(pieza, hoyIso);
  if (partes.length === 0 && !vencio) return null;
  return (
    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.4 }}>
      {partes.join(' · ')}
      {vencio && (
        <span style={{ color: 'var(--cov-baja)', fontWeight: 600 }}>
          {partes.length ? ' · ' : ''}Venció el {formatearFechaDiaMes(pieza.fin_previsto)}, en la semana
        </span>
      )}
    </div>
  );
}
