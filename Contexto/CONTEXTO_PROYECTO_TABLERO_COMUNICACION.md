# Contexto — Tablero de Comunicación, Gobierno de Córdoba

## 1. Objetivo

El gobernador pidió un tablero para ver, de un vistazo, **qué se está publicitando y qué no** en las **60 localidades prioritarias** de la provincia, en todos los formatos (TV, radio, cartelería, redes, digital, audiovisual). Hoy 3 áreas trabajan sin coordinación entre sí y no hay visión conjunta: puede haber una localidad sin nada de publicidad, un tema repetido, o algo vencido hace meses sin que nadie lo note.

Lo usa principalmente **[el usuario]**, que consolida y reporta al gobernador. Las áreas que generan los datos y el propio gobernador también son usuarios potenciales. La visualización final tiene que ser **clara y sencilla de leer** — es lo que más importa en esa etapa.

## 2. Universo del tablero — REGLA FIJA

**El universo son siempre las 60 localidades prioritarias**, cada una con su Departamento correspondiente (listado oficial ya definido, no se negocia por área).

**Excepción vigente: SMS.** Como esa área no siempre viene desagregada a nivel localidad, se muestra **también a nivel Departamento** (no solo localidad) cuando `AUDIENCIA` no matchea ninguna de las 60. Ver 3.4.

**Pauta Digital ya NO tiene esta excepción.** Tuvo el mismo comportamiento (mostrar también a nivel Departamento) hasta el **20/08/2026**, cuando se eliminó por completo tras detectarse un bug real: piezas de alcance Departamento/Provincia se colaban en el panel de una Localidad puntual a la que no correspondían (caso Alta Gracia — ver `scripts/test_pauta_digital.py`). Desde ese cambio la regla de Pauta Digital es **sin excepciones**: una pieza se atribuye a una Localidad solo si su Localidad puntual es una de las 60; si no, no se propaga a ningún Departamento en el panel de Localidad (sigue visible, con su Departamento a la vista, en la pestaña propia de Pauta Digital y en Campañas — pero ya no en ningún panel de Localidad). **No mezclar esta regla con la de SMS**: son áreas distintas, con historiales distintos — SMS sí tiene hoy el fallback a Departamento, Pauta Digital no.

Todo dato de cualquier área que no pertenezca a las 60 localidades (o, en el caso de SMS, a los departamentos que las contienen cuando no hay match a nivel Localidad) **queda fuera del tablero** — no se crean localidades nuevas, no se expande el universo. Esto se probó y se revirtió una vez: no volver a repetir el error de agregar localidades "extra" fuera de las 60.

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

**La columna `DEPARTAMENTO` de `Sms_Looker` no es confiable como filtro** — hay filas donde no coincide con lo que realmente lista `AUDIENCIA`. No se usa para acotar candidatos de matching; solo se usa como *fallback* de etiqueta cuando no hay ninguna otra forma de nombrar el departamento (`AUDIENCIA` = "DEPTO COMPLETO", o token de `AUDIENCIA` totalmente sin matchear).

**Regla de alcance geográfico por `ZONA`:**
- `ZONA` = `CAPITAL`, `CÓRDOBA`, `CAPITAL + PROVINCIA` → nivel **Departamento Capital entero**. No se desagrega por barrio (los barrios quedan fuera de este tablero, van a otro proyecto aparte). Se ignora el contenido de `AUDIENCIA` en este caso.
- `ZONA` = `PROVINCIA` → se separa `AUDIENCIA` en tokens (ver split abajo) y cada uno se matchea contra el padrón del Nomenclador Maestro:
  - Matchea y está entre las 60 prioritarias → nivel Localidad.
  - Matchea pero no está entre las 60 → nivel Departamento (el que le corresponde según el Nomenclador, no según la columna `DEPARTAMENTO` de la fila).
  - No matchea ni exacto, ni por variante conocida (tabla de excepciones), ni por fuzzy → nivel Departamento como *fallback* (usando la columna `DEPARTAMENTO` de la fila, con la salvedad de que puede ser inexacta) y se loguea como "no identificado" para revisión manual.
- `AUDIENCIA` = literalmente `"DEPTO COMPLETO"` (celda completa) → nivel Departamento entero, resuelto con la columna `DEPARTAMENTO` de la fila (única fuente disponible en ese caso, pese a no ser 100% confiable).
- Un token de `AUDIENCIA` que, ya separado (ver split abajo), es exactamente `"CAPITAL"` → nivel Departamento Capital entero para ese token. Se evalúa **token por token, no celda completa**: si `AUDIENCIA` trae "Río Cuarto, Capital", el token "Capital" igual resuelve a Departamento Capital aunque comparta la celda con otro token.
- `ZONA` = `Base particular`, o cualquier valor de `ZONA` que no sea uno de los reconocidos arriba (bases de datos, "Números particulares", nombres de archivo `.xlsx` colados, rangos etarios, "Jubilados provincia y ciudad", etc.) → **"sin desagregación geográfica"**. La fila se mantiene para totales generales (por tema, eje, fecha) pero se excluye de cualquier vista por localidad/departamento. Cualquier `ZONA` no reconocida se loguea aparte (`zonas_no_reconocidas` en `data/sms.json`) para confirmar que no sea en realidad geográfica.

**Separar tokens dentro de `AUDIENCIA`:** split por `" - "`, `","` y saltos de línea (`\n`); limpiar paréntesis con rangos etarios (ej. "(25-45)"); normalizar con NFD (sacar tildes) + `.strip().upper()` (mismo patrón que el resto del proyecto). Match exacto contra el padrón primero, fuzzy (`difflib`, cutoff 0.7) como fallback.

**Tabla de excepciones** (ya resueltas a mano, hardcodeadas en `EXCEPCIONES_AUDIENCIA_SMS` de `scripts/generar_datos.py`):

| Token normalizado en AUDIENCIA | Resolución |
|---|---|
| CARLOS PAZ | → VILLA CARLOS PAZ (en las 60) |
| TOTORAL | → VILLA DEL TOTORAL (en las 60) |
| VILLA CIUDAD PARQUE | → VILLA CIUDAD PARQUE LOS REARTES (no está en las 60 → Departamento) |
| LA CARLOTA LABOULAYE CANALS | → split en 3: LA CARLOTA (en las 60) + LABOULAYE (en las 60) + CANALS (no está → Departamento) |
| TANINGA | No está en las 60 → Departamento |
| LOS GIGANTES | No está en las 60 → Departamento |
| CERRO BLANCO | No está en las 60 → Departamento |
| CORRAL DE BUSTOS | No está en las 60 → Departamento |
| B° LA FLORESTA | Es barrio de la ciudad de Córdoba (no localidad de interior) → **afuera del universo del tablero**, no genera ningún alcance (ni Localidad ni Departamento) — los barrios van a otro proyecto aparte |
| CAPITAL (como token individual tras el split, comparta celda o no con otros tokens) | → Departamento Capital entero |

Cualquier token nuevo que no matchee y no esté en esta tabla: no se asume, se loguea aparte (`no_identificados` en `data/sms.json`) para que el usuario lo clasifique a mano, igual que se hizo con estos. Si una fila termina con **todos** sus tokens de `AUDIENCIA` excluidos del universo (ej. una fila cuya única mención es "B° La Floresta"), la fila se trata como **"sin desagregación geográfica"** — se mantiene para totales generales pero no aporta ningún alcance por Localidad/Departamento. Si una excepción hardcodeada ya no resuelve contra el padrón actual (ni exacto ni por fuzzy — señal de que el Nomenclador Maestro cambió desde que se cargó esa excepción a mano), se loguea aparte en `excepciones_sin_resolver` dentro de `data/sms.json`, para revisión manual — no se asume ningún Departamento por intuición.

**Regla sobre `CANTIDAD DE SMS ENTREGADOS` (no reabrir):** cuando una fila tiene varias localidades/departamentos en `AUDIENCIA`, **no se prorratea** el número entre ellas — no hay base real para hacerlo. Cada lugar mencionado queda marcado como "alcanzado" por ese envío, sin número propio. El número queda a nivel de la fila/envío completo para totales (por tema, eje, fecha).

**Columna `CIRCUITO`:** no se procesa todavía, pasa como dato crudo (`circuito_raw`). No cruzar con el proyecto de Circuitos electorales sin confirmación explícita aparte.

## 4. Concepto unificado: "Campaña"

**Confirmado explícitamente por el usuario**: "Campaña" es el mismo concepto en Medios tradicionales, Pauta digital y Audiovisuales — no son cosas distintas con nombres distintos, es lo mismo. La vista de Campañas del tablero tiene que mezclar las 3 áreas en un solo lugar, cada una etiquetada con su área de origen, con su tipo de alcance (localidad / departamento / provincia entera según corresponda).

Obras FOCOM queda afuera de este concepto (ver 3.3).

## 5. Estructura de navegación acordada

1. **Localidades** (pestaña principal): grilla de las 60 localidades. Al abrir una localidad, el panel muestra primero **Medios tradicionales** (detalle completo), después **Pauta digital** si hay algo para esa localidad o su departamento, después **Audiovisuales** si hay algo. Este panel de detalle **ya está validado y no hay que rediseñarlo** — funciona bien tal como está.
2. **Campañas**: las 3 áreas de la sección 4 mezcladas, filtrable por área.
3. **Pauta Digital**: vista propia y detallada de esa área (todas las piezas, con sus métricas reales, filtros de ámbito/estado/fecha, tabla ordenable). No hace falta que esté "linda" en las otras pestañas — esta es su pantalla.
4. **Movimientos de la semana**: cambios de tema y medios caídos (hoy es de medios tradicionales; evaluar si suma a las demás áreas más adelante).

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

Este documento de contexto es un archivo más de referencia — contiene todas las reglas de negocio, decisiones y pendientes acumulados hasta ahora.
