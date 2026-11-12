// Reglas del formulario de «Mi perfil»: validación, cambios pendientes y contraseña. Puro, sin React.
import { passwordOk } from '../app/auth.jsx';

export const CAMPOS = ['name', 'email', 'phone', 'puesto'];
export const PUESTO_MAX = 80;

/** Valores iniciales del formulario a partir de la cuenta. «puesto» vive en attributes. */
export const formDe = (user) => ({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', puesto: user?.attributes?.puesto || '' });

/** Deja en el teléfono solo dígitos, +, espacios, paréntesis, guiones y puntos. */
export const normalizaTelefono = (s) => String(s || '').replace(/[^\d+()\-\s.]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

const digitos = (s) => String(s || '').replace(/\D/g, '');

/** → { campo: 'mensaje' } (vacío si todo está bien). El teléfono y el puesto son opcionales. */
export function validarPerfil({ name, email, phone, puesto }) {
  const e = {};
  if (String(name || '').trim().length < 2) e.name = 'Escribe tu nombre (mínimo 2 letras).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim())) e.email = 'Escribe un correo válido.';
  const n = digitos(phone).length;
  if (String(phone || '').trim() && (n < 7 || n > 15)) e.phone = 'El teléfono debe tener entre 7 y 15 dígitos.';
  if (String(puesto || '').trim().length > PUESTO_MAX) e.puesto = `Máximo ${PUESTO_MAX} caracteres.`;
  return e;
}

/** ¿Hay algo distinto entre el formulario y lo guardado? (se ignoran espacios al inicio y al final). */
export const hayCambios = (a, b) => CAMPOS.some((k) => String(a[k] ?? '').trim() !== String(b[k] ?? '').trim());

/** Atributos de la cuenta con el puesto actualizado (si queda vacío, se quita). */
export function atributosCon(user, puesto) {
  const a = { ...(user?.attributes || {}) };
  const p = String(puesto || '').trim();
  if (p) a.puesto = p; else delete a.puesto;
  return a;
}

/**
 * Cambio de contraseña. `requiereActual` = la cuenta ya tiene contraseña (las de Google/Apple no).
 * → { actual?, nueva?, repite? } con mensajes.
 */
export function validarClave({ actual, nueva, repite, requiereActual }) {
  const e = {};
  if (requiereActual && !actual) e.actual = 'Escribe tu contraseña actual.';
  if (!nueva) e.nueva = 'Escribe la contraseña nueva.';
  else if (!passwordOk(nueva)) e.nueva = 'La contraseña nueva no cumple los requisitos.';
  else if (requiereActual && actual && nueva === actual) e.nueva = 'La nueva contraseña debe ser distinta a la actual.';
  if (nueva && repite !== nueva) e.repite = 'Las contraseñas no coinciden.';
  return e;
}

/** Texto de un error de la API para mostrar a la persona (sesión vencida, red caída, etc.). */
export function textoError(e, porDefecto = 'No se pudo completar la acción.') {
  if (!e) return porDefecto;
  if (e.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (e.status === 429) return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
  if (e.name === 'TypeError' || /failed to fetch|networkerror/i.test(e.message || '')) return 'No se pudo conectar con la API del panel. ¿Está encendida?';
  return e.message || porDefecto;
}
