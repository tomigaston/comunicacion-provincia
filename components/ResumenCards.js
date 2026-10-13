import { useState } from 'react';
import { BANDA_COBERTURA, ORDEN_BANDAS, textoVencimiento } from '../lib/coverage';

// "¿Qué necesita atención esta semana?": arriba lo accionable y nombrado,
// abajo la tranquilidad. Colores del semáforo con las mismas variables que la
// grilla.
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

function Chip({ color, children }) {
  const c = COLOR[color];
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: c ? c.bg : 'var(--bg-secondary)', color: c ? c.fg : 'var(--text-tertiary)' }}>
      {children}
    </span>
  );
}

/** "Saldán (Baja), Cosquín (Media), … (+N más)" -> nombres + resto contado. */
function conResto(items, max) {
  return { visibles: items.slice(0, max), resto: Math.max(0, items.length - max) };
}

function Tira({ r, onVerVencen, vencenAbierto }) {
  const ok = r.sinCobertura === 0;
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ ...cardEstilo, borderColor: ok ? 'var(--cov-alta)' : 'var(--cov-baja)' }}>
        <div style={{ ...titular, color: ok ? 'var(--cov-alta)' : 'var(--cov-baja)' }}>
          Sin cobertura: {r.sinCobertura} de {r.total}
        </div>
        <div style={detalle}>
          {ok ? 'Todas tienen Medios Tradicionales activos o Pauta Digital viva dirigida.' : r.sinCoberturaNombres.join(', ')}
        </div>
      </div>
      <button
        type="button"
        onClick={onVerVencen}
        aria-expanded={vencenAbierto}
        style={{ ...cardEstilo, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
      >
        <div style={titular}>
          Vencen esta semana: {r.pd.vencenTotal} campaña{r.pd.vencenTotal === 1 ? '' : 's'}
        </div>
        <div style={detalle}>
          <Chip color="🔴">🔴 {r.pd.vencenRojas} (≤3d)</Chip> <Chip color="🟡">🟡 {r.pd.vencenAmarillas} (4–7d)</Chip>{' '}
          <span style={{ color: 'var(--text-tertiary)' }}>incl. provincial · {vencenAbierto ? 'ocultar' : 'ver la lista'}</span>
        </div>
      </button>
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
            <div key={b} title={`${BANDA_COBERTURA[b].label}: ${bandas[b]}`} style={{ width: `${(bandas[b] / total) * 100}%`, background: BANDA_COBERTURA[b].fg }} />
          ) : null
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
        {orden.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onFiltrarBandas([b])}
            title={`Ver las localidades en banda ${b} en la grilla`}
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

function Movimiento({ r, abierto, onToggle }) {
  const m = r.mt.movimiento;
  const flecha = !m ? null : m.variacion > 0 ? '▲' : m.variacion < 0 ? '▼' : '=';
  const signo = m && m.variacion > 0 ? '+' : '';
  const color = !m ? undefined : m.variacion > 0 ? 'var(--cov-alta)' : m.variacion < 0 ? 'var(--cov-baja)' : 'var(--text-tertiary)';
  const [dd, mm] = m ? m.fecha.split('-').slice(1).reverse() : [];
  return (
    <>
      <div style={titular}>
        {r.mt.conCoberturaMediaOAlta}/{r.total} con cobertura media o alta
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
                  <span key={c.localidad} style={{ color: c.empeoro ? 'var(--cov-baja)' : 'var(--cov-alta)', fontWeight: 600 }}>
                    {i > 0 ? ', ' : ''}
                    {c.localidad} {c.empeoro ? '↓' : '↑'} {c.a}
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
  const [abierto, setAbierto] = useState(null); // 'vencen' | 'temas' | 'cambios' | null
  const alternar = (k) => setAbierto((a) => (a === k ? null : k));

  const rojasNombradas = conResto(r.pd.vencen.filter((c) => c.color === '🔴'), 3);
  const debiles = conResto(r.mt.debiles, 3);
  const viejos = conResto(r.mt.temas, 3);

  return (
    <div style={{ marginBottom: 20 }}>
      <Tira r={r} onVerVencen={() => alternar('vencen')} vencenAbierto={abierto === 'vencen'} />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={cardEstilo}>
          <div style={tituloCard}>Medios tradicionales</div>
          <Movimiento r={r} abierto={abierto === 'cambios'} onToggle={() => alternar('cambios')} />
          <div style={{ marginTop: 12 }}>
            <BarraApilada bandas={r.mt.bandas} total={r.total} onFiltrarBandas={onFiltrarBandas} />
          </div>
          {debiles.visibles.length > 0 && (
            <div style={detalle}>
              Más débiles:{' '}
              {debiles.visibles.map((l, i) => (
                <span key={l.localidad}>
                  {i > 0 ? ', ' : ''}
                  <strong>{l.localidad}</strong> ({l.banda === 'Sin' ? 'sin MT' : `${l.tipos} tipo${l.tipos === 1 ? '' : 's'}`})
                </span>
              ))}
              {debiles.resto > 0 && ` (+${debiles.resto} más)`}{' '}
              <button type="button" style={enlace} onClick={() => onFiltrarBandas(['Sin', 'Baja'])}>
                ver las {r.mt.debiles.length} en la grilla →
              </button>
            </div>
          )}
          <div style={detalle}>
            <button type="button" style={enlace} onClick={() => alternar('temas')} aria-expanded={abierto === 'temas'}>
              {r.mt.temasPorRevisar} tema{r.mt.temasPorRevisar === 1 ? '' : 's'} por revisar
            </button>{' '}
            <Chip color="🔴">🔴 {r.mt.rojos}</Chip> <Chip color="🟡">🟡 {r.mt.amarillos}</Chip>
            {viejos.visibles.length > 0 && (
              <div style={chico}>
                Más antiguos: {viejos.visibles.map((t) => `${t.tema} (${t.dias}d)`).join(' · ')}
                {viejos.resto > 0 && ` (+${viejos.resto} más)`}
              </div>
            )}
          </div>
          {abierto === 'temas' && (
            <ul style={lista}>
              {r.mt.temas.map((t) => (
                <li key={t.tema + t.dias}>
                  {t.color} {t.tema} · {t.tipo} · {t.dias} días · {t.localidades} localidad{t.localidades === 1 ? '' : 'es'}
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
              {r.pd.vencidasSinRenovar.map((c) => c.campana).join(', ')}
            </div>
          )}
          {rojasNombradas.visibles.length > 0 ? (
            <>
              <div style={titular}>Renovar primero</div>
              <ul style={lista}>
                {rojasNombradas.visibles.map((c) => (
                  <li key={c.campana}>
                    <strong>{c.campana}</strong> · {textoVencimiento(c.dias)} 🔴
                    {c.continua && <span style={{ color: 'var(--text-tertiary)' }}> · sigue con otras piezas</span>}
                  </li>
                ))}
              </ul>
              {rojasNombradas.resto > 0 && (
                <div style={detalle}>
                  <button type="button" style={enlace} onClick={() => alternar('vencen')}>
                    (+{rojasNombradas.resto} más)
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ ...titular, color: 'var(--cov-alta)' }}>Nada vence en 3 días o menos</div>
          )}
          {abierto === 'vencen' && (
            <div style={{ marginTop: 10 }}>
              <div style={chico}>
                {r.pd.vencenTotal} campañas vencen en los próximos 7 días ({r.pd.vencenSinContinuidad} sin otras piezas después). Incluye pauta provincial.
              </div>
              <ul style={lista}>
                {r.pd.vencen.map((c) => (
                  <li key={c.campana}>
                    {c.color} <strong>{c.campana}</strong> · {textoVencimiento(c.dias)}
                    {c.continua && <span style={{ color: 'var(--text-tertiary)' }}> · sigue con otras piezas</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={chico}>{r.pd.campanasVivasDirigidas} campañas vivas dirigidas a las localidades.</div>
        </div>
      </div>
    </div>
  );
}

/** Al entrar a una localidad: mismas cards, su escala. `r` = resumenLocalidad(). */
export function ResumenLocalidad({ r }) {
  const { mt, pd } = r;
  const f = mt && mt.frescura;
  const vencidas = pd.vencidasSinRenovar;
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
      <div style={cardEstilo}>
        <div style={tituloCard}>Medios tradicionales</div>
        {mt ? (
          <>
            <div style={titular}>
              {mt.temasActivos} tema{mt.temasActivos === 1 ? '' : 's'} activo{mt.temasActivos === 1 ? '' : 's'} · {mt.tipos} de {mt.total} tipos ·{' '}
              {BANDA_COBERTURA[mt.banda].label.replace('Cobertura ', '').replace('Sin cobertura', 'Sin').toLowerCase()}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {mt.chips.map((c) => (
                <span key={c.label} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: c.presente ? 'var(--cov-alta-bg)' : 'var(--bg-secondary)', color: c.presente ? 'var(--cov-alta)' : 'var(--text-tertiary)' }}>
                  {c.presente ? '✓' : '—'} {c.label}
                  {c.presente ? ` ${c.temas}` : ''}
                </span>
              ))}
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
            {vencidas.length} campaña{vencidas.length === 1 ? '' : 's'} vencida{vencidas.length === 1 ? '' : 's'} sin renovar — renovar o cerrar: {vencidas.join(', ')}
          </div>
        )}
        {pd.proxima ? (
          <>
            <div style={titular}>
              {pd.campanasVivasDirigidas} campaña{pd.campanasVivasDirigidas === 1 ? '' : 's'} viva{pd.campanasVivasDirigidas === 1 ? '' : 's'} dirigida{pd.campanasVivasDirigidas === 1 ? '' : 's'}
              {' · '}próxima {textoVencimiento(pd.proxima.dias)} <Chip color={pd.proxima.color}>{pd.proxima.color}</Chip>
            </div>
            {pd.plataformas.length > 1 && (
              <div style={detalle}>
                {pd.plataformas.map((x) => `${x.plataforma} ${x.campanas}`).join(' · ')}
                <span style={{ color: 'var(--text-tertiary)' }}> (campañas por plataforma; una puede estar en varias)</span>
              </div>
            )}
          </>
        ) : (
          <div style={titular}>Sin pauta digital viva dirigida</div>
        )}
      </div>
    </div>
  );
}
