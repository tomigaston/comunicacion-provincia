// Construido con String.fromCharCode a propósito: evita pegar caracteres Unicode
// combinantes literales en el código fuente (frágil de editar/leer a simple vista).
const RANGO_DIACRITICOS = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g'
);

export function normalizarTexto(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(RANGO_DIACRITICOS, '');
}

export function slugificar(s) {
  return normalizarTexto(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}
