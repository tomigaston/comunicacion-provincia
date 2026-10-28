import { leerJsonDeDatos } from '../../../lib/datos';
import {
  calcularVencimientosMediosTradicionales,
  calcularCoberturaFaltanteMT,
  calcularCoberturaPD,
  calcularLocalidadesSinCobertura,
  isoDe,
} from '../../../lib/vencimientos';
import {
  enviarEmailVencimientos,
  enviarEmailVencimientosMediosTradicionales,
  enviarEmailCoberturaPautaDigital,
} from '../../../lib/mailer';

/**
 * Cron semanal (vercel.json -> crons), lunes 07:00 ART. Vercel Cron manda
 * `Authorization: Bearer $CRON_SECRET` -- se valida acá para que el endpoint
 * no sea invocable públicamente sin ese secreto (no requiere sesión de
 * usuario: /api/* está fuera del matcher de middleware.js).
 *
 * Manda 3 mails con criterios DISTINTOS por área (no se mezclan, ver
 * lib/vencimientos.js): Medios Tradicionales por antigüedad de actualización
 * (semáforo 🟡/🔴) más los tipos que faltan por localidad; Pauta Digital por
 * nivel de cobertura (color + N activas por localidad) y avisos de la ventana
 * de 7 días (28/10/2026). El general suma un resumen de la cobertura de PD
 * (mismo cálculo) y el flag global "sin cobertura" (cero MT activo Y cero PD
 * activa). El general (EMAIL_TO, obligatoria) combina los dos bloques; los
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

    // Cobertura (spec 11/10/2026, D5; PD 28/10/2026): operativa por área + flag global.
    const coberturaMT = calcularCoberturaFaltanteMT(mediosTradicionales);
    const coberturaPD = calcularCoberturaPD(mediosTradicionales, pautaDigital, hoyIso);
    const sinCobertura = calcularLocalidadesSinCobertura(mediosTradicionales, pautaDigital, hoyIso);

    await enviarEmailVencimientos(datosMT, coberturaPD, hoyIso, sinCobertura);
    await enviarEmailVencimientosMediosTradicionales(datosMT, hoyIso, coberturaMT);
    await enviarEmailCoberturaPautaDigital(coberturaPD, hoyIso);

    return res.status(200).json({
      ok: true,
      mediosTradicionales: { temas: datosMT.grupos.length, ...datosMT.resumen },
      cobertura: {
        mtLocalidadesConFaltantes: coberturaMT.resumen.total,
        pdPorColor: coberturaPD.resumen.porColor,
        pdAtencion: coberturaPD.atencion.total,
        pdCubiertasPorProgramadas: coberturaPD.cubiertas.total,
        pdProgramadasInicioVencido: coberturaPD.programadasInicioVencido.length,
        localidadesSinCobertura: sinCobertura.localidades.map((l) => l.localidad),
      },
    });
  } catch (e) {
    console.error('Error en cron de vencimientos semanales:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
