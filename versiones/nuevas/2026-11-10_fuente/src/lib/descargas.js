// Aplicaciones descargables (escritorio y Android): detectar el equipo y elegir el archivo correcto del manifest.
// El manifest (public/descargas/manifest.json) lo genera `npm run apps:manifest` a partir de apps/release/.

/** Detecta { os: 'windows'|'linux'|'android'|'mac'|'ios'|null, arch: 'x64'|'arm64'|null } a partir de navigator (y userAgentData si hay). */
export function detectarPlataforma(nav = typeof navigator === 'undefined' ? {} : navigator, uaData = nav?.userAgentData) {
  const ua = String(nav?.userAgent || '');
  const plat = String(uaData?.platform || nav?.platform || '');
  let os = null;
  if (/android/i.test(ua)) os = 'android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'ios';
  else if (/win/i.test(plat) || /windows/i.test(ua)) os = 'windows';
  else if (/mac/i.test(plat) || /mac os/i.test(ua)) os = 'mac';
  else if (/linux|x11|cros/i.test(plat + ua)) os = 'linux';
  let arch = null;
  const a = String(uaData?.architecture || '').toLowerCase();
  if (a.startsWith('arm')) arch = 'arm64';
  else if (a === 'x86') arch = 'x64';
  else if (/arm64|aarch64/i.test(ua + plat)) arch = 'arm64';
  else if (/x86_64|x64|win64|wow64|amd64/i.test(ua + plat)) arch = 'x64';
  return { os, arch };
}

export const OS_NOMBRE = { windows: 'Windows', linux: 'Linux', android: 'Android', mac: 'macOS', ios: 'iPhone / iPad' };
export const KIND_NOMBRE = { instalador: 'Instalador', portable: 'Portátil (sin instalar)', 'tar.gz': 'Comprimido .tar.gz', appimage: 'AppImage', deb: 'Paquete .deb', rpm: 'Paquete .rpm', apk: 'APK' };

/** Tamaño legible (1536 → «1.5 KB»). */
export function tamano(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}

const PREFERIDO = ['instalador', 'appimage', 'apk', 'deb', 'portable', 'tar.gz', 'rpm'];

/** El mejor archivo para la plataforma: misma arquitectura primero (si se conoce), y el tipo más cómodo (instalador antes que portátil). */
export function elegir(archivos, { os, arch }) {
  const lista = (archivos || []).filter((f) => f.os === os);
  if (!lista.length) return null;
  const puntos = (f) => (arch && f.arch === arch ? 0 : arch && f.arch && f.arch !== arch ? 100 : 50) + (PREFERIDO.indexOf(f.kind) + 1 || 9);
  return [...lista].sort((a, b) => puntos(a) - puntos(b))[0];
}

/** Agrupa por sistema en el orden Windows, Linux, Android. */
export function agrupar(archivos) {
  const por = {};
  for (const f of archivos || []) (por[f.os] ||= []).push(f);
  return ['windows', 'linux', 'android'].filter((o) => por[o]).map((os) => ({ os, archivos: por[os] }));
}
