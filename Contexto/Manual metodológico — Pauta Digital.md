# Manual metodológico — Pauta Digital

Versión para validación del área · 26/10/2026 · reemplaza al borrador del 14/10/2026 (respaldado como `Manual metodológico — Pauta Digital (v14-10).md`)

## Para qué sirve este manual

Este manual explica qué cuenta como pauta digital activa en el tablero, qué filas de la planilla entran al tablero, a qué localidad llega cada una y por qué un número del tablero puede no coincidir con el conteo de la planilla.

Está escrito para quienes arman y mantienen la planilla de pauta digital (hoja `GLOBAL_ImportRange`). Cada regla trae la definición, la columna exacta que mira el tablero y cómo reproducirla con un filtro.

- **Estado del documento:** versión para validación del área.
- **Base de los ejemplos:** planilla del 23/10/2026 (`Pauta RRSS_GLOBAL.xlsx`, MD5 `33ab84dd4f71f86133d2a1c3ee5399e8`, 4.941 filas reales), con fecha de control 26/10/2026. Los números de 26/10 y 27/10 son iguales en esta carga. Dependen de esa fecha y de esa versión de la planilla.
- **Alcance:** solo Pauta Digital. Medios Tradicionales, Audiovisuales, SMS y Contenido Orgánico (GNO) tienen reglas propias.
- **Fuente congelada:** el histórico (`Medios_Digitales.xlsx`, hasta el 02/07) no se toca y no se describe acá. Es la única fuente que todavía muestra piezas con ámbito “departamento”.
- **Archivos que acompañan cada carga:** `Filas_no_procesadas_Pauta_Digital.xlsx` (qué filas no entraron y por qué), `Parejas_duplicadas_a_confirmar_por_el_area.xlsx` y `Nombres_a_confirmar_por_el_area.xlsx`.

## Glosario

Estos son los términos que se usan en todo el manual. El que más confunde es la diferencia entre **fila** (lo que cuenta la planilla) y **pieza-localidad** (lo que cuenta el tablero por dentro).

| Término | Qué significa |
| --- | --- |
| Planilla | La hoja `GLOBAL_ImportRange` del archivo `Pauta RRSS_GLOBAL.xlsx`. De ahí sale toda la pauta digital del tablero desde el 03/07/2026. |
| Fila | Cada renglón de la planilla. Cuando se habla de “filas” se habla de lo que cuentan ustedes en la planilla. |
| Fila real | Fila que tiene cargado CAMPAÑA o TITULO DE LA PIEZA. Si los dos están vacíos, es un renglón vacío o arrastrado y el tablero lo ignora. |
| Campaña | El nombre de la campaña (columna CAMPAÑA). Una campaña puede ocupar muchas filas y se cuenta una sola vez, sin distinguir mayúsculas ni tildes. Si CAMPAÑA está vacía se usa el título. |
| ESTADO | Lo que dice la columna ESTADO: ACTIVO, INACTIVO, OBSERVADO, PROGRAMADO o vacío. Lo calcula la planilla del área y el tablero lo toma tal cual. |
| INICIO y FIN | Fecha de comienzo y de fin de la pauta (columnas AA y AB). Tienen que ser fechas reales, no texto. |
| Fecha de control (“hoy”) | La fecha contra la que se comparan INICIO y FIN. En el tablero es el día en que se lo mira. Para verificar un número hay que fijar una fecha y usar siempre la misma (ver “Cómo reproducir” y la variable `PD_FECHA_CONTROL`). |
| Activa | Fila con ESTADO = ACTIVO cuyo período incluye la fecha de control: INICIO ≤ fecha ≤ FIN, con las dos fechas cargadas. |
| Las 60 | Las 60 localidades prioritarias, el universo fijo del tablero. Una localidad que no está entre ellas queda fuera del tablero. |
| Universo del tablero | Las filas que entran: de Córdoba y con uno de cuatro alcances (una localidad de las 60, un circuito de Capital, “TODAS LAS LOCALIDADES” de un departamento con alguna de las 60, o “TODAS LAS LOCALIDADES” de toda la provincia). |
| Alcance | Hasta dónde llega una pieza: una localidad, un circuito de Capital, las localidades de un departamento o toda la provincia. Se lee de las columnas DEPARTAMENTO y LOCALIDAD / SUBCIRCUITO. |
| Dirigida | Pauta que apunta a un lugar concreto: una localidad de las 60, un circuito de Capital o “TODAS LAS LOCALIDADES” de un departamento puntual. La pauta de toda la provincia no es dirigida. |
| COD. CONTENIDO | El código de la pieza. Es solo informativo: se guarda y se muestra, pero no decide si una fila entra, si es duplicada, si es nueva ni si se dio de baja. |
| Entrada | Lo que genera una fila en una localidad. Una fila de una localidad genera 1 entrada; una de toda la provincia, 60. |
| Pieza-localidad | Cuenta interna del tablero: cada entrada que queda después de unificar duplicados. Esta carga tiene 18.691 con 4.618 filas que entran. No sirve para comparar con la planilla. |
| Pieza | Combinación de CAMPAÑA + TITULO DE LA PIEZA (normalizados), sin importar en cuántas localidades aparezca. Es lo que mira el control de bajas. |
| Duplicada | Fila que perdió todas sus entradas porque otra fila es la misma pieza en las mismas localidades (ver Duplicados). |

## El camino de una fila

Para cada fila de la planilla, el tablero se hace cinco preguntas, en este orden. Si una respuesta corta el camino, la fila no sigue y queda registrada, con su motivo, en `Filas_no_procesadas_Pauta_Digital.xlsx`.

1. **¿Es una fila real?** CAMPAÑA o TITULO DE LA PIEZA cargados. Si no, se descarta.
2. **¿Es de Córdoba?** La columna DEPARTAMENTO contiene “Córdoba”. Si no, queda fuera del tablero.
3. **¿Está dentro del universo y a qué localidades llega?** Se mira LOCALIDAD / SUBCIRCUITO (y DEPARTAMENTO en un caso): una localidad de las 60, un circuito de Capital, “TODAS LAS LOCALIDADES” de un departamento o de toda la provincia. Cualquier otra cosa queda fuera.
4. **¿Es un duplicado?** Si en una localidad coincide con otra fila en CAMPAÑA, TITULO DE LA PIEZA, PLATAFORMA, INICIO, FIN, LINK MATERIAL, TIPO DE MATERIAL y AUDIENCIA, queda una sola.
5. **¿Está activa?** Se mira ESTADO, INICIO y FIN contra la fecha de control. Esto decide si cuenta en cobertura y alertas.

**Ejemplo con datos inventados.** Una fila con estos valores:

| Columna | Valor |
| --- | --- |
| CAMPAÑA | Campaña de ejemplo |
| TITULO DE LA PIEZA | Spot 1 |
| DEPARTAMENTO | Provincia de Córdoba, Argentina |
| LOCALIDAD / SUBCIRCUITO | TODAS LAS LOCALIDADES |
| ESTADO | ACTIVO |
| INICIO | 06/10/2026 |
| FIN | 20/10/2026 |

Con fecha de control 15/10/2026, el tablero la trata así:

- Es real, es de Córdoba y está dentro del universo.
- Llega a toda la provincia: se copia en las 60 localidades.
- Está activa: ACTIVO y el 15/10 cae entre el 06/10 y el 20/10.
- No es dirigida, porque es de toda la provincia.
- En la planilla cuenta como 1 fila y 1 campaña activa; en el tablero, como 60 piezas-localidad.
- No cuenta para la cobertura de ninguna localidad, pero sí entra en el mail de vencimientos cuando su FIN queda a 7 días o menos.

## Qué es pauta activa

Una campaña está activa cuando la planilla la marca como ACTIVO y la fecha de control cae dentro de su período. Según cuánto se exija hay tres niveles, y cada uno responde una pregunta distinta. Cada nivel es una parte del anterior.

| Nivel | La pregunta | Qué tiene que cumplir la fila | Filas (campañas) | Piezas-localidad |
| --- | --- | --- | --- | --- |
| 1. Con ESTADO activo | ¿La planilla la marca como activa? | `ESTADO` = ACTIVO | 1.261 (40) | 4.755 |
| 2. Activa | ¿Y además hoy está dentro de sus fechas? | Nivel 1 e `INICIO` ≤ fecha de control ≤ `FIN` | 1.258 (40) | 4.752 |
| 3. Activa dirigida | ¿Y además apunta a un lugar concreto? | Nivel 2 y alcance dirigido (ver Geografía) | 1.212 (37) | 1.994 |

Valores con la planilla del 23/10 y fecha de control 26/10/2026 (iguales al 27/10). Son las filas que el tablero muestra: no incluyen las 71 filas duplicadas. Contando también las duplicadas (lo que da el método con fórmulas de “Cómo reproducir”), los niveles son 1.275, 1.272 y 1.226 filas, con las mismas campañas (40, 40 y 37).

**Qué número usar.**

- Para decir cuánta pauta hay activa: nivel 2, contado en campañas.
- Para decir cuánta pauta llega a localidades concretas: nivel 3, contado en campañas.
- El nivel 1 es lo que muestran las pestañas Pauta Digital y Campañas como “Vigente”.

**Por qué los números del tablero no coinciden con los de la planilla.** Hay cuatro razones y las cuatro son normales:

- **Fila vs. pieza-localidad.** Una fila que llega a toda la provincia es 1 en la planilla y 60 en el tablero. Para comparar hay que contar filas o campañas, nunca piezas-localidad.
- **Filas fuera del universo.** 323 filas de esta carga no entran al tablero (2 fuera de Córdoba y 321 con una localidad que no es de las 60). Están listadas en `Filas_no_procesadas_Pauta_Digital.xlsx`.
- **ESTADO vs. fechas.** Una fila puede decir ACTIVO y tener el FIN vencido, porque la planilla todavía no recalculó. Al 26/10 hay 3 filas así: están en el nivel 1 pero no en el 2.
- **Activa vs. dirigida.** La pauta de toda la provincia está activa, pero no cuenta para la cobertura ni para el color de una localidad.

**Regla para informar un número:** decir siempre el nivel, la unidad (filas o campañas) y la fecha de control. “Hay 40 campañas activas al 26/10” se puede verificar; “hay 40 de pauta activa” no.

## Planilla y columnas que lee el tablero

El tablero lee la hoja `GLOBAL_ImportRange` del archivo `Pauta RRSS_GLOBAL.xlsx`, con los encabezados en la fila 1, y busca cada columna por su nombre exacto (con sus espacios). Si un encabezado cambia o falta, la actualización se corta y el aviso dice qué columna falta y, si existe con otros espacios, cómo viene escrita. El corte es parcial: los datos de otras áreas que se generan antes (localidades, Medios Tradicionales, movimientos, histórico) ya quedaron actualizados; los de Pauta Digital no se tocan. Una columna nueva se ignora sin aviso.

**Las columnas que deciden casi todo.** Si estas están bien cargadas, la fila se interpreta bien:

| Letra | Columna | Qué decide | Cómo tiene que estar cargada |
| --- | --- | --- | --- |
| A y B | `CAMPAÑA` y `TITULO DE LA PIEZA` | Si la fila es real, cómo se llama la campaña y si es duplicada | Texto. Alcanza con que una de las dos esté completa |
| E | `DEPARTAMENTO` | Si la fila es de Córdoba y, con “TODAS LAS LOCALIDADES”, qué departamento | Texto que contenga “Córdoba”, por ejemplo `DEPARTAMENTO CAPITAL, PROVINCIA DE CÓRDOBA, ARGENTINA` |
| F | `LOCALIDAD / SUBCIRCUITO` | Si la fila entra y a qué localidades llega | Uno de los formatos de la sección Geografía |
| AD | `ESTADO` | Si la pauta está activa, terminada, observada o programada | Una de estas palabras: ACTIVO, INACTIVO, OBSERVADO o PROGRAMADO |
| AA y AB | `INICIO ` y `FIN` | Si hoy está dentro del período | Fecha real de Excel, con formato dd/mm/aaaa. Nunca texto |
| G, L, Q, V | `AUDIENCIA  (Barrios o publicos) `, `PLATAFORMA`, `LINK MATERIAL`, `TIPO DE MATERIAL` | Junto con A, B, AA y AB, si dos filas son la misma pieza | Completas y distintas entre piezas distintas |

La tabla siguiente es la lista completa de columnas que el tablero lee, incluidas las opcionales.

| Letra | Encabezado exacto | Para qué se usa | ¿Hace falta? |
| --- | --- | --- | --- |
| A | `CAMPAÑA` | Nombre de la campaña; define si la fila es real; duplicados | Una de A o B |
| B | `TITULO DE LA PIEZA` | Título; sustituye a la campaña si esta falta; duplicados | Una de A o B |
| C, D | `EJE`, `MINISTERIO` | Se leen, no se muestran | Opcional |
| E | `DEPARTAMENTO` | Excluye lo que no es de Córdoba; define el departamento | Sí |
| F | `LOCALIDAD / SUBCIRCUITO` | Define si la fila entra y a qué localidad llega | Sí |
| G | `AUDIENCIA  (Barrios o publicos) ` (con dos espacios en el medio y uno al final) | Solo para detectar duplicados; no decide geografía | Recomendada |
| K | `COD. CONTENIDO` | Informativo: se guarda, no decide nada | Opcional |
| L | `PLATAFORMA` | Canal (Meta, Youtube, Google Ads…); duplicados | Opcional |
| N | `TIPO DE PAUTA` | Se muestra en el panel de localidad | Opcional |
| O | `ORIGEN` | Se lee, no se muestra | Sí (debe existir la columna) |
| Q | `LINK MATERIAL` | Enlace “Ver material”; duplicados | Opcional |
| R | `URL` | Link de destino; primera opción | Opcional |
| S | `UTM´S` (con tilde ´) | Link de destino si `URL` no trae un link válido | Opcional |
| V | `TIPO DE MATERIAL` | Solo para detectar duplicados | Recomendada |
| W, X, Y | `IG`, `FB`, `YT` | Enlaces por red; definen los canales del panel | Opcional |
| Z | `FECHA DE ENVÍO` | Desempate entre duplicados | Opcional |
| AA | `INICIO ` (con un espacio al final) | Inicio de la pauta | Sí, para ser activa |
| AB | `FIN` | Fin de la pauta | Sí, para ser activa |
| AD | `ESTADO` | Estado de la pieza | Sí; vacío queda como S/D |
| AF a BL | Métricas (de `Cobertura Planificada META` a `Hold rate Ejecutado (Truhplay)`), con `Inversión planificada ` e `Inversión ejecutada ` | Se leen; se comparan entre duplicados (nunca se suman) | Opcional |
| BN | `PROVEEDOR` | Se lee, no se muestra | Opcional |

Estas columnas existen y se leen, pero hoy no se muestran en ninguna pantalla: `EJE`, `MINISTERIO`, `ORIGEN`, `PROVEEDOR`, las de métricas (cobertura, impresiones, frecuencia, CPM, visualizaciones) y las de inversión planificada y ejecutada. Cargarlas o no no cambia lo que se ve.

El tablero no lee, entre otras, `UNIVERSO`, `CÓDIGO AGENCIA`, `CÓDIGO CONJUNTO DE ANUNCIOS`, `OBJETIVO DE CAMPAÑA`, `SOLICITADO POR`, `INICIO INFORMADO`, `FIN INFORMADO`, `DURACIÓN` ni `OBSERVACIONES`. En particular, `INICIO INFORMADO` y `FIN INFORMADO` no se usan como respaldo de `INICIO` y `FIN`.

**Celdas que el tablero lee como vacías.** Además de una celda sin nada, el tablero toma como vacía una celda que diga exactamente `NA`, `N/A`, `null`, `None`, `nan` o `#N/A`, en cualquier columna. Una celda con solo un espacio, un guion o un punto, en cambio, cuenta como cargada.

Las letras son las del archivo de la carga del 23/10 (77 columnas, hasta BY). Si se inserta una columna, las letras se corren; lo que vale es el nombre.

## Qué es una fila real y cuáles quedan fuera

Una fila es real si tiene CAMPAÑA o TITULO DE LA PIEZA cargados. Ninguna otra columna sirve para decidirlo.

| Caso | Qué pasa | Filas en la carga del 23/10 |
| --- | --- | --- |
| Renglón sin ningún valor (solo formato) | Se descarta | 45.558 (la hoja llega a la fila 50.500; las filas reales son de la 2 a la 4.942) |
| CAMPAÑA y TITULO DE LA PIEZA vacíos, con otras columnas cargadas | Se descarta como arrastre | 0 |
| DEPARTAMENTO vacío o sin la palabra “Córdoba” | Fuera del tablero | 2 (filas 1147 y 1148: Santa Fe y Entre Ríos, ambas INACTIVO) |
| Localidad que no es de las 60 | Fuera del tablero | 321 (160 nombres distintos) |
| “TODAS LAS LOCALIDADES” de un departamento sin ninguna de las 60 | Fuera del tablero | 0 |
| LOCALIDAD / SUBCIRCUITO vacía | Pendiente: no se puede ubicar | 0 |
| Fila repetida para las mismas localidades | Duplicada: pierde todas sus entradas (ver Duplicados) | 71 |

Una celda de CAMPAÑA o TITULO con solo un espacio o un guion cuenta como cargada: la fila se procesaría como real. Cada fila que no entra queda en `Filas_no_procesadas_Pauta_Digital.xlsx` con su número de fila, sus datos y un motivo que dice qué corregir si correspondía que entrara.

## Geografía: qué filas entran y a qué localidad llegan

El tablero decide la geografía de cada fila con solo dos columnas, DEPARTAMENTO (E) y LOCALIDAD / SUBCIRCUITO (F), evaluándolas en este orden. La primera condición que se cumple define el resultado. Solo cuatro resultados entran al tablero; el resto queda fuera.

**Cómo se resuelve en la práctica.** Casi siempre alcanza con mirar la columna F. Si empieza con un número, es un circuito de Capital. Si dice exactamente “TODAS LAS LOCALIDADES”, se mira la columna E para saber si es toda la provincia o un departamento. En cualquier otro caso, F trae el nombre de una localidad y se busca en la lista de las 60: si no está, la fila queda fuera.

| # | Qué dice la planilla | Resultado | ¿Dirigida? | Filas → entradas → piezas-localidad |
| --- | --- | --- | --- | --- |
| 1 | E sin “Córdoba” | Fuera del tablero | No aplica | 2 → 0 |
| 2 | F vacío | Pendiente: fuera del tablero | No aplica | 0 |
| 3 | F empieza con 3 o 4 dígitos, letra opcional y guion (por ejemplo `010A - CABILDO…` o `0010 - BELLA VISTA`) | Circuito de Capital: va a CÓRDOBA | Sí | 473 → 473 → 441 |
| 4 | F = “TODAS LAS LOCALIDADES” y E con un departamento puntual que tiene localidades de las 60 | Una pieza por cada localidad de las 60 de ese departamento | Sí | 2.207 → 4.973 → 4.962 |
| 5 | F = “TODAS LAS LOCALIDADES” y E es un departamento sin ninguna de las 60 | Fuera del tablero | No aplica | 0 |
| 6 | F = “TODAS LAS LOCALIDADES” y E = “Provincia de Córdoba, Argentina” | Una pieza en cada una de las 60 | No | 195 → 11.700 → 11.574 |
| 7 | El texto de F antes de la primera coma es una de las 60 (con los alias de abajo) | Esa localidad | Sí | 1.743 → 1.743 → 1.714 |
| 8 | F es otra localidad que no está entre las 60 | Fuera del tablero | No aplica | 321 → 0 |

La diferencia entre entradas y piezas-localidad son las 198 entradas unificadas por duplicado.

Reglas finas que conviene respetar al cargar:

- **El texto “TODAS LAS LOCALIDADES” se compara literal.** Debe ir en mayúsculas y sin variantes (solo se ignoran espacios al principio o al final). “Todas las localidades” no se reconoce: la fila queda fuera por localidad.
- **El match por nombre es exacto, sin tildes ni mayúsculas.** Nombres parecidos no cuentan (Villa de Soto no es Villa del Totoral).
- **Alias reconocidos (los únicos):** `CÓRDOBA CAPITAL` es CÓRDOBA (424 filas en esta carga); `VILLA SANTA ROSA DE RIO` es VILLA SANTA ROSA, solo cuando DEPARTAMENTO es Río Primero (14 filas: 5 ACTIVO, 9 INACTIVO). No se aplican alias por parecido.
- **Solo se lee lo anterior a la primera coma de F.** `SAN FRANCISCO, DEPARTAMENTO SAN JUSTO, …` se atribuye a SAN FRANCISCO.
- **E no se valida contra F.** Una localidad de las 60 con el departamento equivocado en E igual se atribuye a esa localidad.
- **Los circuitos de 2 dígitos no se reconocen** como circuito: la fila queda fuera por localidad.
- **Una localidad que no es de las 60 queda fuera del tablero.** No se atribuye a su departamento ni aparece en ninguna pantalla; figura en `Filas_no_procesadas_Pauta_Digital.xlsx` (hoja Fuera_del_universo) y su nombre en `Nombres_a_confirmar_por_el_area.xlsx`.
- **El “DE” del departamento se ignora.** En E el departamento puede venir como `DEPARTAMENTO COLÓN` o como `DEPARTAMENTO DE COLÓN`: el tablero trata las dos igual. Los nombres de departamento se comparan sin tildes ni mayúsculas.

Ejemplos reales: una fila “TODAS LAS LOCALIDADES” con “Provincia de Córdoba, Argentina” genera 60 piezas, una por localidad; una fila “TODAS LAS LOCALIDADES” del Departamento Presidente Roque Sáenz Peña genera 1, porque ese departamento tiene solo Laboulaye entre las 60. Las métricas de una fila se repiten completas en cada localidad que alcanza; no se reparten.

## Estado y fechas

El estado sale directo de la columna ESTADO (AD) y no se recalcula con las fechas. Solo una fila con ESTADO = ACTIVO puede ser activa.

| ESTADO en la planilla | El tablero lo muestra como | ¿Puede ser activa? | Filas reales | Filas que entran | Piezas-localidad |
| --- | --- | --- | --- | --- | --- |
| ACTIVO | Vigente | Sí, si además `INICIO` ≤ hoy ≤ `FIN` | 1.293 | 1.275 | 4.755 |
| INACTIVO | Finalizada | No | 2.568 | 2.266 | 10.343 |
| OBSERVADO | Observada | No, aunque tenga fechas en curso | 1.071 | 1.068 | 3.053 |
| PROGRAMADO | Programada | No: todavía no empezó | 0 | 0 | 0 |
| Vacío | S/D (sin dato) | No | 9 (filas 954 a 962) | 9 | 540 |
| Cualquier otro valor | Se muestra tal cual | No; se avisa en la actualización | 0 | 0 | 0 |

Las mayúsculas, minúsculas y tildes de ESTADO no importan. “Filas que entran” ya descuenta las 323 que quedan fuera del universo; las piezas-localidad descuentan además los duplicados.

Reglas de las fechas:

- **Solo cuentan `INICIO` (AA) y `FIN` (AB).** No hay respaldo en `INICIO INFORMADO` ni `FIN INFORMADO`.
- **Tienen que ser fechas reales de Excel.** Una fecha real queda guardada como número y se muestra con formato de fecha. Un texto que solo parece una fecha (por ejemplo, pegado desde un mail o un PDF) el tablero lo lee con el mes primero cuando la fecha es ambigua: “05/10/2026” se leería como 10 de mayo. Si no es ambigua (“25/10/2026”), la lee bien. Se detecta porque se alinea a la izquierda o porque `=ESNUMERO(AA2)` da FALSO. En la carga del 23/10 no había ninguna.
- **Sin `INICIO` o sin `FIN` la fila no es activa:** no entra en cobertura, color ni alertas. En la carga del 23/10 hay 992 filas sin ninguna de las dos (601 OBSERVADO, 382 INACTIVO y 9 con ESTADO vacío) y 2 con una sola (filas 2714 y 2825, OBSERVADO). Ninguna ACTIVO.
- **INICIO posterior a hoy:** la fila no es activa todavía.
- **ACTIVO con FIN ya vencido:** figura como Vigente pero no es activa. Al 26/10 son 3 filas. Se corrige cuando la planilla recalcula ESTADO.
- **PROGRAMADO con INICIO ya pasado:** queda como Programada y no cuenta como activa hasta que ESTADO cambie en la planilla. En esta carga no hay filas PROGRAMADO.

**Dos relojes.** ESTADO se calcula en la planilla del área y el tablero lo copia el día de la descarga (la carga actual es del 23/10). Las fechas INICIO y FIN, en cambio, se comparan contra el día en que alguien mira el tablero. Por eso una fila con ESTADO = ACTIVO puede estar activa hoy y dejar de estarlo en tres días, aunque nadie toque la planilla.

**Ejemplos con datos inventados.** Con fecha de control 15/10/2026:

| ESTADO | INICIO | FIN | ¿Está activa? | Por qué |
| --- | --- | --- | --- | --- |
| ACTIVO | 01/10/2026 | 31/10/2026 | Sí | El 15/10 está entre INICIO y FIN |
| ACTIVO | 01/09/2026 | 10/10/2026 | No | El FIN ya pasó. Sigue como “Vigente” en las pestañas hasta que la planilla recalcule |
| ACTIVO | 01/10/2026 | vacío | No | Falta FIN |
| ACTIVO | 20/10/2026 | 30/10/2026 | No | Todavía no empezó |
| PROGRAMADO | 12/10/2026 | 19/10/2026 | No | ESTADO no es ACTIVO, aunque el INICIO ya pasó |
| OBSERVADO | 01/10/2026 | 31/10/2026 | No | ESTADO no es ACTIVO |

**Cómo comprobar que una fecha es una fecha.** Una fecha real se alinea a la derecha de la celda. En una celda libre, `=ESNUMERO(AA2)` da VERDADERO si es fecha y FALSO si es texto. Si da FALSO, hay que volver a escribirla con formato dd/mm/aaaa.

## Duplicados

El tablero compara **entradas** (una por cada localidad que alcanza la fila), después de repartir la geografía. Dos entradas son la misma pieza si, en la misma localidad, coinciden en **CAMPAÑA, TITULO DE LA PIEZA, PLATAFORMA, INICIO, FIN, LINK MATERIAL, TIPO DE MATERIAL y AUDIENCIA**.

Cómo se comparan:

- Sin distinguir mayúsculas ni tildes, sin espacios al principio o al final y con los espacios repetidos contados como uno.
- INICIO y FIN se comparan como fechas.
- Una celda vacía coincide con otra vacía (pero no con una cargada).
- `COD. CONTENIDO` no se mira: dos filas con códigos distintos pueden ser la misma pieza, y una sin código se compara igual que las demás.

Si hay duplicados, se conserva una entrada con este orden de desempate:

1. La entrada **dirigida** (localidad, circuito o departamento) antes que la que llega por “TODAS LAS LOCALIDADES” de toda la provincia.
2. La de `FECHA DE ENVÍO` más reciente.
3. Si empatan, la que tenga ESTADO = ACTIVO.
4. Si siguen empatadas, la primera que aparece en la planilla.

Las métricas nunca se suman: la entrada que queda conserva las suyas y las de la otra se descartan.

Una fila es **duplicada** solo si perdió todas sus entradas. Una fila de toda la provincia que coincide con otra en algunas localidades pierde solo esas entradas y sigue en el tablero en el resto.

**Resultado de la carga del 23/10:** 188 grupos de duplicados, 198 entradas descartadas y 71 filas duplicadas (15 filas más perdieron solo algunas entradas). Por qué quedó cada una: primera de la planilla en 131 casos, entrada dirigida antes que provincial en 66 y ESTADO = ACTIVO en 1. Agrupadas por filas son 134 parejas: en 116 las métricas son distintas y en 18 son iguales. Esas parejas van en `Parejas_duplicadas_a_confirmar_por_el_area.xlsx` para que el área confirme si son la misma pieza cargada dos veces o piezas distintas que hay que diferenciar en alguna de esas columnas.

## Control de bajas entre cargas

Antes de publicar una carga nueva, el tablero compara las piezas (CAMPAÑA + TITULO DE LA PIEZA, normalizados como en Duplicados) de la carga anterior que siguen dentro del universo con las de la carga nueva. Si una pieza desaparece, la actualización se corta para que nadie pierda datos sin darse cuenta. El código de la pieza no interviene: que una pieza cambie de COD. CONTENIDO (por ejemplo, de un código provisional a uno definitivo) no es una baja.

Las piezas que la carga anterior tenía fuera del universo actual (por ejemplo, las que eran “solo departamento”) no cuentan como baja: se informan en la hoja “Salidas por cambio de regla” del archivo de filas no procesadas. En la carga del 23/10 hubo 0 bajas y 236 salidas por cambio de regla.

## Alertas: semáforo, cobertura y mail

La alerta de pauta digital mide cuánto falta para que termine, no cuánto hace que empezó. Medios Tradicionales usa antigüedad (30 y 50 días) porque su pauta dura mucho más.

**Semáforo de una pieza activa**

| Color | Cuándo |
| --- | --- |
| Rojo | Vence en 0 a 3 días |
| Amarillo | Vence en 4 a 7 días |
| Verde | Vence en más de 7 días |
| Sin color | No es activa: Observada, Programada, Finalizada o sin fechas |

Los días son `FIN` menos hoy. Ejemplo: si FIN es el 20/10 y hoy es el 15/10, faltan 5 días y la pieza queda en amarillo. El rojo dice “hay que renovar”, no “no hay pauta”, por eso se acompaña con las campañas que siguen al aire.

**Cobertura y color de una localidad**

- Cuenta solo la pauta activa y dirigida. La provincial genérica no pinta la localidad ni cuenta como cobertura.
- El color de la localidad es el peor entre los ejes que aplican. Medios Tradicionales y Pauta Digital son dos ejes y nunca se fusionan en un número único.
- “Sin cobertura” significa cero Medios Tradicionales activos y cero pauta digital que cuenta. Al 26/10, las 60 localidades tienen pauta digital activa dirigida (3 en rojo, 2 en amarillo, 55 en verde) y ninguna está sin cobertura.

**Mail de vencimientos**

- Incluye las piezas activas cuyo `FIN` cae entre hoy y dentro de 7 días.
- Incluye la pauta provincial, a diferencia de la cobertura.
- Agrupa por campaña y fecha de `FIN`: una línea por cada combinación. Al 26/10 son 15 líneas (ventana del 26/10 al 02/11).

**Dos universos distintos, a propósito.** “Activas dirigidas” mide alcance en las localidades. “Vencen esta semana” mide el trabajo de renovación. La segunda no es un subconjunto de la primera.

## Qué fila aparece en qué pantalla

Una fila puede estar en el tablero y aun así no contar en la cobertura. La tabla resume dónde entra cada tipo.

| Tipo de fila | Panel de localidad | Cobertura y color | Pestaña Pauta Digital | Campañas | Mail |
| --- | --- | --- | --- | --- | --- |
| Fuera de Córdoba, fuera del universo (localidad fuera de las 60), pendiente o arrastre | No | No | No | No | No |
| Duplicada (perdió todas sus entradas) | No | No | No | No | No |
| Dirigida y activa | Sí | Sí | Sí | Sí | Sí, si FIN en 7 días |
| Dirigida, no activa (Finalizada, Observada, ACTIVO con FIN vencido) | Sí, con etiqueta | No | Sí | Sí | No |
| Dirigida y Programada | Sí, en un bloque aparte | No | Sí | Sí | No |
| Provincial genérica y activa | Sí, en las 60 | No | Sí | Sí | Sí, si FIN en 7 días |
| Provincial genérica, no activa | Sí, en las 60 | No | Sí | Sí | No |
| Sin fechas | Solo si el período es “Todo” | No | Solo si el período es “Todo” | Sí | No |
| Sin COD. CONTENIDO | Igual que las demás | Igual | Igual | Igual | Igual |

El panel de una localidad lista todas las piezas, en cualquier estado, y arriba muestra una tarjeta con solo las activas dirigidas. En Córdoba la tabla tiene 1.146 piezas y la tarjeta 171. No es un error: miden cosas distintas.

La pestaña Pauta Digital y Campañas muestran “Vigente” solo por ESTADO = ACTIVO, sin mirar las fechas: es el nivel “Con ESTADO activo”. Por eso pueden mostrar más “Vigente” (4.755 piezas-localidad) que las tarjetas (4.752 activas). No es un error: son dos niveles distintos y el manual los nombra por separado.

## Cómo reproducir un número del tablero

Para llegar al mismo número que el tablero hay que trabajar sobre una copia de la planilla, fijar una fecha y marcar cada fila con unas columnas auxiliares. Son seis pasos. Las funciones se llaman igual en Excel y en Google Sheets en español.

**Antes de empezar: tres reglas de oro**

1. **Trabajar siempre sobre una copia.** Copiar la hoja `GLOBAL_ImportRange` a un archivo aparte y pegarla como valores (Pegado especial, solo valores). No agregar columnas en la original: se alimenta sola con `IMPORTRANGE` y se rompería.
2. **Usar la misma versión de la planilla que el tablero.** El tablero tiene la carga del 23/10. Si la planilla del área cambió después, los números van a ser distintos aunque las reglas estén bien aplicadas.
3. **Fijar una fecha de control.** Escribirla en una celda y usar esa celda en las fórmulas, no `HOY()`. Del lado del tablero, quien genera los datos puede fijar la misma fecha con la variable de entorno `PD_FECHA_CONTROL` en formato aaaa-mm-dd (por ejemplo `PD_FECHA_CONTROL=2026-10-26 python3 scripts/generar_datos.py`); sin la variable, el tablero usa la fecha del día. Es la única forma de fijarla.

**Paso 1. Preparar la copia**

En la copia, escribir en la celda `CI1` el texto “Fecha de control” y en `CJ1` la fecha, por ejemplo 26/10/2026 (con formato fecha). Crear una hoja nueva llamada `Las60` con las 60 localidades en la columna A, una por celda, más los alias `CÓRDOBA CAPITAL` y `VILLA SANTA ROSA DE RIO` (este último vale solo para filas del departamento Río Primero; en esta carga las 14 lo son). La lista oficial está en `Localidades (1).xlsx` y también en la hoja “Las 60 (lista oficial)” de `Nombres_a_confirmar_por_el_area.xlsx`. Escribir los nombres tal como figuran en la planilla: el tablero ignora las tildes, pero Excel no.

Para descontar las filas duplicadas, crear una hoja `Duplicadas` y pegar en la columna A los números de fila de la hoja Duplicadas de `Filas_no_procesadas_Pauta_Digital.xlsx` donde “¿La fila descartada perdió todas sus entradas?” dice “Sí” (71 filas en esta carga).

**Paso 2. Agregar siete columnas auxiliares**

La planilla llega hasta la columna BY, así que se usan `CA` a `CG`. Escribir el título en la fila 1 y la fórmula en la fila 2, y después copiarla hacia abajo hasta la última fila real (la 4942 en la carga del 23/10).

| Columna | Título | Fórmula (fila 2) | Qué devuelve |
| --- | --- | --- | --- |
| CA | Real | `=SI(O(A2<>"";B2<>"");1;0)` | 1 si CAMPAÑA o TITULO están cargados |
| CB | Córdoba | `=SI(ESNUMERO(HALLAR("CORDOBA";SUSTITUIR(SUSTITUIR(E2;"Ó";"O");"ó";"o")));1;0)` | 1 si DEPARTAMENTO contiene “Córdoba” |
| CC | Activa | `=SI(Y(ESPACIOS(AD2)="ACTIVO";ESNUMERO(AA2);ESNUMERO(AB2);AA2<=$CJ$1;AB2>=$CJ$1);1;0)` | 1 si ESTADO es ACTIVO y la fecha de control está entre INICIO y FIN |
| CD | Geografía | (fórmula de abajo) | Circuito, Provincial, Todas del departamento, Localidad de las 60 o Fuera del universo |
| CE | Entra | `=SI(Y(CA2=1;CB2=1;CD2<>"Fuera del universo";NO(ESNUMERO(COINCIDIR(FILA();Duplicadas!$A:$A;0))));1;0)` | 1 si la fila está en el tablero (real, de Córdoba, dentro del universo y no duplicada) |
| CF | Dirigida | `=SI(O(CD2="Circuito";CD2="Todas del departamento";CD2="Localidad de las 60");1;0)` | 1 si el alcance es dirigido |
| CG | Vence en 7 días | `=SI(Y(CC2=1;AB2>=$CJ$1;AB2<=$CJ$1+7);1;0)` | 1 si es activa y su FIN cae entre la fecha de control y 7 días después |

Fórmula de la columna CD (escribirla entera en una sola celda):

```
=SI(ESNUMERO(VALOR(IZQUIERDA(F2;1)));"Circuito";SI(IGUAL(ESPACIOS(F2);"TODAS LAS LOCALIDADES");SI(IZQUIERDA(ESPACIOS(E2);12)="DEPARTAMENTO";"Todas del departamento";"Provincial");SI(CONTAR.SI(Las60!$A:$A;SI(ESNUMERO(HALLAR(",";F2));IZQUIERDA(F2;HALLAR(",";F2)-1);F2))>0;"Localidad de las 60";"Fuera del universo")))
```

Cómo se lee: si F empieza con un número, es un circuito. Si dice exactamente “TODAS LAS LOCALIDADES”, es del departamento cuando E empieza con “DEPARTAMENTO” y provincial si no. En cualquier otro caso se toma el texto de F antes de la primera coma y se busca en la hoja `Las60`; si no está, la fila queda fuera del universo. `IGUAL` distingue mayúsculas, igual que el tablero. Con estos datos, “empieza con un número” equivale al formato de circuito (las 473 filas que empiezan con un número son circuitos válidos). Dos casos que la fórmula no distingue y el tablero sí: un circuito de 2 dígitos (el tablero lo deja fuera) y “TODAS LAS LOCALIDADES” de un departamento sin ninguna de las 60 (el tablero lo deja fuera). En esta carga no hay ninguno de los dos.

Las columnas AUDIENCIA (G), PLATAFORMA (L), LINK MATERIAL (Q) y TIPO DE MATERIAL (V) no hacen falta para estos conteos: solo sirven para reconocer duplicados, que ya vienen marcados en la hoja `Duplicadas`. Para revisar una pareja a mano, comparar esas cuatro columnas más CAMPAÑA, TITULO DE LA PIEZA, INICIO y FIN, sin mirar mayúsculas, tildes ni espacios de más.

**Paso 3. Comprobar las fechas**

En una celda libre escribir `=SUMAPRODUCTO(--ESNUMERO(AA2:AA4942))` y en otra `=CONTARA(AA2:AA4942)`. Tienen que dar el mismo número. Si la segunda es mayor, hay fechas escritas como texto y esas filas no se van a contar como activas. Repetir con la columna AB.

**Paso 4. Contar filas**

| Qué contar | Fórmula | Con fecha de control 26/10 | Con fecha de control 27/10 |
| --- | --- | --- | --- |
| Filas con ESTADO activo | `=CONTAR.SI.CONJUNTO(CE:CE;1;AD:AD;"ACTIVO")` | 1.261 | 1.261 |
| Filas activas | `=CONTAR.SI.CONJUNTO(CE:CE;1;CC:CC;1)` | 1.258 | 1.258 |
| Filas activas dirigidas | `=CONTAR.SI.CONJUNTO(CE:CE;1;CC:CC;1;CF:CF;1)` | 1.212 | 1.212 |

Si no se arma la hoja `Duplicadas` (y CE solo mira real, Córdoba y universo), los conteos dan 1.275, 1.272 y 1.226: son las mismas filas más las 71 duplicadas. La primera fórmula no ignora los espacios sobrantes: si una celda de ESTADO dice “ACTIVO ” con un espacio al final, no la cuenta.

**Paso 5. Contar campañas**

Insertar una tabla dinámica sobre la copia. Filtros: `Entra` = 1 y `Activa` = 1. Para las dirigidas, agregar `Dirigida` = 1. Poner `CAMPAÑA` en las filas. El número de campañas es la cantidad de filas de la tabla, sin contar el “Total general”. Esperado: 40 campañas activas y 37 activas dirigidas, en las dos fechas.

- Si aparece una fila “(en blanco)”, son filas sin CAMPAÑA: el tablero las cuenta usando el título como nombre.
- Dos nombres que difieren solo por mayúsculas o por una tilde, la tabla dinámica puede separarlos y el tablero los cuenta como uno. Unificarlos a mano antes de contar.

**Paso 6. Contar las líneas del mail de vencimientos**

Nueva tabla dinámica. Filtros: `Entra` = 1 y `Vence en 7 días` = 1. Poner `CAMPAÑA` y `FIN` en las filas. Cada combinación distinta de campaña y fecha de FIN es una línea del mail. No se filtra por geografía: entra también la pauta de toda la provincia. Esperado: 15 líneas con fecha de control 26/10 y 15 con 27/10 (77 filas).

**Números de control**

| Qué se cuenta | 26/10 | 27/10 |
| --- | --- | --- |
| Filas reales | 4.941 | 4.941 |
| Filas que entran al tablero (sin duplicadas) | 4.547 | 4.547 |
| Filas con ESTADO activo | 1.261 | 1.261 |
| Filas activas | 1.258 | 1.258 |
| Filas activas dirigidas | 1.212 | 1.212 |
| Campañas activas | 40 | 40 |
| Campañas activas dirigidas | 37 | 37 |
| Líneas del mail de vencimientos | 15 | 15 |

Todos con la planilla del 23/10. El tablero cuenta además piezas-localidad (4.752 activas y 1.994 dirigidas el 26/10): no se pueden reproducir con estas fórmulas porque exigen repartir cada fila entre las localidades que alcanza. Para comparar con el tablero se usan filas y campañas.

**Si un número no coincide, revisar en este orden:**

1. La fecha de control (`CJ1`) es la del día que se quiere verificar.
2. La planilla es la misma versión que la del tablero (carga del 23/10).
3. Las fechas de INICIO y FIN son fechas reales (Paso 3).
4. No hay espacios sobrantes en ESTADO, DEPARTAMENTO ni LOCALIDAD / SUBCIRCUITO.
5. La hoja `Las60` tiene los nombres escritos como figuran en la planilla, con los dos alias.
6. La hoja `Duplicadas` tiene las 71 filas.
7. Se contaron campañas y no filas, o filas y no piezas-localidad.

Como apoyo, `Filas_no_procesadas_Pauta_Digital.xlsx` trae en la hoja Resumen el cuadre completo de la carga (renglones → filas reales → fuera del universo → entran → duplicadas → entradas → piezas) y en las otras hojas cada fila que no entró, con su motivo.

## Checklist para quien carga la planilla

Diez controles antes de cada carga. Cada uno viene de una regla de las secciones anteriores.

- [ ] La hoja se llama `GLOBAL_ImportRange` y los encabezados están en la fila 1, con los nombres exactos (ojo con `INICIO ` con un espacio al final, `UTM´S` y `AUDIENCIA  (Barrios o publicos) `).
- [ ] Toda pieza real tiene CAMPAÑA o TITULO DE LA PIEZA, y ninguno es solo un espacio o un guion.
- [ ] DEPARTAMENTO contiene “Córdoba”.
- [ ] LOCALIDAD / SUBCIRCUITO usa uno de los formatos reconocidos: `LOCALIDAD, DEPARTAMENTO X, PROVINCIA DE CÓRDOBA, ARGENTINA` con una de las 60 localidades, un circuito `NNNA - NOMBRE…`, o “TODAS LAS LOCALIDADES” escrito exacto en mayúsculas. Una localidad que no es de las 60 queda fuera del tablero.
- [ ] “TODAS LAS LOCALIDADES” con “Provincia de Córdoba, Argentina” se carga solo cuando la pauta es realmente provincial: no cuenta como cobertura de ninguna localidad.
- [ ] Para que una pieza cuente: ESTADO = ACTIVO, INICIO y FIN con fecha real, y hoy entre las dos.
- [ ] INICIO y FIN son fechas de Excel, no texto.
- [ ] Dos piezas distintas no comparten a la vez CAMPAÑA, TITULO, PLATAFORMA, INICIO, FIN, LINK MATERIAL, TIPO DE MATERIAL y AUDIENCIA en la misma localidad (si los comparten, el tablero muestra una sola).
- [ ] Una pieza ya cargada (campaña + título) no desaparece entre cargas: el tablero frena la actualización si falta una.
- [ ] Los PROGRAMADO cuyo INICIO ya pasó tienen su ESTADO actualizado.

## Puntos abiertos para validar

Ocho puntos para confirmar con el área; los marcados como decididos ya tienen criterio del lado del tablero.

| # | Punto | Situación |
| --- | --- | --- |
| 1 | **Contenido orgánico.** Las filas de la planilla de pauta digital con TIPO DE PAUTA = Orgánico cuentan como pauta digital. | Decidido: no se excluyen. Son 256 filas reales (26 con ESTADO ACTIVO). El área debe confirmar que ese valor de la columna corresponde a pauta digital. El archivo de contenido orgánico (GNO) es otra fuente y no entra en este manual. |
| 2 | **COD. CONTENIDO.** | Decidido: es solo informativo. No decide si una fila entra, si es duplicada, si es nueva ni si se dio de baja. 2.097 filas reales no tienen código y se procesan igual que las demás. |
| 3 | **“Vigente” en la pestaña Pauta Digital y en Campañas.** | Decidido: se mantiene la regla del 24/09. Estas dos listas muestran el estado tal cual lo carga la planilla (4.755 piezas-localidad con ESTADO activo al 26/10). Las fechas rigen solo en las tarjetas, el color, la cobertura y el mail (4.752 activas). |
| 4 | **Pauta provincial.** | Entra en el mail de vencimientos pero no en la cobertura ni en el color. El área debe confirmar que el mail incluya lo provincial. |
| 5 | **Localidades fuera de las 60.** | Decidido: quedan fuera del tablero (321 filas, 18 de ellas ACTIVO). El área debe confirmar los nombres en `Nombres_a_confirmar_por_el_area.xlsx`: si alguno correspondía a una de las 60, hay que escribirlo como en la lista oficial. |
| 6 | **Parejas duplicadas.** | 134 parejas de filas que el tablero toma como la misma pieza; en 116 las métricas difieren. El área debe confirmar cada una en `Parejas_duplicadas_a_confirmar_por_el_area.xlsx`. |
| 7 | **OBSERVADO con fechas en curso.** | Decidido: no son activas y no avisan. En esta carga hay 1.071 filas OBSERVADO (eran 73 en la carga del 11/10), todas con OBSERVACIONES cargada. |
| 8 | **Métricas y link de destino.** | Se cargan y se leen, pero no se muestran en ninguna pantalla. La columna “Alcance” de la pestaña Pauta Digital queda en “—”. Definir si se van a mostrar. |
