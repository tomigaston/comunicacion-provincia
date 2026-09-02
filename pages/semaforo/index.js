import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import SemaforoBadge from '../../components/SemaforoBadge';
import { useAlertas } from '../../lib/useAlertas';
import { pesoDeColor } from '../../lib/semaforo';
import { slugificar } from '../../lib/texto';

const VISTAS = [
  { key: 'grilla', label: 'Grilla' },
  { key: 'lista', label: 'Lista' },
];

/** Peor primero (🔴 > 🟡 > 🟢 > sin alerta); dentro de un mismo color, mayor
 * antigüedad primero; sin alerta al final, ordenadas alfabéticamente entre
 * sí (no hay antigüedad de referencia para ordenarlas). */
function compararAlertas(a, b) {
  const pesoA = pesoDeColor(a.colorGeneral);
  const pesoB = pesoDeColor(b.colorGeneral);
  if (pesoA !== pesoB) return pesoB - pesoA;
  if (pesoA === -1) return a.localidad.localeCompare(b.localidad, 'es');
  return (b.antiguedadGeneral ?? 0) - (a.antiguedadGeneral ?? 0);
}

export default function SemaforoIndex() {
  const router = useRouter();
  const { cargando, error, alertas } = useAlertas();
  const [vista, setVista] = useState('grilla');

  const ordenadas = useMemo(() => {
    if (!alertas) return [];
    return [...alertas].sort(compararAlertas);
  }, [alertas]);

  return (
    <Layout title="Semáforo">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Semáforo de antigüedad</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Medios Tradicionales y Pauta Digital, peor caso por área. Sin badge = sin dato de vigencia
            cargado todavía (no es "verde por default").
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 999, padding: 3 }}>
          {VISTAS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setVista(v.key)}
              style={{
                padding: '7px 16px',
                borderRadius: 999,
                border: 'none',
                background: vista === v.key ? 'var(--bg-primary)' : 'transparent',
                color: vista === v.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: vista === v.key ? 700 : 500,
                fontSize: 13.5,
                cursor: 'pointer',
                boxShadow: vista === v.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {cargando && <p>Cargando datos del tablero...</p>}
      {error && <p style={{ color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>}

      {!cargando && !error && ordenadas.length > 0 && (
        vista === 'grilla' ? <VistaGrilla localidades={ordenadas} router={router} /> : <VistaLista localidades={ordenadas} router={router} />
      )}
    </Layout>
  );
}

function VistaGrilla({ localidades, router }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 14,
      }}
    >
      {localidades.map((l) => (
        <div
          key={l.localidad}
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/localidades/${slugificar(l.localidad)}`)}
          onKeyDown={(e) => e.key === 'Enter' && router.push(`/localidades/${slugificar(l.localidad)}`)}
          style={{
            cursor: 'pointer',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px 18px',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>{l.localidad}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 12 }}>{l.departamento}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <BadgeConEtiqueta etiqueta="Medios Trad." alerta={l.alertaMedios} />
            <BadgeConEtiqueta etiqueta="Pauta Digital" alerta={l.alertaPautaDigital} />
          </div>
        </div>
      ))}
    </div>
  );
}

function VistaLista({ localidades, router }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
          <th style={th}>Localidad</th>
          <th style={th}>Departamento</th>
          <th style={th}>Medios Tradicionales</th>
          <th style={th}>Pauta Digital</th>
        </tr>
      </thead>
      <tbody>
        {localidades.map((l) => (
          <tr
            key={l.localidad}
            onClick={() => router.push(`/localidades/${slugificar(l.localidad)}`)}
            style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
          >
            <td style={{ ...td, fontWeight: 600 }}>{l.localidad}</td>
            <td style={{ ...td, color: 'var(--text-secondary)' }}>{l.departamento}</td>
            <td style={td}>
              <SemaforoBadge alerta={l.alertaMedios} />
            </td>
            <td style={td}>
              <SemaforoBadge alerta={l.alertaPautaDigital} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BadgeConEtiqueta({ etiqueta, alerta }) {
  if (!alerta) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{etiqueta}</span>
      <SemaforoBadge alerta={alerta} compacto />
    </div>
  );
}

const th = { padding: '8px 10px', fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 };
const td = { padding: '10px 10px', fontSize: 13.5 };
