// Destinos de navegación de las cards de resumen (un solo lugar: la auditoría
// de interacción los verifica contra las rutas y los datos reales).
import { slugificar } from './texto';

/** Ficha de una localidad (pages/localidades/[localidad].js busca por slug). */
export const hrefLocalidad = (nombre) => `/localidades/${slugificar(nombre)}`;

/** Campañas filtradas por nombre (pages/campanas.js lee ?q=). */
export const hrefCampana = (nombre) => `/campanas?q=${encodeURIComponent(nombre)}`;
