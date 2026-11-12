// Prueba de humo de Tablero, Almacén y Costos/KPIs: pintan con los datos de ejemplo y el flujo de compra funciona.
import { test, expect, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Tablero } from './Tablero.jsx';
import { Almacen } from './Almacen.jsx';
import { Kpis } from './Kpis.jsx';
import { resetDemo } from './useTaller.js';
import * as L from './logic.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { localStorage.clear(); resetDemo(); });
const mount = async (el) => { const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host); await act(async () => root.render(el)); return host; };
const btn = (root, txt) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(txt));

test('Tablero pinta indicadores y equipos', async () => {
  const host = await mount(<Tablero />);
  expect(host.textContent).toContain('JD-01');
  expect(host.textContent).toContain('Operando');
});

test('Kpis pinta el periodo y cambia de periodo', async () => {
  const host = await mount(<Kpis />);
  expect(host.textContent).toContain('Disponibilidad');
  expect(host.textContent).toContain('Por equipo');
});

test('Almacén: aprobar y recibir una requisición', async () => {
  const host = await mount(<Almacen />);
  expect(host.textContent).toContain('Existencias');
  await act(async () => btn(host, 'Requisiciones').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  const aprobar = btn(host, 'Aprobar compra');
  expect(aprobar).toBeTruthy();
  await act(async () => aprobar.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(L.state().requisiciones.some((r) => r.estatus === 'APROBADA')).toBe(true);
  expect(btn(host, 'Registrar llegada')).toBeTruthy();
});
