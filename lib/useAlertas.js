import { useMemo } from 'react';
import { useApiData } from './useApiData';
import { normalizarTexto } from './texto';
import { peorAlerta, colorDeAlerta, calcularSemaforoMedios, colorVencimientoPD, cuentaParaLocalidad } from './semaforo';
import { isoDe } from './vencimientos';

/**
 * Calcula, para cada una de las 60 localidades, el semáforo de antigüedad de
 * Medios Tradicionales (antigüedad) y de Pauta Digital (vencimiento), peor
 * caso por área (sección 2.4 de la spec) -- función pura, sin fetch propio, para que la pueda llamar tanto
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
export function calcularAlertasLocalidades(localidadesData, mediosData, pautaData, hoyIso = isoDe(new Date())) {
  const mediosPorClave = new Map(
    mediosData.localidades.map((l) => [normalizarTexto(l.localidad), l])
  );

  // clave -> [{ alerta, antiguedad_dias }] de piezas vivas de Pauta Digital --
  // mismo criterio de alcance_tipo que el resto del tablero (ver
  // pages/localidades/index.js): una pieza cuenta para una Localidad solo si
  // su Localidad puntual es una de las 60 y fue DIRIGIDA a la zona
  // (cuentaParaLocalidad: sin multiple_provincia ni departamento). El color
  // es por proximidad a FIN (colorVencimientoPD, spec 11/10/2026): PD no tiene antigüedad que ordenar,
  // así que `antiguedad_dias` queda en null y solo ordena el lado de MT.
  const pautaPorClave = new Map();
  for (const p of pautaData.piezas) {
    if (!p.en_60_localidades) continue;
    if (p.alcance_tipo !== 'localidad' || !p.localidad) continue;
    // D2: una provincial expandida a las 60 no pinta el color de la localidad.
    if (!cuentaParaLocalidad(p)) continue;
    const alerta = colorVencimientoPD(p, hoyIso);
    if (!alerta) continue;
    const clave = normalizarTexto(p.localidad);
    if (!pautaPorClave.has(clave)) pautaPorClave.set(clave, []);
    pautaPorClave.get(clave).push({ alerta, antiguedad_dias: null });
  }

  return localidadesData.localidades.map((loc) => {
    const clave = normalizarTexto(loc.localidad);
    const medios = mediosPorClave.get(clave);
    const itemsPauta = pautaPorClave.get(clave) || [];

    // MT: dos ejes (frescura + cobertura) sobre Maestro_Vigente. Aporta un
    // solo ítem al general, con la antigüedad del tema activo más reciente.
    const semaforoMedios = medios ? calcularSemaforoMedios(medios) : null;
    const alertaMedios = semaforoMedios ? semaforoMedios.color : null;
    const itemsMedios = semaforoMedios
      ? [{ alerta: alertaMedios, antiguedad_dias: semaforoMedios.frescura.dias }]
      : [];
    const todosItems = [...itemsMedios, ...itemsPauta];

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
      semaforoMedios,
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
