// Crea en `equipos` un registro por cada tractor de device_settings que aún no esté (sin inventar datos:
// solo no. económico = nombre y device_id). Marca, modelo, IMEI y sensor se completan a mano.
import { loadConfig } from '../src/config.mjs';
import { createPool } from '../src/db.mjs';
import { applySchema } from '../src/schema.mjs';

const config = loadConfig();
const pool = createPool(config.db);
try {
  await applySchema(pool);
  const [r] = await pool.query(
    `INSERT IGNORE INTO equipos (no_economico, device_id)
     SELECT LEFT(name, 40), device_id FROM device_settings`,
  );
  console.log(`equipos nuevos: ${r.affectedRows}`);
  const [rows] = await pool.query('SELECT id, no_economico, device_id, marca, modelo FROM equipos ORDER BY id');
  console.table(rows);
} catch (e) {
  console.error('FALLÓ:', e.code ?? '', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
