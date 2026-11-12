// Roles del panel (los mismos de panel-flota-api/src/roles.mjs). Sin nombres de personas: cada cuenta recibe su rol desde Accounts.
// «user» es el nombre antiguo de «operador».
export const ROLE_LABEL = {
  super_admin: 'Super administrador',
  admin: 'Administrador',
  jefe_taller: 'Jefe de taller',
  operador: 'Operador',
  pendiente: 'Pendiente de aprobación',
  user: 'Operador',
};
export const roleLabel = (r) => ROLE_LABEL[r] || r || 'Operador';

/** Lista para un selector: [{ id, label }] sin el alias antiguo. La API la entrega en GET /roles; esta es la de respaldo. */
export const ROLES_BASE = Object.entries(ROLE_LABEL).filter(([id]) => id !== 'user').map(([id, label]) => ({ id, label }));

// Qué permite cada permiso que devuelve /session (permissions).
export const PERMISO_TXT = {
  panel_completo: 'Entrar al panel completo: mapa, lotes, alertas y todo lo demás',
  usuarios: 'Gestionar cuentas, roles e invitaciones',
  supervision: 'Ver la pantalla de supervisión (solo lectura): Tractores, Costeo de diésel, Informes y Taller',
  ver_taller: 'Ver el Taller: Tablero, Órdenes de trabajo, Almacén y Costos y KPIs',
  editar_taller: 'Capturar y editar en el Taller',
  combustible: 'Ver el Costeo de diésel (resumen y eventos de combustible)',
  bot: 'Usar el bot: consultar, preguntar y agregar',
  ajustes_tractores: 'Editar los ajustes de los tractores',
  ajustes_lotes: 'Editar los ajustes de lotes y cercas',
};

// Cuenta recién registrada: la API no le deja ver nada hasta que un administrador le asigne un rol.
export const esPendiente = (u) => !!u && (u.pending === true || u.role === 'pendiente');

// ¿Tiene este permiso? El super administrador siempre. Si la sesión no trae `permissions` (datos simulados o una API anterior
// a los roles) no se restringe nada.
export const permiso = (u, p) => u?.role === 'super_admin' || (Array.isArray(u?.permissions) ? u.permissions.includes(p) : true);

export const puedePanel = (u) => !!u && !esPendiente(u) && permiso(u, 'panel_completo');
export const puedeBot = (u) => !!u && !esPendiente(u) && (permiso(u, 'bot') || permiso(u, 'panel_completo'));
// Pantalla ERP (supervisión de solo lectura para admin; Taller para el jefe de taller).
export const puedeErp = (u) => !!u && !esPendiente(u) && (permiso(u, 'supervision') || permiso(u, 'ver_taller'));
// El admin solo supervisa: es una vista ERP sin permiso de captura.
export const esSoloLectura = (u) => puedeErp(u) && !puedePanel(u) && !permiso(u, 'editar_taller');

/** Qué pantalla le toca a cada cuenta: 'panel' | 'erp' | 'bot' | 'pendiente' (también si su rol no tiene ninguna) | null (sin sesión). */
export function vistaDe(u) {
  if (!u) return null;
  if (esPendiente(u)) return 'pendiente';
  if (puedePanel(u)) return 'panel';
  if (puedeErp(u)) return 'erp';
  if (puedeBot(u)) return 'bot';
  return 'pendiente';
}

export const permisosDe = (user) => (esPendiente(user) ? [] : (user?.permissions || []).map((p) => PERMISO_TXT[p]).filter(Boolean));
