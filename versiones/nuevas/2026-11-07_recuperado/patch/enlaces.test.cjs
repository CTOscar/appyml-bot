// Pruebas de la lógica pura de panelpack/assets/enlaces.js.  Uso: node --test patch/enlaces.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'panelpack', 'assets', 'enlaces.js'), 'utf8');
const ctx = { window: {}, console, URL };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx); // sin `document`, solo exporta la lógica
const T = ctx.window.__enlaces._t;
const plain = (x) => JSON.parse(JSON.stringify(x)); // los objetos de `vm` tienen otro prototipo

const DATA = [
  { title: 'Rastreadores', icon: 'chip', links: [{ label: 'Teltonika FMC130', note: 'Nivel A · tractores sin electrónica', href: 'https://www.teltonika-gps.com/products/trackers/advanced/fmc130', image: '/links/fmc130.png' }, { label: 'Teltonika FMC150', note: 'Nivel B · lectura CAN', href: 'https://www.teltonika-gps.com/products/trackers/can-data/fmc150' }] },
  { title: 'Sensores', icon: 'fuel', links: [{ label: 'Escort TD-BLE 1000', note: 'Sonda de combustible BLE · CJP México', href: 'https://tienda.cjp.mx/compra/x' }] },
  { title: 'Plataforma', links: [{ label: 'Traccar', note: 'Servidor de rastreo', href: 'https://www.traccar.org/' }] },
];

test('safeHref solo deja pasar http(s)', () => {
  assert.equal(T.safeHref('https://traccar.org/'), 'https://traccar.org/');
  assert.equal(T.safeHref('http://localhost:3000/x?y=1'), 'http://localhost:3000/x?y=1');
  for (const bad of ['javascript:alert(1)', 'data:text/html,<b>', 'ftp://x.y', '//evil.com', '/ruta', '', null, undefined, 'https://a.b/"onmouseover="x', 'https://a b', "https://a.b/'x"]) {
    assert.equal(T.safeHref(bad), '#', 'debe rechazar: ' + bad);
  }
});

test('hostOf quita www y tolera basura', () => {
  assert.equal(T.hostOf('https://www.teltonika-gps.com/products'), 'teltonika-gps.com');
  assert.equal(T.hostOf('https://tienda.cjp.mx/compra/x'), 'tienda.cjp.mx');
  assert.equal(T.hostOf('no es url'), '');
});

test('esc escapa HTML', () => {
  assert.equal(T.esc('<img src=x onerror="a">&'), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;');
  assert.equal(T.esc(null), '');
});

test('flatten aplana categorías, ignora entradas inválidas y conserva la categoría', () => {
  const f = plain(T.flatten(DATA));
  assert.equal(f.length, 4);
  assert.deepEqual(f.map((x) => x.cat), ['Rastreadores', 'Rastreadores', 'Sensores', 'Plataforma']);
  assert.equal(f[0].image, '/links/fmc130.png');
  assert.equal(f[1].image, '');
  assert.deepEqual(plain(T.flatten(null)), []);
  assert.deepEqual(plain(T.flatten([null, { title: 'X' }, { title: 'Y', links: [null, { label: 'sin href' }, { href: 'https://a.b/' }] }])).map((x) => x.label), ['a.b']);
});

test('filterLinks por categoría y por texto (sin acentos, todas las palabras)', () => {
  const all = T.flatten(DATA);
  assert.equal(T.filterLinks(all, 'todos', '').length, 4);
  assert.equal(T.filterLinks(all, 'Rastreadores', '').length, 2);
  assert.equal(T.filterLinks(all, 'todos', 'teltonika').length, 2);
  assert.equal(T.filterLinks(all, 'todos', 'fmc150 can').length, 1);
  assert.equal(T.filterLinks(all, 'todos', 'electronica').length, 1); // «electrónica» sin acento
  assert.equal(T.filterLinks(all, 'todos', 'cjp').length, 1); // por dominio
  assert.equal(T.filterLinks(all, 'Sensores', 'teltonika').length, 0);
  assert.equal(T.filterLinks(all, 'todos', 'zzz').length, 0);
});

test('categories cuenta cada categoría en orden', () => {
  assert.deepEqual(plain(T.categories(T.flatten(DATA))), [{ cat: 'Rastreadores', n: 2 }, { cat: 'Sensores', n: 1 }, { cat: 'Plataforma', n: 1 }]);
});
