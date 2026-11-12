import test from 'node:test';
import assert from 'node:assert/strict';
import { equipoDeDispositivo, guardarEquipos } from '../src/traccar-equipos.mjs';

test('convierte un dispositivo de Traccar en un equipo', () => {
  const e = equipoDeDispositivo({ id: 12, name: 'TRC-0012', uniqueId: '860000000012345', attributes: { marca: 'John Deere', modelo: '6110J', sonda: true } });
  assert.deepEqual(e, { no_economico: 'TRC-0012', device_id: 12, imei: '860000000012345', marca: 'John Deere', modelo: '6110J', sensor_diesel: 1 });
});

test('sin atributos: marca y modelo vacíos, sin sonda; recorta nombres largos', () => {
  const e = equipoDeDispositivo({ id: 3, name: 'x'.repeat(60), uniqueId: '1' });
  assert.equal(e.no_economico.length, 40);
  assert.equal(e.marca, ''); assert.equal(e.sensor_diesel, 0);
});

test('guardarEquipos cuenta nuevos y actualizados y no pisa lo capturado a mano', async () => {
  const llamadas = [];
  const pool = { query: async (sql, p) => { llamadas.push({ sql, p }); return [{ affectedRows: p[1] === 1 ? 1 : 2 }]; } };
  const r = await guardarEquipos(pool, [{ no_economico: 'A', device_id: 1, imei: '1', marca: '', modelo: '', sensor_diesel: 0 }, { no_economico: 'B', device_id: 2, imei: '2', marca: '', modelo: '', sensor_diesel: 0 }]);
  assert.deepEqual(r, { nuevos: 1, actualizados: 1 });
  assert.match(llamadas[0].sql, /IF\(marca = ''/);
});
