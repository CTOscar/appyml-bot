// Estado de cada tractor y resumen de la flota (misma regla que el panel actual).
import { config } from '../config.js';

export const STATUS = {
  running: { label: 'En marcha', tone: 'ok' },
  idle: { label: 'Apagado', tone: 'muted' },
  nosignal: { label: 'Sin señal', tone: 'crit' },
};

// Sin reporte en offlineAfterMin, o el dispositivo no está en línea = sin señal; si no, encendido según ignition.
export function statusOf(device, position, now = Date.now()) {
  if (!device) return 'nosignal';
  const last = new Date(device.lastUpdate || position?.fixTime || 0).getTime();
  if (device.status !== 'online' || now - last > config.offlineAfterMin * 60e3) return 'nosignal';
  return position?.attributes?.ignition ? 'running' : 'idle';
}

// { total, running, idle, nosignal, engineMs, brands: { 'john-deere': n, … } }
export function summarize(devices = [], positions = [], summary = [], now = Date.now()) {
  const pos = new Map(positions.map((p) => [p.deviceId, p]));
  const eng = new Map(summary.map((s) => [s.deviceId, Number(s.engineHours) || 0]));
  const out = { total: devices.length, running: 0, idle: 0, nosignal: 0, engineMs: 0, brands: {} };
  for (const d of devices) {
    out[statusOf(d, pos.get(d.id), now)]++;
    out.engineMs += eng.get(d.id) || 0;
    const marca = d.attributes?.marca || 'otra';
    out.brands[marca] = (out.brands[marca] || 0) + 1;
  }
  return out;
}

export function greeting(date = new Date()) {
  const h = Number(new Intl.DateTimeFormat('es-MX', { hour: 'numeric', hourCycle: 'h23', timeZone: config.tz }).format(date));
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}
