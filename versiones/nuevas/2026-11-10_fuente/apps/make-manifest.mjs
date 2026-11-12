// Genera public/descargas/manifest.json (y copia los archivos) a partir de apps/release/.
// Nombres esperados: Agente-agricola-<versión>-<windows|linux>-<x64|arm64>-<instalador|portable|appimage|deb|rpm>.<ext>,
//                    Agente-agricola-<versión>-linux-<arch>.tar.gz y Agente-agricola-<versión>-android.apk
import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = join(RAIZ, 'apps', 'release');
const DESTINO = join(RAIZ, 'public', 'descargas');
const version = JSON.parse((await import('node:fs')).readFileSync(join(RAIZ, 'apps', 'config.json'), 'utf8')).version;

const sha = (p) => new Promise((ok, no) => { const h = createHash('sha256'); createReadStream(p).on('data', (d) => h.update(d)).on('error', no).on('end', () => ok(h.digest('hex'))); });
function* archivos(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!/unpacked$/.test(e.name)) yield* archivos(p); } else yield p;
  }
}
function describir(nombre) {
  const m = /^Agente-agricola-[\d.]+-(windows|linux)-(x64|arm64|amd64|x86_64|aarch64)-?(instalador|portable)?\.(exe|tar\.gz|AppImage|deb|rpm)$/i.exec(nombre);
  if (m) {
    const ext = m[4].toLowerCase();
    return { os: m[1].toLowerCase(), arch: /arm|aarch/.test(m[2]) ? 'arm64' : 'x64', kind: m[3] || (ext === 'tar.gz' ? 'tar.gz' : ext === 'appimage' ? 'appimage' : ext) };
  }
  if (/^Agente-agricola-[\d.]+-android\.apk$/i.test(nombre)) return { os: 'android', arch: null, kind: 'apk' };
  return null;
}

mkdirSync(DESTINO, { recursive: true });
const lista = [];
try {
  for (const p of archivos(ORIGEN)) {
    const nombre = basename(p);
    const d = describir(nombre);
    if (!d) continue;
    copyFileSync(p, join(DESTINO, nombre));
    lista.push({ ...d, file: nombre, size: statSync(p).size, sha256: await sha(p) });
  }
} catch (e) { console.error(e); throw e; }
lista.sort((a, b) => (a.os + a.arch + a.kind).localeCompare(b.os + b.arch + b.kind));
writeFileSync(join(DESTINO, 'manifest.json'), JSON.stringify({ version, archivos: lista }, null, 2) + '\n');
console.log(`manifest.json: ${lista.length} archivo(s)`);
for (const f of lista) console.log(' ·', f.file);
