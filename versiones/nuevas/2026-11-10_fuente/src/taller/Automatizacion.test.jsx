// Prueba de humo: el chat responde con las reglas locales (agente fuera de línea) y registra la carga de diésel.
import { test, expect, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Automatizacion } from './Automatizacion.jsx';
import { resetDemo } from './useTaller.js';
import * as L from './logic.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollTo ??= function () {};
beforeEach(() => { localStorage.clear(); resetDemo(); globalThis.fetch = vi.fn(() => Promise.reject(new Error('sin red'))); });
const wait = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

test('muestra el chat, avisos, reglas y reporte; una carga de diésel se registra con las reglas locales', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<Automatizacion />));
  await wait(50);
  const t = () => host.textContent;
  expect(t()).toContain('Agente agrícola');
  expect(t()).toContain('Reglas activas'); // botón de la barra lateral
  expect(t()).toContain('Reporte semanal');
  const abrir = (txt) => [...host.querySelectorAll('aside button')].find((b) => b.textContent.includes(txt));
  await act(async () => abrir('Reglas activas').click());
  expect(t()).toContain('Jornada por mensaje'); // regla visible al abrir el panel
  await act(async () => abrir('Reporte semanal').click());
  expect(t()).toContain('Resumen semanal');
  expect(t()).toContain('Agente fuera de línea');
  const antes = L.state().diesel.exist;
  expect(t()).toContain('En qué te ayudo hoy'); // pantalla inicial al estilo de un chat moderno
  const input = host.querySelector('textarea[aria-label="Mensaje"]');
  const setVal = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  await act(async () => { setVal.call(input, 'Cargué 150 litros al JD-01'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => { host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await wait(900);
  expect(t()).toContain('Registré');
  expect(t()).not.toContain('En qué te ayudo hoy'); // con conversación la caja baja al fondo
  expect(L.state().diesel.exist).toBeLessThan(antes);
  root.unmount();
}, 20_000); // monta el chat completo (assistant-ui) y espera ~1 s: con toda la batería en paralelo rozaba los 5 s por omisión
