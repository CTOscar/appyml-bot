// Pruebas de la lógica pura de panelpack/assets/maptools.js.  Uso: node --test patch/maptools.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'panelpack', 'assets', 'maptools.js'), 'utf8');
const ctx = { window: {}, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx); // sin `document`, solo exporta la lógica
const T = ctx.window.__maptools._t;
const plain = (x) => JSON.parse(JSON.stringify(x)); // los objetos de `vm` tienen otro prototipo

test('distM: 1° de latitud ≈ 111.19 km y simetría', () => {
  assert.ok(Math.abs(T.distM([0, 0], [1, 0]) - 111195) < 100);
  assert.equal(T.distM([23, -105], [23, -105]), 0);
  const a = [22.74, -105.93], b = [22.80, -105.90];
  assert.ok(Math.abs(T.distM(a, b) - T.distM(b, a)) < 1e-6);
  // 0.001° de longitud a 23° ≈ 102 m
  assert.ok(Math.abs(T.distM([23, -105.9], [23, -105.899]) - 102.4) < 1.5);
});

test('inPoly: dentro, fuera y en un polígono cóncavo', () => {
  const sq = [[0, 0], [0, 10], [10, 10], [10, 0]];
  assert.equal(T.inPoly([5, 5], sq), true);
  assert.equal(T.inPoly([11, 5], sq), false);
  const L = [[0, 0], [0, 10], [4, 10], [4, 4], [10, 4], [10, 0]]; // forma de L
  assert.equal(T.inPoly([2, 8], L), true);
  assert.equal(T.inPoly([8, 8], L), false); // el hueco de la L
});

test('wkt y polyHa: lote de ~100 m × 100 m ≈ 1 ha', () => {
  const lat = 23, dLat = 100 / 110540, dLon = 100 / (111320 * Math.cos(lat * Math.PI / 180));
  const poly = T.wkt(`POLYGON ((${lat} -105.9, ${lat + dLat} -105.9, ${lat + dLat} ${-105.9 + dLon}, ${lat} ${-105.9 + dLon}, ${lat} -105.9))`);
  assert.equal(poly.length, 5);
  assert.ok(Math.abs(T.polyHa(poly) - 1) < 0.02);
  assert.equal(T.wkt('nada'), null);
});

test('nearest y within: el más cercano y los que caen dentro del radio, ordenados', () => {
  const it = [{ id: 1, lat: 23.0, lon: -105.9 }, { id: 2, lat: 23.0, lon: -105.899 }, { id: 3, lat: 23.01, lon: -105.9 }];
  assert.equal(T.nearest(it, 23.0, -105.8992).item.id, 2); // ~20 m del 2 y ~82 m del 1
  assert.equal(T.nearest(it, 23.0, -105.9008).item.id, 1);
  assert.ok(Math.abs(T.nearest(it, 23.0, -105.8992).d - 20.5) < 1.5);
  assert.equal(T.nearest([], 0, 0), null);
  const w = plain(T.within(it, 23.0, -105.9, 200).map((o) => o.item.id));
  assert.deepEqual(w, [1, 2]); // el 3 está a ~1.1 km
  assert.equal(T.within(it, 23.0, -105.9, 5000).length, 3);
  assert.equal(T.within(it, 23.0, -105.9, 0.1).length, 1); // el centro exacto
});

test('fmtDist, etaMin y fmtEta', () => {
  assert.equal(T.fmtDist(42.4), '42 m');
  assert.equal(T.fmtDist(999), '999 m');
  assert.equal(T.fmtDist(1500), '1.50 km');
  assert.equal(T.fmtDist(12500), '12.5 km');
  assert.equal(Math.round(T.etaMin(15000, 15)), 60);
  assert.equal(T.etaMin(1000, 0), Infinity);
  assert.equal(T.fmtEta(0.4), '< 1 min');
  assert.equal(T.fmtEta(24.6), '25 min');
  assert.equal(T.fmtEta(135), '2 h 15 min');
  assert.equal(T.fmtEta(Infinity), '—');
});

test('matches: sin acentos, sin mayúsculas y por todas las palabras', () => {
  assert.equal(T.matches('TRC-0005 John Deere 5075E', 'trc-0005'), true);
  assert.equal(T.matches('TRC-0005 John Deere 5075E', 'john 5075'), true);
  assert.equal(T.matches('El Álamo · Lote 1', 'alamo lote'), true);
  assert.equal(T.matches('El Álamo · Lote 1', 'lote 9'), false);
  assert.equal(T.matches('abc', '   '), false);
});

test('encodeView / decodeView: ida y vuelta y rechazo de basura', () => {
  const s = T.encodeView({ layer: 'sat', lat: 22.741012, lon: -105.932531, zoom: 15.4, sel: 12 });
  assert.equal(s, 'sat,22.74101,-105.93253,15,t12');
  assert.deepEqual(plain(T.decodeView(s)), { layer: 'sat', lat: 22.74101, lon: -105.93253, zoom: 15, sel: 12 });
  assert.equal(T.encodeView({ layer: 'map', lat: 1, lon: 2, zoom: 3, sel: null }), 'map,1.00000,2.00000,3');
  assert.equal(plain(T.decodeView('map,1,2,3')).sel, null);
  for (const bad of ['', null, 'sat,1,2', 'xyz,1,2,3', 'sat,91,2,3', 'sat,1,181,3', 'sat,1,2,0', 'sat,1,2,22', 'sat,a,b,c', 'sat,1,2,3,x9', 'sat,1,2,3,t']) {
    assert.equal(T.decodeView(bad), null, 'debe rechazar: ' + bad);
  }
});

test('TIPOS de nota: todos con ícono y nombre', () => {
  const t = plain(T.TIPOS);
  assert.ok(Object.keys(t).length >= 5 && t.otro);
  for (const k of Object.keys(t)) { assert.equal(t[k].length, 2); assert.ok(t[k][0] && t[k][1]); }
});
