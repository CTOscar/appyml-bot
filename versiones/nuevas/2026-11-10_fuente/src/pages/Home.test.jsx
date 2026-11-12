// Prueba de humo del Inicio: se monta con una flota simulada y muestra las secciones de la portada larga.
import { test, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('../fleet/MiniMap.jsx', () => ({ MiniMap: () => <div data-testid="minimap" /> }));
vi.mock('../app/auth.jsx', () => ({ useAuth: () => ({ user: { name: 'Oscar Macías' } }) }));
const dev = new Map([[1, { id: 1, name: 'JD-01', attributes: { marca: 'john-deere' } }]]);
vi.mock('../fleet/FleetProvider.jsx', () => ({ useFleet: () => ({
  store: { statusOf: () => 'running', summary: () => ({ productive: 0.5 }) },
  snap: { devices: dev, positions: new Map(), engineToday: new Map([[1, 36e5]]), events: [], geofences: [], loaded: true, mode: 'mock' },
}) }));
import { Home } from './Home.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.fetch = () => new Promise(() => {});

test('Inicio pinta portada, vistas, rejilla, preguntas y cierre', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<Home />); });
  const t = host.textContent.replace(/\u00a0/g, ' ');
  for (const x of ['Abrir el mapa', 'Cada tractor tiene su lugar', 'Una flota', 'Respuestas cortas', 'Piloto']) expect(t).toContain(x);
  expect(host.querySelectorAll('img').length).toBeGreaterThan(6);
  root.unmount();
});
