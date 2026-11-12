// Parámetros de operación guardados en el navegador (límites de velocidad, combustible, ancho del implemento y horario).
// Misma idea que pf-mapops-v1 del panel actual. El almacén de la flota los lee en cada lectura, así un cambio se aplica enseguida.
import { OPS_DEFAULTS } from './ops.js';

export const OPS_CFG_KEY = 'pf2-ops-cfg';
let cache = null;

const read = (storage) => {
  const c = { ...OPS_DEFAULTS };
  try {
    const s = JSON.parse(storage?.getItem(OPS_CFG_KEY) || '{}');
    for (const k of Object.keys(OPS_DEFAULTS)) if (typeof s[k] === typeof OPS_DEFAULTS[k] && (typeof s[k] !== 'number' || Number.isFinite(s[k]))) c[k] = s[k];
  } catch { /* configuración dañada: se usan los valores por defecto */ }
  return c;
};

export function getOps(storage = globalThis.localStorage) {
  if (!cache) cache = read(storage);
  return cache;
}
export function saveOps(patch, storage = globalThis.localStorage) {
  cache = { ...getOps(storage), ...patch };
  try { storage?.setItem(OPS_CFG_KEY, JSON.stringify(cache)); } catch { /* sin almacenamiento */ }
  return cache;
}
export function resetOps(storage = globalThis.localStorage) {
  cache = { ...OPS_DEFAULTS };
  try { storage?.removeItem(OPS_CFG_KEY); } catch { /* nada */ }
  return cache;
}
export const _forget = () => { cache = null; }; // solo para pruebas

// Límites razonables de cada parámetro (los mismos que valida el panel actual).
export const OPS_FIELDS = [
  { k: 'vmin', label: 'Velocidad mínima en movimiento', hint: 'Por debajo de este valor el tractor se considera parado.', unit: 'km/h', min: 0, max: 10, step: 0.5 },
  { k: 'ancho', label: 'Ancho del implemento', hint: 'Sirve para calcular la superficie trabajada.', unit: 'm', min: 1, max: 60, step: 0.5 },
  { k: 'vLote', label: 'Límite de velocidad dentro de un lote', hint: 'Al pasarlo se genera una alerta de exceso de velocidad.', unit: 'km/h', min: 1, max: 60, step: 1 },
  { k: 'vTrans', label: 'Límite de velocidad en tránsito', hint: 'Se aplica fuera de los lotes (caminos).', unit: 'km/h', min: 1, max: 80, step: 1 },
  { k: 'fuelL', label: 'Cambio mínimo de combustible para alertar', hint: 'Baja brusca o carga de al menos estos litros.', unit: 'L', min: 1, max: 200, step: 1 },
];

// Interruptores de «Ajustes de operación»: qué parte de la operación se calcula y se muestra.
export const OPS_SWITCHES = [
  { k: 'estado', label: 'Estado de trabajo en el mapa', hint: 'Anillo de color alrededor de cada tractor: trabajando, en tránsito, parado, apagado o sin señal.' },
  { k: 'superficie', label: 'Superficie trabajada por lote', hint: 'Suma las hectáreas hechas y pendientes de cada lote con el ancho del implemento.' },
  { k: 'combustible', label: 'Alertas de combustible', hint: 'Posible extracción, caída brusca y cargas.' },
  { k: 'velocidad', label: 'Alertas de velocidad', hint: 'Exceso de velocidad en lote o en tránsito, con el tramo recorrido en el mapa.' },
  { k: 'horario', label: 'Alertas de horario', hint: 'Tractor avanzando fuera del horario permitido (anillo morado punteado).' },
  { k: 'tarjeta', label: 'Tarjeta «Operación de hoy»', hint: 'Panel flotante con estado, avance por lote y alertas.' },
];
