import { leerJsonDeDatos } from '../../../lib/datos';
import {
  calcularVencimientosMediosTradicionales,
  calcularVencimientosPautaDigital,
  isoDe,
} from '../../../lib/vencimientos';
import {
  enviarEmailVencimientos,
  enviarEmailVencimientosMediosTradicionales,
  enviarEmailVencimientosPautaDigital,
} from '../../../lib/mailer';

/**
 * Cron semanal (vercel.json -> crons), lunes 07:00 ART. Vercel Cron manda
 * `Authorization: Bearer $CRON_SECRET` -- se valida acá para que el endpoint
 * no sea invocable públicamente sin ese secreto (no requiere sesión de
 * usuario: /api/* está fuera del matcher de middleware.js).
 *
 * Manda 3 mails con criterios DISTINTOS por área (no se mezclan, ver
 * lib/vencimientos.js): Medios Tradicionales por antigüedad de actualización
 * (semáforo 🟡/🔴), Pauta Digital por vencimiento real dentro de la ventana
 * hoy..hoy+7. El general (EMAIL_TO, obligatoria) combina los dos bloques; los
 * dos por área (EMAIL_TO_MEDIOS_TRADICIONALES / EMAIL_TO_PAUTA_DIGITAL) son
 * opcionales -- si alguna todavía no está cargada, se saltea con un
 * console.warn en vez de tirar abajo el cron entero.
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
    const datosMT = calcularVencimientosMediosTradicionales(mediosTradicionales);
    const datosPD = calcularVencimientosPautaDigital(pautaDigital, hoyIso);

    await enviarEmailVencimientos(datosMT, datosPD, hoyIso);
    await enviarEmailVencimientosMediosTradicionales(datosMT, hoyIso);
    await enviarEmailVencimientosPautaDigital(datosPD, hoyIso);

    return res.status(200).json({
      ok: true,
      mediosTradicionales: { temas: datosMT.grupos.length, ...datosMT.resumen },
      pautaDigital: { campanas: datosPD.grupos.length, ...datosPD.resumen },
    });
  } catch (e) {
    console.error('Error en cron de vencimientos semanales:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
