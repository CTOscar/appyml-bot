// Enrutador por hash (#/tractores): funciona en cualquier hosting estático sin reglas de reescritura.
import { useSyncExternalStore } from 'react';

export const ROUTES = [
  { path: '/', label: 'Inicio', main: true },
  { path: '/mapa', label: 'Mapa', main: true },
  { path: '/tractores', label: 'Tractores', main: true },
  { path: '/taller', label: 'Taller', main: true },
  { path: '/accounts', label: 'Accounts', main: true, admin: true }, // solo con el permiso «usuarios» (administradores)
  { path: '/lotes', label: 'Lotes' },
  { path: '/alertas', label: 'Alertas' },
  { path: '/reportes', label: 'Reportes' },
  { path: '/costeo', label: 'Costeo de diésel' },
  { path: '/informes', label: 'Informes' },
  { path: '/enlaces', label: 'Enlaces' },
  { path: '/status', label: 'Status' },
  { path: '/apps', label: 'Aplicaciones' },
  { path: '/ajustes', label: 'Ajustes de operación', hidden: true },
  { path: '/perfil', label: 'Perfil', hidden: true },
  { path: '/buscar', label: 'Búsqueda', hidden: true },
];

// '#/taller/ordenes?ot=5' → { path: '/taller', rest: ['ordenes'], query: { ot: '5' } }
export function parseHash(hash) {
  const raw = String(hash || '').replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  const parts = p.split('/').filter(Boolean);
  const path = '/' + (parts[0] || '');
  return { path, rest: parts.slice(1), query: Object.fromEntries(new URLSearchParams(q)), full: raw.startsWith('/') ? raw : '/' + raw };
}

const subscribe = (fn) => { window.addEventListener('hashchange', fn); return () => window.removeEventListener('hashchange', fn); };
const snapshot = () => window.location.hash;

export function useRoute() {
  return parseHash(useSyncExternalStore(subscribe, snapshot, () => ''));
}

export function navigate(to) {
  const target = '#' + (to.startsWith('/') ? to : '/' + to);
  if (window.location.hash !== target) window.location.hash = target;
}

export const routeOf = (path) => ROUTES.find((r) => r.path === path);
