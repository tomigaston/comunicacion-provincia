import Link from 'next/link';
import CoverageBadge from './CoverageBadge';
import SemaforoBadge from './SemaforoBadge';
import { slugificar } from '../lib/texto';

export default function LocalidadCard({
  localidad,
  departamento,
  bandaCobertura,
  totalTipos,
  tienePautaDigital,
  tieneAudiovisuales,
  alertaMedios,
  alertaPautaDigital,
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
        {(alertaMedios || alertaPautaDigital) && (
          <div style={{ display: 'flex', gap: 4 }}>
            {alertaMedios && (
              <span title="Medios tradicionales — peor caso de antigüedad">
                <SemaforoBadge alerta={alertaMedios} compacto />
              </span>
            )}
            {alertaPautaDigital && (
              <span title="Pauta digital — peor caso de antigüedad">
                <SemaforoBadge alerta={alertaPautaDigital} compacto />
              </span>
            )}
          </div>
        )}
      </div>
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
