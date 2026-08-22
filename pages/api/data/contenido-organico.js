import { crearHandlerDatosOpcional } from '../../../lib/datos';

// Mismo esquema vacío que devolvería generar_datos.py si nunca hubiera
// procesado ningún export de Contenido Orgánico (GNO) — ver
// .claude/skills/procesar-contenido-organico-cordoba/SKILL.md.
const CONTENIDO_ORGANICO_VACIO = {
  publicaciones: [],
  no_identificados: [],
  fuzzy_aplicados: [],
  lugares_con_link_excluidos: [],
  filas_descartadas_vacias: 0,
};

export default crearHandlerDatosOpcional('contenido_organico.json', CONTENIDO_ORGANICO_VACIO);
