import Link from 'next/link';
import CoverageBadge from './CoverageBadge';
import { slugificar } from '../lib/texto';

export default function LocalidadCard({ localidad, departamento, bandaCobertura, totalTipos, tienePautaDigital, tieneAudiovisuales }) {
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
      <div style={{ fontSize: 15, fontWeight: 700 }}>{localidad}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 12 }}>{departamento}</div>
      <CoverageBadge banda={bandaCobertura} totalTipos={totalTipos} compacto />
      {(tienePautaDigital || tieneAudiovisuales) && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tienePautaDigital && <span style={etiquetaExtra}>+ Pauta digital</span>}
          {tieneAudiovisuales && <span style={etiquetaExtra}>+ Audiovisuales</span>}
        </div>
      )}
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
