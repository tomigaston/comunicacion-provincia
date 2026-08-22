import fs from 'fs';
import path from 'path';
import { requireSession } from './auth';

const DIR_DATOS = path.join(process.cwd(), 'data');

/** Lee un JSON de data/ (fuera de public/, no accesible por URL). */
export function leerJsonDeDatos(nombreArchivo) {
  const ruta = path.join(DIR_DATOS, nombreArchivo);
  const contenido = fs.readFileSync(ruta, 'utf-8');
  return JSON.parse(contenido);
}

/** Handler de api route que exige sesión válida antes de devolver el JSON pedido. */
export function crearHandlerDatos(nombreArchivo) {
  return async function handler(req, res) {
    const sesion = await requireSession(req);
    if (!sesion) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    return res.status(200).json(leerJsonDeDatos(nombreArchivo));
  };
}

/**
 * Como crearHandlerDatos, pero para secciones opcionales del tablero (hoy:
 * SMS) cuyo JSON puede no existir todavía si esa área nunca mandó su primer
 * export — generar_datos.py directamente omite escribir el archivo en ese
 * caso (ver cargar_sms()). Devuelve `valorPorDefecto` en vez de romper con
 * 500 para que la pantalla pueda mostrar "sin datos" en paz.
 */
export function crearHandlerDatosOpcional(nombreArchivo, valorPorDefecto) {
  return async function handler(req, res) {
    const sesion = await requireSession(req);
    if (!sesion) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    try {
      return res.status(200).json(leerJsonDeDatos(nombreArchivo));
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(200).json(valorPorDefecto);
      }
      throw e;
    }
  };
}
