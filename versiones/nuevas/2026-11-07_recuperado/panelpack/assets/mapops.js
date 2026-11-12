/* mapops.js — operación de flota sobre el mapa (complemento, sin recompilar).
 * Usa: window.L (Leaflet), window.__pf (estado en vivo), window.__mapx.map (instancia del mapa que captura mapx.js).
 * Funciones: 1) estado de trabajo (trabajando / en tránsito / parado / apagado / sin señal) con tiempos por tractor,
 *            2) superficie trabajada por lote (ha hechas y pendientes), 3) alertas de combustible (extracción, caída, carga),
 *            4) alertas de velocidad (límite en lote y en tránsito), 5) horario permitido.
 * Los ajustes viven en "Ajustes de mapa": el bundle llama a window.__mapops.settings(panel) cada vez que dibuja ese panel.
 * Persistencia: localStorage (ajustes: pf-mapops-v1; datos del día: pf-mapops-d-AAAAMMDD). Nada se envía a ningún servidor.
 * Unidades: Traccar entrega la velocidad en NUDOS (el panel muestra km/h = nudos × 1.852); aquí todo se maneja en km/h, litros, ha y metros. */
(function () {
  'use strict';

  var LSK = 'pf-mapops-v1', DKEY = 'pf-mapops-d-';
  var DEF = {
    estado: true, superficie: true, combustible: true, velocidad: true, horario: true, tarjeta: true,
    vmin: 1,        // km/h: por debajo se considera parado
    ancho: 8,       // m: ancho del implemento (superficie trabajada)
    fuelL: 10,      // L: baja o sube mínima para alertar
    vLote: 12,      // km/h: límite trabajando dentro de un lote (aspersión y rastreo llegan a ~10-12)
    vTrans: 30,     // km/h: límite en tránsito (fuera de lotes)
    hIni: '06:00', hFin: '20:00',
  };
  var STATES = {
    trabajo: { t: 'Trabajando', c: '#2e9e4f' },
    transito: { t: 'En tránsito', c: '#2f6fd6' },
    ralenti: { t: 'Parado, motor encendido', c: '#f0a500' },
    apagado: { t: 'Apagado', c: '#8a8f98' },
    sinsenal: { t: 'Sin señal', c: '#d33a3a' },
  };
  var KIND = { combustible: { ico: '⛽', n: 'Combustible' }, velocidad: { ico: '⚡', n: 'Velocidad' }, horario: { ico: '🕐', n: 'Horario' } };
  var KMH = 1.852;

  /* ================= lógica pura (se prueba con patch/mapops.test.cjs) ================= */
  function kmh(p) { return (Number(p && p.speed) || 0) * KMH; }

  // Estado de trabajo de un tractor. o = { nosignal, ignition, v (km/h), inLote }
  function classify(o, c) {
    if (o.nosignal) return 'sinsenal';
    if (!o.ignition) return 'apagado';
    if (o.v < c.vmin) return 'ralenti';
    return o.inLote ? 'trabajo' : 'transito';
  }

  function hm(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : null; }
  // ¿La fecha cae fuera del horario permitido? Admite horarios que cruzan la medianoche (22:00 → 06:00).
  function outOfSchedule(d, ini, fin) {
    var a = hm(ini), b = hm(fin), m = d.getHours() * 60 + d.getMinutes();
    if (a == null || b == null || a === b) return false;
    return a < b ? m < a || m >= b : m >= b && m < a;
  }

  // Combustible. st = { last, win:[[t,litros]...] }. Devuelve null o { tipo: 'extraccion'|'caida'|'carga', litros }.
  //  - Motor apagado: baja acumulada en 10 min >= umbral  => posible extracción.
  //  - Motor encendido: baja entre dos lecturas seguidas >= umbral => caída brusca (el consumo normal no llega al umbral).
  //  - Sube >= umbral entre lecturas (o en la ventana con el motor apagado) => carga.
  function fuelStep(st, t, fuel, ign, umbral) {
    var WIN = 10 * 60000, ev = null;
    st.win = (st.win || []).filter(function (x) { return t - x[0] <= WIN; });
    if (st.last != null) {
      if (ign) {
        if (st.last - fuel >= umbral) ev = { tipo: 'caida', litros: st.last - fuel };
        else if (fuel - st.last >= umbral) ev = { tipo: 'carga', litros: fuel - st.last };
      } else {
        var mx = -Infinity, mn = Infinity;
        st.win.forEach(function (x) { if (x[1] > mx) mx = x[1]; if (x[1] < mn) mn = x[1]; });
        if (mx - fuel >= umbral) ev = { tipo: 'extraccion', litros: mx - fuel };
        else if (fuel - mn >= umbral) ev = { tipo: 'carga', litros: fuel - mn };
      }
    }
    if (ev) st.win = [];
    st.win.push([t, fuel]); st.last = fuel;
    return ev;
  }

  // Velocidad. ep = episodio abierto o null. Devuelve { ep, nuevo }. Un episodio termina cuando baja del límite
  // o pasan más de 60 s entre lecturas.
  function speedStep(ep, t, v, lim, pt) {
    if (v > lim) {
      if (!ep || t - ep.last > 60000) return { ep: { t0: t, last: t, max: v, lim: lim, pts: [pt] }, nuevo: true };
      ep.last = t; if (v > ep.max) ep.max = v; if (ep.pts.length < 40) ep.pts.push(pt);
      return { ep: ep, nuevo: false };
    }
    return { ep: null, nuevo: false };
  }

  // Celdas de la cuadrícula del implemento (superficie trabajada, sin contar dos veces donde se traslapa).
  function cellKey(lat, lon, w) { return Math.floor((lat * 110540) / w) + ':' + Math.floor((lon * 111320 * Math.cos(lat * Math.PI / 180)) / w); }
  function distM(a, b) {
    var dy = (b[0] - a[0]) * 110540, dx = (b[1] - a[1]) * 111320 * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy);
  }
  // Marca las celdas a lo largo de a → b (se interpola cada medio ancho para no dejar huecos entre lecturas espaciadas).
  function markSegment(cells, a, b, w) {
    var d = distM(a, b), n = Math.max(1, Math.ceil(d / (w / 2)));
    for (var i = 0; i <= n; i++) cells[cellKey(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, w)] = 1;
  }
  function haFromCells(n, w) { return (n * w * w) / 1e4; }
  function wkt(area) {
    var m = /\(\((.*)\)\)/.exec(area || ''); if (!m) return null;
    return m[1].split(',').map(function (p) { var q = p.trim().split(/\s+/); return [+q[0], +q[1]]; });
  }
  function polyHa(poly) { // poly = [[lat, lon]...]
    if (!poly || poly.length < 3) return 0;
    var l0 = poly.reduce(function (s, q) { return s + q[0]; }, 0) / poly.length * Math.PI / 180, s = 0;
    var xy = poly.map(function (q) { return [q[1] * 111320 * Math.cos(l0), q[0] * 110540]; });
    xy.forEach(function (q, k) { var r = xy[(k + 1) % xy.length]; s += q[0] * r[1] - r[0] * q[1]; });
    return Math.abs(s) / 2 / 1e4;
  }
  function fmtDur(ms) { var m = Math.round(ms / 60000); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; }
  function ymd(d) { return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var root = typeof window !== 'undefined' ? window : globalThis;
  var api = (root.__mapops = root.__mapops || {});
  api._t = { kmh: kmh, classify: classify, outOfSchedule: outOfSchedule, fuelStep: fuelStep, speedStep: speedStep, cellKey: cellKey, markSegment: markSegment, haFromCells: haFromCells, polyHa: polyHa, wkt: wkt, DEF: DEF };
  if (typeof document === 'undefined') return; // en pruebas de Node solo se exporta la lógica pura

  /* ================= ajustes y datos del día ================= */
  var cfg = (function () {
    var c = {}; for (var k in DEF) c[k] = DEF[k];
    try { var s = JSON.parse(localStorage.getItem(LSK) || '{}'); for (var k2 in DEF) if (typeof s[k2] === typeof DEF[k2]) c[k2] = s[k2]; } catch (e) {}
    return c;
  })();
  function saveCfg() { try { localStorage.setItem(LSK, JSON.stringify(cfg)); } catch (e) {} }

  var day = loadDay();
  function loadDay() {
    var id = ymd(new Date()), d = null;
    try { d = JSON.parse(localStorage.getItem(DKEY + id) || 'null'); } catch (e) {}
    if (!d || d.d !== id) d = { d: id, t: {}, cells: {}, alerts: [], seq: 0 };
    d.cells = d.cells || {}; d.t = d.t || {}; d.alerts = d.alerts || []; d.seq = d.seq || 0;
    try { // se conservan 7 días; lo más viejo se borra
      for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && k.indexOf(DKEY) === 0 && k < DKEY + ymd(new Date(Date.now() - 7 * 864e5))) localStorage.removeItem(k); }
    } catch (e) {}
    return d;
  }
  var dirty = false, lastSave = 0;
  function saveDay(force) {
    var n = Date.now(); if (!force && (!dirty || n - lastSave < 8000)) return;
    try {
      var cells = {}; for (var f in cellSets) { cells[f] = Object.keys(cellSets[f]).slice(-30000); }
      day.cells = cells; localStorage.setItem(DKEY + day.d, JSON.stringify(day)); dirty = false; lastSave = n;
    } catch (e) { /* cuota llena: se sigue en memoria */ }
  }
  var cellSets = {}; // fenceId -> { 'x:y': 1 }
  for (var fid0 in day.cells) { cellSets[fid0] = {}; day.cells[fid0].forEach(function (k) { cellSets[fid0][k] = 1; }); }

  /* ================= estado en vivo ================= */
  var PF = null, W = null, L = null, map = null;
  var rt = {};          // por tractor: { t, st, fid, pos, fw, ep, epAl, outH }
  var fenceCache = {};  // id -> { name, poly, ha }
  var rings = {}, pins = {}, lines = {}, gRing = null, gPin = null;
  var tab = 'estado', cardEl = null, lastCard = 0;

  function devName(id) { var d = W.devices.get(id); return d ? d.name : 'Tractor ' + id; }
  function fenceInfo(id) {
    if (!fenceCache[id] || fenceCache[id].n !== W.geofences.length) {
      var f = W.geofences.filter(function (g) { return g.id === id; })[0];
      var poly = f ? wkt(f.area) : null, a = f && f.attributes ? Number(f.attributes.superficie) : 0;
      fenceCache[id] = { n: W.geofences.length, name: f ? f.name : 'Lote ' + id, poly: poly, ha: a > 0 ? a : polyHa(poly) };
    }
    return fenceCache[id];
  }
  function addAlert(a) {
    a.id = ++day.seq; a.t = a.t || Date.now(); day.alerts.push(a);
    // tope de 120: primero se descartan las de horario (pueden ser decenas a la vez); combustible y velocidad se conservan más
    while (day.alerts.length > 120) {
      var i = -1; for (var j = 0; j < day.alerts.length; j++) { if (day.alerts[j].k === 'horario') { i = j; break; } }
      day.alerts.splice(i < 0 ? 0 : i, 1);
    }
    dirty = true; return a;
  }

  function onState() {
    var now = Date.now();
    if (now - (onState.t || 0) < 1000) return; onState.t = now;
    if (ymd(new Date()) !== day.d) { day = loadDay(); cellSets = {}; rt = {}; }
    W.positions.forEach(function (p, id) {
      var r = rt[id] || (rt[id] = { fw: {} });
      var nos = PF.At(id) === 'nosignal', ign = !!(p.attributes && p.attributes.ignition), v = kmh(p);
      var fid = p.geofenceIds && p.geofenceIds[0] ? p.geofenceIds[0] : 0, pos = [p.latitude, p.longitude];
      var st = classify({ nosignal: nos, ignition: ign, v: v, inLote: !!fid }, cfg);
      var dt = r.t ? now - r.t : 0; r.t = now;
      var tt = day.t[id] || (day.t[id] = { trabajo: 0, transito: 0, ralenti: 0, apagado: 0 });
      if (dt > 0 && dt <= 90000 && tt[st] != null) { tt[st] += dt; dirty = true; }
      // superficie: solo al trabajar, dentro del mismo lote entre dos lecturas seguidas
      if (st === 'trabajo' && fid && r.pos && r.fid === fid && dt > 0 && dt <= 90000 && distM(r.pos, pos) < 400) {
        var cs = cellSets[fid] || (cellSets[fid] = {}); markSegment(cs, r.pos, pos, cfg.ancho); dirty = true;
      }
      r.pos = pos; r.fid = fid; r.st = st; r.v = v;
      if (nos) return;
      // combustible
      var fuel = p.attributes && p.attributes.fuel;
      if (cfg.combustible && typeof fuel === 'number') {
        var ev = fuelStep(r.fw, now, fuel, ign, cfg.fuelL);
        if (ev) {
          var T = { extraccion: ['Posible extracción de combustible', 'crit'], caida: ['Caída brusca de combustible', 'warn'], carga: ['Carga de combustible', 'info'] }[ev.tipo];
          addAlert({ k: 'combustible', sev: T[1], dev: id, name: devName(id), lat: pos[0], lon: pos[1], titulo: T[0],
            det: (ev.tipo === 'carga' ? '+' : '−') + Math.round(ev.litros) + ' L · ahora ' + Math.round(fuel) + ' L · motor ' + (ign ? 'encendido' : 'apagado') + (fid ? ' · ' + fenceInfo(fid).name : '') });
        }
      } else if (typeof fuel === 'number') { r.fw.last = fuel; }
      // velocidad
      if (cfg.velocidad && ign) {
        var lim = fid ? cfg.vLote : cfg.vTrans, s = speedStep(r.ep, now, v, lim, pos);
        r.ep = s.ep;
        if (s.nuevo) { // tras recargar la página, un exceso que continúa reutiliza la alerta de hace menos de 2 min en vez de duplicarla
          var prev = null; day.alerts.forEach(function (x) { if (x.k === 'velocidad' && x.dev === id && x.last && now - x.last < 120000) prev = x; });
          if (prev) r.epAl = prev;
        }
        if (s.nuevo && !r.epAl) r.epAl = addAlert({ k: 'velocidad', sev: 'warn', dev: id, name: devName(id), lat: pos[0], lon: pos[1], titulo: 'Exceso de velocidad', lim: lim, max: v, pts: s.ep.pts, det: '' });
        if (r.ep && r.epAl) { r.epAl.last = now; r.epAl.max = Math.max(r.epAl.max || 0, r.ep.max); r.epAl.pts = r.ep.pts; r.epAl.det = Math.round(r.epAl.max) + ' km/h (límite ' + lim + ' ' + (fid ? 'en lote ' + fenceInfo(fid).name : 'en tránsito') + ')'; dirty = true; }
        if (!r.ep) r.epAl = null;
      } else { r.ep = null; r.epAl = null; }
      // horario permitido
      if (cfg.horario) {
        var fuera = ign && v >= cfg.vmin && outOfSchedule(new Date(now), cfg.hIni, cfg.hFin); // motor encendido y avanzando
        if (fuera && !r.outH) {
          r.outH = true;
          // al recargar la página r se reinicia: no se repite la alerta si ya hay una de este tractor en la última media hora
          if (!day.alerts.some(function (x) { return x.k === 'horario' && x.dev === id && now - x.t < 30 * 60000; })) addAlert({ k: 'horario', sev: 'warn', dev: id, name: devName(id), lat: pos[0], lon: pos[1], titulo: 'Trabajando fuera de horario', det: 'Horario permitido ' + cfg.hIni + '–' + cfg.hFin + ' · ' + Math.round(v) + ' km/h' });
        } else if (!fuera) r.outH = false;
      } else r.outH = false;
    });
    saveDay(); paintMap();
    if (cardEl && now - lastCard > 2000) { lastCard = now; paintCard(); }
  }

  /* ================= capas del mapa ================= */
  function ensureLayers() {
    if (gRing) return;
    gRing = L.layerGroup().addTo(map); gPin = L.layerGroup().addTo(map);
  }
  function alertOn(a) { return cfg[a.k]; }
  function paintMap() {
    if (!map) return; ensureLayers();
    W.positions.forEach(function (p, id) {
      var r = rt[id]; if (!r || !r.st) return;
      var show = cfg.estado, s = STATES[r.st], out = cfg.horario && r.outH;
      var o = { radius: 17, color: out ? '#8e44ad' : s.c, weight: out ? 3 : 4, opacity: 0.95, fill: false, interactive: false, dashArray: out ? '4 4' : null };
      var m = rings[id];
      if (!show) { if (m) { gRing.removeLayer(m); delete rings[id]; } return; }
      if (!m) { m = rings[id] = L.circleMarker([p.latitude, p.longitude], o); gRing.addLayer(m); }
      m.setLatLng([p.latitude, p.longitude]); m.setStyle(o);
    });
    day.alerts.forEach(function (a) {
      var m = pins[a.id], on = alertOn(a) && a.k !== 'horario'; // horario: solo anillo punteado + lista (un pin por tractor taparía el mapa)
      if (!on) { if (m) { gPin.removeLayer(m); delete pins[a.id]; } if (lines[a.id]) { gPin.removeLayer(lines[a.id]); delete lines[a.id]; } return; }
      var col = a.sev === 'crit' ? '#d33a3a' : a.sev === 'info' ? '#2f6fd6' : '#e08a00';
      if (!m) {
        m = pins[a.id] = L.marker([a.lat, a.lon], { icon: L.divIcon({ className: 'mo-pinwrap', html: '<span class="mo-pin" style="--c:' + col + '">' + KIND[a.k].ico + '</span>', iconSize: [28, 28], iconAnchor: [14, 14] }), zIndexOffset: 800 });
        m.bindPopup(function () { return popupHtml(a); }); gPin.addLayer(m);
      }
      if (a.k === 'velocidad' && a.pts && a.pts.length > 1) {
        if (!lines[a.id]) { lines[a.id] = L.polyline(a.pts, { color: '#d33a3a', weight: 5, opacity: 0.85, interactive: false }); gPin.addLayer(lines[a.id]); } else lines[a.id].setLatLngs(a.pts);
      }
    });
    Object.keys(pins).forEach(function (k) { if (!day.alerts.some(function (a) { return String(a.id) === k; })) { gPin.removeLayer(pins[k]); delete pins[k]; if (lines[k]) { gPin.removeLayer(lines[k]); delete lines[k]; } } });
  }
  function clearMap() {
    [rings, pins, lines].forEach(function (o) { Object.keys(o).forEach(function (k) { if (o[k] && o[k].remove) o[k].remove(); delete o[k]; }); });
  }
  function popupHtml(a) {
    return '<div class="mo-pop"><b>' + esc(a.titulo) + '</b><div>' + esc(a.name) + '</div><div class="mo-m">' + esc(a.det) + '</div><div class="mo-m">' + new Date(a.t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) + '</div></div>';
  }

  /* ================= tarjeta "Operación de hoy" ================= */
  function tabsAvail() {
    var t = []; if (cfg.estado) t.push('estado'); if (cfg.superficie) t.push('avance');
    if (cfg.combustible || cfg.velocidad || cfg.horario) t.push('alertas'); return t;
  }
  function visibleAlerts() { return day.alerts.filter(alertOn).slice().reverse(); }
  function paintCard() {
    if (!cardEl) return;
    var tabs = tabsAvail(), m = document.getElementById('map'), r = m ? m.getBoundingClientRect() : null;
    // El mapa sigue en el DOM debajo de las páginas del marco (Inicio, Tractores, Ajustes…): solo se ve en el modo mapa del marco o sin marco.
    var hv = document.getElementById('home-view'), enPagina = hv && !hv.hidden && !hv.classList.contains('dh-map');
    var vis = cfg.tarjeta && tabs.length && r && r.width > 300 && r.height > 260 && !enPagina && window.innerWidth >= 760; // en celular el panel es una hoja inferior: sin tarjeta flotante
    cardEl.hidden = !vis; if (!vis) return;
    if (tabs.indexOf(tab) < 0) tab = tabs[0];
    // A la derecha del mapa, abajo, a la izquierda de la columna de controles (igual que el panel de herramientas de mapx.js).
    // Se oculta mientras esté abierto el panel rápido de Ajustes o el de herramientas, que ocupan esa misma zona.
    var ap = document.getElementById('map-panel'), xp = document.getElementById('mx-panel'), tm = document.getElementById('mt-menu');
    if ((ap && !ap.hidden) || (xp && !xp.hidden) || (tm && !tm.hidden)) { cardEl.hidden = true; return; } // tm: menú de herramientas interactivas (maptools.js), que se abre sobre esta misma zona
    cardEl.style.right = window.innerWidth - r.right + 62 + 'px'; cardEl.style.bottom = window.innerHeight - r.bottom + 30 + 'px';
    cardEl.style.maxHeight = Math.max(200, Math.min(440, r.height - 150)) + 'px'; // no llega a las pestañas de filtro de arriba
    var nAl = visibleAlerts().length, names = { estado: 'Estado', avance: 'Avance', alertas: 'Alertas' };
    var h = '<div class="mo-h"><b>Operación de hoy</b><button type="button" data-mo-x="min" aria-label="Minimizar">' + (cardEl.classList.contains('is-min') ? '▢' : '—') + '</button></div>';
    h += '<div class="mo-tabs" role="tablist">' + tabs.map(function (k) { return '<button type="button" role="tab" data-mo-tab="' + k + '" aria-selected="' + (k === tab) + '">' + names[k] + (k === 'alertas' && nAl ? ' <i>' + nAl + '</i>' : '') + '</button>'; }).join('') + '</div><div class="mo-body">';
    if (tab === 'estado') h += bodyEstado(); else if (tab === 'avance') h += bodyAvance(); else h += bodyAlertas();
    cardEl.innerHTML = h + '</div>';
  }
  function bodyEstado() {
    var ids = Array.from(W.devices.keys()), tot = { trabajo: 0, transito: 0, ralenti: 0 };
    var rows = ids.map(function (id) {
      var t = day.t[id] || {}, r = rt[id], st = r && r.st || 'apagado', s = STATES[st];
      ['trabajo', 'transito', 'ralenti'].forEach(function (k) { tot[k] += t[k] || 0; });
      var sum = (t.trabajo || 0) + (t.transito || 0) + (t.ralenti || 0);
      var seg = ['trabajo', 'transito', 'ralenti'].map(function (k) { return '<i style="width:' + (sum ? (t[k] || 0) / sum * 100 : 0) + '%;background:' + STATES[k].c + '"></i>'; }).join('');
      return '<div class="mo-row" data-mo-go="' + id + '"><span class="mo-dot" style="background:' + s.c + '"></span><div><b>' + esc(devName(id)) + '</b><small>' + s.t + '</small><div class="mo-bar">' + seg + '</div>' +
        '<small>' + fmtDur(t.trabajo || 0) + ' trabajo · ' + fmtDur(t.transito || 0) + ' tránsito · ' + fmtDur(t.ralenti || 0) + ' parado</small></div></div>';
    }).join('');
    var all = tot.trabajo + tot.transito + tot.ralenti;
    return '<div class="mo-sum">Tiempo productivo de la flota: <b>' + (all >= 60000 ? Math.round(tot.trabajo / all * 100) + ' %' : '—') + '</b></div>' + rows +
      '<div class="mo-leg">' + ['trabajo', 'transito', 'ralenti', 'apagado', 'sinsenal'].map(function (k) { return '<span><i style="background:' + STATES[k].c + '"></i>' + STATES[k].t + '</span>'; }).join('') + '</div>' +
      '<div class="mo-note">Los tiempos se acumulan mientras el panel está abierto en este navegador.</div>';
  }
  function bodyAvance() {
    var rows = '', th = 0, td = 0;
    W.geofences.forEach(function (g) {
      var i = fenceInfo(g.id), n = cellSets[g.id] ? Object.keys(cellSets[g.id]).length : 0, done = Math.min(haFromCells(n, cfg.ancho), i.ha || 1e9), pct = i.ha ? Math.min(100, done / i.ha * 100) : 0;
      th += i.ha; td += done;
      rows += '<div class="mo-lot"><div><b>' + esc(i.name) + '</b><span>' + done.toFixed(1) + ' / ' + (i.ha ? i.ha.toFixed(1) : '—') + ' ha · ' + Math.round(pct) + ' %</span></div><div class="mo-bar"><i style="width:' + pct + '%;background:#2e9e4f"></i></div>' +
        '<small>Pendiente ' + Math.max(0, (i.ha || 0) - done).toFixed(1) + ' ha</small></div>';
    });
    return '<div class="mo-sum">Total: <b>' + td.toFixed(1) + ' ha</b> de ' + th.toFixed(1) + ' ha (' + (th ? Math.round(td / th * 100) : 0) + ' %)</div>' + (rows || '<div class="mo-note">No hay lotes.</div>') +
      '<div class="mo-note">Aproximado: cuenta una vez cada cuadro de ' + cfg.ancho + ' m recorrido trabajando (sin doble conteo en traslapes).</div>';
  }
  function bodyAlertas() {
    var all = visibleAlerts(), hor = all.filter(function (a) { return a.k === 'horario'; }), otras = all.filter(function (a) { return a.k !== 'horario'; });
    if (!all.length) return '<div class="mo-note">Sin alertas hoy.</div>';
    var MAXH = 6, l = otras.slice(0, 30).concat(hor.slice(0, MAXH));
    var html = l.map(function (a) {
      return '<div class="mo-row mo-al mo-' + a.sev + '" data-mo-pt="' + a.lat + ',' + a.lon + '"><span class="mo-ico">' + KIND[a.k].ico + '</span><div><b>' + esc(a.titulo) + '</b><small>' + esc(a.name) + ' · ' +
        new Date(a.t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) + '</small><small>' + esc(a.det) + '</small></div></div>';
    }).join('');
    // las de horario pueden ser decenas a la vez (p. ej. toda la flota de noche): se muestran las más recientes y el resto se resume
    if (hor.length > MAXH) html += '<div class="mo-note">y ' + (hor.length - MAXH) + ' tractores más fuera de horario (marcados con anillo morado punteado en el mapa).</div>';
    return html;
  }
  // Centra un punto en el área VISIBLE del mapa (el panel de la flota tapa la parte izquierda de #map).
  function focus(lat, lon, minZoom) {
    var z = Math.max(map.getZoom(), minZoom), side = document.getElementById('panel'), sr = side && !side.hidden ? side.getBoundingClientRect() : null;
    var off = sr && sr.width > 0 && window.innerWidth >= 760 ? sr.width / 2 : 0;
    map.flyTo(map.unproject(map.project([lat, lon], z).subtract([off, 0]), z), z, { duration: 0.8 });
  }
  function buildCard() {
    cardEl = document.createElement('div'); cardEl.id = 'mo-card'; cardEl.hidden = true; document.body.appendChild(cardEl);
    cardEl.addEventListener('click', function (e) {
      var t = e.target.closest('[data-mo-tab]'); if (t) { tab = t.dataset.moTab; paintCard(); return; }
      if (e.target.closest('[data-mo-x]')) { cardEl.classList.toggle('is-min'); paintCard(); return; }
      var g = e.target.closest('[data-mo-go]'); if (g) { var p = W.positions.get(+g.dataset.moGo); if (p) { focus(p.latitude, p.longitude, 16); window.__pf.select && window.__pf.select(+g.dataset.moGo); } return; }
      var q = e.target.closest('[data-mo-pt]'); if (q) { var c = q.dataset.moPt.split(',').map(Number); focus(c[0], c[1], 17); }
    });
  }

  /* ================= «Ajustes de mapa»: página completa (como Status) y enlace en el panel rápido ================= */
  var NUM = { vmin: [0, 30, 0.5], ancho: [1, 60, 1], fuelL: [1, 200, 1], vLote: [1, 40, 1], vTrans: [5, 80, 1] };
  // Los ajustes propios del mapa (unidades, lotes, etiquetas) viven dentro del bundle: la página los lee y los cambia
  // "pulsando" los botones de su panel rápido (#map-panel), que existe en el DOM aunque esté oculto.
  function bSw(k) { var b = document.querySelector('#map-panel [data-sw="' + k + '"]'); return b ? b.getAttribute('aria-checked') === 'true' : null; }
  function bSeg(k) { var b = document.querySelector('#map-panel [data-seg="' + k + '"][aria-pressed="true"]'); return b ? b.dataset.v : null; }
  function swBtn(attr, k, on, label) { return '<button type="button" class="mp-sw" role="switch" aria-checked="' + !!on + '" aria-label="' + esc(label) + '" ' + attr + '="' + k + '"></button>'; }
  function mrow(title, desc, ctl) { return '<div class="mp-row"><div><b>' + title + '</b>' + (desc ? '<small>' + desc + '</small>' : '') + '</div>' + ctl + '</div>'; }
  function par(k, t, u) { return '<label class="mp-par"><span>' + t + '</span><span><input type="number" data-mo-n="' + k + '" value="' + cfg[k] + '" min="' + NUM[k][0] + '" max="' + NUM[k][1] + '" step="' + NUM[k][2] + '"> ' + u + '</span></label>'; }
  function feat(k, title, desc, params) { return mrow(title, desc, swBtn('data-mp-sw', k, cfg[k], title)) + (cfg[k] && params ? '<div class="mp-pars">' + params + '</div>' : ''); }
  function pageHtml() {
    var mock = PF && PF.cfg && PF.cfg.useMock, un = bSeg('units'), fe = bSw('fences'), la = bSw('labels');
    var seg = function (v, t) { return '<button type="button" data-mp-seg="' + v + '" aria-pressed="' + (un === v) + '">' + t + '</button>'; };
    return '<div class="mp"><div class="mp-top"><h2>Ajustes de mapa</h2><span class="mp-sub">Unidades, visualización y operación de flota</span><button type="button" class="mp-btn ghost" data-mp-go="mapa">Ver el mapa</button></div>' +
      '<section class="mp-card"><h3>Unidades</h3>' + (un == null ? '<p class="mp-note">El mapa aún no está listo.</p>' : '<div class="mp-seg" role="group">' + seg('metric', 'Métrico (km, ha)') + seg('imperial', 'Imperial (mi, ac)') + '</div>') + '</section>' +
      '<section class="mp-card"><h3>Visualización</h3>' +
        mrow('Lotes y geocercas', 'Dibuja el contorno de cada lote sobre el mapa', fe == null ? '' : swBtn('data-mp-bsw', 'fences', fe, 'Lotes y geocercas')) +
        mrow('Etiquetas de unidades', 'Muestra el nombre junto a cada tractor', la == null ? '' : swBtn('data-mp-bsw', 'labels', la, 'Etiquetas de unidades')) + '</section>' +
      '<section class="mp-card"><h3>Operación de flota</h3>' +
        feat('estado', 'Estado de trabajo', 'Anillo de color por tractor: trabajando, en tránsito, parado, apagado o sin señal, con los tiempos del día.', par('vmin', 'Velocidad mínima de trabajo', 'km/h')) +
        feat('superficie', 'Superficie trabajada por lote', 'Hectáreas hechas y pendientes de cada lote (aproximado; sin contar dos veces los traslapes).', par('ancho', 'Ancho del implemento', 'm')) +
        feat('combustible', 'Alertas de combustible', 'Marca en el mapa una posible extracción (motor apagado), una caída brusca o una carga.', par('fuelL', 'Avisar si el nivel cambia', 'L')) +
        feat('velocidad', 'Alertas de velocidad', 'Marca el tramo donde un tractor pasa el límite.', par('vLote', 'Límite dentro de un lote', 'km/h') + par('vTrans', 'Límite en tránsito', 'km/h')) +
        feat('horario', 'Horario permitido', 'Avisa si un tractor avanza con el motor encendido fuera de horario. Admite turnos que cruzan la medianoche.',
          '<label class="mp-par"><span>Se permite trabajar de</span><span><input type="time" data-mo-t="hIni" value="' + cfg.hIni + '"> a <input type="time" data-mo-t="hFin" value="' + cfg.hFin + '"></span></label>') +
        mrow('Tarjeta «Operación de hoy»', 'Panel flotante a la derecha del mapa con Estado, Avance y Alertas.', swBtn('data-mp-sw', 'tarjeta', cfg.tarjeta, 'Tarjeta Operación de hoy')) + '</section>' +
      '<section class="mp-card"><h3>Datos de hoy</h3><p class="mp-note">Los tiempos, la superficie y las alertas se guardan en este navegador y se acumulan mientras el panel está abierto; se conservan 7 días.</p>' +
        '<div class="mp-acts">' + (mock ? '<button type="button" class="mp-btn" data-mp-act="demo" title="Solo con datos simulados">Cargar demostración</button>' : '') +
        '<button type="button" class="mp-btn ghost" data-mp-act="clear">Borrar datos de hoy</button><button type="button" class="mp-btn ghost" data-mp-act="reset">Restablecer operación</button></div></section></div>';
  }
  function renderPage() { var el = document.querySelector('.mp'); if (el) el.outerHTML = pageHtml(); }
  function setParam(i) {
    var k = i.dataset.moN || i.dataset.moT; if (!k) return false;
    if (i.dataset.moN) { var v = parseFloat(i.value), n = NUM[k]; if (!isFinite(v)) v = DEF[k]; cfg[k] = Math.min(n[1], Math.max(n[0], v)); i.value = cfg[k]; }
    else if (hm(i.value) != null) cfg[k] = i.value; else i.value = cfg[k];
    saveCfg(); apply(); return true;
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('.mp [data-mp-sw],.mp [data-mp-bsw],.mp [data-mp-seg],.mp [data-mp-act],.mp [data-mp-go]'); if (!t) return;
    var d = t.dataset;
    if (d.mpSw) { cfg[d.mpSw] = !cfg[d.mpSw]; saveCfg(); apply(); }
    else if (d.mpBsw) { var b = document.querySelector('#map-panel [data-sw="' + d.mpBsw + '"]'); if (b) b.click(); }
    else if (d.mpSeg) { var s = document.querySelector('#map-panel [data-seg="units"][data-v="' + d.mpSeg + '"]'); if (s) s.click(); }
    else if (d.mpGo) { if (window.__pfHome) window.__pfHome.show(d.mpGo); return; }
    else if (d.mpAct === 'reset') { for (var k in DEF) cfg[k] = DEF[k]; saveCfg(); apply(); }
    else if (d.mpAct === 'clear') { if (!confirm('¿Borrar los tiempos, la superficie y las alertas de hoy?')) return; clearDay(); }
    else if (d.mpAct === 'demo') demo();
    renderPage();
  });
  document.addEventListener('change', function (e) { if (e.target.closest && e.target.closest('.mp') && setParam(e.target)) renderPage(); });
  // Panel rápido (rueda dentada del mapa): solo un enlace a la página completa
  function settings(panel) {
    var old = panel.querySelector('.mo-sec'); if (old) old.remove();
    var sec = document.createElement('div'); sec.className = 'jd-sec mo-sec';
    sec.innerHTML = '<div class="eyebrow">Operación de flota</div><button type="button" class="jd-reset" data-mo-open>Abrir ajustes de operación…</button>';
    panel.insertBefore(sec, panel.lastElementChild);
    sec.querySelector('[data-mo-open]').addEventListener('click', function () { if (window.__pfHome) window.__pfHome.show('ajustes'); });
  }

  function apply() { if (!map) return; paintMap(); paintCard(); }

  function clearDay() {
    day = { d: ymd(new Date()), t: {}, cells: {}, alerts: [], seq: 0 }; cellSets = {}; rt = {}; clearMap(); dirty = true; saveDay(true); apply();
  }

  /* ================= demostración (solo con datos simulados) ================= */
  function demo() {
    var rnd = Math.random, ids = Array.from(W.devices.keys());
    ids.forEach(function (id) {
      var h = 3600000;
      day.t[id] = { trabajo: (2 + rnd() * 3) * h, transito: (0.3 + rnd() * 0.6) * h, ralenti: (0.2 + rnd() * 0.5) * h, apagado: 0 };
    });
    W.geofences.forEach(function (g) {
      var i = fenceInfo(g.id); if (!i.poly) return; var la = i.poly.map(function (q) { return q[0]; }), lo = i.poly.map(function (q) { return q[1]; });
      var a0 = Math.min.apply(0, la), a1 = Math.max.apply(0, la), o0 = Math.min.apply(0, lo), o1 = Math.max.apply(0, lo), frac = 0.25 + rnd() * 0.6;
      var cs = cellSets[g.id] || (cellSets[g.id] = {}), step = cfg.ancho / 110540, nrows = Math.floor((a1 - a0) / step * frac);
      for (var k = 0; k < nrows; k++) markSegment(cs, [a0 + k * step, o0], [a0 + k * step, o1], cfg.ancho);
    });
    var any = Array.from(W.positions.entries());
    if (any.length) {
      var p = any[0][1], id0 = any[0][0], now = Date.now();
      addAlert({ k: 'combustible', sev: 'crit', dev: id0, name: devName(id0), lat: p.latitude + 0.0004, lon: p.longitude - 0.0005, t: now - 25 * 60000, titulo: 'Posible extracción de combustible', det: '−38 L · ahora 142 L · motor apagado (demostración)' });
      var p2 = any[Math.min(1, any.length - 1)], id1 = p2[0];
      addAlert({ k: 'velocidad', sev: 'warn', dev: id1, name: devName(id1), lat: p2[1].latitude, lon: p2[1].longitude, t: now - 70 * 60000, titulo: 'Exceso de velocidad', lim: cfg.vTrans, max: 41,
        pts: [[p2[1].latitude, p2[1].longitude], [p2[1].latitude + 0.0006, p2[1].longitude + 0.0009], [p2[1].latitude + 0.0011, p2[1].longitude + 0.0021]], det: '41 km/h (límite ' + cfg.vTrans + ' en tránsito) (demostración)' });
    }
    dirty = true; saveDay(true); apply();
  }

  /* ================= estilos ================= */
  function css() {
    var s = document.createElement('style'); s.id = 'mo-css';
    s.textContent =
      '.mo-sec .mo-par{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 6px 10px;padding:6px 10px;border-radius:8px;background:rgb(var(--raise));font-size:13px;color:rgb(var(--muted))}' +
      '.mo-sec .mo-par input{width:64px;padding:3px 6px;border:1px solid rgb(var(--line));border-radius:6px;background:rgb(var(--panel));color:rgb(var(--fg));font:inherit;text-align:right}' +
      '.mo-sec .mo-par>span:last-child{flex:none;white-space:nowrap}' +
      '.mo-sec .mo-par input[type=time]{width:96px;text-align:center}' +
      '.mo-sec .mo-par-t{flex-direction:column;align-items:stretch;gap:6px}.mo-sec .mo-par-t>span:last-child{display:flex;align-items:center;justify-content:space-between;gap:8px}.mo-sec .mo-par-t em{font-style:normal}' +
      '.mo-sec .mo-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.mo-sec .mo-acts .jd-reset{flex:1 1 auto}' +
      '#mo-card{position:fixed;z-index:1200;width:300px;overflow:auto;border:1px solid rgb(var(--line));border-radius:10px;background:rgb(var(--panel));color:rgb(var(--fg));box-shadow:0 6px 22px rgb(0 0 0/.22);font-size:13px}' +
      '#mo-card.is-min .mo-tabs,#mo-card.is-min .mo-body{display:none}' +
      '#mo-card .mo-h{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgb(var(--line))}' +
      '#mo-card .mo-h button{width:26px;height:26px;border-radius:6px;color:rgb(var(--muted))}' +
      '#mo-card .mo-tabs{display:flex;border-bottom:1px solid rgb(var(--line))}' +
      '#mo-card .mo-tabs button{flex:1;padding:7px 4px;font-size:12px;font-weight:600;color:rgb(var(--muted));border-bottom:2px solid transparent}' +
      '#mo-card .mo-tabs button[aria-selected=true]{color:rgb(var(--fg));border-bottom-color:rgb(var(--jd-green))}' +
      '#mo-card .mo-tabs i{font-style:normal;margin-left:3px;padding:0 6px;border-radius:9px;background:#d33a3a;color:#fff;font-size:11px}' +
      '#mo-card .mo-body{padding:6px 12px 10px}#mo-card small{display:block;color:rgb(var(--muted));font-size:11.5px;line-height:1.35}' +
      '#mo-card .mo-sum{padding:6px 0 8px}#mo-card .mo-note{margin-top:8px;color:rgb(var(--muted));font-size:11.5px}' +
      '#mo-card .mo-row{display:flex;gap:9px;padding:7px 0;border-top:1px solid rgb(var(--line));cursor:pointer}' +
      '#mo-card .mo-row>div{flex:1;min-width:0}#mo-card .mo-dot{flex:none;width:11px;height:11px;margin-top:4px;border-radius:50%}' +
      '#mo-card .mo-bar{display:flex;height:6px;margin:4px 0;border-radius:3px;overflow:hidden;background:rgb(var(--line))}#mo-card .mo-bar i{display:block;height:100%}' +
      '#mo-card .mo-lot{padding:7px 0;border-top:1px solid rgb(var(--line))}#mo-card .mo-lot>div:first-child{display:flex;justify-content:space-between;gap:8px}' +
      '#mo-card .mo-leg{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:8px;font-size:11px;color:rgb(var(--muted))}#mo-card .mo-leg i{display:inline-block;width:8px;height:8px;margin-right:4px;border-radius:50%}' +
      '#mo-card .mo-al .mo-ico{flex:none;font-size:16px}#mo-card .mo-crit b{color:#d33a3a}' +
      '.mo-pinwrap{background:none;border:0}.mo-pin{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#fff;border:3px solid var(--c);box-shadow:0 2px 6px rgb(0 0 0/.35);font-size:14px}' +
      '.mo-pop{font-size:13px}.mo-pop .mo-m{color:#666;font-size:12px}';
    document.head.appendChild(s);
    // Página «Ajustes de mapa» (dentro del marco Debian: se antepone #home-view, igual que statuspage.js, porque el marco resetea márgenes con selectores de id)
    var p = document.createElement('style'); p.id = 'mp-css';
    p.textContent = [
      '.mp{max-width:820px;margin:0 auto;padding:6px 14px 34px;font-size:15px;line-height:1.45}.mp *{box-sizing:border-box}.mp h2,.mp h3{margin:0;font-family:inherit}',
      '.mp-top{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 14px;margin:14px 0 8px}.mp-top h2{font-size:24px}.mp-sub{color:#6d7081;font-size:14px}.mp-top .mp-btn{margin-left:auto}',
      '.mp-card{border:1px solid rgba(128,128,128,.32);border-radius:8px;background:rgba(128,128,128,.05);margin:14px 0;padding:6px 18px 14px}.mp-card h3{font-size:17px;padding:10px 0 4px}',
      '.mp-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 0;border-top:1px solid rgba(128,128,128,.22)}.mp-card h3+.mp-row{border-top:0}.mp-row b{display:block;font-size:15px}',
      '.mp small,.mp .mp-note{color:#6d7081;font-size:13px}.mp .mp-note{margin:4px 0 8px}',
      '.mp-sw{position:relative;flex:none;width:44px;height:24px;border:0;border-radius:12px;background:rgba(128,128,128,.55);cursor:pointer;transition:background .15s}',
      '.mp-sw:after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .15s}',
      '.mp-sw[aria-checked=true]{background:#2e9e4f}.mp-sw[aria-checked=true]:after{transform:translateX(20px)}.mp-sw:focus-visible{outline:2px solid #a80030;outline-offset:2px}',
      '.mp-pars{margin:-2px 0 8px 14px;padding:4px 12px;border-left:3px solid #2e9e4f;background:rgba(128,128,128,.07);border-radius:0 6px 6px 0}',
      '.mp-par{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0;font-size:14px}.mp-par>span:last-child{flex:none;white-space:nowrap}',
      '.mp input{padding:5px 8px;border:1px solid #cfd2de!important;border-radius:4px;background:#fff!important;color:#1d1e20!important;font:14px inherit;text-align:right}.mp input[type=number]{width:84px}.mp input[type=time]{width:110px;text-align:center}',
      '.mp-seg{display:inline-flex;border:1px solid rgba(128,128,128,.5);border-radius:6px;overflow:hidden;margin:6px 0 4px}.mp-seg button{padding:8px 16px;border:0;background:transparent;color:inherit;font:600 14px inherit;cursor:pointer}.mp-seg button+button{border-left:1px solid rgba(128,128,128,.5)}',
      '.mp-seg button[aria-pressed=true]{background:#a80030;color:#fff}',
      '.mp-acts{display:flex;flex-wrap:wrap;gap:8px}.mp-btn{border:1px solid #a80030;background:#a80030;color:#fff;padding:8px 14px;border-radius:4px;cursor:pointer;font:600 13px inherit}.mp-btn.ghost{background:transparent;color:#a80030}.mp-btn:hover{opacity:.9}',
      '@media(max-width:640px){\n.mp-row{align-items:flex-start}\n.mp-par{flex-wrap:wrap}\n}',
    ].join('\n').replace(/(^|[}\n])\s*([^{}@\n][^{}]*)\{/g, function (m, pre, sel) { return pre + sel.split(',').map(function (x) { return '#home-view ' + x.trim(); }).join(',') + '{'; });
    document.head.appendChild(p);
  }

  /* ================= arranque ================= */
  api.settings = settings; api.pageHtml = function () { return pageHtml(); }; api.focus = function (lat, lon, z) { if (map) focus(lat, lon, z || 16); };
  api.demo = function () { demo(); }; api.clear = clearDay; api.cfg = function () { return cfg; };
  // Resumen del día de un grupo de tractores (lo usa la sección Tractores): tiempos en ms y alertas visibles.
  api.opStats = function (ids) {
    var o = { trabajo: 0, transito: 0, ralenti: 0, apagado: 0, alertas: 0 };
    ids.forEach(function (id) { var t = day.t[id]; if (t) { o.trabajo += t.trabajo || 0; o.transito += t.transito || 0; o.ralenti += t.ralenti || 0; o.apagado += t.apagado || 0; } });
    day.alerts.forEach(function (a) { if (ids.indexOf(a.dev) >= 0 && alertOn(a)) o.alertas++; });
    return o;
  };
  api.stateInfo = function (id) { var r = rt[id]; return r && r.st ? STATES[r.st] : null; };
  api.state = function () { return { day: day, rt: rt, cells: cellSets }; }; api.tick = function () { onState.t = 0; onState(); };
  css(); // los estilos de la página de Ajustes y del panel deben existir aunque el mapa aún no esté listo
  var wait = setInterval(function () {
    if (!window.L || !window.__pf || !window.__mapx || !window.__mapx.map) return;
    clearInterval(wait); L = window.L; PF = window.__pf; W = PF.w; map = window.__mapx.map;
    buildCard(); PF.subscribe(onState); window.addEventListener('resize', paintCard); setInterval(paintCard, 800);
    onState.t = 0; onState(); paintCard();
  }, 400);
})();
