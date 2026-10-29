# Carga Medios Tradicionales — snapshot 17/10/2026

Archivo: `MAESTRO_MT_ACTUALIZADO_1910.xlsx` (8 hojas). Fuente: hoja `60 LOCALIDADES` de `17_DE_OCTUBRE_-_60_LOCALIDADES_EXCEL.xlsx` (copias de respaldo ignoradas). Snapshot anterior: 09/10/2026 (8 días).

## Limpieza del crudo
- Filas con datos: 3.143
- REDES descartadas: 750
- PUBLINOTA (tipo nuevo, fuera de los 7 válidos): 22 filas, todas CÓRDOBA, todas Inactivo — **NO cargadas, pendiente de decisión** (ver abajo)
- Duplicados exactos colapsados: 2 (LEONES/RADIO/Fondos para escuelas técnicas; MORTEROS/RADIO/PPP)
- **Filas cargadas: 2.369** (Activo 474 · Inactivo 1.895). Las 60 localidades matchean la lista oficial, sin correcciones.

## Números esperados en la verificación
- Historico: 14.334 → **16.703** filas (+2.369, todas con Fecha_Snapshot 2026-10-17)
- Maestro_Vigente: 2.209 → **2.369** (Activo 543 → 474)
- Activos con Fecha_Desde: 297 (Antigüedad calculada contra 17/10). Alertas: 🔴 58 · 🟡 16 · 🟢 223. Los 177 Activos restantes no tienen fecha de inicio (Cartelería/Vía Pública).
- Cobertura (7 tipos válidos; REDES siempre 0): 🟠 Baja 9 · 🟡 Media 20 · 🟢 Alta 31 · ⛔ Sin pauta 0
- Cambios_Ultima_Semana: **127** combinaciones (09/10 → 17/10)
- Caidos: **2** — LA CARLOTA/GRÁFICA (Caminos que conectan: Circunvalación Villa María - Villa Nueva) y VILLA DEL ROSARIO/WEB (Rutas que conectan)
- Combinaciones nuevas con tema activo (no se anotan en Cambios ni Caidos): 40
- Sin Fecha_Desde ni Fecha_Hasta: 204 filas (112 Cartelería, 92 Vía Pública) — se mantienen en el xlsx; el pipeline las descarta (regla 09/10)
- Futuras ya cargadas como Inactivo: 14 (sin tocar, pendiente de auditoría con el área)

## Pendiente de decisión
**PUBLINOTA**: tipo de medio nuevo no incluido en los 7 válidos (22 filas, CÓRDOBA, 02/09–16/10). No se cargó al Historico (es append-only). Si es válido: se suma como tipo 8 (impacta Cobertura, pipeline y frontend). Si no, se descarta como REDES.

## Notas
- Portada no se tocó (sigue diciendo 05/10/2026, igual que en la carga del 09/10).
- El 17/10/2026 es sábado (cadencia habitual: viernes).
