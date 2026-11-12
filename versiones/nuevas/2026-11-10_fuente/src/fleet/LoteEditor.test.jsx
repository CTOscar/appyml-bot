// Prueba de humo del editor de lotes: valida el nombre y guarda con store.saveFence.
import { test, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { LoteEditor } from './LoteEditor.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('guarda el lote con sus alertas y avisa', async () => {
  const store = { saveFence: vi.fn().mockResolvedValue({}) };
  const el = document.createElement('div'); document.body.append(el);
  const root = createRoot(el);
  const g = { id: 4, name: 'Lote 4', attributes: { cultivo: 'Maíz', alertaEntrada: true }, shape: {}, ha: 2 };
  await act(async () => root.render(<LoteEditor g={g} store={store} onClose={() => {}} />));
  expect(el.textContent).toContain('Alertas del lote');
  await act(async () => { el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(store.saveFence).toHaveBeenCalledTimes(1);
  expect(store.saveFence.mock.calls[0][0]).toMatchObject({ id: 4, name: 'Lote 4', attributes: { cultivo: 'Maíz', alertaEntrada: true } });
  expect(el.textContent).toContain('Lote guardado.');
  await act(async () => root.unmount());
});
