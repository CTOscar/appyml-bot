// Herramientas interactivas del mapa (port de panelpack/assets/maptools.js): Inspector, Radio de alcance, Notas, Buscar y Compartir.
// Controlador de Leaflet sin DOM propio: la interfaz (barra, tarjetas, formulario) la dibuja React leyendo getState() y subscribe().
import L from 'leaflet';
import { inPoly, wkt } from './mapTools.js';
import { polyHa } from './ops.js';
import { fetchElevation, fetchPlace, fetchRoute } from '../lib/mapApis.js';
import { NOTES_KEY, TIPOS, V_ETA, distM, encodeView, etaMin, fmtDist, fmtEta, matches, nearest, within } from './geoTools.js';

export const MODE_TXT = {
  inspect: 'Inspector · haz clic en cualquier punto del mapa',
  radio: 'Radio de alcance · haz clic para colocar el centro',
  notas: 'Notas · haz clic donde quieras dejar un pin',
};

export function createMapInteract(map, getW) {
  const W = () => getW();
  let mode = null, ver = 0, snapCache = null;
  const subs = new Set();
  const emit = () => { ver++; snapCache = null; subs.forEach((f) => f()); };
  const lay = { insp: null, line: null, road: null, ring: null, pulse: null, draft: null, radio: null };
  let inspTok = 0, inspAbort = null, routeTok = 0, routeAbort = null; // consultas externas del Inspector (elevación, lugar, ruta): se cancelan al cambiar de punto
  const radio = { c: null, km: 1, circle: null, mk: null };
  let insp = null; // { lat, lon, lote, near, sel }
  let notes = [], draft = null, editing = null; // draft = { lat, lon }; editing = id de nota
  const noteMk = new Map();
  const gNotes = L.layerGroup().addTo(map);
  const PAN = { autoPanPaddingTopLeft: [420, 90], autoPanPaddingBottomRight: [380, 60] };
  void PAN;

  /* ---------- datos ---------- */
  const tractors = () => {
    const out = [];
    W().positions.forEach((p, id) => { const d = W().devices.get(id) || {}; out.push({ id, name: d.name || `Tractor ${id}`, lat: p.latitude, lon: p.longitude, speed: (p.speed || 0) * 1.852, attrs: d.attributes || {} }); });
    return out;
  };
  const fenceAt = (lat, lon) => {
    for (const g of W().geofences) {
      const poly = g.shape?.type === 'polygon' ? g.shape.points : wkt(g.area);
      if (poly && inPoly([lat, lon], poly)) { const a = Number(g.attributes?.superficie); return { id: g.id, name: g.name, ha: a > 0 ? a : g.ha || polyHa(poly) }; }
    }
    return null;
  };
  const clearLayer = (k) => { if (lay[k]) { map.removeLayer(lay[k]); lay[k] = null; } };
  const xhIcon = (c) => L.divIcon({ className: 'mt-xh-wrap', html: `<span class="mt-xh${c ? ' mt-xh-c' : ''}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });

  function pulse(lat, lon) {
    clearLayer('pulse');
    lay.pulse = L.circleMarker([lat, lon], { radius: 24, color: '#ffcf33', weight: 4, fill: false, className: 'mt-pulse', interactive: false }).addTo(map);
    setTimeout(() => clearLayer('pulse'), 3200);
  }

  /* ---------- modos ---------- */
  function setMode(m) {
    if (m === mode) m = null;
    cancelInsp(); ['insp', 'line', 'road'].forEach(clearLayer); insp = null; draft = null; editing = null; clearLayer('draft');
    if (mode === 'radio' && m !== 'radio') radioOff();
    mode = m;
    map.getContainer().classList.toggle('mt-tool', !!m);
    emit();
  }
  function onMapClick(e) {
    if (!mode) return;
    if (mode === 'inspect') inspect(e.latlng);
    else if (mode === 'radio') radioCenter([e.latlng.lat, e.latlng.lng]);
    else if (mode === 'notas') noteDraft(e.latlng);
  }
  map.on('click', onMapClick);

  /* ---------- Inspector ---------- */
  function inspect(ll) {
    const lat = ll.lat, lon = ll.lng;
    cancelInsp(); clearLayer('insp'); clearLayer('line'); clearLayer('road');
    lay.insp = L.marker([lat, lon], { icon: xhIcon(false), interactive: false, keyboard: false }).addTo(map);
    const ts = tractors(), near = nearest(ts, lat, lon), selId = W().selected, sel = selId != null ? ts.find((t) => t.id === selId) : null;
    insp = { lat, lon, lote: fenceAt(lat, lon), near: near ? { name: near.item.name, d: near.d } : null, sel: null };
    if (sel) {
      const d = distM([sel.lat, sel.lon], [lat, lon]), kmh = sel.speed > 2 ? sel.speed : V_ETA;
      insp.sel = { name: sel.name, d, eta: fmtEta(etaMin(d, kmh)), kmh: Math.round(kmh) };
      lay.line = L.polyline([[sel.lat, sel.lon], [lat, lon]], { color: '#2f6fd6', weight: 3, dashArray: '8 8', opacity: 0.9, interactive: false }).addTo(map);
    }
    insp.elev = { st: 'cargando' }; insp.place = { st: 'cargando' }; insp.route = null;
    const tok = ++inspTok; inspAbort = new AbortController(); const signal = inspAbort.signal;
    const set = (k, v) => { if (tok !== inspTok || !insp) return; insp = { ...insp, [k]: v }; emit(); };
    fetchElevation([lat, lon], { signal }).then((m) => set('elev', { st: 'ok', m }), () => set('elev', { st: 'error' }));
    fetchPlace([lat, lon], { signal }).then((p) => set('place', p ? { st: 'ok', ...p } : { st: 'vacio' }), () => set('place', { st: 'error' }));
    emit();
  }
  function cancelInsp() { inspTok++; routeTok++; inspAbort?.abort(); routeAbort?.abort(); inspAbort = null; routeAbort = null; }

  /* ---------- Ruta por camino hasta el punto del Inspector (OSRM) ---------- */
  // Sale del tractor elegido o, si no hay, del más cercano al punto.
  async function routeHere() {
    if (!insp) return;
    const { lat, lon } = insp, ts = tractors(), selId = W().selected;
    const from = (selId != null && ts.find((t) => t.id === selId)) || nearest(ts, lat, lon)?.item;
    if (!from) { insp = { ...insp, route: { st: 'error', msg: 'No hay tractores con posición.' } }; emit(); return; }
    const tok = ++routeTok; routeAbort?.abort(); routeAbort = new AbortController();
    clearLayer('road'); insp = { ...insp, route: { st: 'cargando', from: from.name } }; emit();
    try {
      const r = await fetchRoute([from.lat, from.lon], [lat, lon], { signal: routeAbort.signal });
      if (tok !== routeTok || !insp) return;
      // Tramo por camino (sólido) y enlaces punteados entre los puntos pedidos y el camino al que se pegaron.
      const o = [from.lat, from.lon], d = [lat, lon], enlace = { color: '#4285F4', weight: 3, opacity: 0.85, dashArray: '3 8', interactive: false };
      lay.road = L.layerGroup([L.polyline(r.coords, { color: '#4285F4', weight: 6, opacity: 0.9, lineCap: 'round', interactive: false }), L.polyline([o, r.coords[0]], enlace), L.polyline([r.coords[r.coords.length - 1], d], enlace)]).addTo(map);
      map.fitBounds(L.latLngBounds([...r.coords, o, d]).pad(0.25), { paddingTopLeft: [420, 90], paddingBottomRight: [60, 60] });
      insp = { ...insp, route: { st: 'ok', from: from.name, distM: r.distM, durS: r.durS, snapM: r.snapM, directM: distM(o, d) } };
    } catch (e) {
      if (tok !== routeTok || !insp) return;
      insp = { ...insp, route: { st: 'error', msg: e.name === 'AbortError' ? 'La consulta tardó demasiado.' : 'No se pudo calcular la ruta (sin conexión o sin camino).' } };
    }
    emit();
  }

  /* ---------- Radio de alcance ---------- */
  function radioOff() { clearLayer('radio'); clearLayer('ring'); if (radio.mk) { map.removeLayer(radio.mk); radio.mk = null; } radio.circle = null; }
  function radioCenter(c) { radio.c = c; radioDraw(); }
  function radioDraw() {
    const c = radio.c, r = radio.km * 1000;
    if (!radio.circle) {
      radio.circle = L.circle(c, { radius: r, color: '#2f6fd6', weight: 2, dashArray: '6 6', fillColor: '#2f6fd6', fillOpacity: 0.08, interactive: false }).addTo(map); lay.radio = radio.circle;
      radio.mk = L.marker(c, { draggable: true, zIndexOffset: 900, icon: xhIcon(true) }).addTo(map);
      radio.mk.on('drag', (e) => { radio.c = [e.latlng.lat, e.latlng.lng]; radio.circle.setLatLng(radio.c); radioRings(); emit(); });
      radio.mk.on('dragend', () => { radioRings(); emit(); });
    } else { radio.circle.setLatLng(c); radio.circle.setRadius(r); radio.mk.setLatLng(c); }
    radioRings(); emit();
  }
  const radioList = () => (radio.c ? within(tractors(), radio.c[0], radio.c[1], radio.km * 1000) : []);
  function radioRings() {
    clearLayer('ring');
    if (!radio.c) return;
    const g = L.layerGroup();
    radioList().forEach((o) => L.circleMarker([o.item.lat, o.item.lon], { radius: 19, color: '#ffcf33', weight: 4, fill: false, interactive: false }).addTo(g));
    lay.ring = g.addTo(map);
  }
  function setRadioKm(km) { radio.km = km; if (radio.circle) { radio.circle.setRadius(km * 1000); radioRings(); } emit(); }

  /* ---------- Notas (se guardan en este navegador) ---------- */
  function loadNotes() { try { const a = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); notes = Array.isArray(a) ? a.filter((n) => n && Number.isFinite(n.lat) && Number.isFinite(n.lon)) : []; } catch { notes = []; } }
  function saveNotes() { try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch { /* sin almacenamiento */ } }
  const noteIcon = (n) => L.divIcon({ className: 'mo-pinwrap', html: `<span class="mo-pin" style="--c:#7a4db3">${(TIPOS[n.tipo] || TIPOS.otro)[0]}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });
  function drawNote(n) {
    if (noteMk.has(n.id)) { gNotes.removeLayer(noteMk.get(n.id)); noteMk.delete(n.id); }
    const m = L.marker([n.lat, n.lon], { icon: noteIcon(n), draggable: true, zIndexOffset: 700, title: n.titulo || (TIPOS[n.tipo] || TIPOS.otro)[1], keyboard: true });
    m.on('click', () => { draft = null; clearLayer('draft'); editing = n.id; emit(); });
    m.on('dragend', () => { const p = m.getLatLng(); n.lat = p.lat; n.lon = p.lng; saveNotes(); emit(); });
    gNotes.addLayer(m); noteMk.set(n.id, m);
  }
  function noteDraft(ll) {
    clearLayer('draft');
    lay.draft = L.marker(ll, { icon: xhIcon(false), interactive: false }).addTo(map);
    draft = { lat: ll.lat, lon: ll.lng }; editing = null; emit();
  }
  function noteSave(data) { // data = { titulo, tipo, nota }; con editing actualiza, si no crea desde el borrador
    const clean = { tipo: TIPOS[data.tipo] ? data.tipo : 'otro', titulo: String(data.titulo || '').slice(0, 60), nota: String(data.nota || '').slice(0, 300) };
    let n;
    if (editing != null) { n = notes.find((x) => x.id === editing); if (!n) return null; Object.assign(n, clean); }
    else if (draft) { n = { id: Date.now() + Math.floor(Math.random() * 1000), lat: draft.lat, lon: draft.lon, ...clean, t: Date.now() }; notes.push(n); }
    else return null;
    clearLayer('draft'); draft = null; editing = null; drawNote(n); saveNotes(); emit();
    return n;
  }
  function noteHere(lat, lon) { setMode('notas'); noteDraft({ lat, lng: lon }); }
  function noteDel(id) {
    const i = notes.findIndex((x) => x.id === id); if (i < 0) return;
    if (noteMk.has(id)) { gNotes.removeLayer(noteMk.get(id)); noteMk.delete(id); }
    notes.splice(i, 1); editing = null; saveNotes(); emit();
  }
  const noteCancel = () => { clearLayer('draft'); draft = null; editing = null; emit(); };
  loadNotes(); notes.forEach(drawNote);

  /* ---------- Buscar ---------- */
  function search(q) {
    const out = [];
    tractors().forEach((t) => { if (matches(`${t.name} ${t.attrs.marca || ''} ${t.attrs.modelo || ''} ${t.attrs.nivel || ''}`, q)) out.push({ k: 'tractor', id: t.id, ico: '🚜', t: t.name, s: [t.attrs.marca, t.attrs.modelo].filter(Boolean).join(' · ') || 'Tractor', lat: t.lat, lon: t.lon }); });
    W().geofences.forEach((g) => { if (matches(g.name, q)) { const poly = g.shape?.type === 'polygon' ? g.shape.points : wkt(g.area); if (poly) out.push({ k: 'lote', id: g.id, ico: '▦', t: g.name, s: `Lote · ${polyHa(poly).toFixed(1)} ha`, poly }); } });
    notes.forEach((n) => { const T = TIPOS[n.tipo] || TIPOS.otro; if (matches(`${n.titulo || ''} ${n.nota || ''} ${T[1]}`, q)) out.push({ k: 'nota', id: n.id, ico: T[0], t: n.titulo || T[1], s: `Nota · ${T[1]}`, lat: n.lat, lon: n.lon }); });
    return out.slice(0, 9);
  }
  function go(r, { select, flyTo }) {
    if (r.k === 'tractor') { select?.(r.id); flyTo(r.lat, r.lon, 16); pulse(r.lat, r.lon); }
    else if (r.k === 'lote') map.flyToBounds(L.latLngBounds(r.poly.map((p) => [p[0], p[1]])).pad(0.25), { duration: 0.8 });
    else if (r.k === 'nota') { flyTo(r.lat, r.lon, 17); pulse(r.lat, r.lon); editing = r.id; emit(); }
  }

  /* ---------- Compartir ---------- */
  function shareUrl(layer, sel) {
    const c = map.getCenter();
    return `${location.origin}${location.pathname}?mv=${encodeURIComponent(encodeView({ layer, lat: c.lat, lon: c.lng, zoom: map.getZoom(), sel }))}#/mapa`;
  }

  return {
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    getState() {
      if (!snapCache) snapCache = { ver, mode, insp, radio: { c: radio.c, km: radio.km, list: radio.c ? radioList().map((o) => ({ id: o.item.id, name: o.item.name, d: o.d })) : [] }, notes: [...notes], draft, editing, total: tractors().length };
      return snapCache;
    },
    setMode, setRadioKm, routeHere, noteSave, noteDel, noteCancel, noteHere, search, go, pulse, shareUrl, refresh: () => { if (mode === 'radio' && radio.c) { radioRings(); emit(); } },
    destroy() { cancelInsp(); map.off('click', onMapClick); ['insp', 'line', 'road', 'ring', 'pulse', 'draft', 'radio'].forEach(clearLayer); if (radio.mk) map.removeLayer(radio.mk); map.removeLayer(gNotes); map.getContainer().classList.remove('mt-tool'); },
  };
}
