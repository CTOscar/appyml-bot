import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { parseBing, parseOgImage, realUrl, isPublicHost, createAgroNews, decode } from '../src/news.mjs';
import { createApp } from '../src/app.mjs';
import { createFakeRepo } from './fake-repo.mjs';

const RSS = `<rss><channel><item><title>Sader paga trigo &amp; maíz</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3a%2f%2fejemplo.mx%2fnota-1&amp;c=1</link><description>Resumen &#225;</description><pubDate>Mon, 09 Nov 2026 15:47:00 GMT</pubDate><News:Source>Ejemplo</News:Source></item>
<item><title>Sin enlace válido</title><link>javascript:alert(1)</link></item></channel></rss>`;

describe('parseo', () => {
  test('titulares de Bing: decodifica, saca la URL real y descarta enlaces no http(s)', () => {
    const [a, ...rest] = parseBing(RSS);
    assert.equal(a.title, 'Sader paga trigo & maíz');
    assert.equal(a.summary, 'Resumen á');
    assert.equal(a.url, 'https://ejemplo.mx/nota-1');
    assert.equal(a.source, 'Ejemplo');
    assert.equal(a.publishedAt, '2026-11-09T15:47:00.000Z');
    assert.equal(rest.length, 0);
  });
  test('og:image absoluta, relativa y twitter:image como respaldo', () => {
    assert.equal(parseOgImage('<meta property="og:image" content="https://a.mx/x.jpg?a=1&amp;b=2">', 'https://a.mx/n'), 'https://a.mx/x.jpg?a=1&b=2');
    assert.equal(parseOgImage('<meta content="/img/f.png" property="og:image">', 'https://a.mx/n/1'), 'https://a.mx/img/f.png');
    assert.equal(parseOgImage('<meta name="twitter:image" content="https://a.mx/t.jpg">', 'https://a.mx'), 'https://a.mx/t.jpg');
    assert.equal(parseOgImage('<meta property="og:image" content="javascript:x">', 'https://a.mx'), null);
    assert.equal(parseOgImage('<html></html>', 'https://a.mx'), null);
  });
  test('decode e URL', () => {
    assert.equal(decode('<![CDATA[a &lt;b&gt;]]>'), 'a <b>');
    assert.equal(realUrl('https://ejemplo.mx/n'), 'https://ejemplo.mx/n');
  });
});

describe('seguridad (SSRF)', () => {
  const dns = async (h) => (h === 'interno.mx' ? [{ address: '10.0.0.5' }] : [{ address: '93.184.216.34' }]);
  test('rechaza localhost, IP privadas y nombres que resuelven a la red interna', async () => {
    for (const u of ['http://localhost/x', 'http://127.0.0.1/x', 'http://192.168.1.1/x', 'http://169.254.169.254/x', 'http://[::1]/x', 'http://[::ffff:127.0.0.1]/x', 'http://[fd00::1]/x', 'http://interno.mx/x']) assert.equal(await isPublicHost(u, dns), false, u);
    assert.equal(await isPublicHost('https://publico.mx/x', dns), true);
  });
});

describe('redirecciones', () => {
  test('no sigue una redirección hacia la red interna', async () => {
    const urls = [];
    const f = async (u) => { urls.push(String(u)); return u.includes('bing.com') ? new Response(RSS, { status: 200 }) : new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:9/secreto' } }); };
    const data = await createAgroNews({ fetchImpl: f, dns: async () => [{ address: '93.184.216.34' }] })();
    assert.equal(data.items[0].image, null);
    assert.ok(!urls.some((u) => u.includes('127.0.0.1')));
  });
});

describe('ruta /api/panel/news', () => {
  const fakeFetch = async (url) => {
    if (String(url).includes('bing.com')) return new Response(RSS.replace(/<item><title>Sin[\s\S]*?<\/item>/, ''), { status: 200 });
    return new Response('<html><head><meta property="og:image" content="https://cdn.ejemplo.mx/f.jpg"></head><body></body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const dns = async () => [{ address: '93.184.216.34' }];
  async function serve(news) {
    const app = createApp({ repo: createFakeRepo(), config: { allowedOrigins: [], production: false }, news });
    const srv = app.listen(0); await once(srv, 'listening');
    return { srv, base: `http://127.0.0.1:${srv.address().port}/api/panel` };
  }

  test('devuelve notas con imagen y la caché evita repetir la consulta', async () => {
    let calls = 0;
    const news = createAgroNews({ fetchImpl: async (...a) => { calls++; return fakeFetch(...a); }, dns });
    const { srv, base } = await serve(news);
    try {
      const j = await (await fetch(`${base}/news?cat=agro`)).json();
      assert.equal(j.items.length, 1);
      assert.equal(j.items[0].image, 'https://cdn.ejemplo.mx/f.jpg');
      assert.deepEqual(j.sources, ['Ejemplo']);
      const antes = calls;
      await fetch(`${base}/news?cat=agro`);
      assert.equal(calls, antes);
    } finally { srv.close(); }
  });
  test('otra categoría → 400; si el origen falla → 502', async () => {
    const { srv, base } = await serve(createAgroNews({ fetchImpl: async () => { throw new Error('caído'); }, dns }));
    try {
      assert.equal((await fetch(`${base}/news?cat=otra`)).status, 400);
      assert.equal((await fetch(`${base}/news?cat=agro`)).status, 502);
    } finally { srv.close(); }
  });
});
