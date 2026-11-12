// Formatos geográficos para importar lotes (GeoJSON y KML) y exportar recorridos y lotes (GPX, KML y GeoJSON).
// Todo es puro (texto ↔ datos) salvo `descargar`. Los puntos siempre son [lat, lon], como en el resto del panel.
import { polyHa } from '../fleet/ops.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const num = (x, d = 6) => Number(x).toFixed(d);
const okLL = (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;

/** Anillo [[lon,lat]…] de GeoJSON → [[lat,lon]…] sin el punto de cierre repetido; null si no sirve (menos de 3 puntos o fuera de rango). */
function ringToLatLon(ring) {
  if (!Array.isArray(ring)) return null;
  const pts = ring.map((c) => (Array.isArray(c) ? [Number(c[1]), Number(c[0])] : null)).filter(Boolean);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  return pts.length >= 3 && pts.every(okLL) ? pts : null;
}

const nombreDe = (p, i) => String((p && (p.name || p.Name || p.nombre || p.title || p.NOMBRE)) || '').trim() || `Lote importado ${i}`;

/* ---------- importar ---------- */
/** GeoJSON (FeatureCollection, Feature, geometría o GeometryCollection) → { lotes: [{ name, points, ha }], saltados }. */
export function parseGeoJSON(text) {
  let j;
  try { j = JSON.parse(text); } catch { return { lotes: [], saltados: 0, error: 'El archivo no es un GeoJSON válido.' }; }
  const lotes = []; let saltados = 0;
  const geom = (g, props) => {
    if (!g || typeof g !== 'object') { saltados++; return; }
    if (g.type === 'Polygon') { const r = ringToLatLon(g.coordinates && g.coordinates[0]); if (r) lotes.push({ name: nombreDe(props, lotes.length + 1), points: r }); else saltados++; }
    else if (g.type === 'MultiPolygon') (g.coordinates || []).forEach((poly, k) => { const r = ringToLatLon(poly && poly[0]); if (r) lotes.push({ name: nombreDe(props, lotes.length + 1) + (k ? ` (${k + 1})` : ''), points: r }); else saltados++; });
    else if (g.type === 'GeometryCollection') (g.geometries || []).forEach((x) => geom(x, props));
    else saltados++; // puntos y líneas no son lotes
  };
  const feat = (f) => { if (f && f.type === 'Feature') geom(f.geometry, f.properties); else geom(f, null); };
  if (j && j.type === 'FeatureCollection') (j.features || []).forEach(feat); else feat(j);
  lotes.forEach((l) => { l.ha = polyHa(l.points); });
  return { lotes, saltados };
}

/** KML (Placemark con Polygon, también dentro de MultiGeometry) → { lotes, saltados }. */
export function parseKML(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return { lotes: [], saltados: 0, error: 'El archivo no es un KML válido.' };
  const por = (el, tag) => [...el.getElementsByTagNameNS('*', tag)];
  const lotes = []; let saltados = 0;
  por(doc, 'Placemark').forEach((pm) => {
    const nombre = (por(pm, 'name')[0]?.textContent || '').trim();
    const polys = por(pm, 'Polygon');
    if (!polys.length) { saltados++; return; }
    polys.forEach((poly, k) => {
      const coords = por(poly, 'outerBoundaryIs')[0] ? por(por(poly, 'outerBoundaryIs')[0], 'coordinates')[0] : por(poly, 'coordinates')[0];
      const ring = (coords?.textContent || '').trim().split(/\s+/).filter(Boolean).map((t) => t.split(',').map(Number)); // «lon,lat[,alt]»
      const pts = ringToLatLon(ring);
      if (pts) lotes.push({ name: nombreDe({ name: nombre }, lotes.length + 1) + (k ? ` (${k + 1})` : ''), points: pts }); else saltados++;
    });
  });
  lotes.forEach((l) => { l.ha = polyHa(l.points); });
  return { lotes, saltados };
}

/** Elige el lector por extensión o por el contenido. */
export function parseLotes(nombreArchivo, text) {
  const t = String(text || '').trim();
  if (!t) return { lotes: [], saltados: 0, error: 'El archivo está vacío.' };
  const ext = String(nombreArchivo || '').toLowerCase().split('.').pop();
  const r = ext === 'kml' || (ext !== 'geojson' && ext !== 'json' && t.startsWith('<')) ? parseKML(t) : parseGeoJSON(t);
  if (!r.error && !r.lotes.length) r.error = 'No encontré polígonos (lotes) en el archivo.';
  return r;
}

/** Área de Traccar: «POLYGON((lat lon, lat lon, …))», anillo cerrado y con el orden «lat lon». */
export function toWkt(points) {
  const p = points.length && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1] ? points : [...points, points[0]];
  return `POLYGON((${p.map((q) => `${num(q[0])} ${num(q[1])}`).join(', ')}))`;
}

/* ---------- exportar ---------- */
// tracks = [{ name, pts: [[lat, lon, t(ms), v(km/h)]…] }] · lotes = [{ name, points: [[lat, lon]…] }]
const ringLonLat = (points) => { const p = [...points, points[0]]; return p.map((q) => `${num(q[1])},${num(q[0])},0`).join(' '); };

export function toGPX(tracks, { nombre = 'Recorridos del panel de flota', ahora = new Date() } = {}) {
  const trk = tracks.filter((t) => t.pts.length).map((t) => `  <trk>
    <name>${esc(t.name)}</name>
    <trkseg>
${t.pts.map((p) => `      <trkpt lat="${num(p[0])}" lon="${num(p[1])}">${Number.isFinite(p[2]) ? `<time>${new Date(p[2]).toISOString()}</time>` : ''}${Number.isFinite(p[3]) ? `<extensions><speed>${num(p[3] / 3.6, 2)}</speed></extensions>` : ''}</trkpt>`).join('\n')}
    </trkseg>
  </trk>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Panel de flota · BuildWise Labs" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(nombre)}</name><time>${ahora.toISOString()}</time></metadata>
${trk}
</gpx>
`;
}

export function toKML({ tracks = [], lotes = [] }, { nombre = 'Panel de flota' } = {}) {
  const l = lotes.map((x) => `    <Placemark><name>${esc(x.name)}</name><styleUrl>#lote</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${ringLonLat(x.points)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`).join('\n');
  const t = tracks.filter((x) => x.pts.length > 1).map((x) => `    <Placemark><name>${esc(x.name)}</name><styleUrl>#ruta</styleUrl><LineString><tessellate>1</tessellate><coordinates>${x.pts.map((p) => `${num(p[1])},${num(p[0])},0`).join(' ')}</coordinates></LineString></Placemark>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${esc(nombre)}</name>
    <Style id="lote"><LineStyle><color>ff53d46f</color><width>2</width></LineStyle><PolyStyle><color>3353d46f</color></PolyStyle></Style>
    <Style id="ruta"><LineStyle><color>ff4285f4</color><width>3</width></LineStyle></Style>
${l}
${t}
  </Document>
</kml>
`;
}

export function toGeoJSON({ tracks = [], lotes = [] }) {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: [
      ...lotes.map((x) => ({ type: 'Feature', properties: { name: x.name, tipo: 'lote' }, geometry: { type: 'Polygon', coordinates: [[...x.points, x.points[0]].map((q) => [Number(num(q[1])), Number(num(q[0]))])] } })),
      ...tracks.filter((x) => x.pts.length > 1).map((x) => ({ type: 'Feature', properties: { name: x.name, tipo: 'recorrido' }, geometry: { type: 'LineString', coordinates: x.pts.map((p) => [Number(num(p[1])), Number(num(p[0]))]) } })),
    ],
  }, null, 2);
}

/** Descarga un texto como archivo (navegador). */
export function descargar(nombre, mime, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: `${mime};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
