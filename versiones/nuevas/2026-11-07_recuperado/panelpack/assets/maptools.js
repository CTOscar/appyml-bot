/* maptools.js — herramientas interactivas del mapa (complemento, sin recompilar).
 * Un botón nuevo en la botonera del mapa (debajo de «Herramientas del mapa») abre un menú con:
 *   Inspector  · clic en un punto: coordenadas, lote, tractor más cercano, distancia y tiempo desde el tractor seleccionado.
 *   Radio      · clic + deslizador (0.1–10 km): qué tractores hay dentro y a qué distancia, en vivo.
 *   Notas      · pines propios (pozo, bodega, taller, combustible, riesgo…), arrastrables; se guardan en este navegador.
 *   Buscar     · tractor, lote o nota; vuela hasta él.  (atajo: tecla «/»)
 *   Compartir  · copia un enlace que restaura capa, centro, zoom y tractor seleccionado.
 * Esc sale de la herramienta activa. Usa window.L, window.__pf y window.__mapx.map (instancia del mapa que captura mapx.js).
 * Unidades: m / km. Nada se envía a ningún servidor; las notas viven en localStorage (pf-mapnotes-v1). */
(function () {
  'use strict';

  var PAN = { autoPanPaddingTopLeft: [420, 90], autoPanPaddingBottomRight: [400, 60] }; // el panel de la flota (izq.) y la tarjeta «Operación de hoy» (der.) tapan el mapa
  var NK = 'pf-mapnotes-v1', V_ETA = 15; // km/h supuestos para el tiempo estimado si el tractor está parado
  var TIPOS = { pozo: ['💧', 'Pozo / bomba'], bodega: ['🏠', 'Bodega'], taller: ['🔧', 'Taller'], diesel: ['⛽', 'Combustible'], riesgo: ['🚧', 'Obstáculo / riesgo'], otro: ['📍', 'Otro'] };
  var LAYERS = ['map', 'sat', 'hyb'];

  /* ================= lógica pura (se prueba con patch/maptools.test.cjs) ================= */
  function distM(a, b) { // haversine; a y b = [lat, lon]
    var R = 6371000, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
    var h = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function inPoly(p, poly) { // p = [lat, lon]; poly = [[lat, lon]...]
    var x = p[1], y = p[0], c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][1], yi = poly[i][0], xj = poly[j][1], yj = poly[j][0];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function wkt(area) {
    var m = /\(\((.*)\)\)/.exec(area || ''); if (!m) return null;
    return m[1].split(',').map(function (p) { var q = p.trim().split(/\s+/); return [+q[0], +q[1]]; });
  }
  function polyHa(poly) {
    if (!poly || poly.length < 3) return 0;
    var l0 = poly.reduce(function (s, q) { return s + q[0]; }, 0) / poly.length * Math.PI / 180, s = 0;
    var xy = poly.map(function (q) { return [q[1] * 111320 * Math.cos(l0), q[0] * 110540]; });
    xy.forEach(function (q, k) { var r = xy[(k + 1) % xy.length]; s += q[0] * r[1] - r[0] * q[1]; });
    return Math.abs(s) / 2 / 1e4;
  }
  // items = [{ id, lat, lon, ... }] -> el más cercano a (lat, lon): { item, d } o null
  function nearest(items, lat, lon) {
    var best = null; items.forEach(function (it) { var d = distM([lat, lon], [it.lat, it.lon]); if (!best || d < best.d) best = { item: it, d: d }; }); return best;
  }
  // items dentro de rM metros, ordenados por distancia: [{ item, d }]
  function within(items, lat, lon, rM) {
    var out = []; items.forEach(function (it) { var d = distM([lat, lon], [it.lat, it.lon]); if (d <= rM) out.push({ item: it, d: d }); });
    return out.sort(function (a, b) { return a.d - b.d; });
  }
  function fmtDist(m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 2 : 1) + ' km'; }
  function etaMin(dM, kmh) { return kmh > 0 ? (dM / 1000) / kmh * 60 : Infinity; }
  function fmtEta(min) { if (!isFinite(min)) return '—'; if (min < 1) return '< 1 min'; if (min < 60) return Math.round(min) + ' min'; return Math.floor(min / 60) + ' h ' + Math.round(min % 60) + ' min'; }
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function matches(text, q) { var t = norm(text), toks = norm(q).split(/\s+/).filter(Boolean); return toks.length > 0 && toks.every(function (k) { return t.indexOf(k) >= 0; }); }
  // Enlace para compartir: "capa,lat,lon,zoom[,tID]"
  function encodeView(o) {
    var s = [o.layer, (+o.lat).toFixed(5), (+o.lon).toFixed(5), Math.round(o.zoom)]; if (o.sel != null) s.push('t' + o.sel); return s.join(',');
  }
  function decodeView(str) {
    var p = String(str || '').split(','); if (p.length < 4) return null;
    var layer = p[0], lat = +p[1], lon = +p[2], zoom = +p[3], sel = null;
    if (LAYERS.indexOf(layer) < 0 || !isFinite(lat) || !isFinite(lon) || !isFinite(zoom)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || zoom < 1 || zoom > 21) return null;
    if (p[4] != null && p[4] !== '') { var m = /^t(\d+)$/.exec(p[4]); if (!m) return null; sel = +m[1]; }
    return { layer: layer, lat: lat, lon: lon, zoom: Math.round(zoom), sel: sel };
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var root = typeof window !== 'undefined' ? window : globalThis;
  var api = (root.__maptools = root.__maptools || {});
  api._t = { distM: distM, inPoly: inPoly, wkt: wkt, polyHa: polyHa, nearest: nearest, within: within, fmtDist: fmtDist, etaMin: etaMin, fmtEta: fmtEta, norm: norm, matches: matches, encodeView: encodeView, decodeView: decodeView, TIPOS: TIPOS };
  if (typeof document === 'undefined') return; // en pruebas de Node solo se exporta la lógica pura

  /* ================= estado ================= */
  var L = null, PF = null, W = null, map = null;
  var mode = null;                       // null | 'inspect' | 'radio' | 'notas'
  var lay = { insp: null, radio: null, ring: null, line: null, pulse: null, draft: null };
  var inspPt = null, radio = { c: null, km: 1, circle: null, mk: null };
  var notes = [], noteMk = {}, gNotes = null;
  var els = {};
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ================= utilidades de pantalla ================= */
  function area() {
    var m = document.getElementById('map'); if (!m) return null; var r = m.getBoundingClientRect(), side = document.getElementById('panel'), left = r.left;
    if (side && !side.hidden) { var sr = side.getBoundingClientRect(); if (sr.width > 0 && sr.right > r.left && sr.right < r.right - 340) left = Math.max(left, sr.right); }
    return { r: r, left: left };
  }
  function mapVisible() { // el mapa sigue en el DOM debajo de las páginas del marco; solo cuenta si se ve
    var a = area(); if (!a) return false; var hv = document.getElementById('home-view'), enPagina = hv && !hv.hidden && !hv.classList.contains('dh-map');
    return a.r.width > 300 && a.r.height > 260 && !enPagina;
  }
  function toast(msg) {
    if (!els.toast) return; els.toast.textContent = msg; els.toast.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { els.toast.hidden = true; }, 2600);
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try { var t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); var ok = document.execCommand('copy'); t.remove(); return ok; } catch (e) { return false; }
  }
  function fly(lat, lon, z) { if (window.__mapops && window.__mapops.focus) window.__mapops.focus(lat, lon, z); else map.flyTo([lat, lon], Math.max(map.getZoom(), z), { duration: 0.8 }); }
  function pulse(lat, lon) {
    if (lay.pulse) { map.removeLayer(lay.pulse); lay.pulse = null; }
    lay.pulse = L.circleMarker([lat, lon], { radius: 24, color: '#ffcf33', weight: 4, fill: false, className: 'mt-pulse', interactive: false }).addTo(map);
    clearTimeout(pulse.t); pulse.t = setTimeout(function () { if (lay.pulse) { map.removeLayer(lay.pulse); lay.pulse = null; } }, 3200);
  }

  /* ================= datos del panel ================= */
  function tractors() {
    var out = []; W.positions.forEach(function (p, id) { var d = W.devices.get(id) || {}; out.push({ id: id, name: d.name || 'Tractor ' + id, lat: p.latitude, lon: p.longitude, speed: (p.speed || 0) * 1.852, attrs: d.attributes || {} }); });
    return out;
  }
  function stateOf(id) {
    var s = window.__mapops && window.__mapops.stateInfo ? window.__mapops.stateInfo(id) : null;
    if (s) return s; var k = PF.At(id); return { running: { t: 'En marcha', c: '#2e9e4f' }, idle: { t: 'Apagado', c: '#8a8f98' }, nosignal: { t: 'Sin señal', c: '#d33a3a' } }[k] || { t: '—', c: '#8a8f98' };
  }
  function fenceAt(lat, lon) {
    for (var i = 0; i < W.geofences.length; i++) {
      var g = W.geofences[i], poly = wkt(g.area); if (poly && inPoly([lat, lon], poly)) { var a = g.attributes && Number(g.attributes.superficie); return { id: g.id, name: g.name, ha: a > 0 ? a : polyHa(poly) }; }
    }
    return null;
  }

  /* ================= modos ================= */
  var MODE_TXT = { inspect: 'Inspector · haz clic en cualquier punto del mapa', radio: 'Radio de alcance · haz clic para colocar el centro', notas: 'Notas · haz clic donde quieras dejar un pin' };
  function clearLayer(k) { if (lay[k]) { map.removeLayer(lay[k]); lay[k] = null; } }
  function setMode(m) {
    if (m === mode) m = null;
    if (m && $('#ctl-measure') && $('#ctl-measure').getAttribute('aria-pressed') === 'true') $('#ctl-measure').click(); // la medición del panel también usa el clic del mapa
    ['insp', 'line', 'draft'].forEach(clearLayer); map.closePopup();
    if (mode === 'radio' && m !== 'radio') radioOff();
    mode = m;
    document.getElementById('map').classList.toggle('mt-tool', !!m);
    document.querySelectorAll('#mt-menu [data-mt-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mtTool === m)); });
    els.btn.setAttribute('aria-pressed', String(!!m));
    els.bar.hidden = !m; if (m) els.barTxt.textContent = MODE_TXT[m];
    if (m === 'radio') radioOn();
    place();
  }
  function onMapClick(e) {
    if (!mode) return;
    if (mode === 'inspect') inspect(e.latlng);
    else if (mode === 'radio') { radioCenter([e.latlng.lat, e.latlng.lng]); }
    else if (mode === 'notas') noteDraft(e.latlng);
  }

  /* ---------- Inspector ---------- */
  function inspect(ll) {
    var lat = ll.lat, lon = ll.lng; inspPt = { lat: lat, lon: lon };
    clearLayer('insp'); clearLayer('line');
    lay.insp = L.marker([lat, lon], { icon: L.divIcon({ className: 'mt-xh-wrap', html: '<span class="mt-xh"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, keyboard: false }).addTo(map);
    var f = fenceAt(lat, lon), ts = tractors(), near = nearest(ts, lat, lon), sel = W.selected != null ? ts.filter(function (t) { return t.id === W.selected; })[0] : null;
    var h = '<div class="mt-pop"><b>Punto seleccionado</b><div class="mt-m">' + lat.toFixed(5) + ', ' + lon.toFixed(5) + '</div>' +
      '<div>' + (f ? 'Lote: <b>' + esc(f.name) + '</b> · ' + f.ha.toFixed(1) + ' ha' : 'Fuera de los lotes') + '</div>' +
      (near ? '<div>Tractor más cercano: <b>' + esc(near.item.name) + '</b> · ' + fmtDist(near.d) + '</div>' : '');
    if (sel) {
      var d = distM([sel.lat, sel.lon], [lat, lon]), kmh = sel.speed > 2 ? sel.speed : V_ETA;
      h += '<div class="mt-sel">Desde <b>' + esc(sel.name) + '</b> (seleccionado): <b>' + fmtDist(d) + '</b> · ≈ ' + fmtEta(etaMin(d, kmh)) + ' a ' + Math.round(kmh) + ' km/h</div>';
      lay.line = L.polyline([[sel.lat, sel.lon], [lat, lon]], { color: '#2f6fd6', weight: 3, dashArray: '8 8', opacity: 0.9, interactive: false }).addTo(map);
    }
    h += '<div class="mt-act"><button type="button" data-mt-act="copy">Copiar</button><button type="button" data-mt-act="gmaps">Google Maps</button><button type="button" data-mt-act="note-here">Nota aquí</button><button type="button" data-mt-act="radio-here">Radio aquí</button></div></div>';
    L.popup(L.extend({ closeOnClick: false }, PAN)).setLatLng([lat, lon]).setContent(h).openOn(map);
  }

  /* ---------- Radio de alcance ---------- */
  function radioOn() { els.radio.hidden = false; if (radio.c) { radioDraw(); els.barTxt.textContent = 'Radio de alcance · arrastra el centro o haz clic para moverlo'; } else $('#mt-rlist', els.radio).innerHTML = '<p class="mt-hint">Haz clic en el mapa para colocar el centro.</p>'; }
  function radioOff() { els.radio.hidden = true; clearLayer('radio'); clearLayer('ring'); if (radio.mk) { map.removeLayer(radio.mk); radio.mk = null; } radio.circle = null; }
  function radioCenter(c) { radio.c = c; radioDraw(); if (els.barTxt) els.barTxt.textContent = 'Radio de alcance · arrastra el centro o haz clic para moverlo'; }
  function radioDraw() {
    var c = radio.c, r = radio.km * 1000;
    if (!radio.circle) {
      radio.circle = L.circle(c, { radius: r, color: '#2f6fd6', weight: 2, dashArray: '6 6', fillColor: '#2f6fd6', fillOpacity: 0.08, interactive: false }).addTo(map); lay.radio = radio.circle;
      radio.mk = L.marker(c, { draggable: true, zIndexOffset: 900, icon: L.divIcon({ className: 'mt-xh-wrap', html: '<span class="mt-xh mt-xh-c"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map);
      radio.mk.on('drag', function (e) { radio.c = [e.latlng.lat, e.latlng.lng]; radio.circle.setLatLng(radio.c); radioList(); });
      radio.mk.on('dragend', radioList);
    } else { radio.circle.setLatLng(c); radio.circle.setRadius(r); radio.mk.setLatLng(c); }
    radioList();
  }
  function radioList() {
    if (!radio.c || mode !== 'radio') return;
    var ts = tractors(), ins = within(ts, radio.c[0], radio.c[1], radio.km * 1000);
    $('#mt-rkm', els.radio).textContent = radio.km.toFixed(1) + ' km';
    $('#mt-rcount', els.radio).textContent = ins.length + ' de ' + ts.length + ' tractores dentro';
    $('#mt-rlist', els.radio).innerHTML = ins.length ? ins.slice(0, 40).map(function (o) {
      var s = stateOf(o.item.id); return '<li data-mt-go="' + o.item.id + '"><span class="mt-dot" style="background:' + s.c + '"></span><b>' + esc(o.item.name) + '</b><small>' + esc(s.t) + '</small><em>' + fmtDist(o.d) + '</em></li>';
    }).join('') + (ins.length > 40 ? '<li class="mt-more">y ' + (ins.length - 40) + ' más…</li>' : '') : '<li class="mt-more">Ningún tractor dentro de este radio.</li>';
    clearLayer('ring'); var g = L.layerGroup(); ins.forEach(function (o) { L.circleMarker([o.item.lat, o.item.lon], { radius: 19, color: '#ffcf33', weight: 4, fill: false, interactive: false }).addTo(g); }); lay.ring = g.addTo(map);
  }

  /* ---------- Notas ---------- */
  function loadNotes() { try { var a = JSON.parse(localStorage.getItem(NK) || '[]'); notes = Array.isArray(a) ? a.filter(function (n) { return n && isFinite(n.lat) && isFinite(n.lon); }) : []; } catch (e) { notes = []; } }
  function saveNotes() { try { localStorage.setItem(NK, JSON.stringify(notes)); } catch (e) { toast('No se pudo guardar la nota en este navegador'); } updNoteCount(); }
  function updNoteCount() { var i = $('#mt-menu [data-mt-tool="notas"] i'); if (i) i.textContent = notes.length ? notes.length : ''; }
  function noteIcon(n) { var t = TIPOS[n.tipo] || TIPOS.otro; return L.divIcon({ className: 'mo-pinwrap', html: '<span class="mo-pin" style="--c:#7a4db3">' + t[0] + '</span>', iconSize: [28, 28], iconAnchor: [14, 14] }); }
  function noteHtml(n) {
    var t = TIPOS[n.tipo] || TIPOS.otro;
    return '<div class="mt-pop"><b>' + t[0] + ' ' + esc(n.titulo || t[1]) + '</b><div class="mt-m">' + esc(t[1]) + ' · ' + n.lat.toFixed(5) + ', ' + n.lon.toFixed(5) + '</div>' + (n.nota ? '<div class="mt-nota">' + esc(n.nota) + '</div>' : '') +
      '<div class="mt-act"><button type="button" data-mt-act="note-edit" data-id="' + n.id + '">Editar</button><button type="button" data-mt-act="note-del" data-id="' + n.id + '">Eliminar</button></div></div>';
  }
  function drawNote(n) {
    if (noteMk[n.id]) { gNotes.removeLayer(noteMk[n.id]); delete noteMk[n.id]; }
    var m = L.marker([n.lat, n.lon], { icon: noteIcon(n), draggable: true, zIndexOffset: 700, title: n.titulo || '' });
    m.bindPopup(function () { return noteHtml(n); }, PAN);
    m.on('dragend', function () { var p = m.getLatLng(); n.lat = p.lat; n.lon = p.lng; saveNotes(); });
    gNotes.addLayer(m); noteMk[n.id] = m;
  }
  function formHtml(n, isNew) {
    var opts = Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '"' + ((n.tipo || 'otro') === k ? ' selected' : '') + '>' + TIPOS[k][0] + ' ' + TIPOS[k][1] + '</option>'; }).join('');
    return '<div class="mt-pop mt-form"><b>' + (isNew ? 'Nueva nota' : 'Editar nota') + '</b>' +
      '<label>Título<input data-mt-f="titulo" maxlength="60" value="' + esc(n.titulo || '') + '" placeholder="Ej. Pozo 3"></label>' +
      '<label>Tipo<select data-mt-f="tipo">' + opts + '</select></label>' +
      '<label>Nota<textarea data-mt-f="nota" maxlength="300" rows="3" placeholder="Detalles, contacto, horario…">' + esc(n.nota || '') + '</textarea></label>' +
      '<div class="mt-act"><button type="button" data-mt-act="note-save" data-id="' + (n.id || '') + '">Guardar</button><button type="button" data-mt-act="note-cancel">Cancelar</button></div></div>';
  }
  function openForm(n, isNew) {
    var p = L.popup(L.extend({ closeOnClick: false, autoClose: false, minWidth: 240 }, PAN)).setLatLng([n.lat, n.lon]).setContent(formHtml(n, isNew)).openOn(map);
    var el = p.getElement(); if (el) { ['keydown', 'keyup', 'keypress'].forEach(function (k) { el.addEventListener(k, function (e) { e.stopPropagation(); }); }); setTimeout(function () { var i = el.querySelector('[data-mt-f="titulo"]'); if (i) i.focus(); }, 50); }
    p._mtDraft = { lat: n.lat, lon: n.lon }; return p;
  }
  function noteDraft(ll) {
    clearLayer('draft');
    lay.draft = L.marker(ll, { icon: L.divIcon({ className: 'mt-xh-wrap', html: '<span class="mt-xh"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false }).addTo(map);
    openForm({ lat: ll.lat, lon: ll.lng, tipo: 'otro' }, true);
  }
  function popupField(k) { var e = document.querySelector('.leaflet-popup [data-mt-f="' + k + '"]'); return e ? e.value.trim() : ''; }
  function noteSave(id) {
    var tipo = popupField('tipo') || 'otro', titulo = popupField('titulo'), nota = popupField('nota'), n;
    if (id) { n = notes.filter(function (x) { return String(x.id) === String(id); })[0]; if (!n) return; n.tipo = tipo; n.titulo = titulo; n.nota = nota; }
    else {
      var pos = lay.draft ? lay.draft.getLatLng() : (inspPt ? { lat: inspPt.lat, lng: inspPt.lon } : map.getCenter());
      n = { id: Date.now() + Math.floor(Math.random() * 1000), lat: pos.lat, lon: pos.lng, tipo: tipo, titulo: titulo, nota: nota, t: Date.now() }; notes.push(n);
    }
    clearLayer('draft'); map.closePopup(); drawNote(n); saveNotes(); toast('Nota guardada');
  }
  function noteDel(id) {
    var i = notes.findIndex(function (x) { return String(x.id) === String(id); }); if (i < 0) return;
    if (!confirm('¿Eliminar la nota «' + (notes[i].titulo || 'sin título') + '»?')) return;
    if (noteMk[notes[i].id]) { gNotes.removeLayer(noteMk[notes[i].id]); delete noteMk[notes[i].id]; } notes.splice(i, 1); saveNotes(); map.closePopup();
  }

  /* ---------- Buscar ---------- */
  var sIdx = [], sSel = 0;
  function searchIndex(q) {
    var out = [];
    tractors().forEach(function (t) { var txt = t.name + ' ' + (t.attrs.marca || '') + ' ' + (t.attrs.modelo || '') + ' ' + (t.attrs.nivel || ''); if (matches(txt, q)) out.push({ k: 'tractor', id: t.id, ico: '🚜', t: t.name, s: [t.attrs.marca, t.attrs.modelo].filter(Boolean).join(' ') || 'Tractor', lat: t.lat, lon: t.lon }); });
    W.geofences.forEach(function (g) { if (matches(g.name, q)) { var poly = wkt(g.area); if (poly) out.push({ k: 'lote', id: g.id, ico: '▦', t: g.name, s: 'Lote · ' + polyHa(poly).toFixed(1) + ' ha', poly: poly }); } });
    notes.forEach(function (n) { if (matches((n.titulo || '') + ' ' + (n.nota || '') + ' ' + (TIPOS[n.tipo] || TIPOS.otro)[1], q)) out.push({ k: 'nota', id: n.id, ico: (TIPOS[n.tipo] || TIPOS.otro)[0], t: n.titulo || (TIPOS[n.tipo] || TIPOS.otro)[1], s: 'Nota', lat: n.lat, lon: n.lon }); });
    return out.slice(0, 9);
  }
  function searchPaint() {
    var q = els.sInput.value; sIdx = q.trim() ? searchIndex(q) : []; if (sSel >= sIdx.length) sSel = 0;
    els.sRes.innerHTML = sIdx.length ? sIdx.map(function (r, i) { return '<li data-mt-si="' + i + '" aria-selected="' + (i === sSel) + '"><span>' + r.ico + '</span><b>' + esc(r.t) + '</b><small>' + esc(r.s) + '</small></li>'; }).join('') : (q.trim() ? '<li class="mt-more">Sin resultados</li>' : '');
  }
  function searchOpen() { els.search.hidden = false; els.bar.hidden = true; place(); els.sInput.value = ''; sSel = 0; searchPaint(); setTimeout(function () { els.sInput.focus(); }, 30); }
  function searchClose() { els.search.hidden = true; els.sInput.blur(); els.bar.hidden = !mode; }
  function searchGo(i) {
    var r = sIdx[i]; if (!r) return; searchClose();
    if (r.k === 'tractor') { PF.select && PF.select(r.id); fly(r.lat, r.lon, 16); pulse(r.lat, r.lon); }
    else if (r.k === 'lote') { var b = L.latLngBounds(r.poly.map(function (p) { return [p[0], p[1]]; })); map.flyToBounds(b.pad(0.25), { duration: 0.8 }); }
    else if (r.k === 'nota') { fly(r.lat, r.lon, 17); pulse(r.lat, r.lon); setTimeout(function () { if (noteMk[r.id]) noteMk[r.id].openPopup(); }, 900); }
  }

  /* ---------- Compartir ---------- */
  function currentView() { var c = map.getCenter(); return { layer: LAYERS.indexOf(W.layer) >= 0 ? W.layer : 'map', lat: c.lat, lon: c.lng, zoom: map.getZoom(), sel: W.selected }; }
  function shareUrl() { return location.origin + location.pathname + '?mv=' + encodeURIComponent(encodeView(currentView())); }
  function share() {
    var url = shareUrl();
    copyText(url).then(function (ok) { if (ok) toast('Enlace copiado: abre esta misma vista del mapa'); else window.prompt('Copia este enlace:', url); });
  }
  function restoreFromUrl() {
    var raw = null; try { raw = new URLSearchParams(location.search).get('mv'); } catch (e) {} var v = decodeView(raw); if (!v) return;
    var tries = 0, t = setInterval(function () {
      if (++tries > 60) return clearInterval(t); if (!window.__pfHome || !W.devices.size) return; clearInterval(t);
      window.__pfHome.show('mapa');
      setTimeout(function () {
        var b = $('#maptype-menu [data-layer="' + v.layer + '"]'); if (b && W.layer !== v.layer) b.click();
        map.setView([v.lat, v.lon], v.zoom, { animate: false }); if (v.sel != null && W.devices.has(v.sel)) PF.select && PF.select(v.sel);
        try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
        toast('Vista compartida restaurada');
      }, 900);
    }, 300);
  }

  /* ================= interfaz ================= */
  function place() {
    var a = area(), vis = a && mapVisible();
    if (els.btn) els.btn.style.display = vis ? '' : 'none';
    if (!vis) { if (mode) setMode(null); els.bar.hidden = true; els.radio.hidden = true; els.search.hidden = true; els.menu.hidden = true; return; }
    var cx = (a.left + a.r.right) / 2;
    [els.bar, els.search].forEach(function (e) { e.style.left = cx + 'px'; e.style.top = a.r.top + 56 + 'px'; });
    els.radio.style.left = a.left + 12 + 'px'; els.radio.style.bottom = window.innerHeight - a.r.bottom + 30 + 'px'; els.radio.style.maxHeight = Math.max(180, a.r.height - 150) + 'px';
    els.toast.style.left = cx + 'px'; els.toast.style.bottom = window.innerHeight - a.r.bottom + 28 + 'px';
    els.bar.hidden = !mode || !els.search.hidden; els.radio.hidden = mode !== 'radio'; // la barra se oculta mientras el buscador usa ese mismo lugar
  }
  function build() {
    var host = $('#mx-btn') ? $('#mx-btn').closest('li') : null; if (!host) host = $('.map-controls li:last-child');
    host.classList.add('jd-fly');
    els.btn = document.createElement('button'); els.btn.type = 'button'; els.btn.id = 'mt-btn'; els.btn.className = 'jd-btn'; els.btn.title = 'Herramientas interactivas'; els.btn.setAttribute('aria-label', 'Herramientas interactivas'); els.btn.setAttribute('aria-expanded', 'false'); els.btn.setAttribute('aria-pressed', 'false');
    els.btn.innerHTML = '<svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/></svg>';
    els.menu = document.createElement('ul'); els.menu.id = 'mt-menu'; els.menu.className = 'jd-flyout'; els.menu.hidden = true; els.menu.style.cssText = 'top:auto;bottom:0';
    els.menu.innerHTML = '<li><button type="button" data-mt-tool="inspect" aria-pressed="false">Inspector</button></li><li><button type="button" data-mt-tool="radio" aria-pressed="false">Radio</button></li>' +
      '<li><button type="button" data-mt-tool="notas" aria-pressed="false">Notas <i></i></button></li><li><button type="button" data-mt-act="search">Buscar</button></li><li><button type="button" data-mt-act="share">Compartir vista</button></li>';
    host.appendChild(els.btn); host.appendChild(els.menu);

    var mk = function (tag, id, cls, html) { var e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; if (html) e.innerHTML = html; e.hidden = true; document.body.appendChild(e); return e; };
    els.bar = mk('div', 'mt-bar', '', '<span id="mt-bar-t"></span><button type="button" data-mt-act="exit">Salir (Esc)</button>'); els.barTxt = $('#mt-bar-t');
    els.radio = mk('div', 'mt-radio', '', '<div class="mt-rh"><b>Radio de alcance</b><button type="button" data-mt-act="exit" aria-label="Cerrar">✕</button></div><div class="mt-rs"><div class="mt-rr"><span>Radio</span><b id="mt-rkm">1.0 km</b></div><input id="mt-range" type="range" min="0.1" max="10" step="0.1" value="1" aria-label="Radio en kilómetros"></div><div id="mt-rcount" class="mt-rc"></div><ul id="mt-rlist"></ul>');
    els.search = mk('div', 'mt-search', '', '<input type="search" placeholder="Buscar tractor, lote o nota…" autocomplete="off" aria-label="Buscar en el mapa"><ul class="mt-res" role="listbox"></ul>'); els.sInput = $('input', els.search); els.sRes = $('.mt-res', els.search);
    els.toast = mk('div', 'mt-toast', '', ''); els.toast.setAttribute('role', 'status');

    els.btn.addEventListener('click', function (e) { e.stopPropagation(); var open = els.menu.hidden; els.menu.hidden = !open; els.btn.setAttribute('aria-expanded', String(open)); });
    document.addEventListener('pointerdown', function (e) { if (!els.menu.hidden && !e.target.closest('#mt-menu, #mt-btn')) { els.menu.hidden = true; els.btn.setAttribute('aria-expanded', 'false'); } });
    els.menu.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; els.menu.hidden = true; els.btn.setAttribute('aria-expanded', 'false');
      if (b.dataset.mtTool) setMode(b.dataset.mtTool); else if (b.dataset.mtAct === 'search') searchOpen(); else if (b.dataset.mtAct === 'share') share();
    });
    $('#mt-range', els.radio).addEventListener('input', function (e) { radio.km = +e.target.value; if (radio.c) { radio.circle.setRadius(radio.km * 1000); } radioList(); $('#mt-rkm', els.radio).textContent = radio.km.toFixed(1) + ' km'; });
    els.radio.addEventListener('click', function (e) { var li = e.target.closest('[data-mt-go]'); if (li) { var id = +li.dataset.mtGo, p = W.positions.get(id); if (p) { PF.select && PF.select(id); fly(p.latitude, p.longitude, 16); pulse(p.latitude, p.longitude); } } });
    els.sInput.addEventListener('input', function () { sSel = 0; searchPaint(); });
    els.sInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sSel = Math.min(sIdx.length - 1, sSel + 1); searchPaint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sSel = Math.max(0, sSel - 1); searchPaint(); }
      else if (e.key === 'Enter') { e.preventDefault(); searchGo(sSel); }
      else if (e.key === 'Escape') { e.preventDefault(); searchClose(); }
      e.stopPropagation();
    });
    els.sRes.addEventListener('click', function (e) { var li = e.target.closest('[data-mt-si]'); if (li) searchGo(+li.dataset.mtSi); });
    document.addEventListener('pointerdown', function (e) { if (!els.search.hidden && !e.target.closest('#mt-search, #mt-menu, #mt-btn')) searchClose(); });

    // acciones dentro de popups y barras
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mt-act]'); if (!b || b.closest('#mt-menu')) return; var a = b.dataset.mtAct;
      if (a === 'exit') setMode(null);
      else if (a === 'copy' && inspPt) copyText(inspPt.lat.toFixed(5) + ', ' + inspPt.lon.toFixed(5)).then(function (ok) { toast(ok ? 'Coordenadas copiadas' : 'No se pudo copiar'); });
      else if (a === 'gmaps' && inspPt) window.open('https://www.google.com/maps?q=' + inspPt.lat.toFixed(6) + ',' + inspPt.lon.toFixed(6), '_blank', 'noopener');
      else if (a === 'note-here' && inspPt) { var p = inspPt; setMode('notas'); noteDraft({ lat: p.lat, lng: p.lon }); }
      else if (a === 'radio-here' && inspPt) { var q = inspPt; setMode('radio'); radioCenter([q.lat, q.lon]); }
      else if (a === 'note-save') noteSave(b.dataset.id);
      else if (a === 'note-cancel') { clearLayer('draft'); map.closePopup(); }
      else if (a === 'note-edit') { var n = notes.filter(function (x) { return String(x.id) === b.dataset.id; })[0]; if (n) { map.closePopup(); openForm(n, false); } }
      else if (a === 'note-del') noteDel(b.dataset.id);
    });
    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '') || (e.target && e.target.isContentEditable);
      if (e.key === 'Escape') { if (!els.search.hidden) searchClose(); else if (mode) setMode(null); }
      else if (e.key === '/' && !typing && mapVisible() && !e.ctrlKey && !e.metaKey) { e.preventDefault(); searchOpen(); }
    });
    // La medición del panel también usa el clic del mapa. Se mira DESPUÉS de que el bundle cambie su estado (escucha normal + setTimeout), no antes.
    var ms = $('#ctl-measure'); if (ms) ms.addEventListener('click', function () { setTimeout(function () { if (mode && ms.getAttribute('aria-pressed') === 'true') setMode(null); }, 0); });
  }

  function css() {
    var s = document.createElement('style'); s.id = 'mt-css';
    s.textContent =
      '#map.mt-tool,#map.mt-tool .leaflet-interactive{cursor:crosshair!important}' +
      '#mt-menu button i{font-style:normal;margin-left:5px;padding:0 6px;border-radius:9px;background:rgb(var(--jd-yellow));color:#000;font-size:11px}#mt-menu button i:empty{display:none}' +
      '#mt-bar[hidden],#mt-radio[hidden],#mt-search[hidden],#mt-toast[hidden]{display:none!important}' + // un display propio anularía el atributo hidden
      '#mt-bar{position:fixed;z-index:1250;transform:translateX(-50%);display:flex;align-items:center;gap:12px;max-width:92vw;padding:7px 8px 7px 14px;border-radius:8px;background:rgb(var(--jd-green));color:#fff;box-shadow:0 4px 14px rgb(0 0 0/.3);font-size:13px;font-weight:600}' +
      '#mt-bar button{padding:5px 11px;border-radius:5px;background:rgb(255 255 255/.2);color:#fff;font:600 12px inherit}#mt-bar button:hover{background:rgb(255 255 255/.32)}' +
      '#mt-radio{position:fixed;z-index:1250;width:290px;overflow:auto;border:1px solid rgb(var(--line));border-radius:10px;background:rgb(var(--panel));color:rgb(var(--fg));box-shadow:0 6px 22px rgb(0 0 0/.25);font-size:13px}' +
      '#mt-radio .mt-rh{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgb(var(--line))}#mt-radio .mt-rh button{width:26px;height:26px;border-radius:6px;color:rgb(var(--muted))}' +
      '#mt-radio .mt-rs{display:grid;gap:6px;padding:10px 12px 4px}#mt-radio .mt-rr{display:flex;justify-content:space-between;align-items:baseline}#mt-radio input[type=range]{width:100%;accent-color:rgb(var(--jd-green))}' +
      '#mt-radio .mt-rc{padding:2px 12px 8px;color:rgb(var(--muted));font-size:12px}#mt-radio ul{list-style:none;margin:0;padding:0}' +
      '#mt-radio li{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:2px 8px;padding:7px 12px;border-top:1px solid rgb(var(--line));cursor:pointer}#mt-radio li:hover{background:rgb(var(--raise))}' +
      '#mt-radio li small{grid-column:2;color:rgb(var(--muted));font-size:11.5px}#mt-radio li em{grid-row:1;grid-column:3;font-style:normal;font-weight:700}#mt-radio li .mt-dot{grid-row:1/3;width:10px;height:10px;border-radius:50%}' +
      '#mt-radio li.mt-more,#mt-radio .mt-hint{display:block;padding:10px 12px;color:rgb(var(--muted));cursor:default;margin:0}' +
      '#mt-search{position:fixed;z-index:1260;transform:translateX(-50%);width:min(420px,92vw);border-radius:10px;background:rgb(var(--panel));color:rgb(var(--fg));box-shadow:0 8px 26px rgb(0 0 0/.32);overflow:hidden}' +
      '#mt-search input{width:100%;padding:12px 14px;border:0;border-bottom:1px solid rgb(var(--line));background:transparent;color:inherit;font:15px inherit;outline:none}' +
      '#mt-search ul{list-style:none;margin:0;padding:0;max-height:300px;overflow:auto}#mt-search li{display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:8px;padding:9px 14px;cursor:pointer;font-size:14px}' +
      '#mt-search li[aria-selected=true],#mt-search li:hover{background:rgb(var(--raise))}#mt-search li small{color:rgb(var(--muted));font-size:12px}#mt-search li.mt-more{display:block;color:rgb(var(--muted));cursor:default}' +
      '#mt-toast{position:fixed;z-index:1270;transform:translateX(-50%);max-width:90vw;padding:9px 16px;border-radius:8px;background:#1d1e20;color:#fff;font-size:13px;box-shadow:0 4px 14px rgb(0 0 0/.35)}' +
      '.mt-xh-wrap{background:none;border:0}.mt-xh{display:block;width:22px;height:22px;border:3px solid #2f6fd6;border-radius:50%;background:rgb(255 255 255/.55);box-shadow:0 0 0 2px #fff}.mt-xh-c{border-color:#e08a00}' +
      '.mt-pulse{animation:mt-pulse 1s ease-out 3}@keyframes mt-pulse{0%{stroke-opacity:1;stroke-width:5}100%{stroke-opacity:0;stroke-width:1}}' +
      '.mt-pop{font-size:13px;min-width:200px}.mt-pop .mt-m{color:#666;font-size:12px;margin:2px 0 6px}.mt-pop .mt-sel{margin-top:6px;padding:6px 8px;border-radius:6px;background:#e8f0fd}.mt-pop .mt-nota{margin:6px 0;white-space:pre-wrap}' +
      '.mt-act{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.mt-act button{padding:5px 10px;border:1px solid #367c2b;border-radius:5px;background:#fff;color:#367c2b;font:600 12px inherit;cursor:pointer}.mt-act button:hover{background:#367c2b;color:#fff}' +
      '.mt-form label{display:grid;gap:3px;margin-top:8px;font-size:12px;color:#555}.mt-form input,.mt-form select,.mt-form textarea{width:100%;padding:5px 7px;border:1px solid #bbb;border-radius:5px;font:13px inherit;color:#111;background:#fff}';
    document.head.appendChild(s);
  }

  /* ================= arranque ================= */
  api.shareUrl = function () { return shareUrl(); }; api.setMode = function (m) { setMode(m); }; api.notes = function () { return notes; }; api.mode = function () { return mode; };
  api.inspect = function (lat, lon) { setMode('inspect'); inspect({ lat: lat, lng: lon }); }; api.radio = function (lat, lon, km) { if (mode !== 'radio') setMode('radio'); if (km) { radio.km = km; $('#mt-range', els.radio).value = km; } radioCenter([lat, lon]); };
  api.search = function (q) { searchOpen(); els.sInput.value = q; searchPaint(); return sIdx.map(function (r) { return r.k + ':' + r.t; }); }; api.searchGo = function (i) { searchGo(i == null ? 0 : i); };
  var wait = setInterval(function () {
    if (!window.L || !window.__pf || !window.__mapx || !window.__mapx.map || !document.getElementById('mx-btn')) return;
    clearInterval(wait); L = window.L; PF = window.__pf; W = PF.w; map = window.__mapx.map;
    css(); build(); loadNotes(); gNotes = L.layerGroup().addTo(map); notes.forEach(drawNote); updNoteCount();
    map.on('click', onMapClick);
    PF.subscribe(function () { if (mode === 'radio' && radio.c) { var n = Date.now(); if (n - (radioList.t || 0) > 1000) { radioList.t = n; radioList(); } } });
    window.addEventListener('resize', place); setInterval(place, 800); place(); restoreFromUrl();
  }, 400);
})();
