import { useMemo } from 'react';
import { useApiData } from './useApiData';
import { normalizarTexto } from './texto';
import { peorAlerta, colorDeAlerta } from './semaforo';

/**
 * Calcula, para cada una de las 60 localidades, el semáforo de antigüedad de
 * Medios Tradicionales y de Pauta Digital (peor caso por área, sección 2.4 de
 * la spec) -- función pura, sin fetch propio, para que la pueda llamar tanto
 * la grilla de Localidades (que ya tiene los 3 JSON cargados) como la pestaña
 * Semáforo (ver useAlertas() más abajo) sin pedir los datos dos veces.
 *
 * Devuelve un array de:
 *   { localidad, departamento, alertaMedios, alertaPautaDigital,
 *     colorGeneral, antiguedadGeneral }
 * `colorGeneral` es el peor color entre las dos áreas juntas; `antiguedadGeneral`
 * es el máximo `antiguedad_dias` entre los ítems (de cualquiera de las dos
 * áreas) que tienen ese color -- lo que usa la vista Lista para ordenar
 * dentro de un mismo color (sección 2 del pedido de Tomás sobre la pestaña
 * Semáforo).
 */
export function calcularAlertasLocalidades(localidadesData, mediosData, pautaData) {
  const mediosPorClave = new Map(
    mediosData.localidades.map((l) => [normalizarTexto(l.localidad), l])
  );

  // clave -> [{ alerta, antiguedad_dias }] de piezas vigentes de Pauta Digital
  // con alerta -- mismo criterio de alcance_tipo que el resto del tablero (ver
  // pages/localidades/index.js): una pieza cuenta para una Localidad solo si
  // su Localidad puntual es una de las 60.
  const pautaPorClave = new Map();
  for (const p of pautaData.piezas) {
    if (!p.en_60_localidades) continue;
    if (p.alcance_tipo !== 'localidad' || !p.localidad) continue;
    // vigente_por_fecha (no p.estado): desde el 25/09/2026 "estado" viene
    // directo del ESTADO crudo (ver estado_pauta_digital_desde_crudo() en
    // scripts/generar_datos.py) y ya no refleja vigencia por fecha -- el
    // semáforo de antigüedad sigue siendo por INICIO/FIN como siempre.
    if (!p.vigente_por_fecha || !p.alerta) continue;
    const clave = normalizarTexto(p.localidad);
    if (!pautaPorClave.has(clave)) pautaPorClave.set(clave, []);
    pautaPorClave.get(clave).push({ alerta: p.alerta, antiguedad_dias: p.antiguedad_dias });
  }

  return localidadesData.localidades.map((loc) => {
    const clave = normalizarTexto(loc.localidad);
    const medios = mediosPorClave.get(clave);
    const itemsMedios = medios ? medios.vigentes.filter((v) => v.alerta) : [];
    const itemsPauta = pautaPorClave.get(clave) || [];
    const todosItems = [...itemsMedios, ...itemsPauta];

    const alertaMedios = peorAlerta(itemsMedios.map((it) => it.alerta));
    const alertaPautaDigital = peorAlerta(itemsPauta.map((it) => it.alerta));
    const colorGeneral = peorAlerta(todosItems.map((it) => it.alerta));

    // Localidades sin ningún ítem con alerta (todo null) quedan sin badge y
    // sin antigüedad de referencia -- no se inventa un verde por default
    // (misma regla de siempre).
    const antiguedadGeneral = colorGeneral
      ? Math.max(
          0,
          ...todosItems
            .filter((it) => colorDeAlerta(it.alerta) === colorGeneral)
            .map((it) => it.antiguedad_dias ?? 0)
        )
      : null;

    return {
      localidad: loc.localidad,
      departamento: loc.departamento,
      alertaMedios,
      alertaPautaDigital,
      colorGeneral,
      antiguedadGeneral,
    };
  });
}

/** Hook autónomo (pide sus propios 3 endpoints) para la pestaña Semáforo,
 * que no tiene ya cargados los datos de Localidades/Medios/Pauta Digital
 * como sí los tiene pages/localidades/index.js. */
export function useAlertas() {
  const { cargando, error, datos } = useApiData([
    '/api/data/localidades',
    '/api/data/medios-tradicionales',
    '/api/data/pauta-digital',
  ]);

  const alertas = useMemo(() => {
    if (!datos) return null;
    const [localidadesData, mediosData, pautaData] = datos;
    return calcularAlertasLocalidades(localidadesData, mediosData, pautaData);
  }, [datos]);

  return { cargando, error, alertas };
}
