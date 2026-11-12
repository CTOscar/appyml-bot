#!/usr/bin/env node
// Servidor MCP (stdio, sin dependencias) para el sistema de diseño del panel: leer y cambiar colores, líneas y radios de los
// temas de design/tokens.json y regenerar src/theme/tokens.css. DESIGN_ROOT cambia la carpeta del proyecto (pruebas).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { ALL_TOKENS, COLOR_TOKENS, validateAll, validateToken, checkContrast, deriveTheme, renderCss } from './lib.mjs';

const ROOT = process.env.DESIGN_ROOT || fileURLToPath(new URL('..', import.meta.url));
const TOKENS = join(ROOT, 'design/tokens.json');
const CSS = join(ROOT, 'src/theme/tokens.css');
const load = () => JSON.parse(readFileSync(TOKENS, 'utf8'));
function save(doc) {
  const errs = validateAll(doc);
  if (errs.length) throw new Error('Cambio rechazado:\n - ' + errs.join('\n - '));
  writeFileSync(TOKENS, JSON.stringify(doc, null, 2) + '\n');
  writeFileSync(CSS, renderCss(doc));
}
const themeOf = (doc, id) => { const t = doc.themes[id]; if (!t) throw new Error(`No existe el tema «${id}». Temas: ${Object.keys(doc.themes).join(', ')}`); return t; };
const fails = (t) => checkContrast(t).filter((c) => !c.ok);
const failText = (t) => { const f = fails(t); return f.length ? `\nContraste por debajo del mínimo WCAG en: ${f.map((c) => `${c.fg} sobre ${c.bg} = ${c.ratio} (mín. ${c.min})`).join('; ')}.` : '\nContraste WCAG AA correcto en todos los pares revisados.'; };

function scanHardcoded(limit) {
  const found = [], counts = {};
  const re = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d+[\s,_]+\d+[\s,_]+\d+/g;
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { if (f !== 'theme') walk(p); continue; }
      if (!/\.(jsx?|css)$/.test(f) || /\.test\./.test(f)) continue;
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(re)) {
          const rel = relative(ROOT, p); counts[rel] = (counts[rel] || 0) + 1;
          if (found.length < limit) found.push(`${rel}:${i + 1}  ${m[0]}`);
        }
      });
    }
  };
  walk(join(ROOT, 'src'));
  return { total: Object.values(counts).reduce((a, b) => a + b, 0), porArchivo: counts, ejemplos: found };
}

const S = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const TOOLS = [
  { name: 'list_themes', description: 'Lista los temas del panel (id, nombre, esquema claro/oscuro, cuál es el predeterminado) y los nombres de todos los tokens editables.', inputSchema: S(),
    run: () => { const d = load(); return JSON.stringify({ predeterminado: d.default, temas: Object.entries(d.themes).map(([id, t]) => ({ id, label: t.label, scheme: t.scheme })), tokens: ALL_TOKENS }, null, 2); } },
  { name: 'get_theme', description: 'Devuelve todos los tokens (colores, grosor de líneas, radios, brillo) de un tema.', inputSchema: S({ theme: { type: 'string' } }, ['theme']),
    run: ({ theme }) => JSON.stringify(themeOf(load(), theme), null, 2) },
  { name: 'set_token', description: 'Cambia un token de un tema y regenera src/theme/tokens.css (el panel en desarrollo se actualiza solo). Colores en hex (#rrggbb); hair-w en px (grosor de líneas), hair-a (fuerza de bordes, 0–4), radius-glass en rem, glow/stars/dawn-a/glass-a1/glass-a2 de 0 a 1. Avisa si el cambio rompe el contraste WCAG.',
    inputSchema: S({ theme: { type: 'string' }, token: { type: 'string', enum: ALL_TOKENS }, value: { type: ['string', 'number'] } }, ['theme', 'token', 'value']),
    run: ({ theme, token, value }) => {
      const d = load(), t = themeOf(d, theme);
      const v = COLOR_TOKENS.includes(token) || typeof value === 'string' ? value : Number(value);
      const err = validateToken(token, v); if (err) throw new Error(err);
      const before = t.tokens[token]; t.tokens[token] = typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !['hair-w', 'radius-glass'].includes(token) ? Number(v) : v;
      save(d); return `${theme}.${token}: ${before} → ${t.tokens[token]}. tokens.css regenerado.${failText(t)}`;
    } },
  { name: 'create_theme', description: 'Crea un tema completo a partir de pocos datos: fondo (bg), acento y esquema (dark/light), opcionalmente color de texto (fg). Deriva superficies, líneas, textos y estados cuidando el contraste WCAG.',
    inputSchema: S({ id: { type: 'string' }, label: { type: 'string' }, scheme: { type: 'string', enum: ['dark', 'light'] }, bg: { type: 'string' }, accent: { type: 'string' }, fg: { type: 'string' } }, ['id', 'label', 'scheme', 'bg', 'accent']),
    run: (a) => {
      const d = load(); if (d.themes[a.id]) throw new Error(`Ya existe «${a.id}»; usa set_token para modificarlo.`);
      for (const k of ['bg', 'accent', 'fg']) if (a[k]) { const e = validateToken('night', a[k]); if (e) throw new Error(`${k}: ${e}`); }
      d.themes[a.id] = deriveTheme(a); save(d);
      return `Tema «${a.id}» creado y tokens.css regenerado. Para usarlo: localStorage.setItem('pf-theme', '${a.id}') o el selector de Apariencia.${failText(d.themes[a.id])}`;
    } },
  { name: 'delete_theme', description: 'Borra un tema (no se puede borrar el predeterminado).', inputSchema: S({ id: { type: 'string' } }, ['id']),
    run: ({ id }) => { const d = load(); themeOf(d, id); if (id === d.default) throw new Error('No se puede borrar el tema predeterminado.'); delete d.themes[id]; save(d); return `Tema «${id}» borrado.`; } },
  { name: 'check_contrast', description: 'Revisa los pares de contraste WCAG (texto sobre fondo, estados, botón principal) de un tema, o de todos si no se indica.', inputSchema: S({ theme: { type: 'string' } }),
    run: ({ theme }) => { const d = load(); const ids = theme ? [theme] : Object.keys(d.themes); return JSON.stringify(Object.fromEntries(ids.map((id) => [id, checkContrast(themeOf(d, id)).map((c) => `${c.ok ? 'OK ' : 'FALLA'} ${c.fg}/${c.bg} ${c.ratio} (mín. ${c.min}) · ${c.why}`)])), null, 2); } },
  { name: 'find_hardcoded_colors', description: 'Busca en src/ colores escritos a mano (#hex o rgb(...)) fuera de src/theme: lo que todavía no cambia con los temas.', inputSchema: S({ limit: { type: 'integer', minimum: 1, maximum: 200 } }),
    run: ({ limit = 40 }) => JSON.stringify(scanHardcoded(limit), null, 2) },
  { name: 'rebuild_css', description: 'Valida design/tokens.json y regenera src/theme/tokens.css (por si el JSON se editó a mano).', inputSchema: S(),
    run: () => { const d = load(); save(d); return `tokens.css regenerado con ${Object.keys(d.themes).length} temas.`; } },
];

/* ---------- protocolo MCP (JSON-RPC 2.0, un mensaje por línea) ---------- */
const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const send = (m) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return; // notificaciones (initialized, cancelled…): sin respuesta
  const ok = (result) => send({ id, result }), bad = (code, message) => send({ id, error: { code, message } });
  if (method === 'initialize') return ok({ protocolVersion: VERSIONS.includes(params?.protocolVersion) ? params.protocolVersion : VERSIONS[0], capabilities: { tools: {} }, serverInfo: { name: 'panel-design', version: '1.0.0' } });
  if (method === 'ping') return ok({});
  if (method === 'tools/list') return ok({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params?.name);
    if (!tool) return bad(-32602, `Herramienta desconocida: ${params?.name}`);
    try { return ok({ content: [{ type: 'text', text: String(tool.run(params.arguments || {})) }] }); }
    catch (e) { return ok({ isError: true, content: [{ type: 'text', text: e.message }] }); }
  }
  return bad(-32601, `Método no soportado: ${method}`);
}
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch (e) { send({ id: null, error: { code: -32700, message: 'JSON inválido' } }); }
  }
});
