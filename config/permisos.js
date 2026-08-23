/**
 * Esquema de permisos por rol/sección del Tablero de Comunicación.
 *
 * Hoy NINGUNA sección está restringida: todo usuario autenticado ve el
 * mismo menú y accede a las mismas páginas/API routes que ve actualmente.
 * Este módulo solo deja preparado el mecanismo para el día que haga falta
 * limitar una sección nueva a un subconjunto de usuarios (los usuarios con
 * role === "admin" siempre tienen acceso a todo, sin necesidad de listarlos
 * acá).
 *
 * CÓMO AGREGAR UNA SECCIÓN RESTRINGIDA EN EL FUTURO:
 *   1. Elegir una key interna para la sección, ej. "encuestas_localidades".
 *   2. Agregarla acá con el array de usernames (sin "@") que, además de los
 *      admin, deben poder verla:
 *        encuestas_localidades: ["comunicacion"]
 *   3. En components/Layout.js, agregar esa misma key al item de TABS
 *      correspondiente (propiedad `key`) — el menú ya filtra cada tab con
 *      tieneAccesoSeccion(), así que con el paso 2 alcanza para que el
 *      ítem aparezca o no según el usuario logueado.
 *   4. Envolver la página (getServerSideProps de pages/<seccion>.js) y su
 *      API route (pages/api/data/<seccion>.js) con un chequeo de
 *      tieneAccesoSeccion() que corte con 403/notFound si no corresponde.
 *      Ver el ejemplo comentado al final de este archivo — no es código
 *      funcional todavía, la sección de ejemplo no existe.
 */

// key = identificador interno de la sección restringida.
// value = array de usernames (sin "@") con acceso explícito, además de los
//         usuarios con role === "admin" (que siempre tienen acceso).
export const SECCIONES_RESTRINGIDAS = {
  // encuestas_localidades: ['comunicacion'],
};

/**
 * sesionUsuario: objeto de sesión ya validado, con al menos { user, role }
 * (el que devuelven requireSession()/verificarSesion() en lib/auth.js).
 * seccionKey: identificador interno de la sección (ver SECCIONES_RESTRINGIDAS
 * arriba y las keys usadas en components/Layout.js).
 *
 * Reglas:
 *  - Sin sesión                                   -> false.
 *  - role === "admin"                             -> true siempre.
 *  - seccionKey no está en SECCIONES_RESTRINGIDAS  -> true (comportamiento
 *    por defecto: las secciones no listadas están abiertas a cualquier
 *    usuario autenticado, sin restricción).
 *  - seccionKey está listada                       -> true solo si
 *    sesionUsuario.user figura en su array de usernames permitidos.
 */
export function tieneAccesoSeccion(sesionUsuario, seccionKey) {
  if (!sesionUsuario) return false;
  if (sesionUsuario.role === 'admin') return true;

  const permitidos = SECCIONES_RESTRINGIDAS[seccionKey];
  if (!permitidos) return true; // sección no listada: abierta para cualquier autenticado

  return permitidos.includes(sesionUsuario.user);
}

/*
 * EJEMPLO (comentado, no funcional todavía) de cómo se protegería una
 * página + su API route el día que "encuestas_localidades" exista de
 * verdad:
 *
 * // pages/encuestas-localidades.js
 * // import { requireSession } from '../lib/auth';
 * // import { tieneAccesoSeccion } from '../config/permisos';
 * //
 * // export async function getServerSideProps({ req }) {
 * //   const sesion = await requireSession(req);
 * //   if (!sesion || !tieneAccesoSeccion(sesion, 'encuestas_localidades')) {
 * //     return { notFound: true };
 * //   }
 * //   return { props: {} };
 * // }
 *
 * // pages/api/data/encuestas-localidades.js
 * // import { requireSession } from '../../../lib/auth';
 * // import { tieneAccesoSeccion } from '../../../config/permisos';
 * // import { leerJsonDeDatos } from '../../../lib/datos';
 * //
 * // export default async function handler(req, res) {
 * //   const sesion = await requireSession(req);
 * //   if (!sesion) return res.status(401).json({ error: 'No autenticado' });
 * //   if (!tieneAccesoSeccion(sesion, 'encuestas_localidades')) {
 * //     return res.status(403).json({ error: 'No autorizado' });
 * //   }
 * //   return res.status(200).json(leerJsonDeDatos('encuestas_localidades.json'));
 * // }
 */
