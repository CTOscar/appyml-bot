// Estado en vivo de la flota (fuera de React; los componentes lo leen con useFleet).
// Carga dispositivos, posiciones, lotes y horas de motor de hoy; luego escucha el WebSocket de Traccar (o el simulado).
// Además acumula, por tractor, cuánto tiempo pasó hoy en cada estado de trabajo (trabajando, tránsito, parado, apagado, sin señal).
import { config } from '../config.js';
import { statusOf as statusRule } from '../lib/fleet.js';
import { classify, fuelStep, haFromCells, kmh, markSegment, outOfSchedule, parseWkt, polyHa, speedStep, WORK_ORDER, distM } from './ops.js';
import { getOps } from './opsConfig.js';
import { CMD_INITIAL, applyAction, commandFor } from './deviceOps.js';
import { loteAlerts } from './loteAlerts.js';

const TRAIL_MAX = 600;
const TICK_MS = 10_000;
const OPS_KEY = 'pf2-ops-';

const ymd = (d = new Date()) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
const emptyAcc = () => Object.fromEntries(WORK_ORDER.map((k) => [k, 0]));

export function createFleetStore(client, { now = () => Date.now(), storage = globalThis.localStorage } = {}) {
  const s = {
    loaded: false, error: null, conn: 'connecting', mode: client.mode || '',
    devices: new Map(), positions: new Map(), geofences: [], events: [],
    engineToday: new Map(), trails: new Map(),
    work: new Map(), // id -> { state, since }
    day: { d: ymd(), acc: {}, cells: {}, ops: [] }, // acc[id] = { trabajo: ms, … }; cells[loteId] = claves de cuadros trabajados; ops = alertas de operación del día
  };
  let version = 0, snap = null, queued = false, stopSocket = null, timer = null;
  let opSeq = 0; // desempata alertas de operación del mismo tractor y milisegundo (ids únicos para las claves de React)
  const subs = new Set();

  function emit() {
    version++; snap = null;
    if (queued) return;
    queued = true;
    const run = () => { queued = false; subs.forEach((f) => f()); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else setTimeout(run, 0);
  }

  /* ---------- tiempo de trabajo del día ---------- */
  const cellSets = {}; // loteId -> { 'x:y': 1 } (superficie trabajada, sin doble conteo en traslapes)
  function loadDay() {
    const d = ymd(new Date(now()));
    let saved = null;
    try { saved = JSON.parse(storage?.getItem(OPS_KEY + d) || 'null'); } catch { saved = null; }
    s.day = saved && saved.d === d ? { cells: {}, ops: [], ...saved } : { d, acc: {}, cells: {}, ops: [] };
    Object.keys(cellSets).forEach((k) => delete cellSets[k]);
    Object.entries(s.day.cells || {}).forEach(([f, keys]) => { cellSets[f] = {}; keys.forEach((k) => { cellSets[f][k] = 1; }); });
    // las alertas de operación del día vuelven a la lista de eventos
    // (también sin ids repetidos entre ellas: los guardados antes de que los ids llevaran contador pueden venir duplicados)
    if (s.day.ops?.length) { const seen = new Set(s.events.map((e) => e.id)); s.events = [...s.day.ops.filter((e) => !seen.has(e.id) && seen.add(e.id)), ...s.events]; }
  }
  let lastSave = 0;
  function saveDay(force) {
    const t = now();
    if (!force && t - lastSave < 8000) return;
    lastSave = t;
    try {
      const cells = {}; Object.keys(cellSets).forEach((f) => { cells[f] = Object.keys(cellSets[f]).slice(-30000); });
      s.day.cells = cells;
      s.day.ops = s.events.filter((e) => String(e.id).startsWith('op-')).slice(0, 120);
      storage?.setItem(OPS_KEY + s.day.d, JSON.stringify(s.day));
    } catch { /* sin almacenamiento o cuota llena: se sigue en memoria */ }
  }

  function stateNow(id) {
    const d = s.devices.get(id), p = s.positions.get(id);
    const st = statusRule(d, p, now());
    return classify({ nosignal: st === 'nosignal', ignition: !!p?.attributes?.ignition, v: kmh(p), inLote: (p?.geofenceIds || []).length > 0 }, getOps(storage));
  }
  // Suma al estado anterior el tiempo transcurrido y toma el estado actual.
  function account(id, t = now()) {
    const cur = stateNow(id), w = s.work.get(id);
    if (w) {
      const acc = s.day.acc[id] || (s.day.acc[id] = emptyAcc());
      acc[w.state] = (acc[w.state] || 0) + Math.max(0, Math.min(t - w.since, 5 * 60_000)); // huecos grandes no se cuentan
    }
    s.work.set(id, { state: cur, since: t });
  }
  function tick() {
    if (ymd(new Date(now())) !== s.day.d) { loadDay(); s.work.clear(); }
    const t = now();
    s.devices.forEach((_, id) => account(id, t));
    saveDay();
    emit();
  }

  /* ---------- mensajes en vivo (forma del WebSocket de Traccar) ---------- */
  // Operación de flota (portada de mapops.js): superficie trabajada, alertas de combustible, velocidad y horario.
  const opsSt = new Map(); // id -> { fuel, ep, epEv, outH, pos, fid, t }
  const fenceName = (id) => s.geofences.find((g) => g.id === id)?.name || `Lote ${id}`;
  function opsEvents(p) {
    const cfg = getOps(storage), id = p.deviceId, t = new Date(p.fixTime || now()).getTime(), wall = now();
    const r = opsSt.get(id) || opsSt.set(id, { fuel: {}, ep: null, epEv: null, outH: false, pos: null, fid: 0, t: 0 }).get(id);
    const out = [];
    const nos = statusRule(s.devices.get(id), p, wall) === 'nosignal', ign = !!p.attributes?.ignition, v = kmh(p);
    const fid = p.geofenceIds?.[0] || 0, pos = [p.latitude, p.longitude];
    const stt = classify({ nosignal: nos, ignition: ign, v, inLote: !!fid }, cfg);
    const first = !r.t, prevFid = r.fid;
    const dt = r.t ? wall - r.t : 0; r.t = wall;
    // superficie: solo al trabajar, dentro del mismo lote entre dos lecturas seguidas
    if (cfg.superficie && stt === 'trabajo' && fid && r.pos && r.fid === fid && dt > 0 && dt <= 90000 && distM(r.pos, pos) < 400) {
      markSegment(cellSets[fid] || (cellSets[fid] = {}), r.pos, pos, cfg.ancho);
    }
    r.pos = pos; r.fid = fid;
    if (nos) return out;
    const mk = (type, attributes) => ({ id: `op-${type}-${id}-${t}-${++opSeq}`, type, deviceId: id, eventTime: new Date(t).toISOString(), attributes: { ...attributes, latitude: pos[0], longitude: pos[1] } });
    // alertas del lote (entrada, salida y horas máximas por tractor al día): las activa cada lote en sus ajustes
    loteAlerts({ r, prevFid, fid, first, ign, dt, day: ymd(new Date(wall)), fences: s.geofences, deviceName: s.devices.get(id)?.name || `Tractor ${id}` })
      .forEach((a) => out.push({ ...mk('opLote', { sev: a.sev, titulo: a.titulo, det: a.det }), id: `op-opLote-${id}-${a.key}-${t}` }));
    // combustible
    const fuel = p.attributes?.fuel;
    if (cfg.combustible && typeof fuel === 'number') {
      const ev = fuelStep(r.fuel, wall, fuel, ign, cfg.fuelL);
      if (ev) {
        const T = { extraccion: ['Posible extracción de combustible', 'crit'], caida: ['Caída brusca de combustible', 'warn'], carga: ['Carga de combustible', 'info'] }[ev.tipo];
        out.push(mk('opFuel', { tipo: ev.tipo, litros: Math.round(ev.litros), sev: T[1], titulo: T[0], det: `${ev.tipo === 'carga' ? '+' : '−'}${Math.round(ev.litros)} L · ahora ${Math.round(fuel)} L · motor ${ign ? 'encendido' : 'apagado'}${fid ? ` · ${fenceName(fid)}` : ''}` }));
      }
    } else if (typeof fuel === 'number') r.fuel.last = fuel;
    // velocidad: un episodio = una alerta que se va actualizando (máximo y tramo)
    if (cfg.velocidad && ign) {
      const lim = fid ? cfg.vLote : cfg.vTrans, sp = speedStep(r.ep, wall, v, lim, pos);
      r.ep = sp.ep;
      if (sp.nuevo) {
        const prev = s.events.find((e) => e.type === 'opSpeed' && e.deviceId === id && e.attributes.last && wall - e.attributes.last < 120000);
        r.epEv = prev || null;
        if (!r.epEv) { r.epEv = mk('opSpeed', { sev: 'warn', titulo: 'Exceso de velocidad', limit: lim, speed: Math.round(v), max: v, pts: sp.ep.pts, det: '' }); out.push(r.epEv); }
      }
      if (r.ep && r.epEv) {
        const a = r.epEv.attributes; a.last = wall; a.max = Math.max(a.max || 0, r.ep.max); a.speed = Math.round(a.max); a.limit = lim; a.pts = r.ep.pts;
        a.det = `${Math.round(a.max)} km/h (límite ${lim} ${fid ? `en lote ${fenceName(fid)}` : 'en tránsito'})`;
      }
      if (!r.ep) r.epEv = null;
    } else { r.ep = null; r.epEv = null; }
    // horario permitido: motor encendido y avanzando
    if (cfg.horario) {
      const fuera = ign && v >= cfg.vmin && outOfSchedule(new Date(wall), cfg.hIni, cfg.hFin);
      if (fuera && !r.outH) {
        r.outH = true;
        if (!s.events.some((e) => e.type === 'opSchedule' && e.deviceId === id && wall - new Date(e.eventTime).getTime() < 30 * 60000)) {
          out.push(mk('opSchedule', { sev: 'warn', titulo: 'Trabajando fuera de horario', desde: cfg.hIni, hasta: cfg.hFin, det: `Horario permitido ${cfg.hIni}–${cfg.hFin} · ${Math.round(v)} km/h` }));
        }
      } else if (!fuera) r.outH = false;
    } else r.outH = false;
    return out;
  }

  function pushTrail(p) {
    if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) return;
    let t = s.trails.get(p.deviceId);
    if (!t) s.trails.set(p.deviceId, (t = []));
    const last = t[t.length - 1];
    if (last && last[0] === p.latitude && last[1] === p.longitude) return;
    t.push([p.latitude, p.longitude, new Date(p.fixTime || now()).getTime()]);
    if (t.length > TRAIL_MAX) t.splice(0, t.length - TRAIL_MAX);
  }
  function apply(msg) {
    msg.devices?.forEach((d) => s.devices.set(d.id, { ...s.devices.get(d.id), ...d }));
    msg.positions?.forEach((p) => {
      const prev = s.positions.get(p.deviceId);
      const h0 = prev?.attributes?.hours, h1 = p.attributes?.hours;
      if (typeof h0 === 'number' && typeof h1 === 'number') {
        const delta = h1 - h0;
        if (delta > 0 && delta < 6 * 3600e3) s.engineToday.set(p.deviceId, (s.engineToday.get(p.deviceId) || 0) + delta);
      }
      s.positions.set(p.deviceId, p);
      pushTrail(p);
      const gen = opsEvents(p);
      if (gen.length) { msg.events = [...(msg.events || []), ...gen]; }
      const dev = s.devices.get(p.deviceId);
      if (dev && p.fixTime && (!dev.lastUpdate || new Date(p.fixTime) > new Date(dev.lastUpdate))) s.devices.set(p.deviceId, { ...dev, lastUpdate: p.fixTime });
      account(p.deviceId);
    });
    if (msg.events?.length) {
      const seen = new Set(s.events.map((e) => e.id));
      s.events = [...msg.events.filter((e) => !seen.has(e.id)), ...s.events].sort((a, b) => new Date(b.eventTime) - new Date(a.eventTime)).slice(0, 300);
    }
    emit();
  }

  /* ---------- arranque ---------- */
  async function start() {
    loadDay();
    try {
      const desde = new Date(now()); desde.setHours(0, 0, 0, 0);
      const [devices, positions, fences] = await Promise.all([client.getDevices(), client.getPositions(), client.getGeofences ? client.getGeofences() : []]);
      devices.forEach((d) => s.devices.set(d.id, d));
      s.geofences = fences.map((g) => { const shape = parseWkt(g.area); return { ...g, shape, ha: shape?.type === 'polygon' ? polyHa(shape.points) : 0 }; });
      apply({ positions });
      const summary = client.getSummary ? await client.getSummary(devices.map((d) => d.id), desde, new Date(now())).catch(() => []) : [];
      summary.forEach((x) => { if (x.deviceId != null) s.engineToday.set(x.deviceId, Number(x.engineHours) || 0); });
      if (client.getEvents) {
        const evs = await client.getEvents(devices.map((d) => d.id), desde, new Date(now())).catch(() => []);
        apply({ events: evs });
      }
      s.loaded = true; s.error = null;
    } catch (e) {
      s.error = e.message || 'No se pudo leer la flota'; s.loaded = true;
    }
    emit();
    if (client.connect) stopSocket = client.connect(apply, (c) => { s.conn = c; emit(); });
    timer = setInterval(tick, TICK_MS);
  }
  // Borra tiempos de trabajo, superficie y alertas de operación de hoy (acción de «Ajustes de operación»).
  function clearToday() {
    s.day = { d: ymd(new Date(now())), acc: {}, cells: {}, ops: [] };
    Object.keys(cellSets).forEach((k) => delete cellSets[k]);
    s.work.clear(); opsSt.clear();
    s.events = s.events.filter((e) => !String(e.id).startsWith('op-'));
    saveDay(true); s.devices.forEach((_, id) => account(id)); emit();
  }
  // Avance por lote: hectáreas hechas (cuadros de ancho del implemento recorridos trabajando) y pendientes.
  function avanceLotes() {
    const cfg = getOps(storage);
    return s.geofences.map((g) => {
      const total = Number(g.attributes?.superficie) > 0 ? Number(g.attributes.superficie) : g.ha || 0;
      const n = cellSets[g.id] ? Object.keys(cellSets[g.id]).length : 0;
      const done = Math.min(haFromCells(n, cfg.ancho), total || 1e9);
      return { id: g.id, name: g.name, ha: total, done, pct: total ? Math.min(100, (done / total) * 100) : 0, pend: Math.max(0, total - done) };
    });
  }
  const outOfHours = (id) => !!opsSt.get(id)?.outH;
  const canDemo = () => client.mode === 'mock';
  // Demostración (solo con datos simulados): tiempos de trabajo, avance por lote y dos alertas de ejemplo.
  function demo() {
    if (!canDemo()) return false;
    const rnd = Math.random, H = 3600000, t = now();
    s.devices.forEach((_, id) => { s.day.acc[id] = { ...emptyAcc(), trabajo: (2 + rnd() * 3) * H, transito: (0.3 + rnd() * 0.6) * H, ralenti: (0.2 + rnd() * 0.5) * H }; });
    const cfg = getOps(storage);
    s.geofences.forEach((g) => {
      const pts = g.shape?.type === 'polygon' ? g.shape.points : null; if (!pts) return;
      const la = pts.map((q) => q[0]), lo = pts.map((q) => q[1]);
      const a0 = Math.min(...la), a1 = Math.max(...la), o0 = Math.min(...lo), o1 = Math.max(...lo), frac = 0.25 + rnd() * 0.6;
      const cs = cellSets[g.id] || (cellSets[g.id] = {}), step = cfg.ancho / 110540, nrows = Math.floor(((a1 - a0) / step) * frac);
      for (let k = 0; k < nrows; k++) markSegment(cs, [a0 + k * step, o0], [a0 + k * step, o1], cfg.ancho);
    });
    const any = [...s.positions.entries()];
    if (any.length) {
      const [id0, p0] = any[0], [id1, p1] = any[Math.min(1, any.length - 1)];
      const mk = (type, id, p, mins, attributes) => ({ id: `op-${type}-${id}-demo${mins}`, type, deviceId: id, eventTime: new Date(t - mins * 60000).toISOString(), attributes: { ...attributes, latitude: p.latitude, longitude: p.longitude } });
      s.events = [
        mk('opFuel', id0, { latitude: p0.latitude + 0.0004, longitude: p0.longitude - 0.0005 }, 25, { tipo: 'extraccion', litros: 38, sev: 'crit', titulo: 'Posible extracción de combustible', det: '−38 L · ahora 142 L · motor apagado (demostración)' }),
        mk('opSpeed', id1, p1, 70, { sev: 'warn', titulo: 'Exceso de velocidad', speed: 41, max: 41, limit: cfg.vTrans, pts: [[p1.latitude, p1.longitude], [p1.latitude + 0.0006, p1.longitude + 0.0009], [p1.latitude + 0.0011, p1.longitude + 0.0021]], det: `41 km/h (límite ${cfg.vTrans} en tránsito) (demostración)` }),
        ...s.events.filter((e) => !String(e.id).includes('-demo')),
      ];
    }
    saveDay(true); emit();
    return true;
  }
  function stop() { stopSocket?.(); clearInterval(timer); saveDay(true); }

  /* ---------- acciones del panel (igual que el panel actual) ---------- */
  // Ajustes del tractor: guarda nombre y attributes en Traccar/simulado y en la API del panel (client.updateDevice).
  async function saveDevice(d) {
    const saved = await client.updateDevice(d);
    s.devices.set(d.id, { ...s.devices.get(d.id), ...(saved || d) });
    emit();
    return saved || d;
  }
  // Ajustes del lote: guarda nombre y attributes (client.updateGeofence) y actualiza el lote en memoria sin perder su forma.
  async function saveFence(g) {
    const { shape, ha, ...raw } = g;
    const saved = await client.updateGeofence(raw);
    s.geofences = s.geofences.map((x) => (x.id === g.id ? { ...x, ...raw, ...(saved && saved.attributes ? { name: saved.name ?? raw.name, attributes: saved.attributes } : {}) } : x));
    emit();
    return saved || raw;
  }
  // Crea un lote nuevo (importación KML/GeoJSON): lo da de alta en Traccar/simulado y lo agrega a la lista sin recargar.
  const canCreateFence = () => typeof client.createGeofence === 'function';
  async function addFence({ name, area, attributes }) {
    if (!canCreateFence()) throw Object.assign(new Error('Este cliente no crea lotes.'), { status: 501 });
    const saved = await client.createGeofence({ name, area, attributes });
    const shape = parseWkt(saved?.area || area);
    s.geofences = [...s.geofences, { ...(saved || { name, area }), area: saved?.area || area, shape, ha: shape?.type === 'polygon' ? polyHa(shape.points) : 0 }];
    emit();
    return saved;
  }
  // Operación del tractor (comandos al equipo). Estado por tractor en memoria y localStorage; el comando va al cliente (Traccar: POST /api/commands/send).
  const CMD_KEY = 'pf2-cmd-';
  const cmdStates = new Map();
  const canCommand = () => typeof client.sendCommand === 'function';
  function cmdState(id) {
    if (!cmdStates.has(id)) { let v = null; try { v = JSON.parse(storage?.getItem(CMD_KEY + id) || 'null'); } catch { v = null; } cmdStates.set(id, { ...CMD_INITIAL, ...(v || {}) }); }
    return cmdStates.get(id);
  }
  // Devuelve { state, log }. Falla (rechaza) si la regla no se cumple o el comando no llega al equipo; en ese caso el estado no cambia.
  async function sendCommand(id, act) {
    const r = applyAction(cmdState(id), act);
    if (r.error) throw Object.assign(new Error(r.error), { status: 409 });
    const cmd = commandFor(act, r.state);
    if (cmd) {
      if (!canCommand()) throw Object.assign(new Error('Este cliente no envía comandos al equipo.'), { status: 501 });
      await client.sendCommand({ deviceId: id, ...cmd });
    }
    cmdStates.set(id, r.state);
    try { storage?.setItem(CMD_KEY + id, JSON.stringify(r.state)); } catch { /* sin almacenamiento */ }
    emit();
    return r;
  }
  function clearTrail(id) { const p = s.positions.get(id); s.trails.set(id, p ? [[p.latitude, p.longitude, Date.now()]] : []); emit(); }
  // Recorrido simulado (solo modo simulado): el tractor recorre su lote surco por surco.
  const sim = { id: null, speed: 1 };
  const canSim = () => typeof client.simulateRoute === 'function';
  function simulate(id, speed = sim.speed) {
    if (!canSim()) return;
    sim.id = id; sim.speed = speed;
    client.simulateRoute(id, speed);
    emit();
  }
  const simState = () => ({ ...sim });

  /* ---------- lecturas ---------- */
  const statusOf = (id) => statusRule(s.devices.get(id), s.positions.get(id), now());
  const workOf = (id) => s.work.get(id)?.state || stateNow(id);
  // Tiempo de hoy por estado, incluido el tramo en curso.
  function workToday(id) {
    const acc = { ...emptyAcc(), ...(s.day.acc[id] || {}) }, w = s.work.get(id);
    if (w) acc[w.state] += Math.max(0, Math.min(now() - w.since, 5 * 60_000));
    return acc;
  }
  const fenceOf = (id) => { const gid = s.positions.get(id)?.geofenceIds?.[0]; return s.geofences.find((g) => g.id === gid) || null; };

  function summary() {
    const out = { total: s.devices.size, running: 0, idle: 0, nosignal: 0, engineMs: 0, work: emptyAcc(), workNow: emptyAcc(), brands: {} };
    s.devices.forEach((d, id) => {
      out[statusOf(id)]++;
      out.engineMs += s.engineToday.get(id) || 0;
      out.workNow[workOf(id)]++;
      const t = workToday(id);
      WORK_ORDER.forEach((k) => { out.work[k] += t[k]; });
      const m = d.attributes?.marca || 'otra';
      out.brands[m] = (out.brands[m] || 0) + 1;
    });
    const encendido = out.work.trabajo + out.work.transito + out.work.ralenti;
    // Menos de 1 min de motor encendido medido no dice nada: «midiendo» (null) en vez de un porcentaje engañoso.
    out.productive = encendido >= 60_000 ? out.work.trabajo / encendido : null;
    return out;
  }

  // Filtro de la lista y del mapa: { status, marca, nivel, q }
  function matches(id, f = {}) {
    const d = s.devices.get(id);
    if (!d) return false;
    if (f.status && statusOf(id) !== f.status) return false;
    if (f.marca && d.attributes?.marca !== f.marca) return false;
    if (f.nivel && d.attributes?.nivel !== f.nivel) return false;
    if (f.sonda && !d.attributes?.sondaBLE) return false;
    const q = (f.q || '').trim().toLowerCase();
    if (q && !d.name.toLowerCase().includes(q) && !String(d.uniqueId).includes(q) && !(fenceOf(id)?.name || '').toLowerCase().includes(q)) return false;
    return true;
  }

  function getSnapshot() {
    if (!snap) snap = { version, loaded: s.loaded, error: s.error, conn: s.conn, mode: s.mode, devices: s.devices, positions: s.positions, geofences: s.geofences, events: s.events, engineToday: s.engineToday, trails: s.trails };
    return snap;
  }

  return {
    start, stop, apply, tick, clearToday, avanceLotes, outOfHours, canDemo, demo, getSnapshot, saveDevice, saveFence, addFence, canCreateFence, canCommand, cmdState, sendCommand, clearTrail, simulate, simState, canSim,
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    statusOf, workOf, workToday, fenceOf, summary, matches,
    get config() { return config; },
  };
}
