// Simula los 5 tractores del piloto mandando posiciones a Traccar por HTTP (protocolo OsmAnd, puerto 5055), como si fueran rastreadores.
// Los datos son inventados, pero viajan por el camino real: Traccar → panel (en vivo) y, con `npm run sync:traccar`, → MySQL (historial).
//   node --env-file=../panel-flota-agents/.env scripts/simular-flota.mjs                (Ctrl+C para detener)
//   opciones: --cada 5 (segundos entre envíos)   --acelerar 10 (el recorrido avanza 10× más rápido que en la vida real)   --una (manda una ronda y termina)
// Usa TRACCAR_URL (de su host toma el puerto 5055). Cada tractor trabaja en pasadas dentro de su lote; hay uno apagado.
import { createMockClient } from '../../versiones/nuevas/2026-11-10_fuente/src/api/mock.js';
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] == null ? true : process.argv[i + 1]); };
const CADA = Number(arg('cada', 5)), ACEL = Number(arg('acelerar', 10)), UNA = process.argv.includes('--una');
const host = new URL(process.env.TRACCAR_URL || 'http://localhost:8082').hostname;
const OSMAND = process.env.OSMAND_URL || `http://${host}:5055`;
const KMH_A_NUDOS = 1 / 1.852; // Traccar guarda la velocidad en nudos; el panel la multiplica por 1.852

// IMEI de prueba → lote donde trabaja, velocidad (km/h), si lleva sonda de combustible y si está encendido
const FLOTA = [
  { imei: '990000000000001', lote: 'San Isidro · Lote 3', kmh: 7, sonda: false, on: true },
  { imei: '990000000000002', lote: 'Las Palmas · Lote 2', kmh: 0, sonda: true, on: false },
  { imei: '990000000000003', lote: 'San Isidro · Lote 1', kmh: 6, sonda: false, on: true },
  { imei: '990000000000004', lote: 'Las Palmas · Lote 2', kmh: 8, sonda: true, on: true },
  { imei: '990000000000005', lote: 'El Álamo · Lote 3', kmh: 9, sonda: true, on: true },
];

const lotes = await createMockClient().getGeofences();
const caja = (g) => {
  const pts = [...g.area.matchAll(/(-?\d+\.\d+)\s+(-?\d+\.\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const la = pts.map((p) => p[0]), lo = pts.map((p) => p[1]);
  return { minLa: Math.min(...la), maxLa: Math.max(...la), minLo: Math.min(...lo), maxLo: Math.max(...lo) };
};
const M_LA = 110540; // metros por grado de latitud
let n = 0;
const est = FLOTA.map((t, i) => {
  const g = lotes.find((x) => x.name === t.lote); if (!g) throw new Error(`No encuentro el lote ${t.lote}`);
  const c = caja(g), mLo = 111320 * Math.cos(((c.minLa + c.maxLa) / 2) * Math.PI / 180);
  const ancho = (c.maxLo - c.minLo) * mLo, alto = (c.maxLa - c.minLa) * M_LA, paso = 24; // metros entre pasadas
  return { ...t, c, mLo, ancho, alto, paso, d: (i * 0.23) % 1 * ancho * 2, fuel: t.sonda ? 150 + i * 20 : null };
});

// Posición sobre el recorrido en pasadas (de ida y vuelta) tras avanzar `d` metros
function punto(e) {
  const pasadas = Math.max(1, Math.floor(e.alto / e.paso)), largo = pasadas * e.ancho;
  const s = e.d % (largo * 2); // ida por todas las pasadas y regreso, para no teletransportarse
  const u = s <= largo ? s : largo * 2 - s;
  const k = Math.min(pasadas - 1, Math.floor(u / e.ancho)), x = u - k * e.ancho, dir = k % 2 === 0 ? x : e.ancho - x;
  return { lat: e.c.minLa + ((k + 0.5) * e.paso) / M_LA, lon: e.c.minLo + dir / e.mLo, rumbo: (k % 2 === 0) === (s <= largo) ? 90 : 270 };
}

async function enviar(e, ahora) {
  const dt = CADA * ACEL;
  if (e.on) e.d += (e.kmh / 3.6) * dt;
  if (e.fuel != null) { e.fuel -= e.on ? 0.04 * dt / 10 : 0; if (e.fuel < 40) e.fuel += 150; /* carga de diésel */ }
  const p = punto(e);
  const q = new URLSearchParams({ id: e.imei, lat: p.lat.toFixed(6), lon: p.lon.toFixed(6), speed: (e.on ? e.kmh * KMH_A_NUDOS : 0).toFixed(2), bearing: String(p.rumbo), timestamp: String(Math.floor(ahora / 1000)), hdop: '1', ignition: String(e.on) });
  if (e.on) q.set('rpm', String(1500 + Math.round(Math.random() * 500)));
  if (e.fuel != null) q.set('fuel', String(Math.round(e.fuel)));
  const r = await fetch(`${OSMAND}/?${q}`);
  return r.ok;
}

console.log(`Simulando ${est.length} tractores → ${OSMAND} (cada ${CADA} s, recorrido ×${ACEL}). Ctrl+C para detener.`);
let ronda = 0;
do {
  const ahora = Date.now();
  const res = await Promise.allSettled(est.map((e) => enviar(e, ahora)));
  ronda++;
  console.log(`ronda ${ronda}: ${res.filter((r) => r.status === 'fulfilled' && r.value).length}/${est.length} enviados`);
  if (UNA) break;
  await new Promise((r) => setTimeout(r, CADA * 1000));
} while (true);
