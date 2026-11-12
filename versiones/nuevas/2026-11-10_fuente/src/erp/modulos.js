// Módulos de la pantalla ERP y quién los ve. Se decide por permiso (los que manda la API en /session), no por el nombre del rol:
//   admin (solo lectura) → supervision, ver_taller, combustible   → Resumen, Tractores, Costeo de diésel, Informes, Taller
//   jefe_taller          → ver_taller, editar_taller              → Taller
import { permiso } from '../lib/roles.js';
import { ico } from '../ui/menuIcons.js';

export const TALLER_TABS = [['tablero', 'Tablero'], ['ordenes', 'Órdenes de trabajo'], ['almacen', 'Almacén'], ['kpis', 'Costos y KPIs']];

// Cada módulo tiene su ícono SVG a color (src/assets/menu), el mismo en la barra lateral y en la cabecera.
export const MODULOS = [
  { id: 'resumen', path: '/', label: 'Resumen', need: 'supervision', svg: ico('tablero') },
  { id: 'tractores', path: '/tractores', label: 'Tractores', need: 'supervision', svg: ico('tractores') },
  { id: 'costeo', path: '/costeo', label: 'Costeo de diésel', need: 'combustible', svg: ico('costeo') },
  { id: 'informes', path: '/informes', label: 'Informes', need: 'supervision', svg: ico('informes') },
  { id: 'taller', path: '/taller', label: 'Taller', need: 'ver_taller', hijos: TALLER_TABS, svg: ico('taller') },
];

export const modulosDe = (user) => MODULOS.filter((m) => permiso(user, m.need));

/** Ruta (hash) a la que entra cada cuenta: el primer módulo que puede ver. */
export function inicioDe(user) {
  const m = modulosDe(user)[0];
  return m ? m.path + (m.hijos ? `/${m.hijos[0][0]}` : '') : '/perfil';
}
