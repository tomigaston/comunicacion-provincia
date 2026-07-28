import { NextResponse } from 'next/server';
import { COOKIE_NAME, verificarSesion } from './lib/auth';

export async function middleware(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const sesion = await verificarSesion(token);

  if (!sesion) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Todo pasa por acá salvo: /login, /api/* (cada api/data/* valida la sesión
  // por su cuenta y devuelve 401 en JSON en vez de redirigir a una página HTML),
  // y los estáticos de Next.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
};
