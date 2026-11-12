// Roles y permisos del panel. Para agregar un rol: una línea en ROLES y sus permisos en PERMISSIONS.
// Sin nombres de personas: a cada cuenta se le asigna su rol desde Accounts.
export const ROLES = {
  super_admin: 'Super administrador', // todo: panel completo, bot, cuentas y roles
  admin: 'Administrador',             // solo lectura: supervisión (Tractores, Costeo de diésel, Informes y Taller)
  jefe_taller: 'Jefe de taller',      // Taller: Tablero, Órdenes de trabajo, Almacén y Costos y KPIs (captura y edita)
  operador: 'Operador',               // el bot: consultar, preguntar y agregar
  pendiente: 'Pendiente de aprobación', // cuenta recién registrada: no ve nada hasta que le asignen un rol
};
export const SUPER_ROLE = 'super_admin';
export const READONLY_ROLE = 'admin';
export const PENDING_ROLE = 'pendiente';
export const DEFAULT_ROLE = 'operador'; // al que pasan las cuentas antiguas con rol 'user'

// Permiso -> roles que lo tienen. 'super_admin' siempre los tiene todos (ver can()).
const PERMISSIONS = {
  panel_completo: [],               // el panel completo y sus ajustes: solo super_admin
  usuarios: [],                     // lista de usuarios, roles, invitaciones, bitácora: solo super_admin
  supervision: ['admin'],           // pantalla ERP de solo lectura
  ver_taller: ['admin', 'jefe_taller'],
  editar_taller: ['jefe_taller'],
  combustible: ['admin'],           // resumen y eventos de combustible (Costeo de diésel), lectura
  bot: ['operador'],
  ajustes_tractores: [],            // editar tractores y lotes: solo super_admin
  ajustes_lotes: [],
};

// Acepta el nombre antiguo 'user' (cuentas anteriores a los roles).
export const normalizeRole = (r) => (r === 'user' ? DEFAULT_ROLE : r);
export const isRole = (r) => Object.hasOwn(ROLES, r);
export const can = (role, perm) => {
  const r = normalizeRole(role);
  return r === SUPER_ROLE || !!PERMISSIONS[perm]?.includes(r);
};
export const PERMISSION_IDS = Object.keys(PERMISSIONS);
// Para el selector y la matriz de permisos del panel: cada rol con lo que puede hacer.
export const roleList = () => Object.entries(ROLES).map(([id, label]) => ({ id, label, permissions: PERMISSION_IDS.filter((p) => can(id, p)) }));
