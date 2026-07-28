import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import CoverageBadge from '../../components/CoverageBadge';
import StatusBadge from '../../components/StatusBadge';
import AnioBadge from '../../components/AnioBadge';
import FiltroPeriodo from '../../components/FiltroPeriodo';
import { useApiData } from '../../lib/useApiData';
import { normalizarTexto, slugificar } from '../../lib/texto';
import { formatearFechaCorta, calcularVentana, fechaDentroDeVentana } from '../../lib/fechas';

const PERIODO_DEFAULT = { tipo: 'preset', valor: 'ultimo_mes' };

const TIPOS_MEDIO = [
  { key: 'TV', label: 'TV' },
  { key: 'RADIO', label: 'Radio' },
  { key: 'WEB', label: 'Web' },
  { key: 'CARTELERIA', label: 'Cartelería' },
  { key: 'VIA_PUBLICA', label: 'Vía pública' },
  { key: 'GRAFICA', label: 'Gráfica' },
  { key: 'PANTALLA_LED', label: 'Pantalla LED' },
];

export default function DetalleLocalidad() {
  const router = useRouter();
  const slug = typeof router.query.localidad === 'string' ? router.query.localidad : '';

  const { cargando, error, datos } = useApiData([
    '/api/data/localidades',
    '/api/data/medios-tradicionales',
    '/api/data/pauta-digital',
    '/api/data/audiovisuales',
  ]);

  const [periodo, setPeriodo] = useState(PERIODO_DEFAULT);
  const ventana = useMemo(() => calcularVentana(periodo), [periodo]);

  // Datos base de la localidad, SIN filtrar por período — de acá sale tanto
  // lo que se termina mostrando (una vez aplicado el filtro) como la lista
  // de meses reales para el dropdown "mes puntual".
  const info = useMemo(() => {
    if (!datos || !slug) return null;
    const [localidadesData, mediosData, pautaData, audiovisualesData] = datos;

    const base = localidadesData.localidades.find((l) => slugificar(l.localidad) === slug);
    if (!base) return { noEncontrada: true };

    const clave = normalizarTexto(base.localidad);
    const medios = mediosData.localidades.find((l) => normalizarTexto(l.localidad) === clave);

    const piezasPauta = pautaData.piezas
      .filter(
        (p) =>
          p.en_60_localidades &&
          (normalizarTexto(p.localidad) === clave ||
            (p.alcance_tipo === 'departamento' && normalizarTexto(p.departamento) === normalizarTexto(base.departamento)))
      )
      .sort((a, b) => (b.finalizacion || '').localeCompare(a.finalizacion || ''));

    const itemsAudiovisuales = audiovisualesData.items
      .filter((i) => i.en_60_prioritarias && normalizarTexto(i.localidad) === clave)
      .sort((a, b) => (b.fecha_fin || b.fecha_inicio || '').localeCompare(a.fecha_fin || a.fecha_inicio || ''));

    return { base, medios, piezasPauta, itemsAudiovisuales };
  }, [datos, slug]);

  // Fechas reales de esta localidad (las 3 áreas juntas), para armar el
  // dropdown "mes puntual" del filtro — nunca una lista de meses hardcodeada.
  const fechasDisponibles = useMemo(() => {
    if (!info || info.noEncontrada) return [];
    const fechas = [];
    if (info.medios) info.medios.vigentes.forEach((v) => fechas.push(v.fecha_ultima_semana));
    info.piezasPauta.forEach((p) => fechas.push(p.finalizacion));
    info.itemsAudiovisuales.forEach((it) => fechas.push(it.fecha_fin || it.fecha_inicio));
    return fechas;
  }, [info]);

  // Listas efectivamente visibles, ya con el filtro de período aplicado.
  const visible = useMemo(() => {
    if (!info || info.noEncontrada) return null;
    return {
      vigentes: info.medios ? info.medios.vigentes.filter((v) => fechaDentroDeVentana(v.fecha_ultima_semana, ventana)) : [],
      piezasPauta: info.piezasPauta.filter((p) => fechaDentroDeVentana(p.finalizacion, ventana)),
      itemsAudiovisuales: info.itemsAudiovisuales.filter((it) =>
        fechaDentroDeVentana(it.fecha_fin || it.fecha_inicio, ventana)
      ),
    };
  }, [info, ventana]);

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
                        <th style={th}>Tema vigente</th>
                        <th style={th}>Semanas seguidas</th>
                        <th style={th}>Material</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.vigentes.map((v, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={td}>{v.tipo_medio}</td>
                          <td style={{ ...td, whiteSpace: 'pre-wrap' }}>{v.tema_vigente}</td>
                          <td style={td}>{v.semanas_consecutivas}</td>
                          <td style={td}>
                            {v.link_material ? (
                              <a href={v.link_material} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                                Ver
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>Sin datos de medios tradicionales.</p>
            )}
          </Seccion>

          {info.piezasPauta.length > 0 && (
            <Seccion titulo="Pauta digital">
              {visible.piezasPauta.length === 0 ? (
                <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                  Ninguna pieza de pauta digital cae dentro del período elegido (hay{' '}
                  {info.piezasPauta.length} en total). Probá con "Todo".
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={th}>Campaña</th>
                      <th style={th}>Área</th>
                      <th style={th}>Ámbito</th>
                      <th style={th}>Estado</th>
                      <th style={th}>Creación</th>
                      <th style={th}>Finalización</th>
                      <th style={th}>Alcance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.piezasPauta.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={td}>{p.campana}</td>
                        <td style={td}>{p.area_tematica || '—'}</td>
                        <td style={td}>{p.alcance_tipo === 'departamento' ? 'Departamento' : 'Localidad'}</td>
                        <td style={td}>
                          <StatusBadge estado={p.estado} />
                        </td>
                        <td style={td}>{formatearFechaCorta(p.fecha_creacion) || '—'}</td>
                        <td style={td}>{formatearFechaCorta(p.finalizacion) || '—'}</td>
                        <td style={td}>{p.alcance ? p.alcance.toLocaleString('es-AR') : '—'}</td>
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
                          {it.link ? (
                            <a href={it.link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                              Ver
                            </a>
                          ) : (
                            '—'
                          )}
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
