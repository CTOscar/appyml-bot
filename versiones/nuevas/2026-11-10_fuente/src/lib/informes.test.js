import { describe, expect, it } from 'vitest';
import { allEvents, analyzeSeries, byLot, csvName, cumulative, eventsCsv, fleetTotals, periodRange, shiftDay, toSeries } from './informes.js';

const T0 = Date.parse('2026-11-10T15:00:00Z');
const pt = (i, fuel, kmh = 0) => ({ t: T0 + i * 300000, kmh, lat: 23, lon: -106, fuel, ign: true });

describe('análisis de la serie', () => {
  const s = [pt(0, 200, 5), pt(1, 198, 5), pt(2, 290, 0), pt(3, 240, 0), pt(4, 238, 6)];
  it('separa consumo, carga y descarga', () => {
    const a = analyzeSeries(s);
    expect(a.consumed).toBe(4);
    expect(a.events.map((e) => [e.type, e.liters])).toEqual([['refuel', 92], ['drain', 50]]);
    expect(a.maxKmh).toBe(6);
    expect(a.movingH).toBe(0.3); // 3 puntos en movimiento x 5 min
  });
  it('una baja grande con el tractor en movimiento no es descarga', () => {
    expect(analyzeSeries([pt(0, 200), pt(1, 160, 8)]).events).toEqual([]);
  });
  it('toSeries convierte nudos a km/h y ordena', () => {
    const r = toSeries([{ fixTime: '2026-11-10T15:05:00Z', speed: 10, attributes: { fuel: 5 } }, { fixTime: '2026-11-10T15:00:00Z', speed: 0, attributes: {} }]);
    expect(r[0].fuel).toBeNull();
    expect(r[1].kmh).toBeCloseTo(18.52);
  });
});

describe('agregación', () => {
  const mk = (id, name, series) => ({ d: { id, name, uniqueId: '35' + id }, r: { series, a: analyzeSeries(series) } });
  const items = [mk(1, 'JD 1', [pt(0, 200, 5), pt(1, 190, 5), pt(2, 250)]), mk(2, 'NH "2"', [pt(0, 100), pt(1, 40)])];
  it('totales, lotes y acumulado', () => {
    expect(fleetTotals(items)).toMatchObject({ cons: 10, rl: 60, dl: 60 });
    expect(byLot(items, (d) => (d.id === 1 ? 'Lote A' : null)).map(([k]) => k)).toEqual(['Lote A', 'Fuera de lote']);
    expect(cumulative(items).at(-1).y).toBe(10);
  });
  it('CSV con BOM, encabezado y comillas escapadas', () => {
    const csv = eventsCsv(allEvents(items), 24);
    expect(csv.startsWith('﻿Tractor,IMEI,Fecha y hora,Evento,Litros,Costo estimado MXN,Latitud,Longitud\r\n')).toBe(true);
    expect(csv).toContain('"NH ""2""","352"');
    expect(csv).toContain(',Descarga,60,1440,23,-106');
    expect(allEvents(items, 1)).toHaveLength(1);
  });
  it('nombre del archivo y periodo', () => {
    expect(csvName('2026-11-01', '2026-11-07')).toBe('cargas-descargas_2026-11-01_2026-11-07.csv');
    const now = Date.parse('2026-11-10T18:00:00Z');
    expect(periodRange('2026-11-10', '2026-11-10', now)[1].getTime()).toBe(now);
    expect(shiftDay(-1, now)).toBe('2026-11-09');
  });
});
