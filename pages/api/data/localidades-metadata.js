import { requireSession } from '../../../lib/auth';
import { tieneAccesoSeccion } from '../../../config/permisos';
import { leerJsonDeDatos } from '../../../lib/datos';

// Mismo patrón que pages/api/data/encuestas-localidades.js: esta metadata
// (hoy solo umbral_variacion_pp, ver data/localidades_metadata.json) es
// propia de la sección Encuestas de Localidades -> mismo gate de permisos.
// La usa el Comparativo (entrega 3b) para decidir "Estable" vs. flecha
// 🔺/🔻 sin hardcodear el umbral en el frontend.
export default async function handler(req, res) {
  const sesion = await requireSession(req);
  if (!sesion) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (!tieneAccesoSeccion(sesion, 'encuestas_localidades')) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  return res.status(200).json(leerJsonDeDatos('localidades_metadata.json'));
}
