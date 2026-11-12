// Noticias de Inicio: API de buildwiselabs.net (con fotos). «Agro Sinaloa» no existe en esa API: la arma la API del panel
// (`/api/panel/news?cat=agro`, con foto) y, si no responde, se usa Google Noticias vía rss2json (sin fotos).
import { config } from '../config.js';

export const NEWS_API = 'https://buildwiselabs.net/api/news';
export const CATS = [
  { id: 'agro', label: 'Agro Sinaloa', color: '#8fcf6a', q: 'agricultura Sinaloa' },
  { id: 'economia', label: 'Economía', color: '#6fd48f' },
  { id: 'negocios', label: 'Negocios', color: '#e6c97c' },
  { id: 'tecnologia', label: 'Tecnología', color: '#7fb8d8' },
  { id: 'mercados', label: 'Mercados', color: '#5fc7b4' },
];

export const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '#');

export async function fromApi(cat, f = fetch, base = NEWS_API, limit = true) {
  const r = await f(`${base}?cat=${encodeURIComponent(cat)}${limit ? '&limit=17' : ''}`);
  if (!r.ok) throw new Error(String(r.status));
  const d = await r.json();
  if (!d.items?.length) throw new Error('vacío');
  return d.items.map((x) => ({ title: x.title, url: safeUrl(x.url), source: x.source, image: x.image || null, summary: x.summary || '', publishedAt: x.publishedAt ? Date.parse(x.publishedAt) : NaN }));
}

// Google Noticias: el título trae « - Fuente» al final.
export function parseRss(j) {
  if (j.status !== 'ok') throw new Error('rss');
  return (j.items || []).slice(0, 17).map((x) => {
    const parts = String(x.title || '').split(' - ');
    const source = parts.length > 1 ? parts.pop() : x.author || 'Google Noticias';
    return { title: parts.join(' - '), url: safeUrl(x.link), source, image: null, summary: '', publishedAt: Date.parse(String(x.pubDate || '').replace(' ', 'T') + 'Z') };
  });
}
export async function fromGoogle(q, f = fetch) {
  const feed = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:14d')}&hl=es-419&gl=MX&ceid=MX:es-419`;
  const r = await f(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`);
  return parseRss(await r.json());
}

export function loadNews(cat, f = fetch, panelNews = config.newsAgroUrl) {
  const c = CATS.find((x) => x.id === cat) || CATS[0];
  if (!c.q) return fromApi(c.id, f);
  // Categorías propias: API del panel (con foto) → Google (sin foto).
  const own = panelNews ? fromApi(c.id, f, panelNews, false) : Promise.reject(new Error('sin API'));
  return own.catch(() => fromGoogle(c.q, f));
}

export function ago(ms, now = Date.now()) {
  const m = Math.round((now - ms) / 60000);
  if (!Number.isFinite(m)) return '';
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}
