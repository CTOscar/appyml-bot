// Mapa en vivo (Leaflet, manejado fuera del ciclo de React para no redibujar 85 marcadores en cada reporte).
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { areaOf, fmtArea, fmtDist } from '../lib/units.js';
import { ago, evInfo } from '../lib/events.js';
import { getOps } from './opsConfig.js';
import { WORK } from './ops.js';
import { distM } from './geoTools.js';

// Capas base. «Oscuro» = OpenStreetMap con un filtro CSS sobre las teselas (clase pf-dark-tiles; CARTO oscuro ya pide clave).
// Esri para satélite. Antes de producción: confirmar políticas de uso o contratar un proveedor de teselas.
const LAYERS = {
  oscuro: () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'pf-dark-tiles', attribution: '&copy; OpenStreetMap' }),
  satelite: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imágenes &copy; Esri' }),
  hibrido: () => L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imágenes &copy; Esri' }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
  ]),
};
export const LAYER_NAMES = { oscuro: 'Mapa', satelite: 'Satélite', hibrido: 'Híbrido' };

const MONO = { 'john-deere': 'JD', 'new-holland': 'NH' };
// Logo de la marca dentro del marcador (si la imagen falla se muestra la sigla)
const MARK = { 'john-deere': '/brands/john-deere.png', 'new-holland': '/brands/new-holland-mark.png' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function pin(dev, st, sel) {
  return L.divIcon({
    className: '',
    html: `<span class="pf-mk pf-mk-${st}${sel ? ' pf-mk-sel' : ''}" title="${esc(dev?.name)}"><b>${MONO[dev?.attributes?.marca] || '··'}</b>${MARK[dev?.attributes?.marca] ? `<img src="${MARK[dev.attributes.marca]}" alt="" draggable="false" onerror="this.remove()">` : ''}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function shapeOf(g) {
  const sh = g.shape;
  if (!sh) return null;
  if (sh.type === 'polygon') return L.polygon(sh.points);
  if (sh.type === 'circle') return L.circle(sh.center, { radius: sh.radius });
  if (sh.type === 'line') return L.polyline(sh.points);
  return null;
}

const DEFAULT_CENTER = [22.998, -105.878];

export const MapView = forwardRef(function MapView({ snap, store, filters, selected, onSelect, layer = 'oscuro', fences = true, labels = false, units = 'metric', radar = false, measuring = false, onMeasure, onRadarInfo, follow = false, padLeft = 0, wheelZoom = true, onOpenLote }, ref) {
  const el = useRef(null);
  const m = useRef(null); // { map, base, markers, fenceLayer, trail… }
  const props = useRef({});
  props.current = { onSelect, padLeft, measuring, units, onMeasure, snap, store, onOpenLote };

  // Crear el mapa una vez.
  useEffect(() => {
    const map = L.map(el.current, { zoomControl: false, attributionControl: true, worldCopyJump: true, preferCanvas: false }).setView(DEFAULT_CENTER, 12);
    map.attributionControl.setPrefix('');
    if (!wheelZoom) { // mapa incrustado en una página con scroll: la rueda mueve la página; con Ctrl acerca o aleja
      map.scrollWheelZoom.disable();
      const host = el.current;
      const onWheel = (e) => { if (!e.ctrlKey) return; e.preventDefault(); if (e.deltaY < 0) map.zoomIn(); else map.zoomOut(); };
      host.addEventListener('wheel', onWheel, { passive: false });
      map.once('unload', () => host.removeEventListener('wheel', onWheel));
    }
    const trail = L.polyline([], { color: '#e6c97c', weight: 3, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false });
    const trailGlow = L.polyline([], { color: '#d4ac52', weight: 10, opacity: 0.25, interactive: false });
    m.current = { map, base: null, layerName: null, markers: new Map(), fenceLayer: L.layerGroup(), fenceKey: '', trail, trailGlow, fitted: false, moving: new Set(), raf: 0,
      radar: null, me: null, pts: [], mLine: L.polyline([], { color: '#e6c97c', weight: 3, dashArray: '6 6', interactive: false }), mFill: L.polygon([], { color: '#e6c97c', weight: 0, fillOpacity: 0.16, interactive: false }), mVtx: L.layerGroup() };
    map.on('click', (e) => {
      const st = m.current; if (!st || !props.current.measuring) return;
      st.pts.push(e.latlng); paintMeasure();
    });
    return () => { cancelAnimationFrame(m.current.raf); map.remove(); m.current = null; };
  }, []);

  // Medición: clics añaden vértices; con 3 o más se muestra también el área.
  function paintMeasure() {
    const st = m.current; if (!st) return;
    st.mLine.setLatLngs(st.pts); st.mFill.setLatLngs(st.pts.length >= 3 ? st.pts : []);
    st.mVtx.clearLayers();
    st.pts.forEach((p) => st.mVtx.addLayer(L.marker(p, { icon: L.divIcon({ className: '', html: '<span class="pf-vtx"></span>', iconSize: [10, 10] }), interactive: false })));
    let d = 0; for (let i = 1; i < st.pts.length; i++) d += st.map.distance(st.pts[i - 1], st.pts[i]);
    props.current.onMeasure?.(st.pts.length ? { n: st.pts.length, dist: fmtDist(d, props.current.units), area: st.pts.length >= 3 ? fmtArea(areaOf(st.pts), props.current.units) : null } : null);
  }
  useEffect(() => {
    const st = m.current; if (!st) return;
    const layers = [st.mFill, st.mLine, st.mVtx];
    st.map.getContainer().style.cursor = ''; // el cursor de medir lo pone la clase cur-medir (styles.css)
    if (measuring) layers.forEach((l) => !st.map.hasLayer(l) && l.addTo(st.map));
    else { layers.forEach((l) => l.remove()); st.pts = []; props.current.onMeasure?.(null); }
  }, [measuring]);
  useEffect(() => { if (measuring) paintMeasure(); }, [units]); // eslint-disable-line react-hooks/exhaustive-deps

  // Radar de lluvia (RainViewer, la franja más reciente), como el panel actual.
  useEffect(() => {
    const st = m.current; if (!st) return undefined;
    let vivo = true;
    if (!radar) { st.radar?.remove(); st.radar = null; onRadarInfo?.(null); return undefined; }
    fetch('https://api.rainviewer.com/public/weather-maps.json').then((r) => r.json()).then((j) => {
      if (!vivo || !m.current) return;
      const f = j.radar.past[j.radar.past.length - 1];
      st.radar = L.tileLayer(j.host + f.path + '/256/{z}/{x}/{y}/2/1_1.png', { opacity: 0.65, maxNativeZoom: 7, maxZoom: 19, attribution: 'Radar © RainViewer' }).addTo(st.map);
      onRadarInfo?.(`Radar de ${new Date(f.time * 1000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} (franja más reciente disponible).`);
    }).catch(() => onRadarInfo?.('No se pudo cargar el radar (sin conexión a RainViewer).'));
    return () => { vivo = false; };
  }, [radar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capa base.
  useEffect(() => {
    const st = m.current; if (!st || st.layerName === layer) return;
    if (st.base) st.base.remove();
    st.base = (LAYERS[layer] || LAYERS.oscuro)().addTo(st.map);
    st.base.bringToBack?.();
    st.layerName = layer;
  }, [layer]);

  // Lotes.
  useEffect(() => {
    const st = m.current; if (!st) return;
    const key = snap.geofences.map((g) => g.id + ':' + (g.attributes?.color || '')).join('|');
    if (key !== st.fenceKey) {
      st.fenceLayer.clearLayers();
      snap.geofences.forEach((g) => {
        const s = shapeOf(g); if (!s) return;
        const c = g.attributes?.color || '#e6c97c';
        s.setStyle({ color: c, weight: 1.5, opacity: 0.8, fillColor: c, fillOpacity: 0.06, dashArray: '5 6' });
        s.bindTooltip(esc(g.name) + (g.ha ? ` · ${g.ha.toFixed(1)} ha` : ''), { className: 'pf-tip', sticky: true, direction: 'top' });
        // Ventana del lote: superficie, cultivo y qué tractores están dentro ahora (lee la flota más reciente).
        s.bindPopup(() => {
          const { snap: sn, store: stt, units: u } = props.current, at = g.attributes || {};
          const ids = [...sn.positions.values()].filter((p) => (p.geofenceIds || []).includes(g.id)).map((p) => p.deviceId), set = new Set(ids);
          const sts = ids.map((id) => stt.statusOf(id)), run = sts.filter((x) => x === 'running').length, off = sts.filter((x) => x === 'nosignal').length, idle = sts.length - run - off;
          const ms = ids.reduce((n, id) => n + (sn.engineToday.get(id) || 0), 0), ha = Number(at.superficie) || g.ha || 0;
          let per = 0; const pts = g.shape?.type === 'polygon' ? g.shape.points : []; for (let i = 0; i < pts.length; i++) per += distM(pts[i], pts[(i + 1) % pts.length]);
          const ev = sn.events.filter((e) => e.geofenceId === g.id || set.has(e.deviceId)).slice(0, 3);
          const cell = (l, v) => `<div class="pf-cell"><small>${l}</small><b>${v}</b></div>`;
          const sub = [at.cultivo, at.etapa, at.responsable && `Resp. ${at.responsable}`].filter(Boolean).map(esc).join(' · ') || 'Lote · geocerca';
          return `<div class="pf-pop pf-pop-lote"><b>${esc(g.name)}</b><div class="pf-pop-m">${sub}</div>
            <div class="pf-cells">${cell('En marcha', `${run}/${ids.length}`)}${cell('Horas hoy', `${(ms / 3600e3).toFixed(1)} h`)}${cell('Eficiencia', `${ids.length ? Math.round((run / ids.length) * 100) : 0} %`)}</div>
            <div class="pf-cells">${cell('Superficie', ha ? esc(fmtArea(ha * 1e4, u)) : '—')}${cell('Perímetro', per ? esc(fmtDist(per, u)) : '—')}${cell('Ha/tractor', ids.length && ha ? (ha / ids.length).toFixed(1) : '—')}</div>
            <div class="pf-pop-m" style="margin-top:6px">${idle} apagados · ${off} sin señal${at.horasMax ? ` · Máx. ${esc(at.horasMax)} h/tractor` : ''}</div>
            ${ev.length ? `<ul class="pf-pop-ev">${ev.map((e) => `<li>${esc(evInfo(e).label)} · ${esc(sn.devices.get(e.deviceId)?.name || '#' + e.deviceId)}</li>`).join('')}</ul>` : ''}
            <button type="button" class="pf-pop-btn" data-lt-open>Ver detalle del lote</button></div>`;
        }, { className: 'pf-popup', minWidth: 230, maxWidth: 300 });
        s.on('popupopen', (e) => { e.popup.getElement()?.querySelector('[data-lt-open]')?.addEventListener('click', () => { props.current.onOpenLote?.(g.id); e.popup.close(); }); });
        st.fenceLayer.addLayer(s);
      });
      st.fenceKey = key;
    }
    if (fences && !st.map.hasLayer(st.fenceLayer)) st.fenceLayer.addTo(st.map);
    if (!fences && st.map.hasLayer(st.fenceLayer)) st.fenceLayer.remove();
  }, [snap.geofences, fences]);

  // Pines de las alertas de operación de hoy (combustible, velocidad) con su ventana y, en velocidad, el tramo recorrido.
  // El horario no lleva pin (un pin por tractor taparía el mapa): solo el anillo morado punteado y la lista.
  useEffect(() => {
    const st = m.current; if (!st) return;
    if (!st.alertLayer) st.alertLayer = L.layerGroup().addTo(st.map);
    const cfg = getOps();
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const on = { opFuel: cfg.combustible, opSpeed: cfg.velocidad };
    const list = snap.events.filter((e) => on[e.type] && Number.isFinite(e.attributes?.latitude) && new Date(e.eventTime) >= t0).slice(0, 60);
    const key = list.map((e) => `${e.id}:${e.attributes.pts?.length || 0}`).join('|');
    if (key === st.alertKey) return;
    st.alertKey = key; st.alertLayer.clearLayers();
    list.forEach((e) => {
      const a = e.attributes, name = snap.devices.get(e.deviceId)?.name || `#${e.deviceId}`;
      const ico = e.type === 'opSpeed' ? '⚡' : '⛽', col = a.sev === 'crit' ? '#d33a3a' : a.sev === 'info' ? '#2f6fd6' : '#e08a00';
      const mk = L.marker([a.latitude, a.longitude], { icon: L.divIcon({ className: '', html: `<span class="pf-alert-pin" style="border-color:${col}" aria-hidden="true">${ico}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }), title: `${name}: ${a.titulo}`, keyboard: true, zIndexOffset: 800 });
      mk.bindPopup(`<div class="pf-pop"><b>${esc(a.titulo || evInfo(e).label)}</b><div>${esc(name)}</div><div class="pf-pop-m">${esc(a.det || '')}</div><div class="pf-pop-m">${esc(ago(new Date(e.eventTime).getTime()))}</div></div>`, { className: 'pf-popup' });
      st.alertLayer.addLayer(mk);
      if (e.type === 'opSpeed' && a.pts?.length > 1) st.alertLayer.addLayer(L.polyline(a.pts, { color: '#d33a3a', weight: 5, opacity: 0.85, interactive: false }));
    });
  }, [snap.events, snap]);

  // Anillo de estado de trabajo alrededor de cada tractor (trabajando, tránsito, parado, apagado, sin señal); morado punteado si trabaja fuera de horario.
  useEffect(() => {
    const st = m.current; if (!st) return;
    if (!st.ringLayer) { st.ringLayer = L.layerGroup().addTo(st.map); st.rings = new Map(); }
    const cfg = getOps();
    snap.positions.forEach((p, id) => {
      let r = st.rings.get(id);
      if (!cfg.estado || !Number.isFinite(p.latitude)) { if (r) { st.ringLayer.removeLayer(r); st.rings.delete(id); } return; }
      const out = cfg.horario && store.outOfHours(id), w = WORK[store.workOf(id)] || WORK.apagado;
      const o = { radius: 17, color: out ? '#8e44ad' : w.color, weight: out ? 3 : 4, opacity: 0.95, fill: false, interactive: false, dashArray: out ? '4 4' : null };
      if (!r) { r = L.circleMarker([p.latitude, p.longitude], o); st.rings.set(id, r); st.ringLayer.addLayer(r); }
      r.setLatLng([p.latitude, p.longitude]); r.setStyle(o);
    });
  }, [snap, store]);

  // Marcadores (en cada actualización en vivo).
  useEffect(() => {
    const st = m.current; if (!st) return;
    const { map, markers } = st;
    const ANIM = 1800;
    const frame = (now) => {
      st.moving.forEach((mk) => {
        const k = Math.min(1, (now - mk._t0) / ANIM);
        mk.setLatLng([mk._from[0] + (mk._to[0] - mk._from[0]) * k, mk._from[1] + (mk._to[1] - mk._from[1]) * k]);
        if (k >= 1) st.moving.delete(mk);
      });
      st.raf = st.moving.size ? requestAnimationFrame(frame) : 0;
    };
    const glide = (mk, to) => {
      const from = mk.getLatLng();
      if (Math.abs(from.lat - to[0]) + Math.abs(from.lng - to[1]) > 0.01 || document.hidden) { mk.setLatLng(to); return; }
      mk._from = [from.lat, from.lng]; mk._to = to; mk._t0 = performance.now();
      st.moving.add(mk);
      if (!st.raf) st.raf = requestAnimationFrame(frame);
    };
    const bounds = [];
    snap.positions.forEach((p, id) => {
      const dev = snap.devices.get(id);
      const ll = [p.latitude, p.longitude];
      if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return;
      const stt = store.statusOf(id), sel = selected === id;
      const key = `${stt}|${sel}|${dev?.attributes?.marca || ''}`;
      let mk = markers.get(id);
      if (!mk) {
        mk = L.marker(ll, { icon: pin(dev, stt, sel), title: dev?.name, riseOnHover: true, keyboard: true });
        mk.on('click', () => props.current.onSelect?.(id));
        mk._key = key;
        markers.set(id, mk);
      } else {
        const cur = mk._to || [mk.getLatLng().lat, mk.getLatLng().lng];
        if (cur[0] !== ll[0] || cur[1] !== ll[1]) glide(mk, ll);
        if (mk._key !== key) { mk.setIcon(pin(dev, stt, sel)); mk._key = key; }
      }
      mk.setZIndexOffset(sel ? 1000 : stt === 'running' ? 100 : 0);
      if (labels && !mk.getTooltip()) mk.bindTooltip(esc(dev?.name), { permanent: true, direction: 'bottom', offset: [0, 10], className: 'pf-lbl' });
      if (!labels && mk.getTooltip()) mk.unbindTooltip();
      const show = sel || store.matches(id, filters);
      if (show && !map.hasLayer(mk)) mk.addTo(map);
      if (!show && map.hasLayer(mk)) mk.remove();
      if (show) bounds.push(ll);
    });
    if (!st.fitted && bounds.length) { map.fitBounds(bounds, { padding: [60, 60], paddingTopLeft: [60 + props.current.padLeft, 90] }); st.fitted = true; }

    // Recorrido del seleccionado.
    const t = selected != null ? snap.trails.get(selected) || [] : [];
    if (t.length >= 2) {
      const pts = t.map((x) => [x[0], x[1]]);
      st.trailGlow.setLatLngs(pts); st.trail.setLatLngs(pts);
      if (!map.hasLayer(st.trail)) { st.trailGlow.addTo(map); st.trail.addTo(map); }
    } else if (map.hasLayer(st.trail)) { st.trail.remove(); st.trailGlow.remove(); }

    if (follow && selected != null) {
      const p = snap.positions.get(selected);
      if (p) map.panTo([p.latitude, p.longitude], { animate: true, duration: 1.5 });
    }
  }, [snap, store, filters, selected, follow, labels]);

  useImperativeHandle(ref, () => ({
    // Centra un punto en el área visible (el panel de la flota tapa la parte izquierda).
    flyTo(lat, lon, z = 16) {
      const st = m.current; if (!st) return;
      const zoom = Math.max(st.map.getZoom(), z);
      const pt = st.map.project([lat, lon], zoom).subtract([-props.current.padLeft / 2, 0]);
      st.map.flyTo(st.map.unproject(pt, zoom), zoom, { duration: 0.8 });
    },
    focus(id) {
      const st = m.current, p = snap.positions.get(id); if (!st || !p) return;
      const zoom = Math.max(st.map.getZoom(), 16);
      const pt = st.map.project([p.latitude, p.longitude], zoom).subtract([-props.current.padLeft / 2, 0]);
      st.map.flyTo(st.map.unproject(pt, zoom), zoom, { duration: 0.8 });
    },
    fitAll() {
      const st = m.current; if (!st) return;
      const ll = [...snap.positions.values()].filter((p) => store.matches(p.deviceId, filters)).map((p) => [p.latitude, p.longitude]);
      if (ll.length) st.map.flyToBounds(ll, { paddingTopLeft: [60 + props.current.padLeft, 90], paddingBottomRight: [60, 60], duration: 0.8 });
    },
    fitFence(id) {
      const st = m.current, g = snap.geofences.find((x) => x.id === id); if (!st || !g?.shape) return;
      const pts = g.shape.type === 'circle' ? L.circle(g.shape.center, { radius: g.shape.radius }).addTo(st.map) : null;
      const b = pts ? pts.getBounds() : L.latLngBounds(g.shape.points);
      if (pts) pts.remove();
      st.map.flyToBounds(b, { paddingTopLeft: [80 + props.current.padLeft, 110], paddingBottomRight: [80, 80], duration: 0.8 });
    },
    getMap() { return m.current?.map || null; },
    zoomIn() { m.current?.map.zoomIn(); },
    clearMeasure() { if (m.current) { m.current.pts = []; paintMeasure(); } },
    locate() {
      const st = m.current; if (!st || !navigator.geolocation) return Promise.reject(new Error('Tu navegador no permite ubicarte.'));
      return new Promise((ok, ko) => navigator.geolocation.getCurrentPosition((pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        st.me?.remove();
        st.me = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#7fb8d8', fillOpacity: 1 }).addTo(st.map).bindTooltip('Tu ubicación', { className: 'pf-tip' });
        st.map.flyTo(ll, Math.max(st.map.getZoom(), 15), { duration: 0.8 }); ok(ll);
      }, () => ko(new Error('No se pudo obtener tu ubicación.')), { enableHighAccuracy: true, timeout: 10000 }));
    },
    zoomOut() { m.current?.map.zoomOut(); },
    invalidate() { m.current?.map.invalidateSize(); },
  }), [snap, store, filters]);

  return <div ref={el} className="pf-map absolute inset-0" role="application" aria-label="Mapa de la flota" />;
});
