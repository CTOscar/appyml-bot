import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

// Puente MCP -> API de Claude. Acepta cualquier transporte (stdio en producción, en memoria en pruebas).
export class McpBridge {
  constructor(client) {
    this.client = client;
    this.tools = [];
  }

  static async connect(transport) {
    const client = new Client({ name: 'agents-service', version: '0.1.0' });
    await client.connect(transport);
    const bridge = new McpBridge(client);
    bridge.tools = (await client.listTools()).tools;
    return bridge;
  }

  static async spawnFleetDb(env = process.env) {
    const script = fileURLToPath(new URL('./stdio.mjs', import.meta.url));
    return McpBridge.connect(new StdioClientTransport({ command: process.execPath, args: [script], env: { ...env } }));
  }

  // Definiciones en el formato de la API de Claude, filtradas por la lista permitida del agente.
  anthropicTools(allowed) {
    return this.tools
      .filter((t) => allowed.includes(t.name))
      .map((t) => ({ name: t.name, description: t.description ?? '', input_schema: t.inputSchema }));
  }

  // `meta` es contexto confiable (userId) que pone el servicio, no el modelo.
  async call(name, args, meta) {
    const res = await this.client.callTool({ name, arguments: args ?? {}, _meta: meta });
    const content = (res.content ?? []).map((b) => (b.type === 'text' ? b.text : '')).join('\n');
    return { content, isError: !!res.isError };
  }

  async close() {
    await this.client.close();
  }
}
