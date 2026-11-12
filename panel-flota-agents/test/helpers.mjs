import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createFleetDbServer } from '../src/mcp/fleet-db.mjs';
import { McpBridge } from '../src/mcp/client.mjs';

// Pool simulado: `rules` es [[regex, rows | (sql, params) => rows]]. Registra cada consulta en `calls`.
export function fakePool(rules) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      for (const [re, out] of rules) {
        if (re.test(sql)) return [typeof out === 'function' ? out(sql, params) : out];
      }
      return [[]];
    },
  };
}

// Conecta un servidor Fleet-DB real a un puente MCP real, en memoria.
export async function bridgeWith(pool) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createFleetDbServer(pool).connect(b);
  return McpBridge.connect(a);
}

// Cliente de Claude simulado: devuelve las respuestas en orden y guarda cada petición.
export function fakeClaude(responses) {
  const requests = [];
  const queue = [...responses];
  return {
    requests,
    messages: {
      async create(req) {
        requests.push(structuredClone(req));
        const next = queue.shift();
        if (!next) throw new Error('fakeClaude: sin más respuestas');
        return next;
      },
    },
  };
}

export const usage = (i = 10, o = 5) => ({ input_tokens: i, output_tokens: o, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
export const textRes = (text, u = usage()) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: u });
export const toolRes = (uses, u = usage()) => ({
  stop_reason: 'tool_use',
  content: uses.map((x, i) => ({ type: 'tool_use', id: `tu_${i}`, name: x.name, input: x.input ?? {} })),
  usage: u,
});
