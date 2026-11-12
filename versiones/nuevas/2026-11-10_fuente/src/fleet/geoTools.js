// Utilidades puras de las herramientas interactivas del mapa (portadas de panelpack/assets/maptools.js, con las mismas fórmulas):
// distancia, más cercano, dentro de un radio, tiempos estimados, búsqueda sin acentos y enlace para compartir la vista.
export const NOTES_KEY = 'pf-mapnotes-v1'; // la misma clave del panel actual: las notas ya guardadas se conservan
export const V_ETA = 15; // km/h supuestos para el tiempo estimado si el tractor está parado
export const TIPOS = { pozo: ['💧', 'Pozo / bomba'], bodega: ['🏠', 'Bodega'], taller: ['🔧', 'Taller'], diesel: ['⛽', 'Combustible'], riesgo: ['🚧', 'Obstáculo / riesgo'], otro: ['📍', 'Otro'] };
export const SHARE_LAYERS = { map: 'oscuro', sat: 'satelite', hyb: 'hibrido' }; // código del enlace -> capa de este panel
const toCode = Object.fromEntries(Object.entries(SHARE_LAYERS).map(([k, v]) => [v, k]));

// Haversine; a y b = [lat, lon]
export function distM(a, b) {
  const R = 6371000, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
// items = [{ id, lat, lon, … }] -> el más cercano a (lat, lon): { item, d } o null
export function nearest(items, lat, lon) {
  let best = null;
  items.forEach((it) => { const d = distM([lat, lon], [it.lat, it.lon]); if (!best || d < best.d) best = { item: it, d }; });
  return best;
}
// items dentro de rM metros, ordenados por distancia: [{ item, d }]
export function within(items, lat, lon, rM) {
  const out = [];
  items.forEach((it) => { const d = distM([lat, lon], [it.lat, it.lon]); if (d <= rM) out.push({ item: it, d }); });
  return out.sort((a, b) => a.d - b.d);
}
export const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`);
export const etaMin = (dM, kmh) => (kmh > 0 ? (dM / 1000 / kmh) * 60 : Infinity);
export function fmtEta(min) {
  if (!Number.isFinite(min)) return '—';
  if (min < 1) return '< 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  return `${Math.floor(min / 60)} h ${Math.round(min % 60)} min`;
}
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Todas las palabras de q deben aparecer en text (sin acentos ni mayúsculas).
export function matches(text, q) {
  const t = norm(text), toks = norm(q).split(/\s+/).filter(Boolean);
  return toks.length > 0 && toks.every((k) => t.includes(k));
}
// Enlace para compartir: "capa,lat,lon,zoom[,tID]". La capa va con el código del panel actual (map/sat/hyb).
export function encodeView(o) {
  const s = [toCode[o.layer] || o.layer, (+o.lat).toFixed(5), (+o.lon).toFixed(5), Math.round(o.zoom)];
  if (o.sel != null) s.push(`t${o.sel}`);
  return s.join(',');
}
export function decodeView(str) {
  const p = String(str || '').split(',');
  if (p.length < 4) return null;
  const code = p[0], lat = +p[1], lon = +p[2], zoom = +p[3];
  let sel = null;
  if (!SHARE_LAYERS[code] || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(zoom)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || zoom < 1 || zoom > 21) return null;
  if (p[4] != null && p[4] !== '') { const m = /^t(\d+)$/.exec(p[4]); if (!m) return null; sel = +m[1]; }
  return { layer: SHARE_LAYERS[code], lat, lon, zoom: Math.round(zoom), sel };
}
