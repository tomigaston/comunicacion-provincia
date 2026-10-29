import { colorDeAlerta, etiquetaAlerta } from '../lib/semaforo';

const ESTILOS = {
  '🔴': { bg: 'var(--cov-baja-bg)', fg: 'var(--cov-baja)' },
  '🟡': { bg: 'var(--cov-media-bg)', fg: 'var(--cov-media)' },
  '🟢': { bg: 'var(--cov-alta-bg)', fg: 'var(--cov-alta)' },
};

/** Badge de semáforo para una alerta puntual: de antigüedad (fila de tema
 * vigente de MT, por defecto) o de vencimiento (`tipo="vencimiento"`, Pauta
 * Digital). `null` si no hay alerta -- no se pinta nada (Activos de MT sin
 * Fecha_Desde, piezas de PD que no están vivas). */
export default function SemaforoBadge({ alerta, antiguedadDias, tipo = 'antiguedad', compacto = false }) {
  const color = colorDeAlerta(alerta);
  if (!color) return null;
  const cfg = ESTILOS[color];
  const texto = compacto
    ? color
    : `${color} ${etiquetaAlerta(alerta, tipo)}${typeof antiguedadDias === 'number' ? ` (${antiguedadDias} días)` : ''}`;
  return (
    <span
      title={etiquetaAlerta(alerta, tipo) || undefined}
      style={{
        display: 'inline-block',
        padding: compacto ? '2px 6px' : '3px 10px',
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.fg,
        fontSize: compacto ? 12 : 12.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {texto}
    </span>
  );
}
