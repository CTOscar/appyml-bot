// Deja tu Traccar listo para el panel: pone marca/modelo/nivel a los 5 tractores y crea los 9 lotes (geocercas) del rancho de ejemplo,
// ligándolos a todos los tractores (si no, Traccar no calcula en qué lote está cada uno). Se puede repetir: no duplica nada.
//   node --env-file=../panel-flota-agents/.env scripts/preparar-traccar.mjs        (usa TRACCAR_URL, TRACCAR_EMAIL, TRACCAR_PASSWORD)
//   añade --dry para solo mostrar lo que haría
import { createMockClient } from '../../versiones/nuevas/2026-11-10_fuente/src/api/mock.js';

// El cliente simulado del panel usa localStorage; en Node basta uno vacío para leer sus lotes de ejemplo.
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const { TRACCAR_URL, TRACCAR_EMAIL, TRACCAR_PASSWORD } = process.env;
const dry = process.argv.includes('--dry');
if (!TRACCAR_URL || !TRACCAR_EMAIL || !TRACCAR_PASSWORD) { console.error('Faltan TRACCAR_URL, TRACCAR_EMAIL o TRACCAR_PASSWORD (usa --env-file=../panel-flota-agents/.env).'); process.exit(1); }
const base = TRACCAR_URL.replace(/\/$/, '');

// Marca, modelo y nivel de cada tractor (los mismos del panel simulado de 5 tractores)
const FLOTA = {
  'TRC-0001': { marca: 'new-holland', modelo: 'TT4.75', nivel: 'A' },
  'TRC-0002': { marca: 'john-deere', modelo: '6110J', nivel: 'A' },
  'TRC-0003': { marca: 'new-holland', modelo: 'T6.110', nivel: 'A' },
  'TRC-0004': { marca: 'john-deere', modelo: '5090E', nivel: 'B' },
  'TRC-0005': { marca: 'john-deere', modelo: '5075E', nivel: 'B' },
};

let cookie = '';
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(base + path, { method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.headers.get('content-type')?.includes('json') ? res.json() : null;
}

const ses = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: TRACCAR_EMAIL, password: TRACCAR_PASSWORD }) });
if (!ses.ok) { console.error(`Traccar rechazó el acceso (HTTP ${ses.status}).`); process.exit(1); }
cookie = (ses.headers.get('set-cookie') || '').split(';')[0];

const devices = await api('/api/devices');
for (const d of devices) {
  const f = FLOTA[d.name]; if (!f) continue;
  const attrs = { ...d.attributes, ...f };
  const igual = Object.entries(f).every(([k, v]) => d.attributes?.[k] === v);
  console.log(`${igual ? '=' : '→'} ${d.name}: ${f.marca} ${f.modelo} nivel ${f.nivel}`);
  if (!dry && !igual) await api(`/api/devices/${d.id}`, { method: 'PUT', body: { ...d, attributes: attrs } });
}

const lotes = await createMockClient().getGeofences();
const existentes = await api('/api/geofences');
for (const g of lotes) {
  let ya = existentes.find((x) => x.name === g.name);
  console.log(`${ya ? '=' : '+'} lote ${g.name}`);
  if (dry) continue;
  if (!ya) ya = await api('/api/geofences', { method: 'POST', body: { name: g.name, area: g.area, attributes: g.attributes || {} } });
  for (const d of devices) {
    if (!FLOTA[d.name]) continue;
    try { await api('/api/permissions', { method: 'POST', body: { deviceId: d.id, geofenceId: ya.id } }); } catch (e) { if (!/400/.test(e.message)) throw e; /* 400 = ya estaba ligado */ }
  }
}
console.log(dry ? 'Modo --dry: no se cambió nada en Traccar.' : 'Listo.');
