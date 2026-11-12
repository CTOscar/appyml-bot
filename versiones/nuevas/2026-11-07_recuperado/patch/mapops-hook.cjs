#!/usr/bin/env node
/* mapops-hook.cjs — conecta mapops.js y tractores.js con el panel. Idempotente: lo ya aplicado se omite.
 *
 *  bundle (index-*.js)
 *    1) render() de «Ajustes de mapa»: llama a window.__mapops.settings(panel) (enlace a la página completa).
 *    2) Tools → Configuración → «Ajustes de mapa» y «Tractores», y «Preferencias de organización»: abren páginas del marco
 *       (window.__pfHome.show('ajustes' | 'tractores')) en vez de la vista de mapa / panel rápido.
 *  home.js
 *    (también) quita el Simulador de instalación y la Vista 3D de la navegación, el buscador y Inicio.
 *    3) Páginas nuevas 'ajustes' y 'tractores' (título, contenido, refresco en vivo, navbar y buscador global).
 *    (Inicio conserva sus noticias; las tarjetas de tractores viven solo en la página Tractores.)
 *  index.html
 *    5) <script defer> de mapops.js, tractores.js, maptools.js, enlaces.js y taller.js después de mapx.js.
 *
 * Parte SIEMPRE de los respaldos *.bak-mapops (bundle) y *.bak-tractores (home.js): se crean la primera vez y son el original sin parches.
 * Por eso se puede correr cuantas veces se quiera, y los cambios a mano en esos archivos se pierden al volver a correrlo.
 * Uso: node patch/mapops-hook.cjs
 */
const fs = require('fs');
const path = require('path');

const pack = path.resolve(__dirname, '..', 'panelpack');
const assets = path.join(pack, 'assets');
let failed = false;

// Comprueba la sintaxis con `node --check` sobre un archivo temporal (.mjs = módulo ES, .cjs = script). Devuelve '' si está bien.
function syntaxError(code, ext) {
  const f = path.join(require('os').tmpdir(), `mapops-hook-check-${process.pid}${ext}`);
  fs.writeFileSync(f, code);
  try {
    const r = require('child_process').spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    return r.status === 0 ? '' : String(r.stderr).split('\n').filter((l) => /SyntaxError|\^/.test(l)).slice(0, 2).join('\n') || 'error de sintaxis';
  } finally { fs.rmSync(f, { force: true }); }
}

// Parte SIEMPRE del respaldo original (`archivo + sufijo`, que se crea la primera vez) y aplica todas las entradas en orden:
// por eso es idempotente por construcción y las entradas pueden apoyarse unas en otras. Si una entrada no coincide, o el resultado tiene
// un error de sintaxis, NO se escribe nada de ese archivo. Entrada = [desde, hacia, coincidencias esperadas, etiqueta];
// "desde" puede ser texto o RegExp; "hacia" '' = quitar. NO edites a mano los archivos parchados: se regeneran desde el respaldo.
function patch(file, list, bakSuffix) {
  const bak = file + bakSuffix;
  if (!fs.existsSync(bak)) fs.copyFileSync(file, bak); // primera vez: el archivo actual es el original
  const raw = fs.readFileSync(bak, 'utf8');
  const crlf = raw.includes('\r\n'); // home.js trae saltos de línea Windows: se parcha con \n y se escribe con los que traía
  let t = crlf ? raw.replace(/\r\n/g, '\n') : raw, bad = 0;
  for (const [from, to, expected, label] of list) {
    const re = from instanceof RegExp ? new RegExp(from.source, from.flags.includes('g') ? from.flags : from.flags + 'g') : null;
    const n = re ? (t.match(re) || []).length : t.split(from).length - 1;
    if (n !== expected) { console.error(`  ✗ ${label}: se esperaban ${expected} coincidencias y hay ${n} (¿cambió el original?)`); bad++; failed = true; continue; }
    t = re ? t.replace(re, () => to) : t.split(from).join(to); console.log(`  + ${label}`);
  }
  if (bad) { console.error(`  ✗ ${path.basename(file)}: NO se escribió (faltan ${bad} cambios)`); return; }
  if (/\.js$/.test(file)) {
    const err = syntaxError(t, /^index-/.test(path.basename(file)) ? '.mjs' : '.cjs'); // el bundle es un módulo ES (export/import); lo demás, scripts clásicos
    if (err) { console.error(`  ✗ ${path.basename(file)}: el resultado tendría un error de sintaxis y NO se escribió:\n${err}`); failed = true; return; }
  }
  const out = crlf ? t.replace(/\n/g, '\r\n') : t;
  if (fs.readFileSync(file, 'utf8') === out) console.log(`  = ${path.basename(file)}: sin cambios`);
  else { fs.writeFileSync(file, out); console.log(`  → ${path.basename(file)}: escrito`); }
}

/* ---------- bundle ---------- */
const bundle = fs.readdirSync(assets).find((f) => /^index-.*\.js$/.test(f));
if (!bundle) { console.error('No hay assets/index-*.js'); process.exit(1); }
console.log('bundle ' + bundle);
const bf = path.join(assets, bundle);
patch(bf, [
  ['Restablecer valores</button></div>`;panel.hidden=!open;',
   'Restablecer valores</button></div>`;window.__mapops&&window.__mapops.settings&&window.__mapops.settings(panel);panel.hidden=!open;', 1, 'gancho en Ajustes de mapa'],
  ['if(g==="map-settings")return q("#ctl-settings")?.click();',
   'if(g==="tractores")return void(window.__pfHome&&window.__pfHome.show("tractores"));if(g==="map-settings")return window.__pfHome?void window.__pfHome.show("ajustes"):q("#ctl-settings")?.click();', 1, 'menú Tools: ajustes y tractores'],
  ['data-go="fleet">Tractores<', 'data-go="tractores">Tractores<', 2, 'botón «Tractores» del menú (×2)'],
  ['t.dataset.orgGo==="map-settings"&&d.querySelector("#ctl-settings")?.click();',
   't.dataset.orgGo==="map-settings"&&(window.__pfHome?window.__pfHome.show("ajustes"):d.querySelector("#ctl-settings")?.click());', 1, 'Preferencias de organización'],
  // Simulador de instalación y Vista 3D: se quitan de la navegación. Las vistas y la escena 3D siguen en el bundle porque el diálogo de
  // instalación de cada equipo usa tractorScene; solo se eliminan los accesos.
  ['<button type="button" class="jd-sub" data-go="sim">Simulador de instalación</button>', '', 1, 'Tools: quitar Simulador'],
  [/\s*<div class="jd-sec2"><h4>(?:(?!<\/h4>).)*?<span>Más<\/span><\/h4><button type="button" class="jd-sub" data-go="3d">Vista 3D<\/button><\/div>/s, '', 1, 'Tools: quitar sección «Más» (Vista 3D)'],
  ['md=[{view:"sim",hash:"#/simulador",label:"Simulador"},{view:"3d",hash:"#/vista-3d",label:"Vista 3D"}]', 'md=[]', 1, 'barra superior: sin Simulador ni Vista 3D'],
  ['yd=[{view:"sim",hash:"#/simulador",label:"Simulador",note:"Instalación del rastreador",icon:"plug"},{view:"3d",hash:"#/vista-3d",label:"Vista 3D",note:"Tractor y sensores en 3D",icon:"cube"}]', 'yd=[]', 1, 'menú Enlaces: sin tarjetas de Simulador y Vista 3D'],
  ['<div class="mb-1 grid grid-cols-1 gap-2 border-b border-line px-1 pb-3 pt-1">', '<div class="hidden mb-1 grid grid-cols-1 gap-2 border-b border-line px-1 pb-3 pt-1">', 1, 'menú Enlaces: oculta la sección vacía'],
  ['const i={"#/simulador":"sim","#/vista-3d":"3d"},o=()=>', 'const i={},o=()=>', 1, 'rutas #/simulador y #/vista-3d'],
  // Enlaces: se expone la lista interna (`_d`) para la página «Enlaces» (enlaces.js); el menú desplegable antiguo queda sin uso.
  ['const _d=[{title:"Rastreadores"', 'const _d=window.__pfLinks=[{title:"Rastreadores"', 1, 'expone la lista de Enlaces (window.__pfLinks)'],
  // Ilustración del tractor (función Pa): se quita de la tarjeta de detalle y del encabezado de configuración. La función queda sin uso.
  ['<div class="td-art w-[44%] max-w-[180px] shrink-0">${Pa(h.attributes?.marca,"block h-auto w-full drop-shadow-[0_6px_8px_rgba(0,0,0,.3)]",!0)}</div>', '', 1, 'tarjeta de detalle: sin ilustración del tractor'],
  ['<div class="w-[42%] max-w-[170px] shrink-0" data-art>${Pa(c.marca,m,!0)}</div>', '', 1, 'configuración: sin ilustración del tractor'],
  // va con la coma que lo antecede: se encadena con otras expresiones y, sin quitarla, queda `...bg),const` (error de sintaxis)
  ['U.style.setProperty("--tone-bg",xe(N.marca.value).bg),i.querySelector("[data-art]").innerHTML=Pa(N.marca.value,m,!0);', 'U.style.setProperty("--tone-bg",xe(N.marca.value).bg);', 1, 'configuración: no redibujar el tractor al cambiar la marca'],
], '.bak-mapops');

/* ---------- home.js ---------- */
const hf = path.join(assets, 'home.js');
console.log('home.js');
patch(hf, [
  ["estado: 'Status' };", "estado: 'Status', ajustes: 'Ajustes de mapa', tractores: 'Tractores' };", 1, 'títulos de página'],
  [": p === 'estado' && window.__pfStatus ? window.__pfStatus.html() : buildReportes();",
   ": p === 'estado' && window.__pfStatus ? window.__pfStatus.html() : p === 'ajustes' && window.__mapops ? window.__mapops.pageHtml() : p === 'tractores' && window.__tractores ? window.__tractores.pageHtml() : buildReportes();", 1, 'contenido de las páginas'],
  ["if (state.page === 'inicio') { renderFleet(); return; }",
   "if (state.page === 'inicio') { renderFleet(); return; }\n    if (state.page === 'tractores') { if (window.__tractores) window.__tractores.refresh(); return; }", 1, 'refresco en vivo (página Tractores)'],
  ["if (FRAMES[state.page] || state.page === 'estado') return;", "if (FRAMES[state.page] || state.page === 'estado' || state.page === 'ajustes') return;", 1, 'ajustes no se redibuja solo'],
  ["'<li><a href=\"#\" data-hm-page=\"estado\" title=\"Estado del servicio\">Status</a></li>' +",
   "'<li><a href=\"#\" data-hm-page=\"tractores\" title=\"Marcas y modelos de la flota\">Tractores</a></li>' +\n          '<li><a href=\"#\" data-hm-page=\"estado\" title=\"Estado del servicio\">Status</a></li>' +", 1, 'navbar: Tractores'],
  ["{ t: 'Ajustes de mapa', s: 'Capas y opciones del mapa', k: 'ajustes configuracion mapa capas opciones', go: ['settings'] },",
   "{ t: 'Ajustes de mapa', s: 'Unidades, visualización y operación de flota', k: 'ajustes configuracion mapa capas opciones unidades operacion velocidad horario combustible superficie', go: ['page', 'ajustes'] },\n    { t: 'Tractores', s: 'Marcas y modelos: John Deere y New Holland', k: 'tractores marcas modelos john deere new holland 5075e 5090e 6110j tt4.75 t6.110 flota', go: ['page', 'tractores'] },", 1, 'buscador global'],
  // Simulador de instalación y Vista 3D
  ["          '<li><a href=\"#\" data-hm-page=\"simulador\" title=\"Simulador de instalación\">Simulador</a></li>' +\n", '', 1, 'navbar: quitar Simulador'],
  ["          '<li><a href=\"#\" data-hm-page=\"vista3d\" title=\"Tractor en 3D\">Vista 3D</a></li>' +\n", '', 1, 'navbar: quitar Vista 3D'],
  ["          item('sim', 'data-hm-go=\"sim\"', 'Más...', 'Simulador de instalación del rastreador') +\n", '', 1, 'Inicio: quitar acceso al Simulador'],
  [" simulador: 'Simulador de instalación', vista3d: 'Vista 3D',", '', 1, 'títulos de página'],
  ["mapa: { t: 'Data Center' }, simulador: { rail: 'sim', t: 'Simulador de instalación' }, vista3d: { rail: '3d', t: 'Vista 3D' } };", "mapa: { t: 'Data Center' } };", 1, 'marcos de página'],
  ["Mapa, Simulador y Vista 3D abren sus vistas de la app.", "El Mapa abre su vista de la app.", 1, 'comentario'],
  ["    { t: 'Simulador de instalación', s: 'Prueba de instalación del dispositivo', k: 'simulador instalacion dispositivo gps', go: ['nav', 'sim'] },\n", '', 1, 'buscador: quitar Simulador'],
  ["    { t: 'Vista 3D', s: 'Tractor en 3D', k: 'vista 3d tractor modelo', go: ['nav', '3d'] },\n", '', 1, 'buscador: quitar Vista 3D'],
  [" if (g === 'sim') return show('simulador'); if (g === '3d') return show('vista3d');", '', 1, 'nav(): sin sim ni 3d'],
  ['.jd-toolsmenu [data-go="stats"], .jd-toolsmenu [data-go="sim"], .jd-toolsmenu [data-go="3d"]', '.jd-toolsmenu [data-go="stats"]', 1, 'menú: selector'],
  ["{ stats: 'costeo', sim: 'simulador', '3d': 'vista3d' }", "{ stats: 'costeo' }", 1, 'menú: destinos'],
  ['.jd-top [data-go="stats"], .jd-top [data-go="sim"], .jd-top [data-go="3d"]', '.jd-top [data-go="stats"]', 1, 'barra: selector'],
  // Página «Enlaces» (reemplaza al menú desplegable)
  ["ajustes: 'Ajustes de mapa', tractores: 'Tractores' };", "ajustes: 'Ajustes de mapa', tractores: 'Tractores', enlaces: 'Enlaces' };", 1, 'Enlaces: título de página'],
  [": p === 'tractores' && window.__tractores ? window.__tractores.pageHtml() : buildReportes();",
   ": p === 'tractores' && window.__tractores ? window.__tractores.pageHtml() : p === 'enlaces' && window.__enlaces ? window.__enlaces.pageHtml() : buildReportes();", 1, 'Enlaces: contenido de la página'],
  ["|| state.page === 'ajustes') return;", "|| state.page === 'ajustes' || state.page === 'enlaces') return;", 1, 'Enlaces: no se redibuja solo (conserva el filtro y la búsqueda)'],
  ["'<li><a href=\"#\" data-hm-page=\"tractores\" title=\"Marcas y modelos de la flota\">Tractores</a></li>' +\n",
   "'<li><a href=\"#\" data-hm-page=\"tractores\" title=\"Marcas y modelos de la flota\">Tractores</a></li>' +\n          '<li><a href=\"#\" data-hm-page=\"enlaces\" title=\"Fichas, tiendas y servicios del proyecto\">Enlaces</a></li>' +\n", 1, 'Enlaces: navbar'],
  ["k: 'enlaces links proyecto accesos', go: ['links'] }", "k: 'enlaces links proyecto accesos rastreadores sensores teltonika escort traccar', go: ['page', 'enlaces'] }", 1, 'Enlaces: buscador global'],
  // Página «Taller» (taller.js): OT, almacén, costos/KPIs y automatización (chat del agente)
  ["tractores: 'Tractores', enlaces: 'Enlaces' };", "tractores: 'Tractores', enlaces: 'Enlaces', taller: 'Taller' };", 1, 'Taller: título de página'],
  [": p === 'enlaces' && window.__enlaces ? window.__enlaces.pageHtml() : buildReportes();",
   ": p === 'enlaces' && window.__enlaces ? window.__enlaces.pageHtml() : p === 'taller' && window.__taller ? window.__taller.pageHtml() : buildReportes();", 1, 'Taller: contenido de la página'],
  ["|| state.page === 'ajustes' || state.page === 'enlaces') return;", "|| state.page === 'ajustes' || state.page === 'enlaces' || state.page === 'taller') return;", 1, 'Taller: no se redibuja solo (conserva formularios y chat)'],
  ["'<li><a href=\"#\" data-hm-page=\"tractores\" title=\"Marcas y modelos de la flota\">Tractores</a></li>' +\n",
   "'<li><a href=\"#\" data-hm-page=\"tractores\" title=\"Marcas y modelos de la flota\">Tractores</a></li>' +\n          '<li><a href=\"#\" data-hm-page=\"taller\" title=\"Órdenes de trabajo, almacén, costos y asistente\">Taller</a></li>' +\n", 1, 'Taller: navbar'],
  ["k: 'tractores marcas modelos john deere new holland 5075e 5090e 6110j tt4.75 t6.110 flota', go: ['page', 'tractores'] },",
   "k: 'tractores marcas modelos john deere new holland 5075e 5090e 6110j tt4.75 t6.110 flota', go: ['page', 'tractores'] },\n    { t: 'Taller', s: 'Órdenes de trabajo, almacén, costos y KPIs, asistente', k: 'taller ot orden trabajo mantenimiento preventivo correctivo refacciones almacen inventario kpi mtbf mttr costos diesel asistente agente chat automatizacion', go: ['page', 'taller'] },", 1, 'Taller: buscador global'],
], '.bak-tractores');

/* ---------- index.html ---------- */
const ix = path.join(pack, 'index.html');
console.log('index.html');
let html = fs.readFileSync(ix, 'utf8');
const tags = ['mapops.js', 'tractores.js', 'maptools.js', 'enlaces.js', 'taller.js'].filter((f) => !html.includes('/assets/' + f));
if (!tags.length) console.log('  = scripts ya incluidos');
else {
  const anchor = '<script defer src="/assets/mapx.js"></script>';
  if (html.split(anchor).length - 1 !== 1) { console.error('  ✗ no encuentro la línea de mapx.js'); failed = true; }
  else {
    html = html.replace(anchor, () => anchor + tags.map((f) => `\n    <script defer src="/assets/${f}"></script>`).join(''));
    fs.writeFileSync(ix, html); console.log('  + ' + tags.join(', '));
  }
}
if (failed) { console.error('\nHubo errores: revisa lo marcado con ✗.'); process.exit(1); }
console.log('\nListo.');
