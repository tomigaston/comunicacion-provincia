import { useState } from 'react';
import Link from 'next/link';
import { BANDA_COBERTURA, ORDEN_BANDAS } from '../lib/coverage';
import { PD_DIAS_VENTANA, PD_MIN_AMARILLO, PD_MIN_VERDE } from '../lib/semaforo';
import { hrefLocalidad } from '../lib/rutas';
import { formatearFechaCorta, formatearFechaDiaMes } from '../lib/fechas';
import { sumarDias } from '../lib/vencimientos';

// Propuesta de inicio (6/11/2026): figuras y tarjetas nuevas sobre datos que
// ya existen. Sin librerías: barras en HTML y CSS. Colores de marca para lo
// descriptivo; rojo, amarillo y verde solo donde ya son semáforo o alerta.
// Cada bloque dice de qué dato sale. Es una propuesta para comparar: nada de
// esto está aplicado en la copia de trabajo.

const COLOR_PD = {
  '🔴': { fg: 'var(--cov-baja)', bg: 'var(--cov-baja-bg)' },
  '🟡': { fg: 'var(--cov-media)', bg: 'var(--cov-media-bg)' },
  '🟢': { fg: 'var(--cov-alta)', bg: 'var(--cov-alta-bg)' },
};

export const tarjeta = {
  flex: '1 1 320px',
  minWidth: 280,
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderTop: '4px solid var(--marca-celeste)',
  borderRadius: 12,
  padding: '14px 20px 16px',
};
export const tituloTarjeta = { fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 };
const nota = { fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.4 };
const botonChip = (activo) => ({
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  font: 'inherit',
  background: activo ? 'var(--accent-bg)' : 'var(--bg-secondary)',
  color: activo ? 'var(--accent)' : 'var(--text-secondary)',
  border: `1.5px solid ${activo ? 'var(--accent)' : 'transparent'}`,
});

const num = (n) => n.toLocaleString('es-AR');

// --- B1: fecha del dato ----------------------------------------------------
/** Una línea bajo el título con la fecha de cada fuente. `f` lo arma la página. */
export function FechaDelDato({ f }) {
  const partes = [
    `Medios Tradicionales al ${formatearFechaCorta(f.mt)}`,
    `Pauta Digital al ${formatearFechaCorta(f.pd)}`,
    f.sms ? `SMS: último envío ${formatearFechaCorta(f.sms)}` : null,
    f.organico ? `Orgánico: última publicación ${formatearFechaCorta(f.organico)}` : null,
    `Audiovisuales: ${f.avVigentes} vigente${f.avVigentes === 1 ? '' : 's'} de ${f.avTotal}`,
  ].filter(Boolean);
  return (
    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Datos:</span> {partes.join(' · ')}
    </div>
  );
}

// --- E1 + B5: barras por día de vencimiento --------------------------------
/** `fechas` = r.pd.atencion.fechas (piezas distintas por fecha de FIN). Un
 * día por columna, de hoy al fin de la ventana; los días sin vencimientos en
 * cero. El total de la ventana es la suma de esos renglones. */
export function GraficoVencimientos({ fechas, hoy, ventanaHasta }) {
  const porFecha = new Map(fechas.map((f) => [f.fecha, f]));
  const dias = [];
  for (let d = hoy; d <= ventanaHasta; d = sumarDias(d, 1)) dias.push(d);
  const max = Math.max(1, ...fechas.map((f) => f.piezas));
  const total = fechas.reduce((s, f) => s + f.piezas, 0);
  const ALTO = 72;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>
        {num(total)} pieza{total === 1 ? '' : 's'} distinta{total === 1 ? '' : 's'} vence{total === 1 ? '' : 'n'} entre hoy y el {formatearFechaDiaMes(ventanaHasta)}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginTop: 8, maxWidth: 520 }} role="img" aria-label="Piezas que vencen por día">
        {dias.map((d) => {
          const f = porFecha.get(d);
          const n = f ? f.piezas : 0;
          const alto = n ? Math.max(4, Math.round((n / max) * ALTO)) : 0;
          return (
            <div
              key={d}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
              title={n ? `${formatearFechaDiaMes(d)}: vencen ${num(n)} piezas de ${f.campanas.length} campañas` : `${formatearFechaDiaMes(d)}: sin vencimientos`}
            >
              <div style={{ fontSize: 11.5, fontWeight: 600, color: n ? 'var(--text-primary)' : 'var(--text-tertiary)', height: 14 }}>{n ? num(n) : ''}</div>
              <div style={{ height: ALTO, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                <div style={{ width: '100%', height: alto, background: 'var(--accent)', borderRadius: '4px 4px 0 0', borderBottom: n ? 'none' : '2px solid var(--border)' }} />
              </div>
              <div style={{ fontSize: 11, color: d === hoy ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: d === hoy ? 700 : 500 }}>
                {d === hoy ? 'hoy' : formatearFechaDiaMes(d)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- C2: mapa de 60 celdas --------------------------------------------------
const RANGO = { Sin: 0, Baja: 1, Media: 2, Alta: 3 };
const PESO_PD = { '🔴': 0, '🟡': 1, '🟢': 2 };

function Celda({ l }) {
  const b = BANDA_COBERTURA[l.bandaCobertura];
  const pd = COLOR_PD[l.ejePD.color];
  return (
    <Link
      href={hrefLocalidad(l.localidad)}
      className="mapa-celda"
      title={`${l.localidad} · ${l.departamento}\nMedios Tradicionales: ${b.label.toLowerCase()} (${l.totalTipos} tipo${l.totalTipos === 1 ? '' : 's'})\nPauta Digital ${l.ejePD.color}: ${l.ejePD.activas} activas (${l.ejePD.dirigidas} dirigidas · ${l.ejePD.provinciales} provinciales)`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px',
        borderRadius: 6,
        background: b.bg,
        borderLeft: `4px solid ${b.fg}`,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-primary)',
        minWidth: 0,
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{l.localidad}</span>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: pd.fg, boxShadow: '0 0 0 1.5px var(--bg-primary)', flexShrink: 0 }} />
    </Link>
  );
}

/** `filas` = combinarLocalidades(): la misma fila que usa la grilla. Fondo y
 * borde: banda de MT; punto: color de PD. */
export function MapaLocalidades({ filas }) {
  const [orden, setOrden] = useState('peor');
  const porPeor = filas
    .slice()
    .sort((a, b) => RANGO[a.bandaCobertura] - RANGO[b.bandaCobertura] || PESO_PD[a.ejePD.color] - PESO_PD[b.ejePD.color] || a.localidad.localeCompare(b.localidad, 'es'));
  const grupos = new Map();
  for (const l of filas.slice().sort((a, b) => a.departamento.localeCompare(b.departamento, 'es') || a.localidad.localeCompare(b.localidad, 'es'))) {
    if (!grupos.has(l.departamento)) grupos.set(l.departamento, []);
    grupos.get(l.departamento).push(l);
  }
  const grilla = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(124px, 1fr))', gap: 4 };
  return (
    <div style={{ ...tarjeta, flex: '1 1 100%', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ ...tituloTarjeta, marginBottom: 0 }}>Las {filas.length} localidades de un vistazo</div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button type="button" style={botonChip(orden === 'peor')} onClick={() => setOrden('peor')} aria-pressed={orden === 'peor'}>
            Peor primero
          </button>
          <button type="button" style={botonChip(orden === 'depto')} onClick={() => setOrden('depto')} aria-pressed={orden === 'depto'}>
            Por departamento
          </button>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        {orden === 'peor' ? (
          <div style={grilla}>
            {porPeor.map((l) => (
              <Celda key={l.localidad} l={l} />
            ))}
          </div>
        ) : (
          Array.from(grupos, ([depto, ls]) => (
            <div key={depto} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 0.3, margin: '4px 0 3px' }}>{depto}</div>
              <div style={grilla}>
                {ls.map((l) => (
                  <Celda key={l.localidad} l={l} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', ...nota }}>
        <span>
          Fondo y borde: cobertura de Medios Tradicionales{' '}
          {ORDEN_BANDAS.map((b) => (
            <span key={b} style={{ marginLeft: 6 }}>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: BANDA_COBERTURA[b].fg, marginRight: 3 }} />
              {b}
            </span>
          ))}
        </span>
        <span>
          Punto: Pauta Digital{' '}
          {['🔴', '🟡', '🟢'].map((c) => (
            <span key={c} style={{ marginLeft: 6 }}>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: COLOR_PD[c].fg, marginRight: 3 }} />
              {c === '🔴' ? `0–${PD_MIN_AMARILLO - 1}` : c === '🟡' ? `${PD_MIN_AMARILLO}–${PD_MIN_VERDE - 1}` : `${PD_MIN_VERDE}+`} activas
            </span>
          ))}
        </span>
        <span>Pasá el mouse para ver los números; tocá para ir a la ficha.</span>
      </div>
    </div>
  );
}

// --- B3: cruce Medios Tradicionales × Pauta Digital -------------------------
function CeldaCruce({ n, titulo, nombres, tono }) {
  const fondo = tono === 'bien' ? 'var(--cov-alta-bg)' : tono === 'mal' ? 'var(--cov-baja-bg)' : 'var(--cov-media-bg)';
  const color = tono === 'bien' ? 'var(--cov-alta)' : tono === 'mal' ? 'var(--cov-baja)' : 'var(--cov-media)';
  return (
    <div style={{ background: fondo, borderRadius: 10, padding: '10px 12px', minHeight: 72 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{titulo}</div>
      {nombres.length > 0 && n <= 12 && (
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.35 }}>
          {nombres.map((x, i) => (
            <span key={x}>
              {i > 0 ? ', ' : ''}
              <Link href={hrefLocalidad(x)} style={{ textDecoration: 'underline' }}>
                {x}
              </Link>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** 2×2 sobre las mismas filas de la grilla: MT media o alta vs. sin o baja;
 * PD 🟢 vs. 🟡🔴. */
export function CruceMTPD({ filas }) {
  const mtBien = (l) => l.bandaCobertura === 'Media' || l.bandaCobertura === 'Alta';
  const pdBien = (l) => l.ejePD.color === '🟢';
  const nombres = (f) => filas.filter(f).map((l) => l.localidad).sort((a, b) => a.localeCompare(b, 'es'));
  const bb = nombres((l) => mtBien(l) && pdBien(l));
  const mb = nombres((l) => !mtBien(l) && pdBien(l));
  const bm = nombres((l) => mtBien(l) && !pdBien(l));
  const mm = nombres((l) => !mtBien(l) && !pdBien(l));
  return (
    <div style={tarjeta}>
      <div style={tituloTarjeta}>Qué se publicita y qué no</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <CeldaCruce n={bb.length} titulo="MT media o alta · PD 🟢" nombres={bb} tono="bien" />
        <CeldaCruce n={bm.length} titulo="MT media o alta · PD 🟡🔴" nombres={bm} tono="medio" />
        <CeldaCruce n={mb.length} titulo="MT sin o baja · PD 🟢" nombres={mb} tono="medio" />
        <CeldaCruce n={mm.length} titulo="MT sin o baja · PD 🟡🔴" nombres={mm} tono="mal" />
      </div>
      <div style={nota}>Localidades según su cobertura de Medios Tradicionales (banda) y su color de Pauta Digital (piezas activas). Mismos valores que la grilla.</div>
    </div>
  );
}

// --- B2 / E2: qué se comunica (área temática) -------------------------------
function BarrasHorizontales({ filas, max, unidad }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 160px) 1fr auto', columnGap: 8, rowGap: 5, alignItems: 'center', marginTop: 8 }}>
      {filas.map((f) => (
        <FilaBarra key={f.etiqueta} f={f} max={max} unidad={unidad} />
      ))}
    </div>
  );
}
function FilaBarra({ f, max, unidad }) {
  const ancho = max ? Math.max(1, (f.n / max) * 100) : 0;
  return (
    <>
      <div style={{ fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={f.etiqueta}>
        {f.href ? (
          <Link href={f.href} style={{ textDecoration: 'underline' }}>
            {f.etiqueta}
          </Link>
        ) : (
          f.etiqueta
        )}
      </div>
      <div style={{ height: 10, background: 'var(--bg-secondary)', borderRadius: 5 }} title={`${f.etiqueta}: ${num(f.n)} ${unidad}`}>
        <div style={{ width: `${ancho}%`, height: '100%', background: f.color || 'var(--accent)', borderRadius: 5 }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 34, textAlign: 'right' }}>{num(f.n)}</div>
    </>
  );
}

/** `areas` = { distintas: [{area, n}], porLocalidad: [{area, n}], totalDistintas, totalPorLocalidad }. */
export function GraficoAreas({ areas }) {
  const [modo, setModo] = useState('distintas');
  const lista = modo === 'distintas' ? areas.distintas : areas.porLocalidad;
  const total = modo === 'distintas' ? areas.totalDistintas : areas.totalPorLocalidad;
  const filas = lista.map((a) => ({ etiqueta: a.area, n: a.n }));
  return (
    <div style={tarjeta}>
      <div style={tituloTarjeta}>Qué se comunica · Pauta Digital activa</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" style={botonChip(modo === 'distintas')} onClick={() => setModo('distintas')} aria-pressed={modo === 'distintas'}>
          Piezas distintas ({num(areas.totalDistintas)})
        </button>
        <button type="button" style={botonChip(modo === 'porLocalidad')} onClick={() => setModo('porLocalidad')} aria-pressed={modo === 'porLocalidad'}>
          Por localidad ({num(areas.totalPorLocalidad)})
        </button>
      </div>
      <BarrasHorizontales filas={filas} max={filas.length ? filas[0].n : 0} unidad={modo === 'distintas' ? 'piezas distintas' : 'piezas por localidad'} />
      <div style={nota}>
        Área temática de las piezas activas hoy, tal como viene en la planilla. {modo === 'distintas' ? 'Pieza distinta = campaña + título + plataforma, contada una vez aunque esté en las 60.' : 'Una pieza provincial cuenta una vez en cada una de las 60 localidades.'}{' '}
        Total {num(total)}.
      </div>
    </div>
  );
}

// --- A2 / E4: pauta dirigida por localidad ----------------------------------
/** `filas` = combinarLocalidades(). `umbral`: a definir (hoy 20). */
export function TarjetaDirigidas({ filas, umbral = 20, mostrar = 15 }) {
  const orden = filas.slice().sort((a, b) => a.ejePD.dirigidas - b.ejePD.dirigidas || a.localidad.localeCompare(b.localidad, 'es'));
  const valores = orden.map((l) => l.ejePD.dirigidas);
  const bajo = orden.filter((l) => l.ejePD.dirigidas < umbral);
  const mediana = valores[Math.floor(valores.length / 2)];
  const max = valores[valores.length - 1];
  const [todas, setTodas] = useState(false);
  const visibles = todas ? orden : orden.slice(0, mostrar);
  const barras = visibles.map((l) => ({
    etiqueta: l.localidad,
    n: l.ejePD.dirigidas,
    href: hrefLocalidad(l.localidad),
    color: l.ejePD.dirigidas < umbral ? 'var(--marca-dorado)' : 'var(--accent)',
  }));
  return (
    <div style={tarjeta}>
      <div style={tituloTarjeta}>Pauta dirigida por localidad</div>
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: 'var(--accent)' }}>
        {bajo.length} localidad{bajo.length === 1 ? '' : 'es'} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>con menos de {umbral} piezas dirigidas</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
        Mínimo {valores[0]} · mediana {mediana} · máximo {max} ({orden[orden.length - 1].localidad})
      </div>
      <BarrasHorizontales filas={barras} max={max} unidad="piezas dirigidas" />
      <button type="button" onClick={() => setTodas((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12.5, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', marginTop: 8 }}>
        {todas ? `Ver solo las ${mostrar} con menos` : `Ver las ${filas.length}`}
      </button>
      <div style={nota}>
        Piezas activas dirigidas a esa localidad (sin las provinciales, que son iguales para las 60). En dorado, las que están bajo {umbral}. Es el dato que diferencia localidades: el semáforo de PD, que suma las provinciales, hoy las deja a todas en verde.
      </div>
    </div>
  );
}

// --- E5 + B8: antigüedad de los temas activos de MT -------------------------
/** `t` = { tramos: {verde, amarillo, rojo, sinFecha}, sinFechaPorTipo: [{tipo, n}], total }. */
export function AntiguedadMT({ t }) {
  const segmentos = [
    { clave: 'verde', etiqueta: '🟢 0–29 días', n: t.tramos.verde, color: 'var(--cov-alta)' },
    { clave: 'amarillo', etiqueta: '🟡 30–49 días', n: t.tramos.amarillo, color: 'var(--cov-media)' },
    { clave: 'rojo', etiqueta: '🔴 50 días o más', n: t.tramos.rojo, color: 'var(--cov-baja)' },
    { clave: 'sinFecha', etiqueta: 'sin fecha de inicio', n: t.tramos.sinFecha, color: 'var(--cov-sin)' },
  ];
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>Antigüedad de los {num(t.total)} temas activos</div>
      <div style={{ display: 'flex', gap: 2, height: 12, marginTop: 6, borderRadius: 6, overflow: 'hidden' }} role="img" aria-label="Temas activos por antigüedad">
        {segmentos.map((s) =>
          s.n > 0 ? <div key={s.clave} style={{ width: `${(s.n / t.total) * 100}%`, background: s.color }} title={`${s.etiqueta}: ${num(s.n)} temas`} /> : null
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
        {segmentos.map((s) => (
          <span key={s.clave}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.color, marginRight: 5 }} />
            {s.etiqueta} <strong style={{ color: 'var(--text-primary)' }}>{num(s.n)}</strong>
          </span>
        ))}
      </div>
      <div style={nota}>
        Un tema activo por localidad y tipo de medio. Los {num(t.tramos.sinFecha)} sin fecha de inicio ({t.sinFechaPorTipo.map((x) => `${x.tipo} ${num(x.n)}`).join(', ')}) cuentan para la cobertura pero quedan fuera del semáforo de antigüedad.
      </div>
    </div>
  );
}

// --- B6: áreas sin carga reciente -------------------------------------------
export function AreasSinCargaReciente({ f }) {
  const filas = [
    { etiqueta: 'SMS', texto: f.sms ? `último envío cargado ${formatearFechaCorta(f.sms)}` : 'sin envíos cargados', href: '/sms' },
    { etiqueta: 'Contenido Orgánico', texto: f.organico ? `última publicación cargada ${formatearFechaCorta(f.organico)}` : 'sin publicaciones cargadas', href: '/contenido-organico' },
    { etiqueta: 'Audiovisuales', texto: `${f.avVigentes} pieza${f.avVigentes === 1 ? '' : 's'} vigente${f.avVigentes === 1 ? '' : 's'} de ${f.avTotal}${f.avUltimaCarga ? ` · última carga ${formatearFechaCorta(f.avUltimaCarga)}` : ''}`, href: null },
  ];
  return (
    <div style={{ ...tarjeta, borderTopColor: 'var(--marca-gris)' }}>
      <div style={tituloTarjeta}>Áreas sin carga reciente</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
        {filas.map((x) => (
          <li key={x.etiqueta}>
            {x.href ? (
              <Link href={x.href} style={{ fontWeight: 600, textDecoration: 'underline' }}>
                {x.etiqueta}
              </Link>
            ) : (
              <strong>{x.etiqueta}</strong>
            )}
            : {x.texto}
          </li>
        ))}
      </ul>
      <div style={nota}>No entran en el semáforo ni en las tarjetas de arriba. Se muestran para que no parezca que no existen.</div>
    </div>
  );
}

// --- B7: movimientos de la semana -------------------------------------------
export function TarjetaMovimientos({ m }) {
  return (
    <Link href="/movimientos" style={{ ...tarjeta, display: 'block', flex: '1 1 240px' }} title="Ver el detalle en Movimientos de la semana">
      <div style={tituloTarjeta}>Movimientos de la semana</div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, color: 'var(--accent)' }}>{num(m.total)}</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>avisos cambiaron de tema</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
        Medios Tradicionales{m.anterior && m.actual ? ` · ${formatearFechaDiaMes(m.anterior)} → ${formatearFechaDiaMes(m.actual)}` : ''} · un aviso es localidad + tipo de medio
      </div>
    </Link>
  );
}

// --- C5: cómo leer este tablero ---------------------------------------------
export function ComoLeer({ cortes, umbrales }) {
  const li = { marginBottom: 4 };
  return (
    <details className="desplegable" style={{ ...tarjeta, borderTopColor: 'var(--marca-gris)', padding: '6px 20px', marginTop: 14 }}>
      <summary>
        <span style={{ fontSize: 15 }}>¿Cómo leer este tablero?</span>
      </summary>
      <ul style={{ margin: '4px 0 12px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.5 }}>
        <li style={li}>
          <strong>Cobertura de Medios Tradicionales:</strong> cuántos tipos de medio (TV, radio, web, cartelería, vía pública, gráfica, pantalla LED) tienen un tema activo en la localidad.
          {cortes ? ` Sin = 0 · Baja = 1 a ${cortes.baja_max} · Media = ${cortes.baja_max + 1} a ${cortes.media_max} · Alta = más de ${cortes.media_max}.` : ''}
        </li>
        <li style={li}>
          <strong>Semáforo de Medios Tradicionales:</strong> antigüedad del tema activo más nuevo. 🟢 menos de {umbrales.amarilla} días · 🟡 {umbrales.amarilla} a {umbrales.roja - 1} · 🔴 {umbrales.roja} o más. Los temas sin fecha de inicio no se miden.
        </li>
        <li style={li}>
          <strong>Semáforo de Pauta Digital:</strong> piezas activas hoy en la localidad, dirigidas y provinciales. 🔴 0 a {PD_MIN_AMARILLO - 1} · 🟡 {PD_MIN_AMARILLO} a {PD_MIN_VERDE - 1} · 🟢 {PD_MIN_VERDE} o más.
        </li>
        <li style={li}>
          <strong>Pieza dirigida:</strong> apunta a esa localidad, a un circuito de Capital o a todas las localidades de un departamento. <strong>Provincial:</strong> se reparte a las 60 y cuenta una vez en cada una.
        </li>
        <li style={li}>
          <strong>Atención — próximos {PD_DIAS_VENTANA} días:</strong> localidades que bajarían de color si no se renueva lo que vence en la ventana, aun contando las piezas programadas.
        </li>
        <li style={li}>
          <strong>De dónde sale cada número:</strong> de las planillas de cada área, procesadas en cada carga (la fecha está arriba de todo). El tablero no estima ni completa datos que faltan.
        </li>
      </ul>
    </details>
  );
}
