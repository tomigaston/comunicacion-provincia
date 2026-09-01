// Helpers de dominio para la sección "Encuestas de Localidades".
//
// El JSON (data/encuestas_localidades.json, ver
// scripts/generar_encuestas_localidades.py) NO trae Categoria_Agrupada
// resuelta: cada ronda.preguntas[clave] es un dict plano
// {Categoria_Respuesta: Porcentaje} (ej. {"Muy buena": 7.8, "Buena": 14.3,
// "Regular": 39.0, "Mala": 35.1, "No se": 3.9}). El pipeline usa
// Categoria_Agrupada / Orden_Agrupada solo para ORDENAR las categorías al
// armar ese dict, pero no la expone como campo aparte. Por eso el mapeo
// Muy buena/Buena -> Positiva, Regular -> Regular, Mala -> Negativa,
// No se -> Ns-Nc para "Calificación de gestión" vive ACÁ (frontend), no en
// el JSON ni en el script Python.
import { normalizarTexto } from './texto';

/**
 * Clasifica las claves de ronda.preguntas en las 4 secciones del Resumen.
 * Una clave que no matchea ninguno de los 4 prefijos/contenido esperado
 * (no debería pasar contra la fuente real, los 4 Tipo_Pregunta que
 * alimentan "preguntas" son justamente estos) queda afuera silenciosamente
 * -> no se inventa una 5ta sección para algo no previsto en esta entrega.
 */
export function clasificarPreguntas(preguntas) {
  const problemas = [];
  const gestion = [];
  const aprobacion = [];
  const reeleccion = [];

  for (const [clave, categorias] of Object.entries(preguntas || {})) {
    if (clave.includes('Problemas')) problemas.push({ clave, categorias });
    else if (clave.startsWith('Gestión')) gestion.push({ clave, categorias });
    else if (clave.startsWith('Aprobación')) aprobacion.push({ clave, categorias });
    else if (clave.startsWith('Reelección')) reeleccion.push({ clave, categorias });
  }

  return { problemas, gestion, aprobacion, reeleccion };
}

// --- Calificación de gestión (barra apilada, 4 categorías) -----------------
//
// OJO (advertencia explícita del usuario, ya pasó en el proyecto hermano
// tablero-electoral): "Calificación de gestión" (esto: Muy buena/Buena/
// Regular/Mala/No se, viene de Tipo_Pregunta=Imagen_Funcionario, clave
// "Gestión del X") NO es lo mismo que "Aprobación de gestión" (Apruebo/
// Desapruebo, Tipo_Pregunta=Aprobacion, clave "Aprobación X") — son
// preguntas distintas de la encuesta, no se deben mezclar.

export const ORDEN_GRUPOS_GESTION = ['Positiva', 'Regular', 'Negativa', 'Ns-Nc'];

export const COLOR_GRUPO_GESTION = {
  Positiva: '#22C55E',
  Regular: '#FBBF24',
  Negativa: '#EF4444',
  'Ns-Nc': '#CBD5E1',
};

// Positiva/Regular/Negativa: matching exacto, sin normalizar. No hay
// variantes conocidas de "Muy buena"/"Buena"/"Regular"/"Mala" en la fuente
// real (a diferencia de "No se", ver abajo) -> no vale la pena pagar el
// costo de normalizar estas 4 también mientras no aparezca evidencia real de
// que hace falta.
const MAPA_CATEGORIA_A_GRUPO_GESTION = {
  'Muy buena': 'Positiva',
  Buena: 'Positiva',
  Regular: 'Regular',
  Mala: 'Negativa',
};

// Bug confirmado el 26/08/2026: la fuente real (BASE_MAESTRA_FINAL.xlsx) ya
// trae 2 grafías más para el mismo concepto de "no sabe/no contesta" además
// de "No se" -> "No lo se" (171 filas, 121+ dirigentes, 15 localidades) y
// "No lo sé" (11 filas, SAN FRANCISCO). Antes, como MAPA_CATEGORIA_A_GRUPO_GESTION
// solo reconocía "No se" exacto, esas filas se descartaban en silencio y la
// barra de Gestión no llegaba a 100% (caso real: "Carlos Segura", CRUZ DEL
// EJE, ronda 2026-08-03, perdía 22.3 p.p. de "No lo se").
//
// En vez de agregar las 2 grafías conocidas tal cual (mismo problema se
// repetiría con una 3ra variante de una fuente futura), se normaliza el
// texto (sin tildes, minúscula, espacios colapsados — mismo criterio que
// normalizar() en scripts/generar_datos.py, pero en JS vía normalizarTexto()
// + colapso de espacios acá) y se compara contra un set de alias razonables
// de "no sabe/no contesta". Cubre de más a propósito: mejor una variante que
// nunca aparezca en el set que una que sí aparezca y siga sin reconocerse.
const ALIAS_NS_NC_GESTION = new Set(
  [
    'No se', 'No lo se', 'No lo sabe', 'No sabe',
    'Ns/Nc', 'Ns / Nc', 'Ns-Nc', 'Ns Nc',
    'No contesta', 'No sabe no contesta', 'No sabe / no contesta', 'No sabe/no contesta',
  ].map(_normalizarClaveGestion)
);

/** normalizarTexto() (lib/texto.js) ya saca tildes/mayúsculas y hace trim de
 * puntas; acá se le suma colapsar espacios internos de más (ej. "No  se")
 * -> mismo criterio combinado que normalizar() en el pipeline Python. */
function _normalizarClaveGestion(s) {
  return normalizarTexto(s).replace(/\s+/g, ' ');
}

/** {Categoria_Respuesta: pct} -> [{grupo, pct}] en el orden fijo de
 * ORDEN_GRUPOS_GESTION (para que la barra apilada siempre pinte los
 * segmentos en el mismo orden, sea cual sea el orden de llegada del dato).
 * "Positiva" suma Muy buena + Buena -> redondeado a 1 decimal acá mismo
 * (no en cada consumidor): sumar floats en JS puede arrastrar errores de
 * punto flotante (ej. 31.700000000000003 en vez de 31.7) que en 3a no se
 * notaban porque EncuestaGestionBarra ya aplicaba .toFixed(1) en la
 * leyenda, pero el Comparativo (3b) muestra el número crudo. */
export function agruparGestion(categorias) {
  const totales = { Positiva: 0, Regular: 0, Negativa: 0, 'Ns-Nc': 0 };
  for (const [categoria, pct] of Object.entries(categorias || {})) {
    const grupo = MAPA_CATEGORIA_A_GRUPO_GESTION[categoria]
      || (ALIAS_NS_NC_GESTION.has(_normalizarClaveGestion(categoria)) ? 'Ns-Nc' : undefined);
    if (grupo) totales[grupo] += pct;
  }
  return ORDEN_GRUPOS_GESTION.map((grupo) => ({ grupo, pct: Math.round(totales[grupo] * 10) / 10 }));
}

// --- Medición de texto en Canvas (texto dentro/fuera de una barra) ---------
//
// Compartido por EncuestaBarraHorizontal, EncuestaComparativo
// (FilaBarraGestion) y EncuestaBarraApilada (usado por EncuestaGestionBarra
// y EncuestaDirigentes): todos dibujan barras/segmentos SVG y necesitan
// decidir si un texto entra adentro del relleno o hay que sacarlo afuera. Se
// extrae acá SOLO la medición (measureText vía Canvas) — era la 3ra vez que
// se duplicaba textual. La decisión de layout en sí (dónde va el texto si
// no entra: a la derecha del relleno, arriba con leader line, u omitido)
// queda en cada caller porque el tratamiento visual difiere entre los 3
// casos y no vale la pena forzar una abstracción única para eso — la
// excepción es EncuestaGestionBarra/EncuestaDirigentes, que sí comparten
// EncuestaBarraApilada porque su layout (segmentos + número adentro/afuera
// con leader line) es idéntico, y así el fix de colisión de etiquetas
// (calcularFilasEtiquetasAfuera, debajo) vive en un solo lugar.
//
// Estos componentes solo se montan después de que useApiData resuelve el
// fetch client-side (nunca en SSR), así que usar `document`/Canvas acá es
// seguro. El guard de `typeof document` es un fallback defensivo, no se
// espera que se use.
const FONT_FAMILY_DEFAULT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
let ctxMedicionTexto = null;
export function medirAnchoTexto(texto, { fontSize = 12.5, fontWeight = 600, fontFamily = FONT_FAMILY_DEFAULT } = {}) {
  if (typeof document === 'undefined') return texto.length * fontSize * 0.55;
  if (!ctxMedicionTexto) ctxMedicionTexto = document.createElement('canvas').getContext('2d');
  ctxMedicionTexto.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return ctxMedicionTexto.measureText(texto).width;
}

/**
 * Asigna una fila (0 o 1) a cada etiqueta "afuera" de una barra apilada,
 * para evitar que las de segmentos angostos consecutivos queden pegadas /
 * ilegibles (bug real reportado: "5%5%13.9%" en Dirigentes locales — Ariel
 * Alexandrof; "12.1%2.4%" en Calificación de gestión — Gestión del
 * Vicegobernador). Usado por EncuestaBarraApilada (compartido por
 * EncuestaGestionBarra y EncuestaDirigentes).
 *
 * Recorre las etiquetas en orden (izquierda a derecha, mismo orden que los
 * segmentos) y compara el ancho estimado de cada una (medido con
 * medirAnchoTexto, mismo criterio que adentro/afuera) contra el borde
 * derecho de la etiqueta anterior: si colisionarían puestas a la misma
 * altura, esta pasa a la fila contraria a la anterior (zigzag). En cuanto
 * una etiqueta ya no colisiona con la previa, vuelve a la fila 0 — el
 * zigzag es local a cada racha de colisiones consecutivas, no global a toda
 * la barra.
 *
 * `segmentosAfuera` = segmentos ya filtrados a los que van afuera, en orden
 * de x, cada uno con {grupo, pct, x, ancho} (mismo shape que arma cada
 * caller). Devuelve Map grupo -> fila (0 | 1).
 */
export function calcularFilasEtiquetasAfuera(segmentosAfuera, { fontSize, gapMinimo = 4 } = {}) {
  const filas = new Map();
  let anterior = null; // { fin, fila } de la última etiqueta procesada
  for (const s of segmentosAfuera) {
    const anchoTexto = medirAnchoTexto(`${s.pct}%`, { fontSize });
    const cx = s.x + s.ancho / 2;
    const inicio = cx - anchoTexto / 2;
    const fin = cx + anchoTexto / 2;
    const colisiona = anterior !== null && inicio < anterior.fin + gapMinimo;
    const fila = colisiona ? (anterior.fila === 0 ? 1 : 0) : 0;
    filas.set(s.grupo, fila);
    anterior = { fin, fila };
  }
  return filas;
}

// --- Aprobación de gestión (gauge semáforo, sobre "Apruebo") ---------------

const UMBRAL_APROBACION_ALTA = 40;
const UMBRAL_APROBACION_MEDIA = 25;

export function colorAprobacion(pctApruebo) {
  if (pctApruebo >= UMBRAL_APROBACION_ALTA) return '#0DCE1D';
  if (pctApruebo >= UMBRAL_APROBACION_MEDIA) return '#D9B300';
  return '#D64550';
}

// --- Comparativo (entrega 3b) ----------------------------------------------
//
// Un único número por ronda para poder graficar una serie temporal, por
// tipo de pregunta:
//   - Problemas: cada CATEGORÍA (no la pregunta entera) es su propia serie,
//     con su % tal cual viene (ninguna transformación).
//   - Gestión: % de "Positiva" (agrupado, mismo criterio que agruparGestion).
//   - Aprobación: % de "Apruebo".
//   - Reelección: % de "Si".

/**
 * rondas: localidad.rondas completo (YA ordenado ascendente por fecha, tal
 * cual lo entrega el pipeline -> no se reordena acá).
 *
 * Devuelve:
 *   metricas: [{ clave, tipo: 'gestion'|'aprobacion'|'reeleccion', serie }]
 *   problemasCategorias: [{ categoria, serie }]
 * donde serie = [{ fecha, valor }], en el orden de aparición real de esa
 * pregunta/categoría a través de las rondas (no todas las rondas traen las
 * mismas preguntas -> el delta se calcula sobre estas apariciones reales,
 * nunca sobre el total de rondas de la localidad).
 *
 * Ya filtra afuera todo lo que aparece en una sola ronda (serie.length < 2):
 * no hay nada que comparar, esa tarjeta no debe entrar al grid de
 * Comparativo (pedido explícito del usuario).
 */
export function construirSeriesComparativo(rondas) {
  const porClaveMetrica = new Map();
  const porCategoriaProblema = new Map();

  function agregar(mapa, clave, tipo, fecha, valor) {
    if (!mapa.has(clave)) mapa.set(clave, { tipo, serie: [] });
    mapa.get(clave).serie.push({ fecha, valor });
  }

  for (const ronda of rondas || []) {
    const { problemas, gestion, aprobacion, reeleccion } = clasificarPreguntas(ronda.preguntas);

    for (const { categorias } of problemas) {
      for (const [categoria, pct] of Object.entries(categorias || {})) {
        if (!porCategoriaProblema.has(categoria)) porCategoriaProblema.set(categoria, []);
        porCategoriaProblema.get(categoria).push({ fecha: ronda.fecha, valor: pct });
      }
    }
    for (const { clave, categorias } of gestion) {
      const positiva = agruparGestion(categorias).find((g) => g.grupo === 'Positiva');
      agregar(porClaveMetrica, clave, 'gestion', ronda.fecha, positiva ? positiva.pct : 0);
    }
    for (const { clave, categorias } of aprobacion) {
      agregar(porClaveMetrica, clave, 'aprobacion', ronda.fecha, categorias?.Apruebo ?? 0);
    }
    for (const { clave, categorias } of reeleccion) {
      agregar(porClaveMetrica, clave, 'reeleccion', ronda.fecha, categorias?.Si ?? 0);
    }
  }

  const metricas = Array.from(porClaveMetrica.entries())
    .map(([clave, { tipo, serie }]) => ({ clave, tipo, serie }))
    .filter((m) => m.serie.length >= 2);

  const problemasCategorias = Array.from(porCategoriaProblema.entries())
    .map(([categoria, serie]) => ({ categoria, serie }))
    .filter((p) => p.serie.length >= 2);

  return { metricas, problemasCategorias };
}

/**
 * Evolución completa (no reducida a un solo % como en `metricas` de
 * construirSeriesComparativo) de cada "Gestión del X" a través de las
 * rondas -> para el Comparativo (3b rediseño), que necesita mostrar los 4
 * segmentos (Positiva/Regular/Negativa/Ns-Nc) de CADA ronda, no solo la
 * Positiva de la última. Reusa agruparGestion() (mismo cálculo que
 * EncuestaGestionBarra) -> nunca se reinventa acá.
 *
 * Devuelve solo claves con 2+ apariciones (nada que comparar con 1 sola,
 * mismo criterio que construirSeriesComparativo). `puntos` queda en el
 * mismo orden ascendente real de `rondas` (no se reordena).
 */
export function construirEvolucionGestion(rondas) {
  const porClave = new Map();

  for (const ronda of rondas || []) {
    const { gestion } = clasificarPreguntas(ronda.preguntas);
    for (const { clave, categorias } of gestion) {
      if (!porClave.has(clave)) porClave.set(clave, []);
      porClave.get(clave).push({
        fecha: ronda.fecha,
        casosTotales: ronda.casos_totales,
        grupos: agruparGestion(categorias),
      });
    }
  }

  return Array.from(porClave.entries())
    .map(([clave, puntos]) => ({ clave, puntos }))
    .filter((g) => g.puntos.length >= 2);
}

/**
 * serie: [{fecha, valor}] con >=2 apariciones, en orden ascendente real.
 * Última vs. anteúltima si hay 3+ apariciones; última vs. primera si hay
 * exactamente 2 (con 2 apariciones ambas reglas coinciden: la "anteúltima"
 * de una serie de 2 ES la primera).
 */
export function calcularDelta(serie) {
  const n = serie.length;
  if (n < 2) return null;
  const actual = serie[n - 1].valor;
  const anterior = serie[n - 2].valor;
  return actual - anterior;
}

/** 'aumento' | 'baja' | 'estable' según el umbral de significancia (pp) leído
 * de localidades_metadata.json — nunca hardcodeado. >= umbral cuenta como
 * significativo (no solo estrictamente mayor), en cualquier dirección. */
export function clasificarSignificancia(delta, umbralPp) {
  if (delta == null || Math.abs(delta) < umbralPp) return 'estable';
  return delta > 0 ? 'aumento' : 'baja';
}

// --- Candidatos (entrega 3c: sin equivalente en circuitos) -----------------

/** true si ronda.candidatos_gobernador o ronda.candidatos_intendente traen
 * al menos un escenario con candidatos -> single source of truth compartida
 * entre EncuestaResumenRonda (decide si arma la tarjeta) y EncuestaCandidatos
 * (decide qué sub-bloque, Gobernador y/o Intendente, mostrar). */
export function hayCandidatos(porEscenario) {
  return Object.values(porEscenario || {}).some((arr) => (arr || []).length > 0);
}
