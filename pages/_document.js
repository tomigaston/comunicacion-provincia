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
        <meta name="theme-color" content="#1976D2" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
