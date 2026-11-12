import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.mjs';
import { createFakeRepo } from './fake-repo.mjs';
import { can, roleList, PERMISSION_IDS } from '../src/roles.mjs';

const PASS = 'Clave1234';

async function setup() {
  const repo = createFakeRepo();
  const server = createApp({ repo, config: { production: false, allowedOrigins: ['http://localhost'], ingestKey: 'k', onReset() {} } }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/panel`;
  const call = async (method, path, body, cookie) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
  };
  return { call, close: () => server.close() };
}

test('permisos por rol', () => {
  // super_admin: todo
  assert.ok(PERMISSION_IDS.every((p) => can('super_admin', p)));
  // admin: solo lectura (supervisión), sin cuentas ni ajustes ni bot
  assert.ok(can('admin', 'supervision') && can('admin', 'ver_taller') && can('admin', 'combustible'));
  assert.ok(!can('admin', 'usuarios') && !can('admin', 'editar_taller') && !can('admin', 'ajustes_tractores') && !can('admin', 'panel_completo') && !can('admin', 'bot'));
  // jefe de taller: el taller, con captura
  assert.ok(can('jefe_taller', 'ver_taller') && can('jefe_taller', 'editar_taller'));
  assert.ok(!can('jefe_taller', 'supervision') && !can('jefe_taller', 'combustible') && !can('jefe_taller', 'usuarios') && !can('jefe_taller', 'bot'));
  // operador: solo el bot
  assert.ok(can('operador', 'bot'));
  assert.ok(PERMISSION_IDS.filter((p) => p !== 'bot').every((p) => !can('operador', p)));
  // pendiente: nada; 'user' antiguo = operador
  assert.ok(PERMISSION_IDS.every((p) => !can('pendiente', p)));
  assert.ok(can('user', 'bot') && !can('user', 'ver_taller'));
});

test('roleList trae los roles en orden y sus permisos (para la matriz del panel)', () => {
  const lista = roleList();
  assert.deepEqual(lista.map((x) => x.id), ['super_admin', 'admin', 'jefe_taller', 'operador', 'pendiente']);
  const r = Object.fromEntries(lista.map((x) => [x.id, x]));
  assert.deepEqual(r.super_admin.permissions, PERMISSION_IDS);
  assert.deepEqual(r.admin.permissions, ['supervision', 'ver_taller', 'combustible']);
  assert.deepEqual(r.jefe_taller.permissions, ['ver_taller', 'editar_taller']);
  assert.deepEqual(r.operador.permissions, ['bot']);
  assert.deepEqual(r.pendiente.permissions, []);
});

test('registro abierto (pendiente hasta que se asigne rol); cada rol hace solo lo suyo; admin es de solo lectura', async () => {
  const { call, close } = await setup();
  try {
    // la primera cuenta es super_admin
    const first = await call('POST', '/register', { name: 'Dueño', email: 'super@x.mx', password: PASS });
    assert.equal(first.body.role, 'super_admin');
    const S = (await call('POST', '/login', { email: 'super@x.mx', password: PASS })).cookie;
    assert.ok((await call('GET', '/session', null, S)).body.permissions.includes('usuarios'));

    // sin invitación: queda pendiente y no ve nada
    const pend = await call('POST', '/register', { name: 'Nuevo', email: 'a@x.mx', password: PASS });
    assert.equal(pend.status, 201);
    assert.equal(pend.body.role, 'pendiente');
    assert.deepEqual(pend.body.permissions, []);
    const P = (await call('POST', '/login', { email: 'a@x.mx', password: PASS })).cookie;
    const blocked = await call('GET', '/devices', null, P);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.pending, true);
    assert.equal((await call('POST', '/samples', { samples: [{ deviceId: 1, fixTime: '2026-11-01T00:00:00Z' }] }, P)).status, 401);

    // invitaciones: solo super_admin; roles válidos, nunca «pendiente», inventados ni el viejo «supervisor»
    assert.equal((await call('POST', '/invitations', { email: 'x@x.mx', role: 'operador' })).status, 401);
    for (const role of ['dios', 'pendiente', 'supervisor']) {
      assert.equal((await call('POST', '/invitations', { email: 'x@x.mx', role }, S)).status, 400, role);
    }

    const alta = async (email, role) => {
      const inv = await call('POST', '/invitations', { email, role }, S);
      assert.equal(inv.status, 201);
      const reg = await call('POST', '/register', { name: role, email, password: PASS, invite: inv.body.token });
      assert.equal(reg.body.role, role);
      return (await call('POST', '/login', { email, password: PASS })).cookie;
    };
    // la invitación solo sirve para su correo
    const inv1 = await call('POST', '/invitations', { email: 'j@x.mx', role: 'jefe_taller' }, S);
    assert.equal((await call('POST', '/register', { name: 'Otro', email: 'otro@x.mx', password: PASS, invite: inv1.body.token })).status, 403);
    assert.equal((await call('POST', '/register', { name: 'Falsa', email: 'f@x.mx', password: PASS, invite: 'inventado' })).status, 403);
    await call('POST', '/register', { name: 'Jefe', email: 'j@x.mx', password: PASS, invite: inv1.body.token });
    const J = (await call('POST', '/login', { email: 'j@x.mx', password: PASS })).cookie;
    const AD = await alta('ad@x.mx', 'admin');
    const O = await alta('o@x.mx', 'operador');

    // permisos en la sesión
    assert.deepEqual((await call('GET', '/session', null, AD)).body.permissions, ['supervision', 'ver_taller', 'combustible']);
    assert.deepEqual((await call('GET', '/session', null, J)).body.permissions, ['ver_taller', 'editar_taller']);
    assert.deepEqual((await call('GET', '/session', null, O)).body.permissions, ['bot']);

    const dev = { name: 'JD 1', attributes: {} };
    const fuel = '/fuel-summary?from=2026-11-01&to=2026-11-02';
    // super_admin edita; los demás no editan tractores ni lotes ni ven cuentas
    assert.equal((await call('PUT', '/devices/1', dev, S)).status, 200);
    for (const [quien, ck] of [['admin', AD], ['jefe_taller', J], ['operador', O]]) {
      assert.equal((await call('PUT', '/devices/1', dev, ck)).status, 403, `${quien} no edita tractores`);
      assert.equal((await call('PUT', '/fences/1', dev, ck)).status, 403, `${quien} no edita lotes`);
      assert.equal((await call('GET', '/users', null, ck)).status, 403, `${quien} no ve cuentas`);
    }
    assert.equal((await call('GET', '/users', null, S)).status, 200);

    // combustible (Costeo de diésel): lo leen super_admin y admin; el jefe de taller y el operador no
    assert.notEqual((await call('GET', fuel, null, AD)).status, 403); // el repo en memoria no tiene samplesRange: aquí basta con que no sea 403
    assert.equal((await call('GET', fuel, null, J)).status, 403);
    assert.equal((await call('GET', fuel, null, O)).status, 403);

    // admin = solo lectura: lee, pero cualquier escritura se rechaza con readOnly
    assert.equal((await call('GET', '/devices', null, AD)).status, 200);
    assert.equal((await call('GET', '/route?deviceId=1&from=2026-11-01&to=2026-11-02', null, AD)).status, 200);
    const escrituras = [
      ['POST', '/samples', { samples: [{ deviceId: 1, fixTime: '2026-11-01T00:00:00Z' }] }],
      ['PUT', '/devices/1', dev],
      ['POST', '/invitations', { email: 'z@x.mx', role: 'operador' }],
      ['PATCH', '/users/1/role', { role: 'operador' }],
      ['DELETE', '/invitations/1'],
    ];
    for (const [m, p, b] of escrituras) {
      const x = await call(m, p, b, AD);
      assert.equal(x.status, 403, `${m} ${p}`);
      assert.equal(x.body.readOnly, true, `${m} ${p} debe decir solo lectura`);
    }
    // ...pero puede cerrar su sesión
    assert.equal((await call('DELETE', '/session', null, AD)).status, 204);

    // el selector de rol rechaza roles que no existen
    assert.equal((await call('PATCH', '/users/1/role', { role: 'dios' }, S)).status, 400);
  } finally { close(); }
});
