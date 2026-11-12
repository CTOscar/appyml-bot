// Configuración leída de las variables VITE_* (ver .env.example). En las pruebas no hay import.meta.env.
const env = import.meta.env || {};
const panel = env.VITE_PANEL_API_URL ?? 'same-origin';

function newsUrl(v, panelEnv) {
  const base = v ?? panelEnv;
  if (base === 'same-origin') return '/api/panel/news';
  return base ? `${String(base).replace(/\/$/, '')}/api/panel/news` : '';
}

export const config = {
  useMock: env.VITE_USE_MOCK !== 'false',
  apiBase: (env.VITE_TRACCAR_URL || '').replace(/\/$/, ''),
  // API propia del panel (/api/panel): 'same-origin' = misma dirección; vacío = sin API (solo Traccar/simulado).
  panelApi: panel === 'same-origin' ? '/' : panel.replace(/\/$/, ''),
  // Noticias con foto de «Agro Sinaloa»: las arma la API del panel. VITE_NEWS_API_URL=same-origin|https://… la fuerza; vacío = la API del panel si existe.
  newsAgroUrl: newsUrl(env.VITE_NEWS_API_URL, panel),
  dieselPrice: Number(env.VITE_DIESEL_PRICE) || 24,
  agentsUrl: (env.VITE_AGENTS_URL || 'http://localhost:3100').replace(/\/$/, ''),
  tz: 'America/Mazatlan',
  // Sin reporte en este tiempo = "sin señal". Detenido reporta cada 30 min.
  offlineAfterMin: 35,
};
