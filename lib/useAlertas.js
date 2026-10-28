import { useMemo } from 'react';
import { useApiData } from './useApiData';
import { normalizarTexto } from './texto';
import { peorAlerta, colorDeAlerta, calcularSemaforoMedios } from './semaforo';
import { calcularEjePDPorLocalidad } from './coverage';
import { isoDe } from './vencimientos';

/**
 * Calcula, para cada una de las 60 localidades, el semáforo de Medios
 * Tradicionales (frescura + cobertura) y de Pauta Digital (cantidad de piezas
 * activas, 28/10/2026) -- función pura, sin fetch propio, para que la
 * pueda llamar tanto la grilla de Localidades (que ya tiene los 3 JSON
 * cargados) como la pestaña Semáforo (ver useAlertas() más abajo) sin pedir los datos dos veces.
 *
 * Devuelve un array de:
 *   { localidad, departamento, alertaMedios, semaforoMedios, alertaPautaDigital,
 *     semaforoPD, colorGeneral, antiguedadGeneral }
 * `semaforoPD` es el resultado de calcularSemaforoPD() (activas, desglose,
 * proyección, aviso, próximo vencimiento, Programadas de la ventana).
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

  // PD: color por cantidad de piezas activas (dirigidas y provinciales), ver
  // calcularSemaforoPD en lib/semaforo.js. Mismo cálculo que la grilla. PD no
  // tiene antigüedad que ordenar: `antiguedad_dias` queda en null y solo ordena
  // el lado de MT.
  const ejePD = calcularEjePDPorLocalidad(pautaData, hoyIso);

  return localidadesData.localidades.map((loc) => {
    const clave = normalizarTexto(loc.localidad);
    const medios = mediosPorClave.get(clave);
    const semaforoPD = ejePD(loc.localidad);
    const itemsPauta = [{ alerta: semaforoPD.color, antiguedad_dias: null }];

    // MT: dos ejes (frescura + cobertura) sobre Maestro_Vigente. Aporta un
    // solo ítem al general, con la antigüedad del tema activo más reciente.
    const semaforoMedios = medios ? calcularSemaforoMedios(medios) : null;
    const alertaMedios = semaforoMedios ? semaforoMedios.color : null;
    const itemsMedios = semaforoMedios
      ? [{ alerta: alertaMedios, antiguedad_dias: semaforoMedios.frescura.dias }]
      : [];
    const todosItems = [...itemsMedios, ...itemsPauta];

    const alertaPautaDigital = semaforoPD.color;
    const colorGeneral = peorAlerta(todosItems.map((it) => it.alerta));

    // PD siempre tiene color (0 activas = 🔴), así que hoy colorGeneral nunca
    // es null; si lo fuera, la localidad queda sin badge y sin antigüedad de
    // referencia -- no se inventa un verde por default.
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
      semaforoPD,
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
