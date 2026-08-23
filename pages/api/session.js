import { requireSession } from '../../lib/auth';

/**
 * Devuelve los datos mínimos de la sesión actual (usuario, área y rol).
 * Lo usa components/Layout.js para decidir, vía tieneAccesoSeccion()
 * (config/permisos.js), qué secciones del menú mostrar. Nunca expone datos
 * sensibles (contraseñas ni el resto de AUTH_USERS).
 */
export default async function handler(req, res) {
  const sesion = await requireSession(req);
  if (!sesion) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  return res.status(200).json({ user: sesion.user, area: sesion.area, role: sesion.role });
}
