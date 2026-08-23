/**
 * Sesión firmada (HMAC-SHA256) sin librerías externas.
 *
 * Usa exclusivamente Web Crypto (`crypto.subtle`, `TextEncoder`, `btoa`/`atob`)
 * en vez de las APIs de Node (`Buffer`, `require('crypto')`) a propósito:
 * este módulo se importa tanto desde middleware.js (corre en el runtime Edge,
 * que no tiene Node APIs) como desde las api routes (runtime Node). Web Crypto
 * está disponible en ambos, así no hace falta mantener dos implementaciones.
 */

export const COOKIE_NAME = 'cba_comunicacion_sesion';
export const MAX_AGE_SEGUNDOS = 60 * 60 * 24 * 30; // 30 días — "sesión persistente"

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const conRelleno = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=');
  const binary = atob(conRelleno);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function obtenerClave() {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) {
    throw new Error('Falta la variable de entorno SESSION_SECRET');
  }
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Lee y parsea AUTH_USERS (JSON). Nunca se expone al cliente: solo se usa en api/login. */
export function obtenerUsuarios() {
  const raw = process.env.AUTH_USERS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function validarCredenciales(user, pass) {
  if (!user || !pass) return null;
  const encontrado = obtenerUsuarios().find((u) => u.user === user && u.pass === pass);
  if (!encontrado) return null;
  return {
    user: encontrado.user,
    area: encontrado.area || null,
    // "role" es un campo opcional en AUTH_USERS. Si no viene, o viene con
    // cualquier valor que no sea exactamente "admin", el usuario se trata
    // como normal (sin privilegios extra) — ver config/permisos.js.
    role: encontrado.role === 'admin' ? 'admin' : 'user',
  };
}

export async function crearSesion({ user, area, role }) {
  const payload = JSON.stringify({ u: user, a: area, r: role === 'admin' ? 'admin' : 'user', iat: Date.now() });
  const payloadB64 = toBase64Url(encoder.encode(payload));
  const clave = await obtenerClave();
  const firma = await crypto.subtle.sign('HMAC', clave, encoder.encode(payloadB64));
  const firmaB64 = toBase64Url(new Uint8Array(firma));
  return `${payloadB64}.${firmaB64}`;
}

/** Devuelve { user, area } si el token es válido y no expiró, o null. */
export async function verificarSesion(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, firmaB64] = token.split('.');
  if (!payloadB64 || !firmaB64) return null;

  let clave;
  try {
    clave = await obtenerClave();
  } catch {
    return null;
  }

  let firmaBytes;
  try {
    firmaBytes = fromBase64Url(firmaB64);
  } catch {
    return null;
  }

  const valido = await crypto.subtle.verify('HMAC', clave, firmaBytes, encoder.encode(payloadB64));
  if (!valido) return null;

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadB64)));
    if (!payload.iat || Date.now() - payload.iat > MAX_AGE_SEGUNDOS * 1000) return null;
    // payload.r puede no existir en cookies emitidas antes de este cambio:
    // se trata como usuario normal ("user"), nunca como admin por defecto.
    return { user: payload.u, area: payload.a, role: payload.r === 'admin' ? 'admin' : 'user' };
  } catch {
    return null;
  }
}

/** Helper para api routes (Node): lee la cookie de sesión de NextApiRequest y la valida. */
export async function requireSession(req) {
  const token = req.cookies?.[COOKIE_NAME];
  return verificarSesion(token);
}
