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
 * segmentos en el mismo orden, sea cual sea el orden de llegada del dato). */
export function agruparGestion(categorias) {
  const totales = { Positiva: 0, Regular: 0, Negativa: 0, 'Ns-Nc': 0 };
  for (const [categoria, pct] of Object.entries(categorias || {})) {
    const grupo = MAPA_CATEGORIA_A_GRUPO_GESTION[categoria];
    if (grupo) totales[grupo] += pct;
  }
  return ORDEN_GRUPOS_GESTION.map((grupo) => ({ grupo, pct: totales[grupo] }));
}

// --- Aprobación de gestión (gauge semáforo, sobre "Apruebo") ---------------

const UMBRAL_APROBACION_ALTA = 40;
const UMBRAL_APROBACION_MEDIA = 25;

export function colorAprobacion(pctApruebo) {
  if (pctApruebo >= UMBRAL_APROBACION_ALTA) return '#0DCE1D';
  if (pctApruebo >= UMBRAL_APROBACION_MEDIA) return '#D9B300';
  return '#D64550';
}
