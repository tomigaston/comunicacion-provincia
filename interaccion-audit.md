# Auditoría de interacción y coherencia — 13/10/2026

Rama `rediseno-alertas-cobertura`. Alcance: las tres vistas de Localidades (general = resumen arriba de `/localidades`, grilla, detalle de localidad) y sus destinos (`/campanas`).
**Método:** no se ven renders (login), así que se audita (a) el cableado en código, con `archivo:línea`, y (b) los conteos corriendo el MISMO código de la pantalla (`lib/filtrosLocalidades.js`, `lib/resumen.js`, `lib/useAlertas.js`, `lib/vencimientos.js`) sobre los JSON actuales con `hoy = 2026-10-13`. El repaso visual queda para el preview.

## Resumen
- **Elementos auditados:** 47. **ROTO: 0.** Ningún elemento que muestre un subconjunto queda sin handler o link.
- **Conteos:** todos los pares cuadran. Hay **una diferencia de unidades** (no un error) que conviene tener presente: la tira cuenta *campañas* y el filtro de la grilla cuenta *localidades* (ver sección 3, fila C6).
- **Se corrigieron durante la auditoría** (estaban sin handler): el titular "45/60 con cobertura media o alta" y el segmento de la barra apilada (antes solo era clickable la leyenda).

## 1. Navegación y filtros: lo implementado
- Barra apilada MT: cada segmento (y su leyenda) filtra la grilla por esa banda (`ResumenCards.js:136`, `:149` → `index.js:91`).
- Tarjetas de la grilla: ya eran un `Link` a la ficha (`LocalidadCard.js:21-22`, ahora vía `lib/rutas.js`).
- Resumen: cada número/nombre que es un recorte lleva a la grilla filtrada, despliega su lista o navega a la ficha de la localidad / a `/campanas?q=<campaña>` (nuevo: `campanas.js:32-38`, `:79-80`).
- Detalle: los números de la card de MT filtran la tabla de temas (solo Activos, por tipo) y bajan hasta ella; la card de PD despliega la lista de campañas, con filtro por plataforma.
- Grilla: botón "Limpiar filtros" (aparece solo si hay filtros activos).

## 2. Tabla de interacción
Leyenda de estado: **OK** = cableado, destino correcto, conteo verificado (donde aplica). **n/a** en conteo = el elemento no muestra un subconjunto.

| # | Elemento | Vista | Acción esperada | ¿Cableado? (archivo:línea) | ¿Destino correcto? | Conteo mostrado == conteo tras filtrar/navegar | Estado |
|---|---|---|---|---|---|---|---|
| 1 | "Sin cobertura: 0 de 60" | General | Informativo (conjunto vacío) | — (no es recorte) | n/a | n/a (0 = AND vacío, ver C5) | OK |
| 2 | Nombres en "Sin cobertura" (solo si >0) | General | Ficha de la localidad | `ResumenCards.js:97` | `hrefLocalidad` → `/localidades/<slug>`; las 60 resuelven | n/a | OK |
| 3 | "Vencen esta semana: 37 campañas" | General | Abre la lista completa | `ResumenCards.js:106` | Lista en la card PD (`:344-358`) | 37 == 37 | OK |
| 4 | Chip 🔴 35 (≤3d) | General | Lista filtrada a 🔴 | `ResumenCards.js:113` | Lista filtrada (`:344-358`) | 35 == 35 | OK |
| 5 | Chip 🟡 2 (4–7d) | General | Lista filtrada a 🟡 | `ResumenCards.js:116` | idem | 2 == 2 | OK |
| 6 | "45/60 con cobertura media o alta" | General | Grilla filtrada Media+Alta | `ResumenCards.js:173` → `index.js:91` | Grilla (`#grilla-localidades`) | 45 == 45 | OK |
| 7 | "▲ +N vs. dd/mm" (movimiento) | General | Informativo (valor, no subconjunto); oculto sin `snapshot_anterior` | — | n/a | n/a (hoy `snapshot_anterior` es null: no se muestra) | OK |
| 8 | "Cambiaron de banda": nombres y "(+N más)" | General | Ficha / despliega todos | `ResumenCards.js:196`, `:204` | Ficha / lista | n/a hoy (no renderiza sin foto previa) | OK (condicional) |
| 9 | Segmento de la barra (Alta/Media/Baja/Sin) | General | Grilla filtrada a esa banda | `ResumenCards.js:136` → `index.js:91` | Grilla | Alta 23==23, Media 22==22, Baja 14==14, Sin 1==1 | OK |
| 10 | Leyenda de la barra ("Baja 14") | General | Ídem | `ResumenCards.js:149` | Grilla | ídem fila 9 | OK |
| 11 | "Más débiles": nombres | General | Ficha | `ResumenCards.js:249` | `/localidades/<slug>`; resuelven | n/a | OK |
| 12 | "Más débiles" "(+N más)" | General | Grilla Sin+Baja | `ResumenCards.js:255` | Grilla | 12 + 3 nombradas = 15 == 15 | OK |
| 13 | "ver las 15 en la grilla →" | General | Grilla Sin+Baja | `ResumenCards.js:260` | Grilla | 15 == 15 | OK |
| 14 | "35 temas por revisar" | General | Despliega la lista | `ResumenCards.js:266` | Lista (`:295-301`) | 35 == 35 (== mail MT, 35 grupos) | OK |
| 15 | Chip 🔴 6 (temas) | General | Lista filtrada | `ResumenCards.js:269` | Lista | 6 == 6 | OK |
| 16 | Chip 🟡 29 (temas) | General | Lista filtrada | `ResumenCards.js:272` | Lista | 29 == 29 | OK |
| 17 | "Más antiguos": tema + "(+N más)" | General | `/campanas?q=<tema>` / lista | `ResumenCards.js:281`, `:287` | `/campanas` filtra por nombre; 121 nombres usados, 0 sin resultado | n/a | OK |
| 18 | Temas en la lista desplegada | General | `/campanas?q=<tema>` | `ResumenCards.js:299` | idem | n/a | OK |
| 19 | Anomalía "vencida sin renovar" (0 hoy) | General | `/campanas?q=<campaña>` | `ResumenCards.js:314` | idem | n/a (0 hoy) | OK (condicional) |
| 20 | "Renovar primero": campañas | General | `/campanas?q=<campaña>` | `ResumenCards.js:326` | idem | n/a | OK |
| 21 | "Renovar primero" "(+32 más)" | General | Lista de 🔴 | `ResumenCards.js:335` | Lista filtrada | 3 + 32 = 35 == 35 | OK |
| 22 | Campañas en la lista de vencen | General | `/campanas?q=<campaña>` | `ResumenCards.js:355` | idem | n/a | OK |
| 23 | "49 campañas vivas dirigidas" | General | Despliega la lista | `ResumenCards.js:365` | Lista (`:370-376`) | 49 == 49 | OK |
| 24 | Campañas en esa lista | General | `/campanas?q=<campaña>` | `ResumenCards.js:374` | idem | n/a | OK |
| 25 | Buscador de localidad | Grilla | Filtra / abre ficha | `index.js:127`, `:128` | `/localidades/<slug>` | n/a | OK |
| 26 | Grupo "Cobertura MT" (4 botones) | Grilla | Banda activa/inactiva (OR) | `index.js:140` → `:106`; lógica `filtrosLocalidades.js:46` | Grilla | Por banda 23/22/14/1 == resumen | OK |
| 27 | Grupo "Tipo de medio MT" (7 chips ✓/✕) | Grilla | Con alguno de los ✓ (OR), sin ninguno de los ✕ | `index.js:166`; `filtrosLocalidades.js:47-48` | Grilla | TV 40, Radio 53, TV∪Radio 53, sin Gráfica 43 (=60−17) | OK |
| 28 | Grupo "Pauta digital" (4 botones) | Grilla | Categoría de PD viva+dirigida (OR) | `index.js:180` → `:97`; `filtrosLocalidades.js:49` | Grilla | 🔴31 🟡3 🟢26 sin 0 == semáforo | OK |
| 29 | Combinación entre grupos | Grilla | AND entre grupos, OR dentro | `filtrosLocalidades.js:40-52` (única función, la usa la pantalla) | Grilla | Ver sección 3 (C7-C9) | OK |
| 30 | "Limpiar filtros" | Grilla | Restablece los tres grupos | `index.js:211` → `:76` | Grilla sin filtrar (60) | 60 | OK |
| 31 | "Mostrando N de 60" | Grilla | Informativo | `index.js:204` | n/a | N = `filtrados.length` | OK |
| 32 | Tarjeta de localidad | Grilla | Ficha de la localidad | `LocalidadCard.js:21-22` | 60/60 resuelven | n/a | OK |
| 33 | Chip de PD dentro de la tarjeta | Grilla | Hereda el click de la tarjeta | `LocalidadCard.js:21` (dentro del `Link`) | Ficha | n/a | OK |
| 34 | "← Volver a Localidades" | Detalle | Vuelve a la grilla | `[localidad].js:214` | `/localidades` | n/a | OK |
| 35 | "N temas activos" (card MT) | Detalle | Tabla de MT = solo Activos | `ResumenCards.js:404` → `[localidad].js:157` | Tabla (`#seccion-mt`), período en "Todo" | N tabla == `temasActivos` en las 60 | OK |
| 36 | Chips de tipo presentes ("✓ Radio 5") | Detalle | Tabla filtrada a ese tipo (Activos) | `ResumenCards.js:419` → `[localidad].js:157` | Tabla filtrada | 420 pares (60×7): 0 discrepancias | OK |
| 37 | Chips de tipo ausentes ("— Pantalla LED") | Detalle | No interactivo (ausencia, no recorte) | — | n/a | 0 filas en la tabla | OK |
| 38 | "Quitar filtro" de la tabla | Detalle | Quita el recorte | `[localidad].js:294` | Tabla completa | n/a | OK |
| 39 | Frescura "tema más reciente hace N días" | Detalle | Informativo (valor único) | — | n/a | n/a | OK |
| 40 | "N campañas vivas dirigidas" (card PD) | Detalle | Despliega la lista | `ResumenCards.js:462` | Lista (`:494-506`) | Lista == N en las 60 (0 discrepancias) | OK |
| 41 | "próxima vence en Nd 🔴" | Detalle | Informativo (valor único; la lista está en el titular) | — | n/a | n/a | OK |
| 42 | Plataformas ("Meta 32 · Youtube 21") | Detalle | Lista filtrada por plataforma | `ResumenCards.js:482` | Lista filtrada | 0 discrepancias en todas | OK |
| 43 | Campañas en la lista PD y anomalía | Detalle | `/campanas?q=<campaña>` | `ResumenCards.js:502`, `:452` | `/campanas` | n/a | OK |
| 44 | Filtro de período | Detalle | Filtra las tablas | `[localidad].js:245` | Tablas | existente | OK |
| 45 | "Ver línea de tiempo completa" y cerrar | Detalle | Abre/cierra el modal | `[localidad].js:282`, `:355` | Modal | existente | OK |
| 46 | "Ver material" (VerMaterial) | Detalle | Abre el link / popover | `[localidad].js:336`, `:415`, `:460` | Link externo | existente | OK |
| 47 | `?q=` en Campañas | Campañas | Precarga el buscador | `campanas.js:32-38`, `:79-80` | Lista de ítems de esa campaña | 121 nombres, 0 sin resultado | OK |

## 3. Coherencia de datos (hoy = 13/10/2026)
Todo se calcula con el código de la pantalla, no con una reimplementación.

| # | Par | Valores | Resultado |
|---|---|---|---|
| C1 | Cobertura MT: card == grilla filtrada == JSON | Alta 23/23/23 · Media 22/22/22 · Baja 14/14/14 · Sin 1/1/1; Sin+Baja 15==15; Media+Alta 45==45 | cuadra |
| C2 | Vencen esta semana: tira == campañas distintas del mail == campañas de las piezas 🔴/🟡 del semáforo | 37 == 37 == 37; 🔴35/🟡2 en tira y en la lista | cuadra |
| C3 | Temas por revisar: card == mail MT; 🔴/🟡 | 35 == 35; 6==6, 29==29 | cuadra |
| C4 | Campañas vivas dirigidas: card == lista == piezas D2 agrupadas por campaña | 49 == 49 == 49 | cuadra |
| C5 | Sin cobertura (AND): tira == `calcularLocalidadesSinCobertura` == grilla (banda Sin ∩ PD "sin") | 0 == 0 == 0 | cuadra |
| C6 | PD vence ≤3d: grilla == semáforo por localidad; tira | grilla 🔴31 == semáforo 31; 🟡 3==3; 🟢 26==26; sin 0==0. La **tira dice 35 campañas** 🔴 | ⚠ **unidades distintas**: la tira cuenta campañas (35) y el filtro cuenta localidades (31). No es una discrepancia: son 35 campañas que ponen en rojo a 31 localidades. Sugerencia: rotular la tira como "campañas" (ya lo dice) y, si querés, el filtro de la grilla como "localidades" |
| C7 | AND entre grupos: Baja ∩ PD 🔴 | filtro = 5; intersección independiente = 5 (Malagueño, Colonia Caroya, Malvinas Argentinas, Saldán, San Agustín) | cuadra |
| C8 | OR dentro de grupo: PD 🔴+🟡; TV∪Radio | 34 == 31+3; TV 40, Radio 53, TV∪Radio 53 == unión directa 53 | cuadra |
| C9 | Tres grupos: Media + sin Gráfica + PD 🔴 | 8 | (ejemplo, sin contraparte independiente) |
| C10 | Card de localidad: suma de chips == `tipos`; temas activos ≥ tipos; temas == filas Activas | 420 pares, 0 discrepancias; 543 temas activos en las 60 == 543 filas Activas del JSON | cuadra |
| C11 | Card de localidad PD: lista == N campañas; plataformas == lista filtrada | 0 discrepancias en las 60 | cuadra |
| C12 | Pieza → campaña (unidad) | 2.129 piezas 🔴+🟡 → 47 grupos (campaña×fecha) → **37 campañas** | cuadra (unidades explícitas) |

### Distribución de FIN de las 🔴 ≤3d
- **31 localidades en rojo:** próxima FIN **15/10 → 22**, 16/10 → 6, 14/10 → 3. El 71 % comparte fecha.
- **Campañas 🔴 (35):** 1 vence hoy, 29 en 2 días (15/10), 5 en 3 días (16/10).
- **¿Artefacto?** No de una sola campaña repetida: lo causan muchas campañas distintas (Comunicación Institucional en 10 localidades, Obras que transforman en 6, Hitos de gestión en 5, …). Es una cohorte con cierre común (jueves 15/10). El matiz está en la regla de peor caso: una localidad queda 🔴 con que una sola campaña venza, aunque tenga otras al aire; 19 de las 37 campañas que vencen siguen con otras piezas después (ver `continua`). 8 de las 31 localidades están en rojo solo por piezas `multiple_depto`.

## 4. Audiovisuales en la vista de localidades
Grilla, resumen y filtros: **0 referencias.**
```
exit=1
```
La **ficha de detalle** (`[localidad].js`) conserva su sección "Audiovisuales", fuera del alcance de este pedido (solo grilla):
```
pages/localidades/[localidad].js:70:    '/api/data/audiovisuales',
pages/localidades/[localidad].js:87:    const [localidadesData, mediosData, pautaData, audiovisualesData, smsD
pages/localidades/[localidad].js:110:    const itemsAudiovisuales = audiovisualesData.items
pages/localidades/[localidad].js:131:    return { base, medios, piezasPauta, itemsAudiovisuales, enviosSms, pu
pages/localidades/[localidad].js:141:    info.itemsAudiovisuales.forEach((it) => fechas.push(it.fecha_fin || i
pages/localidades/[localidad].js:186:      itemsAudiovisuales: info.itemsAudiovisuales.filter((it) =>
pages/localidades/[localidad].js:471:          {info.itemsAudiovisuales.length > 0 && (
pages/localidades/[localidad].js:472:            <Seccion titulo="Audiovisuales">
pages/localidades/[localidad].js:473:              {visible.itemsAudiovisuales.length === 0 ? (
pages/localidades/[localidad].js:475:                  Ningún contenido audiovisual cae dentro del período ele
pages/localidades/[localidad].js:476:                  {info.itemsAudiovisuales.length} en total — varios sin 
pages/localidades/[localidad].js:491:                    {visible.itemsAudiovisuales.map((it, i) => (
```

## 5. Observaciones
- Los elementos 7, 8 y 19 no se renderizan con los datos de hoy (no hay `snapshot_anterior` ni campañas vencidas sin renovar). Su cableado está verificado en código; el movimiento se probó con una foto sintética.
- El filtro "Tipo de medio MT" cambió: con dos o más ✓ ahora es OR (antes AND). Los ✕ siguen siendo "sin ninguno".
- No se tocaron direcciones de mail.
