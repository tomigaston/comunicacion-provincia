#!/usr/bin/env node
// Test de la lógica del front para Pauta Digital del interior (PRUEBA,
// 19/11/2026): vigencia por base semanal, fin previsto y avisos.
// Usa los archivos REALES de lib/ (los copia a una carpeta temporal como .mjs
// para poder importarlos con node, sin tocar el repo).
// Uso: node scripts/test_pd_interior_front.mjs
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LIB = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');
const tmp = mkdtempSync(join(tmpdir(), 'lib-pd-'));
for (const f of readdirSync(LIB).filter((n) => n.endsWith('.js'))) {
  const codigo = readFileSync(join(LIB, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'");
  writeFileSync(join(tmp, f.replace(/\.js$/, '.mjs')), codigo);
}
const s = await import(pathToFileURL(join(tmp, 'semaforo.mjs')).href);

const fallas = [];
let comprobaciones = 0;
const igual = (nombre, salio, esperado) => {
  comprobaciones += 1;
  if (JSON.stringify(salio) !== JSON.stringify(esperado)) fallas.push(`${nombre}: esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(salio)}`);
};
const interior = (kw = {}) => ({
  fuente: 'interior', estado: 'Vigente', sub_ambito: 'localidad_directa', en_60_localidades: true, alcance_tipo: 'localidad',
  localidad: 'VILLA MARIA', inicio: '2026-11-01', ultima_base: '2026-11-17', fin_previsto: '2026-11-20', finalizacion: '2026-11-30', ...kw,
});
const global = (kw = {}) => ({
  fuente: 'global', estado: 'Vigente', sub_ambito: 'localidad_directa', en_60_localidades: true, alcance_tipo: 'localidad',
  localidad: 'VILLA MARIA', inicio: '2026-11-01', finalizacion: '2026-11-20', ...kw,
});

// 1. Vigencia del interior: activa todo el día de su base sin mirar fechas.
igual('interior activa el día de la base aunque el fin previsto ya pasó', s.esPiezaPDViva(interior({ fin_previsto: '2026-11-10' }), '2026-11-17'), true);
igual('interior activa el día de la base con Inicio futuro', s.esPiezaPDViva(interior({ inicio: '2026-11-30' }), '2026-11-17'), true);
igual('interior activa el día de la base sin Inicio', s.esPiezaPDViva(interior({ inicio: null }), '2026-11-17'), true);
igual('interior activa después de la base si el fin previsto no pasó', s.esPiezaPDViva(interior(), '2026-11-20'), true);
igual('interior ya no activa si el fin previsto pasó después de la base', s.esPiezaPDViva(interior(), '2026-11-21'), false);
igual('interior sin fin previsto nunca vence', s.esPiezaPDViva(interior({ fin_previsto: null }), '2027-01-01'), true);
igual('interior Finalizada no es activa', s.esPiezaPDViva(interior({ estado: 'Finalizada' }), '2026-11-17'), false);
igual('venció en la semana', s.esPiezaPDVencidaEnLaSemana(interior(), '2026-11-21'), true);
igual('no venció en la semana el día de la base', s.esPiezaPDVencidaEnLaSemana(interior({ fin_previsto: '2026-11-10' }), '2026-11-17'), false);
igual('vencida sin renovar (interior): fin previsto anterior a su base', s.esPiezaPDVencidaSinRenovar(interior({ fin_previsto: '2026-11-10' }), '2026-11-13'), true);
igual('no vencida sin renovar (interior): fin previsto = día de la base', s.esPiezaPDVencidaSinRenovar(interior({ fin_previsto: '2026-11-17' }), '2026-11-13'), false);

// 2. El GLOBAL no cambia.
igual('global activa dentro de sus fechas', s.esPiezaPDViva(global(), '2026-11-17'), true);
igual('global no activa después de FIN', s.esPiezaPDViva(global(), '2026-11-21'), false);
igual('global sin FIN no es activa', s.esPiezaPDViva(global({ finalizacion: null }), '2026-11-17'), false);
igual('fin de cálculo del global = FIN', s.finCalculoPD(global()), '2026-11-20');
igual('fin de cálculo del interior = fin previsto', s.finCalculoPD(interior()), '2026-11-20');

// 3. Semáforo con el fin previsto: proyección, vencimientos y sin fin.
const piezas = [
  ...Array.from({ length: 6 }, () => interior({ fin_previsto: null })),        // no vencen
  ...Array.from({ length: 3 }, () => interior({ fin_previsto: '2026-11-20' })), // vencen en la ventana
  interior({ fin_previsto: '2026-11-30' }),                                     // vence después
];
const sem = s.calcularSemaforoPD(piezas, '2026-11-17', '2026-11-13');
igual('activas al 17/11', sem.activas, 10);
igual('color al 17/11', sem.color, '🟡');
igual('activas después de la ventana (sin fin cuentan)', sem.activasDespues, 7);
igual('vencen en la ventana', sem.vencenEnVentana.length, 3);
igual('próximo vencimiento', sem.proximoVencimiento, '2026-11-20');
igual('aviso', sem.aviso, null);
const soloSinFin = s.calcularSemaforoPD([interior({ fin_previsto: null })], '2026-11-17', '2026-11-13');
igual('sin fin: sin próximo vencimiento', soloSinFin.diasProximoVencimiento, null);
igual('filtro por período: interior sin fin queda abierto', s.finParaFiltroPD(interior({ finalizacion: null, fin_previsto: null })), '9999-12-31');
igual('filtro por período: finalizada sin fin llega hasta su baja', s.finParaFiltroPD(interior({ estado: 'Finalizada', finalizacion: null, fecha_baja_detectada: '2026-11-24' })), '2026-11-24');

rmSync(tmp, { recursive: true, force: true });
if (fallas.length) {
  console.log(`FALLÓ el test del front de PD interior (${fallas.length}):`);
  for (const f of fallas) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`OK — la lógica del front de PD interior pasa (${comprobaciones} comprobaciones).`);
