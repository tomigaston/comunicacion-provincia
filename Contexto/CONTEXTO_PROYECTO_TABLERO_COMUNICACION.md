# Contexto — Tablero de Comunicación, Gobierno de Córdoba

## 1. Objetivo

El gobernador pidió un tablero para ver, de un vistazo, **qué se está publicitando y qué no** en las **60 localidades prioritarias** de la provincia, en todos los formatos (TV, radio, cartelería, redes, digital, audiovisual). Hoy 3 áreas trabajan sin coordinación entre sí y no hay visión conjunta: puede haber una localidad sin nada de publicidad, un tema repetido, o algo vencido hace meses sin que nadie lo note.

Lo usa principalmente **[el usuario]**, que consolida y reporta al gobernador. Las áreas que generan los datos y el propio gobernador también son usuarios potenciales. La visualización final tiene que ser **clara y sencilla de leer** — es lo que más importa en esa etapa.

## 2. Universo del tablero — REGLA FIJA

**El universo son siempre las 60 localidades prioritarias**, cada una con su Departamento correspondiente (listado oficial ya definido, no se negocia por área).

**Ya no hay ninguna excepción: las 4 áreas usan la misma regla, sin nivel intermedio de Departamento.** Pauta Digital dejó de tenerlo el **20/08/2026**, tras detectarse un bug real: piezas de alcance Departamento/Provincia se colaban en el panel de una Localidad puntual a la que no correspondían (caso Alta Gracia — ver `scripts/test_pauta_digital.py`). SMS dejó de tenerlo el **22/08/2026**, por el mismo criterio (ver 3.4). En las 4 áreas la regla es **sin excepciones**: un dato se atribuye a una Localidad solo si su Localidad puntual es una de las 60; si no, no se propaga a ningún Departamento en ningún panel de Localidad.

Todo dato de cualquier área que no pertenezca a las 60 localidades **queda fuera del tablero** — no se crean localidades nuevas, no se expande el universo, y ya no se sube un nivel a "su" Departamento. Esto se probó y se revirtió una vez: no volver a repetir el error de agregar localidades "extra" fuera de las 60.

## 3. Las 4 áreas de comunicación

Trabajan separadas, sin comunicación entre sí, cada una con su propia base y formato.

**Aclaración importante**: "Pauta digital" y "Pautado" **son la misma área** — un error de redacción del contexto original las nombró como si fueran dos cosas distintas. Es una sola área (3.2), no dos.

### 3.1 Medios tradicionales — archivo del proyecto: **"Medios tradicionales"**
TV, radio, web, cartelería, vía pública, gráfica, pantalla LED. Reporte **semanal** (viernes = foto de esa semana), por Localidad + Tipo de medio. El archivo que se sube al proyecto es el **maestro acumulado** (`MAESTRO_TABLERO_COMUNICACION.xlsx`), con hojas: `Localidades` (las 60 oficiales), `Historico` (log semanal acumulado, append-only), `Maestro_Vigente` (estado actual por localidad+medio: tema vigente, semanas consecutivas, alerta), `Cambios_Ultima_Semana`, `Cobertura` (matriz localidad × tipo de medio, semana más reciente), `Parametros` (umbrales de alerta).

**Regla de "mismo tema"** (confirmada con el área): si el texto completo de "temas vigentes" para una combinación Localidad+Tipo de medio es idéntico entre dos semanas consecutivas, sigue la misma racha. Si cambia, se reinicia. Es una comparación de bloque completo, no de cada tema individual dentro de la lista (simplificación conocida y aceptada).

**Alertas de antigüedad** (🟡 revisar / 🔴 sin cambios hace mucho): el mecanismo existe (umbrales editables en `Parametros`) pero **no se muestran todavía** — con solo 2 semanas de histórico no son confiables. Se activan solas cuando haya más semanas cargadas.

Ya existe una **skill** (`actualizar-tablero-comunicacion-cordoba`) que procesa cada planilla semanal nueva contra el maestro: normaliza localidades (typos conocidos, ej. "Malvina Argentinas" → "Malvinas Argentinas"), valida consistencia, actualiza `Historico` y regenera las hojas derivadas.

### 3.2 Pauta digital (= Pautado) — archivo del proyecto: **"Medios digitales"**
Exportado de gestor de pauta paga (Meta/redes), enero–julio 2026, ~1181 filas. El dato geográfico **no viene en una columna separada** — está mezclado dentro de "Nombre del anuncio" (formato: código de 14 caracteres — 9 letras + 5 números — seguido de " - " y luego el resto, donde vive el alcance geográfico y lo que llamamos "Campaña").

Alcance real detectado: 457 filas a nivel Departamento, 260 Provincia entera, 234 Capital (=Departamento Capital + Localidad Córdoba), 120 códigos de audiencia (sin geografía, a revisar manualmente), 71 Localidad puntual, 15 no clasificables, 10 Región (descartadas, no se desagregan), 9 Barrio, 6 Circuito electoral.

El archivo curado ya tiene 4 columnas agregadas: `Departamento`, `Localidad`, `Barrio`, `Circuito_Electoral`, más una columna de auditoría `Alcance_Detectado`. Trae también **métricas reales** por pieza: Alcance, Frecuencia, Impresiones, Visualizaciones, CPM, Importe gastado, Presupuesto, Clics, CTR — hay que mostrarlas, no solo un conteo.

**Estado (Vigente/Finalizada)** se calcula comparando "Finalización" contra la fecha de hoy — esto ya está bien en pauta digital, es el patrón a replicar en las demás áreas.

### 3.3 Audiovisuales (Subsecretaría de Comunicación) — archivo del proyecto: **"Audiovisuales"**
Excel unificado en **una sola hoja** ("Localidades y Campañas"), con dos orígenes fusionados en un esquema común: `Origen` (25 localidades / Obras FOCOM), `Fecha_Carga`, `Campaña`, `Tipo_Contenido`, `Departamento`, `Localidad`, `En_60_Prioritarias`, `Fecha_Inicio`, `Fecha_Fin`, `Link`, `Copy`, `Sugerencias_Pauta`, `Notas`.

Puntos importantes:
- La columna se llama **"Campaña"** a propósito — es el mismo concepto que en medios tradicionales y pauta digital (ver sección 4).
- **Obras FOCOM no tiene concepto de "Campaña"** — son piezas únicas ligadas a una obra pública puntual en una localidad, no algo que se repite en varios lugares. No entra en la vista de Campañas.
- De las localidades de Obras FOCOM, la gran mayoría (48 de 52) **no están entre las 60 prioritarias** — son localidades más chicas, fuera del universo del tablero (ver regla de sección 2).
- **Bug conocido a corregir en la build real**: el estado quedó hardcodeado en "Vigente" en el prototipo, sin calcularlo contra la fecha de hoy como sí hace pauta digital. Corregir con el mismo patrón de 3.2.
- Ojo con fechas: en un momento se detectaron 30 filas de Obras FOCOM con año mal cargado (2026 en vez de 2025) por autocompletado de Excel — ya corregido en el archivo curado, pero es un recordatorio de **auditar fechas contra una columna de referencia** antes de confiar en ellas, en cualquier fuente nueva que llegue.

### 3.4 SMS — archivo del proyecto: **"SMS"**

Export acumulado completo de envíos de SMS ("SMS_Looker - `<fecha>`.xlsx", nombre con fecha variable, 2 hojas). **A diferencia de Medios tradicionales (append-only semanal), cada actualización REEMPLAZA el archivo anterior y reprocesa todo desde cero** — mismo patrón que Pauta Digital, no el de Medios tradicionales. Procesado por la skill `procesar-sms-cordoba`.

**No confundir con el proyecto de Circuitos electorales**, aunque esta base también tenga una columna `CIRCUITO` (por ahora se deja sin procesar, pasa como dato crudo — no se cruza con ese otro proyecto sin confirmación explícita aparte).

**Hojas del archivo fuente:**
- `Sms_Looker`: una fila por envío. Columnas relevantes: `EJE`, `DEPARTAMENTO` (no confiable, ver abajo), `FECHA DE INICIO`, `ESTADO`, `TEMATICA`, `CATEGORIA`, `MENSAJE`, `ZONA`, `AUDIENCIA\n(LOCALIDADES O BARRIOS)`, `CANTIDAD DE SMS ENTREGADOS`, `CIRCUITO`.
- `Nomenclador Maestro`: no es un dataset por fila, son listas de validación de Sheets. Solo importan `DEPARTAMENTO CON DESAGREGADO PARA LA LOCALIDAD` + `LOCALIDAD / SUBCIRCUITO` juntas — forman el padrón oficial de localidades por departamento de **toda la provincia** (no solo las 60). El resto de columnas de esa hoja se ignora.

**La columna `DEPARTAMENTO` de `Sms_Looker` no es confiable como filtro** — hay filas donde no coincide con lo que realmente lista `AUDIENCIA`. No se usa para acotar candidatos de matching. Desde el cambio de regla del **22/08/2026** (ver más abajo) el único uso que le queda es reconocer si una fila con `AUDIENCIA` = "DEPTO COMPLETO" corresponde al departamento Capital.

**Cambio de regla del 22/08/2026: SMS ya no tiene nivel intermedio de Departamento** (mismo criterio que Pauta Digital desde el 20/08/2026 y Contenido Orgánico — ver sección 2). Antes de este cambio, un token que no era una de las 60 pero sí figuraba en el Nomenclador Maestro (o que no matcheaba nada) caía a un alcance de tipo Departamento. Eso se eliminó por completo: ahora un token o resuelve exacto/fuzzy a una de las 60, o no genera ningún alcance. El Nomenclador Maestro (segunda hoja del archivo fuente) ya no se usa para nada en el procesamiento de SMS.

**Regla de alcance geográfico por `ZONA`:**
- `ZONA` = `CAPITAL`, `CÓRDOBA`, `CAPITAL + PROVINCIA` → resuelve directo a la **localidad CORDOBA** (es una de las 60, no un Departamento). No se desagrega por barrio (los barrios quedan fuera de este tablero, van a otro proyecto aparte). Se ignora el contenido de `AUDIENCIA` en este caso.
- `ZONA` = `PROVINCIA` → se separa `AUDIENCIA` en tokens (ver split abajo) y cada uno se matchea contra las 60 localidades prioritarias:
  - Matchea (exacto o fuzzy) una de las 60 → alcance de tipo Localidad.
  - No matchea ninguna de las 60 → no genera ningún alcance, y se loguea como "no identificado" para revisión manual (puede ser un lugar real fuera de las 60, o directamente basura de carga).
- `AUDIENCIA` = literalmente `"DEPTO COMPLETO"` (celda completa) → si la columna `DEPARTAMENTO` de la fila es Capital, resuelve a la localidad CORDOBA (la localidad Capital cubre igual todo el departamento); para cualquier otro departamento, ya no hay ningún ámbito que lo represente → sin desagregación geográfica. En los datos reales (confirmado el 22/08/2026) las 12 filas con "DEPTO COMPLETO" son siempre de Capital.
- Un token de `AUDIENCIA` que, ya separado (ver split abajo), es exactamente `"CAPITAL"` → resuelve a la localidad CORDOBA para ese token. Se evalúa **token por token, no celda completa**: si `AUDIENCIA` trae "Río Cuarto, Capital", el token "Capital" igual resuelve a CORDOBA aunque comparta la celda con otro token.
- `ZONA` = `Base particular`, o cualquier valor de `ZONA` que no sea uno de los reconocidos arriba (bases de datos, "Números particulares", nombres de archivo `.xlsx` colados, rangos etarios, "Jubilados provincia y ciudad", etc.) → **"sin desagregación geográfica"**. La fila se mantiene para totales generales (por tema, eje, fecha) pero se excluye de cualquier vista por localidad. Cualquier `ZONA` no reconocida se loguea aparte (`zonas_no_reconocidas` en `data/sms.json`) para confirmar que no sea en realidad geográfica.

**Separar tokens dentro de `AUDIENCIA`:** split por `" - "`, `","` y saltos de línea (`\n`); limpiar paréntesis con rangos etarios (ej. "(25-45)"); normalizar con NFD (sacar tildes) + `.strip().upper()` (mismo patrón que el resto del proyecto). Match exacto contra las 60 primero, fuzzy (`difflib`, cutoff 0.7, contra las 60 solamente) como fallback.

**Tabla de excepciones** (ya resueltas a mano, hardcodeadas en `EXCEPCIONES_AUDIENCIA_SMS` de `scripts/generar_datos.py`):

| Token normalizado en AUDIENCIA | Resolución |
|---|---|
| CARLOS PAZ | → VILLA CARLOS PAZ (en las 60) |
| TOTORAL | → VILLA DEL TOTORAL (en las 60) |
| CURA BROCHERO | → VILLA CURA BROCHERO (en las 60) |
| VILLA CIUDAD PARQUE | VILLA CIUDAD PARQUE LOS REARTES no está en las 60 → sin alcance |
| LA CARLOTA LABOULAYE CANALS | → split en 3: LA CARLOTA (en las 60) + LABOULAYE (en las 60) + CANALS (no está en las 60 → sin alcance para ese tramo) |
| TANINGA | No está en las 60 → sin alcance |
| LOS GIGANTES | No está en las 60 → sin alcance |
| CERRO BLANCO | No está en las 60 → sin alcance |
| CORRAL DE BUSTOS | CORRAL DE BUSTOS - IFFLINGER no está en las 60 → sin alcance |
| VILLA SARMIENTO | VILLA SARMIENTO (M) no está en las 60 → sin alcance |
| MONTEBUEY | MONTE BUEY no está en las 60 → sin alcance |
| CAPITÁN GENERAL BERNARDO O'HIGGINS | No está en las 60 → sin alcance |
| ARROYO LOS PATOS | ARROYO DE LOS PATOS no está en las 60 → sin alcance |
| HUANCHILA | HUANCHILLA no está en las 60 → sin alcance |
| HIGUERAS | LAS HIGUERAS no está en las 60 → sin alcance |
| B° LA FLORESTA | Es barrio de la ciudad de Córdoba (no localidad de interior) → **afuera del universo del tablero**, no genera ningún alcance — los barrios van a otro proyecto aparte |
| CAPITAL (como token individual tras el split, comparta celda o no con otros tokens) | → localidad CORDOBA |

Cualquier token nuevo que no matchee y no esté en esta tabla: no se asume, se loguea aparte (`no_identificados` en `data/sms.json`) para que el usuario lo clasifique a mano, igual que se hizo con estos — y no genera ningún alcance. Si una fila termina con **todos** sus tokens de `AUDIENCIA` sin alcance (ej. una fila cuya única mención es "B° La Floresta", o un token que no matchea ninguna de las 60), la fila se trata como **"sin desagregación geográfica"** — se mantiene para totales generales pero no aporta ningún alcance por Localidad. Si una excepción hardcodeada de tipo "localidad" ya no resuelve contra las 60 (ni exacto ni por fuzzy — señal de que algo cambió desde que se cargó esa excepción a mano), se loguea aparte en `excepciones_sin_resolver` dentro de `data/sms.json`, para revisión manual — no se asume ningún alcance por intuición.

**`TOKENS_CONFIRMADOS_SIN_LUGAR_SMS`** (sumada el 22/08/2026, 56 tokens): un token que no matchea ninguna de las 60 ya se comporta bien por default (no genera alcance), pero como el export es acumulado completo, ese mismo token reaparecería en `no_identificados` en cada corrida futura, mezclado con lo que sea genuinamente nuevo. Esta lista NO agrega ninguna resolución nueva — solo filtra el log: un token ya revisado y confirmado como "no es ninguna de las 60" (localidad real de la provincia fuera de las 60, o segmento no geográfico como una base de datos o un rango etario) deja de listarse en `no_identificados`, sin dejar de comportarse igual (sigue sin alcance). Un token nuevo, no confirmado todavía, sí se sigue listando.

**Regla sobre `CANTIDAD DE SMS ENTREGADOS` (no reabrir):** cuando una fila tiene varias localidades/departamentos en `AUDIENCIA`, **no se prorratea** el número entre ellas — no hay base real para hacerlo. Cada lugar mencionado queda marcado como "alcanzado" por ese envío, sin número propio. El número queda a nivel de la fila/envío completo para totales (por tema, eje, fecha).

**Columna `CIRCUITO`:** no se procesa todavía, pasa como dato crudo (`circuito_raw`). No cruzar con el proyecto de Circuitos electorales sin confirmación explícita aparte.

### 3.5 Contenido Orgánico (GNO) — archivo del proyecto: **"Publicaciones GNO"**

Export acumulado completo de publicaciones orgánicas en redes propias del Gobierno ("Publicaciones GNO 2026 - `<fecha>`.xlsx", nombre con fecha variable, hoja `Hoja 1`; `Hoja 2` viene vacía). **Igual que Pauta Digital y SMS, cada actualización REEMPLAZA el archivo anterior y reprocesa todo desde cero.** Procesado por la skill `procesar-contenido-organico-cordoba`.

**Columnas:** `FECHA`, `RED SOCIAL`, `NOMBRE DEL CONTENIDO ` (con espacio final en el header real), `LINK ` (ídem), `LUGAR`.

**Limpieza previa (obligatoria antes de cualquier matching):**
1. **Forward-fill de `FECHA`** hacia abajo — solo la primera fila de cada tanda de redes sociales trae fecha propia.
2. **Descartar filas de plantilla vacía**: cualquier fila sin `RED SOCIAL`, sin `NOMBRE DEL CONTENIDO ` y sin `LINK ` — se da en cualquier posición del archivo (no solo al final: hay separadores intermedios con el mismo patrón), verificado contra el archivo real que ninguna de esas filas trae `LUGAR` cargado.
3. **Excluir cualquier fila donde `LUGAR` contenga "http"** (error de carga, link pegado ahí) — se trata como si `LUGAR` estuviera vacío, logueada aparte en `lugares_con_link_excluidos`.
4. **`LUGAR` recién se usa en serio desde el 29/07/2026** — antes está vacío en el 100% de los casos reales (la única excepción encontrada antes de esa fecha fue justamente un caso del punto 3, un link pegado por error). No es un bug, no hay que rellenar nada para atrás; las vistas por localidad simplemente no tienen datos de esta área antes de esa fecha.

**Regla de alcance geográfico — NO hay nivel intermedio de Departamento** (mismo criterio que Pauta Digital desde el 20/08/2026 y SMS desde el 22/08/2026, ver sección 2): separar `LUGAR` por comas, normalizar (NFD sin tildes + upper). Si un token matchea exacto una de las 60 (o por la tabla de alias) → localidad. Si no matchea ninguna de las 60 → afuera, invisible en vistas por localidad, sin excepción.

**Alias hardcodeados** (`ALIAS_LUGAR_GNO`):

| Token | Resolución |
|---|---|
| CARLOS PAZ | → VILLA CARLOS PAZ |
| CIUDAD DE CORDOBA (cubre también el typo real "Cíudad de Córdoba") | → CORDOBA |

**"Toda la provincia"** (con o sin espacio final, aparece así en los datos) → marca `ambito_provincial: true` para esa publicación, no se distribuye a ninguna localidad. Puede convivir en la misma celda con una localidad puntual (ej. "Toda la provincia, Río Cuarto" — caso real detectado el 22/08/2026): cada token de la celda se evalúa por separado, así que esa fila queda con `ambito_provincial: true` **y además** `localidades: ["RIO CUARTO"]`.

**Exclusiones confirmadas** (`EXCLUSIONES_LUGAR_GNO_CONFIRMADAS`, no reabrir — verificadas contra el archivo real del 22/08/2026, existen pero no son ninguna de las 60): TANTI, HUINCA RENANCÓ, VILLA DE SOTO, SAN JOSÉ DE LA DORMIDA, CHUÑA, CAÑADA DE LUQUE, LOS MISTOLES, POCHO, LA PAMPA, REGIÓN CENTRO, ENTE METROPOLITANO. Cualquier token nuevo sin match: se loguea aparte en `no_identificados`, no se asume ninguna resolución.

**Fuzzy** solo como red de seguridad para valores nuevos no cubiertos por alias/exclusiones, cutoff conservador (0.85) — en la corrida real del 22/08/2026 no hizo falta ni una vez: los 60 exactos + alias + exclusiones confirmadas cubrieron el 100% de los tokens reales.

**No hay ninguna cantidad numérica en esta área** (a diferencia de `cantidad_sms_entregados` de SMS) — al "explotar" una publicación con varias localidades en filas separadas para la UI no hay ningún riesgo de inflar un KPI, porque no hay ningún número que sumar.

## 4. Concepto unificado: "Campaña"

**Confirmado explícitamente por el usuario**: "Campaña" es el mismo concepto en Medios tradicionales, Pauta digital y Audiovisuales — no son cosas distintas con nombres distintos, es lo mismo. La vista de Campañas del tablero tiene que mezclar las 3 áreas en un solo lugar, cada una etiquetada con su área de origen, con su tipo de alcance (localidad / departamento / provincia entera según corresponda).

Obras FOCOM queda afuera de este concepto (ver 3.3). **SMS y Contenido Orgánico (GNO) tampoco entran** en la vista de Campañas — son áreas propias, con su panel de detalle de Localidad y su pestaña propia en el nav, pero no se mezclan acá.

## 5. Estructura de navegación acordada

1. **Localidades** (pestaña principal): grilla de las 60 localidades. Al abrir una localidad, el panel muestra primero **Medios tradicionales** (detalle completo), después **Pauta digital** si hay algo para esa localidad o su departamento, después **Audiovisuales** si hay algo, después **SMS**, después **Contenido Orgánico** si hay alguna publicación atribuida a esa localidad. Este panel de detalle **ya está validado y no hay que rediseñarlo** — funciona bien tal como está.
2. **Campañas**: las 3 áreas de la sección 4 mezcladas, filtrable por área.
3. **Pauta Digital**: vista propia y detallada de esa área (todas las piezas, con sus métricas reales, filtros de ámbito/estado/fecha, tabla ordenable). No hace falta que esté "linda" en las otras pestañas — esta es su pantalla.
4. **SMS**: vista propia, una fila por alcance (Localidad/Departamento) para poder filtrar directo.
5. **Contenido Orgánico**: vista propia, mismo criterio de "una fila por alcance" cuando `LUGAR` trae varias localidades; una publicación sin ninguna localidad resuelta ni ámbito provincial no genera fila (no entra a la vista, ver 3.5). Filtros: rango de fecha, Localidad (sin filtro de Red Social — sacado el 22/08/2026, columna informativa nomás).
6. **Movimientos de la semana**: cambios de tema y medios caídos (hoy es de medios tradicionales; evaluar si suma a las demás áreas más adelante).

## 6. Backlog de UX pendiente (probado en un prototipo HTML, no en la build real)

- Etiquetas más claras en KPIs (ej. "23 combinaciones cambiaron de tema" → algo entendible por cualquiera).
- Sacar datos de auditoría interna de la vista principal (ej. "semanas de histórico: 2").
- Escala de color Sin/Baja/Media/Alta con salto de matiz real, no dos rojos casi iguales.
- Vista "cobertura por departamento" con barras sin número no sirve — o se saca, o se muestra como tabla con el número explícito.
- Rediseñar visualmente la fila de filtros (chips) — hoy es plana y sin jerarquía.
- Filtro "sin este medio" con 3 estados por clic en cada chip (con / sin / apagado), no un botón aparte ambiguo.
- Autocompletado en los buscadores (localidad, campaña, pauta digital) — sugerencias en vivo, para distinguir "no hay resultado" de "está mal escrito".
- Filtro de temporalidad (rango de fechas) aplicado de forma consistente en toda la app, no solo en una pestaña.
- Estado Vigente/Finalizada calculado contra la fecha de hoy en **todas** las áreas con fechas (ver 3.3).

Lo que **ya funciona bien y no hay que tocar**: el panel de detalle al abrir una localidad (con Gantt de medios tradicionales), la vista por departamento con recuadros, el filtro de departamento, la pestaña de Movimientos de la semana.

## 7. Decisiones de arquitectura ya conversadas

- El usuario tiene Google Workspace y Microsoft 365 disponibles, y trabaja mucho con **Vercel**.
- Ya tiene un patrón probado en otro proyecto (tablero de circuitos electorales): Excel maestro que se actualiza por script + JSON regenerado que alimenta un dashboard en Vercel. La idea es replicar ese mismo patrón acá.
- Se evaluó armar la build real en **Claude Code**.

## 8. Archivos de este Proyecto

| Nombre en el proyecto | Contenido |
|---|---|
| **Medios tradicionales** | Maestro acumulado de medios tradicionales (`MAESTRO_TABLERO_COMUNICACION.xlsx`) — ver 3.1 |
| **Medios digitales** | Pauta digital curada con Departamento/Localidad/Barrio/Circuito — ver 3.2 |
| **Audiovisuales** | Excel unificado de la Subsecretaría de Comunicación — ver 3.3 |
| **SMS** | Export acumulado de envíos de SMS (`SMS_Looker - <fecha>.xlsx`) — ver 3.4 |
| **Publicaciones GNO** | Export acumulado de publicaciones de Contenido Orgánico (`Publicaciones GNO 2026 - <fecha>.xlsx`) — ver 3.5 |

Este documento de contexto es un archivo más de referencia — contiene todas las reglas de negocio, decisiones y pendientes acumulados hasta ahora.
