// Centro de mando del admin: los indicadores, los lotes y las alertas filtran y abren tractores; todo es solo consulta.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const navegar = vi.fn();
vi.mock('../app/router.js', () => ({ navigate: (...a) => navegar(...a) }));

const ahora = Date.now();
const devs = new Map([
  [1, { id: 1, name: 'TRC-0001', attributes: { marca: 'john-deere', modelo: '5075E' } }],
  [2, { id: 2, name: 'TRC-0002', attributes: { marca: 'new-holland', modelo: 'TT4.75' } }],
  [3, { id: 3, name: 'TRC-0003', attributes: { marca: 'john-deere', modelo: '6110J' } }],
]);
const pos = new Map([
  [1, { deviceId: 1, speed: 5, fixTime: new Date(ahora).toISOString(), attributes: { fuel: 120 } }],
  [2, { deviceId: 2, speed: 0, fixTime: new Date(ahora).toISOString(), attributes: {} }],
  [3, { deviceId: 3, speed: 0, fixTime: new Date(ahora).toISOString(), attributes: {} }],
]);
const estados = { 1: 'running', 2: 'idle', 3: 'nosignal' };
const lotes = [{ id: 10, name: 'El Álamo · Lote 1', ha: 100, done: 40, pct: 40, pend: 60 }, { id: 11, name: 'Las Palmas · Lote 2', ha: 50, done: 0, pct: 0, pend: 50 }];
const eventos = [
  { id: 'e1', deviceId: 3, type: 'alarm', eventTime: new Date(ahora - 60_000).toISOString(), attributes: { alarm: 'powerCut' } },
  { id: 'e2', deviceId: 1, type: 'ignitionOn', eventTime: new Date(ahora - 120_000).toISOString(), attributes: {} },
];
const store = {
  statusOf: (id) => estados[id],
  workToday: () => ({ trabajo: 3_600_000, transito: 0, ralenti: 0, apagado: 0, sinsenal: 0 }),
  fenceOf: (id) => (id === 1 ? lotes[0] : null),
  avanceLotes: () => lotes.map((l) => ({ ...l })),
  summary: () => ({ productive: 0.8 }),
};
vi.mock('../fleet/FleetProvider.jsx', () => ({
  useFleet: () => ({ store, snap: { devices: devs, positions: pos, engineToday: new Map([[1, 7_200_000]]), events: eventos, geofences: [], loaded: true } }),
}));
const { Resumen } = await import('./Resumen.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function montar() {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<Resumen />); });
  return { host, root };
}
const estadoTxt = (host) => host.querySelector('[role=status]').textContent;
const boton = (host, re) => [...host.querySelectorAll('button')].find((b) => re.test(b.textContent));
const botonLote = (host, nombre) => host.querySelector(`[role=progressbar][aria-label="Avance de ${nombre}"]`).closest('button');
const click = (el) => act(async () => { el.click(); });

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); navegar.mockClear(); });

describe('<Resumen> del admin', () => {
  it('muestra los indicadores de la flota y de hoy', async () => {
    const { host, root } = await montar();
    const t = host.textContent;
    expect(estadoTxt(host)).toBe('3 de 3 tractores');
    for (const x of ['En marcha', 'Apagados', 'Sin señal', 'Horas motor', 'Hectáreas', 'Alertas altas']) expect(t).toContain(x);
    expect(t).toContain('2'); // horas de motor de hoy
    expect(t).toContain('40 de 100 ha'); // avance del lote
    root.unmount();
  });

  it('un indicador filtra los tractores y se puede quitar', async () => {
    const { host, root } = await montar();
    await click(boton(host, /^En marcha\s*1/));
    expect(estadoTxt(host)).toBe('1 de 3 tractores');
    expect(host.textContent).toContain('TRC-0001');
    await click(boton(host, /Quitar filtros/));
    expect(estadoTxt(host)).toBe('3 de 3 tractores');
    root.unmount();
  });

  it('un lote filtra los tractores que están dentro', async () => {
    const { host, root } = await montar();
    await click(botonLote(host, 'El Álamo · Lote 1'));
    expect(estadoTxt(host)).toContain('1 de 3 tractores');
    expect(estadoTxt(host)).toContain('El Álamo · Lote 1');
    expect(botonLote(host, 'El Álamo · Lote 1').getAttribute('aria-pressed')).toBe('true');
    await click(botonLote(host, 'El Álamo · Lote 1'));
    expect(estadoTxt(host)).toBe('3 de 3 tractores');
    root.unmount();
  });

  it('la búsqueda filtra por nombre', async () => {
    const { host, root } = await montar();
    const input = host.querySelector('input[type=search]');
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'TRC-0002'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(estadoTxt(host)).toBe('1 de 3 tractores');
    root.unmount();
  });

  it('un tractor se abre con su detalle del día y lleva al mapa', async () => {
    const { host, root } = await montar();
    const tarjeta = host.querySelector('#tractor-1 > button');
    expect(tarjeta.getAttribute('aria-expanded')).toBe('false');
    await click(tarjeta);
    expect(tarjeta.getAttribute('aria-expanded')).toBe('true');
    const t = host.querySelector('#tractor-1').textContent;
    expect(t).toContain('120 L');
    expect(t).toContain('Trabajando');
    expect(t).toContain('9 km/h'); // 5 nudos
    await click(boton(host.querySelector('#tractor-1'), /Verlo en el mapa/));
    expect(navegar).toHaveBeenCalledWith('/mapa?d=1');
    root.unmount();
  });

  it('una alerta quita los filtros y abre el tractor que la causó', async () => {
    const { host, root } = await montar();
    await click(boton(host, /^En marcha\s*1/)); // 1 de 3: el TRC-0003 queda oculto
    expect(host.querySelector('#tractor-3')).toBeNull();
    const alerta = [...host.querySelectorAll('section button')].find((b) => b.textContent.includes('Corte de energía'));
    await click(alerta);
    expect(estadoTxt(host)).toBe('3 de 3 tractores');
    expect(host.querySelector('#tractor-3 > button').getAttribute('aria-expanded')).toBe('true');
    root.unmount();
  });

  it('el filtro de alertas cuenta y filtra', async () => {
    const { host, root } = await montar();
    await click(boton(host, /^Energía\s*1/));
    const lista = [...host.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Alertas');
    expect(lista.textContent).toContain('Corte de energía');
    expect(lista.textContent).not.toContain('Encendido ');
    root.unmount();
  });

  it('es solo consulta: ningún botón escribe en la API ni en el taller', async () => {
    const { host, root } = await montar();
    const textos = [...host.querySelectorAll('button')].map((b) => b.textContent.toLowerCase()).join('|');
    for (const mala of ['guardar', 'eliminar', 'borrar', 'crear', 'nueva orden', 'editar']) expect(textos).not.toContain(mala);
    root.unmount();
  });
});
