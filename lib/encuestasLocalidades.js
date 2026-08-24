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

const MAPA_CATEGORIA_A_GRUPO_GESTION = {
  'Muy buena': 'Positiva',
  Buena: 'Positiva',
  Regular: 'Regular',
  Mala: 'Negativa',
  'No se': 'Ns-Nc',
};

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
    const grupo = MAPA_CATEGORIA_A_GRUPO_GESTION[categoria];
    if (grupo) totales[grupo] += pct;
  }
  return ORDEN_GRUPOS_GESTION.map((grupo) => ({ grupo, pct: Math.round(totales[grupo] * 10) / 10 }));
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
