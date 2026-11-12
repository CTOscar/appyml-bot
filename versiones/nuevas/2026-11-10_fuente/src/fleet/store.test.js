import { describe, expect, it } from 'vitest';
import { createFleetStore } from './store.js';
import { searchAll } from '../pages/Search.jsx';

const T0 = Date.parse('2026-11-10T16:00:00Z');
function fakeClient() {
  const dev = (id, marca) => ({ id, name: `TRC-${id}`, uniqueId: `86${id}`, status: 'online', lastUpdate: new Date(T0).toISOString(), attributes: { marca, nivel: 'A' } });
  const pos = (id, ignition, speedKn, lote) => ({ deviceId: id, latitude: 23, longitude: -105.9, speed: speedKn, fixTime: new Date(T0).toISOString(), geofenceIds: lote ? [1] : [], attributes: { ignition, hours: 1000 * 3600e3 } });
  return {
    mode: 'mock',
    getDevices: async () => [dev(1, 'john-deere'), dev(2, 'new-holland'), dev(3, 'john-deere')],
    getPositions: async () => [pos(1, true, 3, true), pos(2, true, 3, false), pos(3, false, 0, true)],
    getGeofences: async () => [{ id: 1, name: 'El Álamo · Lote 1', area: 'POLYGON((23 -105.9, 23.001 -105.9, 23.001 -105.899, 23 -105.9))' }],
    getSummary: async () => [{ deviceId: 1, engineHours: 2 * 3600e3 }],
  };
}
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

describe('estado en vivo de la flota', () => {
  it('carga, clasifica el trabajo y acumula tiempos por estado', async () => {
    let now = T0;
    const store = createFleetStore(fakeClient(), { now: () => now, storage: memStorage() });
    await store.start(); store.stop();
    expect(store.getSnapshot()).toMatchObject({ loaded: true, error: null });
    expect(store.workOf(1)).toBe('trabajo'); // encendido, ~5.6 km/h, dentro de un lote
    expect(store.workOf(2)).toBe('transito'); // encendido, en movimiento, fuera de lote
    expect(store.workOf(3)).toBe('apagado');
    expect(store.fenceOf(1).name).toBe('El Álamo · Lote 1');
    now += 120_000; store.tick();
    expect(store.workToday(1).trabajo).toBe(120_000);
    const s = store.summary();
    expect(s).toMatchObject({ total: 3, running: 2, idle: 1, nosignal: 0, engineMs: 2 * 3600e3, brands: { 'john-deere': 2, 'new-holland': 1 } });
    expect(s.workNow).toMatchObject({ trabajo: 1, transito: 1, apagado: 1 });
    expect(s.productive).toBeCloseTo(0.5, 5); // 2 min trabajo / (2 min trabajo + 2 min tránsito)
  });

  it('un mensaje en vivo suma horas de motor y deja recorrido; los huecos de más de 5 min no cuentan', async () => {
    let now = T0;
    const store = createFleetStore(fakeClient(), { now: () => now, storage: memStorage() });
    await store.start(); store.stop();
    now += 60_000;
    store.apply({ positions: [{ deviceId: 1, latitude: 23.001, longitude: -105.9, speed: 3, fixTime: new Date(now).toISOString(), geofenceIds: [1], attributes: { ignition: true, hours: 1000 * 3600e3 + 60_000 } }] });
    expect(store.getSnapshot().engineToday.get(1)).toBe(2 * 3600e3 + 60_000);
    expect(store.getSnapshot().trails.get(1)).toHaveLength(2);
    now += 60 * 60_000; store.tick();
    expect(store.workToday(1).trabajo).toBe(60_000 + 5 * 60_000);
  });

  it('filtros: estado, marca y texto (nombre, IMEI o lote)', async () => {
    const store = createFleetStore(fakeClient(), { now: () => T0, storage: memStorage() });
    await store.start(); store.stop();
    expect(store.matches(3, { status: 'idle' })).toBe(true);
    expect(store.matches(1, { marca: 'new-holland' })).toBe(false);
    expect(store.matches(1, { q: 'álamo' })).toBe(true);
    expect(store.matches(2, { q: '862' })).toBe(true);
  });
});

describe('búsqueda global', () => {
  it('encuentra tractores, lotes y páginas sin importar acentos', () => {
    const r = searchAll('alamo', { devices: [], fences: [{ id: 1, name: 'El Álamo · Lote 1', ha: 2 }] });
    expect(r[0]).toMatchObject({ kind: 'lote', go: '/mapa?l=1' });
    const t = searchAll('trc 12', { devices: [{ id: 9, name: 'TRC-0009', uniqueId: '8612', attributes: {} }, { id: 12, name: 'TRC-0012', uniqueId: '860', attributes: {} }, { id: 120, name: 'TRC-0120', uniqueId: '861', attributes: {} }] });
    expect(t.map((x) => x.id)).toEqual([12, 120, 9]); // nombre exacto, luego nombre parecido, luego IMEI
    expect(searchAll('costeo', {})[0]).toMatchObject({ kind: 'pagina', go: '/costeo' });
    expect(searchAll('   ', {})).toEqual([]);
  });
});

describe('alertas de operación con los parámetros', () => {
  it('genera exceso de velocidad (una por episodio), combustible y horario fuera de rango', async () => {
    const { saveOps, resetOps, _forget } = await import('./opsConfig.js');
    _forget();
    const st = memStorage();
    saveOps({ vTrans: 20, hIni: '08:00', hFin: '09:00', fuelL: 10 }, st);
    let now = T0;
    const store = createFleetStore(fakeClient(), { now: () => now, storage: st });
    await store.start(); store.stop();
    const p = (t, speedKn, fuel) => ({ deviceId: 2, latitude: 23, longitude: -105.9, speed: speedKn, fixTime: new Date(t).toISOString(), geofenceIds: [], attributes: { ignition: true, fuel } });
    store.apply({ positions: [p(T0 + 1000, 14, 200)] }); // 26 km/h > 20 en tránsito
    store.apply({ positions: [p(T0 + 5000, 15, 200)] }); // mismo episodio: no repite
    store.apply({ positions: [p(T0 + 9000, 2, 170)] });  // baja de 30 L con el motor encendido
    const ev = store.getSnapshot().events.filter((e) => String(e.id).startsWith('op-'));
    expect(ev.filter((e) => e.type === 'opSpeed')).toHaveLength(1);
    expect(ev.find((e) => e.type === 'opFuel').attributes).toMatchObject({ litros: 30, tipo: 'caida' });
    expect(ev.filter((e) => e.type === 'opSchedule' && e.deviceId === 2)).toHaveLength(1); // una por tractor y día (la hora de la prueba cae fuera de 08:00–09:00 en cualquier zona de México)
    store.clearToday();
    expect(store.getSnapshot().events.filter((e) => String(e.id).startsWith('op-'))).toHaveLength(0);
    resetOps(st); _forget();
  });
});

describe('avance por lote y demostración', () => {
  it('suma superficie solo al trabajar dentro de un lote y la guarda por día; la demo solo existe en modo simulado', async () => {
    const { _forget } = await import('./opsConfig.js'); _forget();
    let now = T0; const st = memStorage();
    const store = createFleetStore(fakeClient(), { now: () => now, storage: st });
    await store.start(); store.stop();
    expect(store.avanceLotes()[0].done).toBe(0);
    const at = (lat) => ({ deviceId: 1, latitude: lat, longitude: -105.9, speed: 3, fixTime: new Date(now).toISOString(), geofenceIds: [1], attributes: { ignition: true } });
    for (let i = 1; i <= 6; i++) { now += 10_000; store.apply({ positions: [at(23 + i * 0.0003)] }); }
    const a = store.avanceLotes()[0];
    expect(a.done).toBeGreaterThan(0);
    expect(a.pend).toBeLessThanOrEqual(a.ha);
    store.stop(); // guarda el día
    const again = createFleetStore(fakeClient(), { now: () => now, storage: st });
    await again.start(); again.stop();
    expect(again.avanceLotes()[0].done).toBeCloseTo(a.done, 5); // el avance sobrevive a recargar
    expect(store.canDemo()).toBe(true);
    store.demo();
    expect(store.getSnapshot().events.some((e) => e.type === 'opFuel')).toBe(true);
    store.clearToday();
    expect(store.avanceLotes()[0].done).toBe(0);
  });
});

describe('importar lotes (createGeofence)', () => {
  it('addFence da de alta el lote y lo agrega con su forma y superficie', async () => {
    const creados = [];
    const client = { ...fakeClient(), createGeofence: async (g) => { creados.push(g); return { id: 7, ...g, attributes: {} }; } };
    const store = createFleetStore(client, { now: () => T0, storage: memStorage() });
    await store.start(); store.stop();
    expect(store.canCreateFence()).toBe(true);
    const area = 'POLYGON((22.7 -105.9, 22.7 -105.89, 22.71 -105.89, 22.71 -105.9, 22.7 -105.9))';
    await store.addFence({ name: 'Lote importado', area });
    expect(creados).toEqual([{ name: 'Lote importado', area, attributes: undefined }]);
    const g = store.getSnapshot().geofences.find((x) => x.id === 7);
    expect(g.name).toBe('Lote importado');
    expect(g.shape.type).toBe('polygon');
    expect(g.ha).toBeGreaterThan(50);
  });
  it('sin createGeofence en el cliente avisa en vez de fallar en silencio', async () => {
    const store = createFleetStore(fakeClient(), { now: () => T0, storage: memStorage() });
    await store.start(); store.stop();
    expect(store.canCreateFence()).toBe(false);
    await expect(store.addFence({ name: 'x', area: 'POLYGON((0 0, 0 1, 1 1, 0 0))' })).rejects.toThrow(/no crea lotes/);
  });
});
