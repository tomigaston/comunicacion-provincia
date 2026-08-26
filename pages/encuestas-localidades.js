import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import FilterBar from '../components/FilterBar';
import Autocomplete from '../components/Autocomplete';
import EncuestaResumenRonda from '../components/EncuestaResumenRonda';
import EncuestaComparativo from '../components/EncuestaComparativo';
import { useApiData } from '../lib/useApiData';
import { formatearFechaCorta } from '../lib/fechas';
import { requireSession } from '../lib/auth';
import { tieneAccesoSeccion } from '../config/permisos';

// Mismo patrón que el ejemplo comentado de config/permisos.js: sin sesión o
// sin acceso a la sección -> notFound (no un 500 ni una pantalla de error,
// simplemente no existe la página para ese usuario).
export async function getServerSideProps({ req }) {
  const sesion = await requireSession(req);
  if (!sesion || !tieneAccesoSeccion(sesion, 'encuestas_localidades')) {
    return { notFound: true };
  }
  return { props: {} };
}

export default function EncuestasLocalidades() {
  const { cargando, error, datos } = useApiData([
    '/api/data/encuestas-localidades',
    '/api/data/localidades-metadata',
  ]);
  const [localidadElegida, setLocalidadElegida] = useState(null);
  const [fechaElegida, setFechaElegida] = useState(null);
  const [vista, setVista] = useState('resumen');

  const encuestas = datos ? datos[0] : null;
  const metadata = datos ? datos[1] : null;
  const umbralPp = metadata ? metadata.umbral_variacion_pp : 0;

  const itemsBusqueda = useMemo(() => {
    if (!encuestas) return [];
    return Object.entries(encuestas)
      .map(([clave, info]) => ({ value: clave, label: info.nombre_localidad }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [encuestas]);

  // Mismo listado que itemsBusqueda pero con cantidad_rondas -> grilla de
  // todas las localidades para elegir sin depender del buscador (pedido
  // explícito del usuario: hoy no se ve nada hasta que se busca).
  const localidadesListado = useMemo(() => {
    if (!encuestas) return [];
    return Object.entries(encuestas)
      .map(([clave, info]) => ({
        clave,
        nombre: info.nombre_localidad,
        cantidadRondas: info.cantidad_rondas,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [encuestas]);

  const localidad = localidadElegida && encuestas ? encuestas[localidadElegida] : null;

  // Al cambiar de localidad, la ronda seleccionada por defecto es siempre la
  // más reciente (última fecha) — rondas ya viene ordenado ascendente por el
  // pipeline, así que la última del array es la más nueva.
  useEffect(() => {
    if (localidad && localidad.rondas.length > 0) {
      setFechaElegida(localidad.rondas[localidad.rondas.length - 1].fecha);
    } else {
      setFechaElegida(null);
    }
    // Al cambiar de localidad siempre se vuelve a "Resumen" (default) — evita
    // quedar en "Comparativo" al elegir una localidad con 1 sola ronda, que
    // ni siquiera muestra ese selector.
    setVista('resumen');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localidadElegida]);

  const ronda = localidad ? localidad.rondas.find((r) => r.fecha === fechaElegida) || null : null;

  return (
    <Layout title="Encuestas de Localidades">
      {cargando && <p>Cargando datos del tablero...</p>}
      {error && <p style={{ color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>}

      {encuestas && (
        <>
          <div style={{ marginBottom: 20 }}>
            <FilterBar>
              <Autocomplete
                items={itemsBusqueda}
                placeholder="Buscar localidad..."
                valorInicial={localidad ? localidad.nombre_localidad : ''}
                onSelect={(item) => setLocalidadElegida(item.value)}
              />
            </FilterBar>
          </div>

          {!localidad && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              {localidadesListado.map((loc) => (
                <button
                  key={loc.clave}
                  type="button"
                  onClick={() => setLocalidadElegida(loc.clave)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '14px 16px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{loc.nombre}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {loc.cantidadRondas} {loc.cantidadRondas === 1 ? 'ronda' : 'rondas'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {localidad && ronda && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {/* Resetea localidadElegida a null -> el useEffect de más
                    abajo (dispara con cualquier cambio de localidadElegida,
                    incluido a null) ya limpia fechaElegida y vuelve a
                    vista='resumen' solo; no hace falta tocar nada más acá. */}
                <button
                  type="button"
                  onClick={() => setLocalidadElegida(null)}
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: 'var(--accent)',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  ‹ Volver al listado
                </button>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>{localidad.nombre_localidad}</h2>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {localidad.cantidad_rondas} {localidad.cantidad_rondas === 1 ? 'ronda' : 'rondas'} de encuesta
                  {vista === 'resumen' && ronda.casos_totales != null ? ` · ${ronda.casos_totales} casos` : ''}
                </span>
              </div>

              {localidad.tiene_comparativo && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                  {[
                    { key: 'resumen', label: 'Resumen' },
                    { key: 'comparativo', label: 'Comparativo' },
                  ].map((tab) => {
                    const activa = vista === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setVista(tab.key)}
                        style={{
                          padding: '9px 18px',
                          fontSize: 14,
                          fontWeight: activa ? 700 : 500,
                          color: activa ? 'var(--accent)' : 'var(--text-secondary)',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: activa ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                          cursor: 'pointer',
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {vista === 'resumen' && (
                <>
                  {localidad.rondas.length > 1 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                      {localidad.rondas.map((r) => {
                        const activa = r.fecha === fechaElegida;
                        return (
                          <button
                            key={r.fecha}
                            type="button"
                            onClick={() => setFechaElegida(r.fecha)}
                            style={{
                              padding: '8px 14px',
                              borderRadius: 999,
                              border: `1.5px solid ${activa ? 'var(--accent)' : 'var(--border)'}`,
                              background: activa ? '#e0edfb' : 'var(--bg-secondary)',
                              color: activa ? 'var(--accent)' : 'var(--text-secondary)',
                              fontSize: 13.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {formatearFechaCorta(r.fecha)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* key con localidad+fecha (no solo fecha): dos localidades
                      distintas pueden compartir la misma fecha de ronda (ya
                      pasó, ej. "2026-02-13" en LA CALERA y en VILLA DOLORES).
                      Sin esta key, al cambiar de localidad hay un render
                      transitorio donde `ronda` ya cambió pero `fechaElegida`
                      todavía no se sincronizó (el useEffect corre después del
                      render) -> por un instante se arma con la ronda de la
                      fecha vieja en la localidad NUEVA, y si esa coincidencia
                      pasa a tener menos escenarios que la ronda real (visto
                      con Candidatos: esa ronda-fantasma no tenía "Escenario
                      0"), el estado interno de EncuestaCandidatos/
                      EncuestaDirigentes (useState de escenario elegido,
                      búsqueda de dirigente) queda inicializado con esos datos
                      de paso y no se resetea al llegar la ronda real, porque
                      React no desmonta el componente (misma posición en el
                      árbol). La key fuerza un remount limpio en cada cambio
                      real de localidad o de ronda. */}
                  <EncuestaResumenRonda key={`${localidadElegida}|${fechaElegida}`} ronda={ronda} />
                </>
              )}

              {vista === 'comparativo' && (
                <EncuestaComparativo rondas={localidad.rondas} umbralPp={umbralPp} />
              )}
            </>
          )}
        </>
      )}
    </Layout>
  );
}
