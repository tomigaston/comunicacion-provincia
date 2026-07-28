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
