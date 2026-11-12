// Informes · Combustible y velocidad (portado del panel anterior: funciones rm/dm del bundle).
// Lógica pura: análisis de una serie de posiciones, agregación por periodo, series para gráficas y CSV.
import { OFFSET, dayKey } from './diesel.js';

const DAY = 864e5;
const TZ = 'America/Mazatlan';
const sum = (a) => a.reduce((s, x) => s + x, 0);

// Posiciones de Traccar → puntos { t, kmh, lat, lon, fuel, ign } (la velocidad llega en nudos).
export function toSeries(rows) {
  return (rows || []).map((p) => ({
    t: new Date(p.fixTime).getTime(), kmh: (Number(p.speed) || 0) * 1.852, lat: p.latitude, lon: p.longitude,
    fuel: typeof p.attributes?.fuel === 'number' ? p.attributes.fuel : null, ign: !!p.attributes?.ignition,
  })).filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
}

// Descarga: baja ≥ 20 L con el tractor detenido. Carga: sube ≥ 20 L. Resto de las bajas = consumo.
export function analyzeSeries(series) {
  const s = series.filter((p) => Number.isFinite(p.t));
  const events = [];
  let consumed = 0;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1].fuel, b = s[i].fuel;
    if (typeof a !== 'number' || typeof b !== 'number') continue;
    const e = { t: s[i].t, lat: s[i].lat, lon: s[i].lon };
    if (a - b >= 20 && s[i].kmh < 1) events.push({ ...e, type: 'drain', liters: Math.round(a - b) });
    else if (b - a >= 20) events.push({ ...e, type: 'refuel', liters: Math.round(b - a) });
    else if (b < a) consumed += a - b;
  }
  const mov = s.filter((p) => p.kmh > 0);
  return {
    events, consumed: Math.round(consumed),
    avgKmh: mov.length ? Math.round(sum(mov.map((p) => p.kmh)) / mov.length) : 0,
    maxKmh: Math.round(s.reduce((m, p) => Math.max(m, p.kmh), 0)),
    movingH: Math.round((mov.length * 5) / 6) / 10, // un punto cada 5 min
  };
}

export const litersOf = (a, type) => sum(a.events.filter((e) => e.type === type).map((e) => e.liters));

// items = [{ d, r: { series, a } }] → totales de la flota.
export function fleetTotals(items) {
  return items.reduce((t, { r }) => ({ cons: t.cons + r.a.consumed, dl: t.dl + litersOf(r.a, 'drain'), rl: t.rl + litersOf(r.a, 'refuel'), h: t.h + r.a.movingH }), { cons: 0, dl: 0, rl: 0, h: 0 });
}

// Eventos de todos los tractores (o de los ids dados), en orden de fecha, con su tractor.
export function allEvents(items, onlyId = null) {
  return items.filter(({ d }) => onlyId == null || d.id === onlyId).flatMap(({ d, r }) => r.a.events.map((e) => ({ ...e, d }))).sort((a, b) => a.t - b.t);
}

// Consumo, cargas y descargas por lote → [[nombre, { cons, dl, rl, n }]].
export function byLot(items, lotOf) {
  const m = new Map();
  items.forEach(({ d, r }) => {
    const k = lotOf(d) || 'Fuera de lote', c = m.get(k) || { cons: 0, dl: 0, rl: 0, n: 0 };
    m.set(k, { cons: c.cons + r.a.consumed, dl: c.dl + litersOf(r.a, 'drain'), rl: c.rl + litersOf(r.a, 'refuel'), n: c.n + 1 });
  });
  return [...m.entries()];
}

// Consumo acumulado de la flota por hora → [{ t, y }].
export function cumulative(items) {
  const h = new Map();
  items.forEach(({ r }) => {
    const s = r.series;
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1].fuel, b = s[i].fuel;
      if (typeof a === 'number' && typeof b === 'number' && b < a && a - b < 20) { const k = Math.floor(s[i].t / 36e5) * 36e5; h.set(k, (h.get(k) || 0) + (a - b)); }
    }
  });
  let acc = 0;
  return [...h.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, y: Math.round((acc += v)) }));
}

// Periodo [desde, hasta] (AAAA-MM-DD, hora de Mazatlán) → fechas para getRoute; el final no pasa de «ahora».
export function periodRange(from, to, now = Date.now()) {
  const f = new Date(`${from}T00:00:00${OFFSET}`), t = new Date(`${to}T23:59:59${OFFSET}`);
  return [f, t.getTime() > now ? new Date(now) : t];
}

// Atajos: hoy (0,0), ayer (-1,-1), 7 días (-6,0).
export const shiftDay = (n, now = Date.now()) => dayKey(now + n * DAY);
export const QUICK = [['hoy', 0, 0], ['ayer', -1, -1], ['7 días', -6, 0]];

export const fmtDateTime = (ms) => new Date(ms).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: TZ });
export const fmtClock = (ms) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });

// CSV de cargas y descargas (BOM UTF-8 para Excel, saltos CRLF).
export const CSV_HEADER = 'Tractor,IMEI,Fecha y hora,Evento,Litros,Costo estimado MXN,Latitud,Longitud';
export function eventsCsv(events, price) {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = events.map((e) => [q(e.d.name), q(e.d.uniqueId || ''), q(fmtDateTime(e.t)), e.type === 'drain' ? 'Descarga' : 'Carga', e.liters, Math.round(e.liters * price), e.lat ?? '', e.lon ?? ''].join(','));
  return '﻿' + [CSV_HEADER, ...rows].join('\r\n');
}
export const csvName = (from, to) => `cargas-descargas_${from}_${to}.csv`;
