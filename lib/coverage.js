// Escala Sin/Baja/Media/Alta con salto de matiz real (gris → rojo → ámbar → verde),
// no variaciones de un mismo tono — requisito de UX explícito.
export const BANDA_COBERTURA = {
  Sin: { fg: 'var(--cov-sin)', bg: 'var(--cov-sin-bg)', label: 'Sin cobertura' },
  Baja: { fg: 'var(--cov-baja)', bg: 'var(--cov-baja-bg)', label: 'Cobertura baja' },
  Media: { fg: 'var(--cov-media)', bg: 'var(--cov-media-bg)', label: 'Cobertura media' },
  Alta: { fg: 'var(--cov-alta)', bg: 'var(--cov-alta-bg)', label: 'Cobertura alta' },
};

export const ORDEN_BANDAS = ['Sin', 'Baja', 'Media', 'Alta'];
