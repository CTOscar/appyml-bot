// Noticias de «Agro Sinaloa» con foto. El navegador no puede leerlas directo (sin CORS y Google/Bing no traen imagen utilizable),
// así que la API las arma: titulares de Bing Noticias (RSS), URL real de cada nota y su imagen `og:image` (la misma que usan las vistas previas de enlaces).
// Solo existe la categoría `agro` con consulta fija: no es un proxy abierto. Caché en memoria.
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export const AGRO = { cat: 'agro', label: 'Agro Sinaloa', q: 'agricultura Sinaloa' };
const TTL = 15 * 60e3;
const MAX_ITEMS = 12;
const PAGE_TIMEOUT = 4500;
const PAGE_BYTES = 250 * 1024;
const UA = 'Mozilla/5.0 (compatible; PanelFlotaBot/1.0)';

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
export const decode = (s) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
    return entities[e.toLowerCase()] ?? m;
  }).trim();

const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]) : ''; };

// El enlace de Bing es un redirector: la nota real va en el parámetro `url`.
export function realUrl(link) {
  try {
    const u = new URL(decode(link));
    const inner = u.hostname.endsWith('bing.com') ? u.searchParams.get('url') : null;
    return safeHttp(inner || u.href);
  } catch { return null; }
}
const safeHttp = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

export function parseBing(xml) {
  return xml.split('<item>').slice(1).map((it) => {
    const url = realUrl(tag(it, 'link'));
    const t = Date.parse(tag(it, 'pubDate'));
    return { title: tag(it, 'title'), summary: tag(it, 'description'), source: tag(it, 'News:Source'), url, publishedAt: Number.isFinite(t) ? new Date(t).toISOString() : null, image: null };
  }).filter((x) => x.title && x.url);
}

// og:image / twitter:image del <head>; relativa → absoluta; solo http(s).
export function parseOgImage(html, base) {
  const metas = String(html).match(/<meta\b[^>]*>/gi) || [];
  const want = ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src'];
  const found = {};
  for (const m of metas) {
    const key = (m.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1]?.toLowerCase();
    const val = (m.match(/\bcontent\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (key && val && want.includes(key) && !found[key]) found[key] = decode(val);
  }
  const raw = want.map((k) => found[k]).find(Boolean);
  if (!raw) return null;
  try { return safeHttp(new URL(raw, base).href); } catch { return null; }
}

// Evita que una nota apunte a la red interna (SSRF): solo hosts públicos.
const privateV4 = (ip) => {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
};
const privateIp = (ip) => {
  if (!net.isIPv6(ip)) return privateV4(ip);
  const v = ip.toLowerCase();
  // ::ffff:a.b.c.d o su forma normalizada ::ffff:7f00:1 → se revisa la IPv4 incluida
  const dotted = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return privateV4(dotted[1]);
  const hex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) { const n = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16); return privateV4([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')); }
  return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
};
export async function isPublicHost(url, dns = lookup) {
  try {
    const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(hostname)) return !privateIp(hostname);
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
    const addrs = await dns(hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !privateIp(a.address));
  } catch { return false; }
}

async function imageOf(url, f, dns) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), PAGE_TIMEOUT);
  try {
    // Redirecciones a mano (máx. 4): cada salto debe ser un host público.
    let cur = url, r;
    for (let hop = 0; hop <= 4; hop++) {
      if (!(await isPublicHost(cur, dns))) return null;
      r = await f(cur, { signal: ctl.signal, redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html' } });
      const loc = r.status >= 300 && r.status < 400 ? r.headers.get('location') : null;
      if (!loc) break;
      cur = safeHttp(new URL(loc, cur).href);
      if (!cur) return null;
      r = null;
    }
    if (!r || !r.ok || !/html/i.test(r.headers.get('content-type') || '')) return null;
    // Solo el principio de la página: el <head> con los meta.
    const reader = r.body.getReader(); let buf = '', n = 0; const dec = new TextDecoder();
    while (n < PAGE_BYTES) {
      const { done, value } = await reader.read(); if (done) break;
      n += value.length; buf += dec.decode(value, { stream: true });
      if (/<\/head>/i.test(buf)) break;
    }
    reader.cancel().catch(() => {});
    return parseOgImage(buf, cur);
  } catch { return null; } finally { clearTimeout(to); }
}

export async function buildAgroNews({ fetchImpl = fetch, dns = lookup, now = Date.now } = {}) {
  const feed = `https://www.bing.com/news/search?q=${encodeURIComponent(AGRO.q)}&format=rss&setlang=es-MX&cc=MX`;
  const r = await fetchImpl(feed, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const items = parseBing(await r.text()).slice(0, MAX_ITEMS);
  await Promise.all(items.map(async (x) => { x.image = await imageOf(x.url, fetchImpl, dns); }));
  return { cat: AGRO.cat, label: AGRO.label, updatedAt: new Date(now()).toISOString(), sources: [...new Set(items.map((x) => x.source).filter(Boolean))], items };
}

// Con caché: una consulta cada 15 min; si falla y hay copia vieja, se sirve esa.
export function createAgroNews(opts = {}) {
  let cache = null, pending = null;
  const now = opts.now || Date.now;
  return async function get() {
    if (cache && now() - cache.at < TTL) return cache.data;
    pending ||= buildAgroNews(opts).then((data) => { cache = { at: now(), data }; return data; }).finally(() => { pending = null; });
    try { return await pending; } catch (e) { if (cache) return cache.data; throw e; }
  };
}
