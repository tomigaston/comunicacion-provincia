# Verificación — carga Medios Tradicionales 01/10/2026

Archivo: `MAESTRO_MT_ACTUALIZADO_0110.xlsx` (8 hojas, mismas que el maestro exportado). Snapshot = **01/10/2026** (nombre del archivo; la hoja del crudo se llama "60 LOCALIDADES 25-9" pero sus datos son posteriores a la carga del 25/09).
Base de comparación: `Maestro_Vigente` exportado (snapshot 25/09).

## Limpieza del crudo
- Filas no vacías: 2.451 · REDES descartadas: 571
- Retenidas fuera del maestro (ver anomalías): PUBLINOTA 15 · sin Localidad 1 · sin Estado 1
- Duplicados colapsados: 3 (General Deheza RADIO, Leones RADIO, Morteros RADIO)
- **Filas limpias = 1.860** (Activo 562 · Inactivo 1.298)
- Localidades sin match con las 60: 0 · Faltantes de las 60: 0

## Números esperados en el JSON
| Hoja | Esperado |
|---|---|
| Historico | +1.860 filas (total 10.155) |
| Maestro_Vigente | 1.860 filas |
| Por tipo | RADIO 752 · TV 569 · VIA PÚBLICA 134 · PANTALLA LED 119 · GRÁFICA 115 · CARTELERÍA 104 · WEB 67 |
| Activos sin Fecha_Desde | 173 (CARTELERÍA 99, VIA PÚBLICA 74) |
| Antigüedad (activos con fecha) | mín 0 · máx 56 días |
| Alertas | 🟢 310 · 🟡 71 · 🔴 8 |
| Cobertura (60 locs) | 🟢 alta 31 · 🟡 media 20 · 🟠 baja 9 · sin pauta 0 |
| Cobertura, suma de Total_Tipos | 273 |
| Cobertura por tipo | TV 41 · RADIO 53 · WEB 40 · CARTELERÍA 42 · VIA PÚBLICA 38 · GRÁFICA 21 · PANTALLA LED 38 |
| Cambios_Ultima_Semana | 43 (GRÁFICA 15 · WEB 13 · RADIO 8 · TV 7) |
| Caidos | 12 (WEB 10 · GRÁFICA 1 · VIA PÚBLICA 1) |
| Combinaciones con tema activo | 268 antes → 257 ahora (1 nueva: Bell Ville GRÁFICA, no se anota) |

Cobertura baja (≤2 tipos): San Agustín 1, Estación Juárez Celman 1, Malvinas Argentinas, Saldán, Villa Huidobro, San Carlos Minas, Villa Santa Rosa, Villa Cura Brochero, Malagueño (2 c/u).

Control del método: el bloque de temas activos se reprodujo contra el `Cambios_Ultima_Semana` anterior y coincide en 170 de 170 filas.

## Anomalías — a decidir por Tomás
1. **PUBLINOTA (tipo nuevo, 15 filas, todas CÓRDOBA, Inactivo, links a La Voz/Punto a Punto, 02/09–24/09).** No está en los 7 válidos; quedó **fuera** de Historico y Maestro_Vigente. No afecta Cobertura, Cambios ni Caídos (todas Inactivo).
2. **VILLA SANTA ROSA · CARTELERÍA · "CBA- MIRÁ- AUTOPISTA RUTA 19"**: reaparece al final del crudo sin Estado ni fechas. Retenida fuera; Cobertura de VSR CARTELERÍA queda en 0.
3. **Fila sin Localidad** (Dep. COLÓN, TV, PRUEBAS PISA, 11/09–21/09, Inactivo): el link coincide con Almafuerte TV PRUEBAS PISA; parece residuo. Descartada.
4. **4 GRÁFICA Inactivo con inicio futuro** (Río Tercero, San Francisco, Villa Carlos Paz, Villa Dolores; "Créditos Alivio Cordobés", 02–03/10). Se dejaron tal cual. El caso de San Francisco GRÁFICA figura en Caidos por esto.
5. **Fecha**: 01/10 es jueves (cadencia habitual: viernes), 6 días desde el 25/09.
6. Portada dice "Última actualización cargada: 19/08/2026"; no se tocó.
7. Departamento del crudo ≠ oficial en Estación Juárez Celman y Laboulaye; se usó el oficial.
