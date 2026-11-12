import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.mjs';
import { createFakeRepo } from './fake-repo.mjs';

const PASS = 'Clave1234', NUEVA = 'Nueva5678';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function setup() {
  const repo = createFakeRepo();
  const server = createApp({ repo, config: { production: false, allowedOrigins: ['http://localhost'], ingestKey: 'k', onReset() {} } }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/panel`;
  const call = async (method, path, body, cookie) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const raw = await res.arrayBuffer(), text = Buffer.from(raw).toString('utf8');
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* no es JSON (p. ej. una imagen) */ }
    return { status: res.status, body: json, bytes: raw.byteLength, type: res.headers.get('content-type'), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
  };
  const admin = await call('POST', '/register', { name: 'Ana Admin', email: 'ana@x.test', password: PASS });
  const login = await call('POST', '/login', { email: 'ana@x.test', password: PASS });
  return { call, cookie: login.cookie, me: admin.body, close: () => server.close() };
}

test('la sesión indica si la cuenta tiene contraseña', async () => {
  const { call, cookie, close } = await setup();
  const s = await call('GET', '/session', null, cookie);
  assert.equal(s.body.hasPassword, true);
  assert.ok(Array.isArray(s.body.permissions));
  close();
});

test('cambiar la propia contraseña exige la actual y no deja el perfil a medias', async () => {
  const { call, cookie, me, close } = await setup();
  const sin = await call('PUT', `/users/${me.id}`, { name: 'Otro Nombre', email: 'ana@x.test', password: NUEVA }, cookie);
  assert.equal(sin.status, 403);
  const mala = await call('PUT', `/users/${me.id}`, { name: 'Otro Nombre', email: 'ana@x.test', password: NUEVA, currentPassword: 'Incorrecta1' }, cookie);
  assert.equal(mala.status, 403);
  assert.equal((await call('GET', '/session', null, cookie)).body.name, 'Ana Admin', 'un error no debe guardar el nombre');
  const ok = await call('PUT', `/users/${me.id}`, { name: 'Otro Nombre', email: 'ana@x.test', password: NUEVA, currentPassword: PASS }, cookie);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.name, 'Otro Nombre');
  assert.ok(ok.body.permissions && ok.body.hasPassword, 'la respuesta trae lo mismo que /session');
  assert.equal((await call('POST', '/login', { email: 'ana@x.test', password: NUEVA })).status, 200);
  assert.equal((await call('POST', '/login', { email: 'ana@x.test', password: PASS })).status, 401);
  close();
});

test('editar nombre, teléfono y atributos no pide contraseña', async () => {
  const { call, cookie, me, close } = await setup();
  const r = await call('PUT', `/users/${me.id}`, { name: 'Ana Pérez', email: 'ana@x.test', phone: '6671234567', attributes: { puesto: 'Gerente' } }, cookie);
  assert.equal(r.status, 200);
  assert.equal(r.body.phone, '6671234567');
  assert.equal(r.body.attributes.puesto, 'Gerente');
  close();
});

test('un administrador puede restablecer la contraseña de otra persona sin la actual', async () => {
  const { call, cookie, close } = await setup();
  const inv = await call('POST', '/invitations', { email: 'beto@x.test', role: 'operador' }, cookie);
  const token = new URL(inv.body.link, 'http://x').searchParams.get('invite') || inv.body.token || String(inv.body.link).split('invite=')[1];
  const reg = await call('POST', '/register', { name: 'Beto Operador', email: 'beto@x.test', password: PASS, invite: token });
  assert.equal(reg.status, 201);
  const r = await call('PUT', `/users/${reg.body.id}`, { name: 'Beto Operador', email: 'beto@x.test', password: NUEVA }, cookie);
  assert.equal(r.status, 200);
  assert.equal((await call('POST', '/login', { email: 'beto@x.test', password: NUEVA })).status, 200);
  close();
});

test('foto de perfil: subir, leer, reemplazar y quitar', async () => {
  const { call, cookie, me, close } = await setup();
  assert.equal((await call('GET', `/users/${me.id}/photo`, null, cookie)).status, 404);
  assert.equal((await call('PUT', `/users/${me.id}/photo`, { image: JPG }, cookie)).status, 204);
  const got = await call('GET', `/users/${me.id}/photo`, null, cookie);
  assert.equal(got.status, 200);
  assert.equal(got.type, 'image/jpeg');
  assert.ok(got.bytes > 50);
  assert.equal((await call('PUT', `/users/${me.id}/photo`, { image: 'no-es-imagen' }, cookie)).status, 400);
  assert.equal((await call('DELETE', `/users/${me.id}/photo`, null, cookie)).status, 204);
  assert.equal((await call('GET', `/users/${me.id}/photo`, null, cookie)).status, 404);
  close();
});
