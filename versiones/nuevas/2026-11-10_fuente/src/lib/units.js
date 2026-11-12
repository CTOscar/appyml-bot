// Unidades del mapa (métrico o imperial), igual que el panel actual (features/map/tools.js).
export function fmtDist(m, units) {
  if (units === 'imperial') { const mi = m / 1609.344; return mi < 0.19 ? `${Math.round(m * 3.28084)} ft` : `${mi.toFixed(2)} mi`; }
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}
export const fmtArea = (m2, units) => (units === 'imperial' ? `${(m2 / 4046.8564).toFixed(2)} ac` : `${(m2 / 10000).toFixed(2)} ha`);
// Área aproximada (plano local equirectangular) de [{lat, lng}…] en m²: suficiente para lotes.
export function areaOf(pts) {
  if (pts.length < 3) return 0;
  const lat0 = (pts.reduce((a, p) => a + p.lat, 0) / pts.length) * (Math.PI / 180);
  const xy = pts.map((p) => [p.lng * 111320 * Math.cos(lat0), p.lat * 110540]);
  let s = 0; xy.forEach((q, k) => { const r = xy[(k + 1) % xy.length]; s += q[0] * r[1] - r[0] * q[1]; });
  return Math.abs(s) / 2;
}
// «Operación de hoy» abre desplegada solo en pantallas anchas (en las chicas tapa el mapa); la elección se recuerda.
export const MAP_DEFAULTS = { layer: 'oscuro', fences: true, labels: false, units: 'metric', ops: typeof window === 'undefined' || window.innerWidth >= 1600 };
