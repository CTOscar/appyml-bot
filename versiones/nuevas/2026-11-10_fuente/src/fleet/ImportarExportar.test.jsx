// Prueba de humo del flujo de importar lotes: elegir archivo → vista previa → confirmar → se crean.
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ImportarExportar } from './ImportarExportar.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const GEOJSON = JSON.stringify({ type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { name: 'Pozo 1' }, geometry: { type: 'Polygon', coordinates: [[[-105.9, 22.7], [-105.89, 22.7], [-105.89, 22.71], [-105.9, 22.7]]] } },
  { type: 'Feature', properties: { name: 'El Álamo · Lote 1' }, geometry: { type: 'Polygon', coordinates: [[[-105.9, 22.7], [-105.89, 22.7], [-105.89, 22.71], [-105.9, 22.7]]] } },
] });

function montar(extra = {}) {
  const tools = { getExport: vi.fn(() => ({ tracks: [], lotes: [] })), previewLotes: vi.fn(), clearPreview: vi.fn() };
  const store = { getSnapshot: () => ({ mode: 'mock', geofences: [{ name: 'El Álamo · Lote 1' }] }), canCreateFence: () => true, addFence: vi.fn(async () => ({})), ...extra };
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  return { tools, store, host, root, render: () => act(async () => { root.render(<ImportarExportar tools={tools} store={store} />); }) };
}
const boton = (host, txt) => [...host.querySelectorAll('button')].find((b) => b.textContent.includes(txt));
async function elegir(host, nombre, contenido) {
  const input = host.querySelector('input[type=file]');
  const file = new File([contenido], nombre, { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 20)); });
}

describe('<ImportarExportar>', () => {
  it('muestra la vista previa omitiendo lotes repetidos y crea solo al confirmar', async () => {
    const m = montar(); await m.render();
    await elegir(m.host, 'lotes.geojson', GEOJSON);
    expect(m.tools.previewLotes).toHaveBeenCalledTimes(1);
    expect(m.tools.previewLotes.mock.calls[0][0].map((l) => l.name)).toEqual(['Pozo 1']);
    expect(m.host.textContent).toContain('1 lote(s) nuevos');
    expect(m.host.textContent).toContain('1 se omiten porque ya existe');
    expect(m.store.addFence).not.toHaveBeenCalled(); // nada se crea sin confirmar
    await act(async () => { boton(m.host, 'Crear 1 lote').click(); await new Promise((r) => setTimeout(r, 10)); });
    expect(m.store.addFence).toHaveBeenCalledTimes(1);
    expect(m.store.addFence.mock.calls[0][0].area).toMatch(/^POLYGON\(\(22\.700000 -105\.900000,/);
    expect(m.host.textContent).toContain('Se crearon 1 lote(s)');
    m.root.unmount();
  });
  it('cancelar quita la vista previa y no crea nada', async () => {
    const m = montar(); await m.render();
    await elegir(m.host, 'lotes.geojson', GEOJSON);
    await act(async () => { boton(m.host, 'Cancelar').click(); });
    expect(m.tools.clearPreview).toHaveBeenCalled();
    expect(m.store.addFence).not.toHaveBeenCalled();
    expect(m.host.textContent).not.toContain('lote(s) nuevos');
    m.root.unmount();
  });
  it('un archivo sin polígonos muestra el error', async () => {
    const m = montar(); await m.render();
    await elegir(m.host, 'x.geojson', JSON.stringify({ type: 'Point', coordinates: [0, 0] }));
    expect(m.host.textContent).toContain('No encontré polígonos');
    expect(m.tools.previewLotes).not.toHaveBeenCalled();
    m.root.unmount();
  });
  it('en modo real advierte que se crean geocercas en Traccar', async () => {
    const m = montar({ getSnapshot: () => ({ mode: 'traccar', geofences: [] }) }); await m.render();
    await elegir(m.host, 'lotes.geojson', GEOJSON);
    expect(m.host.textContent).toContain('geocercas reales en Traccar');
    m.root.unmount();
  });
  it('exportar GPX sin recorridos avisa qué hacer', async () => {
    const m = montar(); await m.render();
    await act(async () => { boton(m.host, 'GPX').click(); });
    expect(m.host.textContent).toContain('No hay recorridos para exportar');
    m.root.unmount();
  });
});
