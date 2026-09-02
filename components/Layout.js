import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { tieneAccesoSeccion } from '../config/permisos';

// La propiedad `key` identifica la sección para el esquema de permisos de
// config/permisos.js. Hoy SECCIONES_RESTRINGIDAS está vacío, así que el
// filtro de abajo no oculta nada: el menú se ve igual que siempre. Para
// restringir una sección nueva en el futuro, alcanza con agregar su entrada
// en SECCIONES_RESTRINGIDAS (config/permisos.js) — no hace falta tocar nada
// más acá salvo, si es una sección que hoy no existe, sumar su `key` al tab
// correspondiente.
const TABS = [
  { href: '/localidades', label: 'Localidades', key: 'localidades' },
  { href: '/campanas', label: 'Campañas', key: 'campanas' },
  { href: '/pauta-digital', label: 'Pauta Digital', key: 'pauta_digital' },
  { href: '/semaforo', label: 'Semáforo', key: 'semaforo' },
  { href: '/sms', label: 'SMS', key: 'sms' },
  { href: '/contenido-organico', label: 'Contenido Orgánico', key: 'contenido_organico' },
  { href: '/movimientos', label: 'Movimientos de la semana', key: 'movimientos' },
  { href: '/encuestas-localidades', label: 'Encuestas de Localidades', key: 'encuestas_localidades' },
];

export default function Layout({ title, children }) {
  const router = useRouter();
  const [sesion, setSesion] = useState(null);

  useEffect(() => {
    let cancelado = false;
    fetch('/api/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelado) setSesion(data);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  // Mientras /api/session todavía no resolvió, se muestran todas las tabs
  // (igual que antes de este cambio, sin flicker) — ninguna está restringida
  // hoy, así que el resultado final es el mismo de todas formas.
  const tabsVisibles = useMemo(() => {
    if (!sesion) return TABS;
    return TABS.filter((tab) => tieneAccesoSeccion(sesion, tab.key));
  }, [sesion]);

  async function salir() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <>
      <Head>
        <title>{title ? `${title} — Tablero de Comunicación` : 'Tablero de Comunicación'}</title>
      </Head>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border)',
            padding: '0 24px',
          }}
        >
          <div
            style={{
              maxWidth: 1400,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 56,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>Tablero de Comunicación — Córdoba</div>
            <button
              type="button"
              onClick={salir}
              style={{
                border: '1px solid var(--border)',
                background: 'transparent',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 13,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              Cerrar sesión
            </button>
          </div>
          <nav style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 4 }}>
            {tabsVisibles.map((tab) => {
              const activo = router.pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  style={{
                    padding: '10px 16px',
                    fontSize: 14,
                    fontWeight: activo ? 700 : 500,
                    color: activo ? 'var(--accent)' : 'var(--text-secondary)',
                    borderBottom: activo ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main style={{ flex: 1, width: '100%', maxWidth: 1400, margin: '0 auto', padding: 24 }}>
          {children}
        </main>
      </div>
    </>
  );
}
