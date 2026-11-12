// Prueba de humo: el mini mapa se monta con la flota simulada, muestra los filtros con conteos y cambia el filtro.
import { test, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('./MapView.jsx', () => ({ MapView: () => <div data-testid="map" />, LAYER_NAMES: { oscuro: 'Mapa oscuro', satelite: 'Satélite' } }));
const summary = { total: 3, running: 2, idle: 1, nosignal: 0 };
vi.mock('./FleetProvider.jsx', () => ({ useFleet: () => ({ store: { summary: () => summary, statusOf: () => 'running', fenceOf: () => null }, snap: { devices: new Map(), positions: new Map(), engineToday: new Map() } }) }));
import { MiniMap } from './MiniMap.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('muestra conteos por estado y marca el filtro elegido', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<MiniMap />); });
  const b = (t) => [...host.querySelectorAll('button')].find((x) => x.textContent.startsWith(t));
  expect(b('Todos').textContent).toContain('3');
  expect(b('En marcha').textContent).toContain('2');
  expect(b('Todos').getAttribute('aria-pressed')).toBe('true');
  await act(async () => { b('Apagados').click(); });
  expect(b('Apagados').getAttribute('aria-pressed')).toBe('true');
  expect(host.textContent).toContain('Toca un tractor');
  root.unmount();
});
