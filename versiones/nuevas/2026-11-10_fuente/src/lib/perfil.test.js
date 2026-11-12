import { describe, expect, it } from 'vitest';
import { atributosCon, formDe, hayCambios, normalizaTelefono, textoError, validarClave, validarPerfil } from './perfil.js';
import { ROLES_BASE, permisosDe, roleLabel } from './roles.js';
import { bytesDeDataUrl, cropRect, initials, panDelta, validarArchivoImagen } from './photo.js';

describe('validar el perfil', () => {
  const ok = { name: 'Ana Pérez', email: 'ana@rancho.mx', phone: '+52 1 694 951 1587', puesto: 'Gerente' };
  it('acepta datos correctos y no exige teléfono ni puesto', () => {
    expect(validarPerfil(ok)).toEqual({});
    expect(validarPerfil({ ...ok, phone: '', puesto: '' })).toEqual({});
  });
  it('marca nombre, correo y teléfono incorrectos', () => {
    const e = validarPerfil({ name: ' A ', email: 'ana@', phone: '123', puesto: 'x'.repeat(81) });
    expect(Object.keys(e).sort()).toEqual(['email', 'name', 'phone', 'puesto']);
  });
  it('limpia el teléfono sin tocar el formato válido', () => {
    expect(normalizaTelefono('  +52 (694) 951-1587 ext.3 abc ')).toBe('+52 (694) 951-1587 .3');
    expect(normalizaTelefono('6941234567')).toBe('6941234567');
  });
});

describe('cambios pendientes', () => {
  const user = { name: 'Ana', email: 'a@x.mx', phone: '', attributes: { puesto: 'Gerente', otro: 1 } };
  it('formDe toma el puesto de attributes', () => {
    expect(formDe(user)).toEqual({ name: 'Ana', email: 'a@x.mx', phone: '', puesto: 'Gerente' });
  });
  it('ignora espacios al inicio y al final', () => {
    expect(hayCambios(formDe(user), { ...formDe(user), name: ' Ana ' })).toBe(false);
    expect(hayCambios(formDe(user), { ...formDe(user), phone: '6941234567' })).toBe(true);
  });
  it('atributosCon conserva lo demás y quita el puesto vacío', () => {
    expect(atributosCon(user, 'Jefe')).toEqual({ puesto: 'Jefe', otro: 1 });
    expect(atributosCon(user, '  ')).toEqual({ otro: 1 });
  });
});

describe('cambiar contraseña', () => {
  it('pide la actual solo si la cuenta ya tiene contraseña', () => {
    expect(validarClave({ actual: '', nueva: 'Nueva1234!', repite: 'Nueva1234!', requiereActual: true }).actual).toBeTruthy();
    expect(validarClave({ actual: '', nueva: 'Nueva1234!', repite: 'Nueva1234!', requiereActual: false })).toEqual({});
  });
  it('exige requisitos, que no sea igual a la actual y que coincidan', () => {
    expect(validarClave({ actual: 'Vieja1234!', nueva: 'corta', repite: 'corta', requiereActual: true }).nueva).toMatch(/requisitos/);
    expect(validarClave({ actual: 'Vieja1234!', nueva: 'Vieja1234!', repite: 'Vieja1234!', requiereActual: true }).nueva).toMatch(/distinta/);
    expect(validarClave({ actual: 'Vieja1234!', nueva: 'Nueva1234!', repite: 'Otra1234!', requiereActual: true }).repite).toMatch(/coinciden/);
    expect(validarClave({ actual: 'Vieja1234!', nueva: 'Nueva1234!', repite: 'Nueva1234!', requiereActual: true })).toEqual({});
  });
});

describe('textos de error', () => {
  it('traduce sesión vencida, límite de intentos y red caída', () => {
    expect(textoError({ status: 401 })).toMatch(/sesión expiró/);
    expect(textoError({ status: 429 })).toMatch(/Demasiados/);
    expect(textoError(new TypeError('Failed to fetch'))).toMatch(/API del panel/);
    expect(textoError(Object.assign(new Error('La foto pesa demasiado'), { status: 413 }))).toBe('La foto pesa demasiado');
    expect(textoError(null, 'Falló')).toBe('Falló');
  });
});

describe('roles', () => {
  it('etiquetas y el alias antiguo «user»', () => {
    expect(roleLabel('jefe_taller')).toBe('Jefe de taller');
    expect(roleLabel('super_admin')).toBe('Super administrador');
    expect(roleLabel('user')).toBe('Operador');
    expect(ROLES_BASE.map((r) => r.id)).toEqual(['super_admin', 'admin', 'jefe_taller', 'operador', 'pendiente']);
  });
  it('permisos legibles (los desconocidos se ignoran)', () => {
    const t = permisosDe({ permissions: ['combustible', 'editar_taller', 'desconocido'] });
    expect(t).toHaveLength(2);
    expect(t[0]).toMatch(/diésel/);
  });
});

describe('foto: encuadre', () => {
  it('cropRect centra por defecto y respeta el zoom', () => {
    expect(cropRect(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
    expect(cropRect(400, 200, 2)).toEqual({ sx: 150, sy: 50, side: 100 });
  });
  it('dx y dy llevan el recorte a los bordes y se limitan a −1…1', () => {
    expect(cropRect(400, 200, 2, -1, -1)).toEqual({ sx: 0, sy: 0, side: 100 });
    expect(cropRect(400, 200, 2, 1, 1)).toEqual({ sx: 300, sy: 100, side: 100 });
    expect(cropRect(400, 200, 2, 9, -9)).toEqual({ sx: 300, sy: 0, side: 100 });
  });
  it('el zoom no baja de 1 ni pasa de 4', () => {
    expect(cropRect(200, 200, 0.2).side).toBe(200);
    expect(cropRect(200, 200, 99).side).toBe(50);
  });
  it('panDelta: arrastrar a la derecha mueve el recorte a la izquierda; sin margen no hay cambio', () => {
    expect(panDelta(200, 200, 288, 28.8)).toBeLessThan(0);
    expect(panDelta(0, 200, 288, 50)).toBe(0);
    expect(panDelta(200, 200, 0, 50)).toBe(0);
  });
  it('bytesDeDataUrl estima el tamaño real', () => {
    expect(bytesDeDataUrl('data:image/jpeg;base64,' + 'A'.repeat(400))).toBe(300);
  });
  it('valida tipo, HEIC y tamaño del archivo', () => {
    expect(validarArchivoImagen({ type: 'image/png', size: 1000, name: 'a.png' })).toBeNull();
    expect(validarArchivoImagen({ type: 'image/heic', size: 1000, name: 'a.heic' })).toMatch(/HEIC/);
    expect(validarArchivoImagen({ type: 'application/pdf', size: 10, name: 'a.pdf' })).toMatch(/JPG, PNG o WebP/);
    expect(validarArchivoImagen({ type: 'image/jpeg', size: 13 * 1024 * 1024, name: 'a.jpg' })).toMatch(/12 MB/);
    expect(validarArchivoImagen(null)).toBeTruthy();
  });
  it('iniciales', () => {
    expect(initials('oscar antonio macias')).toBe('OA');
    expect(initials('')).toBe('?');
  });
});
