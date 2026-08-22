---
name: procesar-contenido-organico-cordoba
description: Procesa el export acumulado de publicaciones de Contenido Orgánico / GNO del Gobierno de Córdoba (archivo "Publicaciones GNO 2026 - <fecha>.xlsx", hoja "Hoja 1") y regenera data/contenido_organico.json del Tablero de Comunicación. Usar cuando el usuario suba una nueva versión de ese archivo y pida procesarla, actualizar Contenido Orgánico/GNO, o sumar la nueva exportación. Igual que Pauta Digital y SMS, este export es un ACUMULADO COMPLETO cada vez, no append-only: cada corrida reprocesa el archivo entero.
---

# Procesar Contenido Orgánico (GNO) — Tablero de Comunicación, Gobierno de Córdoba

## Qué hace esta skill

Toma:
1. El **export completo nuevo** `Publicaciones GNO 2026 - <fecha>.xlsx` (nombre con fecha variable), hoja `Hoja 1` (`Hoja 2` viene vacía, se ignora). Columnas: `FECHA`, `RED SOCIAL`, `NOMBRE DEL CONTENIDO ` (con espacio final en el nombre real de la columna), `LINK ` (ídem), `LUGAR`.
2. El xlsx de las **60 localidades prioritarias** del tablero (`Contexto/Localidades (1).xlsx`), ya presente en el repo.

Y regenera `data/contenido_organico.json` completo desde cero — **no es append-only**: el archivo que sube el usuario reemplaza por completo al procesado la vez anterior (mismo patrón que Pauta Digital y SMS). Ver sección 3.5 de `Contexto/CONTEXTO_PROYECTO_TABLERO_COMUNICACION.md` para el detalle completo de las reglas de negocio — este documento es la referencia de esas reglas, no las repite todas.

## Antes de correr nada

1. **Colocar el archivo nuevo en `Contexto/`** con su nombre original (`Publicaciones GNO 2026 - <fecha>.xlsx`) y **borrar o archivar cualquier versión anterior** que quede en esa carpeta — `scripts/generar_datos.py` frena con error si encuentra más de un `Publicaciones*GNO*.xlsx` a la vez, justamente para evitar reprocesar por error una versión vieja junto a la nueva.
2. Confirmar que `Contexto/Localidades (1).xlsx` sigue siendo el mismo (60 localidades oficiales) — si el usuario avisa que cambió, revisar antes de correr.

## Qué NO hay que asumir (pausar y preguntar)

1. **Un nuevo token de `LUGAR` que no matchea** ni exacto/alias, ni por fuzzy (cutoff 0.85), ni está en la lista de exclusiones confirmadas hardcodeada (`EXCLUSIONES_LUGAR_GNO_CONFIRMADAS`) → el script lo deja logueado en `no_identificados` dentro de `data/contenido_organico.json`, **sin inventarle ninguna resolución**. A diferencia de SMS, acá **no hay fallback a Departamento**: si no matchea una de las 60, la publicación simplemente no aporta ninguna localidad (queda con `localidades: []` para ese token). Mostrarle la lista de `no_identificados` al usuario y esperar su clasificación antes de sumar nada nuevo a `ALIAS_LUGAR_GNO` o a `EXCLUSIONES_LUGAR_GNO_CONFIRMADAS`.
2. **Una fila con `LUGAR` conteniendo "http"** (error de carga, un link pegado ahí en vez del lugar real) → el script ya la trata como si `LUGAR` estuviera vacío y la loguea en `lugares_con_link_excluidos`. Si aparecen muchas de golpe (no solo 1-2 sueltas) puede ser señal de un problema más grande en cómo se está cargando la planilla — avisar al usuario en vez de asumir que es un caso aislado más.
3. **`LUGAR` combinando "Toda la provincia" con una localidad puntual en la misma celda** (ej. "Toda la provincia, Río Cuarto") → el script evalúa cada token de la celda por separado: "Toda la provincia" marca `ambito_provincial: true` (no se distribuye) y el resto de tokens se resuelven normalmente contra las 60. Esto es una extensión razonable de la regla de "separar por comas, evaluar cada token" (mismo criterio que ya aplican Pauta Digital y SMS para celdas multi-valor), confirmada con el usuario el 22/08/2026 a partir del único caso real detectado en esa fecha — si aparece un patrón distinto o mucho más frecuente, confirmar de nuevo antes de asumir que sigue aplicando igual.
4. **Cambia el patrón de filas de plantilla vacía a descartar** — hoy se descarta cualquier fila sin `RED SOCIAL`, sin `NOMBRE DEL CONTENIDO ` y sin `LINK ` (en cualquier posición del archivo, no solo al final; ver 3.5). Si aparece una fila real con datos pero que cae en este patrón (por ejemplo, un `LUGAR` cargado sin ningún otro dato), el script hoy la descartaría igual sin darse cuenta de que tenía contenido geográfico real — verificar antes de correr con un archivo nuevo que ninguna fila descartada tenga `LUGAR` cargado (`filas_descartadas_vacias` en el JSON de salida solo da el conteo, no el detalle; si hace falta auditar, correr un chequeo puntual contra el excel crudo).
5. **Falta alguno de los 2 archivos de entrada** (el export nuevo, o `Localidades (1).xlsx` si por algún motivo no está) → pedirlo explícitamente antes de correr `generar_datos.py`.

## Flujo de trabajo esperado

1. Usuario sube el nuevo `Publicaciones GNO 2026 - <fecha>.xlsx`.
2. Colocarlo en `Contexto/`, verificar que no quede ninguna versión anterior del mismo patrón de nombre en esa carpeta.
3. Correr `python3 scripts/generar_datos.py` desde la raíz del repo — regenera **todos** los JSON del tablero (localidades, medios tradicionales, pauta digital, audiovisuales, sms, **contenido orgánico**, campañas), no solo esta sección, porque es el mismo script único del proyecto.
4. Revisar la salida de consola: cantidad de publicaciones procesadas, tokens de `LUGAR` no identificados, coincidencias aproximadas (fuzzy) aplicadas, y filas con link pegado en `LUGAR`.
5. Si aparecen `no_identificados` → mostrárselos al usuario y preguntar cómo clasificarlos (¿es una localidad nueva que hay que sumar a `ALIAS_LUGAR_GNO`? ¿es un lugar real pero fuera de las 60, para sumar a `EXCLUSIONES_LUGAR_GNO_CONFIRMADAS`?). Una vez confirmados, sumarlos en `scripts/generar_datos.py` (sección "6. Contenido Orgánico (GNO)") para la próxima corrida, y volver a correr el script.
6. Entregar un resumen: cantidad de publicaciones, cuántas con localidad matcheada / ámbito provincial / sin lugar, tokens no identificados (si los hay) y cualquier corrección aplicada.

## Esquema de salida — `data/contenido_organico.json`

```
{
  "publicaciones": [
    {
      "fecha": "YYYY-MM-DD" | null,
      "red_social": str | null,           // valor crudo de RED SOCIAL, puede traer varias redes en una celda (ej. "FB GOBIERNO, FB MLL"); no se decompone en tokens
      "nombre_contenido": str | null,
      "link": str | null,                 // null si la celda está vacía o no contiene "http"
      "lugar_raw": str | null,            // valor crudo de LUGAR, tal cual vino
      "lugar_excluido_por_link": bool,     // true si LUGAR traía un link pegado (tratado como vacío)
      "ambito_provincial": bool,           // true si algún token de LUGAR era "Toda la provincia"
      "localidades": [str]                 // nombres oficiales (de las 60) que matcheó LUGAR; puede ser [] aunque ambito_provincial sea true, o aunque haya varias en la misma celda
    }
  ],
  "no_identificados": [ { "fila": int, "token": str, "lugar_original": str, "fecha": str } ],
  "fuzzy_aplicados": [ { "token_original": str, "matcheado_con": str } ],
  "lugares_con_link_excluidos": [ { "fila": int, "fecha": str, "red_social": str, "nombre_contenido": str, "lugar_raw": str } ],
  "filas_descartadas_vacias": int
}
```

`localidades` es una lista porque una publicación puede tener varios lugares en la misma celda de `LUGAR` (ej. "Carlos Paz, Malagueño" → 2 localidades). No hay ninguna cantidad numérica en esta área (a diferencia de `cantidad_sms_entregados` de SMS) — no hace falta ningún cuidado de deduplicación para un KPI al "explotar" una publicación en varias filas para la UI, porque no hay ningún número que se pueda inflar.

Este JSON está integrado en dos lugares de la UI: el panel de detalle de cada Localidad (bloque "Contenido Orgánico", después de SMS) y la pestaña propia "Contenido Orgánico" del nav (después de SMS, antes de Movimientos de la semana). **No entra en la vista de Campañas** — esa vista es Medios Tradicionales + Pauta Digital + Audiovisuales únicamente (ver sección 4 del CONTEXTO), Contenido Orgánico queda fuera a propósito.

## Lógica de matching — dónde vive

Toda la lógica (constantes `ALIAS_LUGAR_GNO`, `EXCLUSIONES_LUGAR_GNO_CONFIRMADAS`, `FUZZY_CUTOFF_GNO`, y las funciones `cargar_contenido_organico`, `_resolver_lugar_gno`, `_localizar_contenido_organico`) vive en `scripts/generar_datos.py`, sección "6. Contenido Orgánico (GNO)". No hay un test de regresión dedicado todavía (a diferencia de SMS y Pauta Digital) — si la lógica de matching crece en complejidad, considerar sumar uno.
