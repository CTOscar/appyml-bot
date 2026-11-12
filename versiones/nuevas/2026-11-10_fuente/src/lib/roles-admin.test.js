import { describe, expect, it } from 'vitest';
import { puedeBot, puedePanel } from './roles.js';

// Caso real: la API en marcha era anterior al permiso `panel_completo` y no lo listaba, y el panel mandaba al bot a quien debía entrar.
// Ahora el que siempre entra al panel completo es el super administrador; `admin` es el rol de solo lectura (pantalla ERP).
describe('el super administrador siempre entra al panel', () => {
  const SUPER_API_VIEJA = { id: 3, role: 'super_admin', pending: false, permissions: ['usuarios', 'ajustes_tractores', 'ajustes_lotes', 'combustible'] };
  it('aunque la API no mande panel_completo ni bot', () => {
    expect(puedePanel(SUPER_API_VIEJA)).toBe(true);
    expect(puedeBot(SUPER_API_VIEJA)).toBe(true);
  });
  it('el admin (solo lectura) no entra al panel completo aunque la lista traiga permisos de edición de una API vieja', () => {
    expect(puedePanel({ id: 4, role: 'admin', permissions: ['usuarios', 'ajustes_tractores'] })).toBe(false);
  });
  it('un super administrador pendiente (cuenta sin aprobar) no entra', () => {
    expect(puedePanel({ role: 'super_admin', pending: true, permissions: [] })).toBe(false);
  });
});
