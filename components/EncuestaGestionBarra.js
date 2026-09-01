import { COLOR_GRUPO_GESTION, agruparGestion } from '../lib/encuestasLocalidades';
import EncuestaBarraApilada from './EncuestaBarraApilada';

// "Calificación de gestión" (Tipo_Pregunta=Imagen_Funcionario, clave
// "Gestión del X") -> barra apilada de 4 categorías (Positiva/Regular/
// Negativa/Ns-Nc). OJO: esto NO es "Aprobación de gestión" (ver
// EncuestaAprobacionGauge.js) — son preguntas distintas de la fuente.
//
// El SVG en sí (segmentos + número adentro/afuera con leader line, más el
// fix de colisión de etiquetas afuera) vive en EncuestaBarraApilada,
// compartido con EncuestaDirigentes — acá solo se arma `grupos` y se pasa la
// escala "grande" (usada en el Resumen, con su propia leyenda debajo).

export default function EncuestaGestionBarra({ etiqueta, categorias }) {
  const grupos = agruparGestion(categorias);
  const total = grupos.reduce((acc, g) => acc + g.pct, 0);
  if (total <= 0) return null;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{etiqueta}</div>
      <EncuestaBarraApilada grupos={grupos} colorPorGrupo={COLOR_GRUPO_GESTION} />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        {/* Sin porcentaje acá (cambio de criterio explícito del usuario): el
            número ya está en la barra, más grande — repetirlo en la leyenda
            era redundante. Vuelve a ser solo punto de color + nombre del
            grupo, igual que la leyenda de EncuestaDirigentes. */}
        {grupos.map(({ grupo }) => (
          <span
            key={grupo}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: COLOR_GRUPO_GESTION[grupo],
                display: 'inline-block',
              }}
            />
            {grupo}
          </span>
        ))}
      </div>
    </div>
  );
}
