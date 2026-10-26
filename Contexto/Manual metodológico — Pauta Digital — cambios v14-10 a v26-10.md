# Manual metodológico — Pauta Digital: cambios del 14/10 al 26/10/2026

Qué cambió entre `Manual metodológico — Pauta Digital (v14-10).md` y `Manual metodológico — Pauta Digital.md`. Las reglas vienen de las decisiones D1–D7 y B1–B3; los números, de la corrida del generador del 26/10/2026 con la planilla del 23/10 (MD5 `33ab84dd4f71f86133d2a1c3ee5399e8`).

| Sección | Cita del manual anterior | Texto nuevo | Por qué |
| --- | --- | --- | --- |
| Encabezado | “Borrador para validación del área · Oct 14, 2026” | “Versión para validación del área · 26/10/2026 · reemplaza al borrador del 14/10/2026” | Versión nueva |
| Para qué sirve | “carga del 11/10/2026 (4.009 filas), vista con fecha 14/10/2026” | “planilla del 23/10/2026 … MD5 33ab84dd… 4.941 filas reales, con fecha de control 26/10/2026” | Carga nueva |
| Para qué sirve | “Versión del tablero: describe el tablero con los cambios de alertas y cobertura que están en revisión…” | (se saca) y se agrega la lista de archivos que acompañan cada carga | Los cambios ya están en el tablero; archivos A–C |
| Glosario · Fila real | “es un renglón arrastrado por las fórmulas” | “es un renglón vacío o arrastrado” | La hoja trae 45.558 renglones solo con formato |
| Glosario · Las 60 | “Una localidad que no está entre ellas no se atribuye a ninguna.” | “Una localidad que no está entre ellas queda fuera del tablero.” | D1 |
| Glosario | — | Nuevas entradas: “Universo del tablero”, “Entrada”, “Duplicada” | D1, D4 |
| Glosario · Alcance | “una localidad, un circuito de Capital, un departamento o toda la provincia” | “una localidad, un circuito de Capital, las localidades de un departamento o toda la provincia” | D1: el ámbito departamento desaparece |
| Glosario · Dirigida | “La pauta de toda la provincia y la que solo tiene departamento no son dirigidas.” | “La pauta de toda la provincia no es dirigida.” | D1 |
| Glosario · COD. CONTENIDO | “El código de la pieza. Sirve para detectar duplicados.” | “Es solo informativo: … no decide si una fila entra, si es duplicada, si es nueva ni si se dio de baja.” | D3 |
| Glosario · Pieza-localidad | “unas 16.000 con solo 4.009 filas” | “18.691 con 4.618 filas que entran” | Números de la carga |
| Glosario · Pieza única | “Combinación de COD. CONTENIDO + campaña + título” | “Pieza: CAMPAÑA + TITULO DE LA PIEZA (normalizados)” | D3, D5 |
| Camino de una fila · 3 | “¿A qué localidades llega? … una localidad, un circuito de Capital, un departamento o toda la provincia.” | “¿Está dentro del universo y a qué localidades llega? … Cualquier otra cosa queda fuera.” | D1 |
| Camino de una fila · 4 | “Si repite COD. CONTENIDO, campaña, título y localidad con otra fila, se unifican.” | “Si en una localidad coincide … en CAMPAÑA, TITULO, PLATAFORMA, INICIO, FIN, LINK MATERIAL, TIPO DE MATERIAL y AUDIENCIA, queda una sola.” | D4 |
| Qué es pauta activa · tabla | 1.573 / 1.529 / 1.445 filas; 6.429 / 5.557 / 2.169 piezas | 1.261 (40) / 1.258 (40) / 1.212 (37) filas; 4.755 / 4.752 / 1.994 piezas | Carga y reglas nuevas |
| Qué es pauta activa | “el nivel 2 tiene 52 campañas y el nivel 3 tiene 49” | 40 y 37 campañas; sin duplicadas; con duplicadas 1.275 / 1.272 / 1.226 filas | Carga nueva; D4 |
| Qué es pauta activa | “Hay tres razones” | “Hay cuatro razones”, se agrega “Filas fuera del universo” (323) | D1 |
| Qué es pauta activa | “Al 14/10 hay 44 filas así (872 piezas-localidad)” | “Al 26/10 hay 3 filas así” | Carga nueva |
| Planilla y columnas | “Si un encabezado cambia o falta, la actualización del tablero se corta” | “… se corta y el aviso dice qué columna falta … El corte es parcial: los datos de otras áreas que se generan antes ya quedaron actualizados” | D7 |
| Planilla y columnas · siete columnas | “AA y AB · ` INICIO  ` y `FIN`” | “AA y AB · `INICIO ` y `FIN`”; se agrega la fila G, L, Q, V (columnas de duplicados) | D7; D4 |
| Planilla y columnas · K | “`COD. CONTENIDO` · Clave para detectar duplicados · Recomendada” | “Informativo: se guarda, no decide nada · Opcional” | D3 |
| Planilla y columnas | — | Filas nuevas: G `AUDIENCIA  (Barrios o publicos) `, O `ORIGEN`, V `TIPO DE MATERIAL`, AF a BL métricas, BN `PROVEEDOR` | D4, D6, D7 |
| Planilla y columnas · AA | “` INICIO  ` (con espacio al final)” | “`INICIO ` (con un espacio al final)” | D7 |
| Planilla y columnas | “El tablero no lee, entre otras, `AUDIENCIA`, … `TIPO DE MATERIAL` …” | Se sacan `AUDIENCIA` y `TIPO DE MATERIAL` de la lista (ahora se leen, solo para duplicados) | D4, D6 |
| Planilla y columnas | — | Párrafo nuevo: `NA`, `N/A`, `null`, `None`, `nan`, `#N/A` se leen como vacío | D7 |
| Planilla y columnas | “Las letras son las del archivo de la carga del 11/10 (77 columnas)” | “… de la carga del 23/10 (77 columnas, hasta BY)” | Carga nueva |
| Fila real · tabla | “CAMPAÑA y TITULO DE LA PIEZA vacíos · Se descarta como arrastre de fórmulas · 0” | Filas nuevas: renglón sin ningún valor (45.558); arrastre (0); fuera de Córdoba (2, filas 1147 y 1148); localidad fuera de las 60 (321); departamento sin las 60 (0); pendiente (0); duplicada (71) | D1, D4, D7 |
| Fila real · tabla | “Fila repetida para la misma localidad · Se unifica con otra · 17 filas colapsadas” | “Fila repetida para las mismas localidades · Duplicada: pierde todas sus entradas · 71” | D4, D7 |
| Fila real | “En cargas anteriores hubo entre 368 y 545 filas de arrastre; en esta, ninguna.” | “Cada fila que no entra queda en `Filas_no_procesadas_Pauta_Digital.xlsx` …” | Archivo A |
| Geografía · título | “Geografía: a qué localidad llega cada fila” | “Geografía: qué filas entran y a qué localidad llegan” | D1 |
| Geografía · tabla fila 5 | “E es un departamento sin ninguna de las 60 · Solo departamento, sin localidad” | “Fuera del tablero · 0” | D1 |
| Geografía · tabla fila 7 | “F es otra localidad real que no está entre las 60 · Solo departamento, sin localidad · dentro de 305 → 305” | “F es otra localidad que no está entre las 60 · Fuera del tablero · 321 → 0” | D1 |
| Geografía · tabla fila 8 | “F vacío · Sin ámbito: no se atribuye a nada · 0” | “F vacío · Pendiente: fuera del tablero · 0” (pasa a la fila 2) | D1 |
| Geografía · tabla | “425 → 411”, “1.466 → 3.230”, “159 → 9.540”, “1.652 → 1.649” | “473 → 473 → 441”, “2.207 → 4.973 → 4.962”, “195 → 11.700 → 11.574”, “1.743 → 1.743 → 1.714” (filas → entradas → piezas) | Carga nueva; D2; D4 |
| Geografía · reglas finas | ““Todas las localidades” no se reconoce y la fila cae como departamento.” | “… no se reconoce: la fila queda fuera por localidad.” | D1 |
| Geografía · reglas finas | — | “Alias reconocidos (los únicos): `CÓRDOBA CAPITAL` … `VILLA SANTA ROSA DE RIO` es VILLA SANTA ROSA, solo cuando DEPARTAMENTO es Río Primero (14 filas: 5 ACTIVO, 9 INACTIVO)” | D2 |
| Geografía · reglas finas | “E no se valida contra F. … (caso A06049, Villa Carlos Paz con CAPITAL)” | “E no se valida contra F. …” (sin el caso por COD) | D3 |
| Geografía · reglas finas | “Los circuitos de 2 dígitos no se reconocen como circuito.” | “… : la fila queda fuera por localidad.” | D1 |
| Geografía · reglas finas | “No hay salto a departamento. … solo figura en la pestaña Pauta Digital y en Campañas, con la etiqueta del departamento.” | “Una localidad que no es de las 60 queda fuera del tablero. No se atribuye a su departamento ni aparece en ninguna pantalla; figura en `Filas_no_procesadas…` y en `Nombres_a_confirmar…`.” | D1 |
| Geografía · reglas finas | “Si al reproducir no se ignora el “DE”, las piezas activas dirigidas bajan de 2.169 a 1.139.” | (se saca) | Número de la carga vieja, no recalculado |
| Geografía · ejemplos | “la fila 954 (COD A05599 …) … La fila 960 (COD A05606 …)” | Ejemplos sin número de fila ni COD | Las filas 954 y 960 hoy son otras piezas; D3 |
| Estado y fechas · tabla | “1.573 → 6.429”, “2.311 → 8.567”, “73 → 87”, “52 → 52”, “0” | Columnas filas reales / filas que entran / piezas: ACTIVO 1.293 / 1.275 / 4.755; INACTIVO 2.568 / 2.266 / 10.343; OBSERVADO 1.071 / 1.068 / 3.053; PROGRAMADO 0; vacío 9 (954 a 962) / 9 / 540 | Carga nueva |
| Estado y fechas | “Los conteos por estado suman 4.009 filas e incluyen las 2 excluidas…” | “‘Filas que entran’ ya descuenta las 323 que quedan fuera del universo…” | D1 |
| Estado y fechas | “el tablero lo lee con el mes primero: “05/10/2026” se leería como 10 de mayo” | “… con el mes primero cuando la fecha es ambigua … Si no es ambigua (“25/10/2026”), la lee bien.” | D7 |
| Estado y fechas | “424 filas sin ninguna de las dos (387 INACTIVO y 37 OBSERVADO)” | “992 filas sin ninguna de las dos (601 OBSERVADO, 382 INACTIVO y 9 con ESTADO vacío) y 2 con una sola (filas 2714 y 2825)” | Carga nueva |
| Estado y fechas | “Al 14/10 son 44 filas (872 piezas-localidad).” | “Al 26/10 son 3 filas.” | Carga nueva |
| Estado y fechas | “PROGRAMADO con INICIO ya pasado: hay 23 filas” | “… En esta carga no hay filas PROGRAMADO.” | Carga nueva |
| Estado y fechas | “la carga actual es del 11/10” | “la carga actual es del 23/10” | Carga nueva |
| Duplicados | “El tablero unifica dos piezas cuando coinciden en COD. CONTENIDO, CAMPAÑA, TITULO DE LA PIEZA y localidad asignada.” | “Dos entradas son la misma pieza si, en la misma localidad, coinciden en CAMPAÑA, TITULO DE LA PIEZA, PLATAFORMA, INICIO, FIN, LINK MATERIAL, TIPO DE MATERIAL y AUDIENCIA.” + reglas de normalización | D4 |
| Duplicados · desempate | “1. La de FECHA DE ENVÍO más reciente. 2. … ACTIVO. 3. … primera” | “1. La entrada dirigida antes que la provincial. 2. FECHA DE ENVÍO más reciente. 3. ESTADO = ACTIVO. 4. La primera de la planilla.” + “Las métricas nunca se suman” | B2, D4 |
| Duplicados | “Sin COD. CONTENIDO no hay deduplicación. … 1.989 filas (49,6 %) …” | “`COD. CONTENIDO` no se mira: … una sin código se compara igual que las demás.” | D3 |
| Duplicados | “El COD solo no alcanza. 45 de 1.955 códigos…” | (se saca) | D3 |
| Duplicados | “La comparación es literal. `137` como número y `"137"` como texto son códigos distintos…” | “Sin distinguir mayúsculas ni tildes, sin espacios al principio o al final… Una celda vacía coincide con otra vacía.” | D4 |
| Duplicados | “Resultado actual: 17 filas colapsadas en 16 grupos.” | “188 grupos de duplicados, 198 entradas descartadas y 71 filas duplicadas (15 filas más perdieron solo algunas entradas)… 134 parejas: en 116 las métricas son distintas” | D4, D7 |
| Duplicados | “Una fila sin código es válida si figura como activa. Para evitar duplicados no detectados conviene cargar siempre el código.” | “Una fila es duplicada solo si perdió todas sus entradas…” | D3, D4 |
| Sección nueva | — | “Control de bajas entre cargas”: compara campaña + título, no el COD; salidas por cambio de regla (236) no cuentan; 0 bajas | D5, B1 |
| Alertas · cobertura | “La provincial genérica y la que tiene solo departamento no pintan la localidad” | “La provincial genérica no pinta la localidad” + estado al 26/10 (60 con PD dirigida; 3 rojo, 2 amarillo, 55 verde) | D1 |
| Alertas · mail | “Incluye la pauta provincial y la de departamento, a diferencia de la cobertura.” | “Incluye la pauta provincial, a diferencia de la cobertura.” | D1 |
| Alertas · mail | “Al 14/10 son 47 líneas.” | “Al 26/10 son 15 líneas (ventana del 26/10 al 02/11).” | Carga nueva |
| Qué fila en qué pantalla | “Fuera de Córdoba o arrastre de fórmulas · No · No · No · No · No” | “Fuera de Córdoba, fuera del universo (localidad fuera de las 60), pendiente o arrastre · No …” + fila nueva “Duplicada · No …” | D1, D4 |
| Qué fila en qué pantalla | “Solo departamento · No · No · Sí · Sí, con “Depto. X” · Sí, si activa y FIN en 7 días” | (fila eliminada) | D1 |
| Qué fila en qué pantalla | “En Córdoba la tabla tiene 1.217 piezas y la tarjeta 174.” | “… 1.146 piezas y la tarjeta 171.” | Carga nueva |
| Qué fila en qué pantalla | “más “Vigente” (6.429) que las cards (5.557 activas)” | “más “Vigente” (4.755 piezas-localidad) que las tarjetas (4.752 activas)” | Carga nueva |
| Cómo reproducir · reglas de oro | “El tablero tiene la carga del 11/10.” / “Escribirla en una celda … no `HOY()`.” | “… carga del 23/10.” / se agrega la variable `PD_FECHA_CONTROL` (aaaa-mm-dd) como única forma de fijar la fecha del lado del tablero | D7 |
| Cómo reproducir · Paso 1 | “`CG1` … `CH1` … más `CÓRDOBA CAPITAL`” | “`CI1` … `CJ1` … más los alias `CÓRDOBA CAPITAL` y `VILLA SANTA ROSA DE RIO`” + hoja `Duplicadas` con las 71 filas | D2, D4 (la columna CG pasa a ser una auxiliar) |
| Cómo reproducir · Paso 2 | “seis columnas auxiliares … `CA` a `CF` … hasta … la 4010” | “siete columnas auxiliares … `CA` a `CG` … hasta la 4942”; nueva CE “Entra”; CF Dirigida; CG Vence en 7 días; referencias a `$CJ$1` | D1, D4 |
| Cómo reproducir · CD | categoría final `"Otra"` | categoría final `"Fuera del universo"` | D1 |
| Cómo reproducir · CD | “Caso raro: una fila “TODAS LAS LOCALIDADES” de un departamento que no tiene ninguna de las 60 no es dirigida en el tablero, y esta fórmula la marca como dirigida.” | “Dos casos que la fórmula no distingue y el tablero sí: un circuito de 2 dígitos … y “TODAS LAS LOCALIDADES” de un departamento sin ninguna de las 60 … En esta carga no hay ninguno de los dos.” | D1 |
| Cómo reproducir | — | Párrafo nuevo sobre AUDIENCIA (G), PLATAFORMA (L), LINK MATERIAL (Q) y TIPO DE MATERIAL (V) | D4 |
| Cómo reproducir · Paso 3 | `AA2:AA4010` | `AA2:AA4942` | Carga nueva |
| Cómo reproducir · Paso 4 | Fórmulas con `CA:CA;1;CB:CB;1`; 1.573 / 1.529 / 1.445 (14/10) y 1.573 / 1.522 / 1.442 (15/10) | Fórmulas con `CE:CE;1`; 1.261 / 1.258 / 1.212 (26/10 y 27/10); sin la hoja Duplicadas 1.275 / 1.272 / 1.226 | D1, D4; carga nueva |
| Cómo reproducir · Paso 5 | Filtros `Real`, `Córdoba`, `Activa`; “Esperado: 52 campañas activas y 49 activas dirigidas” | Filtros `Entra`, `Activa`; “Esperado: 40 … y 37 …” | D1; carga nueva |
| Cómo reproducir · Paso 6 | “entra también la pauta de toda la provincia y la de departamento. Esperado: 47 líneas … 14/10 y 46 … 15/10.” | “entra también la pauta de toda la provincia. Esperado: 15 líneas con fecha de control 26/10 y 15 con 27/10 (77 filas).” | D1; carga nueva |
| Cómo reproducir · números de control | Tabla 14/10 y 15/10 | Tabla 26/10 y 27/10, con filas reales (4.941) y filas que entran (4.547) | Carga nueva |
| Cómo reproducir | “(5.557 activas y 2.169 dirigidas el 14/10)” | “(4.752 activas y 1.994 dirigidas el 26/10)” | Carga nueva |
| Cómo reproducir · si no coincide | “2. … (carga del 11/10)” / 6 puntos | “2. … (carga del 23/10)” / 7 puntos: alias en `Las60` y hoja `Duplicadas` | D2, D4 |
| Cómo reproducir | “existe un archivo de verificación con una fila por cada una de las 4.009 filas de origen” | “`Filas_no_procesadas_Pauta_Digital.xlsx` trae en la hoja Resumen el cuadre completo…” | Archivo A |
| Checklist | “(ojo con ` INICIO  ` y `UTM´S`)” | “(ojo con `INICIO ` con un espacio al final, `UTM´S` y `AUDIENCIA  (Barrios o publicos) `)” | D7, D4 |
| Checklist | “LOCALIDAD / SUBCIRCUITO usa uno de los formatos reconocidos: `LOCALIDAD, …`” | “… con una de las 60 localidades … Una localidad que no es de las 60 queda fuera del tablero.” | D1 |
| Checklist | “COD. CONTENIDO completo y no reutilizado en otra combinación de campaña y título.” | “Dos piezas distintas no comparten a la vez CAMPAÑA, TITULO, PLATAFORMA, INICIO, FIN, LINK MATERIAL, TIPO DE MATERIAL y AUDIENCIA en la misma localidad…” | D3, D4 |
| Checklist | “Un código ya cargado no desaparece entre cargas (el tablero frena la actualización si falta uno).” | “Una pieza ya cargada (campaña + título) no desaparece entre cargas: el tablero frena la actualización si falta una.” | D5 |
| Puntos abiertos · 1 | “Son 193 filas (28 con ESTADO ACTIVO)” | “Son 256 filas reales (26 con ESTADO ACTIVO)” | Carga nueva |
| Puntos abiertos · 2 | “Filas sin COD. CONTENIDO. · Se consideran válidas si figuran como activas. El área debe confirmar…” | “COD. CONTENIDO. · Decidido: es solo informativo… 2.097 filas reales no tienen código” | D3 |
| Puntos abiertos · 3 | “(6.429 piezas-localidad con ESTADO activo al 14/10) … (5.557 activas)” | “(4.755 … al 26/10) … (4.752 activas)” | Carga nueva |
| Puntos abiertos · 5 | “PROGRAMADO con INICIO ya pasado. · 23 filas. Corregir ESTADO en la planilla.” | “Localidades fuera de las 60. · Decidido: quedan fuera del tablero (321 filas, 18 de ellas ACTIVO)…” | D1; no hay PROGRAMADO en esta carga |
| Puntos abiertos · 6 | “OBSERVADO con fechas en curso. · Unas 13 piezas …” | Punto 6 nuevo “Parejas duplicadas” (134; 116 con métricas distintas); OBSERVADO pasa al 7: “1.071 filas OBSERVADO (eran 73 en la carga del 11/10)” | D4; carga nueva |
| Puntos abiertos | “Siete puntos” | “Ocho puntos” | Se suman localidades fuera de las 60 y parejas |
