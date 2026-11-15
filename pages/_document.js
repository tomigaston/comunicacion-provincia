import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <meta charSet="utf-8" />
        <meta
          name="description"
          content="Tablero de comunicación — Gobierno de Córdoba. Seguimiento de campañas publicitarias en las 60 localidades prioritarias."
        />
        <meta name="theme-color" content="#6caee5" />
        {/* Escudo del manual de marca (ver public/). */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="64x64" href="/favicon-64.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
