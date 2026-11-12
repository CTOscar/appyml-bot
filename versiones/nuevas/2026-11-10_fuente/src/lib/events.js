// Clasificación de eventos IGUAL que el panel actual (panelpack/assets/home.js, función evInfo):
// la usan la campana de la barra y la página Alertas. high = alerta alta.
export function evInfo(e) {
  const t = e.type, a = e.attributes?.alarm || '';
  if (t === 'deviceFuelDrop') return { k: 'combustible', label: 'Caída de combustible', high: true };
  if (t === 'alarm') return a === 'powerCut' ? { k: 'energia', label: 'Corte de energía', high: true } : { k: 'alarma', label: 'Alarma' + (a ? ' · ' + a : ''), high: true };
  if (t === 'ignitionOn') return { k: 'encendido', label: 'Encendido' };
  if (t === 'ignitionOff') return { k: 'apagado', label: 'Apagado' };
  if (t === 'geofenceEnter') return { k: 'geocerca', label: 'Entró a un lote' };
  if (t === 'geofenceExit') return { k: 'geocerca', label: 'Salió de un lote' };
  // Alertas de operación generadas por el panel (mapops): título y detalle vienen en attributes.
  if (t === 'opSpeed') return { k: 'alarma', label: e.attributes?.titulo || 'Exceso de velocidad', det: e.attributes?.det, high: true };
  if (t === 'opFuel') return { k: 'combustible', label: e.attributes?.titulo || 'Combustible', det: e.attributes?.det, high: e.attributes?.sev !== 'info' };
  if (t === 'opLote') return { k: 'geocerca', label: e.attributes?.titulo || 'Alerta de lote', det: e.attributes?.det, high: e.attributes?.sev !== 'info' };
  if (t === 'opSchedule') return { k: 'alarma', label: e.attributes?.titulo || 'Trabajando fuera de horario', det: e.attributes?.det, high: true };
  if (t === 'deviceOverspeed') return { k: 'alarma', label: 'Exceso de velocidad', high: true };
  return { k: 'otros', label: EVENT_LABELS[t] || t };
}

// Nombres en español de los tipos de evento de Traccar que no tienen clasificación propia.
export const EVENT_LABELS = {
  deviceOffline: 'Sin señal',
  deviceOnline: 'Con señal',
  deviceUnknown: 'Estado desconocido',
  deviceMoving: 'En movimiento',
  deviceStopped: 'Detenido',
  deviceFuelIncrease: 'Carga de combustible',
  maintenance: 'Mantenimiento',
  commandResult: 'Resultado de comando',
  driverChanged: 'Cambio de operador',
  textMessage: 'Mensaje',
};

export const AL_FILTERS = [['todos', 'Todos'], ['altas', 'Altas'], ['combustible', 'Combustible'], ['energia', 'Energía'], ['encendido', 'Encendido'], ['apagado', 'Apagado'], ['geocerca', 'Lotes']];

// Eventos ordenados del más reciente al más viejo: [{ e, i, at }]
export const sortedEvents = (events = []) => events.map((e) => ({ e, i: evInfo(e), at: new Date(e.eventTime).getTime() })).sort((a, b) => b.at - a.at);

export function countEvents(ev) {
  const cnt = { todos: ev.length, altas: 0 };
  ev.forEach((x) => { if (x.i.high) cnt.altas++; cnt[x.i.k] = (cnt[x.i.k] || 0) + 1; });
  return cnt;
}

export const matchFilter = (x, f) => f === 'todos' || (f === 'altas' ? x.i.high : x.i.k === f);

// Alertas altas de hoy (número del globo de la campana).
export function highToday(events, now = new Date()) {
  const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
  return sortedEvents(events).filter((x) => x.i.high && x.at >= t0.getTime()).length;
}

export function ago(ms, now = Date.now()) {
  const m = Math.round((now - ms) / 60000);
  if (!Number.isFinite(m)) return '';
  if (m < 1) return 'hace segundos';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}
