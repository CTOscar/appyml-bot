import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from './config.mjs';
import { createPool } from './db.mjs';
import { applySchema } from './schema.mjs';
import { McpBridge } from './mcp/client.mjs';
import { createApp } from './app.mjs';

const config = loadConfig();
if (!config.anthropicKey) throw new Error('Falta ANTHROPIC_API_KEY (ver .env.example).');

const pool = createPool(config.db);
console.log(`[schema] ${await applySchema(pool)} sentencias aplicadas`);

const bridge = await McpBridge.spawnFleetDb();
console.log(`[mcp] fleet-db: ${bridge.tools.map((t) => t.name).join(', ')}`);

const client = new Anthropic({ apiKey: config.anthropicKey });
const app = createApp({ config, pool, client, bridge });
app.listen(config.port, () => console.log(`[agents] http://localhost:${config.port}/health`));

const salir = async () => {
  await bridge.close().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', salir);
process.on('SIGTERM', salir);
