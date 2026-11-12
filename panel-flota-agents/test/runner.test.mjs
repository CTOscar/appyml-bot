import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from '../src/runner.mjs';
import { botCampo } from '../src/agents/bot-campo.mjs';
import { fakePool, bridgeWith, fakeClaude, textRes, toolRes, usage } from './helpers.mjs';

const pool = () =>
  fakePool([
    [/FROM operadores/, [{ id: 3, nombre: 'Juan' }]],
    [/FROM asignaciones/, [{ tractor: 'TR-12' }]],
  ]);
const base = { agent: botCampo, model: 'claude-haiku-5-5', messages: [{ role: 'user', content: '¿qué tractor tengo?' }], meta: { userId: 7 } };

test('ciclo con herramienta: llama a MCP, devuelve el resultado al modelo y suma tokens', async () => {
  const p = pool();
  const bridge = await bridgeWith(p);
  const client = fakeClaude([toolRes([{ name: 'mi_asignacion' }], usage(100, 20)), textRes('Tienes el TR-12.', usage(150, 10))]);
  const r = await runAgent({ ...base, client, bridge });
  assert.equal(r.text, 'Tienes el TR-12.');
  assert.equal(r.toolCalls, 1);
  assert.equal(r.iterations, 2);
  assert.equal(r.inputTokens, 250);
  assert.equal(r.outputTokens, 30);
  assert.deepEqual(p.calls[0].params, [7]); // userId inyectado por el servicio

  // La 2ª petición lleva el tool_result en un solo mensaje de usuario.
  const second = client.requests[1].messages;
  assert.equal(second.at(-1).role, 'user');
  assert.equal(second.at(-1).content[0].type, 'tool_result');
  assert.equal(second.at(-1).content[0].tool_use_id, 'tu_0');
  await bridge.close();
});

test('la petición a Claude usa el modelo configurado, esfuerzo bajo y solo las herramientas del agente', async () => {
  const bridge = await bridgeWith(pool());
  const client = fakeClaude([textRes('Hola.')]);
  await runAgent({ ...base, client, bridge });
  const req = client.requests[0];
  assert.equal(req.model, 'claude-haiku-5-5');
  assert.deepEqual(req.output_config, { effort: 'low' });
  assert.deepEqual(req.tools.map((t) => t.name).sort(), [...botCampo.tools].sort());
  assert.equal(req.temperature, undefined);
  assert.equal(req.thinking, undefined);
  await bridge.close();
});

test('varias herramientas en un turno: todos los resultados van juntos en un mensaje', async () => {
  const bridge = await bridgeWith(pool());
  const client = fakeClaude([
    toolRes([{ name: 'mi_asignacion' }, { name: 'leer_catalogo', input: { tipo: 'lotes' } }]),
    textRes('Listo.'),
  ]);
  const r = await runAgent({ ...base, client, bridge });
  assert.equal(r.toolCalls, 2);
  const results = client.requests[1].messages.at(-1).content;
  assert.equal(results.length, 2);
  await bridge.close();
});

test('una herramienta fuera de la lista del agente se rechaza sin ejecutarse', async () => {
  const p = pool();
  const bridge = await bridgeWith(p);
  const client = fakeClaude([toolRes([{ name: 'borrar_todo' }]), textRes('No pude.')]);
  await runAgent({ ...base, client, bridge });
  const tr = client.requests[1].messages.at(-1).content[0];
  assert.equal(tr.is_error, true);
  assert.match(tr.content, /no permitida/);
  assert.equal(p.calls.length, 0);
  await bridge.close();
});

test('refusal y max_tokens devuelven mensaje amable y ok=false', async () => {
  const bridge = await bridgeWith(pool());
  const a = await runAgent({ ...base, bridge, client: fakeClaude([{ stop_reason: 'refusal', content: [], usage: usage() }]) });
  assert.equal(a.ok, false);
  assert.equal(a.stopReason, 'refusal');
  const b = await runAgent({ ...base, bridge, client: fakeClaude([{ stop_reason: 'max_tokens', content: [], usage: usage() }]) });
  assert.equal(b.stopReason, 'max_tokens');
  await bridge.close();
});

test('tope de iteraciones: no se cicla para siempre', async () => {
  const bridge = await bridgeWith(pool());
  const client = fakeClaude(Array.from({ length: 10 }, () => toolRes([{ name: 'mi_asignacion' }])));
  const r = await runAgent({ ...base, client, bridge });
  assert.equal(r.stopReason, 'max_iterations');
  assert.equal(r.iterations, botCampo.maxIterations);
  assert.equal(r.ok, false);
  await bridge.close();
});

test('el prompt de Bot_Campo no promete funciones que aún no existen', () => {
  assert.match(botCampo.system, /NO puedes hacer/);
  assert.ok(!botCampo.tools.includes('crear_checklist'));
});
