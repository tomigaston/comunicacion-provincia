// Reporte semanal de vencimientos (spec Alertas de vencimiento + Semáforo,
// sección 1 -- corregida 13/09: los dos bloques usan criterios distintos, ver
// abajo). Medios Tradicionales + Pauta Digital únicamente -- SMS y Contenido
// Orgánico quedan afuera (no tienen concepto de vencimiento en el dato
// crudo).
//
// Los dos bloques agrupan por campaña (una campaña que afecta a muchas
// localidades es UNA línea, no una por localidad) pero con criterios de
// disparo DISTINTOS -- no se mezclan:
//  - Medios Tradicionales: antigüedad de actualización (semáforo 🟡/🔴, mismo
//    campo `alerta`/`antiguedad_dias` que ya calcula scripts/generar_datos.py
//    contra los umbrales de Parametros y que usa lib/semaforo.js para los
//    badges de UI -- acá no se recalculan umbrales, solo se filtra por el
//    color ya resuelto). Se agrupa por `Tema` porque el área no tiene columna
//    de Campaña propia (mismo criterio que otras partes del pipeline).
//  - Pauta Digital: vencimiento real (`finalizacion` = columna FIN, sin
//    fallback a FIN INFORMADO) dentro de la ventana [hoy, hoy+7]. Solo piezas
//    "vivas" (esPiezaPDViva: Estado=Vigente + INICIO<=hoy<=FIN), el mismo
//    predicado que usa el semáforo -- 🔴+🟡 del semáforo == esta lista. Se
//    agrupa por el campo `Campaña` propio del área.

import { colorDeAlerta, esPiezaPDViva, colorVencimientoPD, nombreCampana } from './semaforo';
import { calcularEjePDPorLocalidad } from './coverage';
import { TIPOS_MEDIO } from './tiposMedio';
import { normalizarTexto } from './texto';

/** "YYYY-MM-DD" de una fecha local (no UTC), mismo patrón que lib/fechas.js. */
function pad2(n) {
  return String(n).padStart(2, '0');
}

// OJO: usa la hora LOCAL del entorno. isoDe(new Date()) en el servidor (cron)
// es UTC; en el navegador, la del usuario. El cron de vercel.json corre
// 10:00 UTC = 07:00 ART, el mismo día en ambos.
export function isoDe(fecha) {
  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}-${pad2(fecha.getDate())}`;
}

/** iso + `dias` días, fecha LOCAL (mismo criterio que restarDias de lib/fechas.js). */
export function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  fecha.setDate(fecha.getDate() + dias);
  return isoDe(fecha);
}

/**
 * Medios Tradicionales sin actualización reciente: piezas Activas con alerta
 * 🟡 o 🔴 (antigüedad contra los umbrales de Parametros, ya resuelta en el
 * dato -- ver colorDeAlerta()/lib/semaforo.js), agrupadas por `Tema`. Por
 * grupo se muestra el peor caso entre las localidades agrupadas (la
 * antigüedad más alta, no un promedio), la lista de localidades afectadas, y
 * el Tipo_Medio -- si varía dentro del mismo Tema se marca "Varios"
 * (tipoVarios: true) en vez de resolverlo en silencio. Ordenado por
 * antigüedad descendente (lo más viejo arriba).
 */
export function calcularVencimientosMediosTradicionales(mediosTradicionalesData) {
  const porTema = new Map();
  for (const loc of mediosTradicionalesData.localidades) {
    for (const v of loc.vigentes) {
      if (v.estado !== 'Activo') continue;
      const color = colorDeAlerta(v.alerta);
      if (color !== '🟡' && color !== '🔴') continue;
      if (!porTema.has(v.tema)) porTema.set(v.tema, []);
      porTema.get(v.tema).push({
        localidad: loc.localidad,
        tipo_medio: v.tipo_medio,
        color,
        antiguedad_dias: v.antiguedad_dias ?? 0,
      });
    }
  }

  const grupos = Array.from(porTema.entries()).map(([tema, items]) => {
    const localidades = Array.from(new Set(items.map((it) => it.localidad))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
    const tiposUnicos = Array.from(new Set(items.map((it) => it.tipo_medio)));
    const peorItem = items.reduce((peor, it) => (it.antiguedad_dias > peor.antiguedad_dias ? it : peor));
    return {
      tema,
      color: items.some((it) => it.color === '🔴') ? '🔴' : '🟡',
      antiguedad_dias: peorItem.antiguedad_dias,
      localidades,
      tipo_medio: tiposUnicos.length === 1 ? tiposUnicos[0] : 'Varios',
      tipoVarios: tiposUnicos.length > 1,
    };
  });

  grupos.sort((a, b) => b.antiguedad_dias - a.antiguedad_dias);

  const localidadesAfectadas = new Set();
  let rojas = 0;
  let amarillas = 0;
  for (const g of grupos) {
    if (g.color === '🔴') rojas += 1;
    else amarillas += 1;
    for (const loc of g.localidades) localidadesAfectadas.add(loc);
  }

  return {
    grupos,
    resumen: { rojas, amarillas, localidadesAfectadas: localidadesAfectadas.size },
  };
}

export { nombreCampana };

/**
 * Pauta Digital dentro de la ventana de vencimiento [hoyIso, hoyIso+7]
 * (inclusive), solo piezas vivas (esPiezaPDViva, el mismo predicado que usa el
 * semáforo de PD). Sección aparte de la antigüedad de Medios Tradicionales.
 * El agrupamiento es por (Campaña,
 * fecha de finalización): una campaña que vence en varias localidades EN LA
 * MISMA fecha es una sola línea, pero si vence en fechas distintas dentro de
 * la ventana genera un bloque por cada fecha real -- nunca se mezclan bajo
 * un encabezado único con Math.min(). `hoyIso` es inyectable para tests.
 */
export function calcularVencimientosPautaDigital(pautaDigitalData, hoyIso) {
  const ventanaHasta = sumarDias(hoyIso, 7);
  const dentroDeVentana = (iso) => !!iso && iso >= hoyIso && iso <= ventanaHasta;

  const porCampanaFecha = new Map();
  for (const p of pautaDigitalData.piezas) {
    // Predicado único con el semáforo de PD (lib/semaforo.js): Estado=Vigente
    // e INICIO<=hoy<=FIN evaluado contra hoyIso (spec 11/10/2026).
    if (!esPiezaPDViva(p, hoyIso)) continue;
    if (!dentroDeVentana(p.finalizacion)) continue;
    // Ámbito Departamento (p.localidad === null, p.alcance_tipo ===
    // 'departamento'): Pauta Digital es la única área con vista a nivel
    // Departamento y ese ámbito nunca se atribuye a una localidad puntual
    // (ver CONTEXTO_PROYECTO_TABLERO_COMUNICACION.md). Se registra aparte y
    // NO entra al conteo/listado de zonas. alcance_tipo=provincia no aporta
    // ninguna zona puntual ni departamento. OJO: eso vale para el histórico
    // (alcance_tipo=provincia sin sub_ambito); el global provincial viaja como
    // alcance_tipo='localidad' (multiple_provincia) y SÍ entra al mail.
    let zona = null;
    let departamentoSinLocalidad = null;
    if (p.alcance_tipo === 'localidad' && p.localidad) zona = p.localidad;
    else if (p.alcance_tipo === 'departamento' && p.departamento) departamentoSinLocalidad = p.departamento;
    if (!zona && !departamentoSinLocalidad) continue;
    const campana = nombreCampana(p);
    const clave = JSON.stringify([campana, p.finalizacion]);
    if (!porCampanaFecha.has(clave)) {
      // color: mismo semáforo por vencimiento que ve el resto del tablero (una
      // fecha de FIN => un solo color por grupo).
      porCampanaFecha.set(clave, {
        campana,
        fecha_vencimiento: p.finalizacion,
        color: colorVencimientoPD(p, hoyIso),
        items: [],
      });
    }
    porCampanaFecha.get(clave).items.push({
      zona,
      departamentoSinLocalidad,
      plataforma: p.plataforma,
    });
  }

  const grupos = Array.from(porCampanaFecha.values()).map(({ campana, fecha_vencimiento, color, items }) => {
    const zonas = Array.from(new Set(items.map((it) => it.zona).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
    const departamentosSinLocalidad = Array.from(
      new Set(items.map((it) => it.departamentoSinLocalidad).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'es'));
    const plataformasUnicas = Array.from(new Set(items.map((it) => it.plataforma)));
    return {
      campana,
      fecha_vencimiento,
      color,
      zonas,
      departamentosSinLocalidad,
      plataforma: plataformasUnicas.length === 1 ? plataformasUnicas[0] : 'Varios',
      plataformaVarios: plataformasUnicas.length > 1,
    };
  });

  grupos.sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento) || a.campana.localeCompare(b.campana, 'es'));

  const zonasAfectadas = new Set();
  for (const g of grupos) for (const z of g.zonas) zonasAfectadas.add(z);

  return {
    hoyIso,
    ventanaHasta,
    grupos,
    resumen: { totalCampanas: grupos.length, zonasAfectadas: zonasAfectadas.size },
  };
}

// --- Cobertura por área en el mail (spec 11/10/2026, D5) ---------------------
// Dos niveles, a destinatarios distintos:
//  - Operativo, a cada equipo: MT recibe las localidades a las que les faltan
//    tipos de medio (desglosado por tipo); PD recibe las localidades sin pauta
//    viva dirigida.
//  - Global (caso severo), al reporte general: localidades sin cobertura = cero
//    MT activo Y cero PD que cuenta (AND). Debería ser raro.
// Todo sale de las mismas definiciones que la grilla y el semáforo
// (banda_cobertura del JSON; calcularEjePDPorLocalidad), no se recalcula.

const ORDEN_BANDAS_FALTANTES = ['Sin', 'Baja', 'Media'];

// Un tipo de medio SIN ningún tema activo en toda la provincia (hoy: Pantalla
// LED) va en una nota provincial arriba del mail y se saca del desglose por
// localidad: sería el mismo faltante repetido en las 37. Los tipos presentes en
// alguna localidad (aunque sean pocas, ej. Gráfica) se desglosan: son accionables.
/**
 * MT: qué tipos de medio le faltan a cada localidad, en dos listas:
 *  - `principales`: banda Sin + Baja (lo accionable, va primero).
 *  - `paraCompletar`: banda Media (bloque secundario, debajo).
 * El desglose por localidad cubre solo los tipos que VARÍAN entre localidades;
 * los ausentes en toda la provincia (0 localidades con tema activo) salen en
 * `notaProvincial` ([{label, localidades}]), calculados con los datos reales.
 * Las localidades en banda Alta no se listan.
 */
export function calcularCoberturaFaltanteMT(mediosTradicionalesData) {
  const todas = mediosTradicionalesData.localidades;
  const notaProvincial = TIPOS_MEDIO.map((t) => ({
    key: t.key,
    label: t.label,
    localidades: todas.filter((loc) => loc.cobertura[t.key]).length,
  })).filter((t) => t.localidades === 0);
  const clavesNota = new Set(notaProvincial.map((t) => t.key));

  const armar = (loc) => ({
    localidad: loc.localidad,
    departamento: loc.departamento,
    banda: loc.banda_cobertura,
    tipos: loc.total_tipos,
    faltantes: TIPOS_MEDIO.filter((t) => !loc.cobertura[t.key] && !clavesNota.has(t.key)).map((t) => t.label),
  });
  const ordenar = (a, b) =>
    ORDEN_BANDAS_FALTANTES.indexOf(a.banda) - ORDEN_BANDAS_FALTANTES.indexOf(b.banda) ||
    a.localidad.localeCompare(b.localidad, 'es');

  const principales = todas.filter((l) => l.banda_cobertura === 'Sin' || l.banda_cobertura === 'Baja').map(armar).sort(ordenar);
  const paraCompletar = todas.filter((l) => l.banda_cobertura === 'Media').map(armar).sort(ordenar);
  return {
    notaProvincial: notaProvincial.map(({ label, localidades }) => ({ label, localidades })),
    principales,
    paraCompletar,
    resumen: {
      total: todas.length,
      sinCobertura: principales.filter((l) => l.banda === 'Sin').length,
      baja: principales.filter((l) => l.banda === 'Baja').length,
      media: paraCompletar.length,
    },
  };
}

/** PD: localidades de las 60 sin pauta viva DIRIGIDA a la zona (eje B ausente). */
export function calcularLocalidadesSinPautaViva(mediosTradicionalesData, pautaDigitalData, hoyIso) {
  const eje = calcularEjePDPorLocalidad(pautaDigitalData.piezas, hoyIso);
  const sinPauta = mediosTradicionalesData.localidades
    .filter((loc) => !eje.get(normalizarTexto(loc.localidad)))
    .map((loc) => ({ localidad: loc.localidad, departamento: loc.departamento }))
    .sort((a, b) => a.localidad.localeCompare(b.localidad, 'es'));
  return { localidades: sinPauta, total: mediosTradicionalesData.localidades.length };
}

/** Global: cero MT activo (banda Sin) Y cero PD que cuenta. */
export function calcularLocalidadesSinCobertura(mediosTradicionalesData, pautaDigitalData, hoyIso) {
  const eje = calcularEjePDPorLocalidad(pautaDigitalData.piezas, hoyIso);
  const localidades = mediosTradicionalesData.localidades
    .filter((loc) => loc.banda_cobertura === 'Sin' && !eje.get(normalizarTexto(loc.localidad)))
    .map((loc) => ({ localidad: loc.localidad, departamento: loc.departamento }))
    .sort((a, b) => a.localidad.localeCompare(b.localidad, 'es'));
  return { localidades, total: mediosTradicionalesData.localidades.length };
}
