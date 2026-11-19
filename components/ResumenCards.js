import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { BANDA_COBERTURA, ORDEN_BANDAS, textoVencimiento, textoActivasPD } from '../lib/coverage';
import { PD_DIAS_VENTANA, colorDeAlerta } from '../lib/semaforo';
import { hrefLocalidad, hrefCampana } from '../lib/rutas';
import { formatearFechaDiaMes } from '../lib/fechas';
import {
  FechaDelDato,
  GraficoVencimientos,
  GraficoAreas,
  TarjetaDirigidas,
  AntiguedadMT,
  ComoLeer,
} from './InicioPropuesta';

// PROPUESTA DE INICIO (6/11/2026): copia de components/ResumenCards.js con las
// tarjetas y figuras nuevas de InicioPropuesta.js. Para comparar, no aplicada.

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

const tipoMedioEstilo = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  alignItems: 'flex-start',
  textAlign: 'left',
  padding: '7px 10px',
  borderRadius: 10,
  border: '1px solid transparent',
  // `font` va antes que el tamaño: si va después, lo pisa y la casilla
  // queda con la letra de la página (16px).
  font: 'inherit',
  fontSize: 12.5,
  lineHeight: 1.3,
};

// C6: las tarjetas llevan la misma franja celeste que los indicadores.
const cardEstilo = {
  flex: '1 1 320px',
  minWidth: 280,
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '16px 20px 18px',
  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
};
const tituloCard = { fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 };
const titular = { fontSize: 18, fontWeight: 600, lineHeight: 1.25, letterSpacing: -0.2 };
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

/** "2026-11-06" -> "06/11". */
const diaMes = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// --- Pantalla general (Fase 1, 5/11/2026) ---------------------------------
// Fila de indicadores arriba (número grande + contexto), bloque Atención
// compacto con desplegables, y las tarjetas de Medios tradicionales y Pauta
// digital con sus listas plegadas. Cero cálculo nuevo: todo sale de
// resumenGeneral() (lib/resumen.js), igual que antes; solo cambia cómo se
// presenta. Los desplegables son <details>/<summary> nativos: cerrados por
// defecto y accesibles con teclado.

const indicadorEstilo = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '14px 16px',
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
};

/** Tarjeta de indicador: número grande, etiqueta y una línea de contexto.
 * `tono`: 'rojo' (alerta), 'discreto' (todo en orden) o null (neutro). */
function Indicador({ valor, sufijo, etiqueta, detalle, tono = null, onClick, title }) {
  // Colores de marca: número en el celeste de acento y una línea celeste a la
  // izquierda; en rojo si es una alerta, en gris si está todo en orden.
  const colorValor = tono === 'rojo' ? 'var(--cov-baja)' : tono === 'discreto' ? 'var(--text-tertiary)' : 'var(--accent)';
  const borde = tono === 'rojo' ? 'var(--cov-baja)' : 'var(--border)';
  const franja = tono === 'rojo' ? 'var(--cov-baja)' : tono === 'discreto' ? 'var(--marca-gris)' : 'var(--marca-celeste)';
  const fondo = tono === 'rojo' ? 'var(--cov-baja-bg)' : 'var(--bg-primary)';
  return (
    <button type="button" onClick={onClick} title={title} style={{ ...indicadorEstilo, borderColor: borde, borderLeft: `4px solid ${franja}`, background: fondo, boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)' }}>
      <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1, color: colorValor, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3 }}>
        {valor}
        {sufijo && <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>{sufijo}</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, marginTop: 6, color: tono === 'discreto' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{etiqueta}</div>
      {detalle && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{detalle}</div>}
    </button>
  );
}

/** Fila de indicadores (1.1). Valores: los mismos que ya mostraban las cards.
 * "Sin cobertura" va última y discreta en 0; en rojo y primera si es mayor a 0.
 * Movimientos de la semana (19/11/2026): reemplaza al de vencimientos, que se
 * sigue viendo en el bloque Atención. Mismo dato que la pestaña Movimientos
 * (total_avisos_cambiaron); `movimientos` = propuesta.movimientos. */
function Indicadores({ r, movimientos = null, onFiltrarBandas, onFiltrarSinCobertura, onVerCampanasPD, onVerMovimientos }) {
  const m = r.mt.movimiento;
  const flecha = !m ? '' : m.variacion > 0 ? '▲' : m.variacion < 0 ? '▼' : '=';
  const signo = m && m.variacion > 0 ? '+' : '';
  const [dd, mm] = m ? m.fecha.split('-').slice(1).reverse() : [];
  const haySinCobertura = r.sinCobertura > 0;

  const sinCobertura = (
    <Indicador
      key="sin-cobertura"
      valor={r.sinCobertura}
      sufijo={` de ${r.total}`}
      etiqueta="Sin cobertura"
      detalle={
        haySinCobertura
          ? `Sin Medios Tradicionales activos ni Pauta Digital activa: ${r.sinCoberturaNombres.join(', ')}`
          : 'Todas tienen Medios Tradicionales activos o Pauta Digital activa.'
      }
      tono={haySinCobertura ? 'rojo' : 'discreto'}
      title="Ver en la grilla: sin Medios Tradicionales y con 0–5 piezas de Pauta Digital"
      onClick={onFiltrarSinCobertura}
    />
  );

  const resto = [
    <Indicador
      key="pd"
      valor={r.pd.campanas.length}
      etiqueta="campañas de Pauta Digital"
      detalle={`${r.pd.activas.toLocaleString('es-AR')} piezas activas en las 60 localidades`}
      title="Suma de las 60 localidades: una pieza provincial cuenta una vez en cada localidad. Clic para ver las campañas."
      onClick={onVerCampanasPD}
    />,
    <Indicador
      key="dirigidas"
      valor={r.pd.dirigidas.toLocaleString('es-AR')}
      etiqueta="piezas dirigidas a localidades"
      detalle={`más ${r.pd.provinciales.toLocaleString('es-AR')} provinciales, que cuentan en las 60`}
      title="Piezas activas dirigidas a una localidad puntual, sin las provinciales. Clic para ver las campañas."
      onClick={onVerCampanasPD}
    />,
    <Indicador
      key="mt"
      valor={r.mt.conCoberturaMediaOAlta}
      sufijo={`/${r.total}`}
      etiqueta="con cobertura media o alta"
      detalle={m ? `Medios Tradicionales · ${flecha} ${signo}${m.variacion} vs. ${dd}/${mm}` : 'Medios Tradicionales'}
      title="Ver esas localidades en la grilla"
      onClick={() => onFiltrarBandas(['Media', 'Alta'])}
    />,
    movimientos && (
      <Indicador
        key="movimientos"
        valor={movimientos.total.toLocaleString('es-AR')}
        etiqueta="avisos cambiaron de tema"
        detalle={`Movimientos de la semana · Medios Tradicionales${movimientos.anterior && movimientos.actual ? ` · ${formatearFechaDiaMes(movimientos.anterior)} → ${formatearFechaDiaMes(movimientos.actual)}` : ''}`}
        title="Un aviso es localidad + tipo de medio. Clic para ver el detalle en Movimientos de la semana."
        onClick={onVerMovimientos}
      />
    ),
  ];

  const tarjetas = haySinCobertura ? [sinCobertura, ...resto] : [...resto, sinCobertura];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(136px, 1fr))', gap: 12, marginBottom: 14 }}>
      {tarjetas}
    </div>
  );
}

const celdaTabla = { padding: '5px 8px', fontSize: 13, textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const encabezadoTabla = { ...celdaTabla, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 };

/** Bloque de aviso de PD (Atención / Cubierto por programadas), misma
 * estructura que el mail: un renglón por fecha de FIN (piezas distintas) con
 * sus campañas en un desplegable, y las localidades en una tabla plegada.
 * Atención: "activas hoy → al fin de la ventana"; cubiertas: "sin programadas ·
 * con programadas". `b` = armarBloqueAvisoPD(). `refPrimeraFecha` apunta al
 * primer desplegable para abrirlo desde el indicador de vencimientos. */
function BloqueAvisoPD({ b, ventanaHasta, cubiertas = false, refPrimeraFecha }) {
  return (
    <div className="renglones-alternados" style={{ marginTop: 8 }}>
      {b.fechas.map((f, i) => (
        <details key={f.fecha} className="desplegable" ref={i === 0 ? refPrimeraFecha : undefined}>
          <summary>
            <span>
              <strong>{diaMes(f.fecha)}</strong> · Vencen {f.piezas.toLocaleString('es-AR')} pieza{f.piezas === 1 ? '' : 's'} de{' '}
              {f.campanas.length} campaña{f.campanas.length === 1 ? '' : 's'}
            </span>
            <span className="desplegable-accion">Ver campañas</span>
          </summary>
          <ul style={lista}>
            {f.campanas.map((c) => (
              <li key={c}>
                <LinkCampana nombre={c} />
              </li>
            ))}
          </ul>
        </details>
      ))}
      <details className="desplegable">
        <summary>
          <span>
            Ver las {b.localidades.length} localidad{b.localidades.length === 1 ? '' : 'es'} afectada{b.localidades.length === 1 ? '' : 's'}
          </span>
        </summary>
        <div className="tabla-desplazable">
          <table style={{ borderCollapse: 'collapse', marginTop: 4, minWidth: 320 }}>
            <thead>
              <tr>
                <th style={encabezadoTabla}>Localidad</th>
                <th style={encabezadoTabla}>Activas hoy</th>
                {cubiertas ? (
                  <>
                    <th style={encabezadoTabla}>Sin programadas</th>
                    <th style={encabezadoTabla}>Con programadas</th>
                  </>
                ) : (
                  <th style={encabezadoTabla}>Al {diaMes(ventanaHasta)}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {b.localidades.map((l) => (
                <tr key={l.localidad}>
                  <td style={celdaTabla}>
                    <LinkLocalidad nombre={l.localidad} />
                  </td>
                  <td style={celdaTabla}>{l.activas}</td>
                  {cubiertas ? (
                    <>
                      <td style={celdaTabla}>
                        {l.sinProgramadas} <Chip color={l.colorSinProgramadas}>{l.colorSinProgramadas}</Chip>
                      </td>
                      <td style={celdaTabla}>
                        {l.proyectadas} <Chip color={l.colorProyectado}>{l.colorProyectado}</Chip>
                      </td>
                    </>
                  ) : (
                    <td style={celdaTabla}>
                      {l.proyectadas} <Chip color={l.colorProyectado}>{l.colorProyectado}</Chip>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Bloque "Atención — próximos 7 días" (1.2): mismos números y misma lógica
 * que antes, presentación compacta. */
function BloqueAtencion({ r, hoy, refBloque, refPrimeraFecha }) {
  const { atencion, cubiertas, ventanaHasta } = r.pd;
  const colorBorde = atencion.total ? 'var(--cov-baja)' : 'var(--cov-alta)';
  return (
    <div ref={refBloque} style={{ ...cardEstilo, flex: '1 1 100%', padding: '14px 18px 16px', marginBottom: 14, borderLeft: `4px solid ${colorBorde}` }}>
      <div style={tituloCard}>Atención — próximos {PD_DIAS_VENTANA} días</div>
      {atencion.total ? (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
            ⚠️ {atencion.total} localidad{atencion.total === 1 ? ' baja' : 'es bajan'} de color en Pauta Digital si no se renueva lo que vence hasta el{' '}
            {diaMes(ventanaHasta)}
          </div>
          <div style={{ ...chico, marginTop: 4 }}>Aun contando las Programadas.</div>
          {/* E1: un vistazo de qué día se cae la pauta. */}
          {hoy && <GraficoVencimientos fechas={atencion.fechas} hoy={hoy} ventanaHasta={ventanaHasta} />}
          <BloqueAvisoPD b={atencion} ventanaHasta={ventanaHasta} refPrimeraFecha={refPrimeraFecha} />
        </>
      ) : (
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Ninguna localidad baja de color en Pauta Digital</div>
      )}
      {cubiertas.total > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ ...detalle, fontWeight: 600, marginTop: 0 }}>
            ℹ️ {cubiertas.total} localidad{cubiertas.total === 1 ? '' : 'es'} cubierta{cubiertas.total === 1 ? '' : 's'} por Programadas
          </div>
          <BloqueAvisoPD b={cubiertas} ventanaHasta={ventanaHasta} cubiertas />
        </div>
      )}
    </div>
  );
}

/** `activa`: banda que hoy filtra la grilla sola (null si no hay una sola). */
function BarraApilada({ bandas, total, onFiltrarBandas, activa = null }) {
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
              aria-pressed={activa === b}
              style={{ width: `${(bandas[b] / total) * 100}%`, background: BANDA_COBERTURA[b].fg, border: 'none', padding: 0, cursor: 'pointer', opacity: activa && activa !== b ? 0.3 : 1 }}
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
            aria-pressed={activa === b}
            style={{ ...enlace, textDecoration: activa === b ? 'underline' : 'none', color: activa === b ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activa === b ? 700 : 400 }}
          >
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: BANDA_COBERTURA[b].fg, marginRight: 5 }} />
            {b} {bandas[b]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Cambios de banda contra la carga anterior. El titular "N/60 con cobertura
 * media o alta" y la variación ya están en la fila de indicadores. */
function Movimiento({ r, abierto, onToggle }) {
  const m = r.mt.movimiento;
  if (!m) return null;
  const [dd, mm] = m.fecha.split('-').slice(1).reverse();
  if (m.cambios.length === 0) return <div style={chico}>Ninguna localidad cambió de banda desde el {dd}/{mm}.</div>;
  const { visibles, resto } = conResto(m.cambios, abierto ? m.cambios.length : 4);
  return (
    <div style={detalle}>
      Cambiaron de banda desde el {dd}/{mm}:{' '}
      {visibles.map((c, i) => (
        <span key={c.localidad}>
          {i > 0 ? ', ' : ''}
          <LinkLocalidad nombre={c.localidad} style={{ color: 'var(--text-primary)', fontWeight: 500, textDecorationColor: 'var(--border)' }}>
            {c.localidad}
          </LinkLocalidad>{' '}
          <span style={{ color: c.empeoro ? 'var(--cov-baja)' : 'var(--cov-alta)', fontWeight: 600 }}>{c.empeoro ? '↓' : '↑'}</span> {c.a}
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
    </div>
  );
}

/** Pantalla general. `r` = resumenGeneral(); `onFiltrarBandas(['Sin','Baja'])`
 * filtra la grilla y lleva hasta ella; `onFiltrarSinCobertura()` deja la grilla
 * en banda Sin + Pauta Digital 🔴. `bandaActiva`: banda que hoy filtra sola la
 * grilla (para marcarla en la barra). Dos columnas (19/11/2026): `ladoIzquierdo`
 * (filtros y grilla de localidades) va a la izquierda y los resúmenes a la
 * derecha; en pantallas angostas se apilan (styles/globals.css). */
export function ResumenGeneral({ r, repetidosPD = null, propuesta = null, filas = null, onFiltrarBandas, onFiltrarSinCobertura, bandaActiva = null, filtroGrafico = null, onFiltrarGrafico = null, ladoIzquierdo = null }) {
  const [cambiosAbiertos, setCambiosAbiertos] = useState(false);
  // Filtro 🔴/🟡 de la lista de temas por revisar (null = todos).
  const [colorTemas, setColorTemas] = useState(null);
  const refAtencion = useRef(null);
  const refPrimeraFecha = useRef(null);
  const refListaPD = useRef(null);
  const router = useRouter();
  const refColumnas = useRef(null);

  // Columnas con desplazamiento propio (pantallas anchas, ver globals.css):
  // al bajar con la rueda, primero baja la página hasta que las columnas
  // llegan arriba y recién ahí se mueve cada columna por dentro. Así nunca se
  // desplaza una columna que todavía está cortada abajo.
  useEffect(() => {
    const cont = refColumnas.current;
    if (!cont) return undefined;
    function alGirar(e) {
      if (e.deltaY <= 0 || window.innerWidth <= 1100) return;
      const falta = cont.getBoundingClientRect().top - 12;
      if (falta > 1) {
        e.preventDefault();
        window.scrollBy(0, Math.min(e.deltaY, falta));
      }
    }
    cont.addEventListener('wheel', alGirar, { passive: false });
    return () => cont.removeEventListener('wheel', alGirar);
  }, []);

  const temasLista = r.mt.temas.filter((t) => !colorTemas || t.color === colorTemas);

  function irA(ref) {
    if (ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function verCampanasPD() {
    if (refListaPD.current) refListaPD.current.open = true;
    irA(refListaPD);
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {/* B1: fecha de cada fuente. */}
      {propuesta && <FechaDelDato f={propuesta.fechas} />}
      <Indicadores
        r={r}
        onFiltrarBandas={onFiltrarBandas}
        onFiltrarSinCobertura={onFiltrarSinCobertura}
        onVerCampanasPD={verCampanasPD}
        movimientos={propuesta ? propuesta.movimientos : null}
        onVerMovimientos={() => router.push('/movimientos')}
      />
      <BloqueAtencion r={r} hoy={propuesta ? propuesta.hoy : null} refBloque={refAtencion} refPrimeraFecha={refPrimeraFecha} />
      <div className="inicio-dos-columnas" ref={refColumnas}>
        {ladoIzquierdo && <div className="inicio-col-localidades">{ladoIzquierdo}</div>}
        <div className="inicio-col-resumen">
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={cardEstilo}>
              <div style={tituloCard}>Medios tradicionales</div>
              <BarraApilada bandas={r.mt.bandas} total={r.total} onFiltrarBandas={onFiltrarBandas} activa={bandaActiva} />
              <Movimiento r={r} abierto={cambiosAbiertos} onToggle={() => setCambiosAbiertos((v) => !v)} />
              <details className="desplegable desplegable-destacado tono-ambar" style={{ marginTop: 10 }}>
                <summary>
                  <span>
                    <span style={{ fontSize: 14 }}>
                      {r.mt.temasPorRevisar} tema{r.mt.temasPorRevisar === 1 ? '' : 's'} por revisar
                    </span>{' '}
                    · 🔴 {r.mt.rojos} · 🟡 {r.mt.amarillos}{' '}
                    <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>(más antiguos primero)</span>
                  </span>
                </summary>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 6px' }}>
                  <Chip color={null} onClick={() => setColorTemas(null)} activo={colorTemas === null}>
                    Todos
                  </Chip>
                  <Chip color="🔴" onClick={() => setColorTemas('🔴')} activo={colorTemas === '🔴'}>
                    🔴 {r.mt.rojos}
                  </Chip>
                  <Chip color="🟡" onClick={() => setColorTemas('🟡')} activo={colorTemas === '🟡'}>
                    🟡 {r.mt.amarillos}
                  </Chip>
                </div>
                <ul style={lista}>
                  {temasLista.map((t) => (
                    <li key={t.tema + t.dias}>
                      {t.color} <LinkCampana nombre={t.tema} /> · {t.tipo} · {t.dias} días · {t.localidades} localidad{t.localidades === 1 ? '' : 'es'}
                    </li>
                  ))}
                </ul>
              </details>
              {/* E5 + B8: antigüedad por tramo y temas sin fecha. */}
              {propuesta && (
                <AntiguedadMT
                  t={propuesta.antiguedadMT}
                  activo={filtroGrafico && filtroGrafico.tipo === 'antiguedad' ? filtroGrafico.clave : null}
                  onFiltrar={onFiltrarGrafico ? (clave, etiqueta) => onFiltrarGrafico('antiguedad', clave, etiqueta) : null}
                />
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
              {/* Letra más grande y color de marca (pedido del 6/11/2026). */}
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.25, color: 'var(--accent)', letterSpacing: -0.2 }}>
                {r.pd.activas.toLocaleString('es-AR')} piezas activas
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}> · {r.pd.campanas.length} campaña{r.pd.campanas.length === 1 ? '' : 's'}</span>
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-primary)', marginTop: 6 }}>
                <strong>{r.pd.dirigidas.toLocaleString('es-AR')}</strong> dirigidas a localidades · <strong>{r.pd.provinciales.toLocaleString('es-AR')}</strong> provinciales
              </div>
              {/* A3: las provinciales son pocas piezas repetidas en las 60. */}
              {propuesta && propuesta.provinciales ? (
                <div style={{ ...chico, fontSize: 13 }}>
                  Cada localidad cuenta {propuesta.provinciales.porLocalidad} piezas provinciales, las mismas en las {r.total} ({propuesta.provinciales.distintas} contenidos distintos): por eso suman{' '}
                  {r.pd.provinciales.toLocaleString('es-AR')}.
                </div>
              ) : (
                <div style={{ ...chico, fontSize: 13 }}>Suma de las 60 localidades: una pieza provincial cuenta una vez en cada localidad.</div>
              )}
              {repetidosPD && (
                <details className="desplegable desplegable-destacado tono-dorado" style={{ marginTop: 10 }}>
                  <summary>
                    <span>
                      <span style={{ fontSize: 14 }}>
                        {repetidosPD.antiguos.length} contenido{repetidosPD.antiguos.length === 1 ? '' : 's'} vigente{repetidosPD.antiguos.length === 1 ? '' : 's'} hace 2 meses o más
                      </span>{' '}
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                        ({repetidosPD.provinciales} provincial{repetidosPD.provinciales === 1 ? '' : 'es'} · {repetidosPD.soloDirigidos} solo dirigido{repetidosPD.soloDirigidos === 1 ? '' : 's'})
                      </span>
                    </span>
                  </summary>
                  <div style={chico}>
                    Contenido = campaña + título de la pieza. Solo piezas activas hoy ({repetidosPD.vigentes} contenidos vigentes). Los días se cuentan desde el
                    primer inicio registrado de ese contenido: una renovación con fechas nuevas no reinicia el conteo. Del más antiguo al más nuevo.
                  </div>
                  <ul style={lista}>
                    {repetidosPD.antiguos.map((c) => (
                      <li key={c.clave}>
                        <strong style={{ color: c.dias >= 90 ? 'var(--cov-baja)' : 'var(--text-primary)' }}>{c.dias} días</strong>
                        <span style={{ color: 'var(--text-tertiary)' }}> (desde el {diaMes(c.inicio)})</span> · <LinkCampana nombre={c.campana}>{c.titulo}</LinkCampana>
                        <span style={{ color: 'var(--text-secondary)' }}> · {c.campana}</span> · {c.localidades} localidad{c.localidades === 1 ? '' : 'es'}
                        <span style={{ color: 'var(--text-tertiary)' }}>
                          {' '}
                          ({c.provincial ? 'provincial' : 'dirigido'}
                          {c.provincial && c.dirigidas > 0 ? ` y dirigido a ${c.dirigidas}` : ''} · {c.piezas} pieza{c.piezas === 1 ? '' : 's'} activa{c.piezas === 1 ? '' : 's'})
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <details className="desplegable desplegable-destacado tono-celeste" ref={refListaPD} style={{ marginTop: 6 }}>
                <summary>
                  <span style={{ fontSize: 14 }}>Ver las {r.pd.campanas.length} campañas con piezas activas</span>
                </summary>
                <ul style={lista}>
                  {r.pd.campanas.map((c) => (
                    <li key={c.campana}>
                      <LinkCampana nombre={c.campana} /> · {c.piezas} pieza{c.piezas === 1 ? '' : 's'} · {c.localidades} localidad
                      {c.localidades === 1 ? '' : 'es'}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
          {propuesta && filas && (
            <>
              {/* B2 y A2: qué se comunica y pauta dirigida por localidad. El cruce
                  MT × PD va arriba de la grilla; Movimientos, en los indicadores
                  (19/11/2026). */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
                <GraficoAreas
                  areas={propuesta.areas}
                  activo={filtroGrafico && filtroGrafico.tipo === 'area' ? filtroGrafico.clave : null}
                  onFiltrar={onFiltrarGrafico ? (area) => onFiltrarGrafico('area', area, `alguna pieza activa de ${area}`) : null}
                />
                <TarjetaDirigidas filas={filas} />
              </div>
              {/* C5 */}
              <ComoLeer cortes={propuesta.cortes} umbrales={propuesta.umbralesMT} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Al entrar a una localidad: mismas cards, su escala. `r` = resumenLocalidad().
 * `onFiltrarTemas({tipo})` filtra la tabla de MT de abajo (solo temas activos) y
 * baja hasta ella; `tipo` null = todos los tipos. */
export function ResumenLocalidad({ r, recientePorTipo = {}, onFiltrarTemas }) {
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
                style={{ ...enlace, fontSize: 18, fontWeight: 600, textDecoration: 'none' }}
              >
                {mt.temasActivos} tema{mt.temasActivos === 1 ? '' : 's'} activo{mt.temasActivos === 1 ? '' : 's'}
              </button>{' '}
              · {mt.tipos} de {mt.total} tipos ·{' '}
              {BANDA_COBERTURA[mt.banda].label.replace('Cobertura ', '').replace('Sin cobertura', 'Sin').toLowerCase()}
            </div>
            {/* 2.2: tarjeta por tipo de medio: conteo de temas activos y la
                fecha de inicio del tema activo más reciente de ese tipo, con
                la alerta de antigüedad que esa fila ya trae de la planilla
                (`recientePorTipo`, armado en la ficha). */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginTop: 10 }}>
              {mt.chips.map((c) => {
                const rec = recientePorTipo[c.key];
                const color = rec ? colorDeAlerta(rec.alerta) : null;
                const colorFecha = color ? COLOR[color].fg : 'var(--text-tertiary)';
                return c.presente ? (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => onFiltrarTemas({ tipo: c.key })}
                    title={`Ver los ${c.temas} temas activos de ${c.label} en la tabla`}
                    style={{ ...tipoMedioEstilo, background: 'var(--cov-alta-bg)', borderColor: 'transparent', cursor: 'pointer' }}
                  >
                    <span style={{ color: 'var(--cov-alta)', fontWeight: 600 }}>✓ {c.label}</span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {c.temas} tema{c.temas === 1 ? '' : 's'}
                    </span>
                    <span style={{ color: colorFecha, fontWeight: 600 }} title={rec ? `El tema activo más nuevo de ${c.label} empezó el ${formatearFechaDiaMes(rec.fecha_desde)}${typeof rec.antiguedad_dias === 'number' ? `, hace ${rec.antiguedad_dias} días` : ''}` : 'Ningún tema activo con fecha de inicio cargada'}>
                      {rec ? `${color || ''} último inicio ${formatearFechaDiaMes(rec.fecha_desde)}`.trim() : 'sin fecha de inicio'}
                    </span>
                  </button>
                ) : (
                  <span key={c.key} style={{ ...tipoMedioEstilo, background: 'var(--bg-secondary)', borderColor: 'transparent', color: 'var(--text-tertiary)' }}>
                    <span style={{ fontWeight: 600 }}>— {c.label}</span>
                    <span>sin tema activo</span>
                  </span>
                );
              })}
            </div>
            <div style={chico}>
              "Último inicio": fecha en que empezó el tema activo más nuevo de ese tipo; el color es su antigüedad (🟢 menos de 30 días · 🟡 30 a 49 · 🔴 50 o más).
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
        {pd.semaforo.activas > 0 ? (
          <>
            <div style={titular}>
              <button
                type="button"
                onClick={() => {
                  setListaPD((v) => !v);
                  setPlataforma(null);
                }}
                aria-expanded={listaPD}
                style={{ ...enlace, fontSize: 18, fontWeight: 600, textDecoration: 'none' }}
              >
                {textoActivasPD(pd.semaforo)}
              </button>{' '}
              <Chip color={pd.semaforo.color}>{pd.semaforo.color}</Chip>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {' · '}
                {pd.campanasActivas} campaña{pd.campanasActivas === 1 ? '' : 's'} · próxima {textoVencimiento(pd.semaforo.diasProximoVencimiento)}
                {/* 2.3: piezas activas que vencen dentro de la ventana de 7
                    días, mismo dato que usa el bloque Atención y el mail de
                    PD (calcularSemaforoPD -> vencenEnVentana). */}
                {' · '}
                {pd.semaforo.vencenEnVentana.length > 0
                  ? `${pd.semaforo.vencenEnVentana.length} vence${pd.semaforo.vencenEnVentana.length === 1 ? '' : 'n'} en los próximos ${PD_DIAS_VENTANA} días`
                  : `ninguna vence en los próximos ${PD_DIAS_VENTANA} días`}
              </span>
            </div>
            {pd.plataformas.length > 0 && (
              <>
                {/* Plataformas como tarjetas con el número grande (pedido del
                    6/11/2026): mismos valores que antes, clic = lista filtrada. */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 6, marginTop: 12 }}>
                  {pd.plataformas.map((x) => {
                    const activa = listaPD && plataforma === x.plataforma;
                    return (
                      <button
                        key={x.plataforma}
                        type="button"
                        aria-pressed={activa}
                        title={`Ver las ${x.campanas} campañas de ${x.plataforma}`}
                        onClick={() => {
                          setListaPD(true);
                          setPlataforma((p) => (p === x.plataforma ? null : x.plataforma));
                        }}
                        style={{
                          ...tipoMedioEstilo,
                          cursor: 'pointer',
                          background: activa ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                          borderColor: activa ? 'var(--accent)' : 'transparent',
                        }}
                      >
                        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{x.campanas}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{x.plataforma}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 11.5 }}>campaña{x.campanas === 1 ? '' : 's'}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={chico}>Campañas por plataforma; una campaña puede estar en varias. Tocá una para ver sus campañas.</div>
              </>
            )}
            {listaPD && (
              <>
                <div style={chico}>
                  {campanas.length} de {pd.campanasActivas} campañas{plataforma ? ` en ${plataforma}` : ''}, por vencimiento más próximo.
                </div>
                <ul style={lista}>
                  {campanas.map((c) => (
                    <li key={c.campana}>
                      <LinkCampana nombre={c.campana} /> · {c.piezas} pieza{c.piezas === 1 ? '' : 's'} · {textoVencimiento(c.dias)}
                      <span style={{ color: 'var(--text-tertiary)' }}> · {c.plataformas.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <div style={titular}>
            0 activas <Chip color={pd.semaforo.color}>{pd.semaforo.color}</Chip>
          </div>
        )}
      </div>
    </div>
  );
}
