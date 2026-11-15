import { useEffect } from 'react';
import { Poppins } from 'next/font/google';
import '../styles/globals.css';

// Tipografía del manual de marca (Poppins). next/font la descarga al compilar
// y la sirve desde el propio sitio: el navegador no le pide nada a Google al
// abrir el tablero. Bold (700) y Black (900) son los pesos del manual; 400,
// 500 y 600 son para texto corrido, tablas y chips.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  display: 'swap',
  variable: '--fuente-poppins',
});

export default function App({ Component, pageProps }) {
  // La variable CSS queda en el contenedor de la app; se copia a <body> para
  // que los popovers y modales (que se dibujan con portal en body) usen la
  // misma fuente.
  useEffect(() => {
    document.body.classList.add(poppins.variable);
    return () => document.body.classList.remove(poppins.variable);
  }, []);

  return (
    <div className={`${poppins.variable} app-raiz`}>
      <Component {...pageProps} />
    </div>
  );
}
