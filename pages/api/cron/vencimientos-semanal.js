import { leerJsonDeDatos } from '../../../lib/datos';
import { calcularVencimientos, isoDe } from '../../../lib/vencimientos';
import { enviarEmailVencimientos } from '../../../lib/mailer';

/**
 * Cron semanal (vercel.json -> crons), lunes 07:00 ART. Vercel Cron manda
 * `Authorization: Bearer $CRON_SECRET` -- se valida acá para que el endpoint
 * no sea invocable públicamente sin ese secreto (no requiere sesión de
 * usuario: /api/* está fuera del matcher de middleware.js).
 */
export default async function handler(req, res) {
  const secretoEsperado = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (!secretoEsperado || auth !== `Bearer ${secretoEsperado}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const mediosTradicionales = leerJsonDeDatos('medios_tradicionales.json');
    const pautaDigital = leerJsonDeDatos('pauta_digital.json');

    const hoyIso = isoDe(new Date());
    const vencimientos = calcularVencimientos(mediosTradicionales, pautaDigital, hoyIso);

    await enviarEmailVencimientos(vencimientos, hoyIso);

    return res.status(200).json({ ok: true, total: vencimientos.total, zonas: vencimientos.zonas.length });
  } catch (e) {
    console.error('Error en cron de vencimientos semanales:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
