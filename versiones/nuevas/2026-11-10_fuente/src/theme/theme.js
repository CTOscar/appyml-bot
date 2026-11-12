// Tema activo: 'auto' o el id de un tema de design/tokens.json. Se guarda en localStorage (pf-theme) y se aplica en <html data-theme>.
// 'auto' sigue al sistema: contraste alto → «contraste», esquema claro → «claro», si no el tema por defecto.
import { useSyncExternalStore } from 'react';
import doc from '../../design/tokens.json';

// Los temas del bot (estilo DeepSeek) los aplica el bot solo; no aparecen en el selector de Apariencia del panel.
export const BOT_THEMES = { claro: 'deepseek', oscuro: 'deepseek-oscuro' };
export const THEMES = Object.entries(doc.themes).filter(([id]) => !Object.values(BOT_THEMES).includes(id)).map(([id, t]) => ({ id, label: t.label, scheme: t.scheme, swatch: [t.tokens.night, t.tokens.panel, t.tokens.accent, t.tokens.fg] }));
export const DEFAULT_THEME = doc.default;
const KEY = 'pf-theme';
const known = (id) => id === 'auto' || id in doc.themes;

const read = () => { try { const v = localStorage.getItem(KEY); return known(v) ? v : 'auto'; } catch { return 'auto'; } };
let mode = typeof localStorage === 'undefined' ? 'auto' : read();
const subs = new Set();

export function resolve(m = mode, mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false)) {
  if (m !== 'auto') return m;
  if (mq('(prefers-contrast: more)') && 'contraste' in doc.themes) return 'contraste';
  if (mq('(prefers-color-scheme: light)') && 'claro' in doc.themes) return 'claro';
  return DEFAULT_THEME;
}

export function applyTheme(m = mode) {
  if (typeof document === 'undefined') return;
  const id = resolve(m), t = doc.themes[id];
  const root = document.documentElement;
  root.dataset.theme = id;
  root.dataset.themeMode = m;
  const set = (name, content) => { const el = document.querySelector(`meta[name="${name}"]`); if (el) el.setAttribute('content', content); };
  set('theme-color', t.tokens.night);
  set('color-scheme', t.scheme);
}

export function setTheme(m) {
  if (!known(m)) return;
  mode = m;
  try { localStorage.setItem(KEY, m); } catch { /* sin almacenamiento: vale para esta sesión */ }
  applyTheme(m);
  subs.forEach((f) => f());
}

// El bot usa su propia paleta (blanco con acento azul / gris oscuro), la que corresponda al esquema del sistema, sin tocar el tema guardado del panel.
export function initBotTheme() {
  if (typeof document === 'undefined') return;
  const aplicar = () => {
    const oscuro = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
    const id = oscuro ? BOT_THEMES.oscuro : BOT_THEMES.claro;
    if (!(id in doc.themes)) { applyTheme(); return; }
    const t = doc.themes[id], root = document.documentElement;
    root.dataset.theme = id;
    root.dataset.themeMode = 'bot';
    const set = (name, content) => { const el = document.querySelector(`meta[name="${name}"]`); if (el) el.setAttribute('content', content); };
    set('theme-color', t.tokens.night);
    set('color-scheme', t.scheme);
  };
  aplicar();
  if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', aplicar);
}

// Al arrancar y cuando el sistema cambia (solo importa en modo auto).
export function initTheme() {
  applyTheme();
  if (typeof matchMedia === 'function') {
    ['(prefers-color-scheme: light)', '(prefers-contrast: more)'].forEach((q) => matchMedia(q).addEventListener?.('change', () => { if (mode === 'auto') { applyTheme(); subs.forEach((f) => f()); } }));
  }
}

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const useTheme = () => ({
  mode: useSyncExternalStore(subscribe, () => mode, () => 'auto'),
  active: useSyncExternalStore(subscribe, () => resolve(), () => DEFAULT_THEME),
  setTheme,
});
