import { requireSession } from '../../../lib/auth';
import { tieneAccesoSeccion } from '../../../config/permisos';
import { leerJsonDeDatos } from '../../../lib/datos';

// Mismo patrón que el resto de pages/api/data/*, más el chequeo de
// tieneAccesoSeccion() (sección restringida, ver config/permisos.js): 401
// sin sesión, 403 con sesión pero sin acceso. Devuelve el JSON completo sin
// recortar — obras/dirigentes/candidatos/otras_preguntas viajan igual,
// aunque la página todavía no los use (entrega 3c).
export default async function handler(req, res) {
  const sesion = await requireSession(req);
  if (!sesion) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (!tieneAccesoSeccion(sesion, 'encuestas_localidades')) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  return res.status(200).json(leerJsonDeDatos('encuestas_localidades.json'));
}
