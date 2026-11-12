import test from 'node:test';
import assert from 'node:assert/strict';
import { fakePool, bridgeWith } from './helpers.mjs';

test('expone solo herramientas de lectura esperadas', async () => {
  const bridge = await bridgeWith(fakePool([]));
  assert.deepEqual(bridge.tools.map((t) => t.name).sort(), ['leer_catalogo', 'leer_telemetria_actual', 'mi_asignacion']);
  await bridge.close();
});

test('ninguna consulta de Fleet-DB escribe en la base', async () => {
  const pool = fakePool([
    [/FROM equipos/, [{ id: 1, no_economico: 'TR-12', device_id: 12, sensor_diesel: 1 }]],
    [/FROM position_samples/, [{ fix_time: new Date(), lat: 1, lon: 2, speed_knots: 1, fuel: 100, ignition: 1 }]],
  ]);
  const bridge = await bridgeWith(pool);
  await bridge.call('leer_catalogo', { tipo: 'equipos', buscar: 'TR' });
  await bridge.call('leer_catalogo', { tipo: 'lotes' });
  await bridge.call('leer_telemetria_actual', { equipo: 'TR-12' });
  await bridge.call('mi_asignacion', {}, { userId: 7 });
  assert.ok(pool.calls.length >= 4);
  for (const c of pool.calls) assert.match(c.sql.trim(), /^SELECT/i, c.sql);
  await bridge.close();
});

test('el filtro de búsqueda va como parámetro, no pegado al SQL', async () => {
  const pool = fakePool([]);
  const bridge = await bridgeWith(pool);
  await bridge.call('leer_catalogo', { tipo: 'equipos', buscar: "x'; DROP TABLE equipos;--" });
  const c = pool.calls[0];
  assert.doesNotMatch(c.sql, /DROP/);
  assert.ok(c.params.every((p) => p.includes('DROP TABLE')));
  await bridge.close();
});

test('telemetría: convierte nudos a km/h y marca dato viejo', async () => {
  const hace2h = new Date(Date.now() - 120 * 60000);
  const pool = fakePool([
    [/FROM equipos/, [{ id: 1, no_economico: 'TR-12', device_id: 12, sensor_diesel: 1 }]],
    [/FROM position_samples/, [{ fix_time: hace2h, lat: 24.1, lon: -107.2, speed_knots: 10, fuel: 180.5, ignition: 1 }]],
  ]);
  const bridge = await bridgeWith(pool);
  const r = await bridge.call('leer_telemetria_actual', { equipo: 'TR-12' });
  assert.equal(r.isError, false);
  const d = JSON.parse(r.content);
  assert.equal(d.velocidad_kmh, 18.5);
  assert.equal(d.diesel_litros, 180.5);
  assert.equal(d.dato_viejo, true);
  assert.equal(d.motor_encendido, true);
  assert.ok(d.hace_minutos >= 119 && d.hace_minutos <= 121);
  await bridge.close();
});

test('telemetría: equipo inexistente o sin rastreador devuelve error claro', async () => {
  const bridge = await bridgeWith(fakePool([]));
  const r = await bridge.call('leer_telemetria_actual', { equipo: 'TR-99' });
  assert.equal(r.isError, true);
  assert.match(r.content, /No encontré/);
  await bridge.close();

  const b2 = await bridgeWith(fakePool([[/FROM equipos/, [{ id: 2, no_economico: 'TR-5', device_id: null, sensor_diesel: 0 }]]]));
  const r2 = await b2.call('leer_telemetria_actual', { equipo: 'TR-5' });
  assert.equal(r2.isError, true);
  assert.match(r2.content, /no tiene rastreador/);
  await b2.close();
});

test('mi_asignacion usa el userId del servicio (_meta), no uno inventado por el modelo', async () => {
  const pool = fakePool([
    [/FROM operadores/, [{ id: 3, nombre: 'Juan' }]],
    [/FROM asignaciones/, [{ tractor: 'TR-12', implemento: 'RAS-1', lote: 'L4', rancho: 'Las Cabras' }]],
  ]);
  const bridge = await bridgeWith(pool);
  const r = await bridge.call('mi_asignacion', { userId: 999 }, { userId: 7 });
  assert.equal(r.isError, false);
  assert.deepEqual(pool.calls[0].params, [7]);
  assert.equal(JSON.parse(r.content).asignaciones_hoy[0].tractor, 'TR-12');

  const sinId = await bridge.call('mi_asignacion', {}, undefined);
  assert.equal(sinId.isError, true);
  await bridge.close();
});

test('mi_asignacion avisa si la cuenta no está ligada a un operador', async () => {
  const bridge = await bridgeWith(fakePool([]));
  const r = await bridge.call('mi_asignacion', {}, { userId: 7 });
  assert.equal(r.isError, true);
  assert.match(r.content, /no está ligada/);
  await bridge.close();
});
