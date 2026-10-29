# Manual metodológico — Pauta Digital

Borrador para validación del área · Oct 14, 2026 · @Tomas

## Para qué sirve este manual

Este manual explica qué cuenta como pauta digital activa en el tablero, a qué localidad llega cada fila de la planilla y por qué un número del tablero puede no coincidir con el conteo de la planilla.

Está escrito para quienes arman y mantienen la planilla de pauta digital (hoja `GLOBAL_ImportRange`). Cada regla trae la definición, la columna exacta que mira el tablero y cómo reproducirla con un filtro.

- **Estado del documento:** borrador para validación del área.
- **Base de los ejemplos:** carga del 11/10/2026 (4.009 filas), vista con fecha 14/10/2026. Los números dependen de esa fecha y de esa versión de la planilla.
- **Alcance:** solo Pauta Digital. Medios Tradicionales, Audiovisuales, SMS y Orgánico tienen reglas propias.
- **Versión del tablero:** describe el tablero con los cambios de alertas y cobertura que están en revisión; al 14/10 todavía no estaban publicados en producción.
- **Fuente congelada:** el histórico (`Medios_Digitales.xlsx`, hasta el 02/07) no se toca y no se describe acá.

## Glosario

Estos son los términos que se usan en todo el manual. El que más confunde es la diferencia entre **fila** (lo que cuenta la planilla) y **pieza-localidad** (lo que cuenta el tablero por dentro).

| Término | Qué significa |
| --- | --- |
| Planilla | La hoja `GLOBAL_ImportRange` del archivo `Pauta RRSS_GLOBAL.xlsx`. De ahí sale toda la pauta digital del tablero. |
| Fila | Cada renglón de la planilla. Cuando se habla de “filas” se habla de lo que cuentan ustedes en la planilla. |
| Fila real | Fila que tiene cargado CAMPAÑA o TITULO DE LA PIEZA. Si los dos están vacíos, es un renglón arrastrado por las fórmulas y el tablero lo ignora. |
| Campaña | El nombre de la campaña (columna CAMPAÑA). Una campaña puede ocupar muchas filas (distintas piezas, plataformas o localidades) y se cuenta una sola vez: 40 filas de la misma campaña son 1 campaña. Si CAMPAÑA está vacía se usa el título. |
| ESTADO | Lo que dice la columna ESTADO: ACTIVO, INACTIVO, OBSERVADO, PROGRAMADO o vacío. Lo calcula la planilla del área y el tablero lo toma tal cual. |
| INICIO y FIN | Fecha de comienzo y de fin de la pauta (columnas AA y AB). Tienen que ser fechas reales, no texto. |
| Fecha de control (“hoy”) | La fecha contra la que se comparan INICIO y FIN. En el tablero es el día en que se lo mira. Para verificar un número hay que fijar una fecha y usar siempre la misma. |
| Activa | Fila con ESTADO = ACTIVO cuyo período incluye la fecha de control: INICIO ≤ fecha ≤ FIN, con las dos fechas cargadas. Ejemplo: ACTIVO, INICIO 01/10, FIN 31/10; el 15/10 está activa. |
| Las 60 | Las 60 localidades prioritarias, el universo fijo del tablero. Una localidad que no está entre ellas no se atribuye a ninguna. |
| Alcance | Hasta dónde llega una pieza: una localidad, un circuito de Capital, un departamento o toda la provincia. Se lee de las columnas DEPARTAMENTO y LOCALIDAD / SUBCIRCUITO. |
| Dirigida | Pauta que apunta a un lugar concreto: una localidad de las 60, un circuito de Capital o “TODAS LAS LOCALIDADES” de un departamento puntual. La pauta de toda la provincia y la que solo tiene departamento no son dirigidas. |
| COD. CONTENIDO | El código de la pieza. Sirve para detectar duplicados. |
| Pieza-localidad | Cuenta interna del tablero. Si una fila llega a toda la provincia, el tablero la copia 60 veces, una por localidad; cada copia es una pieza-localidad. Por eso el tablero maneja unas 16.000 con solo 4.009 filas. No sirve para comparar con la planilla. |
| Pieza única | Combinación de COD. CONTENIDO + campaña + título, sin importar en cuántas localidades aparezca. |

## El camino de una fila

Para cada fila de la planilla, el tablero se hace cinco preguntas, en este orden. Si una respuesta corta el camino, la fila no sigue.

1. **¿Es una fila real?** CAMPAÑA o TITULO DE LA PIEZA cargados. Si no, se descarta.
2. **¿Es de Córdoba?** La columna DEPARTAMENTO contiene “Córdoba”. Si no, queda fuera del tablero.
3. **¿A qué localidades llega?** Se mira LOCALIDAD / SUBCIRCUITO (y DEPARTAMENTO en un caso): una localidad, un circuito de Capital, un departamento o toda la provincia.
4. **¿Es un duplicado?** Si repite COD. CONTENIDO, campaña, título y localidad con otra fila, se unifican.
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

- Es real y es de Córdoba.
- Llega a toda la provincia: se copia en las 60 localidades.
- Está activa: ACTIVO y el 15/10 cae entre el 06/10 y el 20/10.
- No es dirigida, porque es de toda la provincia.
- En la planilla cuenta como 1 fila y 1 campaña activa; en el tablero, como 60 piezas-localidad.
- No cuenta para la cobertura de ninguna localidad, pero sí entra en el mail de vencimientos cuando su FIN queda a 7 días o menos.

## Qué es pauta activa

Una campaña está activa cuando la planilla la marca como ACTIVO y la fecha de control cae dentro de su período. Según cuánto se exija hay tres niveles, y cada uno responde una pregunta distinta. Cada nivel es una parte del anterior.

| Nivel | La pregunta | Qué tiene que cumplir la fila | Filas | Piezas-localidad |
| --- | --- | --- | --- | --- |
| 1. Con ESTADO activo | ¿La planilla la marca como activa? | `ESTADO` = ACTIVO | 1.573 | 6.429 |
| 2. Activa | ¿Y además hoy está dentro de sus fechas? | Nivel 1 e `INICIO` ≤ fecha de control ≤ `FIN` | 1.529 | 5.557 |
| 3. Activa dirigida | ¿Y además apunta a un lugar concreto? | Nivel 2 y alcance dirigido (ver Geografía) | 1.445 | 2.169 |

Valores al 14/10/2026 con la planilla del 11/10. Medido en campañas, el nivel 2 tiene 52 campañas y el nivel 3 tiene 49 (las 2.169 piezas-localidad equivalen a 543 piezas únicas).

**Qué número usar.**

- Para decir cuánta pauta hay activa: nivel 2, contado en campañas.
- Para decir cuánta pauta llega a localidades concretas: nivel 3, contado en campañas.
- El nivel 1 es lo que muestran las pestañas Pauta Digital y Campañas como “Vigente”.

**Por qué los números del tablero no coinciden con los de la planilla.** Hay tres razones y las tres son normales:

- **Fila vs. pieza-localidad.** Una fila que llega a toda la provincia es 1 en la planilla y 60 en el tablero. Para comparar hay que contar filas o campañas, nunca piezas-localidad.
- **ESTADO vs. fechas.** Una fila puede decir ACTIVO y tener el FIN vencido, porque la planilla todavía no recalculó. Al 14/10 hay 44 filas así (872 piezas-localidad): están en el nivel 1 pero no en el 2.
- **Activa vs. dirigida.** La pauta de toda la provincia está activa, pero no cuenta para la cobertura ni para el color de una localidad.

**Regla para informar un número:** decir siempre el nivel, la unidad (filas o campañas) y la fecha de control. “Hay 52 campañas activas al 14/10” se puede verificar; “hay 52 de pauta activa” no.

## Planilla y columnas que lee el tablero

El tablero lee la hoja `GLOBAL_ImportRange` del archivo `Pauta RRSS_GLOBAL.xlsx`, con los encabezados en la fila 1, y busca cada columna por su nombre exacto. Si un encabezado cambia o falta, la actualización del tablero se corta; una columna nueva se ignora sin aviso.

**Las siete columnas que deciden casi todo.** Si estas están bien cargadas, la fila se interpreta bien:

| Letra | Columna | Qué decide | Cómo tiene que estar cargada |
| --- | --- | --- | --- |
| A y B | `CAMPAÑA` y `TITULO DE LA PIEZA` | Si la fila es real y cómo se llama la campaña | Texto. Alcanza con que una de las dos esté completa |
| E | `DEPARTAMENTO` | Si la fila es de Córdoba | Texto que contenga “Córdoba”, por ejemplo `DEPARTAMENTO CAPITAL, PROVINCIA DE CÓRDOBA, ARGENTINA` |
| F | `LOCALIDAD / SUBCIRCUITO` | A qué localidades llega | Uno de los formatos de la sección Geografía |
| AD | `ESTADO` | Si la pauta está activa, terminada, observada o programada | Una de estas palabras: ACTIVO, INACTIVO, OBSERVADO o PROGRAMADO |
| AA y AB | ` INICIO  ` y `FIN` | Si hoy está dentro del período | Fecha real de Excel, con formato dd/mm/aaaa. Nunca texto |

La tabla siguiente es la lista completa de columnas que el tablero lee, incluidas las opcionales.

| Letra | Encabezado exacto | Para qué se usa | ¿Hace falta? |
| --- | --- | --- | --- |
| A | `CAMPAÑA` | Nombre de la campaña; define si la fila es real | Una de A o B |
| B | `TITULO DE LA PIEZA` | Título; sustituye a la campaña si esta falta | Una de A o B |
| E | `DEPARTAMENTO` | Excluye lo que no es de Córdoba; define el departamento | Sí |
| F | `LOCALIDAD / SUBCIRCUITO` | Define a qué localidad llega la pieza | Sí |
| K | `COD. CONTENIDO` | Clave para detectar duplicados | Recomendada |
| L | `PLATAFORMA` | Canal (Meta, Youtube, Google Ads…) | Opcional |
| N | `TIPO DE PAUTA` | Se muestra en el panel de localidad | Opcional |
| Q | `LINK MATERIAL` | Enlace “Ver material” | Opcional |
| R | `URL` | Link de destino; primera opción | Opcional |
| S | `UTM´S` (con tilde ´) | Link de destino si `URL` no trae un link válido | Opcional |
| W, X, Y | `IG`, `FB`, `YT` | Enlaces por red; definen los canales del panel | Opcional |
| Z | `FECHA DE ENVÍO` | Desempate entre duplicados | Opcional |
| AA | ` INICIO  ` (con espacio al final) | Inicio de la pauta | Sí, para ser activa |
| AB | `FIN` | Fin de la pauta | Sí, para ser activa |
| AD | `ESTADO` | Estado de la pieza | Sí; vacío queda como S/D |

Estas columnas existen y se leen, pero hoy no se muestran en ninguna pantalla: `EJE`, `MINISTERIO`, `PROVEEDOR`, las de métricas (cobertura, impresiones, frecuencia, CPM, visualizaciones) y las de inversión planificada y ejecutada. Cargarlas o no no cambia lo que se ve.

El tablero no lee, entre otras, `AUDIENCIA`, `UNIVERSO`, `CÓDIGO AGENCIA`, `CÓDIGO CONJUNTO DE ANUNCIOS`, `OBJETIVO DE CAMPAÑA`, `SOLICITADO POR`, `INICIO INFORMADO`, `FIN INFORMADO`, `TIPO DE MATERIAL`, `DURACIÓN` ni `OBSERVACIONES`. En particular, `INICIO INFORMADO` y `FIN INFORMADO` ya no se usan como respaldo de `INICIO` y `FIN`.

Las letras son las del archivo de la carga del 11/10 (77 columnas). Si se inserta una columna, las letras se corren; lo que vale es el nombre.

## Qué es una fila real y cuáles se descartan

Una fila es real si tiene CAMPAÑA o TITULO DE LA PIEZA cargados. Ninguna otra columna sirve para decidirlo: las columnas con fórmula (ESTADO, DURACIÓN, IG, FB, YT) se rellenan hasta abajo aunque la fila esté vacía.

| Caso | Qué pasa | Filas en la carga del 11/10 |
| --- | --- | --- |
| CAMPAÑA y TITULO DE LA PIEZA vacíos | Se descarta como arrastre de fórmulas | 0 |
| DEPARTAMENTO vacío o sin la palabra “Córdoba” | Se excluye: queda fuera del tablero | 2 (filas 1138 y 1139: Santa Fe y Entre Ríos) |
| Fila repetida para la misma localidad | Se unifica con otra (ver Duplicados) | 17 filas colapsadas |

Una celda de CAMPAÑA o TITULO con solo un espacio o un guion cuenta como cargada: la fila se procesaría como real. En cargas anteriores hubo entre 368 y 545 filas de arrastre; en esta, ninguna.

## Geografía: a qué localidad llega cada fila

El tablero decide la geografía de cada fila con solo dos columnas, DEPARTAMENTO (E) y LOCALIDAD / SUBCIRCUITO (F), evaluándolas en este orden. La primera condición que se cumple define el resultado.

**Cómo se resuelve en la práctica.** Casi siempre alcanza con mirar la columna F. Si empieza con un número, es un circuito de Capital. Si dice exactamente “TODAS LAS LOCALIDADES”, se mira la columna E para saber si es toda la provincia o un departamento. En cualquier otro caso, F trae el nombre de una localidad y se busca en la lista de las 60.

| # | Qué dice la planilla | Resultado | ¿Dirigida? | Filas → piezas-localidad |
| --- | --- | --- | --- | --- |
| 1 | E sin “Córdoba” | Excluida: fuera del tablero | No aplica | 2 → 0 |
| 2 | F empieza con 3 o 4 dígitos, letra opcional y “ - ” (por ejemplo `010A - CABILDO…` o `0010 - BELLA VISTA`) | Circuito de Capital: va a CÓRDOBA | Sí | 425 → 411 |
| 3 | F = “TODAS LAS LOCALIDADES” y E con un departamento puntual que tiene localidades de las 60 | Una pieza por cada localidad de las 60 de ese departamento | Sí | 1.466 → 3.230 |
| 4 | F = “TODAS LAS LOCALIDADES” y E = “Provincia de Córdoba, Argentina” | Una pieza en cada una de las 60 | No | 159 → 9.540 |
| 5 | F = “TODAS LAS LOCALIDADES” y E es un departamento sin ninguna de las 60 | Solo departamento, sin localidad | No | dentro de 305 → 305 |
| 6 | El texto de F antes de la primera coma es una de las 60 (“CÓRDOBA CAPITAL” equivale a CÓRDOBA) | Esa localidad | Sí | 1.652 → 1.649 |
| 7 | F es otra localidad real que no está entre las 60 | Solo departamento, sin localidad | No | dentro de 305 → 305 |
| 8 | F vacío | Sin ámbito: no se atribuye a nada | No | 0 |

Reglas finas que conviene respetar al cargar:

- **El texto “TODAS LAS LOCALIDADES” se compara literal.** Debe ir en mayúsculas y sin variantes. “Todas las localidades” no se reconoce y la fila cae como departamento.
- **El match por nombre es exacto, sin tildes.** Nombres parecidos no cuentan (Villa de Soto no es Villa del Totoral).
- **Solo se lee lo anterior a la primera coma de F.** `SAN FRANCISCO, DEPARTAMENTO SAN JUSTO, …` se atribuye a SAN FRANCISCO.
- **E no se valida contra F.** Una localidad de las 60 con el departamento equivocado en E igual se atribuye a esa localidad (caso A06049, Villa Carlos Paz con CAPITAL).
- **Los circuitos de 2 dígitos no se reconocen** como circuito.
- **No hay salto a departamento.** Una fila que no coincide exactamente con una de las 60 no aparece en ningún panel de localidad; solo figura en la pestaña Pauta Digital y en Campañas, con la etiqueta del departamento.

* **El “DE” del departamento se ignora.** En E el departamento puede venir como `DEPARTAMENTO COLÓN` o como `DEPARTAMENTO DE COLÓN`: el tablero trata las dos igual. Los nombres de departamento se comparan sin tildes ni mayúsculas. Si al reproducir no se ignora el “DE”, las piezas activas dirigidas bajan de 2.169 a 1.139.

Ejemplos reales: la fila 954 (COD A05599, “TODAS LAS LOCALIDADES” con “Provincia de Córdoba, Argentina”) genera 60 piezas, una por localidad. La fila 960 (COD A05606, Departamento Presidente Roque Sáenz Peña) genera 1, porque ese departamento tiene solo Laboulaye entre las 60. Las métricas de una fila se repiten completas en cada localidad que alcanza; no se reparten.

## Estado y fechas

El estado sale directo de la columna ESTADO (AD) y no se recalcula con las fechas. Solo una fila con ESTADO = ACTIVO puede ser activa.

| ESTADO en la planilla | El tablero lo muestra como | ¿Puede ser activa? | Filas → piezas-localidad |
| --- | --- | --- | --- |
| ACTIVO | Vigente | Sí, si además `INICIO` ≤ hoy ≤ `FIN` | 1.573 → 6.429 |
| INACTIVO | Finalizada | No | 2.311 → 8.567 |
| OBSERVADO | Observada | No, aunque tenga fechas en curso | 73 → 87 |
| PROGRAMADO | Programada | No: todavía no empezó | 52 → 52 |
| Vacío | S/D (sin dato) | No | 0 |
| Cualquier otro valor | Se muestra tal cual | No; se avisa en la actualización | 0 |

Las mayúsculas, minúsculas y tildes de ESTADO no importan. Los conteos por estado suman 4.009 filas e incluyen las 2 excluidas por departamento (ambas INACTIVO); sin ellas, INACTIVO es 2.309.

Reglas de las fechas:

- **Solo cuentan `INICIO` (AA) y `FIN` (AB).** No hay respaldo en `INICIO INFORMADO` ni `FIN INFORMADO`.
- **Tienen que ser fechas reales de Excel.** Una fecha real queda guardada como número y se muestra con formato de fecha. Un texto que solo parece una fecha (por ejemplo, pegado desde un mail o un PDF) el tablero lo lee con el mes primero: “05/10/2026” se leería como 10 de mayo y correría el INICIO o el FIN varios meses. Se detecta porque se alinea a la izquierda o porque \`=ESNUMERO(AA2)\` da FALSO. En la carga del 11/10 no había ninguno.
- **Sin `INICIO` o sin `FIN` la fila no es activa:** no entra en cobertura, color ni alertas. En la carga del 11/10 hay 424 filas sin ninguna de las dos (387 INACTIVO y 37 OBSERVADO) y ninguna ACTIVO.
- **INICIO posterior a hoy:** la fila no es activa todavía.
- **ACTIVO con FIN ya vencido:** figura como Vigente pero no es activa. Al 14/10 son 44 filas (872 piezas-localidad). Se corrige cuando la planilla recalcula ESTADO.
- **PROGRAMADO con INICIO ya pasado:** hay 23 filas en esa situación. Quedan como Programada y no cuentan como activas hasta que ESTADO cambie en la planilla.

**Dos relojes.** ESTADO se calcula en la planilla del área y el tablero lo copia el día de la descarga (la carga actual es del 11/10). Las fechas INICIO y FIN, en cambio, se comparan contra el día en que alguien mira el tablero. Por eso una fila con ESTADO = ACTIVO puede estar activa hoy y dejar de estarlo en tres días, aunque nadie toque la planilla.

**Ejemplos con datos inventados.** Con fecha de control 15/10/2026:

| ESTADO | INICIO | FIN | ¿Está activa? | Por qué |
| --- | --- | --- | --- | --- |
| ACTIVO | 01/10/2026 | 31/10/2026 | Sí | El 15/10 está entre INICIO y FIN |
| ACTIVO | 01/09/2026 | 10/10/2026 | No | El FIN ya pasó. Sigue como “Vigente” en las pestañas hasta que la planilla recalcule |
| ACTIVO | 01/10/2026 | vacío | No | Falta FIN |
| ACTIVO | 20/10/2026 | 30/10/2026 | No | Todavía no empezó |
| PROGRAMADO | 12/10/2026 | 19/10/2026 | No | ESTADO no es ACTIVO, aunque el INICIO ya pasó |
| OBSERVADO | 01/10/2026 | 31/10/2026 | No | ESTADO no es ACTIVO |

**Cómo comprobar que una fecha es una fecha.** Una fecha real se alinea a la derecha de la celda. En una celda libre, `=ESNUMERO(AA2)` da VERDADERO si es fecha y FALSO si es texto. Si da FALSO, hay que volver a escribirla con formato dd/mm/aaaa. Un texto como “05/10/2026” el tablero lo leería como 10 de mayo.

## Duplicados

El tablero unifica dos piezas cuando coinciden en COD. CONTENIDO, CAMPAÑA, TITULO DE LA PIEZA y localidad asignada. La comparación se hace después de repartir la geografía, por eso puede haber más duplicados que los que se ven a simple vista en la planilla.

Si hay duplicados, se conserva uno con este orden de desempate:

1. La de `FECHA DE ENVÍO` más reciente.
2. Si empatan, la que tenga ESTADO = ACTIVO.
3. Si siguen empatadas, la primera que aparece en la planilla.

Puntos a tener en cuenta:

- **Sin COD. CONTENIDO no hay deduplicación.** En la carga del 11/10, 1.989 filas (49,6 %) no tienen código y generan 6.132 piezas-localidad que nunca se unifican. Hay 284 combinaciones repetidas entre ellas y no se sabe si son duplicados reales o piezas distintas.
- **El COD solo no alcanza.** 45 de 1.955 códigos se usan en más de una combinación de campaña y título.
- **La comparación es literal.** `137` como número y `"137"` como texto son códigos distintos, y un título con un espacio de más o distinta mayúscula cuenta como otro. Hay 21 códigos numéricos en la planilla.
- **Resultado actual:** 17 filas colapsadas en 16 grupos.

Una fila sin código es válida si figura como activa. Para evitar duplicados no detectados conviene cargar siempre el código.

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

- Cuenta solo la pauta activa y dirigida. La provincial genérica y la que tiene solo departamento no pintan la localidad ni cuentan como cobertura.
- El color de la localidad es el peor entre los ejes que aplican. Medios Tradicionales y Pauta Digital son dos ejes y nunca se fusionan en un número único.
- “Sin cobertura” significa cero Medios Tradicionales activos y cero pauta digital que cuenta.

**Mail de vencimientos**

- Incluye las piezas activas cuyo `FIN` cae entre hoy y dentro de 7 días.
- Incluye la pauta provincial y la de departamento, a diferencia de la cobertura.
- Agrupa por campaña y fecha de `FIN`: una línea por cada combinación. Al 14/10 son 47 líneas.

**Dos universos distintos, a propósito.** “Activas dirigidas” mide alcance en las localidades. “Vencen esta semana” mide el trabajo de renovación. La segunda no es un subconjunto de la primera.

## Qué fila aparece en qué pantalla

Una fila puede estar en el tablero y aun así no contar en la cobertura. La tabla resume dónde entra cada tipo.

| Tipo de fila | Panel de localidad | Cobertura y color | Pestaña Pauta Digital | Campañas | Mail |
| --- | --- | --- | --- | --- | --- |
| Fuera de Córdoba o arrastre de fórmulas | No | No | No | No | No |
| Dirigida y activa | Sí | Sí | Sí | Sí | Sí, si FIN en 7 días |
| Dirigida, no activa (Finalizada, Observada, ACTIVO con FIN vencido) | Sí, con etiqueta | No | Sí | Sí | No |
| Dirigida y Programada | Sí, en un bloque aparte | No | Sí | Sí | No |
| Provincial genérica y activa | Sí, en las 60 | No | Sí | Sí | Sí, si FIN en 7 días |
| Provincial genérica, no activa | Sí, en las 60 | No | Sí | Sí | No |
| Solo departamento | No | No | Sí | Sí, con “Depto. X” | Sí, si activa y FIN en 7 días |
| Sin fechas | Solo si el período es “Todo” | No | Solo si el período es “Todo” | Sí | No |
| Sin COD. CONTENIDO | Igual que las demás | Igual | Igual | Igual | Igual |

El panel de una localidad lista todas las piezas, en cualquier estado, y arriba muestra una tarjeta con solo las activas dirigidas. En Córdoba la tabla tiene 1.217 piezas y la tarjeta 174. No es un error: miden cosas distintas.

La pestaña Pauta Digital y Campañas muestran “Vigente” solo por ESTADO = ACTIVO, sin mirar las fechas: es el nivel “Con ESTADO activo”. Por eso pueden mostrar más “Vigente” (6.429) que las cards (5.557 activas). No es un error: son dos niveles distintos y el manual los nombra por separado.

## Cómo reproducir un número del tablero

Para llegar al mismo número que el tablero hay que trabajar sobre una copia de la planilla, fijar una fecha y marcar cada fila con unas columnas auxiliares. Son seis pasos. Cada uno dice qué escribir y qué debería dar. Las funciones se llaman igual en Excel y en Google Sheets en español.

**Antes de empezar: tres reglas de oro**

1. **Trabajar siempre sobre una copia.** Copiar la hoja `GLOBAL_ImportRange` a un archivo aparte y pegarla como valores (Pegado especial, solo valores). No agregar columnas en la original: se alimenta sola con `IMPORTRANGE` y se rompería.
2. **Usar la misma versión de la planilla que el tablero.** El tablero tiene la carga del 11/10. Si la planilla del área cambió después, los números van a ser distintos aunque las reglas estén bien aplicadas.
3. **Fijar una fecha de control.** Escribirla en una celda y usar esa celda en las fórmulas, no `HOY()`. Así el resultado no cambia de un día para el otro.

**Paso 1. Preparar la copia**

En la copia, escribir en la celda `CG1` el texto “Fecha de control” y en `CH1` la fecha, por ejemplo 15/10/2026 (con formato fecha). Crear una hoja nueva llamada `Las60` con las 60 localidades en la columna A, una por celda, más `CÓRDOBA CAPITAL`. La lista oficial está en `Localidades 1.xlsx`. Escribir los nombres tal como figuran en la planilla: el tablero ignora las tildes, pero Excel no.

**Paso 2. Agregar seis columnas auxiliares**

La planilla llega hasta la columna BY, así que se usan `CA` a `CF`. Escribir el título en la fila 1 y la fórmula en la fila 2, y después copiarla hacia abajo hasta la última fila de datos (la 4010 en la carga del 11/10).

| Columna | Título | Fórmula (fila 2) | Qué devuelve |
| --- | --- | --- | --- |
| CA | Real | `=SI(O(A2<>"";B2<>"");1;0)` | 1 si CAMPAÑA o TITULO están cargados |
| CB | Córdoba | `=SI(ESNUMERO(HALLAR("CORDOBA";SUSTITUIR(SUSTITUIR(E2;"Ó";"O");"ó";"o")));1;0)` | 1 si DEPARTAMENTO contiene “Córdoba” |
| CC | Activa | `=SI(Y(ESPACIOS(AD2)="ACTIVO";ESNUMERO(AA2);ESNUMERO(AB2);AA2<=$CH$1;AB2>=$CH$1);1;0)` | 1 si ESTADO es ACTIVO y la fecha de control está entre INICIO y FIN |
| CD | Geografía | (fórmula de abajo) | Circuito, Provincial, Todas del departamento, Localidad de las 60 u Otra |
| CE | Dirigida | `=SI(O(CD2="Circuito";CD2="Todas del departamento";CD2="Localidad de las 60");1;0)` | 1 si el alcance es dirigido |
| CF | Vence en 7 días | `=SI(Y(CC2=1;AB2>=$CH$1;AB2<=$CH$1+7);1;0)` | 1 si es activa y su FIN cae entre la fecha de control y 7 días después |

Fórmula de la columna CD (escribirla entera en una sola celda):

```
=SI(ESNUMERO(VALOR(IZQUIERDA(F2;1)));"Circuito";SI(IGUAL(ESPACIOS(F2);"TODAS LAS LOCALIDADES");SI(IZQUIERDA(ESPACIOS(E2);12)="DEPARTAMENTO";"Todas del departamento";"Provincial");SI(CONTAR.SI(Las60!$A:$A;SI(ESNUMERO(HALLAR(",";F2));IZQUIERDA(F2;HALLAR(",";F2)-1);F2))>0;"Localidad de las 60";"Otra")))
```

Cómo se lee: si F empieza con un número, es un circuito. Si dice exactamente “TODAS LAS LOCALIDADES”, es del departamento cuando E empieza con “DEPARTAMENTO” y provincial si no. En cualquier otro caso se toma el texto de F antes de la primera coma y se busca en la hoja `Las60`. `IGUAL` distingue mayúsculas, igual que el tablero. Con estos datos, “empieza con un número” equivale al formato de circuito. Caso raro: una fila “TODAS LAS LOCALIDADES” de un departamento que no tiene ninguna de las 60 no es dirigida en el tablero, y esta fórmula la marca como dirigida.

**Paso 3. Comprobar las fechas**

En una celda libre escribir `=SUMAPRODUCTO(--ESNUMERO(AA2:AA4010))` y en otra `=CONTARA(AA2:AA4010)`. Tienen que dar el mismo número. Si la segunda es mayor, hay fechas escritas como texto y esas filas no se van a contar como activas. Repetir con la columna AB.

**Paso 4. Contar filas**

| Qué contar | Fórmula | Con fecha de control 14/10 | Con fecha de control 15/10 |
| --- | --- | --- | --- |
| Filas con ESTADO activo | `=CONTAR.SI.CONJUNTO(CA:CA;1;CB:CB;1;AD:AD;"ACTIVO")` | 1.573 | 1.573 |
| Filas activas | `=CONTAR.SI.CONJUNTO(CA:CA;1;CB:CB;1;CC:CC;1)` | 1.529 | 1.522 |
| Filas activas dirigidas | `=CONTAR.SI.CONJUNTO(CA:CA;1;CB:CB;1;CC:CC;1;CE:CE;1)` | 1.445 | 1.442 |

La primera fórmula no ignora los espacios sobrantes: si una celda de ESTADO dice “ACTIVO ” con un espacio al final, no la cuenta.

**Paso 5. Contar campañas**

Insertar una tabla dinámica sobre la copia. Filtros: `Real` = 1, `Córdoba` = 1 y `Activa` = 1. Para las dirigidas, agregar `Dirigida` = 1. Poner `CAMPAÑA` en las filas. El número de campañas es la cantidad de filas de la tabla, sin contar el “Total general”. Esperado: 52 campañas activas y 49 activas dirigidas, en las dos fechas.

- Si aparece una fila “(en blanco)”, son filas sin CAMPAÑA: el tablero las cuenta usando el título como nombre.
- Dos nombres que difieren solo por mayúsculas o por una tilde, la tabla dinámica puede separarlos y el tablero los cuenta como uno. Unificarlos a mano antes de contar.

**Paso 6. Contar las líneas del mail de vencimientos**

Nueva tabla dinámica. Filtros: `Real` = 1, `Córdoba` = 1 y `Vence en 7 días` = 1. Poner `CAMPAÑA` y `FIN` en las filas. Cada combinación distinta de campaña y fecha de FIN es una línea del mail. No se filtra por geografía: entra también la pauta de toda la provincia y la de departamento. Esperado: 47 líneas con fecha de control 14/10 y 46 con 15/10.

**Números de control**

| Qué se cuenta | 14/10 | 15/10 |
| --- | --- | --- |
| Filas con ESTADO activo | 1.573 | 1.573 |
| Filas activas | 1.529 | 1.522 |
| Filas activas dirigidas | 1.445 | 1.442 |
| Campañas activas | 52 | 52 |
| Campañas activas dirigidas | 49 | 49 |
| Líneas del mail de vencimientos | 47 | 46 |

Todos con la planilla del 11/10. Aplicando solo las reglas de este manual sobre esa planilla se obtienen los mismos números que muestra el tablero. El tablero cuenta además piezas-localidad (5.557 activas y 2.169 dirigidas el 14/10): no se pueden reproducir con estas fórmulas porque exigen repartir cada fila entre las localidades que alcanza. Para comparar con el tablero se usan filas y campañas.

**Si un número no coincide, revisar en este orden:**

1. La fecha de control (`CH1`) es la del día que se quiere verificar.
2. La planilla es la misma versión que la del tablero (carga del 11/10).
3. Las fechas de INICIO y FIN son fechas reales (Paso 3).
4. No hay espacios sobrantes en ESTADO, DEPARTAMENTO ni LOCALIDAD / SUBCIRCUITO.
5. La hoja `Las60` tiene los nombres escritos como figuran en la planilla.
6. Se contaron campañas y no filas, o filas y no piezas-localidad.

Como apoyo existe un archivo de verificación con una fila por cada una de las 4.009 filas de origen: su tipo de geografía, cuántas piezas-localidad genera, si es activa, si es dirigida y el motivo si queda afuera. Sirve para cotejar cualquier conteo fila por fila.

## Checklist para quien carga la planilla

Diez controles antes de cada carga. Cada uno viene de una regla de las secciones anteriores.

- [ ] La hoja se llama `GLOBAL_ImportRange` y los encabezados están en la fila 1, con los nombres exactos (ojo con ` INICIO  ` y `UTM´S`).
- [ ] Toda pieza real tiene CAMPAÑA o TITULO DE LA PIEZA, y ninguno es solo un espacio o un guion.
- [ ] DEPARTAMENTO contiene “Córdoba”.
- [ ] LOCALIDAD / SUBCIRCUITO usa uno de los formatos reconocidos: `LOCALIDAD, DEPARTAMENTO X, PROVINCIA DE CÓRDOBA, ARGENTINA`, un circuito `NNNA - NOMBRE…`, o “TODAS LAS LOCALIDADES” escrito exacto en mayúsculas.
- [ ] “TODAS LAS LOCALIDADES” con “Provincia de Córdoba, Argentina” se carga solo cuando la pauta es realmente provincial: no cuenta como cobertura de ninguna localidad.
- [ ] Para que una pieza cuente: ESTADO = ACTIVO, INICIO y FIN con fecha real, y hoy entre las dos.
- [ ] INICIO y FIN son fechas de Excel, no texto.
- [ ] COD. CONTENIDO completo y no reutilizado en otra combinación de campaña y título.
- [ ] Un código ya cargado no desaparece entre cargas (el tablero frena la actualización si falta uno).
- [ ] Los PROGRAMADO cuyo INICIO ya pasó tienen su ESTADO actualizado.

## Puntos abiertos para validar

Siete puntos para confirmar con el área; los marcados como decididos ya tienen criterio del lado del tablero.

| # | Punto | Situación |
| --- | --- | --- |
| 1 | **Contenido orgánico.** Las filas de la planilla de pauta digital con TIPO DE PAUTA = Orgánico cuentan como pauta digital. | Decidido: no se excluyen. Son 193 filas (28 con ESTADO ACTIVO) y el tablero las trata como cualquier otra. El área debe confirmar que ese valor de la columna corresponde a pauta digital. El archivo de contenido orgánico (GNO) es otra fuente y no entra en este manual. |
| 2 | **Filas sin COD. CONTENIDO.** | Se consideran válidas si figuran como activas. El área debe confirmar que una fila sin código es una pieza real y no una carga pendiente. |
| 3 | **“Vigente” en la pestaña Pauta Digital y en Campañas.** | Decidido: se mantiene la regla del 24/09. Estas dos listas muestran el estado tal cual lo carga la planilla (6.429 piezas-localidad con ESTADO activo al 14/10). Las fechas rigen solo en las cards, el color, la cobertura y el mail (5.557 activas). Las dos cifras son correctas y miden cosas distintas: el manual las nombra “Con ESTADO activo” y “Activa”. |
| 4 | **Pauta provincial.** | Entra en el mail de vencimientos pero no en la cobertura ni en el color. Se acepta porque responden preguntas distintas; el área debe confirmar que el mail incluya lo provincial. |
| 5 | **PROGRAMADO con INICIO ya pasado.** | 23 filas. Corregir ESTADO en la planilla. |
| 6 | **OBSERVADO con fechas en curso.** | Unas 13 piezas OBSERVADO con fechas en curso (unidad por confirmar: filas o piezas-localidad) que antes disparaban aviso en el mail y ahora no, porque ya no se consideran activas. Decidido: no son activas y no avisan. |
| 7 | **Métricas y link de destino.** | Se cargan y se leen, pero no se muestran en ninguna pantalla. La columna “Alcance” de la pestaña Pauta Digital queda en “—”. Definir si se van a mostrar. |
