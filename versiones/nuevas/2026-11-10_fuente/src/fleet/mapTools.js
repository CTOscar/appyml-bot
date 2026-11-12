// Herramientas del mapa: port de panelpack/assets/mapx.js (misma lógica y mismos cálculos), sin DOM propio.
// Recibe el mapa de Leaflet y una función que da el estado en vivo { devices, positions, geofences, selected }.
// La interfaz (panel y barra de reproducción) la dibuja React leyendo getState() y subscribe().
import L from 'leaflet';
import { fetchWeatherLotes } from '../lib/mapApis.js';

const rad = Math.PI / 180;
const HMAX = 1300;
export const FEATS = [
  ['trail', 'Rastro por velocidad', 'Colorea el recorrido según qué tan rápido iba el tractor.'],
  ['heat', 'Mapa de calor', 'Zonas donde la flota ha pasado más veces.'],
  ['labels', 'Etiquetas flotantes', 'Nombre, marca, horas y combustible junto a cada tractor.'],
  ['alerts', 'Alertas de lote', 'Marca en rojo el lote y el tractor que salió de su zona.'],
  ['rain', 'Radar de lluvia y clima', 'Lluvia reciente sobre el mapa y clima del centro.'],
  ['stops', 'Paradas', 'Dónde estuvo detenido y por cuánto tiempo.'],
  ['cover', 'Cobertura del implemento', 'Franja trabajada y porcentaje de cada lote.'],
  ['wxlotes', 'Clima por lote', 'Temperatura, viento y si conviene aplicar, sobre cada lote (Open-Meteo).'],
  ['ndvi', 'Vegetación (NDVI)', 'Vigor de la vegetación desde satélite (NASA).'],
  ['cluster', 'Agrupar tractores', 'Junta los marcadores cercanos al alejar el zoom.'],
  ['follow', 'Seguir tractor seleccionado', 'La cámara acompaña al tractor elegido.'],
];

/* ---------- utilidades geográficas (puras, se prueban aparte) ---------- */
export function wkt(area) {
  const m = /\(\((.*)\)\)/.exec(area || ''); if (!m) return null;
  return m[1].split(',').map((p) => { const q = p.trim().split(/\s+/); return [+q[0], +q[1]]; });
}
export function inPoly(p, poly) {
  const x = p[1], y = p[0]; let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][1], yi = poly[i][0], xj = poly[j][1], yj = poly[j][0];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function mDist(a, b) {
  const dy = (b[0] - a[0]) * 111320, dx = (b[1] - a[1]) * 111320 * Math.cos(((a[0] + b[0]) / 2) * rad);
  return Math.sqrt(dx * dx + dy * dy);
}
export function distToPoly(p, poly) {
  let best = 1e9; const kx = 111320 * Math.cos(p[0] * rad), ky = 111320;
  for (let i = 0; i < poly.length - 1; i++) {
    const ax = (poly[i][1] - p[1]) * kx, ay = (poly[i][0] - p[0]) * ky, bx = (poly[i + 1][1] - p[1]) * kx, by = (poly[i + 1][0] - p[0]) * ky;
    const dx = bx - ax, dy = by - ay, t = dx * dx + dy * dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    const px = ax + t * dx, py = ay + t * dy, d = Math.sqrt(px * px + py * py); if (d < best) best = d;
  }
  return best;
}
export const fmtT = (ms) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export function fmtDurS(s) { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; }
// Paradas de una serie [[lat, lon, t, v]…]: tramos con v < 0.5 km/h de al menos minMin minutos.
export function findStops(a, minMin) {
  const out = []; let i = 0;
  while (i < a.length) {
    if (a[i][3] >= 0.5) { i++; continue; }
    let j = i; while (j + 1 < a.length && a[j + 1][3] < 0.5 && a[j + 1][2] - a[j][2] < 120000) j++;
    const dur = (a[j][2] - a[i][2]) / 1000 + 10;
    if (dur >= minMin * 60) out.push({ i, j, dur });
    i = j + 1;
  }
  return out;
}

export function createMapTools(map, getW) {
  const CFG = { scope: 'sel', vmax: 8, heatR: 16, marca: '', stopMin: 2, width: 8, ndviOp: 65, clusterZoom: 13 };
  const ON = {};
  const info = {};
  const hist = {}; // id -> [[lat, lon, t(ms), v(km/h)]]
  let fences = [];
  const assigned = {};
  const lay = {};
  let sim = {};
  let wx = '';
  const PB = { id: null, i: 0, timer: 0, speed: 16, open: false, name: '', time: '', max: 1, playing: false };
  const subs = new Set();
  let ver = 0, snapCache = null;
  const emit = () => { ver++; snapCache = null; subs.forEach((f) => f()); };
  const setInfo = (k, v) => { info[k] = v; emit(); };
  const W = () => getW();
  const devName = (id) => W().devices.get(id)?.name || `ID ${id}`;
  const selIds = () => (CFG.scope === 'all' ? [...W().devices.keys()] : W().selected != null ? [W().selected] : []);

  [['mapxBase', 250], ['mapx', 450], ['mapxTop', 620]].forEach(([n, z]) => { if (!map.getPane(n)) { const p = map.createPane(n); p.style.zIndex = z; if (n !== 'mapxTop') p.style.pointerEvents = 'none'; } });
  const CanvasLayer = L.Layer.extend({
    initialize(draw) { this._draw = draw; },
    onAdd(m) { this._m = m; const c = (this._c = L.DomUtil.create('canvas', 'mx-canvas')); c.style.position = 'absolute'; c.style.pointerEvents = 'none'; m.getPane('mapx').appendChild(c); m.on('moveend zoomend resize', this.redraw, this); m.on('zoomstart', this._hide, this); this.redraw(); },
    onRemove(m) { L.DomUtil.remove(this._c); m.off('moveend zoomend resize', this.redraw, this); m.off('zoomstart', this._hide, this); },
    _hide() { this._c.style.visibility = 'hidden'; },
    redraw() { if (!this._m) return; const s = this._m.getSize(), c = this._c; c.width = s.x; c.height = s.y; c.style.visibility = 'visible'; L.DomUtil.setPosition(c, this._m.containerPointToLayerPoint([0, 0])); this._draw(c.getContext('2d'), s, this._m); },
  });
  const add = (name, layer) => { remove(name); lay[name] = layer; layer.addTo(map); return layer; };
  function remove(name) { if (lay[name]) { map.removeLayer(lay[name]); delete lay[name]; } }
  const visPts = (m, s) => (p) => { const q = m.latLngToContainerPoint([p[0], p[1]]); return q.x > -40 && q.y > -40 && q.x < s.x + 40 && q.y < s.y + 40; };
  function buildFences() {
    const gs = W().geofences;
    if (fences.length === gs.length && fences.length) return;
    fences = gs.map((f) => { const poly = wkt(f.area); if (!poly) return null; const la = poly.map((q) => q[0]), lo = poly.map((q) => q[1]); return { id: f.id, name: f.name, poly, b: [Math.min(...la), Math.max(...la), Math.min(...lo), Math.max(...lo)] }; }).filter(Boolean);
  }

  /* ---------- historial ---------- */
  function record() {
    const now = Date.now();
    W().positions.forEach((p, id) => {
      const a = hist[id] || (hist[id] = []), last = a[a.length - 1];
      const moved = last ? mDist([last[0], last[1]], [p.latitude, p.longitude]) : 1e9;
      if (!last || moved > 4 || now - last[2] > 10000) { a.push([p.latitude, p.longitude, now, Math.round((p.speed || 0) * 10) / 10]); if (a.length > HMAX) a.splice(0, a.length - HMAX); }
    });
  }
  const histCount = () => Object.values(hist).reduce((n, a) => n + a.length, 0);
  function seedDemo(hours) {
    buildFences(); const now = Date.now(), dt = 10, steps = Math.round((hours * 3600) / dt); let made = 0;
    W().positions.forEach((p, id) => {
      if (!(p.speed > 0.5)) return;
      const f = fences.find((q) => inPoly([p.latitude, p.longitude], q.poly)); if (!f) return;
      const gap = 12 / 111320, mLon = 1 / (111320 * Math.cos(p.latitude * rad));
      const k0 = Math.round((p.latitude - f.b[0]) / gap), dir = p.course != null ? (Math.sin(p.course * rad) >= 0 ? 1 : -1) : (k0 % 2 === 0 ? 1 : -1);
      let lat = p.latitude, lon = p.longitude, fdir = dir, stopLeft = 0, turn = 0, vs = 4 + Math.random() * 2; const pts = [];
      for (let i = 0; i < steps; i++) {
        let v;
        if (stopLeft > 0) { v = 0; stopLeft--; }
        else if (turn > 0) { v = 1.5; turn--; lat -= gap / 4; }
        else {
          vs = Math.max(2.5, Math.min(7.2, vs + (Math.random() - 0.5) * 0.9)); v = vs; if (Math.random() < 0.004) stopLeft = 6 + Math.floor(Math.random() * 40);
          lon -= (fdir * v) / 3.6 * dt * mLon;
          if (lon < f.b[2] + 0.0003 || lon > f.b[3] - 0.0003) { lon = Math.max(f.b[2] + 0.0003, Math.min(f.b[3] - 0.0003, lon)); fdir = -fdir; turn = 4; }
        }
        pts.push([lat, lon, now - (i + 1) * dt * 1000, Math.round(v * 10) / 10]);
      }
      pts.reverse();
      hist[id] = pts.concat((hist[id] || []).filter((q) => q[2] > now - 5000)).slice(-HMAX); made++;
    });
    return made;
  }

  /* ---------- 1. Rastro por velocidad ---------- */
  function drawTrail() {
    remove('trail'); if (!ON.trail) return;
    const ids = selIds(), buckets = [[], [], [], []], cols = ['#919c89', '#6fd48f', '#f2b544', '#ff6f61'];
    ids.forEach((id) => {
      const a = (hist[id] || []).slice(CFG.scope === 'all' ? -150 : -HMAX);
      for (let i = 1; i < a.length; i++) {
        if (a[i][2] - a[i - 1][2] > 120000 || mDist(a[i - 1], a[i]) > 300) continue;
        const r = a[i][3] / CFG.vmax, b = r < 0.05 ? 0 : r < 0.5 ? 1 : r < 0.8 ? 2 : 3; buckets[b].push([[a[i - 1][0], a[i - 1][1]], [a[i][0], a[i][1]]]);
      }
    });
    const g = L.layerGroup(), rend = L.canvas({ pane: 'mapx' });
    buckets.forEach((segs, i) => { if (segs.length) L.polyline(segs, { color: cols[i], weight: 4, opacity: 0.95, interactive: false, pane: 'mapx', renderer: rend, lineCap: 'round' }).addTo(g); });
    add('trail', g); setInfo('trail', ids.length ? 'Verde: normal · Ámbar: rápido · Rojo: muy rápido · Gris: parado' : 'Selecciona un tractor o elige «Todos».');
  }

  /* ---------- 2. Mapa de calor ---------- */
  const PAL = (() => {
    const c = document.createElement('canvas'); c.width = 1; c.height = 256; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(0,0,255,0)'); gr.addColorStop(0.2, 'rgba(0,120,255,.75)'); gr.addColorStop(0.45, 'rgba(0,230,120,.85)'); gr.addColorStop(0.7, 'rgba(255,230,0,.9)'); gr.addColorStop(1, 'rgba(255,40,0,1)');
    x.fillStyle = gr; x.fillRect(0, 0, 1, 256); return x.getImageData(0, 0, 1, 256).data;
  })();
  function drawHeat() {
    remove('heat'); if (!ON.heat) return;
    add('heat', new CanvasLayer((ctx, s, m) => {
      const r = CFG.heatR, sp = document.createElement('canvas'); sp.width = sp.height = r * 2; const sx = sp.getContext('2d'), gr = sx.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, r * 2, r * 2);
      const off = document.createElement('canvas'); off.width = s.x; off.height = s.y; const ox = off.getContext('2d'); ox.globalAlpha = 0.07; const vis = visPts(m, s); let n = 0;
      Object.values(hist).forEach((a) => a.forEach((p) => { if (!vis(p)) return; const q = m.latLngToContainerPoint([p[0], p[1]]); ox.drawImage(sp, q.x - r, q.y - r); n++; }));
      const img = ox.getImageData(0, 0, s.x, s.y), d = img.data; let mx = 1; for (let q = 3; q < d.length; q += 4) if (d[q] > mx) mx = d[q];
      for (let i = 3; i < d.length; i += 4) { const a = d[i]; if (a) { const o = Math.min(255, Math.round((a / mx) * 255)) * 4; d[i - 3] = PAL[o]; d[i - 2] = PAL[o + 1]; d[i - 1] = PAL[o + 2]; d[i] = PAL[o + 3] * 0.85; } }
      ctx.putImageData(img, 0, 0); info.heat = `${n} puntos en pantalla · más rojo = más pasadas`;
    }));
    emit();
  }

  /* ---------- 3. Etiquetas flotantes ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function labelHtml(id, p) {
    const d = W().devices.get(id) || {}, at = p.attributes || {}, h = at.hours ? `${Math.round(at.hours / 3600e3)} h` : '', f = typeof at.fuel === 'number' ? ` · ⛽ ${at.fuel} L` : '';
    return `<b>${esc(d.name || id)}</b><span>${esc((d.attributes?.marca || '').replace('-', ' '))}${h ? ' · ' + h : ''}${f}</span>`;
  }
  function drawLabels() {
    if (!ON.labels) { remove('labels'); return; }
    if (!lay.labels) { lay.labels = L.layerGroup().addTo(map); lay.labelMk = {}; }
    const show = map.getZoom() >= 14, seen = {};
    W().positions.forEach((p, id) => {
      const d = W().devices.get(id) || {}; if (CFG.marca && d.attributes?.marca !== CFG.marca) return;
      if (!show || !map.getBounds().contains([p.latitude, p.longitude])) return; seen[id] = 1;
      const html = labelHtml(id, p); let mk = lay.labelMk[id];
      if (!mk) mk = lay.labelMk[id] = L.marker([p.latitude, p.longitude], { pane: 'mapxTop', interactive: false, icon: L.divIcon({ className: 'mx-label', html, iconSize: null, iconAnchor: [-18, 40] }) }).addTo(lay.labels);
      else { mk.setLatLng([p.latitude, p.longitude]); if (mk._html !== html) mk.setIcon(L.divIcon({ className: 'mx-label', html, iconSize: null, iconAnchor: [-18, 40] })); }
      mk._html = html;
    });
    Object.keys(lay.labelMk).forEach((id) => { if (!seen[id]) { lay.labels.removeLayer(lay.labelMk[id]); delete lay.labelMk[id]; } });
    setInfo('labels', show ? `${Object.keys(seen).length} etiquetas visibles` : 'Acerca el mapa (zoom 14 o más) para ver las etiquetas.');
  }

  /* ---------- 4. Alertas de lote ---------- */
  function outsideList() {
    buildFences(); const out = [];
    W().positions.forEach((p, id) => {
      const pt = sim[id] || [p.latitude, p.longitude];
      if (!assigned[id]) { const f = fences.find((q) => inPoly(pt, q.poly)); if (f) assigned[id] = f.id; return; }
      const f2 = fences.find((q) => q.id === assigned[id]); if (!f2) return;
      if (!inPoly(pt, f2.poly) && distToPoly(pt, f2.poly) > 15) out.push({ id, d: Math.round(distToPoly(pt, f2.poly)), fence: f2, pt });
    });
    return out;
  }
  function drawFences() {
    const need = ON.alerts || ON.cover; remove('fences'); if (!need) return;
    buildFences(); const out = ON.alerts ? outsideList() : [], bad = {}; out.forEach((o) => { bad[o.fence.id] = 1; });
    const g = L.layerGroup();
    fences.forEach((f) => {
      const c = ON.cover && f.cov != null ? f.cov : null, red = bad[f.id];
      const poly = L.polygon(f.poly, { pane: 'mapx', interactive: false, color: red ? '#ff6f61' : '#6fd48f', weight: red ? 3 : 1.5, dashArray: red ? '6 5' : null, fillColor: red ? '#ff6f61' : '#6fd48f', fillOpacity: red ? 0.22 : 0.06 });
      if (c != null) poly.bindTooltip(`${(f.name.split('·')[1] || f.name).trim()} · ${c} %`, { permanent: true, direction: 'center', className: 'mx-tip' });
      poly.addTo(g);
    });
    out.forEach((o) => {
      L.marker(o.pt, { pane: 'mapxTop', interactive: false, icon: L.divIcon({ className: 'mx-pulse', html: '<i></i>', iconSize: [44, 44], iconAnchor: [22, 22] }) }).addTo(g);
      if (sim[o.id]) L.marker(o.pt, { pane: 'mapxTop', interactive: false, icon: L.divIcon({ className: 'mx-stop', html: `⚠ ${esc(devName(o.id))} fuera de lote (simulado)`, iconSize: null, iconAnchor: [-14, 34] }) }).addTo(g);
    });
    add('fences', g);
    if (ON.alerts) info.alerts = { out: out.map((o) => ({ id: o.id, name: devName(o.id), d: o.d, fence: o.fence.name })), sim: Object.keys(sim).length > 0 };
    emit();
  }
  function simulateExit() {
    buildFences(); let ids = [...W().positions.keys()].filter((id) => W().positions.get(id).speed > 0.5 && assigned[id]);
    if (!ids.length) { outsideList(); ids = [...W().positions.keys()].filter((id) => assigned[id]); }
    const id = ids[Math.floor(Math.random() * ids.length)], p = W().positions.get(id); if (!p) return;
    ON.alerts = true; sim[id] = [p.latitude + 0.0042, p.longitude + 0.0021]; drawFences(); map.flyTo(sim[id], Math.max(map.getZoom(), 15), { duration: 0.8 });
  }
  function clearSim() { sim = {}; drawFences(); }

  /* ---------- 5. Radar de lluvia + clima ---------- */
  function toggleRain() {
    remove('rain'); if (!ON.rain) { wx = ''; emit(); return; }
    fetch('https://api.rainviewer.com/public/weather-maps.json').then((r) => r.json()).then((j) => {
      if (!ON.rain) return; const f = j.radar.past[j.radar.past.length - 1];
      add('rain', L.tileLayer(j.host + f.path + '/256/{z}/{x}/{y}/2/1_1.png', { pane: 'mapxBase', opacity: 0.65, maxNativeZoom: 7, maxZoom: 19, attribution: 'Radar © RainViewer' }));
      setInfo('rain', `Radar de ${fmtT(f.time * 1000)} (franja más reciente disponible).`);
    }).catch(() => setInfo('rain', 'No se pudo cargar el radar (sin conexión a RainViewer).'));
    const c = map.getCenter();
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(3)}&longitude=${c.lng.toFixed(3)}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m&timezone=auto`)
      .then((r) => r.json()).then((j) => {
        const k = j.current, dd = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(k.wind_direction_10m / 45) % 8];
        wx = `🌡 ${k.temperature_2m} °C · 💧 ${k.relative_humidity_2m} % · 💨 ${k.wind_speed_10m} km/h ${dd} · 🌧 ${k.precipitation} mm`; emit();
      }).catch(() => { wx = 'Clima no disponible (sin conexión).'; emit(); });
  }

  /* ---------- 6. Paradas ---------- */
  function drawStops() {
    remove('stops'); if (!ON.stops) return; const g = L.layerGroup(); let n = 0, tot = 0;
    selIds().forEach((id) => {
      const a = hist[id] || [];
      findStops(a, CFG.stopMin).forEach(({ i, j, dur }) => {
        if (n >= 250) return; n++; tot += dur;
        L.marker([a[i][0], a[i][1]], { pane: 'mapxTop', icon: L.divIcon({ className: 'mx-stop', html: `⏸ ${fmtDurS(dur)}`, iconSize: null, iconAnchor: [0, 10] }), title: `${devName(id)} · ${fmtT(a[i][2])} → ${fmtT(a[j][2])}` }).addTo(g);
      });
    });
    add('stops', g); setInfo('stops', n ? `${n} paradas ≥ ${CFG.stopMin} min · total ${fmtDurS(tot)}` : selIds().length ? 'Sin paradas de ese tamaño.' : 'Selecciona un tractor o elige «Todos».');
  }

  /* ---------- 7. Cobertura del implemento ---------- */
  const mpp = (m) => (40075016.686 * Math.cos(m.getCenter().lat * rad)) / (256 * 2 ** m.getZoom());
  function drawCover() {
    remove('cover'); if (!ON.cover) { fences.forEach((f) => { delete f.cov; }); drawFences(); info.cover = null; emit(); return; }
    buildFences(); const ids = selIds(), cell = Math.max(CFG.width, 5);
    fences.forEach((f) => {
      const kx = 111320 * Math.cos(((f.b[0] + f.b[1]) / 2) * rad), ky = 111320, nx = Math.ceil(((f.b[3] - f.b[2]) * kx) / cell), ny = Math.ceil(((f.b[1] - f.b[0]) * ky) / cell), hit = {};
      ids.forEach((id) => {
        const a = hist[id] || [];
        for (let i = 1; i < a.length; i++) {
          if (a[i][3] < 0.5 || a[i][2] - a[i - 1][2] > 120000) continue;
          const st = Math.max(1, Math.ceil(mDist(a[i - 1], a[i]) / (cell / 2)));
          for (let s = 0; s <= st; s++) {
            const la = a[i - 1][0] + ((a[i][0] - a[i - 1][0]) * s) / st, lo = a[i - 1][1] + ((a[i][1] - a[i - 1][1]) * s) / st;
            if (la < f.b[0] || la > f.b[1] || lo < f.b[2] || lo > f.b[3]) continue;
            hit[Math.floor(((la - f.b[0]) * ky) / cell) * nx + Math.floor(((lo - f.b[2]) * kx) / cell)] = 1;
          }
        }
      });
      let inside = 0, covered = 0;
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const c = [f.b[0] + ((y + 0.5) * cell) / ky, f.b[2] + ((x + 0.5) * cell) / kx]; if (!inPoly(c, f.poly)) continue; inside++; if (hit[y * nx + x]) covered++; }
      f.cov = inside ? Math.round((covered / inside) * 1000) / 10 : 0;
    });
    add('cover', new CanvasLayer((ctx, s, m) => {
      const off = document.createElement('canvas'); off.width = s.x; off.height = s.y; const ox = off.getContext('2d'); ox.strokeStyle = '#6fd48f'; ox.lineCap = 'butt'; ox.lineJoin = 'round'; ox.lineWidth = Math.max(1.5, CFG.width / mpp(m));
      const vis = visPts(m, s);
      ids.forEach((id) => {
        const a = hist[id] || []; ox.beginPath();
        for (let i = 1; i < a.length; i++) {
          if (a[i][3] < 0.5 || a[i][2] - a[i - 1][2] > 120000 || !(vis(a[i]) || vis(a[i - 1]))) continue;
          const p = m.latLngToContainerPoint([a[i - 1][0], a[i - 1][1]]), q = m.latLngToContainerPoint([a[i][0], a[i][1]]); ox.moveTo(p.x, p.y); ox.lineTo(q.x, q.y);
        }
        ox.stroke();
      });
      ctx.globalAlpha = 0.55; ctx.drawImage(off, 0, 0);
    }));
    info.cover = ids.length ? { width: CFG.width, rows: fences.slice().sort((a, b) => b.cov - a.cov).map((f) => ({ name: f.name, cov: f.cov })) } : 'Selecciona un tractor o elige «Todos».';
    drawFences();
  }

  /* ---------- 8. NDVI (NASA GIBS · MODIS Terra) ---------- */
  const ymd = (d) => d.toISOString().slice(0, 10);
  function ndviDates() {
    const out = [], now = new Date();
    for (let back = 16; back <= 64; back += 8) { const t = new Date(now.getTime() - back * 864e5), y0 = Date.UTC(t.getUTCFullYear(), 0, 1), doy = Math.floor((t.getTime() - y0) / 864e5), st = Math.floor(doy / 8) * 8; out.push(ymd(new Date(y0 + st * 864e5))); }
    return out;
  }
  function toggleNdvi() {
    remove('ndvi'); if (!ON.ndvi) return; const dates = ndviDates(); let i = 0;
    (function tryNext() {
      if (!ON.ndvi) return; if (i >= dates.length) { setInfo('ndvi', 'No se encontró una imagen NDVI reciente.'); return; }
      const d = dates[i++], img = new Image();
      img.onload = () => {
        if (!ON.ndvi) return;
        add('ndvi', L.tileLayer(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`, { pane: 'mapxBase', opacity: CFG.ndviOp / 100, maxNativeZoom: 9, maxZoom: 19, attribution: 'NDVI © NASA GIBS (MODIS Terra, 8 días)' }));
        setInfo('ndvi', `Compuesto de 8 días desde ${d}. Resolución ~250 m: sirve para ver tendencias de la zona, no un lote individual. Verde intenso = vegetación densa.`);
      };
      img.onerror = tryNext; img.src = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${d}/GoogleMapsCompatible_Level9/3/3/2.png`;
    })();
  }

  /* ---------- 8b. Clima y viento por lote (Open-Meteo) ---------- */
  // Una sola consulta con el centro de cada lote; se renueva cada 15 min mientras la herramienta está encendida.
  // El veredicto es el mismo criterio de Inicio (viento, ráfagas, lluvia próxima y calor): es una referencia general, no la etiqueta del producto.
  const WX_MS = 15 * 60000, WX_COL = { ok: '#34a853', warn: '#fbbc04', crit: '#ea4335' };
  let wxAt = 0, wxBusy = false, wxData = null;
  const centroide = (poly) => [poly.reduce((s, q) => s + q[0], 0) / poly.length, poly.reduce((s, q) => s + q[1], 0) / poly.length];
  function drawWx() {
    remove('wxlotes'); if (!ON.wxlotes || !wxData) return;
    const g = L.layerGroup();
    wxData.forEach(({ poly, c, name, w }) => {
      const tone = w.risk[0];
      L.polygon(poly, { pane: 'mapx', interactive: false, color: WX_COL[tone], weight: 1.5, fillColor: WX_COL[tone], fillOpacity: 0.1 }).addTo(g);
      L.marker(c, { pane: 'mapxTop', keyboard: false, title: `${name}: ${w.risk[1]} · ${Math.round(w.temp)} °C, viento ${Math.round(w.wind)} km/h ${w.dir}, ráfagas ${Math.round(w.gust)}, lluvia próxima ${Math.round(w.rainMax)} %`,
        icon: L.divIcon({ className: `mx-wx mx-wx-${tone}`, html: `<b>${Math.round(w.temp)}°</b><span><i style="transform:rotate(${(Math.round(w.deg) + 180) % 360}deg)">↑</i>${Math.round(w.wind)} km/h</span>`, iconSize: [76, 42], iconAnchor: [38, 21] }) }).addTo(g);
    });
    add('wxlotes', g);
    const n = { ok: 0, warn: 0, crit: 0 }; wxData.forEach(({ w }) => { n[w.risk[0]]++; });
    setInfo('wxlotes', { st: 'ok', at: wxAt, n, rows: wxData.map(({ name, w }) => ({ name, tone: w.risk[0], verdict: w.risk[1], temp: Math.round(w.temp), wind: Math.round(w.wind), gust: Math.round(w.gust), dir: w.dir, rain: Math.round(w.rainMax) })) });
  }
  async function loadWx(force) {
    buildFences();
    if (!fences.length) { setInfo('wxlotes', { st: 'vacio' }); return; }
    if (wxBusy || (!force && wxData && wxData.length === fences.length && Date.now() - wxAt < WX_MS)) return; // lotes nuevos (importación) fuerzan la consulta
    wxBusy = true; if (!wxData) setInfo('wxlotes', { st: 'cargando' });
    try {
      const pts = fences.map((f) => centroide(f.poly)), res = await fetchWeatherLotes(pts);
      wxAt = Date.now(); wxData = fences.map((f, i) => (res[i] ? { poly: f.poly, c: pts[i], name: f.name, w: res[i] } : null)).filter(Boolean);
      wxBusy = false; drawWx();
    } catch { wxBusy = false; setInfo('wxlotes', { st: 'error' }); }
  }
  function toggleWx() { if (!ON.wxlotes) { remove('wxlotes'); return; } drawWx(); loadWx(); }

  /* ---------- Exportar / importar lotes ---------- */
  const abierto = (poly) => (poly.length > 1 && poly[0][0] === poly[poly.length - 1][0] && poly[0][1] === poly[poly.length - 1][1] ? poly.slice(0, -1) : poly);
  // Recorridos (según «Tractor elegido» / «Toda la flota») y lotes, listos para toGPX / toKML / toGeoJSON.
  function getExport() {
    buildFences();
    return {
      tracks: selIds().filter((id) => (hist[id] || []).length > 1).map((id) => ({ name: devName(id), pts: hist[id] })),
      lotes: fences.map((f) => ({ name: f.name, points: abierto(f.poly) })),
    };
  }
  // Vista previa de lotes por importar: contornos punteados y encuadre. clearPreview() los quita.
  function previewLotes(lotes) {
    remove('import'); if (!lotes.length) return;
    const g = L.layerGroup();
    lotes.forEach((l) => L.polygon(l.points, { pane: 'mapx', interactive: false, color: '#4285F4', weight: 2.5, dashArray: '8 6', fillColor: '#4285F4', fillOpacity: 0.12 }).bindTooltip(l.name, { permanent: lotes.length <= 12, direction: 'center', className: 'mx-tip' }).addTo(g));
    add('import', g); map.fitBounds(L.latLngBounds(lotes.flatMap((l) => l.points)).pad(0.2), { paddingTopLeft: [420, 90], paddingBottomRight: [60, 60] });
  }
  const clearPreview = () => remove('import');

  /* ---------- 9. Agrupar marcadores ---------- */
  function drawClusters() {
    const root = map.getContainer();
    if (!ON.cluster) { remove('cluster'); root.classList.remove('mx-clust'); return; }
    const z = map.getZoom(), active = z < CFG.clusterZoom; root.classList.toggle('mx-clust', active); remove('cluster');
    if (!active) { setInfo('cluster', `Zoom ${z}: se muestran los tractores individuales (se agrupan por debajo de ${CFG.clusterZoom}).`); return; }
    const cells = {}, S = 64;
    W().positions.forEach((p, id) => {
      const d = W().devices.get(id) || {}; if (CFG.marca && d.attributes?.marca !== CFG.marca) return;
      const q = map.latLngToContainerPoint([p.latitude, p.longitude]), key = `${Math.floor(q.x / S)}:${Math.floor(q.y / S)}`;
      const c = cells[key] || (cells[key] = { n: 0, run: 0, la: 0, lo: 0, pts: [] }); c.n++; c.la += p.latitude; c.lo += p.longitude; c.pts.push([p.latitude, p.longitude]); if (p.speed > 0.5) c.run++;
    });
    const g = L.layerGroup(); let k = 0;
    Object.values(cells).forEach((c) => {
      const pct = c.run / c.n, col = pct > 0.66 ? '#4caf73' : pct > 0.25 ? '#d99a2b' : '#6b7568', sz = 30 + Math.min(26, Math.sqrt(c.n) * 5); k++;
      const mk = L.marker([c.la / c.n, c.lo / c.n], { pane: 'mapxTop', icon: L.divIcon({ className: 'mx-cl', html: `<span style="background:${col};width:${sz}px;height:${sz}px;line-height:${sz}px">${c.n}</span>`, iconSize: [sz, sz] }) });
      mk.on('click', () => map.fitBounds(L.latLngBounds(c.pts).pad(0.4), { maxZoom: 17 })); mk.addTo(g);
    });
    add('cluster', g); setInfo('cluster', `${k} grupos · verde: mayoría en marcha · ámbar: mixto · gris: parados`);
  }

  /* ---------- 10. Reproducción de ruta ---------- */
  function pbId() {
    let best = null; Object.keys(hist).forEach((k) => { if (!best || hist[k].length > hist[best].length) best = k; });
    const sel = W().selected; return sel != null && (hist[sel] || []).length > 2 ? sel : best != null ? +best : null;
  }
  function pbTo(i) {
    const a = hist[PB.id]; if (!a) return; PB.i = Math.max(0, Math.min(a.length - 1, i)); const p = a[PB.i];
    lay.pbMk.setLatLng([p[0], p[1]]); lay.pbDone.setLatLngs(a.slice(0, PB.i + 1).map((q) => [q[0], q[1]]));
    PB.time = `${fmtT(p[2])} · ${p[3].toFixed(1)} km/h`; if (!map.getBounds().contains([p[0], p[1]])) map.panTo([p[0], p[1]]); emit();
  }
  function pbPause() { clearInterval(PB.timer); PB.timer = 0; PB.playing = false; emit(); }
  function pbPlay() { clearInterval(PB.timer); PB.playing = true; PB.timer = setInterval(() => { if (PB.i >= hist[PB.id].length - 1) { pbPause(); return; } pbTo(PB.i + Math.max(1, Math.round(PB.speed / 4))); }, 120); emit(); }
  function stopPlayback() { pbPause(); remove('pb'); PB.open = false; emit(); }
  function openPlayback() {
    const id = pbId(), a = id != null ? hist[id] : null;
    if (!a || a.length < 3) return 'Aún no hay historial. Pulsa «Cargar historial de demostración» o espera unos minutos.';
    stopPlayback(); PB.id = id; PB.i = 0; PB.open = true; PB.name = devName(id); PB.max = a.length - 1;
    const g = L.layerGroup(); L.polyline(a.map((p) => [p[0], p[1]]), { pane: 'mapx', color: '#919c89', weight: 3, opacity: 0.7, dashArray: '2 6', interactive: false }).addTo(g);
    lay.pbDone = L.polyline([], { pane: 'mapx', color: '#e6c97c', weight: 5, opacity: 0.95, interactive: false }).addTo(g);
    lay.pbMk = L.marker([a[0][0], a[0][1]], { pane: 'mapxTop', icon: L.divIcon({ className: 'mx-pbmk', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false }).addTo(g);
    add('pb', g); map.fitBounds(L.latLngBounds(a.map((p) => [p[0], p[1]])).pad(0.2)); pbTo(0); pbPlay();
    return null;
  }

  /* ---------- 11. Seguir y pantalla completa ---------- */
  let lastFollow = null;
  function follow() { const sel = W().selected; if (!ON.follow || sel == null) return; const p = W().positions.get(sel); if (!p) return; const ll = [p.latitude, p.longitude]; if (lastFollow !== sel) { map.setView(ll, Math.max(map.getZoom(), 16)); lastFollow = sel; } else map.panTo(ll, { animate: true, duration: 0.6 }); }
  function fullscreen() { const d = document; if (d.fullscreenElement) d.exitFullscreen(); else d.documentElement.requestFullscreen?.(); }

  /* ---------- orquestación ---------- */
  const runners = { trail: drawTrail, heat: drawHeat, labels: drawLabels, alerts: drawFences, rain: toggleRain, stops: drawStops, cover: drawCover, wxlotes: toggleWx, ndvi: toggleNdvi, cluster: drawClusters, follow };
  function run(k) { try { runners[k](); } catch (e) { console.error('[mapTools] ' + k, e); setInfo(k, 'Error: ' + e.message); } if (!ON[k]) { info[k] = ''; emit(); } }
  const runAll = () => ['trail', 'heat', 'labels', 'alerts', 'stops', 'cover', 'cluster', 'follow'].forEach((k) => { if (ON[k]) run(k); });
  let tick = 0, lastSel = null;
  function onState() {
    record(); const n = Date.now(), sel = W().selected;
    if (n - tick < 1500) { if (sel !== lastSel) { lastSel = sel; runAll(); } return; }
    tick = n; lastSel = sel;
    if (ON.follow) follow();
    if (ON.wxlotes) loadWx(); // se renueva sola cada 15 min
    ['trail', 'stops', 'labels', 'alerts', 'cluster'].forEach((k) => { if (ON[k]) run(k); });
    if (ON.heat && lay.heat) lay.heat.redraw(); if (ON.cover && n % 3 < 2) run('cover');
    emit();
  }
  const onMove = () => { if (ON.labels) drawLabels(); if (ON.cluster) drawClusters(); };
  map.on('moveend zoomend', onMove);

  return {
    FEATS,
    onState,
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    getState() {
      if (!snapCache) snapCache = { ver, ON: { ...ON }, CFG: { ...CFG }, info: { ...info }, wx, PB: { ...PB }, hist: { points: histCount(), tractors: Object.keys(hist).length } };
      return snapCache;
    },
    setOn(k, v) { ON[k] = v; run(k); },
    setCfg(k, v) { CFG[k] = v; if (k === 'ndviOp') { lay.ndvi?.setOpacity(v / 100); emit(); } else { runAll(); emit(); } },
    seed(h = 3) { const n = seedDemo(h); runAll(); emit(); return n; },
    refreshWx: () => loadWx(true), getExport, previewLotes, clearPreview,
    simulateExit, clearSim, openPlayback, stopPlayback, fullscreen,
    pbToggle() { if (PB.timer) pbPause(); else pbPlay(); }, pbTo, pbSpeed(v) { PB.speed = v; emit(); },
    destroy() { clearInterval(PB.timer); map.off('moveend zoomend', onMove); Object.keys(lay).filter((k) => lay[k] instanceof L.Layer).forEach(remove); map.getContainer().classList.remove('mx-clust'); },
  };
}
