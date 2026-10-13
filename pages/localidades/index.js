import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import FilterBar from '../../components/FilterBar';
import MedioFilterChip from '../../components/MedioFilterChip';
import Autocomplete from '../../components/Autocomplete';
import { ResumenGeneral } from '../../components/ResumenCards';
import LocalidadCard from '../../components/LocalidadCard';
import { useApiData } from '../../lib/useApiData';
import { slugificar } from '../../lib/texto';
import { ORDEN_BANDAS, BANDA_COBERTURA } from '../../lib/coverage';
import { combinarLocalidades, filtrarLocalidades } from '../../lib/filtrosLocalidades';
import { isoDe } from '../../lib/vencimientos';
import { resumenGeneral } from '../../lib/resumen';
import { TIPOS_MEDIO } from '../../lib/tiposMedio';

// Categorías del grupo "Pauta digital" (eje B de la cobertura): color de la próxima
// vencimiento de la pauta VIVA y DIRIGIDA a la localidad, o 'sin'.
const OPCIONES_PD = [
  { key: '🔴', label: 'Vence ≤3d 🔴', fg: 'var(--cov-baja)', bg: 'var(--cov-baja-bg)' },
  { key: '🟡', label: 'Vence 4–7d 🟡', fg: 'var(--cov-media)', bg: 'var(--cov-media-bg)' },
  { key: '🟢', label: 'Vigente >7d 🟢', fg: 'var(--cov-alta)', bg: 'var(--cov-alta-bg)' },
  { key: 'sin', label: 'Sin PD viva dirigida', fg: 'var(--cov-sin)', bg: 'var(--cov-sin-bg)' },
];

const etiquetaGrupo = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  marginBottom: 6,
};

export default function LocalidadesIndex() {
  const router = useRouter();
  const { cargando, error, datos } = useApiData([
    '/api/data/localidades',
    '/api/data/medios-tradicionales',
    '/api/data/pauta-digital',
  ]);

  const [busqueda, setBusqueda] = useState('');
  const [bandasActivas, setBandasActivas] = useState(new Set(ORDEN_BANDAS));
  // Grupo "Pauta digital": vacío = sin filtro; si hay opciones, OR entre ellas.
  const [pdActivos, setPdActivos] = useState(new Set());
  const [mediosEstado, setMediosEstado] = useState(() =>
    Object.fromEntries(TIPOS_MEDIO.map((m) => [m.key, 'off']))
  );

  const combinado = useMemo(() => {
    if (!datos) return null;
    const [localidadesData, mediosData, pautaData] = datos;
    return combinarLocalidades(localidadesData, mediosData, pautaData, isoDe(new Date()));
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
    return filtrarLocalidades(combinado, { busqueda, bandasActivas, mediosEstado, pdActivos });
  }, [combinado, busqueda, bandasActivas, mediosEstado, pdActivos]);

  const hayFiltros =
    bandasActivas.size !== ORDEN_BANDAS.length ||
    pdActivos.size > 0 ||
    Object.values(mediosEstado).some((e) => e !== 'off');

  function limpiarFiltros() {
    setBandasActivas(new Set(ORDEN_BANDAS));
    setPdActivos(new Set());
    setMediosEstado(Object.fromEntries(TIPOS_MEDIO.map((m) => [m.key, 'off'])));
  }

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

  function alternarPD(clave) {
    setPdActivos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });
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
          <div>
            <div style={etiquetaGrupo}>Cobertura MT</div>
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
          </div>
          <div>
            <div style={etiquetaGrupo}>Tipo de medio MT</div>
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
          </div>
          <div>
            <div style={etiquetaGrupo}>Pauta digital</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {OPCIONES_PD.map((op) => {
                const activa = pdActivos.has(op.key);
                return (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => alternarPD(op.key)}
                    aria-pressed={activa}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: `1.5px solid ${activa ? op.fg : 'var(--border)'}`,
                      background: activa ? op.bg : 'var(--bg-secondary)',
                      color: activa ? op.fg : 'var(--text-secondary)',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {op.label}
                  </button>
                );
              })}
            </div>
          </div>
        </FilterBar>
      </div>

      {combinado && (
        <>
          <p id="grilla-localidades" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Mostrando {filtrados.length} de {combinado.length} localidades
            {hayFiltros && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Limpiar filtros
                </button>
              </>
            )}
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
              />
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
