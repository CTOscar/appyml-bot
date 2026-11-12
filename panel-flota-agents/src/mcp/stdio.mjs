// Arranca Fleet-DB como proceso MCP por stdio (lo lanza src/mcp/client.mjs).
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from '../config.mjs';
import { createPool } from '../db.mjs';
import { createFleetDbServer } from './fleet-db.mjs';

const config = loadConfig();
const pool = createPool(config.db, config.mcpDb);
await createFleetDbServer(pool).connect(new StdioServerTransport());
