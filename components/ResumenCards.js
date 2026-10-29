import { useState } from 'react';
import Link from 'next/link';
import { BANDA_COBERTURA, ORDEN_BANDAS, textoVencimiento, textoSigueAlAire } from '../lib/coverage';
import { hrefLocalidad, hrefCampana } from '../lib/rutas';

// "¿Qué necesita atención esta semana?": arriba lo accionable y nombrado,
// abajo la tranquilidad. Principio: si muestra un recorte, es clickable hacia
// ese recorte (la grilla filtrada, la lista desplegada, la ficha de la
// localidad o la campaña en /campanas). Nada que parezca accionable y no haga
// nada. Colores del semáforo con las mismas variables que la grilla.
const COLOR = {
  '🔴': { fg: 'var(--cov-baja)', bg: 'var(--cov-baja-bg)' },
  '🟡': { fg: 'var(--cov-media)', bg: 'var(--cov-media-bg)' },
  '🟢': { fg: 'var(--cov-alta)', bg: 'var(--cov-alta-bg)' },
};

const cardEstilo = {
  flex: '1 1 320px',
  minWidth: 280,
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '16px 20px',
};
const tituloCard = { fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 };
const titular = { fontSize: 20, fontWeight: 700, lineHeight: 1.2 };
const detalle = { fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 8 };
const chico = { fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 8 };
const lista = { margin: '6px 0 0', paddingLeft: 18, fontSize: 13.5, color: 'var(--text-primary)' };
const enlace = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--accent)',
  cursor: 'pointer',
  textDecoration: 'underline',
};

function LinkLocalidad({ nombre, children, style }) {
  return (
    <Link href={hrefLocalidad(nombre)} style={{ color: 'inherit', textDecoration: 'underline', ...style }}>
      {children || nombre}
    </Link>
  );
}

function LinkCampana({ nombre, children }) {
  return (
    <Link href={hrefCampana(nombre)} style={{ color: 'inherit', textDecoration: 'underline' }}>
      {children || nombre}
    </Link>
  );
}

/** Chip de color que, si recibe `onClick`, es un botón (abre/filtra su recorte). */
function Chip({ color, children, onClick, activo }) {
  const c = COLOR[color];
  const estilo = {
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 600,
    background: c ? c.bg : 'var(--bg-secondary)',
    color: c ? c.fg : 'var(--text-tertiary)',
    border: `1.5px solid ${activo && c ? c.fg : 'transparent'}`,
  };
  if (!onClick) return <span style={estilo}>{children}</span>;
  return (
    <button type="button" onClick={onClick} aria-pressed={!!activo} style={{ ...estilo, cursor: 'pointer' }}>
      {children}
    </button>
  );
}

/** "A, B, C (+N más)" -> nombres visibles + resto contado. */
function conResto(items, max) {
  return { visibles: items.slice(0, max), resto: Math.max(0, items.length - max) };
}

function Tira({ r, abierto, onAbrir }) {
  const ok = r.sinCobertura === 0;
  const vencenAbierto = abierto.vista === 'vencen';
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ ...cardEstilo, borderColor: ok ? 'var(--cov-alta)' : 'var(--cov-baja)' }}>
        <div style={{ ...titular, color: ok ? 'var(--cov-alta)' : 'var(--cov-baja)' }}>
          Sin cobertura: {r.sinCobertura} de {r.total}
        </div>
        <div style={detalle}>
          {ok ? (
            'Todas tienen Medios Tradicionales activos o Pauta Digital viva dirigida.'
          ) : (
            r.sinCoberturaNombres.map((n, i) => (
              <span key={n}>
                {i > 0 ? ', ' : ''}
                <LinkLocalidad nombre={n} />
              </span>
            ))
          )}
        </div>
      </div>
      <div style={cardEstilo}>
        <button
          type="button"
          onClick={() => onAbrir('vencen', null)}
          aria-expanded={vencenAbierto}
          style={{ ...titular, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', fontSize: 20, fontWeight: 700 }}
        >
          Vencen esta semana: {r.pd.vencenTotal} campaña{r.pd.vencenTotal === 1 ? '' : 's'}
        </button>
        <div style={detalle}>
          <Chip color="🔴" onClick={() => onAbrir('vencen', '🔴')} activo={vencenAbierto && abierto.color === '🔴'}>
            🔴 {r.pd.vencenRojas} (≤3d)
          </Chip>{' '}
          <Chip color="🟡" onClick={() => onAbrir('vencen', '🟡')} activo={vencenAbierto && abierto.color === '🟡'}>
            🟡 {r.pd.vencenAmarillas} (4–7d)
          </Chip>{' '}
          <span style={{ color: 'var(--text-tertiary)' }}>incl. provincial</span>
        </div>
      </div>
    </div>
  );
}

function BarraApilada({ bandas, total, onFiltrarBandas }) {
  const orden = ORDEN_BANDAS.slice().reverse();
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
        {orden.map((b) =>
          bandas[b] > 0 ? (
            <button
              key={b}
              type="button"
              onClick={() => onFiltrarBandas([b])}
              title={`${BANDA_COBERTURA[b].label}: ${bandas[b]} · ver en la grilla`}
              aria-label={`${BANDA_COBERTURA[b].label}: ${bandas[b]} localidades, ver en la grilla`}
              style={{ width: `${(bandas[b] / total) * 100}%`, background: BANDA_COBERTURA[b].fg, border: 'none', padding: 0, cursor: 'pointer' }}
            />
          ) : null
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
        {orden.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onFiltrarBandas([b])}
            title={`Ver las ${bandas[b]} localidades en banda ${b} en la grilla`}
            style={{ ...enlace, textDecoration: 'none', color: 'var(--text-secondary)' }}
          >
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: BANDA_COBERTURA[b].fg, marginRight: 5 }} />
            {b} {bandas[b]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Movimiento({ r, abierto, onToggle, onFiltrarBandas }) {
  const m = r.mt.movimiento;
  const flecha = !m ? null : m.variacion > 0 ? '▲' : m.variacion < 0 ? '▼' : '=';
  const signo = m && m.variacion > 0 ? '+' : '';
  const color = !m ? undefined : m.variacion > 0 ? 'var(--cov-alta)' : m.variacion < 0 ? 'var(--cov-baja)' : 'var(--text-tertiary)';
  const [dd, mm] = m ? m.fecha.split('-').slice(1).reverse() : [];
  return (
    <>
      <div style={titular}>
        <button
          type="button"
          onClick={() => onFiltrarBandas(['Media', 'Alta'])}
          title={`Ver las ${r.mt.conCoberturaMediaOAlta} localidades con cobertura media o alta en la grilla`}
          style={{ ...enlace, fontSize: 20, fontWeight: 700, textDecoration: 'none' }}
        >
          {r.mt.conCoberturaMediaOAlta}/{r.total} con cobertura media o alta
        </button>
        {m && (
          <span style={{ fontSize: 15, color, marginLeft: 8 }}>
            {flecha} {signo}
            {m.variacion} vs. {dd}/{mm}
          </span>
        )}
      </div>
      {m && m.cambios.length > 0 && (
        <div style={detalle}>
          {(() => {
            const { visibles, resto } = conResto(m.cambios, abierto ? m.cambios.length : 4);
            return (
              <>
                Cambiaron de banda:{' '}
                {visibles.map((c, i) => (
                  <span key={c.localidad}>
                    {i > 0 ? ', ' : ''}
                    <LinkLocalidad nombre={c.localidad} style={{ color: c.empeoro ? 'var(--cov-baja)' : 'var(--cov-alta)', fontWeight: 600 }}>
                      {c.localidad} {c.empeoro ? '↓' : '↑'} {c.a}
                    </LinkLocalidad>
                  </span>
                ))}
                {resto > 0 && (
                  <>
                    {' '}
                    <button type="button" style={enlace} onClick={onToggle}>
                      (+{resto} más)
                    </button>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}
      {m && m.cambios.length === 0 && <div style={chico}>Ninguna localidad cambió de banda desde el {dd}/{mm}.</div>}
    </>
  );
}

/** Pantalla general. `r` = resumenGeneral(); `onFiltrarBandas(['Sin','Baja'])`
 * filtra la grilla de abajo y lleva hasta ella. */
export function ResumenGeneral({ r, onFiltrarBandas }) {
  // vista: 'vencen' | 'temas' | 'cambios' | 'dirigidas' | null; color: filtro 🔴/🟡 de esa lista.
  const [abierto, setAbierto] = useState({ vista: null, color: null });
  const abrir = (vista, color = null) =>
    setAbierto((a) => (a.vista === vista && a.color === color ? { vista: null, color: null } : { vista, color }));

  const rojasNombradas = conResto(r.pd.vencen.filter((c) => c.color === '🔴'), 3);
  const debiles = conResto(r.mt.debiles, 3);
  const viejos = conResto(r.mt.temas, 3);
  const vencenLista = r.pd.vencen.filter((c) => !abierto.color || c.color === abierto.color);
  const temasLista = r.mt.temas.filter((t) => !abierto.color || t.color === abierto.color);

  return (
    <div style={{ marginBottom: 20 }}>
      <Tira r={r} abierto={abierto} onAbrir={abrir} />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={cardEstilo}>
          <div style={tituloCard}>Medios tradicionales</div>
          <Movimiento r={r} abierto={abierto.vista === 'cambios'} onToggle={() => abrir('cambios')} onFiltrarBandas={onFiltrarBandas} />
          <div style={{ marginTop: 12 }}>
            <BarraApilada bandas={r.mt.bandas} total={r.total} onFiltrarBandas={onFiltrarBandas} />
          </div>
          {debiles.visibles.length > 0 && (
            <div style={detalle}>
              Más débiles:{' '}
              {debiles.visibles.map((l, i) => (
                <span key={l.localidad}>
                  {i > 0 ? ', ' : ''}
                  <LinkLocalidad nombre={l.localidad} style={{ fontWeight: 700 }} /> ({l.banda === 'Sin' ? 'sin MT' : `${l.tipos} tipo${l.tipos === 1 ? '' : 's'}`})
                </span>
              ))}
              {debiles.resto > 0 && (
                <>
                  {' '}
                  <button type="button" style={enlace} onClick={() => onFiltrarBandas(['Sin', 'Baja'])}>
                    (+{debiles.resto} más)
                  </button>
                </>
              )}{' '}
              <button type="button" style={enlace} onClick={() => onFiltrarBandas(['Sin', 'Baja'])}>
                ver las {r.mt.debiles.length} en la grilla →
              </button>
            </div>
          )}
          <div style={detalle}>
            <button type="button" style={enlace} onClick={() => abrir('temas')} aria-expanded={abierto.vista === 'temas' && !abierto.color}>
              {r.mt.temasPorRevisar} tema{r.mt.temasPorRevisar === 1 ? '' : 's'} por revisar
            </button>{' '}
            <Chip color="🔴" onClick={() => abrir('temas', '🔴')} activo={abierto.vista === 'temas' && abierto.color === '🔴'}>
              🔴 {r.mt.rojos}
            </Chip>{' '}
            <Chip color="🟡" onClick={() => abrir('temas', '🟡')} activo={abierto.vista === 'temas' && abierto.color === '🟡'}>
              🟡 {r.mt.amarillos}
            </Chip>
            {viejos.visibles.length > 0 && (
              <div style={chico}>
                Más antiguos:{' '}
                {viejos.visibles.map((t, i) => (
                  <span key={t.tema + t.dias}>
                    {i > 0 ? ' · ' : ''}
                    <LinkCampana nombre={t.tema} /> ({t.dias}d)
                  </span>
                ))}
                {viejos.resto > 0 && (
                  <>
                    {' '}
                    <button type="button" style={enlace} onClick={() => abrir('temas')}>
                      (+{viejos.resto} más)
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {abierto.vista === 'temas' && (
            <ul style={lista}>
              {temasLista.map((t) => (
                <li key={t.tema + t.dias}>
                  {t.color} <LinkCampana nombre={t.tema} /> · {t.tipo} · {t.dias} días · {t.localidades} localidad{t.localidades === 1 ? '' : 'es'}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={cardEstilo}>
          <div style={tituloCard}>Pauta digital</div>
          {r.pd.vencidasSinRenovar.length > 0 && (
            <div style={{ background: 'var(--cov-baja-bg)', color: 'var(--cov-baja)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13.5, fontWeight: 600 }}>
              {r.pd.vencidasSinRenovar.length} campaña{r.pd.vencidasSinRenovar.length === 1 ? '' : 's'} vencida{r.pd.vencidasSinRenovar.length === 1 ? '' : 's'} sin renovar — renovar o cerrar:{' '}
              {r.pd.vencidasSinRenovar.map((c, i) => (
                <span key={c.campana}>
                  {i > 0 ? ', ' : ''}
                  <LinkCampana nombre={c.campana} />
                </span>
              ))}
            </div>
          )}
          {rojasNombradas.visibles.length > 0 ? (
            <>
              <div style={titular}>Renovar primero</div>
              <ul style={lista}>
                {rojasNombradas.visibles.map((c) => (
                  <li key={c.campana}>
                    <strong>
                      <LinkCampana nombre={c.campana} />
                    </strong>{' '}
                    · {textoVencimiento(c.dias)} 🔴
                    {c.sigueAlAire > 0 && ` · ${textoSigueAlAire(c.sigueAlAire, { deCampana: true })}`}
                    {c.continua && <span style={{ color: 'var(--text-tertiary)' }}> · sigue con otras piezas</span>}
                  </li>
                ))}
              </ul>
              {rojasNombradas.resto > 0 && (
                <div style={detalle}>
                  <button type="button" style={enlace} onClick={() => abrir('vencen', '🔴')}>
                    (+{rojasNombradas.resto} más)
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ ...titular, color: 'var(--cov-alta)' }}>Nada vence en 3 días o menos</div>
          )}
          {abierto.vista === 'vencen' && (
            <div style={{ marginTop: 10 }}>
              <div style={chico}>
                {vencenLista.length} de {r.pd.vencenTotal} campañas que vencen en los próximos 7 días
                {abierto.color ? ` (${abierto.color})` : ''}; {r.pd.vencenSinContinuidad} del total sin otras piezas después. Incluye pauta provincial.
              </div>
              <ul style={lista}>
                {vencenLista.map((c) => (
                  <li key={c.campana}>
                    {c.color}{' '}
                    <strong>
                      <LinkCampana nombre={c.campana} />
                    </strong>{' '}
                    · {textoVencimiento(c.dias)}
                    {c.color === '🔴' && c.sigueAlAire > 0 && ` · ${textoSigueAlAire(c.sigueAlAire, { deCampana: true })}`}
                    {c.continua && <span style={{ color: 'var(--text-tertiary)' }}> · sigue con otras piezas</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={chico}>
            <button type="button" style={enlace} onClick={() => abrir('dirigidas')} aria-expanded={abierto.vista === 'dirigidas'}>
              {r.pd.campanasVivasDirigidas} campañas vivas dirigidas
            </button>{' '}
            a las localidades.
          </div>
          {abierto.vista === 'dirigidas' && (
            <ul style={lista}>
              {r.pd.dirigidas.map((c) => (
                <li key={c.campana}>
                  <LinkCampana nombre={c.campana} /> · {c.localidades} localidad{c.localidades === 1 ? '' : 'es'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** Al entrar a una localidad: mismas cards, su escala. `r` = resumenLocalidad().
 * `onFiltrarTemas({tipo})` filtra la tabla de MT de abajo (solo temas activos) y
 * baja hasta ella; `tipo` null = todos los tipos. */
export function ResumenLocalidad({ r, onFiltrarTemas }) {
  const { mt, pd } = r;
  const f = mt && mt.frescura;
  const vencidas = pd.vencidasSinRenovar;
  const [listaPD, setListaPD] = useState(false);
  const [plataforma, setPlataforma] = useState(null);
  const campanas = pd.campanas.filter((c) => !plataforma || c.plataformas.includes(plataforma));
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
      <div style={cardEstilo}>
        <div style={tituloCard}>Medios tradicionales</div>
        {mt ? (
          <>
            <div style={titular}>
              <button
                type="button"
                onClick={() => onFiltrarTemas({ tipo: null })}
                title="Ver los temas activos en la tabla"
                style={{ ...enlace, fontSize: 20, fontWeight: 700, textDecoration: 'none' }}
              >
                {mt.temasActivos} tema{mt.temasActivos === 1 ? '' : 's'} activo{mt.temasActivos === 1 ? '' : 's'}
              </button>{' '}
              · {mt.tipos} de {mt.total} tipos ·{' '}
              {BANDA_COBERTURA[mt.banda].label.replace('Cobertura ', '').replace('Sin cobertura', 'Sin').toLowerCase()}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {mt.chips.map((c) =>
                c.presente ? (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => onFiltrarTemas({ tipo: c.key })}
                    title={`Ver los ${c.temas} temas activos de ${c.label} en la tabla`}
                    style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: 'var(--cov-alta-bg)', color: 'var(--cov-alta)', border: 'none', cursor: 'pointer' }}
                  >
                    ✓ {c.label} {c.temas}
                  </button>
                ) : (
                  <span key={c.key} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                    — {c.label}
                  </span>
                )
              )}
            </div>
            <div style={detalle}>
              {f.sinDato ? (
                <Chip color={null}>Frescura: sin dato</Chip>
              ) : (
                <>Tema más reciente hace {f.dias} día{f.dias === 1 ? '' : 's'} <Chip color={f.color}>{f.color}</Chip></>
              )}
            </div>
          </>
        ) : (
          <div style={detalle}>Sin datos de medios tradicionales.</div>
        )}
      </div>
      <div style={cardEstilo}>
        <div style={tituloCard}>Pauta digital</div>
        {vencidas.length > 0 && (
          <div style={{ background: 'var(--cov-baja-bg)', color: 'var(--cov-baja)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13.5, fontWeight: 600 }}>
            {vencidas.length} campaña{vencidas.length === 1 ? '' : 's'} vencida{vencidas.length === 1 ? '' : 's'} sin renovar — renovar o cerrar:{' '}
            {vencidas.map((c, i) => (
              <span key={c}>
                {i > 0 ? ', ' : ''}
                <LinkCampana nombre={c} />
              </span>
            ))}
          </div>
        )}
        {pd.proxima ? (
          <>
            <div style={titular}>
              <button
                type="button"
                onClick={() => {
                  setListaPD((v) => !v);
                  setPlataforma(null);
                }}
                aria-expanded={listaPD}
                style={{ ...enlace, fontSize: 20, fontWeight: 700, textDecoration: 'none' }}
              >
                {pd.campanasVivasDirigidas} campaña{pd.campanasVivasDirigidas === 1 ? '' : 's'} viva{pd.campanasVivasDirigidas === 1 ? '' : 's'} dirigida{pd.campanasVivasDirigidas === 1 ? '' : 's'}
              </button>
              {' · '}próxima {textoVencimiento(pd.proxima.dias)} <Chip color={pd.proxima.color}>{pd.proxima.color}</Chip>
              {pd.proxima.color === '🔴' && pd.proxima.sigueAlAire > 0 && (
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}> · {textoSigueAlAire(pd.proxima.sigueAlAire)}</span>
              )}
            </div>
            {pd.plataformas.length > 1 && (
              <div style={detalle}>
                {pd.plataformas.map((x, i) => (
                  <span key={x.plataforma}>
                    {i > 0 ? ' · ' : ''}
                    <button
                      type="button"
                      style={enlace}
                      aria-pressed={listaPD && plataforma === x.plataforma}
                      onClick={() => {
                        setListaPD(true);
                        setPlataforma((p) => (p === x.plataforma ? null : x.plataforma));
                      }}
                    >
                      {x.plataforma} {x.campanas}
                    </button>
                  </span>
                ))}
                <span style={{ color: 'var(--text-tertiary)' }}> (campañas por plataforma; una puede estar en varias)</span>
              </div>
            )}
            {listaPD && (
              <>
                <div style={chico}>
                  {campanas.length} de {pd.campanasVivasDirigidas} campañas{plataforma ? ` en ${plataforma}` : ''}, por vencimiento más próximo.
                </div>
                <ul style={lista}>
                  {campanas.map((c) => (
                    <li key={c.campana}>
                      {c.color} <LinkCampana nombre={c.campana} /> · {textoVencimiento(c.dias)}
                      <span style={{ color: 'var(--text-tertiary)' }}> · {c.plataformas.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <div style={titular}>Sin pauta digital viva dirigida</div>
        )}
      </div>
    </div>
  );
}
