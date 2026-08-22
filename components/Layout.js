import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

const TABS = [
  { href: '/localidades', label: 'Localidades' },
  { href: '/campanas', label: 'Campañas' },
  { href: '/pauta-digital', label: 'Pauta Digital' },
  { href: '/sms', label: 'SMS' },
  { href: '/contenido-organico', label: 'Contenido Orgánico' },
  { href: '/movimientos', label: 'Movimientos de la semana' },
];

export default function Layout({ title, children }) {
  const router = useRouter();

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
            {TABS.map((tab) => {
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
