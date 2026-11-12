/* tractores.js — página «Tractores»: tarjetas por marca y modelo (John Deere, New Holland…) con el estado en vivo
 * y la operación del día de cada grupo (home.js la monta como la página 'tractores', igual que Status y Lotes;
 * Inicio conserva sus noticias).
 * Datos: window.__pf (dispositivos con attributes.marca / attributes.modelo / attributes.nivel) y window.__mapops (operación de hoy).
 * El catálogo de abajo es REFERENCIAL (potencia nominal aproximada): confírmalo con la ficha del fabricante o del distribuidor. */
(function () {
  'use strict';

  var CATALOG = {
    'john-deere': { name: 'John Deere', mono: 'JD', logo: '/brands/john-deere.png', models: {
      '5075E': { tipo: 'Tractor utilitario', hp: 75 },
      '5090E': { tipo: 'Tractor utilitario', hp: 90 },
      '6110J': { tipo: 'Tractor utilitario', hp: 110 },
    } },
    'new-holland': { name: 'New Holland', mono: 'NH', logo: '/brands/new-holland.png', models: {
      'TT4.75': { tipo: 'Tractor utilitario', hp: 75 },
      'T6.110': { tipo: 'Tractor utilitario', hp: 110 },
    } },
  };
  var ORDER = ['john-deere', 'new-holland'];
  var ST = { running: ['En marcha', '#2e9e4f'], idle: ['Apagado', '#8a8f98'], nosignal: ['Sin señal', '#d33a3a'] };

  /* ================= lógica pura (se prueba con patch/tractores.test.cjs) ================= */
  function slug(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtH(ms) { var m = Math.round((ms || 0) / 60000); return m >= 60 ? (m / 60).toFixed(1).replace(/\.0$/, '') + ' h' : m + ' min'; }

  // Agrupa dispositivos por marca y modelo. Devuelve [{ key, marca, brand, modelo, tipo, hp, ids:[...] }] ordenado por marca (JD, NH, otras), potencia y modelo.
  function groupDevices(devs) {
    var map = {}, out = [];
    devs.forEach(function (d) {
      var a = d.attributes || {}, marca = slug(a.marca) || 'otra', modelo = String(a.modelo || '').trim() || 'Sin modelo', key = marca + '|' + modelo;
      var g = map[key];
      if (!g) {
        var b = CATALOG[marca], m = b && b.models[modelo];
        g = map[key] = { key: key, marca: marca, brand: b ? b.name : (a.marca ? String(a.marca) : 'Otra marca'), mono: b ? b.mono : '··', logo: b ? b.logo : '', modelo: modelo, tipo: m ? m.tipo : 'Tractor', hp: m ? m.hp : 0, ids: [] };
        out.push(g);
      }
      g.ids.push(d.id);
    });
    out.sort(function (x, y) {
      var ox = ORDER.indexOf(x.marca), oy = ORDER.indexOf(y.marca); ox = ox < 0 ? 99 : ox; oy = oy < 0 ? 99 : oy;
      return ox - oy || x.brand.localeCompare(y.brand) || (x.hp || 999) - (y.hp || 999) || x.modelo.localeCompare(y.modelo);
    });
    return out;
  }
  function brandsOf(groups) { var s = {}, r = []; groups.forEach(function (g) { if (!s[g.marca]) { s[g.marca] = 1; r.push({ marca: g.marca, name: g.brand }); } }); return r; }

  var root = typeof window !== 'undefined' ? window : globalThis;
  var api = (root.__tractores = root.__tractores || {});
  api._t = { slug: slug, groupDevices: groupDevices, brandsOf: brandsOf, fmtH: fmtH, CATALOG: CATALOG };
  if (typeof document === 'undefined') return; // en pruebas de Node solo se exporta la lógica pura

  /* ================= estado y datos en vivo ================= */
  var S = { brand: 'todos', model: null };
  var PF = function () { return window.__pf; };
  function W() { return PF() && PF().w; }
  function groups() { var w = W(); return w ? groupDevices(Array.from(w.devices.values())) : []; }
  function live(g) {
    var o = { running: 0, idle: 0, nosignal: 0, h: 0 }, w = W(), pf = PF();
    g.ids.forEach(function (id) { var s = pf.At(id); o[s] = (o[s] || 0) + 1; o.h += (w.engineToday.get(id) || 0); });
    var lv = { A: 0, B: 0 }; g.ids.forEach(function (id) { var d = w.devices.get(id), n = d && d.attributes && d.attributes.nivel; if (lv[n] != null) lv[n]++; });
    o.lv = lv; o.op = window.__mapops && window.__mapops.opStats ? window.__mapops.opStats(g.ids) : null; return o;
  }

  /* ================= HTML ================= */
  function logoHtml(g) { return '<span class="tr-logo"><b>' + esc(g.mono) + '</b>' + (g.logo ? '<img src="' + esc(g.logo) + '" alt="' + esc(g.brand) + '" loading="lazy" onerror="this.remove()">' : '') + '</span>'; }
  function opHtml(l) {
    var op = l.op; if (!op) return '';
    var sum = op.trabajo + op.transito + op.ralenti, cols = { trabajo: '#2e9e4f', transito: '#2f6fd6', ralenti: '#f0a500' };
    var bar = ['trabajo', 'transito', 'ralenti'].map(function (k) { return '<i style="width:' + (sum ? op[k] / sum * 100 : 0) + '%;background:' + cols[k] + '"></i>'; }).join('');
    return '<div class="tr-op"><div class="tr-bar" aria-hidden="true">' + bar + '</div><small>Hoy: ' + fmtH(op.trabajo) + ' trabajo · ' + fmtH(op.transito) + ' tránsito · ' + fmtH(op.ralenti) + ' parado</small>' +
      (op.alertas ? '<small class="tr-warn">⚠ ' + op.alertas + (op.alertas === 1 ? ' alerta hoy' : ' alertas hoy') + '</small>' : '') + '</div>';
  }
  function cardHtml(g, sel) {
    var l = live(g), n = g.ids.length;
    return '<article class="tr-card' + (sel ? ' is-sel' : '') + '" tabindex="0" role="button" aria-pressed="' + !!sel + '" data-tr-model="' + esc(g.key) + '">' +
      '<header>' + logoHtml(g) + '<div><h3>' + esc(g.modelo) + '</h3><small>' + esc(g.brand) + ' · ' + esc(g.tipo) + (g.hp ? ' · ' + g.hp + ' hp aprox.' : '') + '</small></div></header>' +
      '<div class="tr-n"><b>' + n + '</b> unidad' + (n === 1 ? '' : 'es') + '<span>Nivel A ' + l.lv.A + ' · Nivel B ' + l.lv.B + '</span></div>' +
      '<div class="tr-st"><span style="--c:' + ST.running[1] + '">' + l.running + ' en marcha</span><span style="--c:' + ST.idle[1] + '">' + l.idle + ' apagados</span><span style="--c:' + ST.nosignal[1] + '">' + l.nosignal + ' sin señal</span></div>' +
      '<small class="tr-h">Horas de motor hoy: <b>' + (l.h / 36e5).toFixed(1) + ' h</b></small>' + opHtml(l) + '</article>';
  }
  function tabsHtml(gs) {
    var bs = brandsOf(gs), all = [{ marca: 'todos', name: 'Todos' }].concat(bs);
    if (all.every(function (b) { return b.marca !== S.brand; })) S.brand = 'todos';
    return '<div class="tr-tabs" role="tablist">' + all.map(function (b) {
      var n = b.marca === 'todos' ? gs.reduce(function (s, g) { return s + g.ids.length; }, 0) : gs.filter(function (g) { return g.marca === b.marca; }).reduce(function (s, g) { return s + g.ids.length; }, 0);
      return '<button type="button" role="tab" aria-selected="' + (b.marca === S.brand) + '" data-tr-brand="' + esc(b.marca) + '">' + esc(b.name) + ' <i>' + n + '</i></button>';
    }).join('') + '</div>';
  }
  function gridHtml(gs) {
    var vis = gs.filter(function (g) { return S.brand === 'todos' || g.marca === S.brand; });
    if (!vis.length) return '<p class="tr-empty">No hay tractores para mostrar.</p>';
    return '<div class="tr-grid">' + vis.map(function (g) { return cardHtml(g, S.model === g.key); }).join('') + '</div>';
  }
  function detailHtml(gs) {
    var g = gs.filter(function (x) { return x.key === S.model; })[0]; if (!g) return '';
    var w = W(), pf = PF(), mo = window.__mapops;
    var rows = g.ids.map(function (id) {
      var d = w.devices.get(id) || {}, p = w.positions.get(id), s = pf.At(id), a = d.attributes || {}, fid = p && p.geofenceIds && p.geofenceIds[0];
      var lote = fid ? (w.geofences.filter(function (f) { return f.id === fid; })[0] || {}).name : '—';
      var op = mo && mo.opStats ? mo.opStats([id]) : null, si = mo && mo.stateInfo ? mo.stateInfo(id) : null, lab = si ? si : { t: ST[s][0], c: ST[s][1] };
      return '<tr data-tr-unit="' + id + '" tabindex="0"><td><b>' + esc(d.name || '#' + id) + '</b></td><td>' + esc(a.nivel || '—') + '</td><td><span class="tr-dot" style="background:' + lab.c + '"></span>' + esc(lab.t) + '</td><td>' + esc(lote || '—') +
        '</td><td>' + ((w.engineToday.get(id) || 0) / 36e5).toFixed(1) + ' h</td><td>' + (op ? fmtH(op.trabajo) : '—') + '</td></tr>';
    }).join('');
    return '<div class="tr-detail"><h3>' + esc(g.brand) + ' ' + esc(g.modelo) + ' <small>' + g.ids.length + ' unidades · clic en una fila para verla en el mapa</small></h3>' +
      '<div class="tr-scroll"><table><thead><tr><th>Tractor</th><th>Nivel</th><th>Estado</th><th>Lote</th><th>Motor hoy</th><th>Trabajo hoy</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }
  function kpis(gs) {
    var total = 0, run = 0; gs.forEach(function (g) { total += g.ids.length; g.ids.forEach(function (id) { if (PF().At(id) === 'running') run++; }); });
    var k = function (v, l) { return '<div class="tr-k"><b>' + v + '</b><span>' + l + '</span></div>'; };
    return '<div class="tr-kpis">' + k(total, 'Tractores') + k(run, 'En marcha') + k(gs.length, 'Modelos') + k(brandsOf(gs).length, 'Marcas') + '</div>';
  }
  function pageHtml() {
    var gs = groups();
    return '<div class="tr tr-pg"><div class="tr-top"><h2>Tractores</h2><span class="tr-sub">Marcas y modelos de la flota · estado y operación de hoy</span></div>' + kpis(gs) + tabsHtml(gs) + gridHtml(gs) + detailHtml(gs) +
      '<p class="tr-note">Potencia nominal aproximada; confirma las fichas con el fabricante o el distribuidor. Las horas de operación se acumulan mientras el panel está abierto.</p></div>';
  }
  function refresh() { var pg = document.querySelector('.tr-pg'); if (pg) pg.outerHTML = pageHtml(); }

  /* ================= eventos ================= */
  function openOnMap(id) {
    if (window.__pfHome) window.__pfHome.show('mapa');
    setTimeout(function () {
      try { var p = W().positions.get(id); window.__pf.select(id); if (p && window.__mapops && window.__mapops.focus) window.__mapops.focus(p.latitude, p.longitude, 16); } catch (e) { /* sin mapa */ }
    }, 250);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tr-brand]');
    if (b) { S.brand = b.dataset.trBrand; S.model = null; refresh(); return; }
    var u = e.target.closest('[data-tr-unit]'); if (u) { openOnMap(+u.dataset.trUnit); return; }
    var c = e.target.closest('[data-tr-model]');
    if (c) { S.model = c.dataset.trModel === S.model ? null : c.dataset.trModel; refresh(); }
  });
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.tr-card, .tr-detail tr')) { e.preventDefault(); e.target.click(); } });

  /* ================= estilos (con #home-view delante: el marco Debian resetea márgenes con selectores de id) ================= */
  var css = document.createElement('style');
  css.textContent = [
    '.tr{max-width:1100px;margin:0 auto;padding:6px 14px 28px;font-size:15px;line-height:1.45}.tr *{box-sizing:border-box}.tr h2,.tr h3{margin:0;font-family:inherit}',
    '.tr-top{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 14px;margin:14px 0 10px}.tr-top h2{font-size:24px}.tr-sub{color:#6d7081;font-size:14px}',
    '.tr-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:8px 0 14px}.tr-k{border:1px solid rgba(128,128,128,.32);border-radius:6px;padding:10px 14px;background:rgba(128,128,128,.05)}.tr-k b{display:block;font-size:26px;line-height:1.1}.tr-k span{font-size:13px;color:#6d7081}',
    '.tr-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px}',
    '.tr-tabs button{border:1px solid rgba(128,128,128,.4);border-radius:99px;padding:6px 14px;background:transparent;color:inherit;font:600 13px inherit;cursor:pointer}.tr-tabs button i{font-style:normal;margin-left:4px;padding:0 7px;border-radius:99px;background:rgba(128,128,128,.22);font-size:12px}',
    '.tr-tabs button[aria-selected=true]{background:#a80030;border-color:#a80030;color:#fff}.tr-tabs button[aria-selected=true] i{background:rgba(255,255,255,.28)}',
    '.tr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;text-align:left}',
    '.tr-card{display:flex;flex-direction:column;gap:9px;border:1px solid rgba(128,128,128,.34);border-radius:8px;padding:14px 16px;background:rgba(128,128,128,.05);cursor:pointer;transition:box-shadow .15s,transform .15s,border-color .15s}',
    '.tr-card:hover,.tr-card:focus-visible{box-shadow:0 6px 18px rgba(0,0,0,.16);transform:translateY(-2px);outline:none;border-color:#a80030}.tr-card.is-sel{border-color:#a80030;box-shadow:0 0 0 2px #a80030 inset}',
    '.tr-card header{display:flex;align-items:center;gap:12px}.tr-card h3{font-size:22px;line-height:1.1}.tr-card small{display:block;color:#6d7081;font-size:12.5px}',
    '.tr-logo{position:relative;flex:none;display:grid;place-items:center;width:64px;height:48px;border-radius:6px;background:#fff;border:1px solid rgba(128,128,128,.3);overflow:hidden}.tr-logo b{font-size:16px;color:#555}',
    '.tr-logo img{position:absolute;inset:3px;width:calc(100% - 6px);height:calc(100% - 6px);object-fit:contain;background:#fff}',
    '.tr-n{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;font-size:14px}.tr-n b{font-size:28px;line-height:1}.tr-n span{margin-left:auto;font-size:12px;color:#6d7081}',
    '.tr-st{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px}.tr-st span:before{content:"";display:inline-block;width:9px;height:9px;margin-right:5px;border-radius:50%;background:var(--c)}',
    '.tr-op{border-top:1px solid rgba(128,128,128,.28);padding-top:8px}.tr-bar{display:flex;height:7px;margin-bottom:5px;border-radius:4px;overflow:hidden;background:rgba(128,128,128,.28)}.tr-bar i{display:block;height:100%}.tr-warn{color:#d33a3a!important;font-weight:700}',
    '.tr-note{margin-top:22px;padding:9px 13px;border:1px dashed rgba(128,128,128,.5);border-radius:6px;font-size:12.5px;color:#6d7081}.tr-empty{padding:18px;text-align:center;color:#6d7081}',
    '.tr-detail{margin-top:22px}.tr-detail h3{font-size:19px;margin-bottom:8px}.tr-detail h3 small{font-weight:400;font-size:13px;color:#6d7081;margin-left:8px}.tr-scroll{overflow:auto;border:1px solid rgba(128,128,128,.32);border-radius:6px}',
    '.tr-detail table{width:100%;border-collapse:collapse;font-size:14px}.tr-detail th,.tr-detail td{padding:8px 12px;text-align:left;border-bottom:1px solid rgba(128,128,128,.22);white-space:nowrap}.tr-detail th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#6d7081;background:rgba(128,128,128,.07)}',
    '.tr-detail tbody tr{cursor:pointer}.tr-detail tbody tr:hover,.tr-detail tbody tr:focus-visible{background:rgba(168,0,48,.08);outline:none}.tr-dot{display:inline-block;width:9px;height:9px;margin-right:6px;border-radius:50%}',
    '@media(max-width:640px){\n.tr-kpis{grid-template-columns:repeat(2,1fr)}\n.tr-grid{grid-template-columns:1fr}\n}',
  ].join('\n');
  css.textContent = css.textContent.replace(/(^|[}\n])\s*([^{}@\n][^{}]*)\{/g, function (m, pre, sel) { return pre + sel.split(',').map(function (s) { return '#home-view ' + s.trim(); }).join(',') + '{'; });
  document.head.appendChild(css);

  api.pageHtml = pageHtml; api.refresh = refresh; api.groups = groups;
})();
