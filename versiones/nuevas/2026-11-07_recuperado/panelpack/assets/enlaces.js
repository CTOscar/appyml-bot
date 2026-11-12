/* enlaces.js — página «Enlaces» del marco Debian (igual que Status, Tractores y Ajustes de mapa).
 * Reemplaza al menú desplegable «Enlaces del proyecto»: todos los botones [data-links-btn] del panel abren esta página.
 * Datos: window.__pfLinks = [{ title, icon, links: [{ label, note, href, image }] }], que el bundle expone desde su constante interna
 * (parche de patch/mapops-hook.cjs). Los enlaces se editan en el bundle (constante `_d`); la página los lee tal cual. */
(function () {
  'use strict';

  var ICO = { 'Rastreadores': '📡', 'Sensores': '⛽', 'Instalación': '🔧', 'Plataforma': '🧩', 'Otros': '↗' };

  /* ================= lógica pura (se prueba con patch/enlaces.test.cjs) ================= */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  // Solo se aceptan enlaces http(s): nada de javascript:, data: ni rutas raras en un href.
  function safeHref(u) { return /^https?:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '#'; }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  // Aplana las categorías en una lista y filtra por categoría (title o 'todos') y texto (todas las palabras, sin acentos).
  function flatten(data) {
    var out = []; (Array.isArray(data) ? data : []).forEach(function (c) { (c && Array.isArray(c.links) ? c.links : []).forEach(function (l) { if (l && l.href) out.push({ cat: String(c.title || 'Otros'), label: l.label || hostOf(l.href), note: l.note || '', href: l.href, image: l.image || '' }); }); });
    return out;
  }
  function filterLinks(items, cat, q) {
    var toks = norm(q).split(/\s+/).filter(Boolean);
    return items.filter(function (it) {
      if (cat && cat !== 'todos' && it.cat !== cat) return false;
      var hay = norm(it.label + ' ' + it.note + ' ' + hostOf(it.href) + ' ' + it.cat);
      return toks.every(function (k) { return hay.indexOf(k) >= 0; });
    });
  }
  function categories(items) { var seen = {}, out = []; items.forEach(function (it) { if (!seen[it.cat]) { seen[it.cat] = 0; out.push(it.cat); } seen[it.cat]++; }); return out.map(function (c) { return { cat: c, n: seen[c] }; }); }

  var root = typeof window !== 'undefined' ? window : globalThis;
  var api = (root.__enlaces = root.__enlaces || {});
  api._t = { esc: esc, norm: norm, safeHref: safeHref, hostOf: hostOf, flatten: flatten, filterLinks: filterLinks, categories: categories };
  if (typeof document === 'undefined') return; // en pruebas de Node solo se exporta la lógica pura

  /* ================= página ================= */
  var S = { cat: 'todos', q: '' };
  function items() { return flatten(window.__pfLinks); }
  function cardHtml(it) {
    var img = it.image ? '<img src="' + esc(it.image) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">' : '';
    return '<a class="en-card" href="' + esc(safeHref(it.href)) + '" target="_blank" rel="noopener noreferrer">' +
      '<span class="en-img"><b aria-hidden="true">' + (ICO[it.cat] || '↗') + '</b>' + img + '<i aria-hidden="true">↗</i></span>' +
      '<span class="en-txt"><span class="en-name">' + esc(it.label) + '</span><small>' + esc(it.note) + '</small><code>' + esc(hostOf(it.href)) + '</code></span></a>';
  }
  function gridHtml(all) {
    var vis = filterLinks(all, S.cat, S.q);
    return vis.length ? '<div class="en-grid">' + vis.map(cardHtml).join('') + '</div>' : '<p class="en-empty">Ningún enlace coincide con «' + esc(S.q) + '».</p>';
  }
  function tabsHtml(all) {
    var cs = categories(all); if (cs.every(function (c) { return c.cat !== S.cat; }) && S.cat !== 'todos') S.cat = 'todos';
    var tab = function (id, name, n) { return '<button type="button" role="tab" aria-selected="' + (S.cat === id) + '" data-en-cat="' + esc(id) + '">' + esc(name) + ' <i>' + n + '</i></button>'; };
    return '<div class="en-tabs" role="tablist">' + tab('todos', 'Todos', all.length) + cs.map(function (c) { return tab(c.cat, c.cat, c.n); }).join('') + '</div>';
  }
  function pageHtml() {
    var all = items();
    return '<div class="en en-pg"><div class="en-top"><h2>Enlaces</h2><span class="en-sub">Fichas de equipos, tiendas y servicios del proyecto · se abren en otra pestaña</span></div>' +
      '<div class="en-bar"><input type="search" id="en-q" placeholder="Buscar un enlace…" autocomplete="off" aria-label="Buscar un enlace" value="' + esc(S.q) + '"></div>' +
      '<div id="en-tabs">' + tabsHtml(all) + '</div><div id="en-grid">' + gridHtml(all) + '</div>' +
      '<p class="en-note">Los enlaces salen de la lista del panel. Las ligas externas (tiendas, fabricantes) pueden cambiar de precio o desaparecer.</p></div>';
  }
  function repaint() { var all = items(), t = document.getElementById('en-tabs'), g = document.getElementById('en-grid'); if (t) t.innerHTML = tabsHtml(all); if (g) g.innerHTML = gridHtml(all); }

  /* ================= eventos ================= */
  // Todos los botones «Enlaces» del panel (barra, menú Tools, rueda…) abren la página en vez del menú desplegable antiguo.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-links-btn]');
    if (!b || !window.__pfHome) return;
    e.preventDefault(); e.stopImmediatePropagation(); window.__pfHome.show('enlaces');
  }, true);
  document.addEventListener('click', function (e) { var t = e.target.closest('[data-en-cat]'); if (t && t.closest('.en-pg')) { S.cat = t.dataset.enCat; repaint(); } });
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'en-q') { S.q = e.target.value; repaint(); } });

  /* ================= estilos (con #home-view delante: el marco Debian resetea márgenes con selectores de id) ================= */
  var css = document.createElement('style');
  css.textContent = [
    '.en{max-width:1100px;margin:0 auto;padding:6px 14px 30px;font-size:15px;line-height:1.45}.en *{box-sizing:border-box}.en h2{margin:0;font-family:inherit}',
    '.en-top{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 14px;margin:14px 0 10px}.en-top h2{font-size:24px}.en-sub{color:#6d7081;font-size:14px}',
    '.en-bar input{width:100%;max-width:420px;padding:9px 12px;border:1px solid #cfd2de!important;border-radius:6px;background:#fff!important;color:#1d1e20!important;font:15px inherit}',
    '.en-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 14px}.en-tabs button{border:1px solid rgba(128,128,128,.4);border-radius:99px;padding:6px 14px;background:transparent;color:inherit;font:600 13px inherit;cursor:pointer}',
    '.en-tabs button i{font-style:normal;margin-left:4px;padding:0 7px;border-radius:99px;background:rgba(128,128,128,.22);font-size:12px}.en-tabs button[aria-selected=true]{background:#a80030;border-color:#a80030;color:#fff}.en-tabs button[aria-selected=true] i{background:rgba(255,255,255,.28)}',
    '.en-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}',
    '.en-card{display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(128,128,128,.34);border-radius:8px;background:rgba(128,128,128,.05);color:inherit;text-decoration:none;transition:box-shadow .15s,transform .15s,border-color .15s}',
    '.en-card,.en-card:hover,.en-card *{text-decoration:none!important}.en-card .en-name{color:inherit!important}.en-card small{color:#6d7081!important}.en-card code{color:#8a8d9b!important}',
    '.en-card:hover,.en-card:focus-visible{box-shadow:0 6px 18px rgba(0,0,0,.16);transform:translateY(-2px);border-color:#a80030;outline:none}',
    '.en-img{position:relative;display:grid;place-items:center;aspect-ratio:4/3;background:#fff;overflow:hidden}.en-img b{font-size:44px;opacity:.55}',
    '.en-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:10px;background:#fff;transition:transform .3s}.en-card:hover .en-img img{transform:scale(1.05)}',
    '.en-img i{position:absolute;top:8px;right:8px;display:grid;place-items:center;width:24px;height:24px;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font-style:normal;font-size:13px;opacity:0;transition:opacity .15s}.en-card:hover .en-img i,.en-card:focus-visible .en-img i{opacity:1}',
    '.en-txt{display:grid;gap:2px;padding:10px 12px;border-top:1px solid rgba(128,128,128,.28)}.en-name{font-weight:600;font-size:15px}.en-txt small{color:#6d7081;font-size:12.5px}.en-txt code{font:11px ui-monospace,monospace;color:#8a8d9b}',
    '.en-empty{padding:22px;text-align:center;color:#6d7081}.en-note{margin-top:22px;padding:9px 13px;border:1px dashed rgba(128,128,128,.5);border-radius:6px;font-size:12.5px;color:#6d7081}',
    '@media(max-width:640px){\n.en-grid{grid-template-columns:repeat(2,1fr)}\n}',
  ].join('\n');
  css.textContent = css.textContent.replace(/(^|[}\n])\s*([^{}@\n][^{}]*)\{/g, function (m, pre, sel) { return pre + sel.split(',').map(function (s) { return '#home-view ' + s.trim(); }).join(',') + '{'; });
  document.head.appendChild(css);

  api.pageHtml = pageHtml; api.repaint = repaint;
})();
