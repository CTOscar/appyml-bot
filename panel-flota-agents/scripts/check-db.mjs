// Prueba la conexión, aplica el esquema y cuenta filas de las tablas que usamos.
import { loadConfig } from '../src/config.mjs';
import { createPool } from '../src/db.mjs';
import { applySchema } from '../src/schema.mjs';

const config = loadConfig();
const pool = createPool(config.db);
try {
  await pool.query('SELECT 1');
  console.log('OK conexión MySQL');
  console.log(`OK esquema: ${await applySchema(pool)} sentencias`);
  for (const t of ['users', 'device_settings', 'position_samples', 'equipos', 'operadores', 'asignaciones', 'agent_roles', 'agent_usage_log']) {
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
    console.log(`  ${t}: ${n} filas`);
  }
} catch (e) {
  console.error('FALLÓ:', e.code ?? '', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
