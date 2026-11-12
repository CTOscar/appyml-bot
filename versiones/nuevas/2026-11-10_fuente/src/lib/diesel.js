// Costeo de diésel (portado de panelpack/assets/home.js, funciones co*): semana de lunes a domingo en hora de Mazatlán
// y análisis de un día de posiciones → litros usados, horas, cargas, descargas, consumo por hora y nivel del tanque.
export const OFFSET = '-07:00'; // Mazatlán (sin horario de verano)
const DAY = 864e5;
const TZ = 'America/Mazatlan';
export const PRICE_KEY = 'pf-diesel-price';

export const dayKey = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms));
const hourMzt = (t) => new Date(t - 7 * 36e5).getUTCHours();
const sum = (a) => a.reduce((s, x) => s + x, 0);

// Los 7 días (AAAA-MM-DD) de la semana: offset 0 = esta semana, -1 = la anterior…
export function week(offset = 0, now = Date.now()) {
  const d = new Date(dayKey(now) + 'T12:00:00' + OFFSET);
  const mon = d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY + offset * 7 * DAY;
  return Array.from({ length: 7 }, (_, i) => dayKey(mon + i * DAY));
}

export function weekLabel(days) {
  const f = (k, y) => { const d = new Date(k + 'T12:00:00Z'); return d.getUTCDate() + ' ' + d.toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' }).replace('.', '') + (y ? ' ' + d.getUTCFullYear() : ''); };
  return `${f(days[0], days[0].slice(0, 4) !== days[6].slice(0, 4))} – ${f(days[6], true)}`;
}

export const dayRange = (day, now = Date.now()) => [new Date(day + 'T00:00:00' + OFFSET), new Date(Math.min(now, new Date(day + 'T23:59:59' + OFFSET).getTime()))];

// Un día de posiciones → { L, h, ms, loads, drains, hr[24] litros por hora, hh[24] ms de motor por hora, evs, pts }.
// Bajas ≥ 20 L con el tractor parado = descarga; subidas ≥ 20 L = carga; el resto de las bajas es consumo.
export function analyzeDay(rows) {
  const s = (rows || []).map((p) => {
    const a = p.attributes || {};
    return { t: new Date(p.fixTime).getTime(), kmh: (Number(p.speed) || 0) * 1.852, fuel: typeof a.fuel === 'number' ? a.fuel : null, ign: a.ignition === true };
  }).filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
  const hasIgn = s.some((x) => x.ign);
  const r = { L: 0, ms: 0, loads: [], drains: [], hr: Array(24).fill(0), hh: Array(24).fill(0), evs: [], pts: [] };
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], b = s[i], dt = Math.min(b.t - a.t, 15 * 60000);
    if (dt > 0 && (hasIgn ? a.ign : a.kmh > 0)) { r.ms += dt; r.hh[hourMzt(a.t)] += dt; }
    if (a.fuel == null || b.fuel == null) continue;
    if (a.fuel - b.fuel >= 20 && b.kmh < 1) { const L = Math.round(a.fuel - b.fuel); r.drains.push(L); r.evs.push({ t: b.t, k: 'drain', L }); }
    else if (b.fuel - a.fuel >= 20) { const L = Math.round(b.fuel - a.fuel); r.loads.push(L); r.evs.push({ t: b.t, k: 'load', L }); }
    else if (b.fuel < a.fuel) { r.L += a.fuel - b.fuel; r.hr[hourMzt(b.t)] += a.fuel - b.fuel; }
  }
  r.h = r.ms / 36e5;
  r.pts = s.filter((x, i) => x.fuel != null && i % 3 === 0).map((x) => [x.t, x.fuel]);
  return r;
}

export const totals = (days) => {
  const ok = days.filter(Boolean);
  return { L: sum(ok.map((d) => d.L)), h: sum(ok.map((d) => d.h)), loads: sum(ok.map((d) => sum(d.loads))), drains: sum(ok.map((d) => sum(d.drains))), nDrains: sum(ok.map((d) => d.drains.length)) };
};

export function readPrice(storage = globalThis.localStorage, fallback = 24) {
  let v = NaN;
  try { v = parseFloat(storage?.getItem(PRICE_KEY)); } catch { v = NaN; }
  return v > 0 ? v : fallback;
}
