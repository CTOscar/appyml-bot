/* Service worker del bot instalable (alcance /bot/). Solo guarda la app (HTML, JS, CSS, imágenes propias).
 * Nunca toca la API del panel ni el servicio de agentes: esas peticiones van directo a la red. */
const VERSION = 'bot-v2';
const SHELL = ['/bot/', '/bot/manifest.webmanifest', '/bot/icon-192.png', '/bot/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('bot-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'saltar-espera') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // Pantalla: red primero (para recibir actualizaciones); sin red, la última guardada.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put('/bot/', cp)); return r; }).catch(() => caches.match('/bot/')));
    return;
  }
  // Archivos con hash, íconos e imágenes: lo guardado primero y se renueva por detrás.
  if (/^\/(assets|bot|brand)\//.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      const red = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || red;
    }));
  }
});
