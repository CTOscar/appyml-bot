// Compila SOLO el bot (Agente agrícola) para empaquetarlo en las apps de escritorio (Electron) y Android (Capacitor).
//   node apps/build-web.mjs        → apps/web/   (index.html = el bot, assets/, bot/ con los íconos)
// Las direcciones del servidor salen de apps/config.json y quedan escritas en el código al compilar.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(raiz, 'apps/config.json'), 'utf8'));
const salida = join(raiz, 'apps/web');

rmSync(salida, { recursive: true, force: true });
const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'], {
  cwd: raiz, stdio: 'inherit', shell: process.platform === 'win32',
  env: { ...process.env, APP_SOLO_BOT: '1', APP_OUT_DIR: salida, VITE_USE_MOCK: 'false', VITE_PANEL_API_URL: cfg.servidor.panelApi, VITE_NEWS_API_URL: '', VITE_AGENTS_URL: cfg.servidor.agentes },
});
if (r.status !== 0) { console.error('La compilación del bot falló.'); process.exit(r.status || 1); }

// El bot compila en bot/index.html; en la app debe ser la página de inicio. Sus rutas absolutas (/assets/…, /bot/…) se conservan.
const botHtml = join(salida, 'bot/index.html');
if (!existsSync(botHtml)) { console.error('No encontré bot/index.html en la salida.'); process.exit(1); }
copyFileSync(botHtml, join(salida, 'index.html'));
// Ícono que usan las ventanas (Electron) y el generador de íconos de Android.
mkdirSync(join(salida, 'bot'), { recursive: true });
writeFileSync(join(salida, 'version.json'), JSON.stringify({ app: cfg.appId, version: cfg.version, servidor: cfg.servidor, compilado: new Date().toISOString() }, null, 2));
console.log(`\nListo: ${salida}\n  panelApi = ${cfg.servidor.panelApi}\n  agentes  = ${cfg.servidor.agentes}`);
