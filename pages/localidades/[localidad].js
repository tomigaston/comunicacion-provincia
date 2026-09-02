import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import CoverageBadge from '../../components/CoverageBadge';
import StatusBadge from '../../components/StatusBadge';
import AnioBadge from '../../components/AnioBadge';
import FiltroPeriodo from '../../components/FiltroPeriodo';
import VerMaterial, { enlaceEstilo } from '../../components/VerMaterial';
import ModalLineaTiempoMedios from '../../components/ModalLineaTiempoMedios';
import MensajeTruncado from '../../components/MensajeTruncado';
import SemaforoBadge from '../../components/SemaforoBadge';
import { useApiData } from '../../lib/useApiData';
import { normalizarTexto, slugificar } from '../../lib/texto';
import { formatearFechaCorta, calcularVentana, fechaDentroDeVentana, rangoDentroDeVentana, rangoFechaDesdeHasta } from '../../lib/fechas';
import { TIPOS_MEDIO } from '../../lib/tiposMedio';

const PERIODO_DEFAULT = { tipo: 'preset', valor: 'ultimo_mes' };

// Chips de canal del bloque Pauta digital, mismo patrón visual que los chips
// de TIPOS_MEDIO de Medios tradicionales. IG/FB/YT salen de las columnas de
// link propias (ya vienen resueltas a null salvo que contengan un link http
// real, ver limpiar_link() en generar_datos.py); Google Ads no tiene columna
// de link propia en el excel fuente, así que se usa PLATAFORMA="Google Ads"
// como señal de que la pieza es de ese canal.
const CANALES_PAUTA = [
  { key: 'ig', label: 'Instagram' },
  { key: 'fb', label: 'Facebook' },
  { key: 'yt', label: 'YouTube' },
  { key: 'google', label: 'Google (Search/Display)' },
];

function canalesDePieza(p) {
  const canales = [];
  if (p.link_ig) canales.push('ig');
  if (p.link_fb) canales.push('fb');
  if (p.link_yt) canales.push('yt');
  if (p.plataforma === 'Google Ads') canales.push('google');
  return canales;
}

/** Badges de canal para una fila de la tabla (subconjunto de CANALES_PAUTA
 * que aplica a esa pieza puntual, no toda la localidad). */
function CanalBadges({ pieza }) {
  const canales = canalesDePieza(pieza);
  if (canales.length === 0) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {canales.map((key) => (
        <span key={key} style={badgeCanal}>
          {CANALES_PAUTA.find((c) => c.key === key).label.split(' ')[0]}
        </span>
      ))}
    </div>
  );
}

export default function DetalleLocalidad() {
  const router = useRouter();
  const slug = typeof router.query.localidad === 'string' ? router.query.localidad : '';

  const { cargando, error, datos } = useApiData([
    '/api/data/localidades',
    '/api/data/medios-tradicionales',
    '/api/data/pauta-digital',
    '/api/data/audiovisuales',
    '/api/data/sms',
    '/api/data/contenido-organico',
  ]);

  const [periodo, setPeriodo] = useState(PERIODO_DEFAULT);
  const ventana = useMemo(() => calcularVentana(periodo), [periodo]);
  const [modalTimelineAbierto, setModalTimelineAbierto] = useState(false);

  // Datos base de la localidad, SIN filtrar por período — de acá sale tanto
  // lo que se termina mostrando (una vez aplicado el filtro) como la lista
  // de meses reales para el dropdown "mes puntual".
  const info = useMemo(() => {
    if (!datos || !slug) return null;
    const [localidadesData, mediosData, pautaData, audiovisualesData, smsData, contenidoOrganicoData] = datos;

    const base = localidadesData.localidades.find((l) => slugificar(l.localidad) === slug);
    if (!base) return { noEncontrada: true };

    const clave = normalizarTexto(base.localidad);
    const medios = mediosData.localidades.find((l) => normalizarTexto(l.localidad) === clave);

    const piezasPauta = pautaData.piezas
      .filter(
        (p) =>
          p.en_60_localidades &&
          // alcance_tipo (derivado de Alcance_Detectado en generar_datos.py) manda:
          // solo LOCALIDAD/CAPITAL/BARRIO ('localidad') atan por texto de Localidad.
          // Regla sin excepciones: una pieza se atribuye a esta Localidad SOLO si su
          // Localidad puntual es una de las 60 y coincide con esta. Todo lo demás
          // (DEPARTAMENTO, PROVINCIA, y lo que quedó sin tipo: REGION/CIRCUITO/
          // CODIGO_AUDIENCIA/OTRO) no se atribuye a ninguna localidad — ni siquiera
          // por Departamento en común.
          p.alcance_tipo === 'localidad' && normalizarTexto(p.localidad) === clave
      )
      .sort((a, b) => (b.finalizacion || '').localeCompare(a.finalizacion || ''));

    const itemsAudiovisuales = audiovisualesData.items
      .filter((i) => i.en_60_prioritarias && normalizarTexto(i.localidad) === clave)
      .sort((a, b) => (b.fecha_fin || b.fecha_inicio || '').localeCompare(a.fecha_fin || a.fecha_inicio || ''));

    // Mismo criterio que Pauta digital: solo se atribuye a ESTA localidad
    // cuando algún alcance del envío es tipo "localidad" y coincide por
    // nombre — un alcance "departamento" en el mismo envío no cuenta acá
    // (eso es lo que ve el Departamento contenedor, no esta localidad puntual).
    const enviosSms = (smsData.envios || [])
      .filter((e) => e.alcances.some((a) => a.tipo === 'localidad' && normalizarTexto(a.localidad) === clave))
      .sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || ''));

    // Solo cuenta como atribuida a ESTA localidad si su LUGAR resolvió
    // exactamente a esta localidad (una de las 60) — igual que Pauta Digital
    // y SMS, acá tampoco hay fallback a Departamento (ver 3.5 del CONTEXTO):
    // el ámbito provincial ("Toda la provincia") nunca cuenta como esta
    // localidad puntual.
    const publicacionesOrganico = (contenidoOrganicoData.publicaciones || [])
      .filter((p) => (p.localidades || []).some((l) => normalizarTexto(l) === clave))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    return { base, medios, piezasPauta, itemsAudiovisuales, enviosSms, publicacionesOrganico };
  }, [datos, slug]);

  // Fechas reales de esta localidad (las 3 áreas juntas), para armar el
  // dropdown "mes puntual" del filtro — nunca una lista de meses hardcodeada.
  const fechasDisponibles = useMemo(() => {
    if (!info || info.noEncontrada) return [];
    const fechas = [];
    if (info.medios) info.medios.vigentes.forEach((v) => fechas.push(v.fecha_hasta || v.fecha_desde));
    info.piezasPauta.forEach((p) => fechas.push(p.finalizacion));
    info.itemsAudiovisuales.forEach((it) => fechas.push(it.fecha_fin || it.fecha_inicio));
    info.enviosSms.forEach((e) => fechas.push(e.fecha_inicio));
    info.publicacionesOrganico.forEach((p) => fechas.push(p.fecha));
    return fechas;
  }, [info]);

  // Listas efectivamente visibles, ya con el filtro de período aplicado.
  const visible = useMemo(() => {
    if (!info || info.noEncontrada) return null;
    return {
      vigentes: info.medios
        ? info.medios.vigentes.filter((v) => fechaDentroDeVentana(v.fecha_hasta || v.fecha_desde, ventana))
        : [],
      piezasPauta: info.piezasPauta.filter((p) => rangoDentroDeVentana(p.inicio, p.finalizacion, ventana)),
      itemsAudiovisuales: info.itemsAudiovisuales.filter((it) =>
        fechaDentroDeVentana(it.fecha_fin || it.fecha_inicio, ventana)
      ),
      enviosSms: info.enviosSms.filter((e) => fechaDentroDeVentana(e.fecha_inicio, ventana)),
      publicacionesOrganico: info.publicacionesOrganico.filter((p) => fechaDentroDeVentana(p.fecha, ventana)),
    };
  }, [info, ventana]);

  // Canales con al menos una pieza dentro del período elegido (mismo cálculo
  // que ya filtra visible.piezasPauta), para los chips del bloque Pauta
  // digital.
  const canalesActivos = useMemo(
    () => new Set(visible ? visible.piezasPauta.flatMap(canalesDePieza) : []),
    [visible]
  );

  return (
    <Layout title={info && info.base ? info.base.localidad : 'Localidad'}>
      <Link href="/localidades" style={{ fontSize: 13.5, color: 'var(--accent)' }}>
        &larr; Volver a Localidades
      </Link>

      {cargando && <p style={{ marginTop: 16 }}>Cargando...</p>}
      {error && (
        <p style={{ marginTop: 16, color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>
      )}
      {info && info.noEncontrada && (
        <p style={{ marginTop: 16 }}>No encontramos esta localidad entre las 60 prioritarias.</p>
      )}

      {info && info.base && (
        <div style={{ marginTop: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{info.base.localidad}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Departamento {info.base.departamento}
            {info.base.poblacion ? ` · ${info.base.poblacion.toLocaleString('es-AR')} habitantes` : ''}
          </p>

          <div
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '14px 18px',
              marginBottom: 20,
            }}
          >
            <FiltroPeriodo periodo={periodo} onChange={setPeriodo} fechasDisponibles={fechasDisponibles} />
            <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8 }}>
              Se aplica a las 3 áreas de esta localidad. Los datos de Medios tradicionales y Pauta
              digital sin fecha de referencia dentro del período elegido quedan afuera.
            </p>
          </div>

          <Seccion titulo="Medios tradicionales">
            {info.medios ? (
              <>
                <div style={{ marginBottom: 14 }}>
                  <CoverageBadge banda={info.medios.banda_cobertura} totalTipos={info.medios.total_tipos} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                  {TIPOS_MEDIO.map((tipo) => {
                    const presente = !!info.medios.cobertura[tipo.key];
                    return (
                      <span
                        key={tipo.key}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 999,
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: presente ? 'var(--cov-alta-bg)' : 'var(--bg-secondary)',
                          color: presente ? 'var(--cov-alta)' : 'var(--text-tertiary)',
                        }}
                      >
                        {presente ? '✓' : '—'} {tipo.label}
                      </span>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setModalTimelineAbierto(true)}
                  style={{ ...enlaceEstilo, display: 'block', marginBottom: 14 }}
                >
                  Ver línea de tiempo completa
                </button>

                {info.medios.vigentes.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                    No hay ningún tema vigente cargado para esta localidad.
                  </p>
                ) : visible.vigentes.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                    Ningún tema vigente cae dentro del período elegido (hay {info.medios.vigentes.length}{' '}
                    en total). Probá con "Todo".
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                        <th style={th}>Tipo de medio</th>
                        <th style={th}>Tema</th>
                        <th style={th}>Vigencia</th>
                        <th style={th}>Material</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.vigentes.map((v, i) => {
                        const rangoVigencia = rangoFechaDesdeHasta(v.fecha_desde, v.fecha_hasta);
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={td}>{v.tipo_medio}</td>
                            <td style={{ ...td, whiteSpace: 'pre-wrap' }}>{v.tema}</td>
                            <td style={td}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span>{rangoVigencia || '—'}</span>
                                <SemaforoBadge alerta={v.alerta} antiguedadDias={v.antiguedad_dias} />
                              </div>
                            </td>
                            <td style={td}>
                              <VerMaterial links={v.links_material} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>Sin datos de medios tradicionales.</p>
            )}
          </Seccion>

          {modalTimelineAbierto && info.medios && (
            <ModalLineaTiempoMedios
              localidad={info.base.localidad}
              semanasCargadas={datos[1].semanas_cargadas}
              onCerrar={() => setModalTimelineAbierto(false)}
            />
          )}

          {info.piezasPauta.length > 0 && (
            <Seccion titulo="Pauta digital">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                {CANALES_PAUTA.map((canal) => {
                  const presente = canalesActivos.has(canal.key);
                  return (
                    <span
                      key={canal.key}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 999,
                        fontSize: 12.5,
                        fontWeight: 600,
                        background: presente ? 'var(--cov-alta-bg)' : 'var(--bg-secondary)',
                        color: presente ? 'var(--cov-alta)' : 'var(--text-tertiary)',
                      }}
                    >
                      {presente ? '✓' : '—'} {canal.label}
                    </span>
                  );
                })}
              </div>

              {visible.piezasPauta.length === 0 ? (
                <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                  Ninguna pieza de pauta digital cae dentro del período elegido (hay{' '}
                  {info.piezasPauta.length} en total). Probá con "Todo".
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={th}>Título de la pieza</th>
                      <th style={th}>Canal</th>
                      <th style={th}>Tipo de pauta</th>
                      <th style={th}>Plataforma</th>
                      <th style={th}>Vigente hasta</th>
                      <th style={th}>Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.piezasPauta.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={td}>{p.titulo_pieza || '—'}</td>
                        <td style={td}>
                          <CanalBadges pieza={p} />
                        </td>
                        <td style={td}>{p.tipo_pauta || '—'}</td>
                        <td style={td}>{p.plataforma || '—'}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{formatearFechaCorta(p.finalizacion) || '—'}</span>
                            <StatusBadge estado={p.estado} />
                          </div>
                        </td>
                        <td style={td}>
                          <VerMaterial links={p.links_material} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Seccion>
          )}

          {info.itemsAudiovisuales.length > 0 && (
            <Seccion titulo="Audiovisuales">
              {visible.itemsAudiovisuales.length === 0 ? (
                <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                  Ningún contenido audiovisual cae dentro del período elegido (hay{' '}
                  {info.itemsAudiovisuales.length} en total — varios sin fecha cargada, por eso no
                  entran salvo con "Todo"). Probá con "Todo".
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={th}>Campaña</th>
                      <th style={th}>Tipo de contenido</th>
                      <th style={th}>Fecha</th>
                      <th style={th}>Estado</th>
                      <th style={th}>Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.itemsAudiovisuales.map((it, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={td}>{it.campana}</td>
                        <td style={td}>{it.tipo_contenido}</td>
                        <td style={td}>
                          <AnioBadge fechaInicio={it.fecha_inicio} fechaFin={it.fecha_fin} />
                        </td>
                        <td style={td}>
                          <StatusBadge estado={it.estado} />
                        </td>
                        <td style={td}>
                          <VerMaterial links={it.links} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Seccion>
          )}

          {info.enviosSms.length > 0 && (
            <Seccion titulo="SMS">
              {visible.enviosSms.length === 0 ? (
                <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                  Ningún envío de SMS cae dentro del período elegido (hay {info.enviosSms.length}{' '}
                  en total). Probá con "Todo".
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={th}>Fecha</th>
                      <th style={th}>Eje</th>
                      <th style={th}>Temática</th>
                      <th style={{ ...th, minWidth: 220 }}>Mensaje</th>
                      <th style={th}>SMS entregados</th>
                      <th style={th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.enviosSms.map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={td}>{formatearFechaCorta(e.fecha_inicio) || '—'}</td>
                        <td style={td}>{e.eje || '—'}</td>
                        <td style={td}>{e.tematica || '—'}</td>
                        <td style={{ ...td, maxWidth: 340 }}>
                          <MensajeTruncado mensaje={e.mensaje} />
                        </td>
                        <td style={td}>
                          {typeof e.cantidad_sms_entregados === 'number'
                            ? e.cantidad_sms_entregados.toLocaleString('es-AR')
                            : '—'}
                        </td>
                        <td style={td}>{e.estado || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Seccion>
          )}

          {info.publicacionesOrganico.length > 0 && (
            <Seccion titulo="Contenido Orgánico">
              {visible.publicacionesOrganico.length === 0 ? (
                <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                  Ninguna publicación cae dentro del período elegido (hay{' '}
                  {info.publicacionesOrganico.length} en total). Probá con "Todo".
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={th}>Fecha</th>
                      <th style={th}>Red Social</th>
                      <th style={{ ...th, minWidth: 220 }}>Nombre del contenido</th>
                      <th style={th}>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.publicacionesOrganico.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={td}>{formatearFechaCorta(p.fecha) || '—'}</td>
                        <td style={td}>{p.red_social || '—'}</td>
                        <td style={td}>{p.nombre_contenido || '—'}</td>
                        <td style={td}>
                          <VerMaterial links={p.link ? [p.link] : []} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Seccion>
          )}
        </div>
      )}
    </Layout>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 18,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{titulo}</h2>
      {children}
    </div>
  );
}

const th = { padding: '8px 10px', fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 };
const td = { padding: '10px 10px', fontSize: 13.5 };
const badgeCanal = {
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 600,
  background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)',
};
