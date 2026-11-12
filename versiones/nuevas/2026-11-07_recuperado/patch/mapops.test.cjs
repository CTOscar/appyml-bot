// Pruebas de la lógica pura de panelpack/assets/mapops.js (sin navegador).  Uso: node --test patch/mapops.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'panelpack', 'assets', 'mapops.js'), 'utf8');
const ctx = { window: {}, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx); // sin `document`, el módulo solo exporta la lógica
const T = ctx.window.__mapops._t;
const C = { ...T.DEF };

test('kmh convierte nudos de Traccar a km/h', () => {
  assert.equal(Math.round(T.kmh({ speed: 10 })), 19);
  assert.equal(T.kmh({}), 0);
  assert.equal(T.kmh(null), 0);
});

test('classify: sin señal, apagado, parado, tránsito y trabajo', () => {
  assert.equal(T.classify({ nosignal: true, ignition: true, v: 9, inLote: true }, C), 'sinsenal');
  assert.equal(T.classify({ nosignal: false, ignition: false, v: 0, inLote: true }, C), 'apagado');
  assert.equal(T.classify({ nosignal: false, ignition: true, v: 0.4, inLote: true }, C), 'ralenti');
  assert.equal(T.classify({ nosignal: false, ignition: true, v: 12, inLote: false }, C), 'transito');
  assert.equal(T.classify({ nosignal: false, ignition: true, v: 6, inLote: true }, C), 'trabajo');
  assert.equal(T.classify({ nosignal: false, ignition: true, v: 1, inLote: true }, C), 'trabajo'); // justo en el mínimo
});

test('outOfSchedule: horario normal y horario que cruza medianoche', () => {
  const d = (h, m = 0) => new Date(2026, 10, 10, h, m);
  assert.equal(T.outOfSchedule(d(5, 59), '06:00', '20:00'), true);
  assert.equal(T.outOfSchedule(d(6, 0), '06:00', '20:00'), false);
  assert.equal(T.outOfSchedule(d(19, 59), '06:00', '20:00'), false);
  assert.equal(T.outOfSchedule(d(20, 0), '06:00', '20:00'), true);
  // turno nocturno 22:00 → 06:00
  assert.equal(T.outOfSchedule(d(23), '22:00', '06:00'), false);
  assert.equal(T.outOfSchedule(d(3), '22:00', '06:00'), false);
  assert.equal(T.outOfSchedule(d(12), '22:00', '06:00'), true);
  // horario inválido o igual: nunca alerta
  assert.equal(T.outOfSchedule(d(12), '', '06:00'), false);
  assert.equal(T.outOfSchedule(d(12), '08:00', '08:00'), false);
});

test('fuelStep: extracción con motor apagado (acumulada en la ventana)', () => {
  const st = {};
  const t0 = 1e12;
  assert.equal(T.fuelStep(st, t0, 200, false, 10), null);
  assert.equal(T.fuelStep(st, t0 + 60e3, 196, false, 10), null); // −4 L: aún no
  assert.equal(T.fuelStep(st, t0 + 120e3, 192, false, 10), null); // −8 L acumulados
  const ev = T.fuelStep(st, t0 + 180e3, 189, false, 10); // −11 L acumulados
  assert.equal(ev.tipo, 'extraccion');
  assert.equal(Math.round(ev.litros), 11);
  assert.equal(T.fuelStep(st, t0 + 240e3, 188, false, 10), null); // la ventana se reinició: no repite
});

test('fuelStep: con motor encendido el consumo normal no alerta, la caída brusca sí', () => {
  const st = {};
  let t = 1e12, f = 200;
  T.fuelStep(st, t, f, true, 10);
  for (let i = 0; i < 40; i++) { t += 5000; f -= 0.25; assert.equal(T.fuelStep(st, t, f, true, 10), null); } // −10 L lentos
  t += 5000; const ev = T.fuelStep(st, t, f - 35, true, 10);
  assert.equal(ev.tipo, 'caida');
  assert.equal(Math.round(ev.litros), 35);
});

test('fuelStep: carga de combustible', () => {
  const st = {};
  T.fuelStep(st, 1e12, 50, false, 10);
  const ev = T.fuelStep(st, 1e12 + 60e3, 120, false, 10);
  assert.equal(ev.tipo, 'carga');
  assert.equal(ev.litros, 70);
});

test('fuelStep: una lectura que baja menos que el umbral no alerta', () => {
  const st = {};
  T.fuelStep(st, 1e12, 100, false, 10);
  assert.equal(T.fuelStep(st, 1e12 + 1000, 95, false, 10), null);
});

test('speedStep: abre un episodio, lo actualiza y lo cierra', () => {
  let r = T.speedStep(null, 1000, 5, 8, [0, 0]);
  assert.equal(r.ep, null); // dentro del límite
  r = T.speedStep(null, 2000, 12, 8, [1, 1]);
  assert.equal(r.nuevo, true);
  const ep = r.ep;
  r = T.speedStep(ep, 5000, 15, 8, [2, 2]);
  assert.equal(r.nuevo, false);
  assert.equal(r.ep.max, 15);
  assert.equal(r.ep.pts.length, 2);
  r = T.speedStep(r.ep, 8000, 6, 8, [3, 3]);
  assert.equal(r.ep, null); // bajó del límite: cierra
});

test('speedStep: tras un hueco de más de 60 s es un episodio nuevo', () => {
  const a = T.speedStep(null, 1000, 12, 8, [0, 0]);
  const b = T.speedStep(a.ep, 1000 + 61000, 12, 8, [1, 1]);
  assert.equal(b.nuevo, true);
});

test('markSegment + haFromCells: no cuenta dos veces un traslape', () => {
  const w = 8, cells = {};
  const a = [23.0, -105.9], b = [23.0, -105.9 + 0.001]; // ~102 m al este
  T.markSegment(cells, a, b, w);
  const n1 = Object.keys(cells).length;
  assert.ok(n1 >= 12 && n1 <= 16, 'celdas de un pase: ' + n1); // ~102 m / 8 m
  T.markSegment(cells, a, b, w); // se repite el mismo pase
  assert.equal(Object.keys(cells).length, n1);
  assert.ok(T.haFromCells(n1, w) > 0.07 && T.haFromCells(n1, w) < 0.11);
});

test('polyHa: lote de ~100 m × 100 m ≈ 1 ha y WKT lat/lon', () => {
  const lat = 23.0, dLat = 100 / 110540, dLon = 100 / (111320 * Math.cos(lat * Math.PI / 180));
  const area = `POLYGON ((${lat} -105.9, ${lat + dLat} -105.9, ${lat + dLat} ${-105.9 + dLon}, ${lat} ${-105.9 + dLon}, ${lat} -105.9))`;
  const poly = T.wkt(area);
  assert.equal(poly.length, 5);
  assert.equal(poly[0][0], 23.0);
  const ha = T.polyHa(poly);
  assert.ok(Math.abs(ha - 1) < 0.02, 'ha = ' + ha);
  assert.equal(T.wkt('basura'), null);
  assert.equal(T.polyHa([[0, 0]]), 0);
});
