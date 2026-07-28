import { useMemo, useState } from 'react';
import Modal from './Modal';
import LineaTiempoMedios from './LineaTiempoMedios';
import { useApiData } from '../lib/useApiData';
import { normalizarTexto } from '../lib/texto';

const OPCIONES_SEMANAS = [2, 3, 4];

/**
 * Se monta solo cuando el modal está abierto (ver pages/localidades/[localidad].js)
 * a propósito: así el fetch de historico-medios (que va a crecer con cada
 * semana cargada) no se pide en cada visita a una localidad, solo cuando el
 * usuario realmente pide ver la línea de tiempo completa.
 */
export default function ModalLineaTiempoMedios({ localidad, semanasCargadas, onCerrar }) {
  const { cargando, error, datos } = useApiData(['/api/data/historico-medios']);
  const maximoDisponible = Math.min(4, semanasCargadas.length);
  const [semanasElegidas, setSemanasElegidas] = useState(maximoDisponible);

  const entrada = useMemo(() => {
    if (!datos) return null;
    const clave = normalizarTexto(localidad);
    return datos[0].localidades.find((l) => normalizarTexto(l.localidad) === clave) || null;
  }, [datos, localidad]);

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Línea de tiempo completa — ${localidad}`} anchoMax={760}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {OPCIONES_SEMANAS.map((n) => {
          const disponible = n <= semanasCargadas.length;
          const activo = semanasElegidas === n;
          return (
            <button
              key={n}
              type="button"
              disabled={!disponible}
              onClick={() => setSemanasElegidas(n)}
              title={disponible ? undefined : 'Disponible cuando haya más semanas cargadas'}
              style={{
                padding: '7px 14px',
                borderRadius: 999,
                border: `1.5px solid ${activo ? 'var(--accent)' : 'var(--border)'}`,
                background: activo ? '#e0edfb' : disponible ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                color: activo ? 'var(--accent)' : disponible ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: disponible ? 'pointer' : 'not-allowed',
              }}
            >
              {n} semanas
            </button>
          );
        })}
      </div>

      {cargando && <p style={{ fontSize: 13.5 }}>Cargando histórico...</p>}
      {error && (
        <p style={{ fontSize: 13.5, color: 'var(--cov-baja)' }}>No se pudo cargar el histórico: {error}</p>
      )}
      {datos && !entrada && (
        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
          No hay histórico cargado para esta localidad.
        </p>
      )}
      {entrada && <LineaTiempoMedios series={entrada.series} semanas={semanasElegidas} />}
    </Modal>
  );
}
