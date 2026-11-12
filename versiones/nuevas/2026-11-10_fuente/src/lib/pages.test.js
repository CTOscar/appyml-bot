import { describe, expect, it } from 'vitest';
import { groupDevices, brandsOf, slug } from './catalog.js';
import { analyzeDay, week, weekLabel, totals } from './diesel.js';
import { LINK_GROUPS, safeHref, hostOf } from './links.js';
import { createStatus, ALL } from './status-model.js';
import { filterLinks } from '../pages/Enlaces.jsx';

describe('catálogo de tractores', () => {
  it('agrupa por marca y modelo, ordena JD → NH y por potencia', () => {
    const d = (id, marca, modelo) => ({ id, attributes: { marca, modelo } });
    const g = groupDevices([d(1, 'new-holland', 'T6.110'), d(2, 'john-deere', '6110J'), d(3, 'john-deere', '5075E'), d(4, 'John Deere', '5075E'), d(5, '', '')]);
    expect(g.map((x) => x.key)).toEqual(['john-deere|5075E', 'john-deere|6110J', 'new-holland|T6.110', 'otra|Sin modelo']);
    expect(g[0].ids).toEqual([3, 4]);
    expect(g[0]).toMatchObject({ brand: 'John Deere', mono: 'JD', hp: 75 });
    expect(brandsOf(g).map((b) => b.marca)).toEqual(['john-deere', 'new-holland', 'otra']);
    expect(slug('New Hólland')).toBe('new-holland');
  });
});

describe('costeo de diésel', () => {
  const at = (h, m) => new Date(`2026-11-10T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-07:00`).toISOString();
  const p = (h, m, fuel, ign = true, speed = 2) => ({ fixTime: at(h, m), speed, attributes: { fuel, ignition: ign } });
  it('suma consumo, detecta cargas y descargas y reparte por hora (Mazatlán)', () => {
    const r = analyzeDay([p(8, 0, 200), p(8, 10, 195), p(8, 20, 190), p(9, 0, 185, false, 0), p(9, 5, 150, false, 0), p(10, 0, 150), p(10, 5, 230)]);
    expect(r.L).toBe(15); // 5 + 5 + 5 de consumo
    expect(r.drains).toEqual([35]); // baja de 35 L parado
    expect(r.loads).toEqual([80]);
    expect(r.hr[8]).toBe(10); expect(r.hr[9]).toBe(5);
    expect(r.h).toBeGreaterThan(0.5);
    expect(totals([r, null])).toMatchObject({ L: 15, loads: 80, drains: 35, nDrains: 1 });
  });
  it('semana de lunes a domingo y su etiqueta', () => {
    const w = week(0, Date.parse('2026-11-12T18:00:00Z')); // jueves
    expect(w[0]).toBe('2026-11-09'); expect(w[6]).toBe('2026-11-15');
    expect(week(-1, Date.parse('2026-11-12T18:00:00Z'))[0]).toBe('2026-11-02');
    expect(weekLabel(w)).toMatch(/9 nov – 15 nov 2026/);
  });
});

describe('enlaces', () => {
  it('filtra por categoría y texto sin acentos; solo acepta http(s)', () => {
    expect(filterLinks(LINK_GROUPS, 'todos', 'teltonika').length).toBe(2);
    expect(filterLinks(LINK_GROUPS, 'Sensores', '').length).toBe(1);
    expect(filterLinks(LINK_GROUPS, 'todos', 'instalacion').length).toBeGreaterThan(0);
    expect(safeHref('javascript:alert(1)')).toBe('#');
    expect(hostOf('https://www.traccar.org/')).toBe('traccar.org');
  });
});

describe('status', () => {
  it('incidente: cambia el estado del componente y al resolverse pasa al historial', () => {
    const mem = new Map(), storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    const m = createStatus({ storage, clock: () => Date.parse('2026-11-10T18:00:00Z') });
    expect(ALL).toContain('API / Backend');
    m.actions.incident({ title: 'Errores', comp: 'API / Backend', sev: 'major', phase: 'Investigando', msg: 'Revisando' });
    expect(m.state().comps['API / Backend']).toBe('major');
    const id = m.state().incidents[0].id;
    m.actions.update(id, 'Resuelto', 'Listo');
    expect(m.state().comps['API / Backend']).toBe('operational');
    expect(m.state().past[0].title).toBe('Errores');
    expect(m.uptime('API / Backend')).toBeLessThan(100);
  });
});

import { evInfo, countEvents, sortedEvents, matchFilter, highToday } from './events.js';
import { summarizeWeather, windowRisk, windDir, earthUrl } from './weather.js';
import { parseRss } from './news.js';

describe('eventos (igual que el panel actual)', () => {
  it('clasifica y cuenta como home.js', () => {
    expect(evInfo({ type: 'deviceFuelDrop' })).toEqual({ k: 'combustible', label: 'Caída de combustible', high: true });
    expect(evInfo({ type: 'alarm', attributes: { alarm: 'powerCut' } })).toMatchObject({ k: 'energia', high: true });
    expect(evInfo({ type: 'geofenceExit' }).label).toBe('Salió de un lote');
    const ev = sortedEvents([{ id: 1, type: 'ignitionOn', eventTime: '2026-11-10T10:00:00Z' }, { id: 2, type: 'deviceFuelDrop', eventTime: '2026-11-10T12:00:00Z' }]);
    expect(ev[0].e.id).toBe(2);
    expect(countEvents(ev)).toMatchObject({ todos: 2, altas: 1, combustible: 1, encendido: 1 });
    expect(ev.filter((x) => matchFilter(x, 'altas')).length).toBe(1);
    expect(highToday([{ id: 3, type: 'deviceFuelDrop', eventTime: new Date().toISOString() }])).toBe(1);
  });
});

describe('clima y noticias', () => {
  it('ventana de aplicación y resumen de Open-Meteo', () => {
    expect(windowRisk({ wind_speed_10m: 30, wind_gusts_10m: 10, temperature_2m: 25, precipitation: 0 }, 0)[1]).toBe('No recomendable');
    expect(windowRisk({ wind_speed_10m: 18, wind_gusts_10m: 10, temperature_2m: 25, precipitation: 0 }, 0)[1]).toBe('Con precaución');
    expect(windowRisk({ wind_speed_10m: 5, wind_gusts_10m: 10, temperature_2m: 25, precipitation: 0 }, 10)[1]).toBe('Favorable');
    expect(windDir(90)).toBe('E');
    const days = Array.from({ length: 15 }, (_, i) => `2026-11-${String(3 + i).padStart(2, '0')}`);
    const d = { current: { temperature_2m: 28, apparent_temperature: 30, relative_humidity_2m: 60, wind_speed_10m: 8, wind_gusts_10m: 12, wind_direction_10m: 180, weather_code: 1, is_day: 1, precipitation: 0 },
      hourly: { time: ['2026-11-10T10:00'], precipitation_probability: [10] },
      daily: { time: days, weather_code: days.map(() => 1), temperature_2m_max: days.map(() => 30), temperature_2m_min: days.map(() => 18), precipitation_sum: days.map((_, i) => (i === 7 ? 2 : 1)), precipitation_probability_max: days.map(() => 20) } };
    const s = summarizeWeather(d, Date.parse('2026-11-10T09:50:00'));
    expect(s.now).toMatchObject({ temp: 28, dir: 'S' });
    expect(s.days).toHaveLength(7);
    expect(s.rainToday).toBe(2); expect(s.rainPast).toBe(7); expect(s.rainNext).toBe(7);
    expect(earthUrl({ layer: 'wind', view: 'rosario' })).toContain('wind/surface/level/orthographic=-105.9012,22.73834,5000');
  });
  it('Google Noticias: separa la fuente del título y descarta enlaces raros', () => {
    const r = parseRss({ status: 'ok', items: [{ title: 'Siembra de maíz avanza - El Debate', link: 'https://x.mx/a', pubDate: '2026-11-10 10:00:00' }, { title: 'Sin fuente', link: 'javascript:alert(1)' }] });
    expect(r[0]).toMatchObject({ title: 'Siembra de maíz avanza', source: 'El Debate', url: 'https://x.mx/a' });
    expect(r[1].url).toBe('#');
  });
});
