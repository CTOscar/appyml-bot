// Pruebas de la carga de noticias: la API del panel va primero y Google es el respaldo.
import { test, expect } from 'vitest';
import { loadNews } from './news.js';

const json = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 502, json: () => Promise.resolve(body) });

test('Agro Sinaloa usa la API del panel (con foto) cuando responde', async () => {
  const calls = [];
  const f = (u) => { calls.push(u); return json({ items: [{ title: 'T', url: 'https://a.mx/n', source: 'A', image: 'https://a.mx/i.jpg', publishedAt: '2026-11-09T00:00:00Z' }] }); };
  const r = await loadNews('agro', f, '/api/panel/news');
  expect(r[0].image).toBe('https://a.mx/i.jpg');
  expect(calls).toEqual(['/api/panel/news?cat=agro']);
});

test('si la API del panel falla o no existe, cae a Google (sin foto)', async () => {
  const rss = { status: 'ok', items: [{ title: 'Nota - Medio', link: 'https://m.mx/1', pubDate: '2026-11-09 10:00:00' }] };
  const f = (u) => (u.includes('rss2json') ? json(rss) : json({}, false));
  for (const base of ['/api/panel/news', '']) {
    const r = await loadNews('agro', f, base);
    expect(r[0]).toMatchObject({ title: 'Nota', source: 'Medio', image: null });
  }
});

test('las demás categorías siguen usando la API de buildwiselabs.net', async () => {
  const calls = [];
  await loadNews('economia', (u) => { calls.push(u); return json({ items: [{ title: 'E', url: 'https://e.mx', source: 'E' }] }); }, '/api/panel/news');
  expect(calls[0]).toMatch(/^https:\/\/buildwiselabs\.net\/api\/news\?cat=economia/);
});
