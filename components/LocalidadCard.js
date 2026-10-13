import Link from 'next/link';
import CoverageBadge from './CoverageBadge';
import { slugificar } from '../lib/texto';
import { textoVencimiento } from '../lib/coverage';

// Eje B (Pauta Digital viva dirigida a la localidad): color por proximidad a FIN.
const COLOR_EJE_PD = {
  '🔴': { fg: 'var(--cov-baja)', bg: 'var(--cov-baja-bg)' },
  '🟡': { fg: 'var(--cov-media)', bg: 'var(--cov-media-bg)' },
  '🟢': { fg: 'var(--cov-alta)', bg: 'var(--cov-alta-bg)' },
};

export default function LocalidadCard({
  localidad,
  departamento,
  bandaCobertura,
  totalTipos,
  ejePD,
}) {
  return (
    <Link
      href={`/localidades/${slugificar(localidad)}`}
      style={{
        display: 'block',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{localidad}</div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 12 }}>{departamento}</div>
      <CoverageBadge banda={bandaCobertura} totalTipos={totalTipos} compacto />
      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ejePD ? (
          <span
            style={{ ...etiquetaExtra, background: COLOR_EJE_PD[ejePD.color].bg, color: COLOR_EJE_PD[ejePD.color].fg, fontWeight: 600 }}
            title={`${ejePD.piezas} pieza${ejePD.piezas === 1 ? '' : 's'} de pauta digital viva dirigida a la localidad`}
          >
            PD activa · {textoVencimiento(ejePD.dias)} {ejePD.color}
          </span>
        ) : (
          <span style={etiquetaExtra} title="Sin pauta digital viva dirigida a esta localidad">
            Sin PD viva
          </span>
        )}
      </div>
    </Link>
  );
}

const etiquetaExtra = {
  fontSize: 11.5,
  color: 'var(--text-secondary)',
  background: 'var(--bg-secondary)',
  padding: '2px 8px',
  borderRadius: 999,
};
