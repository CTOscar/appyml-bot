// Prueba de humo de «Mi perfil»: validación, cambios pendientes, contraseña actual y aviso de errores de la API.
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { AuthProvider, useAuth } from '../app/auth.jsx';
import { Perfil } from './Perfil.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const USER = { id: 1, name: 'Ana Pérez', email: 'ana@rancho.mx', phone: '', role: 'jefe_taller', hasPassword: true, permissions: ['ver_taller', 'editar_taller'], createdAt: '2026-01-05T10:00:00Z', lastLoginAt: '2026-11-12T08:00:00Z', attributes: {} };

function cliente(extra = {}) {
  return {
    getSession: async () => USER, login: async () => USER, logout: async () => null,
    updateUser: vi.fn(async (u) => ({ ...USER, name: u.name, email: u.email, phone: u.phone, attributes: u.attributes })),
    getPhoto: async () => null, setPhoto: vi.fn(async () => null), removePhoto: vi.fn(async () => null),
    ...extra,
  };
}
// La app solo pinta Perfil con la sesión ya cargada; aquí se espera igual.
function Sesion() { const { user } = useAuth(); return user ? <Perfil /> : null; }
async function montar(client) {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<AuthProvider client={client}><Sesion /></AuthProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  return { host, root };
}
const campo = (host, etiqueta) => { const l = [...host.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(etiqueta)); return l && host.querySelector('#' + CSS.escape(l.htmlFor)); };
const escribir = (el, v) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); });
const boton = (host, txt) => [...host.querySelectorAll('button')].find((b) => b.textContent.trim().includes(txt));

describe('<Perfil>', () => {
  it('muestra rol, fechas y lo que permite el rol', async () => {
    const { host, root } = await montar(cliente());
    expect(host.textContent).toContain('Jefe de taller');
    expect(host.textContent).toContain('Miembro desde');
    expect(host.textContent).toContain('Capturar y editar en el Taller');
    root.unmount();
  });

  it('«Guardar» solo se activa con cambios; valida y permite descartar', async () => {
    const c = cliente(); const { host, root } = await montar(c);
    expect(boton(host, 'Guardar cambios').disabled).toBe(true);
    await escribir(campo(host, 'Nombre'), 'A');
    expect(boton(host, 'Guardar cambios').disabled).toBe(false);
    await act(async () => { boton(host, 'Guardar cambios').click(); });
    expect(host.textContent).toContain('Escribe tu nombre');
    expect(c.updateUser).not.toHaveBeenCalled();
    await act(async () => { boton(host, 'Descartar').click(); });
    expect(campo(host, 'Nombre').value).toBe('Ana Pérez');
    expect(boton(host, 'Guardar cambios').disabled).toBe(true);
    root.unmount();
  });

  it('guarda nombre, puesto y teléfono (el puesto va en attributes)', async () => {
    const c = cliente(); const { host, root } = await montar(c);
    await escribir(campo(host, 'Nombre'), 'Ana María Pérez');
    await escribir(campo(host, 'Puesto'), 'Gerente');
    await escribir(campo(host, 'Teléfono'), '+52 694 951 1587');
    await act(async () => { boton(host, 'Guardar cambios').click(); await new Promise((r) => setTimeout(r, 10)); });
    expect(c.updateUser).toHaveBeenCalledTimes(1);
    expect(c.updateUser.mock.calls[0][0]).toMatchObject({ id: 1, name: 'Ana María Pérez', phone: '+52 694 951 1587', attributes: { puesto: 'Gerente' } });
    expect(host.textContent).toContain('Cambios guardados.');
    expect(boton(host, 'Guardar cambios').disabled).toBe(true); // el formulario quedó igual a lo guardado
    root.unmount();
  });

  it('cambiar la contraseña pide la actual y la manda a la API', async () => {
    const c = cliente(); const { host, root } = await montar(c);
    await escribir(campo(host, 'Contraseña nueva'), 'Nueva1234!');
    await escribir(campo(host, 'Repite la nueva'), 'Nueva1234!');
    await act(async () => { boton(host, 'Cambiar contraseña').click(); });
    expect(host.textContent).toContain('Escribe tu contraseña actual.');
    expect(c.updateUser).not.toHaveBeenCalled();
    await escribir(campo(host, 'Contraseña actual'), 'Vieja1234!');
    await act(async () => { boton(host, 'Cambiar contraseña').click(); await new Promise((r) => setTimeout(r, 10)); });
    expect(c.updateUser.mock.calls[0][0]).toMatchObject({ password: 'Nueva1234!', currentPassword: 'Vieja1234!' });
    expect(host.textContent).toContain('Cerramos tus otras sesiones');
    root.unmount();
  });

  it('si la API rechaza la contraseña actual muestra su mensaje', async () => {
    const c = cliente({ updateUser: vi.fn(async () => { throw Object.assign(new Error('La contraseña actual no es correcta'), { status: 403 }); }) });
    const { host, root } = await montar(c);
    await escribir(campo(host, 'Contraseña actual'), 'Mala1234!');
    await escribir(campo(host, 'Contraseña nueva'), 'Nueva1234!');
    await escribir(campo(host, 'Repite la nueva'), 'Nueva1234!');
    await act(async () => { boton(host, 'Cambiar contraseña').click(); await new Promise((r) => setTimeout(r, 10)); });
    expect(host.textContent).toContain('La contraseña actual no es correcta');
    root.unmount();
  });

  it('una cuenta sin contraseña (Google/Apple) puede crearla sin pedir la actual', async () => {
    const c = cliente({ getSession: async () => ({ ...USER, hasPassword: false }) }); const { host, root } = await montar(c);
    expect(host.textContent).toContain('Crear contraseña');
    expect(campo(host, 'Contraseña actual')).toBeFalsy();
    root.unmount();
  });
});
