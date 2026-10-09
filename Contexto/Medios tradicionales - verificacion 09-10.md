# Verificación — carga Medios Tradicionales 09/10/2026

Archivo: `MAESTRO_MT_ACTUALIZADO_0910.xlsx` (8 hojas). Snapshot = **09/10/2026** (viernes; nombre del archivo, hoja "60 LOCALIDADES 7-10").
Base de comparación: `Maestro_Vigente` exportado, snapshot **05/10** (4 días antes; el 05/10 figura en el Historico exportado, no pasó por este chat).

## Limpieza del crudo
- Filas no vacías: 2.947 · REDES descartadas: 717
- Fuera del maestro: PUBLINOTA 19 (18 Inactivo, 1 Activo), mismo criterio que el 01/10 y el 05/10
- Duplicados exactos colapsados: 2 (Leones RADIO, Morteros RADIO)
- **Filas limpias = 2.209** (Activo 543 · Inactivo 1.666)
- Localidades sin match con las 60: 0 · Filas sin Localidad o sin Estado: 0 · Tipos nuevos aparte de PUBLINOTA: 0

## Números esperados en el JSON
| Hoja | Esperado |
|---|---|
| Historico | +2.209 filas (total 14.334; el 09/10 queda con 2.209) |
| Maestro_Vigente | 2.209 filas |
| Por tipo | RADIO 935 · TV 684 · GRÁFICA 141 · VIA PÚBLICA 135 · PANTALLA LED 119 · CARTELERÍA 105 · WEB 90 |
| Activos sin Fecha_Desde | 174 |
| Antigüedad (activos con fecha) | mín 0 · máx 58 días |
| Alertas | 🟢 297 · 🟡 58 · 🔴 14 |
| Cobertura (60 locs) | 🟢 alta 31 · 🟡 media 21 · 🟠 baja 8 · sin pauta 0 |
| Cobertura, suma de Total_Tipos | 273 |
| Cobertura por tipo | TV 40 · RADIO 53 · WEB 40 · CARTELERÍA 43 · VIA PÚBLICA 38 · GRÁFICA 21 · PANTALLA LED 38 |
| Cambios_Ultima_Semana | 118 (RADIO 52 · TV 39 · WEB 19 · VIA PÚBLICA 6 · GRÁFICA 2); Fecha anterior 05/10, actual 09/10 |
| Caidos | 0 (hoja con solo encabezado) |
| Combinaciones con tema activo | 215 antes → 226 ahora; 11 nuevas (10 WEB + Villa Dolores GRÁFICA), no se anotan |

Cobertura baja (≤2 tipos): San Agustín 1, Estación Juárez Celman 1, Villa Huidobro 1, y Malvinas Argentinas, Saldán, San Carlos Minas, Villa Cura Brochero, Malagueño con 2.

Control del método: el bloque de temas activos reprodujo el `Cambios_Ultima_Semana` exportado (05/10) en 100 de 100 filas.

## Anomalías — a decidir por Tomás
1. **PUBLINOTA** sigue sin definirse (19 filas, todas CÓRDOBA). Hay 1 Activo: si se incorpora, cambiaría Cambios para Córdoba.
2. **16 filas GRÁFICA Inactivo con inicio futuro** (10–17/10) en Alta Gracia, Bell Ville, La Carlota, Las Varillas (2), Morteros, Río Cuarto (2), Río Tercero (2), San Francisco (2), Villa Carlos Paz, Villa Dolores, Villa María (2). Se dejaron tal cual.
3. **San Francisco · GRÁFICA** tiene una fila sin Tema (Inactivo, 11–12/10). Se cargó con Tema vacío.
4. Los 44 Caídos del 05/10 desaparecen al reemplazarse la hoja: en esta carga ninguna combinación pasó de tener tema activo a no tenerlo.
5. Portada no se tocó (dice última actualización 05/10/2026).
