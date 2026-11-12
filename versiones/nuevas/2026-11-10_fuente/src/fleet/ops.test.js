// Mismos casos que patch/mapops.test.cjs del panel actual.
import { describe, expect, it } from 'vitest';
import { kmh, classify, outOfSchedule, fuelStep, speedStep, markSegment, haFromCells, parseWkt, polyHa, trailKm, fmtDur, OPS_DEFAULTS as C } from './ops.js';

describe('operación de flota', () => {
  it('kmh convierte nudos de Traccar a km/h', () => {
    expect(Math.round(kmh({ speed: 10 }))).toBe(19);
    expect(kmh({})).toBe(0);
    expect(kmh(null)).toBe(0);
  });

  it('classify: sin señal, apagado, parado, tránsito y trabajo', () => {
    expect(classify({ nosignal: true, ignition: true, v: 9, inLote: true }, C)).toBe('sinsenal');
    expect(classify({ nosignal: false, ignition: false, v: 0, inLote: true }, C)).toBe('apagado');
    expect(classify({ nosignal: false, ignition: true, v: 0.4, inLote: true }, C)).toBe('ralenti');
    expect(classify({ nosignal: false, ignition: true, v: 12, inLote: false }, C)).toBe('transito');
    expect(classify({ nosignal: false, ignition: true, v: 6, inLote: true }, C)).toBe('trabajo');
    expect(classify({ nosignal: false, ignition: true, v: 1, inLote: true }, C)).toBe('trabajo');
  });

  it('outOfSchedule: horario normal y horario que cruza medianoche', () => {
    const d = (h, m = 0) => new Date(2026, 10, 10, h, m);
    expect(outOfSchedule(d(5, 59), '06:00', '20:00')).toBe(true);
    expect(outOfSchedule(d(6, 0), '06:00', '20:00')).toBe(false);
    expect(outOfSchedule(d(20, 0), '06:00', '20:00')).toBe(true);
    expect(outOfSchedule(d(23), '22:00', '06:00')).toBe(false);
    expect(outOfSchedule(d(12), '22:00', '06:00')).toBe(true);
    expect(outOfSchedule(d(12), '08:00', '08:00')).toBe(false);
  });

  it('fuelStep: extracción con motor apagado (acumulada en la ventana)', () => {
    const st = {}, t0 = 1e12;
    expect(fuelStep(st, t0, 200, false, 10)).toBe(null);
    expect(fuelStep(st, t0 + 60e3, 196, false, 10)).toBe(null);
    expect(fuelStep(st, t0 + 120e3, 192, false, 10)).toBe(null);
    const ev = fuelStep(st, t0 + 180e3, 189, false, 10);
    expect(ev.tipo).toBe('extraccion');
    expect(Math.round(ev.litros)).toBe(11);
    expect(fuelStep(st, t0 + 240e3, 188, false, 10)).toBe(null);
  });

  it('fuelStep: el consumo normal no alerta, la caída brusca sí; la carga se detecta', () => {
    const st = {};
    let t = 1e12, f = 200;
    fuelStep(st, t, f, true, 10);
    for (let i = 0; i < 40; i++) { t += 5000; f -= 0.25; expect(fuelStep(st, t, f, true, 10)).toBe(null); }
    expect(fuelStep(st, t + 5000, f - 35, true, 10)).toMatchObject({ tipo: 'caida' });
    const s2 = {};
    fuelStep(s2, 1e12, 50, false, 10);
    expect(fuelStep(s2, 1e12 + 60e3, 120, false, 10)).toEqual({ tipo: 'carga', litros: 70 });
  });

  it('speedStep: abre, actualiza y cierra episodios; tras 60 s sin lecturas es nuevo', () => {
    let r = speedStep(null, 2000, 12, 8, [1, 1]);
    expect(r.nuevo).toBe(true);
    r = speedStep(r.ep, 5000, 15, 8, [2, 2]);
    expect(r).toMatchObject({ nuevo: false, ep: { max: 15 } });
    expect(speedStep(r.ep, 8000, 6, 8, [3, 3]).ep).toBe(null);
    const a = speedStep(null, 1000, 12, 8, [0, 0]);
    expect(speedStep(a.ep, 62000, 12, 8, [1, 1]).nuevo).toBe(true);
  });

  it('superficie: un traslape no cuenta dos veces', () => {
    const w = 8, cells = {};
    markSegment(cells, [23.0, -105.9], [23.0, -105.899], w);
    const n1 = Object.keys(cells).length;
    expect(n1).toBeGreaterThanOrEqual(12); expect(n1).toBeLessThanOrEqual(16);
    markSegment(cells, [23.0, -105.9], [23.0, -105.899], w);
    expect(Object.keys(cells).length).toBe(n1);
    expect(haFromCells(n1, w)).toBeGreaterThan(0.07);
  });

  it('WKT y hectáreas: lote de ~100 × 100 m ≈ 1 ha; círculo y basura', () => {
    const lat = 23.0, dLat = 100 / 110540, dLon = 100 / (111320 * Math.cos((lat * Math.PI) / 180));
    const g = parseWkt(`POLYGON ((${lat} -105.9, ${lat + dLat} -105.9, ${lat + dLat} ${-105.9 + dLon}, ${lat} ${-105.9 + dLon}, ${lat} -105.9))`);
    expect(g.type).toBe('polygon');
    expect(g.points).toHaveLength(5);
    expect(Math.abs(polyHa(g.points) - 1)).toBeLessThan(0.02);
    expect(parseWkt('CIRCLE (23 -105.9, 150)')).toEqual({ type: 'circle', center: [23, -105.9], radius: 150 });
    expect(parseWkt('basura')).toBe(null);
  });

  it('trailKm y fmtDur', () => {
    expect(trailKm([[23, -105.9], [23.009, -105.9]])).toBeCloseTo(1.0, 1);
    expect(fmtDur(45 * 60000)).toBe('45 min');
    expect(fmtDur(135 * 60000)).toBe('2 h 15 min');
  });
});
