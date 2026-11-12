// Pruebas del sistema de diseño: tokens válidos, contraste WCAG por tema, CSS generado sin desfase y servidor MCP.
import { describe, test, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, readFileSync as rf } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { ALL_TOKENS, validateAll, checkContrast, renderCss, deriveTheme, contrast, mix, validateToken } from '../../design/lib.mjs';

const R = process.cwd(); // vitest corre en la raíz del proyecto
const doc = JSON.parse(readFileSync(join(R, 'design/tokens.json'), 'utf8'));

describe('tokens', () => {
  test('todos los temas están completos y son válidos', () => expect(validateAll(doc)).toEqual([]));
  test.each(Object.keys(doc.themes))('«%s» cumple el contraste WCAG AA en todos los pares', (id) => {
    expect(checkContrast(doc.themes[id]).filter((c) => !c.ok)).toEqual([]);
  });
  test('tokens.css en disco es exactamente lo que genera tokens.json (ejecuta `npm run tokens` si falla)', () => {
    expect(readFileSync(join(R, 'src/theme/tokens.css'), 'utf8')).toBe(renderCss(doc));
  });
  test('el CSS define cada tema, el predeterminado en :root y el ámbito .on-photo', () => {
    const css = renderCss(doc);
    for (const id of Object.keys(doc.themes)) expect(css).toContain(`[data-theme="${id}"]`);
    expect(css).toContain(`:root, [data-theme="${doc.default}"]`);
    expect(css).toContain('.on-photo');
    for (const t of ALL_TOKENS) expect(css).toContain(`--t-${t}:`);
  });
  test('validación de valores', () => {
    expect(validateToken('accent', '#e6c97c')).toBeNull();
    expect(validateToken('accent', 'rojo')).toMatch(/hexadecimal/);
    expect(validateToken('hair-w', '2px')).toBeNull();
    expect(validateToken('glow', 3)).toMatch(/entre 0 y 1/);
    expect(validateToken('tile-filter', 'url(javascript:x)')).toMatch(/filtro/);
  });
  test('contraste: negro/blanco = 21 y mezcla simétrica', () => {
    expect(Math.round(contrast('#000000', '#ffffff'))).toBe(21);
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('deriveTheme', () => {
  test.each([['dark', '#0b1d3a', '#ff8a3d'], ['light', '#f4efe6', '#0a6e8a'], ['dark', '#1a1030', '#c084fc']])('un tema %s (%s / %s) sale completo y accesible', (scheme, bg, accent) => {
    const t = deriveTheme({ id: 'prueba', label: 'Prueba', scheme, bg, accent });
    expect(validateAll({ default: 'prueba', themes: { prueba: t } })).toEqual([]);
    expect(checkContrast(t).filter((c) => !c.ok)).toEqual([]);
  });
});

describe('servidor MCP', () => {
  async function session() {
    const root = mkdtempSync(join(tmpdir(), 'pf-design-'));
    mkdirSync(join(root, 'design')); mkdirSync(join(root, 'src/theme'), { recursive: true });
    copyFileSync(join(R, 'design/tokens.json'), join(root, 'design/tokens.json'));
    const p = spawn('node', [join(R, 'design/mcp-server.mjs')], { env: { ...process.env, DESIGN_ROOT: root } });
    let buf = ''; const waiting = new Map(); let n = 0;
    p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); waiting.get(m.id)?.(m); } });
    const rpc = (method, params) => new Promise((ok) => { const id = ++n; waiting.set(id, ok); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
    const call = async (name, args = {}) => (await rpc('tools/call', { name, arguments: args })).result;
    return { root, rpc, call, close: async () => { p.kill(); await once(p, 'exit'); } };
  }

  test('handshake, lista de herramientas y cambio de un token con CSS regenerado', async () => {
    const s = await session();
    try {
      const init = await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
      expect(init.result.serverInfo.name).toBe('panel-design');
      expect(init.result.protocolVersion).toBe('2025-06-18');
      const tools = (await s.rpc('tools/list')).result.tools.map((t) => t.name);
      expect(tools).toEqual(expect.arrayContaining(['list_themes', 'set_token', 'create_theme', 'check_contrast', 'find_hardcoded_colors']));

      const r = await s.call('set_token', { theme: 'sobrio', token: 'accent', value: '#ff8a3d' });
      expect(r.isError).toBeUndefined();
      expect(r.content[0].text).toContain('#2b5c8f → #ff8a3d');
      expect(rf(join(s.root, 'src/theme/tokens.css'), 'utf8')).toContain('--t-accent: #ff8a3d;');

      const bad = await s.call('set_token', { theme: 'sobrio', token: 'accent', value: 'naranja' });
      expect(bad.isError).toBe(true);
      const warn = await s.call('set_token', { theme: 'sobrio', token: 'fg', value: '#eeeeee' });
      expect(warn.content[0].text).toContain('por debajo del mínimo WCAG');

      const mk = await s.call('create_theme', { id: 'marino', label: 'Marino', scheme: 'dark', bg: '#0b1d3a', accent: '#ff8a3d' });
      expect(mk.content[0].text).toContain('creado');
      expect(rf(join(s.root, 'src/theme/tokens.css'), 'utf8')).toContain('[data-theme="marino"]');
      expect((await s.call('delete_theme', { id: 'sobrio' })).isError).toBe(true);
      expect((await s.call('delete_theme', { id: 'marino' })).isError).toBeUndefined();
    } finally { await s.close(); }
  });
});
