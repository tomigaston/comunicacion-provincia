import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TIPOS_MEDIO } from '../lib/tiposMedio';
import { formatearFechaCorta } from '../lib/fechas';
import VerMaterial from './VerMaterial';

// Paleta cualitativa (identidad de racha de tema), separada a propósito de la
// escala semántica Sin/Baja/Media/Alta de lib/coverage.js — acá el color no
// mide "cuánta cobertura hay", mide "es el mismo tema o cambió".
const PALETA = ['#2563eb', '#7c3aed', '#0891b2', '#db2777', '#4338ca', '#0369a1', '#a21caf', '#0284c7'];

const MAX_TEMAS_VISIBLES = 3;
const ANCHO_TOOLTIP = 300;

function semanasAMostrar(series, cantidad) {
  const fechas = new Set();
  Object.values(series || {}).forEach((serie) => serie.forEach((s) => fechas.add(s.fecha_snapshot)));
  return Array.from(fechas)
    .sort()
    .slice(-cantidad);
}

/** Mismo color mientras el tema no cambie respecto de la semana anterior de
 * esa fila (racha); color nuevo (siguiente de la paleta) cuando cambia —
 * mismo concepto de "racha" que ya usa Maestro_Vigente/semanas_consecutivas. */
function celdasConColor(serie, semanas) {
  const porFecha = new Map((serie || []).map((s) => [s.fecha_snapshot, s]));
  let temaAnterior;
  let indiceColor = -1;
  return semanas.map((fecha) => {
    const entrada = porFecha.get(fecha) || null;
    if (!entrada) {
      temaAnterior = undefined;
      return { fecha, entrada: null, color: null };
    }
    if (entrada.tema_campana !== temaAnterior) {
      indiceColor += 1;
      temaAnterior = entrada.tema_campana;
    }
    return { fecha, entrada, color: PALETA[indiceColor % PALETA.length] };
  });
}

/**
 * Recorta por líneas lógicas (cada campaña del bloque) en JS, no con
 * -webkit-line-clamp: ese, combinado con white-space: pre-line, dejaba asomar
 * una cuarta línea cortada al medio. Acá el corte es exacto: se muestran hasta
 * MAX_TEMAS_VISIBLES campañas completas y el resto se resume con "…".
 */
function recortarTema(tema) {
  const lineas = String(tema || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length <= MAX_TEMAS_VISIBLES) {
    return { texto: lineas.join('\n'), recortado: false };
  }
  const restantes = lineas.length - MAX_TEMAS_VISIBLES;
  return {
    texto: `${lineas.slice(0, MAX_TEMAS_VISIBLES).join('\n')}\n… +${restantes} más`,
    recortado: true,
  };
}

/** Barra de una semana: hover muestra el texto completo (solo si está
 * recortado), click abre el popover de material — dos gestos distintos, no
 * compiten entre sí. */
function BarraTema({ entrada, color }) {
  const { texto, recortado } = recortarTema(entrada.tema_campana);
  const [tooltip, setTooltip] = useState(null);
  const barraRef = useRef(null);

  function mostrarTooltip() {
    if (!recortado || !barraRef.current) return;
    const rect = barraRef.current.getBoundingClientRect();
    setTooltip({
      left: Math.min(Math.max(8, rect.left), window.innerWidth - ANCHO_TOOLTIP - 8),
      top: rect.bottom + 6,
    });
  }

  return (
    <>
      <VerMaterial links={entrada.links_material}>
        <div
          ref={barraRef}
          onMouseEnter={mostrarTooltip}
          onMouseLeave={() => setTooltip(null)}
          style={{
            minHeight: 30,
            borderRadius: 6,
            background: color,
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.3,
            padding: '5px 7px',
            whiteSpace: 'pre-line',
          }}
        >
          {texto}
        </div>
      </VerMaterial>
      {tooltip &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: tooltip.left,
              top: tooltip.top,
              width: ANCHO_TOOLTIP,
              // Arriba del overlay del modal (2000), abajo del popover de
              // material (3000), que es el que se abre por click.
              zIndex: 2500,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              padding: '10px 12px',
              fontSize: 12,
              lineHeight: 1.45,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-line',
              pointerEvents: 'none',
            }}
          >
            {entrada.tema_campana}
          </div>,
          document.body
        )}
    </>
  );
}

export default function LineaTiempoMedios({ series, semanas: cantidadSemanas }) {
  const semanas = semanasAMostrar(series, cantidadSemanas);

  if (semanas.length === 0) {
    return (
      <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
        No hay datos históricos cargados para esta localidad.
      </p>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thEstilo}>Tipo de medio</th>
          {semanas.map((fecha) => (
            <th key={fecha} style={thEstilo}>
              {formatearFechaCorta(fecha)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {TIPOS_MEDIO.map((tipo) => {
          const celdas = celdasConColor(series?.[tipo.key], semanas);
          return (
            <tr key={tipo.key}>
              <td style={{ ...tdEstilo, fontWeight: 600, whiteSpace: 'nowrap' }}>{tipo.label}</td>
              {celdas.map(({ fecha, entrada, color }) => (
                <td key={fecha} style={tdEstilo}>
                  {entrada ? (
                    <BarraTema entrada={entrada} color={color} />
                  ) : (
                    <div
                      title="Sin dato esa semana"
                      style={{ minHeight: 30, borderRadius: 6, background: 'var(--bg-secondary)' }}
                    />
                  )}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const thEstilo = {
  textAlign: 'left',
  padding: '6px 8px',
  fontSize: 12,
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const tdEstilo = { padding: '5px 8px', fontSize: 13, minWidth: 70, verticalAlign: 'top' };
