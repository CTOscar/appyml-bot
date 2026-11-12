// Núcleo del sistema de diseño: validación de tokens, contraste WCAG, generación de src/theme/tokens.css y derivación de temas.
// Lo usan el generador (scripts/build-tokens.mjs), las pruebas y el servidor MCP (design/mcp-server.mjs). Sin dependencias ni DOM.

export const COLOR_TOKENS = ['night', 'deep', 'panel', 'raise', 'line', 'fg', 'soft', 'muted', 'faint', 'accent', 'accent-strong', 'ok', 'warn', 'crit', 'info', 'onfg', 'ink', 'shadow', 'glass', 'sky', 'dawn', 'ground', 'map'];
export const NUM_TOKENS = { 'hair-a': [0, 4], 'glass-a1': [0, 1], 'glass-a2': [0, 1], glow: [0, 1], stars: [0, 1], 'dawn-a': [0, 1] };
export const STR_TOKENS = ['hair-w', 'radius-glass', 'tile-filter'];
export const ALL_TOKENS = [...COLOR_TOKENS, ...Object.keys(NUM_TOKENS), ...STR_TOKENS];
// Colores de los que además se genera el triplete `--<nombre>-rgb` (para rgb(var(--x-rgb) / alfa) en sombras y degradados).
export const RGB_TOKENS = ['ink', 'shadow', 'glass', 'sky', 'dawn', 'accent', 'accent-strong', 'night', 'ok', 'warn', 'crit', 'info'];
// Tokens que se re-declaran bajo `.on-photo` con los valores del primer tema oscuro: texto/controles sobre fotos y mapas.
export const PHOTO_TOKENS = ['fg', 'soft', 'muted', 'faint', 'accent', 'accent-strong', 'ok', 'warn', 'crit', 'info', 'onfg', 'ink'];

// Sin ningún tema oscuro, el texto sobre fotos y mapas sigue necesitando colores claros: estos valores (los del antiguo tema «noche») lo garantizan.
const PHOTO_OSCURO = { scheme: 'dark', tokens: { fg: '#f3f1e8', soft: '#d2d5c6', muted: '#919c89', faint: '#6f7b69', accent: '#e6c97c', 'accent-strong': '#d4ac52', ok: '#6fd48f', warn: '#f2b544', crit: '#ff6f61', info: '#7fb8d8', onfg: '#10261a', ink: '#ffffff' } };

/* ---------- color ---------- */
export function parseHex(h) {
  const m = String(h).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let x = m[1];
  if (x.length === 3) x = [...x].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
}
export const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = parseHex(a), B = parseHex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- validación ---------- */
export function validateToken(name, value) {
  if (COLOR_TOKENS.includes(name)) return parseHex(value) ? null : `«${name}» debe ser un color hexadecimal (#rgb o #rrggbb), recibí «${value}»`;
  if (name in NUM_TOKENS) {
    const [lo, hi] = NUM_TOKENS[name]; const n = Number(value);
    return Number.isFinite(n) && n >= lo && n <= hi ? null : `«${name}» debe ser un número entre ${lo} y ${hi}`;
  }
  if (name === 'hair-w') return /^\d(\.\d)?px$/.test(value) ? null : '«hair-w» debe ser un grosor como 1px o 2px';
  if (name === 'radius-glass') return /^\d+(\.\d+)?(rem|px)$/.test(value) ? null : '«radius-glass» debe ser un tamaño como 1rem o 12px';
  if (name === 'tile-filter') return value === 'none' || /^[\w\s().,%-]+$/.test(value) ? null : '«tile-filter» solo admite funciones de filtro CSS (invert, hue-rotate, brightness…) o none';
  return `Token desconocido «${name}»`;
}
export function validateTheme(id, th) {
  const errs = [];
  if (!/^[a-z][a-z0-9-]{1,23}$/.test(id)) errs.push(`id «${id}» inválido (minúsculas, números y guiones; 2–24)`);
  if (!['dark', 'light'].includes(th?.scheme)) errs.push(`${id}: scheme debe ser dark o light`);
  if (!th?.label) errs.push(`${id}: falta label`);
  for (const t of ALL_TOKENS) {
    if (th?.tokens?.[t] === undefined) { errs.push(`${id}: falta el token «${t}»`); continue; }
    const e = validateToken(t, String(th.tokens[t])); if (e) errs.push(`${id}: ${e}`);
  }
  return errs;
}
export function validateAll(doc) {
  const errs = [];
  if (!doc?.themes || !doc.themes[doc.default]) errs.push('default debe ser un tema existente');
  for (const [id, th] of Object.entries(doc?.themes || {})) errs.push(...validateTheme(id, th));
  return errs;
}

/* ---------- contraste ---------- */
// [primer plano, fondo, mínimo WCAG, para qué]
export const CHECKS = [
  ['fg', 'night', 7, 'Texto principal sobre el fondo'],
  ['soft', 'night', 4.5, 'Texto secundario sobre el fondo'],
  ['muted', 'night', 4.5, 'Texto apagado sobre el fondo'],
  ['faint', 'night', 3, 'Marcadores y texto de apoyo (solo decorativo)'],
  ['fg', 'panel', 7, 'Texto principal sobre menús y paneles'],
  ['muted', 'panel', 4.5, 'Texto apagado sobre paneles'],
  ['accent', 'night', 4.5, 'Acento sobre el fondo'],
  ['accent', 'panel', 4.5, 'Acento sobre paneles'],
  ['ok', 'night', 4.5, 'Estado correcto'],
  ['warn', 'night', 4.5, 'Aviso'],
  ['crit', 'night', 4.5, 'Error o alerta'],
  ['info', 'night', 4.5, 'Información'],
  ['onfg', 'fg', 7, 'Texto de los botones principales (sobre «fg»)'],
  ['onfg', 'accent', 4.5, 'Texto sobre el acento'],
];
export function checkContrast(theme) {
  return CHECKS.map(([a, b, min, why]) => {
    const ratio = contrast(theme.tokens[a], theme.tokens[b]);
    return { fg: a, bg: b, ratio: Math.round(ratio * 100) / 100, min, ok: ratio >= min, why };
  });
}

/* ---------- derivar un tema completo a partir de pocos colores ---------- */
// Ajusta `color` hacia `toward` hasta lograr `min` de contraste contra `bg`.
export function ensureContrast(color, bg, min, toward) {
  let c = color;
  for (let i = 0; i < 40 && contrast(c, bg) < min; i++) c = mix(c, toward, 0.08);
  return c;
}
export function deriveTheme({ id, label, scheme = 'dark', bg, accent, fg }) {
  const dark = scheme === 'dark';
  const white = '#ffffff', black = '#000000';
  const base = dark ? mix(bg, black, 0.15) : mix(bg, white, 0.35);
  const text = fg || (dark ? mix(mix(bg, white, 0.9), '#fff4d6', 0.1) : mix(bg, black, 0.88));
  const toward = dark ? white : black;
  const T = {
    night: base,
    deep: mix(base, dark ? white : black, dark ? 0.1 : 0.06),
    panel: dark ? mix(base, white, 0.03) : white,
    raise: mix(base, dark ? white : black, dark ? 0.07 : 0.04),
    line: mix(base, dark ? white : black, dark ? 0.16 : 0.14),
    fg: text,
    onfg: base,
    ink: dark ? white : mix(bg, black, 0.85),
    shadow: dark ? black : mix(bg, black, 0.85),
    glass: white,
    ground: mix(base, dark ? white : black, 0.04),
    map: mix(base, dark ? black : white, 0.2),
    sky: mix(base, accent, dark ? 0.12 : 0.18),
    dawn: accent,
    'hair-w': '1px', 'hair-a': dark ? 1 : 1.5, 'glass-a1': dark ? 0.055 : 0.8, 'glass-a2': dark ? 0.025 : 0.6,
    glow: dark ? 1 : 0, stars: dark ? 1 : 0, 'dawn-a': dark ? 1 : 0.5, 'radius-glass': '1rem',
    'tile-filter': dark ? 'invert(1) hue-rotate(160deg) brightness(0.72) contrast(0.95) saturate(0.4) sepia(0.12)' : 'none',
  };
  T.soft = ensureContrast(mix(T.fg, base, 0.18), base, 4.5, toward);
  T.muted = ensureContrast(mix(T.fg, base, 0.45), base, 4.5, toward);
  T.faint = ensureContrast(mix(T.fg, base, 0.65), base, 3, toward);
  T.accent = ensureContrast(accent, base, 4.5, toward);
  T['accent-strong'] = mix(T.accent, dark ? black : white, 0.15);
  const status = dark ? { ok: '#6fd48f', warn: '#f2b544', crit: '#ff6f61', info: '#7fb8d8' } : { ok: '#1b7a43', warn: '#8f5800', crit: '#b3261e', info: '#1c6a93' };
  for (const [k, v] of Object.entries(status)) T[k] = ensureContrast(v, base, 4.5, toward);
  // El texto del botón principal debe leerse sobre «fg» y sobre el acento.
  T.onfg = ensureContrast(T.onfg, T.fg, 7, dark ? black : white);
  T.onfg = ensureContrast(T.onfg, T.accent, 4.5, dark ? black : white);
  return { label: label || id, scheme, tokens: T };
}

/* ---------- generación de CSS ---------- */
const rgbTriplet = (hex) => parseHex(hex).join(' ');
function declarations(th, indent = '  ') {
  const out = [`${indent}color-scheme: ${th.scheme};`];
  for (const t of ALL_TOKENS) out.push(`${indent}--t-${t}: ${th.tokens[t]};`);
  for (const t of RGB_TOKENS) out.push(`${indent}--${t}-rgb: ${rgbTriplet(th.tokens[t])};`);
  return out.join('\n');
}
export function renderCss(doc) {
  const ids = Object.keys(doc.themes);
  const first = doc.themes[doc.default];
  const photo = doc.themes[ids.find((i) => doc.themes[i].scheme === 'dark')] || PHOTO_OSCURO;
  const parts = [
    '/* GENERADO por scripts/build-tokens.mjs desde design/tokens.json: no se edita a mano.',
    '   Para cambiar colores usa `npm run tokens` tras editar el JSON, o el servidor MCP (design/mcp-server.mjs). */',
    `:root, [data-theme="${doc.default}"] {\n${declarations(first)}\n}`,
  ];
  for (const id of ids) if (id !== doc.default) parts.push(`[data-theme="${id}"] {\n${declarations(doc.themes[id])}\n}`);
  const photoDecl = [`  color-scheme: ${photo.scheme};`, ...PHOTO_TOKENS.map((t) => `  --t-${t}: ${photo.tokens[t]};`),
    ...PHOTO_TOKENS.filter((t) => RGB_TOKENS.includes(t)).map((t) => `  --${t}-rgb: ${rgbTriplet(photo.tokens[t])};`), '  --t-hair-a: 1;', '  --t-hair-w: 1px;', '  color: var(--t-fg);'];
  parts.push(`/* Texto y controles sobre fotos o mapas: conservan los valores oscuros en cualquier tema. */\n.on-photo {\n${photoDecl.join('\n')}\n}`);
  return parts.join('\n\n') + '\n';
}
