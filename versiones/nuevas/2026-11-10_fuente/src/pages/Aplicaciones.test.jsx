import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Aplicaciones } from './Aplicaciones.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const M = { version: '1.0.0', archivos: [
  { os: 'windows', arch: 'x64', kind: 'portable', file: 'W.exe', size: 1048576, sha256: 'a'.repeat(64) },
  { os: 'android', arch: null, kind: 'apk', file: 'A.apk', size: 2048, sha256: 'b'.repeat(64) },
] };
afterEach(() => vi.unstubAllGlobals());

async function montar(json) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => json })));
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  await act(async () => { root.render(<Aplicaciones />); });
  await act(async () => { await Promise.resolve(); });
  const html = el.innerHTML;
  const enlaces = [...el.querySelectorAll('a[download]')].map((a) => a.getAttribute('href'));
  await act(async () => root.unmount());
  el.remove();
  return { html, enlaces };
}

describe('Aplicaciones', () => {
  it('lista las descargas por sistema, con enlace a /descargas/', async () => {
    const { html, enlaces } = await montar(M);
    expect(html).toContain('Windows');
    expect(html).toContain('Android');
    expect(enlaces).toEqual(expect.arrayContaining(['/descargas/W.exe', '/descargas/A.apk']));
  });
  it('sin archivos publicados lo dice', async () => {
    const { html } = await montar({ version: '1.0.0', archivos: [] });
    expect(html).toContain('Aún no hay instaladores');
  });
});
