import { COOKIE_NAME, MAX_AGE_SEGUNDOS, crearSesion, validarCredenciales } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { user, pass } = req.body || {};
  const sesion = validarCredenciales(user, pass);

  if (!sesion) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const token = await crearSesion(sesion);
  const seguro = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEGUNDOS}${seguro}`
  );

  return res.status(200).json({ ok: true, area: sesion.area });
}
