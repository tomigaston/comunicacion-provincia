import { crearHandlerDatosOpcional } from '../../../lib/datos';

// Mismo esquema vacío que devolvería generar_datos.py si nunca hubiera
// procesado ningún SMS_Looker*.xlsx — ver .claude/skills/procesar-sms-cordoba/SKILL.md.
const SMS_VACIO = {
  envios: [],
  no_identificados: [],
  excepciones_sin_resolver: [],
  fuzzy_aplicados: [],
  zonas_no_reconocidas: {},
};

export default crearHandlerDatosOpcional('sms.json', SMS_VACIO);
