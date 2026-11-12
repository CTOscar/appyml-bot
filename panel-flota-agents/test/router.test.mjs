import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAgent } from '../src/router.mjs';

test('el rol manda sobre el canal: un operador por web sigue en campo', () => {
  assert.deepEqual(resolveAgent({ agentRole: 'operador', channel: 'web_estrategia' }), { agent: 'campo', available: true });
});

test('jefe de taller y director apuntan a sus agentes, aún no disponibles', () => {
  assert.deepEqual(resolveAgent({ agentRole: 'jefe_taller' }), { agent: 'taller', available: false });
  assert.deepEqual(resolveAgent({ agentRole: 'director' }), { agent: 'estrategia', available: false });
});

test('sin rol usa el canal, y sin canal cae en campo', () => {
  assert.equal(resolveAgent({ channel: 'web_taller' }).agent, 'taller');
  assert.equal(resolveAgent({}).agent, 'campo');
  assert.equal(resolveAgent({ channel: 'inventado' }).agent, 'campo');
});

test('solo un administrador puede pedir un agente por nombre', () => {
  assert.equal(resolveAgent({ agentRole: 'operador', requested: 'estrategia', isAdmin: false }).agent, 'campo');
  assert.equal(resolveAgent({ requested: 'campo', isAdmin: true }).agent, 'campo');
  assert.equal(resolveAgent({ agentRole: 'operador', requested: 'taller', isAdmin: true }).agent, 'taller');
  assert.equal(resolveAgent({ requested: 'hacker', isAdmin: true }).agent, 'campo');
});
