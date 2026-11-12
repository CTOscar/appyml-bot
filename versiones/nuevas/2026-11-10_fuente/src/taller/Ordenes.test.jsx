// Prueba de humo de la vista: pinta la lista, abre una OT nueva y avanza su estatus.
import { test, expect, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Ordenes } from './Ordenes.jsx';
import { resetDemo } from './useTaller.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { localStorage.clear(); resetDemo(); });

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const btn = (root, txt) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(txt));

test('lista las OT de ejemplo y abre una correctiva nueva', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<Ordenes sel={undefined} onSel={() => {}} />); });
  expect(host.textContent).toContain('OT-00010');

  click(btn(host, 'Nueva OT'));
  const falla = host.querySelector('input[placeholder^="Ruido"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(falla, 'Ruido en la transmisión');
    falla.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { btn(host, 'Abrir orden').click(); });
  expect(host.textContent).toContain('Ruido en la transmisión');

  click(btn(host, 'Iniciar diagnóstico'));
  expect(host.textContent).toContain('Iniciar reparación');
  root.unmount();
});
