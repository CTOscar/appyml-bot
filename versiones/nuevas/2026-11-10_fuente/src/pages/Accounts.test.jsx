// Prueba de humo de «Accounts»: acceso por permiso, tablas, registros nuevos, cambio de rol, invitaciones y vista vertical.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { AuthProvider, useAuth } from '../app/auth.jsx';
import { Accounts } from './Accounts.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ADMIN = { id: 1, name: 'Ana Admin', email: 'ana@rancho.mx', role: 'super_admin', permissions: ['panel_completo', 'usuarios', 'supervision', 'ver_taller', 'editar_taller', 'combustible', 'bot', 'ajustes_tractores', 'ajustes_lotes'], hasPassword: true, attributes: {} };
const OPERADOR = { ...ADMIN, id: 9, role: 'operador', permissions: [] };
const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
const ROLES = [
  { id: 'super_admin', label: 'Super administrador', permissions: ['panel_completo', 'usuarios', 'supervision', 'ver_taller', 'editar_taller', 'combustible', 'bot', 'ajustes_tractores', 'ajustes_lotes'] },
  { id: 'admin', label: 'Administrador', permissions: ['supervision', 'ver_taller', 'combustible'] },
  { id: 'jefe_taller', label: 'Jefe de taller', permissions: ['ver_taller', 'editar_taller'] },
  { id: 'operador', label: 'Operador', permissions: [] },
];

function cliente(extra = {}, yo = ADMIN) {
  return {
    getSession: async () => yo, login: async () => yo, logout: async () => null,
    listUsers: vi.fn(async () => [
      { id: 1, name: 'Ana Admin', email: 'ana@rancho.mx', phone: '', role: 'super_admin', attributes: { puesto: 'Gerente' }, createdAt: hace(60 * 24 * 30), lastLoginAt: hace(5) },
      { id: 2, name: 'Beto Operador', email: 'beto@rancho.mx', phone: '+52 694 100 2000', role: 'operador', attributes: {}, createdAt: hace(10), lastLoginAt: null },
    ]),
    loginLog: vi.fn(async () => [
      { id: 3, userId: null, email: '+52 1 694 951 1587', ok: false, ip: '::1', createdAt: hace(2) },
      { id: 2, userId: 2, email: 'beto@rancho.mx', ok: true, ip: '10.0.0.5', createdAt: hace(30) },
      { id: 1, userId: 1, email: 'ana@rancho.mx', ok: true, ip: '::1', createdAt: hace(60 * 30) },
    ]),
    oauthAccounts: vi.fn(async () => []),
    invitations: vi.fn(async () => [{ id: 7, email: 'nuevo@rancho.mx', role: 'jefe_taller', createdAt: hace(60), expiresAt: new Date(Date.now() + 6 * 864e5).toISOString() }]),
    getRoles: vi.fn(async () => ROLES),
    setRole: vi.fn(async () => ({})),
    createInvitation: vi.fn(async ({ email, role }) => ({ id: 8, email, role, expiresInDays: 7, link: `http://localhost:5174/?invite=TOKEN&email=${email}` })),
    deleteInvitation: vi.fn(async () => null),
    ...extra,
  };
}
function Sesion() { const { user } = useAuth(); return user ? <Accounts /> : null; }
async function montar(client) {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<AuthProvider client={client}><Sesion /></AuthProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  return { host, root };
}
const boton = (host, txt) => [...host.querySelectorAll('button')].find((b) => b.textContent.trim().includes(txt));
const tab = (host, nombre) => [...host.querySelectorAll('[role=tab]')].find((b) => b.textContent.trim().startsWith(nombre));

beforeEach(() => { localStorage.clear(); });

describe('<Accounts>', () => {
  it('quien no es administrador no ve datos, solo el aviso', async () => {
    const c = cliente({}, OPERADOR);
    const { host, root } = await montar(c);
    expect(host.textContent).toContain('Solo para administradores');
    expect(c.listUsers).not.toHaveBeenCalled();
    root.unmount();
  });

  it('muestra la tabla users con columnas de la base, el pie y el resumen', async () => {
    const { host, root } = await montar(cliente());
    const t = host.textContent;
    expect(t).toContain('SELECT * FROM users ORDER BY id DESC;');
    ['last_login_at', 'created_at', 'permissions'].forEach((c) => expect(t).toContain(c));
    expect(t).toContain('beto@rancho.mx');
    expect(t).toContain('2 filas en el conjunto');
    expect(t).toContain('1 super administrador(es)');
    expect(t).toContain('NULL'); // Beto nunca ha entrado
    root.unmount();
  });

  it('login_log: cuenta rechazados de 24 h y filtra', async () => {
    const { host, root } = await montar(cliente());
    await act(async () => { tab(host, 'login_log').click(); });
    expect(host.textContent).toContain('0 · rechazado');
    expect(host.textContent).toContain('3 filas en el conjunto');
    await act(async () => { boton(host, 'Rechazados').click(); });
    expect(host.textContent).toContain('1 fila en el conjunto');
    root.unmount();
  });

  it('marca los registros nuevos desde la última visita', async () => {
    localStorage.setItem('pf-accounts-vistos-v1', JSON.stringify({ users: hace(20), login_log: hace(20), oauth_accounts: hace(20), invitations: hace(20) }));
    const { host, root } = await montar(cliente());
    expect(tab(host, 'users').textContent).toContain('+1'); // Beto se creó hace 10 min
    expect(host.textContent).toContain('1 registro nuevo desde tu última visita');
    expect(host.textContent).toContain('nuevo');
    await act(async () => { boton(host, 'Marcar los 1 registros nuevos como vistos').click(); });
    expect(tab(host, 'users').textContent).not.toContain('+1');
    root.unmount();
  });

  it('en la primera visita nada se marca como nuevo', async () => {
    const { host, root } = await montar(cliente());
    expect(host.textContent).not.toContain('desde tu última visita');
    root.unmount();
  });

  it('cambiar el rol de otra cuenta llama a la API y lo refleja', async () => {
    const c = cliente(); const { host, root } = await montar(c);
    const sel = host.querySelector('select[aria-label="Rol de beto@rancho.mx"]');
    expect(sel).toBeTruthy();
    expect(host.querySelector('select[aria-label="Rol de ana@rancho.mx"]')).toBeNull(); // la propia no se cambia
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'jefe_taller'); sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 10)); });
    expect(c.setRole).toHaveBeenCalledWith(2, 'jefe_taller');
    expect(host.textContent).toContain('Rol actualizado a Jefe de taller.');
    root.unmount();
  });

  it('invitaciones: valida el correo, crea y muestra el enlace una vez', async () => {
    const c = cliente(); const { host, root } = await montar(c);
    await act(async () => { tab(host, 'invitations').click(); });
    expect(host.textContent).toContain('nuevo@rancho.mx');
    const email = host.querySelector('input[type=email]');
    await act(async () => { boton(host, 'Crear invitación').click(); });
    expect(host.textContent).toContain('Escribe un correo válido.');
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(email, 'otra@rancho.mx'); email.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { boton(host, 'Crear invitación').click(); await new Promise((r) => setTimeout(r, 10)); });
    expect(c.createInvitation).toHaveBeenCalledWith({ email: 'otra@rancho.mx', role: 'operador' });
    expect(host.textContent).toContain('El enlace se muestra solo ahora');
    expect(host.textContent).toContain('invite=TOKEN');
    root.unmount();
  });

  it('revocar una invitación pide confirmación', async () => {
    const c = cliente(); const { host, root } = await montar(c);
    await act(async () => { tab(host, 'invitations').click(); });
    await act(async () => { boton(host, 'Revocar').click(); });
    expect(c.deleteInvitation).not.toHaveBeenCalled();
    await act(async () => { boton(host, 'Sí').click(); await new Promise((r) => setTimeout(r, 10)); });
    expect(c.deleteInvitation).toHaveBeenCalledWith(7);
    root.unmount();
  });

  it('roles y permisos: matriz con cuántas cuentas hay por rol', async () => {
    const { host, root } = await montar(cliente());
    await act(async () => { tab(host, 'roles').click(); });
    const t = host.textContent;
    expect(t).toContain('jefe_taller');
    expect(t).toContain('ajustes_tractores');
    const fila = [...host.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('operador'));
    expect(fila.textContent).toContain('1'); // Beto
    root.unmount();
  });

  it('tocar una fila la muestra en vertical (\\G)', async () => {
    const { host, root } = await montar(cliente());
    const fila = [...host.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('beto@rancho.mx'));
    await act(async () => { fila.click(); });
    const pre = host.querySelector('section[aria-label="Registro seleccionado"] pre');
    expect(pre.textContent).toContain('1. row');
    expect(pre.textContent).toMatch(/email: beto@rancho\.mx/);
    root.unmount();
  });

  it('si una tabla falla, las demás siguen y se ofrece reintentar', async () => {
    const c = cliente({ loginLog: vi.fn(async () => { throw Object.assign(new Error('boom'), { status: 500 }); }) });
    const { host, root } = await montar(c);
    expect(host.textContent).toContain('beto@rancho.mx'); // users sí cargó
    await act(async () => { tab(host, 'login_log').click(); });
    expect(host.textContent).toContain('boom');
    expect(boton(host, 'Reintentar')).toBeTruthy();
    root.unmount();
  });
});
