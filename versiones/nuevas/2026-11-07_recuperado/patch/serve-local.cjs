#!/usr/bin/env node
/* serve-local.cjs — prueba local del bundle (panelpack/) sin dependencias.
 * Sirve panelpack/ y reenvía /api/panel/* a la API del panel (mismo origen => la cookie de sesión funciona,
 * que es lo que espera el bundle con VITE_PANEL_API_URL="same-origin").
 *
 * Uso:  node patch/serve-local.cjs [--port 8080] [--api http://localhost:3000]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const port = Number(opt('port', 8080));
const api = new URL(opt('api', 'http://localhost:3000'));
const root = path.resolve(__dirname, '..', 'panelpack');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/panel')) {
    const up = http.request({
      host: api.hostname, port: api.port || 80, method: req.method, path: req.url,
      headers: { ...req.headers, host: api.host },
    }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', (e) => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: `API no disponible: ${e.message}` })); });
    return req.pipe(up);
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('403'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(port, () => {
  console.log(`Panel  : http://localhost:${port}`);
  console.log(`API    : ${api.origin}  (/api/panel → proxy)`);
  console.log('Datos  : simulados (VITE_USE_MOCK=true en el bundle)');
});
