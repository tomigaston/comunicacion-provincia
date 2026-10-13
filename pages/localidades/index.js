import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import FilterBar from '../../components/FilterBar';
import MedioFilterChip from '../../components/MedioFilterChip';
import Autocomplete from '../../components/Autocomplete';
import { ResumenGeneral } from '../../components/ResumenCards';
import LocalidadCard from '../../components/LocalidadCard';
import { useApiData } from '../../lib/useApiData';
import { normalizarTexto, slugificar } from '../../lib/texto';
import { ORDEN_BANDAS, BANDA_COBERTURA, calcularEjePDPorLocalidad } from '../../lib/coverage';
import { isoDe } from '../../lib/vencimientos';
import { resumenGeneral } from '../../lib/resumen';
import { TIPOS_MEDIO } from '../../lib/tiposMedio';

export default function LocalidadesIndex() {
  const router = useRouter();
  const { cargando, error, datos } = useApiData([
    '/api/data/localidades',
    '/api/data/medios-tradicionales',
    '/api/data/pauta-digital',
    '/api/data/audiovisuales',
  ]);

  const [busqueda, setBusqueda] = useState('');
  const [bandasActivas, setBandasActivas] = useState(new Set(ORDEN_BANDAS));
  const [mediosEstado, setMediosEstado] = useState(() =>
    Object.fromEntries(TIPOS_MEDIO.map((m) => [m.key, 'off']))
  );

  const combinado = useMemo(() => {
    if (!datos) return null;
    const [localidadesData, mediosData, pautaData, audiovisualesData] = datos;

    const coberturaPorClave = new Map(
      mediosData.localidades.map((l) => [normalizarTexto(l.localidad), l])
    );

    // Eje B (PD viva dirigida a la localidad + peor color de vencimiento),
    // independiente del eje A (banda MT). Ver calcularEjePDPorLocalidad().
    const ejePDPorLocalidad = calcularEjePDPorLocalidad(pautaData.piezas, isoDe(new Date()));

    const audiovisualesPorLocalidad = new Set(
      audiovisualesData.items.filter((i) => i.en_60_prioritarias).map((i) => normalizarTexto(i.localidad))
    );

    return localidadesData.localidades.map((loc) => {
      const clave = normalizarTexto(loc.localidad);
      const cobertura = coberturaPorClave.get(clave);
      return {
        ...loc,
        bandaCobertura: cobertura ? cobertura.banda_cobertura : 'Sin',
        totalTipos: cobertura ? cobertura.total_tipos : 0,
        cobertura: cobertura ? cobertura.cobertura : {},
        ejePD: ejePDPorLocalidad.get(clave) || null,
        tieneAudiovisuales: audiovisualesPorLocalidad.has(clave),
      };
    });
  }, [datos]);

  const itemsBusqueda = useMemo(() => {
    if (!combinado) return [];
    return combinado.map((l) => ({
      value: slugificar(l.localidad),
      label: l.localidad,
      sublabel: l.departamento,
    }));
  }, [combinado]);

  const filtrados = useMemo(() => {
    if (!combinado) return [];
    const q = normalizarTexto(busqueda);
    return combinado.filter((l) => {
      if (q && !normalizarTexto(l.localidad).includes(q) && !normalizarTexto(l.departamento).includes(q)) {
        return false;
      }
      if (!bandasActivas.has(l.bandaCobertura)) return false;
      for (const tipo of TIPOS_MEDIO) {
        const estado = mediosEstado[tipo.key];
        if (estado === 'incluir' && !l.cobertura[tipo.key]) return false;
        if (estado === 'excluir' && l.cobertura[tipo.key]) return false;
      }
      return true;
    });
  }, [combinado, busqueda, bandasActivas, mediosEstado]);

  // Cards de resumen: salen de los mismos predicados y ejes que la grilla, el
  // semáforo y el mail (ver lib/resumen.js), no de un cálculo propio.
  const resumen = useMemo(() => {
    if (!datos) return null;
    const [, mediosData, pautaData] = datos;
    return resumenGeneral(mediosData, pautaData, isoDe(new Date()));
  }, [datos]);

  // Drill-down desde las cards: deja activas solo esas bandas y baja a la grilla.
  function filtrarBandas(bandas) {
    setBandasActivas(new Set(bandas));
    const grilla = typeof document !== 'undefined' && document.getElementById('grilla-localidades');
    if (grilla) grilla.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function alternarBanda(banda) {
    setBandasActivas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(banda)) nuevo.delete(banda);
      else nuevo.add(banda);
      return nuevo.size === 0 ? new Set(ORDEN_BANDAS) : nuevo;
    });
  }

  return (
    <Layout title="Localidades">
      {cargando && <p>Cargando datos del tablero...</p>}
      {error && <p style={{ color: 'var(--cov-baja)' }}>No se pudieron cargar los datos: {error}</p>}

      {resumen && <ResumenGeneral r={resumen} onFiltrarBandas={filtrarBandas} />}

      <div style={{ marginBottom: 20 }}>
        <FilterBar>
          <Autocomplete
            items={itemsBusqueda}
            placeholder="Buscar localidad o departamento..."
            onQueryChange={setBusqueda}
            onSelect={(item) => router.push(`/localidades/${item.value}`)}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ORDEN_BANDAS.map((banda) => {
              const activa = bandasActivas.has(banda);
              const cfg = BANDA_COBERTURA[banda];
              return (
                <button
                  key={banda}
                  type="button"
                  onClick={() => alternarBanda(banda)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: `1.5px solid ${activa ? cfg.fg : 'var(--border)'}`,
                    background: activa ? cfg.bg : 'var(--bg-secondary)',
                    color: activa ? cfg.fg : 'var(--text-tertiary)',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TIPOS_MEDIO.map((tipo) => (
              <MedioFilterChip
                key={tipo.key}
                medio={tipo.label}
                estado={mediosEstado[tipo.key]}
                onChange={(nuevo) => setMediosEstado((actual) => ({ ...actual, [tipo.key]: nuevo }))}
              />
            ))}
          </div>
        </FilterBar>
      </div>

      {combinado && (
        <>
          <p id="grilla-localidades" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Mostrando {filtrados.length} de {combinado.length} localidades
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            {filtrados.map((l) => (
              <LocalidadCard
                key={l.localidad}
                localidad={l.localidad}
                departamento={l.departamento}
                bandaCobertura={l.bandaCobertura}
                totalTipos={l.totalTipos}
                ejePD={l.ejePD}
                tieneAudiovisuales={l.tieneAudiovisuales}
              />
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
