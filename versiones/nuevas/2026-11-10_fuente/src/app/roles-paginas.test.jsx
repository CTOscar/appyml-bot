// Qué pantalla ve cada rol:
//   super_admin = panel completo · admin = ERP de supervisión (solo lectura) · jefe_taller = ERP del Taller · operador = bot
//   pendiente = nada hasta que se le asigne un rol.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

// El ERP monta páginas pesadas (mapas, 3D, gráficas); aquí solo se prueba qué rol ve qué.
vi.mock('../fleet/FleetProvider.jsx', () => ({
  FleetProvider: ({ children }) => children,
  useFleet: () => ({ snap: { devices: new Map(), positions: new Map(), engineToday: new Map(), events: [], geofences: [], loaded: true, mode: 'mock' }, store: {} }),
}));
for (const [ruta, nombre] of [['Tractores', 'Tractores'], ['Costeo', 'Costeo'], ['Informes', 'Informes'], ['Perfil', 'Perfil']]) {
  vi.doMock(`../pages/${ruta}.jsx`, () => ({ [nombre]: () => <div>página {nombre}</div> }));
}
vi.mock('../pages/Taller.jsx', () => ({ Taller: ({ route, tabs }) => <div>página Taller pestañas: {tabs.join(',')} ruta: {route.rest[0] || ''}</div> }));
vi.mock('../erp/Resumen.jsx', () => ({ Resumen: () => <div>página Resumen</div> }));

const { App } = await import('../App.jsx');
const { esPendiente, esSoloLectura, permisosDe, puedeBot, puedePanel, puedeErp, vistaDe } = await import('../lib/roles.js');
const { modulosDe, inicioDe } = await import('../erp/modulos.js');
const { mutate, setSoloLectura } = await import('../taller/useTaller.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const base = { id: 5, name: 'Persona', email: 'persona@rancho.mx', attributes: {}, hasPassword: true, pending: false };
const PENDIENTE = { ...base, role: 'pendiente', pending: true, permissions: [] };
const OPERADOR = { ...base, role: 'operador', permissions: ['bot'] };
const JEFE = { ...base, role: 'jefe_taller', permissions: ['ver_taller', 'editar_taller'] };
const ADMIN = { ...base, role: 'admin', permissions: ['supervision', 'ver_taller', 'combustible'] };
const SUPER = { ...base, role: 'super_admin', permissions: ['panel_completo', 'usuarios', 'supervision', 'ver_taller', 'editar_taller', 'combustible', 'bot', 'ajustes_tractores', 'ajustes_lotes'] };

describe('pantalla por rol (lib/roles.js)', () => {
  it('vistaDe', () => {
    expect(vistaDe(SUPER)).toBe('panel');
    expect(vistaDe(ADMIN)).toBe('erp');
    expect(vistaDe(JEFE)).toBe('erp');
    expect(vistaDe(OPERADOR)).toBe('bot');
    expect(vistaDe(PENDIENTE)).toBe('pendiente');
    expect(vistaDe(null)).toBe(null);
    expect(vistaDe({ ...base, role: 'raro', permissions: [] })).toBe('pendiente'); // un rol sin ninguna pantalla no ve nada
  });
  it('solo el super administrador entra al panel completo, aunque la API no liste panel_completo', () => {
    expect(puedePanel(SUPER)).toBe(true);
    expect(puedePanel({ ...SUPER, permissions: ['usuarios'] })).toBe(true);
    for (const u of [ADMIN, JEFE, OPERADOR, PENDIENTE]) expect(puedePanel(u)).toBe(false);
  });
  it('solo el admin es de solo lectura', () => {
    expect(esSoloLectura(ADMIN)).toBe(true);
    for (const u of [SUPER, JEFE, OPERADOR, PENDIENTE]) expect(esSoloLectura(u)).toBe(false);
  });
  it('el ERP es para admin y jefe de taller; el bot, para el operador', () => {
    expect(puedeErp(ADMIN) && puedeErp(JEFE)).toBe(true);
    expect(puedeErp(OPERADOR)).toBe(false);
    expect(puedeBot(OPERADOR)).toBe(true);
    expect(puedeBot(ADMIN) || puedeBot(JEFE)).toBe(false);
  });
  it('pendiente no ve nada y no tiene permisos legibles', () => {
    expect(esPendiente(PENDIENTE)).toBe(true);
    expect(esPendiente({ role: 'pendiente' })).toBe(true);
    expect([puedePanel, puedeBot, puedeErp].every((f) => f(PENDIENTE) === false)).toBe(true);
    expect(permisosDe(PENDIENTE)).toEqual([]);
  });
  it('sin sesión no hay acceso; sin `permissions` (datos simulados) no se restringe el panel', () => {
    expect(puedePanel(null)).toBe(false);
    expect(vistaDe({ role: 'user' })).toBe('panel');
  });
});

describe('módulos del ERP', () => {
  it('el admin ve Resumen, Tractores, Costeo de diésel, Informes y Taller', () => {
    expect(modulosDe(ADMIN).map((m) => m.label)).toEqual(['Resumen', 'Tractores', 'Costeo de diésel', 'Informes', 'Taller']);
    expect(inicioDe(ADMIN)).toBe('/');
  });
  it('el jefe de taller solo ve el Taller (Tablero, Órdenes, Almacén y Costos y KPIs)', () => {
    const m = modulosDe(JEFE);
    expect(m.map((x) => x.label)).toEqual(['Taller']);
    expect(m[0].hijos.map((h) => h[1])).toEqual(['Tablero', 'Órdenes de trabajo', 'Almacén', 'Costos y KPIs']);
    expect(inicioDe(JEFE)).toBe('/taller/tablero');
  });
});

describe('taller en solo lectura', () => {
  it('ignora la captura de una persona pero deja pasar la sincronización interna', () => {
    const captura = vi.fn(), sistema = vi.fn();
    setSoloLectura(true);
    mutate(captura);
    mutate(sistema, { sistema: true });
    setSoloLectura(false);
    expect(captura).not.toHaveBeenCalled();
    expect(sistema).toHaveBeenCalledTimes(1);
    const libre = vi.fn();
    mutate(libre);
    expect(libre).toHaveBeenCalledTimes(1);
  });
});

function cliente(yo) {
  return {
    getSession: vi.fn(async () => yo), logout: vi.fn(async () => null), login: vi.fn(async () => yo),
    socialProviders: async () => ({}),
  };
}
async function montar(client) {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<App client={client} />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  return { host, root };
}
const boton = (host, txt) => [...host.querySelectorAll('button')].find((b) => b.textContent.trim().includes(txt));

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); window.location.hash = ''; setSoloLectura(false); });

describe('<App> según el rol', () => {
  it('pendiente: pantalla de aprobación, sin barra ni páginas; revisar vuelve a pedir la sesión', async () => {
    const c = cliente(PENDIENTE);
    const { host, root } = await montar(c);
    expect(host.textContent).toContain('Tu cuenta está pendiente de aprobación');
    expect(host.textContent).toContain('persona@rancho.mx');
    expect(host.querySelector('nav, #contenido, #erp-contenido')).toBeNull();
    c.getSession.mockClear();
    await act(async () => { boton(host, 'Revisar de nuevo').click(); });
    expect(c.getSession).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Todavía no tienes un rol asignado');
    root.unmount();
  });

  it('pendiente que ya recibió rol: al revisar deja la pantalla de aprobación', async () => {
    const c = cliente(PENDIENTE);
    const { host, root } = await montar(c);
    c.getSession.mockResolvedValue(OPERADOR);
    await act(async () => { boton(host, 'Revisar de nuevo').click(); });
    expect(host.textContent).not.toContain('Tu cuenta está pendiente de aprobación');
    root.unmount();
  });

  it('pendiente: «Salir» cierra la sesión', async () => {
    const c = cliente(PENDIENTE);
    const { host, root } = await montar(c);
    await act(async () => { boton(host, 'Salir').click(); });
    expect(c.logout).toHaveBeenCalled();
    root.unmount();
  });

  it('operador: se le manda al bot, no ve el panel ni el ERP', async () => {
    const { host, root } = await montar(cliente(OPERADOR));
    expect(host.textContent).toContain('Abriendo el bot');
    expect(host.querySelector('#erp-contenido, #contenido')).toBeNull();
    root.unmount();
  });

  it('admin: entra al ERP de supervisión en solo lectura, con sus cinco módulos', async () => {
    const { host, root } = await montar(cliente(ADMIN));
    expect(host.querySelector('#erp-contenido')).toBeTruthy();
    expect(host.textContent).toContain('Solo lectura');
    expect(host.textContent).toContain('página Resumen');
    const lateral = host.querySelector('nav[aria-label="Módulos"]').textContent;
    for (const m of ['Resumen', 'Tractores', 'Costeo de diésel', 'Informes', 'Taller']) expect(lateral).toContain(m);
    expect(host.textContent).not.toContain('Accounts');
    expect(host.textContent).not.toContain('Abriendo el bot');
    root.unmount();
  });

  it('admin: el Taller del ERP no incluye Automatización y la captura queda bloqueada', async () => {
    window.location.hash = '#/taller/ordenes';
    const { host, root } = await montar(cliente(ADMIN));
    expect(host.textContent).toContain('pestañas: tablero,ordenes,almacen,kpis');
    expect(host.textContent).not.toContain('auto');
    const captura = vi.fn();
    mutate(captura);
    expect(captura).not.toHaveBeenCalled();
    root.unmount();
  });

  it('jefe de taller: entra directo al Taller, con captura y sin el aviso de solo lectura', async () => {
    const { host, root } = await montar(cliente(JEFE));
    expect(window.location.hash).toBe('#/taller/tablero');
    expect(host.textContent).not.toContain('Solo lectura');
    const lateral = host.querySelector('nav[aria-label="Módulos"]').textContent;
    expect(lateral).toContain('Taller');
    expect(lateral).toContain('Órdenes de trabajo');
    for (const no of ['Tractores', 'Costeo de diésel', 'Informes', 'Resumen']) expect(lateral).not.toContain(no);
    const captura = vi.fn();
    mutate(captura);
    expect(captura).toHaveBeenCalledTimes(1);
    root.unmount();
  });

  it('jefe de taller: una ruta que no le toca lo regresa al Taller', async () => {
    window.location.hash = '#/costeo';
    const { host, root } = await montar(cliente(JEFE));
    expect(window.location.hash).toBe('#/taller/tablero');
    expect(host.textContent).not.toContain('página Costeo');
    root.unmount();
  });
});
