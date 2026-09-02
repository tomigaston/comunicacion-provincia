import AnioBadge from './AnioBadge';
import VerMaterial from './VerMaterial';
import { rangoFechaDesdeHasta } from '../lib/fechas';

const AREA_COLOR = {
  'Medios tradicionales': { bg: '#e0edfb', fg: '#1976d2' },
  'Pauta digital': { bg: '#fce7f3', fg: '#be185d' },
  Audiovisuales: { bg: '#ede9fe', fg: '#6d28d9' },
};

function alcanceLabel(item) {
  if (item.alcance_tipo === 'provincia') return 'Toda la provincia';
  if (item.alcance_tipo === 'departamento') return `Depto. ${item.departamento}`;
  return item.localidad || item.departamento || '—';
}

function detalleTexto(item) {
  const d = item.detalle || {};
  if (item.area_origen === 'Pauta digital') {
    return d.estado || '—';
  }
  return '—';
}

function DetalleMediosTradicionales({ detalle }) {
  const d = detalle || {};
  const rangoVigencia = rangoFechaDesdeHasta(d.fecha_desde, d.fecha_hasta);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span>
        {[d.tipo_medio, rangoVigencia].filter(Boolean).join(' · ') || '—'}
      </span>
      <VerMaterial links={d.links_material} />
    </div>
  );
}

function DetalleAudiovisuales({ detalle }) {
  const d = detalle || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <AnioBadge fechaInicio={d.fecha_inicio} fechaFin={d.fecha_fin} />
      <span>{[d.tipo_contenido, d.estado].filter(Boolean).join(' · ') || '—'}</span>
      <VerMaterial links={d.links} />
    </div>
  );
}

export default function CampanaRow({ item }) {
  const cfg = AREA_COLOR[item.area_origen] || { bg: 'var(--bg-secondary)', fg: 'var(--text-secondary)' };
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={celda}>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 999,
            background: cfg.bg,
            color: cfg.fg,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {item.area_origen}
        </span>
      </td>
      <td style={{ ...celda, maxWidth: 420, whiteSpace: 'pre-wrap' }}>{item.campana || '—'}</td>
      <td style={celda}>{alcanceLabel(item)}</td>
      <td style={{ ...celda, color: 'var(--text-secondary)', fontSize: 13 }}>
        {item.area_origen === 'Audiovisuales' ? (
          <DetalleAudiovisuales detalle={item.detalle} />
        ) : item.area_origen === 'Medios tradicionales' ? (
          <DetalleMediosTradicionales detalle={item.detalle} />
        ) : (
          detalleTexto(item)
        )}
      </td>
    </tr>
  );
}

const celda = { padding: '10px 14px', fontSize: 13.5, verticalAlign: 'top' };
