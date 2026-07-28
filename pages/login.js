import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { COOKIE_NAME, verificarSesion } from '../lib/auth';

function leerCookie(cookieHeader, nombre) {
  if (!cookieHeader) return null;
  const encontrada = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${nombre}=`));
  return encontrada ? decodeURIComponent(encontrada.slice(nombre.length + 1)) : null;
}

export async function getServerSideProps({ req }) {
  const token = leerCookie(req.headers.cookie, COOKIE_NAME);
  const sesion = await verificarSesion(token);
  if (sesion) {
    return { redirect: { destination: '/', permanent: false } };
  }
  return { props: {} };
}

export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'No se pudo iniciar sesión');
        setCargando(false);
        return;
      }
      const destino = typeof router.query.from === 'string' ? router.query.from : '/';
      window.location.href = destino;
    } catch {
      setError('No se pudo conectar con el servidor. Probá de nuevo.');
      setCargando(false);
    }
  }

  return (
    <>
      <Head>
        <title>Ingresar — Tablero de Comunicación</title>
      </Head>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-tertiary)',
          padding: 16,
        }}
      >
        <form
          onSubmit={onSubmit}
          style={{
            width: '100%',
            maxWidth: 380,
            background: 'var(--bg-primary)',
            borderRadius: 14,
            padding: '36px 32px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
            border: '1px solid var(--border)',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Tablero de Comunicación</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 24 }}>
            Gobierno de Córdoba — 60 localidades prioritarias
          </p>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Usuario
          </label>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            style={inputStyle}
          />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, margin: '16px 0 6px' }}>
            Contraseña
          </label>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            required
            style={inputStyle}
          />

          {error && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--cov-baja-bg)',
                color: '#991b1b',
                fontSize: 13.5,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={{
              marginTop: 24,
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: cargando ? '#90b8dd' : 'var(--accent)',
              color: '#fff',
              fontSize: 14.5,
              fontWeight: 600,
              cursor: cargando ? 'default' : 'pointer',
            }}
          >
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 14.5,
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
};
