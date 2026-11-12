// Clima (Open-Meteo, sin clave) para el centro de la flota: ahora, ventana de aplicación, 7 días y lluvia. Portado de home.js.
export const TZ = 'America/Mazatlan';
export const DEFAULT_LL = [22.73834, -105.9012]; // El Rosario, Sinaloa

export const WMO = {
  0: ['Despejado', '☀️'], 1: ['Mayormente despejado', '🌤️'], 2: ['Parcialmente nublado', '⛅'], 3: ['Nublado', '☁️'],
  45: ['Niebla', '🌫️'], 48: ['Niebla con escarcha', '🌫️'], 51: ['Llovizna ligera', '🌦️'], 53: ['Llovizna', '🌦️'], 55: ['Llovizna densa', '🌦️'],
  56: ['Llovizna helada', '🌦️'], 57: ['Llovizna helada', '🌦️'], 61: ['Lluvia ligera', '🌧️'], 63: ['Lluvia', '🌧️'], 65: ['Lluvia fuerte', '🌧️'],
  66: ['Lluvia helada', '🌧️'], 67: ['Lluvia helada', '🌧️'], 71: ['Nieve ligera', '❄️'], 73: ['Nieve', '❄️'], 75: ['Nieve fuerte', '❄️'], 77: ['Granizo fino', '❄️'],
  80: ['Chubascos ligeros', '🌦️'], 81: ['Chubascos', '🌧️'], 82: ['Chubascos fuertes', '🌧️'], 85: ['Chubascos de nieve', '❄️'], 86: ['Chubascos de nieve', '❄️'],
  95: ['Tormenta eléctrica', '⛈️'], 96: ['Tormenta con granizo', '⛈️'], 99: ['Tormenta con granizo', '⛈️'],
};
export function wmo(code, isDay = 1) {
  const w = WMO[code] || ['Sin datos', '·'];
  if (!isDay && (code === 0 || code === 1)) return [w[0], '🌙'];
  return w;
}
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export const windDir = (deg) => DIRS[Math.round(((Number(deg) || 0) % 360) / 45) % 8];

// Ventana para aplicar agroquímicos: viento, ráfagas, lluvia próxima (máx. de las próximas 6 h) y calor.
export function windowRisk(cur, rainMax) {
  const w = cur.wind_speed_10m, g = cur.wind_gusts_10m, t = cur.temperature_2m;
  if (w > 25 || g > 40 || rainMax >= 60 || t > 38 || cur.precipitation > 0.2) return ['crit', 'No recomendable', 'Viento, lluvia o calor fuera de rango.'];
  if (w > 15 || g > 28 || rainMax >= 30 || t > 35) return ['warn', 'Con precaución', 'Revisa viento y probabilidad de lluvia.'];
  return ['ok', 'Favorable', 'Condiciones adecuadas para aplicar.'];
}

export function centroid(positions) {
  const p = [...positions].filter((x) => Number.isFinite(x.latitude) && Number.isFinite(x.longitude));
  if (!p.length) return DEFAULT_LL;
  return [Math.round((p.reduce((s, x) => s + x.latitude, 0) / p.length) * 100) / 100, Math.round((p.reduce((s, x) => s + x.longitude, 0) / p.length) * 100) / 100];
}

export function weatherUrl([lat, lon]) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
    '&hourly=precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max' +
    `&past_days=7&forecast_days=8&timezone=${encodeURIComponent(TZ)}&wind_speed_unit=kmh`;
}

// Respuesta de Open-Meteo → lo que pinta Inicio. El índice 7 de daily es hoy (past_days=7).
export function summarizeWeather(d, now = Date.now()) {
  const T = 7, c = d.current, h = d.hourly, dy = d.daily;
  let i0 = h.time.findIndex((t) => new Date(t).getTime() >= now - 30 * 60000); if (i0 < 0) i0 = 0;
  const rainMax = Math.max(0, ...h.precipitation_probability.slice(i0, i0 + 6).map((v) => v || 0));
  const days = dy.time.slice(T, T + 7).map((t, k) => ({ t, code: dy.weather_code[T + k], min: dy.temperature_2m_min[T + k], max: dy.temperature_2m_max[T + k], prob: dy.precipitation_probability_max[T + k] || 0 }));
  const rain = dy.time.map((t, q) => ({ t, mm: dy.precipitation_sum[q] || 0, kind: q < T ? 'pasado' : q === T ? 'hoy' : 'pronostico' }));
  return {
    now: { temp: c.temperature_2m, feels: c.apparent_temperature, hum: c.relative_humidity_2m, wind: c.wind_speed_10m, gust: c.wind_gusts_10m, dir: windDir(c.wind_direction_10m), cond: wmo(c.weather_code, c.is_day) },
    risk: windowRisk(c, rainMax), days, rain,
    rainToday: rain[T]?.mm || 0, rainPast: rain.slice(0, T).reduce((s, x) => s + x.mm, 0), rainNext: rain.slice(T + 1).reduce((s, x) => s + x.mm, 0),
  };
}

// Earth (earth.nullschool.net): océano, viento y clima. Mismas capas y vistas que el panel actual.
export const EARTH_BASE = 'https://earth.nullschool.net/es/#current/';
export const EARTH_LAYERS = [
  ['wind', 'Viento', 'wind/surface/level'], ['temp', 'Temperatura', 'wind/surface/level/overlay=temp'], ['hum', 'Humedad', 'wind/surface/level/overlay=relative_humidity'],
  ['rain', 'Lluvia', 'wind/surface/level/overlay=precip_3hr'], ['cloud', 'Nubes', 'wind/surface/level/overlay=total_cloud_water'], ['tpw', 'Vapor de agua', 'wind/surface/level/overlay=total_precipitable_water'],
  ['cur', 'Corrientes', 'ocean/surface/currents'], ['sst', 'Temp. del mar', 'ocean/surface/currents/overlay=sea_surface_temp'], ['ssta', 'Anomalía del mar', 'ocean/surface/currents/overlay=sea_surface_temp_anomaly'],
  ['bleach', 'Blanqueamiento', 'ocean/surface/level/overlay=bleaching_alert_area'], ['wave', 'Oleaje', 'ocean/primary/waves/overlay=significant_wave_height'],
];
export const EARTH_VIEWS = [['rosario', 'El Rosario', -105.9012, 22.73834, 5000], ['pacifico', 'Pacífico mexicano', -106, 21, 2600], ['mexico', 'México', -102, 23, 1700], ['mundo', 'Mundo', -103.33, 20.58, 450]];
export function earthUrl({ layer = 'bleach', view = 'pacifico', proj = 'orthographic' } = {}) {
  const L = EARTH_LAYERS.find((x) => x[0] === layer) || EARTH_LAYERS[9], V = EARTH_VIEWS.find((x) => x[0] === view) || EARTH_VIEWS[1];
  return `${EARTH_BASE}${L[2]}/${proj}=${V[2]},${V[3]},${V[4]}/loc=-105.9012,22.73834`;
}
