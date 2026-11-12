// Operación de flota: estado de trabajo, combustible, velocidad y superficie.
// Portado de panelpack/assets/mapops.js (misma lógica y mismos casos de prueba).
// Unidades: Traccar entrega la velocidad en NUDOS; aquí todo es km/h, litros, ha y metros.

export const KMH = 1.852;

export const OPS_DEFAULTS = {
  // interruptores (como «Ajustes de mapa» del panel actual)
  estado: true, superficie: true, combustible: true, velocidad: true, horario: true, tarjeta: true,
  vmin: 1, // km/h: por debajo se considera parado
  ancho: 8, // m: ancho del implemento (superficie trabajada)
  fuelL: 10, // L: baja o sube mínima para alertar
  vLote: 12, // km/h: límite trabajando dentro de un lote
  vTrans: 30, // km/h: límite en tránsito (fuera de lotes)
  hIni: '06:00',
  hFin: '20:00',
};

export const WORK = {
  trabajo: { label: 'Trabajando', color: '#6fd48f' },
  transito: { label: 'En tránsito', color: '#7fb8d8' },
  ralenti: { label: 'Parado, motor encendido', color: '#f2b544' },
  apagado: { label: 'Apagado', color: '#919c89' },
  sinsenal: { label: 'Sin señal', color: '#ff6f61' },
};
export const WORK_ORDER = ['trabajo', 'transito', 'ralenti', 'apagado', 'sinsenal'];

export const kmh = (p) => (Number(p?.speed) || 0) * KMH;

// o = { nosignal, ignition, v (km/h), inLote }
export function classify(o, c = OPS_DEFAULTS) {
  if (o.nosignal) return 'sinsenal';
  if (!o.ignition) return 'apagado';
  if (o.v < c.vmin) return 'ralenti';
  return o.inLote ? 'trabajo' : 'transito';
}

const hm = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : null; };
// ¿Fuera del horario permitido? Admite horarios que cruzan la medianoche (22:00 → 06:00).
export function outOfSchedule(d, ini, fin) {
  const a = hm(ini), b = hm(fin), m = d.getHours() * 60 + d.getMinutes();
  if (a == null || b == null || a === b) return false;
  return a < b ? m < a || m >= b : m >= b && m < a;
}

// Combustible. st = { last, win: [[t, litros]…] } (se modifica). Devuelve null o { tipo: 'extraccion'|'caida'|'carga', litros }.
export function fuelStep(st, t, fuel, ign, umbral) {
  const WIN = 10 * 60000;
  let ev = null;
  st.win = (st.win || []).filter((x) => t - x[0] <= WIN);
  if (st.last != null) {
    if (ign) {
      if (st.last - fuel >= umbral) ev = { tipo: 'caida', litros: st.last - fuel };
      else if (fuel - st.last >= umbral) ev = { tipo: 'carga', litros: fuel - st.last };
    } else {
      let mx = -Infinity, mn = Infinity;
      st.win.forEach((x) => { if (x[1] > mx) mx = x[1]; if (x[1] < mn) mn = x[1]; });
      if (mx - fuel >= umbral) ev = { tipo: 'extraccion', litros: mx - fuel };
      else if (fuel - mn >= umbral) ev = { tipo: 'carga', litros: fuel - mn };
    }
  }
  if (ev) st.win = [];
  st.win.push([t, fuel]);
  st.last = fuel;
  return ev;
}

// Velocidad. ep = episodio abierto o null. Devuelve { ep, nuevo }. Termina al bajar del límite o tras 60 s sin lecturas.
export function speedStep(ep, t, v, lim, pt) {
  if (v > lim) {
    if (!ep || t - ep.last > 60000) return { ep: { t0: t, last: t, max: v, lim, pts: [pt] }, nuevo: true };
    ep.last = t; if (v > ep.max) ep.max = v; if (ep.pts.length < 40) ep.pts.push(pt);
    return { ep, nuevo: false };
  }
  return { ep: null, nuevo: false };
}

// Superficie trabajada: cuadrícula del ancho del implemento (sin contar dos veces el traslape).
export const cellKey = (lat, lon, w) => Math.floor((lat * 110540) / w) + ':' + Math.floor((lon * 111320 * Math.cos((lat * Math.PI) / 180)) / w);
export function distM(a, b) {
  const dy = (b[0] - a[0]) * 110540, dx = (b[1] - a[1]) * 111320 * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
}
export function markSegment(cells, a, b, w) {
  const n = Math.max(1, Math.ceil(distM(a, b) / (w / 2)));
  for (let i = 0; i <= n; i++) cells[cellKey(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, w)] = 1;
}
export const haFromCells = (n, w) => (n * w * w) / 1e4;

// Geocercas de Traccar en WKT con orden "lat lon". Devuelve { type, points | center+radius } o null.
export function parseWkt(area) {
  if (!area) return null;
  const pairs = (s) => s.split(',').map((t) => t.trim().split(/\s+/).map(Number)).filter((p) => p.length >= 2 && p.every(Number.isFinite)).map((p) => [p[0], p[1]]);
  let m = /^\s*POLYGON\s*\(\((.+)\)\)\s*$/i.exec(area);
  if (m) return { type: 'polygon', points: pairs(m[1]) };
  m = /^\s*CIRCLE\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*,\s*([\d.]+)\s*\)\s*$/i.exec(area);
  if (m) return { type: 'circle', center: [+m[1], +m[2]], radius: +m[3] };
  m = /^\s*LINESTRING\s*\((.+)\)\s*$/i.exec(area);
  if (m) return { type: 'line', points: pairs(m[1]) };
  return null;
}
export function polyHa(poly) {
  if (!poly || poly.length < 3) return 0;
  const l0 = ((poly.reduce((s, q) => s + q[0], 0) / poly.length) * Math.PI) / 180;
  const xy = poly.map((q) => [q[1] * 111320 * Math.cos(l0), q[0] * 110540]);
  let s = 0;
  xy.forEach((q, k) => { const r = xy[(k + 1) % xy.length]; s += q[0] * r[1] - r[0] * q[1]; });
  return Math.abs(s) / 2 / 1e4;
}

// Distancia de un recorrido [[lat, lon, ms]…] en km (haversine).
export function trailKm(t = []) {
  let km = 0;
  const r = Math.PI / 180;
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1], b = t[i];
    const h = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
    km += 12742 * Math.asin(Math.sqrt(h));
  }
  return km;
}

export function fmtDur(ms) {
  const m = Math.round((ms || 0) / 60000);
  if (m === 0 && ms > 0) return '<1 min'; // hay tiempo medido, pero aún no llega al minuto
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
