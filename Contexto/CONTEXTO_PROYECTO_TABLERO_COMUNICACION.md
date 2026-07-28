# Contexto — Tablero de Comunicación, Gobierno de Córdoba

## 1. Objetivo

El gobernador pidió un tablero para ver, de un vistazo, **qué se está publicitando y qué no** en las **60 localidades prioritarias** de la provincia, en todos los formatos (TV, radio, cartelería, redes, digital, audiovisual). Hoy 3 áreas trabajan sin coordinación entre sí y no hay visión conjunta: puede haber una localidad sin nada de publicidad, un tema repetido, o algo vencido hace meses sin que nadie lo note.

Lo usa principalmente **[el usuario]**, que consolida y reporta al gobernador. Las áreas que generan los datos y el propio gobernador también son usuarios potenciales. La visualización final tiene que ser **clara y sencilla de leer** — es lo que más importa en esa etapa.

## 2. Universo del tablero — REGLA FIJA

**El universo son siempre las 60 localidades prioritarias**, cada una con su Departamento correspondiente (listado oficial ya definido, no se negocia por área).

**Única excepción: Pauta Digital.** Como esa área todavía no está desagregada a nivel localidad en su mayoría, se muestra **también a nivel Departamento** (no solo localidad). Es la única área con esta doble vista.

Todo dato de cualquier área que no pertenezca a las 60 localidades (o, en el caso de pauta digital, a los departamentos que las contienen) **queda fuera del tablero** — no se crean localidades nuevas, no se expande el universo. Esto se probó y se revirtió una vez: no volver a repetir el error de agregar localidades "extra" fuera de las 60.

## 3. Las 3 áreas de comunicación

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

Este documento de contexto es el cuarto archivo de referencia — contiene todas las reglas de negocio, decisiones y pendientes acumulados hasta ahora.
