import { useEffect, useState } from 'react';

/**
 * Carga uno o más endpoints de /api/data/* al montar. Si alguno devuelve 401
 * (sesión vencida/inválida) redirige a /login en vez de mostrar un error.
 */
export function useApiData(endpoints) {
  const clave = endpoints.join('|');
  const [estado, setEstado] = useState({ cargando: true, error: null, datos: null });

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const respuestas = await Promise.all(endpoints.map((e) => fetch(e)));
        for (const r of respuestas) {
          if (r.status === 401) {
            window.location.href = '/login';
            return;
          }
          if (!r.ok) throw new Error(`No se pudo cargar ${r.url} (${r.status})`);
        }
        const datos = await Promise.all(respuestas.map((r) => r.json()));
        if (!cancelado) setEstado({ cargando: false, error: null, datos });
      } catch (e) {
        if (!cancelado) setEstado({ cargando: false, error: e.message, datos: null });
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return estado;
}
