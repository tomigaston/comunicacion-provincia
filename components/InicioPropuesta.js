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
  borderRadius: 12,
  padding: '16px 20px 18px',
  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
};
// Mismo estilo que los títulos de tarjeta de ResumenCards.js.
export const tituloTarjeta = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 };
const nota = { fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.4 };
// `font: 'inherit'` va primero: si va después, pisa el tamaño y el botón
// queda con la letra de la página (16px) en vez de 12,5.
const botonChip = (activo) => ({
  font: 'inherit',
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
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

// --- Grilla de localidades: vista resumida o completa (19/11/2026) ----------
// El antiguo "Las 60 localidades de un vistazo" repetía lo que muestran las
// tarjetas. Ahora es la vista resumida de la misma grilla (mismas filas y
// mismos filtros). Solo cambia cómo se ordena y se dibuja; no calcula nada.
const RANGO = { Sin: 0, Baja: 1, Media: 2, Alta: 3 };
const PESO_PD = { '🔴': 0, '🟡': 1, '🟢': 2 };

const ORDENES = [
  { key: 'habitantes', label: 'Cantidad de habitantes' },
  { key: 'cobertura', label: 'Menor cobertura primero' },
  { key: 'depto', label: 'Por departamento' },
];
const VISTAS = [
  { key: 'resumida', label: 'Vista resumida' },
  { key: 'completa', label: 'Vista completa' },
];

const porNombre = (a, b) => a.localidad.localeCompare(b.localidad, 'es');

/** Grupos a dibujar: [{ titulo, filas }]. `titulo` es null salvo por departamento.
 * Habitantes: campo `poblacion` de data/localidades.json, de mayor a menor. */
function agrupar(filas, orden) {
  if (orden === 'cobertura') {
    const lista = filas.slice().sort((a, b) => RANGO[a.bandaCobertura] - RANGO[b.bandaCobertura] || PESO_PD[a.ejePD.color] - PESO_PD[b.ejePD.color] || porNombre(a, b));
    return [{ titulo: null, filas: lista }];
  }
  if (orden === 'depto') {
    const grupos = new Map();
    for (const l of filas.slice().sort((a, b) => a.departamento.localeCompare(b.departamento, 'es') || porNombre(a, b))) {
      if (!grupos.has(l.departamento)) grupos.set(l.departamento, []);
      grupos.get(l.departamento).push(l);
    }
    return Array.from(grupos, ([titulo, ls]) => ({ titulo, filas: ls }));
  }
  const lista = filas.slice().sort((a, b) => (b.poblacion || 0) - (a.poblacion || 0) || porNombre(a, b));
  return [{ titulo: null, filas: lista }];
}

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

function Botonera({ opciones, valor, onCambiar, etiqueta }) {
  return (
    <div role="group" aria-label={etiqueta} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opciones.map((o) => (
        <button key={o.key} type="button" style={botonChip(valor === o.key)} onClick={() => onCambiar(o.key)} aria-pressed={valor === o.key}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** `filas` = las filas ya filtradas de combinarLocalidades() (las mismas en las
 * dos vistas). `encabezado`: la línea "Mostrando N de 60". `Tarjeta`: la
 * tarjeta de la vista completa (LocalidadCard). Vista resumida: fondo y borde =
 * banda de MT; punto = color de PD. */
export function GrillaLocalidades({ filas, encabezado, Tarjeta }) {
  const [vista, setVista] = useState('resumida');
  const [orden, setOrden] = useState('habitantes');
  const grupos = agrupar(filas, orden);
  const resumida = vista === 'resumida';
  const grilla = resumida
    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 4 }
    : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{encabezado}</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginLeft: 'auto' }}>
          <Botonera opciones={ORDENES} valor={orden} onCambiar={setOrden} etiqueta="Ordenar localidades" />
          <Botonera opciones={VISTAS} valor={vista} onCambiar={setVista} etiqueta="Vista de las localidades" />
        </div>
      </div>
      {grupos.map((g) => (
        <div key={g.titulo || 'todas'} style={{ marginBottom: g.titulo ? (resumida ? 8 : 16) : 0 }}>
          {g.titulo && (
            <div style={{ fontSize: resumida ? 11 : 12, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 0.3, margin: resumida ? '4px 0 3px' : '6px 0 8px' }}>{g.titulo}</div>
          )}
          <div style={grilla}>{g.filas.map((l) => (resumida ? <Celda key={l.localidad} l={l} /> : <Tarjeta key={l.localidad} {...l} />))}</div>
        </div>
      ))}
      {resumida && filas.length > 0 && <LeyendaResumida />}
    </div>
  );
}

function LeyendaResumida() {
  return (
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
  );
}

// --- B3: cruce Medios Tradicionales × Pauta Digital -------------------------
// Compacto, arriba de la grilla (19/11/2026): número y referencia. Cada
// tarjetita filtra la grilla con los filtros que ya existen (banda de MT y
// color de PD), así la grilla muestra justo esas localidades.
const CRUCE = [
  { key: 'bb', mt: 'media o alta', pd: '🟢', bandas: ['Media', 'Alta'], colores: ['🟢'], tono: 'bien' },
  { key: 'bm', mt: 'media o alta', pd: '🟡🔴', bandas: ['Media', 'Alta'], colores: ['🟡', '🔴'], tono: 'medio' },
  { key: 'mb', mt: 'sin o baja', pd: '🟢', bandas: ['Sin', 'Baja'], colores: ['🟢'], tono: 'medio' },
  { key: 'mm', mt: 'sin o baja', pd: '🟡🔴', bandas: ['Sin', 'Baja'], colores: ['🟡', '🔴'], tono: 'mal' },
];
const mismoConjunto = (set, lista) => set.size === lista.length && lista.every((x) => set.has(x));

function CeldaCruce({ n, c, activa, onClick }) {
  const fondo = c.tono === 'bien' ? 'var(--cov-alta-bg)' : c.tono === 'mal' ? 'var(--cov-baja-bg)' : 'var(--cov-media-bg)';
  const color = c.tono === 'bien' ? 'var(--cov-alta)' : c.tono === 'mal' ? 'var(--cov-baja)' : 'var(--cov-media)';
  return (
    <button
      type="button"
      className="cruce-celda"
      onClick={onClick}
      aria-pressed={activa}
      title={activa ? 'Clic para sacar el filtro' : `Ver estas ${n} localidades en la grilla`}
      style={{ background: fondo, borderRadius: 10, padding: '10px 12px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', border: `2px solid ${activa ? color : 'transparent'}` }}
    >
      <div style={{ fontSize: 24, fontWeight: 600, color, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      {/* Si no entra en un renglón, corta entre MT y PD, nunca en el medio. */}
      <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2, color: 'var(--text-secondary)' }}>
        <span style={{ whiteSpace: 'nowrap' }}>MT {c.mt}</span> · <span style={{ whiteSpace: 'nowrap' }}>PD {c.pd}</span>
      </div>
    </button>
  );
}

/** Cuatro tarjetitas sobre las mismas filas de la grilla (las 60, sin
 * filtros). `filtro` = { bandas: Set, pd: Set, sinOtros: bool } para marcar la
 * elegida; `onFiltrar(bandas, colores)` filtra la grilla (o la limpia si ya
 * estaba elegida). */
export function CruceMTPD({ filas, filtro = null, onFiltrar = null }) {
  const cuenta = (c) => filas.filter((l) => c.bandas.includes(l.bandaCobertura) && c.colores.includes(l.ejePD.color)).length;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 14 }}>
      {CRUCE.map((c) => {
        const activa = !!filtro && filtro.sinOtros && mismoConjunto(filtro.bandas, c.bandas) && mismoConjunto(filtro.pd, c.colores);
        return <CeldaCruce key={c.key} n={cuenta(c)} c={c} activa={activa} onClick={() => onFiltrar && onFiltrar(c.bandas, c.colores)} />;
      })}
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
/** `f.onClick` (opcional): la fila filtra la grilla; `f.activo` la marca y
 * `f.atenuado` la apaga cuando hay otra elegida. */
function FilaBarra({ f, max, unidad }) {
  const ancho = max ? Math.max(1, (f.n / max) * 100) : 0;
  const barra = (
    <div style={{ height: 10, background: 'var(--bg-secondary)', borderRadius: 5, opacity: f.atenuado ? 0.35 : 1 }} title={`${f.etiqueta}: ${num(f.n)} ${unidad}`}>
      <div style={{ width: `${ancho}%`, height: '100%', background: f.color || 'var(--accent)', borderRadius: 5 }} />
    </div>
  );
  const botonFila = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', width: '100%', display: 'block' };
  return (
    <>
      <div style={{ fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={f.etiqueta}>
        {f.href ? (
          <Link href={f.href} style={{ textDecoration: 'underline' }}>
            {f.etiqueta}
          </Link>
        ) : f.onClick ? (
          <button type="button" onClick={f.onClick} aria-pressed={!!f.activo} title={f.activo ? 'Clic para sacar el filtro' : `Ver las localidades con ${f.etiqueta}`} style={{ ...botonFila, fontWeight: f.activo ? 700 : 400, textDecoration: f.activo ? 'underline' : 'none', opacity: f.atenuado ? 0.55 : 1 }}>
            {f.etiqueta}
          </button>
        ) : (
          f.etiqueta
        )}
      </div>
      {f.onClick ? (
        <button type="button" onClick={f.onClick} aria-label={`Filtrar por ${f.etiqueta}`} style={botonFila}>
          {barra}
        </button>
      ) : (
        barra
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 34, textAlign: 'right' }}>{num(f.n)}</div>
    </>
  );
}

/** `areas` = { distintas: [{area, n}], porLocalidad: [{area, n}], totalDistintas, totalPorLocalidad }. */
/** `activo`: área que hoy filtra la grilla; `onFiltrar(area)` la filtra. */
export function GraficoAreas({ areas, activo = null, onFiltrar = null }) {
  const [modo, setModo] = useState('distintas');
  const lista = modo === 'distintas' ? areas.distintas : areas.porLocalidad;
  const total = modo === 'distintas' ? areas.totalDistintas : areas.totalPorLocalidad;
  const filas = lista.map((a) => ({
    etiqueta: a.area,
    n: a.n,
    onClick: onFiltrar ? () => onFiltrar(a.area) : null,
    activo: activo === a.area,
    atenuado: !!activo && activo !== a.area,
  }));
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
// NO SE MUESTRA por ahora (pedido del 19/11/2026: confundía). Queda el código
// para volver a usarla: se agrega <TarjetaDirigidas filas={filas} /> al lado
// de GraficoAreas en ResumenGeneral (components/ResumenCards.js).
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
      <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.25, color: 'var(--accent)', letterSpacing: -0.2 }}>
        {bajo.length} localidad{bajo.length === 1 ? '' : 'es'} <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>con menos de {umbral} piezas dirigidas</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
        Mínimo {valores[0]} · mediana {mediana} · máximo {max} ({orden[orden.length - 1].localidad})
      </div>
      {/* La lista va plegada (pedido del 19/11/2026): arriba queda el titular. */}
      <details className="desplegable desplegable-destacado tono-celeste" style={{ marginTop: 6 }}>
        <summary>
          <span style={{ fontSize: 14 }}>Ver localidades, de menos a más piezas dirigidas</span>
        </summary>
        <BarrasHorizontales filas={barras} max={max} unidad="piezas dirigidas" />
        <button type="button" onClick={() => setTodas((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12.5, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', marginTop: 8 }}>
          {todas ? `Ver solo las ${mostrar} con menos` : `Ver las ${filas.length}`}
        </button>
      </details>
      <div style={nota}>
        Piezas activas dirigidas a esa localidad (sin las provinciales, que son iguales para las 60). En dorado, las que están bajo {umbral}.
      </div>
    </div>
  );
}

// --- E5 + B8: antigüedad de los temas activos de MT -------------------------
/** `t` = { tramos: {verde, amarillo, rojo, sinFecha}, sinFechaPorTipo: [{tipo, n}], total }. */
/** `activo`: tramo que hoy filtra la grilla; `onFiltrar(clave, etiqueta)` lo
 * filtra (localidades con al menos un tema activo en ese tramo). */
export function AntiguedadMT({ t, activo = null, onFiltrar = null }) {
  const textoFiltro = {
    verde: 'algún tema de MT de 0–29 días',
    amarillo: 'algún tema de MT de 30–49 días',
    rojo: 'algún tema de MT de 50 días o más',
    sinFecha: 'algún tema de MT sin fecha de inicio',
  };
  const tocar = (s) => (onFiltrar ? () => onFiltrar(s.clave, textoFiltro[s.clave]) : undefined);
  const segmentos = [
    { clave: 'verde', etiqueta: '0–29 días', n: t.tramos.verde, color: 'var(--cov-alta)' },
    { clave: 'amarillo', etiqueta: '30–49 días', n: t.tramos.amarillo, color: 'var(--cov-media)' },
    { clave: 'rojo', etiqueta: '50 días o más', n: t.tramos.rojo, color: 'var(--cov-baja)' },
    { clave: 'sinFecha', etiqueta: 'sin fecha de inicio', n: t.tramos.sinFecha, color: 'var(--cov-sin)' },
  ];
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>Antigüedad de los {num(t.total)} temas activos</div>
      <div style={{ display: 'flex', gap: 2, height: 12, marginTop: 6, borderRadius: 6, overflow: 'hidden' }} aria-label="Temas activos por antigüedad">
        {segmentos.map((s) =>
          s.n > 0 ? (
            <button
              key={s.clave}
              type="button"
              onClick={tocar(s)}
              aria-pressed={activo === s.clave}
              title={`${s.etiqueta}: ${num(s.n)} temas${onFiltrar ? ' · ver las localidades' : ''}`}
              style={{ width: `${(s.n / t.total) * 100}%`, background: s.color, border: 'none', padding: 0, cursor: onFiltrar ? 'pointer' : 'default', opacity: activo && activo !== s.clave ? 0.3 : 1 }}
            />
          ) : null
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
        {segmentos.map((s) => (
          <button
            key={s.clave}
            type="button"
            onClick={tocar(s)}
            aria-pressed={activo === s.clave}
            title={onFiltrar ? `Ver las localidades con ${textoFiltro[s.clave]}` : undefined}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12.5, color: activo === s.clave ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: onFiltrar ? 'pointer' : 'default', textDecoration: activo === s.clave ? 'underline' : 'none', fontWeight: activo === s.clave ? 600 : 400 }}
          >
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.color, marginRight: 5 }} />
            {s.etiqueta} <strong style={{ color: 'var(--text-primary)' }}>{num(s.n)}</strong>
          </button>
        ))}
      </div>
      <div style={nota}>
        Un tema activo por localidad y tipo de medio. Los {num(t.tramos.sinFecha)} sin fecha de inicio ({t.sinFechaPorTipo.map((x) => `${x.tipo} ${num(x.n)}`).join(', ')}) cuentan para la cobertura pero quedan fuera del semáforo de antigüedad.
      </div>
    </div>
  );
}

// --- C5: cómo leer este tablero ---------------------------------------------
export function ComoLeer({ cortes, umbrales }) {
  const li = { marginBottom: 4 };
  return (
    <details className="desplegable" style={{ ...tarjeta, padding: '6px 20px', marginTop: 14 }}>
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
