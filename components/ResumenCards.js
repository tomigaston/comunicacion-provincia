import { BANDA_COBERTURA, ORDEN_BANDAS, textoVencimiento } from '../lib/coverage';

// Colores del semáforo (🔴/🟡/🟢) con las mismas variables que usa la grilla.
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

function Chip({ color, children }) {
  const c = COLOR[color];
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: c ? c.bg : 'var(--bg-secondary)', color: c ? c.fg : 'var(--text-tertiary)' }}>
      {children}
    </span>
  );
}

function Tira({ sinCobertura, total, vencen }) {
  const ok = sinCobertura === 0;
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ ...cardEstilo, borderColor: ok ? 'var(--cov-alta)' : 'var(--cov-baja)' }}>
        <div style={{ ...titular, color: ok ? 'var(--cov-alta)' : 'var(--cov-baja)' }}>
          Sin cobertura: {sinCobertura} de {total}
        </div>
        <div style={detalle}>Ni Medios Tradicionales activos ni Pauta Digital viva dirigida.</div>
      </div>
      <div style={cardEstilo}>
        <div style={titular}>
          Vencen esta semana (incl. provincial): {vencen} campaña{vencen === 1 ? '' : 's'}
        </div>
        <div style={detalle}>Pauta Digital, próximos 7 días.</div>
      </div>
    </div>
  );
}

function BarraApilada({ bandas, total }) {
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
        {ORDEN_BANDAS.slice().reverse().map((b) =>
          bandas[b] > 0 ? (
            <div key={b} title={`${BANDA_COBERTURA[b].label}: ${bandas[b]}`} style={{ width: `${(bandas[b] / total) * 100}%`, background: BANDA_COBERTURA[b].fg }} />
          ) : null
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
        {ORDEN_BANDAS.slice().reverse().map((b) => (
          <span key={b}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: BANDA_COBERTURA[b].fg, marginRight: 5 }} />
            {b} {bandas[b]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Pantalla general: tira de titulares + card MT + card PD. `r` = resumenGeneral(). */
export function ResumenGeneral({ r }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Tira sinCobertura={r.sinCobertura} total={r.total} vencen={r.vencenEstaSemana} />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={cardEstilo}>
          <div style={tituloCard}>Medios tradicionales</div>
          <div style={titular}>{r.mt.conCoberturaMediaOAlta} de {r.total} con cobertura media o alta</div>
          <div style={{ marginTop: 10 }}><BarraApilada bandas={r.mt.bandas} total={r.total} /></div>
          <div style={detalle}>
            {r.mt.temasPorRevisar} tema{r.mt.temasPorRevisar === 1 ? '' : 's'} por revisar{' '}
            <Chip color="🔴">🔴 {r.mt.rojos}</Chip> <Chip color="🟡">🟡 {r.mt.amarillos}</Chip>
          </div>
        </div>
        <div style={cardEstilo}>
          <div style={tituloCard}>Pauta digital</div>
          <div style={titular}>{r.pd.campanasVivasDirigidas} campañas vivas dirigidas</div>
          <div style={detalle}>
            Vencen esta semana (incl. provincial): <Chip color="🔴">🔴 {r.pd.vencenRojas} (≤3d)</Chip>{' '}
            <Chip color="🟡">🟡 {r.pd.vencenAmarillas} (4–7d)</Chip> campañas
          </div>
          <div style={detalle}>Localidades con pauta viva dirigida: {r.pd.localidadesConPauta} / {r.total}</div>
        </div>
      </div>
    </div>
  );
}

/** Al entrar a una localidad: mismas cards, su escala. `r` = resumenLocalidad(). */
export function ResumenLocalidad({ r }) {
  const { mt, pd } = r;
  const f = mt && mt.frescura;
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
      <div style={cardEstilo}>
        <div style={tituloCard}>Medios tradicionales</div>
        {mt ? (
          <>
            <div style={titular}>
              Cobertura {mt.tipos} de {mt.total} tipos · {BANDA_COBERTURA[mt.banda].label.replace('Cobertura ', '').replace('Sin cobertura', 'Sin')}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {mt.chips.map((c) => (
                <span key={c.label} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: c.presente ? 'var(--cov-alta-bg)' : 'var(--bg-secondary)', color: c.presente ? 'var(--cov-alta)' : 'var(--text-tertiary)' }}>
                  {c.presente ? '✓' : '—'} {c.label}
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
        {pd.proxima ? (
          <>
            <div style={titular}>{pd.campanasVivasDirigidas} campaña{pd.campanasVivasDirigidas === 1 ? '' : 's'} viva{pd.campanasVivasDirigidas === 1 ? '' : 's'} dirigida{pd.campanasVivasDirigidas === 1 ? '' : 's'}</div>
            <div style={detalle}>
              Próxima {textoVencimiento(pd.proxima.dias)} <Chip color={pd.proxima.color}>{pd.proxima.color}</Chip>
            </div>
          </>
        ) : (
          <div style={titular}>Sin pauta digital viva dirigida</div>
        )}
      </div>
    </div>
  );
}
