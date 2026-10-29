# Verificación — reproceso Pauta Digital 12/10/2026

Crudo: `Contexto/Pauta RRSS_GLOBAL.xlsx` (hoja `GLOBAL_ImportRange`, modificado 11/10, **4.009 filas × 77 columnas**). Es el mismo crudo del commit `128f154`. No se usó ningún crudo de `Backups/` (incluye `working-tree_2026-10-11`, que no es el vigente).
Fecha de corrida: 12/10/2026 (HOY). Cambia respecto al JSON del 11/10 solo lo que depende de la fecha: `antiguedad_dias` (6.465 piezas), `vigente_por_fecha` y `alerta` (23 piezas que cruzaron su INICIO).

## Base de conteo: filas de origen → piezas de salida
| Paso | Cantidad |
|---|---|
| Filas del crudo | 4.009 |
| Descartadas como basura | 0 |
| Excluidas por estar fuera de la provincia | 2 |
| Filas que generan pieza | 4.007 |
| Piezas tras expandir "TODAS LAS LOCALIDADES" (depto → sus localidades de las 60; provincia → las 60) | 15.152 |
| Colapsadas por dedup de COD. CONTENIDO | 17 (3 localidad_directa, 14 circuito_capital) |
| **Piezas fuente nueva** | **15.135** |
| + piezas histórico (≤ 02/07) | 929 |
| **Total en el JSON** | **16.064** |

Códigos únicos con COD. CONTENIDO: 1.957 (en 2.020 filas). Códigos dados de baja vs. JSON anterior: 0.

## sub_ambito (suma = total de piezas)
| sub_ambito | Filas fuente | Piezas global | Piezas histórico | Total |
|---|---|---|---|---|
| localidad_directa | 1.652 | 1.649 | 201 | 1.850 |
| circuito_capital | 425 | 411 | 0 | 411 |
| multiple_depto | 1.466 | 3.230 | 0 | 3.230 |
| multiple_provincia | 159 | 9.540 | 241 | 9.781 |
| departamento | 305 | 305 | 372 | 677 |
| sin_ambito | 0 | 0 | 115 | 115 |
| **Total** | 4.007 | 15.135 | 929 | **16.064** ✔ |

Cuentan como cobertura de localidad: localidad_directa, circuito_capital, multiple_depto. Excluidos: multiple_provincia, departamento, sin_ambito.

## Estados (fuente nueva, directo de ESTADO)
Crudo por fila: INACTIVO 2.311 · ACTIVO 1.573 · OBSERVADO 73 · PROGRAMADO 52.
Piezas: Finalizada 8.567 · Vigente 6.429 · Observada 87 · Programada 52 (= 15.135).
`vigente_por_fecha` = True en 6.465 piezas: 6.429 Vigentes + 23 Programadas + 13 Observadas.

## Anomalías (se señalan, no se resuelven)
- **Vigente con FIN vencido o sin fecha: 0.** Check de la spec limpio.
- **23 piezas Programadas con INICIO ≤ hoy ≤ FIN** (la fuente dice PROGRAMADO pero la fecha ya arrancó). No cuentan como vivas porque el estado no es Vigente.
- **13 piezas Observadas con fechas dentro de rango.** Por spec, quedan fuera de toda alerta.
- Histórico: 115 piezas `sin_ambito` (OTRO/REGIÓN/CIRCUITO/CÓDIGO_AUDIENCIA) no se atribuyen a ninguna localidad.
