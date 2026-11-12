// Pruebas de la lógica pura de panelpack/assets/tractores.js.  Uso: node --test patch/tractores.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'panelpack', 'assets', 'tractores.js'), 'utf8');
const ctx = { window: {}, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx); // sin `document`, solo exporta la lógica
const T = ctx.window.__tractores._t;
// Los arreglos creados dentro de `vm` tienen otro prototipo y deepStrictEqual los rechaza: se normalizan antes de comparar.
const plain = (x) => JSON.parse(JSON.stringify(x));

const dev = (id, marca, modelo, nivel = 'A') => ({ id, name: 'TRC-' + id, attributes: { marca, modelo, nivel } });

test('slug normaliza marcas con espacios, mayúsculas y acentos', () => {
  assert.equal(T.slug('John Deere'), 'john-deere');
  assert.equal(T.slug('  NEW  Holland '), 'new-holland');
  assert.equal(T.slug('john-deere'), 'john-deere');
  assert.equal(T.slug('Kubotá'), 'kubota');
  assert.equal(T.slug(undefined), '');
});

test('groupDevices agrupa por marca y modelo y ordena JD, NH, otras; por potencia dentro de cada marca', () => {
  const list = [
    dev(1, 'new-holland', 'T6.110'), dev(2, 'john-deere', '6110J'), dev(3, 'john-deere', '5075E'),
    dev(4, 'new-holland', 'TT4.75'), dev(5, 'john-deere', '5075E'), dev(6, 'kubota', 'M7040'), dev(7, 'john-deere', '5090E'),
  ];
  const g = T.groupDevices(list);
  assert.deepEqual(plain(g.map((x) => x.marca + ' ' + x.modelo)), [
    'john-deere 5075E', 'john-deere 5090E', 'john-deere 6110J', 'new-holland TT4.75', 'new-holland T6.110', 'kubota M7040',
  ]);
  assert.deepEqual(plain(g[0].ids), [3, 5]);
  assert.equal(g[0].brand, 'John Deere');
  assert.equal(g[0].hp, 75);
  assert.equal(g[0].logo, '/brands/john-deere.png');
  assert.equal(g[5].brand, 'kubota'); // marca fuera del catálogo: se conserva el texto
  assert.equal(g[5].hp, 0);
});

test('groupDevices: marca o modelo faltante no rompe nada', () => {
  const g = T.groupDevices([{ id: 1, name: 'a' }, { id: 2, name: 'b', attributes: {} }, dev(3, 'John Deere', '')]);
  assert.equal(g.length, 2);
  assert.ok(g.some((x) => x.marca === 'otra' && x.modelo === 'Sin modelo' && x.ids.length === 2));
  assert.ok(g.some((x) => x.marca === 'john-deere' && x.modelo === 'Sin modelo'));
});

test('brandsOf lista cada marca una vez, en orden', () => {
  const g = T.groupDevices([dev(1, 'new-holland', 'T6.110'), dev(2, 'john-deere', '5075E'), dev(3, 'john-deere', '6110J')]);
  assert.deepEqual(plain(T.brandsOf(g).map((b) => b.marca)), ['john-deere', 'new-holland']);
});

test('fmtH formatea minutos y horas', () => {
  assert.equal(T.fmtH(0), '0 min');
  assert.equal(T.fmtH(45 * 60000), '45 min');
  assert.equal(T.fmtH(90 * 60000), '1.5 h');
  assert.equal(T.fmtH(2 * 3600000), '2 h');
  assert.equal(T.fmtH(undefined), '0 min');
});

test('el catálogo trae los cinco modelos de la flota piloto', () => {
  const m = (b) => plain(Object.keys(T.CATALOG[b].models));
  assert.deepEqual(m('john-deere'), ['5075E', '5090E', '6110J']);
  assert.deepEqual(m('new-holland'), ['TT4.75', 'T6.110']);
});
