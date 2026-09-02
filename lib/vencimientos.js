// Reporte semanal de vencimientos (spec Alertas de vencimiento + Semáforo,
// sección 1). Medios Tradicionales + Pauta Digital únicamente -- SMS y
// Contenido Orgánico quedan afuera (no tienen concepto de vencimiento en el
// dato crudo, ver sección 1 de la spec).

/** "YYYY-MM-DD" de una fecha local (no UTC), mismo patrón que lib/fechas.js. */
function pad2(n) {
  return String(n).padStart(2, '0');
}

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
 * Vencimientos de Medios Tradicionales + Pauta Digital dentro de [hoyIso,
 * hoyIso+7] (inclusive), agrupados por zona (localidad puntual, o
 * departamento cuando la pieza de Pauta Digital es de ese alcance -- no se
 * fuerza a ninguna localidad que el dato no tiene). Cada grupo ordenado por
 * fecha de vencimiento ascendente. `hoyIso` es inyectable para tests.
 */
export function calcularVencimientos(mediosTradicionalesData, pautaDigitalData, hoyIso) {
  const ventanaHasta = sumarDias(hoyIso, 7);
  const dentroDeVentana = (iso) => !!iso && iso >= hoyIso && iso <= ventanaHasta;

  const porZona = new Map();
  function agregar(zona, item) {
    if (!porZona.has(zona)) porZona.set(zona, []);
    porZona.get(zona).push(item);
  }

  for (const loc of mediosTradicionalesData.localidades) {
    for (const v of loc.vigentes) {
      if (v.estado !== 'Activo') continue;
      if (!dentroDeVentana(v.fecha_hasta)) continue;
      agregar(loc.localidad, {
        area: 'Medios Tradicionales',
        tipo: v.tipo_medio,
        titulo: v.tema,
        fecha_vencimiento: v.fecha_hasta,
      });
    }
  }

  for (const p of pautaDigitalData.piezas) {
    if (p.estado !== 'Vigente') continue;
    if (!dentroDeVentana(p.finalizacion)) continue;
    // Nota sección 1.3: si la pieza es a nivel Departamento (excepción ya
    // documentada del negocio), se agrupa bajo el Departamento, no se fuerza
    // a una localidad que el dato no tiene. alcance_tipo=provincia no aporta
    // ninguna zona puntual -- se descarta del reporte por localidad/depto
    // (no hay "provincia entera" como fila de agrupación en este reporte).
    let zona = null;
    if (p.alcance_tipo === 'localidad' && p.localidad) zona = p.localidad;
    else if (p.alcance_tipo === 'departamento' && p.departamento) zona = p.departamento;
    if (!zona) continue;
    agregar(zona, {
      area: 'Pauta Digital',
      tipo: p.plataforma,
      titulo: p.titulo_pieza || p.campana,
      fecha_vencimiento: p.finalizacion,
    });
  }

  const zonas = Array.from(porZona.entries())
    .map(([zona, items]) => ({
      zona,
      items: items.sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento)),
    }))
    .sort((a, b) => a.zona.localeCompare(b.zona, 'es'));

  const total = zonas.reduce((acc, z) => acc + z.items.length, 0);
  return { hoyIso, ventanaHasta, total, zonas };
}

export const AREA_MEDIOS_TRADICIONALES = 'Medios Tradicionales';
export const AREA_PAUTA_DIGITAL = 'Pauta Digital';

/**
 * Subconjunto de un resultado ya calculado por calcularVencimientos(),
 * restringido a un área (AREA_MEDIOS_TRADICIONALES / AREA_PAUTA_DIGITAL) --
 * para los mails separados por área. Recalcula `total` y descarta zonas que
 * queden sin ítems tras el filtro; mantiene el mismo orden que el original.
 */
export function filtrarVencimientosPorArea(vencimientos, area) {
  const zonas = vencimientos.zonas
    .map((z) => ({ zona: z.zona, items: z.items.filter((it) => it.area === area) }))
    .filter((z) => z.items.length > 0);
  const total = zonas.reduce((acc, z) => acc + z.items.length, 0);
  return { hoyIso: vencimientos.hoyIso, ventanaHasta: vencimientos.ventanaHasta, total, zonas };
}
