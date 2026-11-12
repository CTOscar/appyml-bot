import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, cleanMessages } from '../src/app.mjs';
import { _clearAuthCache } from '../src/auth.mjs';
import { fakePool, bridgeWith, fakeClaude, textRes } from './helpers.mjs';

const config = {
  models: { campo: 'claude-haiku-5-5', taller: 'x', estrategia: 'y' },
  panelApiUrl: 'http://panel.test/api/panel',
  sessionCookie: 'pf_sid',
  allowedOrigins: ['http://localhost:3000'],
};

// Panel simulado: la cookie "ok-admin" es admin, "ok-user" es user; cualquier otra no tiene sesión.
const fetchImpl = async (url, opts) => {
  assert.equal(url, 'http://panel.test/api/panel/session');
  const c = opts.headers.cookie;
  if (c === 'pf_sid=ok-admin') return { ok: true, json: async () => ({ id: 1, name: 'Ana', role: 'admin' }) };
  if (c === 'pf_sid=ok-user') return { ok: true, json: async () => ({ id: 2, name: 'Juan', role: 'user' }) };
  return { ok: false };
};

async function start({ agentRole = null, claude = [textRes('Hola.')] } = {}) {
  _clearAuthCache();
  const pool = fakePool([
    [/FROM agent_roles/, agentRole ? [{ agent_role: agentRole }] : []],
    [/INSERT INTO agent_usage_log/, []],
  ]);
  const bridge = await bridgeWith(pool);
  const app = createApp({ config, pool, client: fakeClaude(claude), bridge, fetchImpl });
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}`;
  const close = async () => { server.close(); await bridge.close(); };
  return { url, pool, close };
}

const post = (url, body, cookie) =>
  fetch(`${url}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie: `pf_sid=${cookie}` } : {}) }, body: JSON.stringify(body) });

test('cleanMessages valida forma y recorta', () => {
  assert.equal(cleanMessages([]), null);
  assert.equal(cleanMessages([{ role: 'system', content: 'x' }]), null);
  assert.equal(cleanMessages([{ role: 'user', content: 5 }]), null);
  assert.equal(cleanMessages([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }]), null); // no termina en user
  assert.deepEqual(cleanMessages([{ role: 'assistant', content: 'b' }, { role: 'user', content: ' hola ' }]), [{ role: 'user', content: 'hola' }]);
});

test('/chat sin sesión: 401; con cookie inválida: 401', async () => {
  const s = await start();
  assert.equal((await post(s.url, { messages: [{ role: 'user', content: 'hola' }] })).status, 401);
  assert.equal((await post(s.url, { messages: [{ role: 'user', content: 'hola' }] }, 'falsa')).status, 401);
  await s.close();
});

test('/chat con sesión: responde, usa Haiku y registra el uso', async () => {
  const s = await start({ agentRole: 'operador' });
  const r = await post(s.url, { messages: [{ role: 'user', content: 'hola' }] }, 'ok-user');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.agent, 'campo');
  assert.equal(j.model, 'claude-haiku-5-5');
  assert.equal(j.reply, 'Hola.');
  assert.ok(s.pool.calls.some((c) => /INSERT INTO agent_usage_log/.test(c.sql)));
  await s.close();
});

test('rol de taller: 501 hasta que exista ese agente', async () => {
  const s = await start({ agentRole: 'jefe_taller' });
  const r = await post(s.url, { messages: [{ role: 'user', content: 'hola' }] }, 'ok-user');
  assert.equal(r.status, 501);
  await s.close();
});

test('un usuario normal no puede forzar otro agente; un admin sí', async () => {
  const s = await start({ agentRole: 'operador' });
  const u = await post(s.url, { agent: 'estrategia', messages: [{ role: 'user', content: 'hola' }] }, 'ok-user');
  assert.equal(u.status, 200); // ignora "agent" y se queda en campo
  assert.equal((await u.json()).agent, 'campo');
  const a = await post(s.url, { agent: 'estrategia', messages: [{ role: 'user', content: 'hola' }] }, 'ok-admin');
  assert.equal(a.status, 501);
  await s.close();
});

test('messages inválido: 400', async () => {
  const s = await start();
  assert.equal((await post(s.url, { messages: 'hola' }, 'ok-user')).status, 400);
  await s.close();
});

test('CORS: solo refleja orígenes permitidos', async () => {
  const s = await start();
  const ok = await fetch(`${s.url}/health`, { headers: { origin: 'http://localhost:3000' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(ok.headers.get('access-control-allow-credentials'), 'true');
  const mal = await fetch(`${s.url}/health`, { headers: { origin: 'http://evil.test' } });
  assert.equal(mal.headers.get('access-control-allow-origin'), null);
  await s.close();
});
