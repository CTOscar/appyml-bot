// Agente agrícola · app de escritorio (Windows y Linux).
// Abre el bot (la carpeta web/ compilada con apps/build-web.mjs) desde un esquema propio `app://local/`, de modo que sus rutas
// absolutas (/assets/…, /bot/…) funcionan igual que en el sitio. Lo demás (API y agentes) lo consulta por internet.
// Seguridad: sin Node en la página, aislamiento de contexto, sandbox, enlaces externos en el navegador y permisos denegados.
const { app, BrowserWindow, Menu, net, protocol, session, shell } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ESQUEMA = 'app';
const ORIGEN = `${ESQUEMA}://local`;
const WEB = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'web');

protocol.registerSchemesAsPrivileged([{ scheme: ESQUEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

// Una sola ventana: si abren la app otra vez, se enfoca la que ya está.
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

let ventana = null;
app.on('second-instance', () => { if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); } });

const leerJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };

// Política de contenido: solo archivos propios y los dos servidores configurados al compilar. El script del tema (inline) se permite por su hash.
function politica() {
  const v = leerJson(path.join(WEB, 'version.json'));
  const servidores = [v.servidor?.panelApi, v.servidor?.agentes].filter(Boolean).map((u) => { try { return new URL(u).origin; } catch { return ''; } }).filter(Boolean);
  let hashes = '';
  try {
    const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
    hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`).join(' ');
  } catch { /* sin index: la app no abre y se verá en pantalla */ }
  return [
    "default-src 'self'", `script-src 'self' ${hashes}`.trim(), "style-src 'self' 'unsafe-inline'", "font-src 'self' data:", "img-src 'self' data: blob: https:",
    `connect-src 'self' ${servidores.join(' ')}`.trim(), "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  ].join('; ');
}

function responderArchivo(req) {
  const url = new URL(req.url);
  let ruta = decodeURIComponent(url.pathname);
  if (ruta === '/' || ruta === '') ruta = '/index.html';
  let archivo = path.normalize(path.join(WEB, ruta));
  if (archivo !== WEB && !archivo.startsWith(WEB + path.sep)) return new Response('Prohibido', { status: 403 });
  if (!fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) archivo = path.join(WEB, 'index.html'); // la app es de una sola página
  return net.fetch(pathToFileURL(archivo).toString());
}

function crearVentana() {
  ventana = new BrowserWindow({
    width: 480, height: 860, minWidth: 360, minHeight: 560,
    backgroundColor: '#050a07', title: 'Agente agrícola', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  ventana.once('ready-to-show', () => ventana.show());
  ventana.on('closed', () => { ventana = null; });

  // Todo enlace que no sea de la app se abre en el navegador del sistema.
  const esExterno = (u) => { try { return new URL(u).origin !== ORIGEN; } catch { return true; } };
  ventana.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  ventana.webContents.on('will-navigate', (e, url) => { if (esExterno(url)) { e.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url); } });

  ventana.loadURL(`${ORIGEN}/`);
}

app.whenReady().then(() => {
  protocol.handle(ESQUEMA, responderArchivo);
  const csp = politica();
  session.defaultSession.webRequest.onHeadersReceived((det, cb) => {
    const h = { ...det.responseHeaders };
    if (det.url.startsWith(ORIGEN)) h['Content-Security-Policy'] = [csp];
    cb({ responseHeaders: h });
  });
  // Sin cámara, micrófono, ubicación ni notificaciones: lo único que se permite es copiar al portapapeles.
  session.defaultSession.setPermissionRequestHandler((_wc, permiso, cb) => cb(permiso === 'clipboard-sanitized-write'));
  Menu.setApplicationMenu(null);
  crearVentana();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) crearVentana(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
