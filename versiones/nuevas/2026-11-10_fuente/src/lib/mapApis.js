// Servicios de mapas SIN clave de API para el mapa en vivo: ruta por camino (OSRM), lugar (Nominatim/OpenStreetMap),
// elevación y clima por lote (Open-Meteo) y enlaces de Google Maps (Maps URLs, no necesitan clave ni facturación).
//
// Las funciones `*Url` y `parse*` son puras (se prueban sin red). Las `fetch*` envuelven la red con tiempo límite.
//
// Antes de producción revisa los términos de cada servicio (ver docs/backend/MAPA-SERVICIOS-EXTERNOS.md):
//  · router.project-osrm.org es un servidor de demostración (uso moderado, no garantiza disponibilidad).
//  · Nominatim pide máx. 1 consulta por segundo y no admite uso masivo: aquí solo se consulta a petición y con caché.
//  · La API gratuita de Open-Meteo es para uso no comercial; un uso comercial requiere su plan de pago.
import { TZ, windDir, windowRisk } from './weather.js';

/* ---------- enlaces de Google Maps (https://developers.google.com/maps/documentation/urls) ---------- */
const ll = (p) => `${Number(p[0]).toFixed(6)},${Number(p[1]).toFixed(6)}`;
/** Indicaciones hasta `dest`. Sin `origin`, Google usa «Tu ubicación». */
export const googleDirectionsUrl = ({ dest, origin }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${ll(dest)}&travelmode=driving${origin ? `&origin=${ll(origin)}` : ''}`;
export const googleMapsUrl = (p) => `https://www.google.com/maps/search/?api=1&query=${ll(p)}`;
export const streetViewUrl = (p) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll(p)}`;

/* ---------- ruta por camino (OSRM) ---------- */
export const osrmUrl = (a, b) => `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
/**
 * Respuesta de OSRM → { distM, durS, coords: [[lat, lon]…], snapM: [salida, llegada] } o null si no hay ruta.
 * `snapM` = metros entre cada punto pedido y el camino al que OSRM lo «pegó»: si es grande, el punto no está sobre un camino.
 */
export function parseOsrm(j) {
  const r = j && j.code === 'Ok' && Array.isArray(j.routes) ? j.routes[0] : null;
  if (!r || !r.geometry || !Array.isArray(r.geometry.coordinates)) return null;
  const snapM = [0, 1].map((i) => (j.waypoints && j.waypoints[i] && Number.isFinite(j.waypoints[i].distance) ? j.waypoints[i].distance : 0));
  return { distM: r.distance, durS: r.duration, coords: r.geometry.coordinates.map((c) => [c[1], c[0]]), snapM };
}

/* ---------- elevación (Open-Meteo) ---------- */
export const elevationUrl = (pts) => `https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => Number(p[0]).toFixed(5)).join(',')}&longitude=${pts.map((p) => Number(p[1]).toFixed(5)).join(',')}`;
/** → arreglo de metros (uno por punto); vacío si la respuesta no es válida. */
export const parseElevation = (j) => (j && Array.isArray(j.elevation) ? j.elevation.filter((x) => Number.isFinite(x)) : []);

/* ---------- lugar (Nominatim) ---------- */
export const reverseUrl = (p) => `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${Number(p[0]).toFixed(5)}&lon=${Number(p[1]).toFixed(5)}&zoom=14&addressdetails=1&accept-language=es`;
/** → { titulo, detalle } con la localidad más cercana y el municipio/estado, o null si no hay nada. */
export function parsePlace(j) {
  if (!j || j.error) return null;
  const a = j.address || {};
  const titulo = a.hamlet || a.village || a.town || a.suburb || a.city || a.neighbourhood || a.locality || j.name || '';
  const detalle = [a.municipality || a.county || a.city_district, a.state, a.country].filter((x) => x && x !== titulo).join(', ');
  if (!titulo && !detalle) return j.display_name ? { titulo: String(j.display_name).split(',')[0].trim(), detalle: String(j.display_name).split(',').slice(1, 4).join(',').trim() } : null;
  return { titulo, detalle };
}

/* ---------- clima por lote (Open-Meteo) ---------- */
export const weatherLotesUrl = (pts) => 'https://api.open-meteo.com/v1/forecast'
  + `?latitude=${pts.map((p) => Number(p[0]).toFixed(4)).join(',')}&longitude=${pts.map((p) => Number(p[1]).toFixed(4)).join(',')}`
  + '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
  + `&hourly=precipitation_probability&forecast_days=2&timezone=${encodeURIComponent(TZ)}&wind_speed_unit=kmh`;

/**
 * Respuesta de Open-Meteo (objeto con un punto, o arreglo con varios) → una fila por punto:
 * { temp, hum, wind, gust, deg, dir, rain, rainMax, code, risk: [tono, título, detalle] }.
 * `rainMax` = mayor probabilidad de lluvia (%) de las próximas 6 h; `risk` usa el mismo criterio de Inicio (windowRisk).
 */
export function parseWeatherLotes(j, now = Date.now()) {
  const list = Array.isArray(j) ? j : j ? [j] : [];
  return list.map((d) => {
    const c = d && d.current; if (!c) return null;
    const t = (d.hourly && d.hourly.time) || [], p = (d.hourly && d.hourly.precipitation_probability) || [];
    let i0 = t.findIndex((x) => new Date(x).getTime() >= now - 30 * 60000); if (i0 < 0) i0 = 0;
    const rainMax = Math.max(0, ...p.slice(i0, i0 + 6).map((v) => v || 0));
    return { temp: c.temperature_2m, hum: c.relative_humidity_2m, wind: c.wind_speed_10m, gust: c.wind_gusts_10m, deg: c.wind_direction_10m, dir: windDir(c.wind_direction_10m), rain: c.precipitation, rainMax, code: c.weather_code, risk: windowRisk(c, rainMax) };
  });
}

/* ---------- red ---------- */
export async function getJson(url, { signal, timeoutMs = 9000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
    return await r.json();
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
}

export async function fetchRoute(a, b, opts) {
  const r = parseOsrm(await getJson(osrmUrl(a, b), opts));
  if (!r) throw new Error('Sin ruta por camino entre esos puntos.');
  return r;
}

const cacheElev = new Map();
export async function fetchElevation(p, opts) {
  const k = `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  if (cacheElev.has(k)) return cacheElev.get(k);
  const [m] = parseElevation(await getJson(elevationUrl([p]), opts));
  if (m === undefined) throw new Error('Sin datos de elevación.');
  cacheElev.set(k, m);
  return m;
}

// Nominatim: máx. 1 consulta por segundo. Las consultas se encolan y los resultados se guardan por celda de ~100 m.
const cachePlace = new Map();
let colaPlace = Promise.resolve(), ultimaPlace = 0;
export const MIN_NOMINATIM_MS = 1100;
export function fetchPlace(p, opts) {
  const k = `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  if (cachePlace.has(k)) return Promise.resolve(cachePlace.get(k));
  const job = colaPlace.then(async () => {
    if (cachePlace.has(k)) return cachePlace.get(k);
    const espera = ultimaPlace + MIN_NOMINATIM_MS - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimaPlace = Date.now();
    const lugar = parsePlace(await getJson(reverseUrl(p), opts));
    cachePlace.set(k, lugar);
    return lugar;
  });
  colaPlace = job.catch(() => {}); // un fallo no frena la cola
  return job;
}

export async function fetchWeatherLotes(pts, opts) {
  if (!pts.length) return [];
  return parseWeatherLotes(await getJson(weatherLotesUrl(pts), { timeoutMs: 12000, ...opts }));
}

/** Texto corto «3.4 km · 7 min» para una ruta. */
export function resumenRuta({ distM, durS }) {
  const km = distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(distM < 10000 ? 1 : 0)} km`;
  const m = Math.max(1, Math.round(durS / 60));
  return `${km} · ${m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`}`;
}

/** Metros a partir de los cuales se avisa que el punto no está sobre un camino. */
export const SNAP_AVISO_M = 500;
