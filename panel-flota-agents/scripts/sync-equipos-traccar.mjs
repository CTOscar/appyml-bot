// Crea/actualiza `equipos` a partir de los dispositivos de TU Traccar real (no de device_settings).
//   Variables (en panel-flota-agents/.env): TRACCAR_URL, TRACCAR_EMAIL, TRACCAR_PASSWORD
//   npm run sync:equipos:traccar            -> escribe en MySQL
//   npm run sync:equipos:traccar -- --dry   -> solo muestra lo que encontró (sirve para probar la conexión y el acceso)
import { loadConfig } from '../src/config.mjs';
import { createPool } from '../src/db.mjs';
import { applySchema } from '../src/schema.mjs';
import { equipoDeDispositivo, guardarEquipos } from '../src/traccar-equipos.mjs';

const { TRACCAR_URL, TRACCAR_EMAIL, TRACCAR_PASSWORD } = process.env;
const dry = process.argv.includes('--dry');
const falta = Object.entries({ TRACCAR_URL, TRACCAR_EMAIL, TRACCAR_PASSWORD }).filter(([, v]) => !v).map(([k]) => k);
if (falta.length) { console.error(`Falta en panel-flota-agents/.env: ${falta.join(', ')}`); process.exit(1); }
const base = TRACCAR_URL.replace(/\/$/, '');

try {
  const ses = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: TRACCAR_EMAIL, password: TRACCAR_PASSWORD }) });
  if (!ses.ok) throw new Error(`Traccar rechazó el acceso (HTTP ${ses.status}). Revisa TRACCAR_EMAIL y TRACCAR_PASSWORD.`);
  const cookie = (ses.headers.get('set-cookie') || '').split(';')[0];
  const res = await fetch(`${base}/api/devices`, { headers: { Cookie: cookie, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Traccar respondió HTTP ${res.status} en /api/devices`);
  const devices = await res.json();
  const lista = devices.map(equipoDeDispositivo);
  console.log(`Traccar: ${devices.length} dispositivo(s)`);
  console.table(lista.map((e) => ({ no_economico: e.no_economico, device_id: e.device_id, imei: e.imei, marca: e.marca, modelo: e.modelo, sonda: e.sensor_diesel })));
  if (dry) { console.log('Modo --dry: no se escribió nada en MySQL.'); }
  else {
    const config = loadConfig(); const pool = createPool(config.db);
    try { await applySchema(pool); const r = await guardarEquipos(pool, lista); console.log(`equipos nuevos: ${r.nuevos} · actualizados: ${r.actualizados}`); } finally { await pool.end(); }
  }
} catch (e) {
  console.error('FALLÓ:', e.code ?? '', e.message);
  process.exitCode = 1;
}
