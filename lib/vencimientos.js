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
//  - Pauta Digital: vencimiento real (`finalizacion`, que ya trae resuelto el
//    fallback FIN/FIN INFORMADO) dentro de la ventana [hoy, hoy+7] -- esta
//    ventana es la MISMA función que ya existía, no se toca. Se agrupa por el
//    campo `Campaña` propio del área.

import { colorDeAlerta } from './semaforo';

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

/**
 * Pauta Digital dentro de la ventana de vencimiento [hoyIso, hoyIso+7]
 * (inclusive) -- MISMO criterio que la v1, no se toca (sección aparte de la
 * antigüedad de Medios Tradicionales). Lo único que cambia acá es el
 * agrupamiento: por el campo `Campaña` propio del área, en vez de por
 * Localidad/Departamento -- una campaña que vence en varias localidades es
 * una sola línea. `hoyIso` es inyectable para tests.
 */
export function calcularVencimientosPautaDigital(pautaDigitalData, hoyIso) {
  const ventanaHasta = sumarDias(hoyIso, 7);
  const dentroDeVentana = (iso) => !!iso && iso >= hoyIso && iso <= ventanaHasta;

  const porCampana = new Map();
  for (const p of pautaDigitalData.piezas) {
    if (p.estado !== 'Vigente') continue;
    if (!dentroDeVentana(p.finalizacion)) continue;
    // Nota heredada de la v1: si la pieza es a nivel Departamento (excepción
    // ya documentada del negocio), se agrupa bajo el Departamento, no se
    // fuerza a una localidad que el dato no tiene. alcance_tipo=provincia no
    // aporta ninguna zona puntual -- se descarta del reporte.
    let zona = null;
    if (p.alcance_tipo === 'localidad' && p.localidad) zona = p.localidad;
    else if (p.alcance_tipo === 'departamento' && p.departamento) zona = p.departamento;
    if (!zona) continue;
    const campana = p.campana || p.titulo_pieza || 'Sin campaña';
    if (!porCampana.has(campana)) porCampana.set(campana, []);
    porCampana.get(campana).push({
      zona,
      plataforma: p.plataforma,
      fecha_vencimiento: p.finalizacion,
    });
  }

  const grupos = Array.from(porCampana.entries()).map(([campana, items]) => {
    const zonas = Array.from(new Set(items.map((it) => it.zona))).sort((a, b) => a.localeCompare(b, 'es'));
    const plataformasUnicas = Array.from(new Set(items.map((it) => it.plataforma)));
    const fechaMasProxima = items.reduce(
      (min, it) => (it.fecha_vencimiento < min ? it.fecha_vencimiento : min),
      items[0].fecha_vencimiento
    );
    return {
      campana,
      fecha_vencimiento: fechaMasProxima,
      zonas,
      plataforma: plataformasUnicas.length === 1 ? plataformasUnicas[0] : 'Varios',
      plataformaVarios: plataformasUnicas.length > 1,
    };
  });

  grupos.sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));

  const zonasAfectadas = new Set();
  for (const g of grupos) for (const z of g.zonas) zonasAfectadas.add(z);

  return {
    hoyIso,
    ventanaHasta,
    grupos,
    resumen: { totalCampanas: grupos.length, zonasAfectadas: zonasAfectadas.size },
  };
}
