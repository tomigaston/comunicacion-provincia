import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import SemaforoBadge from '../../components/SemaforoBadge';
import SemaforoPDBadge from '../../components/SemaforoPDBadge';
import { useAlertas } from '../../lib/useAlertas';
import { pesoDeColor, PD_MIN_AMARILLO, PD_MIN_VERDE, PD_DIAS_VENTANA, AVISO_PD } from '../../lib/semaforo';
import { textoActivasPD, textoVencimiento } from '../../lib/coverage';
import { formatearFechaDiaMes } from '../../lib/fechas';
import { slugificar } from '../../lib/texto';

const textoTemas = (n) => `${n} ${n === 1 ? 'tema sin cambios' : 'temas sin cambios'} hace 30+ días`;

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
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Semáforo</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Medios Tradicionales: peor entre frescura (tema activo más reciente) y cobertura (tipos de
            medio con tema activo). Pauta Digital: cantidad de piezas activas en la localidad, dirigidas y
            provinciales (0–{PD_MIN_AMARILLO - 1} 🔴 · {PD_MIN_AMARILLO}–{PD_MIN_VERDE - 1} 🟡 · {PD_MIN_VERDE}+ 🟢). Tocá una localidad para ver el detalle.
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
  const [abierta, setAbierta] = useState(null);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
      {localidades.map((l) => {
        const expandida = abierta === l.localidad;
        return (
          <div
            key={l.localidad}
            role="button"
            tabIndex={0}
            onClick={() => setAbierta(expandida ? null : l.localidad)}
            onKeyDown={(e) => e.key === 'Enter' && setAbierta(expandida ? null : l.localidad)}
            style={{
              cursor: 'pointer',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '16px 18px',
              gridColumn: expandida ? '1 / -1' : undefined,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700 }}>{l.localidad}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 12 }}>{l.departamento}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <BadgeConEtiqueta etiqueta="Medios Trad." alerta={l.alertaMedios} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Pauta Digital</span>
                <SemaforoPDBadge pd={l.semaforoPD} />
              </div>
            </div>
            {expandida && <DetalleMedios l={l} router={router} />}
          </div>
        );
      })}
    </div>
  );
}

function VistaLista({ localidades, router }) {
  const [abierta, setAbierta] = useState(null);
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
        {localidades.map((l) => {
          const expandida = abierta === l.localidad;
          return (
            <Fragment key={l.localidad}>
              <tr
                onClick={() => setAbierta(expandida ? null : l.localidad)}
                style={{ borderBottom: expandida ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
              >
                <td style={{ ...td, fontWeight: 600 }}>{l.localidad}</td>
                <td style={{ ...td, color: 'var(--text-secondary)' }}>{l.departamento}</td>
                <td style={td}>
                  <SemaforoBadge alerta={l.alertaMedios} />
                </td>
                <td style={td}>
                  <SemaforoPDBadge pd={l.semaforoPD} />
                </td>
              </tr>
              {expandida && (
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td} colSpan={4}>
                    <DetalleMedios l={l} router={router} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/** Detalle de la localidad. Medios Tradicionales: por qué dio ese color
 * (motivo) y temas activos con fecha sin cambios hace 30+ días (independiente
 * del color). Pauta Digital: ver DetallePD. */
function DetalleMedios({ l, router }) {
  const sm = l.semaforoMedios;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 13 }}
    >
      {sm ? (
        <>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Medios Tradicionales</div>
          {sm.motivo.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>
              Frescura y cobertura en verde ({sm.frescura.dias} días desde el tema activo más reciente; {sm.cobertura.tipos} de{' '}
              {sm.cobertura.total} tipos de medio activos).
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)' }}>
              {sm.motivo.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {sm.estancados.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{textoTemas(sm.estancados.length)}</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {sm.estancados.map((v, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>
                    <SemaforoBadge alerta={v.alerta} antiguedadDias={v.antiguedad_dias} compacto />{' '}
                    {v.tema} <span style={{ color: 'var(--text-tertiary)' }}>· {v.tipo_medio} · {v.antiguedad_dias} días</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p style={{ color: 'var(--text-tertiary)' }}>Sin datos de medios tradicionales.</p>
      )}
      <DetallePD pd={l.semaforoPD} />
      <button
        type="button"
        onClick={() => router.push(`/localidades/${slugificar(l.localidad)}`)}
        style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12.5, padding: 0 }}
      >
        Ver ficha de la localidad
      </button>
    </div>
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

const TEXTO_AVISO_PD = {
  [AVISO_PD.ATENCION]: (pd) =>
    `⚠️ Atención: si no se renueva lo que vence en los próximos ${PD_DIAS_VENTANA} días, pasa de ${pd.color} a ${pd.colorActivasDespues} (quedarían ${pd.activasDespues} activas; con las Programadas, ${pd.conProgramadas}).`,
  [AVISO_PD.CUBIERTO]: (pd) =>
    `ℹ️ Cubierto por programadas: lo que vence en los próximos ${PD_DIAS_VENTANA} días la bajaría a ${pd.colorActivasDespues} (${pd.activasDespues} activas), pero con las Programadas que arrancan queda en ${pd.colorConProgramadas} (${pd.conProgramadas}).`,
};

/** Detalle de Pauta Digital: activas con desglose, aviso de la ventana de 7
 * días, próximo vencimiento y Programadas que arrancan en la ventana. */
function DetallePD({ pd }) {
  const prog = pd.programadasVentana;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Pauta Digital</div>
      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)' }}>
        <li>
          {pd.color} {textoActivasPD(pd)}
        </li>
        {pd.aviso && <li style={{ color: 'var(--text-primary)' }}>{TEXTO_AVISO_PD[pd.aviso](pd)}</li>}
        <li>
          {pd.proximoVencimiento
            ? `Próximo vencimiento: ${formatearFechaDiaMes(pd.proximoVencimiento)} (${textoVencimiento(pd.diasProximoVencimiento)})`
            : 'Sin piezas activas que venzan'}
        </li>
        <li>
          {prog.cantidad > 0
            ? `Programadas que arrancan en los próximos ${PD_DIAS_VENTANA} días: ${prog.cantidad} (la primera el ${formatearFechaDiaMes(prog.fechaMasProxima)})`
            : `Sin Programadas que arranquen en los próximos ${PD_DIAS_VENTANA} días`}
        </li>
      </ul>
    </div>
  );
}

const th = { padding: '8px 10px', fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 };
const td = { padding: '10px 10px', fontSize: 13.5 };
