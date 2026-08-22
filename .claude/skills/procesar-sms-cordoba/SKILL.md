---
name: procesar-sms-cordoba
description: Procesa el export acumulado de envíos de SMS del Gobierno de Córdoba (archivo "SMS_Looker - <fecha>.xlsx", con hojas Sms_Looker + Nomenclador Maestro) y regenera data/sms.json del Tablero de Comunicación. Usar cuando el usuario suba una nueva versión de ese archivo y pida procesarla, actualizar SMS, o sumar la nueva exportación. A diferencia de Medios tradicionales (append-only semanal), este export es un ACUMULADO COMPLETO cada vez — igual que Pauta digital — así que cada corrida reprocesa el archivo entero, no se "suma" fila por fila a lo anterior. No usar para el proyecto de Circuitos electorales (es otra base, aunque esta tenga una columna CIRCUITO).
---

# Procesar SMS — Tablero de Comunicación, Gobierno de Córdoba

## Qué hace esta skill

Toma:
1. El **export completo nuevo** `SMS_Looker - <fecha>.xlsx` (nombre con fecha variable). Trae 2 hojas — `Sms_Looker` (datos, una fila por envío) y `Nomenclador Maestro` (padrón de localidades por departamento de toda la provincia) — pero **solo se lee `Sms_Looker`**: desde el cambio de regla del **22/08/2026** (ver 3.4) `Nomenclador Maestro` ya no se usa para nada en el procesamiento, porque SMS ya no tiene ningún alcance de tipo Departamento y no hace falta resolver localidades fuera de las 60. Si el archivo no trajera esa segunda hoja, el script igual procesaría bien.
2. El xlsx de las **60 localidades prioritarias** del tablero (`Contexto/Localidades (1).xlsx`), ya presente en el repo.

Y regenera `data/sms.json` completo desde cero — **no es append-only**: el archivo que sube el usuario reemplaza por completo al procesado la vez anterior (mismo patrón que Pauta Digital, distinto al de Medios Tradicionales). Ver sección 3.4 de `Contexto/CONTEXTO_PROYECTO_TABLERO_COMUNICACION.md` para el detalle completo de las reglas de negocio — este documento es la referencia de esas reglas, no las repite todas.

## Antes de correr nada

1. **Colocar el archivo nuevo en `Contexto/`** con su nombre original (`SMS_Looker - <fecha>.xlsx`) y **borrar o archivar cualquier versión anterior** que quede en esa carpeta — `scripts/generar_datos.py` frena con error si encuentra más de un `SMS_Looker*.xlsx` a la vez, justamente para evitar reprocesar por error una versión vieja junto a la nueva.
2. Confirmar que `Contexto/Localidades (1).xlsx` sigue siendo el mismo (60 localidades oficiales) — si el usuario avisa que cambió, revisar antes de correr.

## Qué NO hay que asumir (pausar y preguntar)

1. **Un nuevo token de `AUDIENCIA` que no matchea** ni exacto, ni fuzzy (cutoff 0.7, contra las 60 solamente), ni está en la tabla de excepciones hardcodeada → desde el **22/08/2026** el script ya NO tiene ningún *fallback* a Departamento: el token queda sin ningún alcance. Se loguea en `no_identificados` dentro de `data/sms.json` para revisión manual **salvo que ya esté en `TOKENS_CONFIRMADOS_SIN_LUGAR_SMS`** (lista aparte, sumada el 22/08/2026 — ver "Lógica de matching" más abajo): esos 56 tokens ya fueron revisados y confirmados como "no es ninguna de las 60, no genera alcance", así que dejan de listarse para no tapar lo genuinamente nuevo en cada corrida (el export es acumulado completo, reaparecerían siempre). **No inventar una resolución nueva a mano** en el código sin que el usuario la confirme primero — mostrarle la lista de `no_identificados` al final de la corrida y esperar su clasificación; si confirma que un token nuevo tampoco es ninguna de las 60, se suma a `TOKENS_CONFIRMADOS_SIN_LUGAR_SMS` (no a `EXCEPCIONES_AUDIENCIA_SMS`, que es solo para tokens que SÍ resuelven a algo).
2. **Un valor de `ZONA` no reconocido** (no es `CAPITAL`/`CÓRDOBA`/`CAPITAL + PROVINCIA`/`PROVINCIA`) → el script ya lo trata como "sin desagregación geográfica" (conservador, no rompe nada) pero lo loguea en `zonas_no_reconocidas`. Revisar esa lista con el usuario: puede ser una `ZONA` genuinamente no geográfica (bien clasificada) o una variante nueva de una `ZONA` geográfica que haga falta sumar a `ZONAS_CAPITAL_SMS`/`ZONA_PROVINCIA_SMS`.
3. **`AUDIENCIA` = "DEPTO COMPLETO" combinado con otros tokens en la misma celda** (no como celda completa, ej. "CRUZ DEL EJE - DEPTO COMPLETO"): el caso cubierto explícitamente es solo cuando la celda entera es exactamente "DEPTO COMPLETO". Si aparece combinado con otro texto en la misma celda, el token "DEPTO COMPLETO" caerá por el camino genérico (probablemente termine en `no_identificados`, comportamiento seguro pero no necesariamente el deseado) — si se detecta este patrón en datos reales, pausar y confirmar con el usuario cómo interpretarlo antes de asumir una regla nueva.
4. **`AUDIENCIA` = "DEPTO COMPLETO" con la columna `DEPARTAMENTO` de la fila apuntando a algo distinto de Capital** → desde el 22/08/2026 esto ya no tiene ningún alcance posible (ya no hay nivel Departamento) y la fila pasa a "sin desagregación geográfica". En los datos reales, confirmado el 22/08/2026, las 12 filas con "DEPTO COMPLETO" son siempre de Capital — si aparece una de otro departamento, es un caso nuevo: confirmar con el usuario que "sin desagregación" es lo esperado antes de asumirlo en silencio.
5. **Una excepción hardcodeada que ya no resuelve** (ni exacto ni fuzzy contra las 60 — el script ya no marca esto con ningún Departamento: el token queda sin ningún alcance, y además queda registrada en `excepciones_sin_resolver` dentro de `data/sms.json` para verla de un vistazo sin tener que revisar envío por envío) → algo cambió respecto de cuando se armó la tabla de excepciones. Avisar al usuario, no inventar ningún alcance a mano por intuición.
6. **Falta alguno de los 2 archivos de entrada** (el export nuevo, o `Localidades (1).xlsx` si por algún motivo no está) → pedirlo explícitamente antes de correr `generar_datos.py`.

## Flujo de trabajo esperado

1. Usuario sube el nuevo `SMS_Looker - <fecha>.xlsx`.
2. Colocarlo en `Contexto/`, verificar que no quede ninguna versión anterior del mismo patrón de nombre en esa carpeta.
3. Correr `python3 scripts/generar_datos.py` desde la raíz del repo — regenera **todos** los JSON del tablero (localidades, medios tradicionales, pauta digital, audiovisuales, **sms**, campañas), no solo SMS, porque es el mismo script único del proyecto.
4. Revisar la salida de consola: cantidad de envíos procesados, tokens no identificados, coincidencias aproximadas (fuzzy) aplicadas, y `ZONA` no reconocidas.
5. Si aparecen `no_identificados`, `zonas_no_reconocidas` o `excepciones_sin_resolver` → mostrárselos al usuario y preguntar cómo clasificarlos (ver sección anterior). Una vez confirmados, sumarlos a `EXCEPCIONES_AUDIENCIA_SMS` (o a `ZONAS_CAPITAL_SMS`/`ZONA_PROVINCIA_SMS` según corresponda) en `scripts/generar_datos.py` para la próxima corrida, y volver a correr el script.
6. Antes de dar por cerrada la corrida, correr `python3 scripts/test_sms.py` (test de regresión sintético de la lógica de matching — no depende del archivo real, valida las funciones puras) y confirmar que pasa.
7. Entregar un resumen: cantidad de envíos, cuántos con alcance a nivel Localidad (y cuántos de esos son Capital vs. resto de las 60) / cuántos sin desagregación geográfica, tokens no identificados (si los hay) y cualquier corrección aplicada a la tabla de excepciones. Ya no hay nivel Departamento que reportar (ver cambio de regla del 22/08/2026 más abajo).

## Esquema de salida — `data/sms.json`

```
{
  "envios": [
    {
      "eje": str | null,
      "fecha_inicio": "YYYY-MM-DD" | null,
      "estado": str | null,              // tal cual viene de la columna ESTADO, sin recalcular
      "tematica": str | null,
      "categoria": str | null,
      "mensaje": str | null,
      "zona": str | null,                 // valor crudo de ZONA
      "audiencia_raw": str | null,        // valor crudo de AUDIENCIA, sin tokenizar
      "cantidad_sms_entregados": number | null,
      "circuito_raw": str | null,         // sin procesar, ver sección 3.4
      "sin_desagregacion_geografica": bool,
      "alcances": [
        { "tipo": "localidad", "departamento": str | null, "localidad": str, "matcheo": str }
      ]
    }
  ],
  "no_identificados": [ { "fila": int, "token": str, "audiencia_original": str, "eje": str, "fecha_inicio": str, "departamento_fila": str } ],
  "excepciones_sin_resolver": [ { "token_audiencia": str, "excepcion_apunta_a": str } ],
  "fuzzy_aplicados": [ { "token_original": str, "matcheado_con": str } ],
  "zonas_no_reconocidas": { "<ZONA cruda>": <cantidad de filas> }
}
```

**Desde el cambio de regla del 22/08/2026, `alcances` es siempre de tipo `"localidad"`** — ya no existe ningún alcance de tipo `"departamento"` (mismo criterio que Pauta Digital y Contenido Orgánico). `alcances` es una lista porque una sola fila puede "explotar" en varias localidades (ver excepción de 3 vías en 3.4) — o en **cero**, cuando el único token de `AUDIENCIA` es una excepción de tipo "excluir" (barrio, o lugar real confirmado que no es una de las 60), o cuando un token no matchea ninguna de las 60. Si **todos** los tokens de una fila terminan sin alcance así, `sin_desagregacion_geografica` pasa a `true` para esa fila (no queda nada geográfico que mostrar). `alcances` **nunca reparte `cantidad_sms_entregados`** entre sus elementos — ese número queda a nivel de la fila completa. `matcheo` documenta cómo se resolvió cada alcance (`zona_capital`, `capital_suelto`, `depto_completo_capital`, `exacto`, `excepcion`, `fuzzy`) — útil para auditar sin tener que releer el código.

Este JSON se consume desde `pages/api/data/sms.js`, la vista propia de SMS (`pages/sms.js`) y el panel de detalle de cada Localidad (`pages/localidades/[localidad].js`) — no es un dato huérfano. Esta skill se ocupa de dejar el dato procesado y correcto en `data/sms.json`; cambios de UI que consuman este esquema son un paso aparte, a coordinar con el usuario.

## Lógica de matching — dónde vive

Toda la lógica (constantes `EXCEPCIONES_AUDIENCIA_SMS`, `ZONAS_CAPITAL_SMS`, `ZONA_PROVINCIA_SMS`, `LOCALIDAD_CAPITAL_SMS`, `TOKENS_CONFIRMADOS_SIN_LUGAR_SMS`, y las funciones `cargar_sms`, `_resolver_token_audiencia`, `_resolver_nombre_localidad`, `_resolver_localidad_exacta`, `_dividir_audiencia`, `_token_confirmado_sin_lugar`) vive en `scripts/generar_datos.py`, sección "5. SMS". `scripts/test_sms.py` es la única fuente de verdad para probarla sin depender de un archivo real — cualquier cambio a esta lógica debe correr ese test antes de darse por bueno.

**`TOKENS_CONFIRMADOS_SIN_LUGAR_SMS`** (sumada el 22/08/2026) es distinta de `EXCEPCIONES_AUDIENCIA_SMS`: no resuelve nada, no genera ningún alcance nuevo (el token ya se comportaba bien por default — `_resolver_token_audiencia` devuelve `None`). Solo filtra qué entra al log `no_identificados` dentro de `cargar_sms()`. Úsala para un token que el usuario ya confirmó como "no es ninguna de las 60" (localidad real fuera de las 60, o segmento no geográfico tipo base de datos/rango etario) — así no vuelve a aparecer como pendiente de clasificar en la próxima corrida contra un archivo nuevo.
