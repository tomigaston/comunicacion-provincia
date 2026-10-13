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

    const coberturaPorClave = new Map(
      mediosData.localidades.map((l) => [normalizarTexto(l.localidad), l])
    );

    // Eje B (PD viva dirigida a la localidad + peor color de vencimiento),
    // independiente del eje A (banda MT). Ver calcularEjePDPorLocalidad().
    const ejePDPorLocalidad = calcularEjePDPorLocalidad(pautaData.piezas, isoDe(new Date()));

    return localidadesData.localidades.map((loc) => {
      const clave = normalizarTexto(loc.localidad);
      const cobertura = coberturaPorClave.get(clave);
      return {
        ...loc,
        bandaCobertura: cobertura ? cobertura.banda_cobertura : 'Sin',
        totalTipos: cobertura ? cobertura.total_tipos : 0,
        cobertura: cobertura ? cobertura.cobertura : {},
        ejePD: ejePDPorLocalidad.get(clave) || null,
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
      // AND entre grupos, OR dentro de cada grupo.
      // Cobertura MT: la banda de la localidad es una de las activas.
      if (!bandasActivas.has(l.bandaCobertura)) return false;
      // Tipo de medio MT: con alguno de los "✓" (OR) y sin ninguno de los "✕ Sin".
      const incluidos = TIPOS_MEDIO.filter((t) => mediosEstado[t.key] === 'incluir');
      const excluidos = TIPOS_MEDIO.filter((t) => mediosEstado[t.key] === 'excluir');
      if (incluidos.length > 0 && !incluidos.some((t) => l.cobertura[t.key])) return false;
      if (excluidos.some((t) => l.cobertura[t.key])) return false;
      // Pauta digital (eje B: viva + dirigida, D2): su categoría está entre las elegidas.
      if (pdActivos.size > 0 && !pdActivos.has(l.ejePD ? l.ejePD.color : 'sin')) return false;
      return true;
    });
  }, [combinado, busqueda, bandasActivas, mediosEstado, pdActivos]);

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
