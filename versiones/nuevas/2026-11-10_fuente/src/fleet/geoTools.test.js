import { describe, expect, it } from 'vitest';
import { decodeView, distM, encodeView, etaMin, fmtDist, fmtEta, matches, nearest, within } from './geoTools.js';

describe('herramientas del mapa (lógica pura de maptools.js)', () => {
  it('distancia, más cercano y dentro de un radio', () => {
    expect(distM([23, -105.9], [23, -105.9])).toBe(0);
    expect(distM([0, 0], [0, 1])).toBeCloseTo(111195, -2); // 1° de longitud en el ecuador
    const items = [{ id: 1, lat: 23.001, lon: -105.9 }, { id: 2, lat: 23.01, lon: -105.9 }, { id: 3, lat: 23.0003, lon: -105.9 }];
    expect(nearest(items, 23, -105.9).item.id).toBe(3);
    expect(within(items, 23, -105.9, 200).map((x) => x.item.id)).toEqual([3, 1]); // ordenados por distancia; el 2 queda fuera
    expect(nearest([], 0, 0)).toBeNull();
  });
  it('formatos de distancia y tiempo', () => {
    expect(fmtDist(450)).toBe('450 m'); expect(fmtDist(1500)).toBe('1.50 km'); expect(fmtDist(25000)).toBe('25.0 km');
    expect(fmtEta(etaMin(5000, 15))).toBe('20 min'); expect(fmtEta(etaMin(100, 0))).toBe('—'); expect(fmtEta(0.2)).toBe('< 1 min'); expect(fmtEta(135)).toBe('2 h 15 min');
  });
  it('búsqueda sin acentos y con todas las palabras', () => {
    expect(matches('Pozo Número 3 · Lote Álamo', 'pozo alamo')).toBe(true);
    expect(matches('Pozo 3', 'pozo bodega')).toBe(false);
    expect(matches('abc', '   ')).toBe(false);
  });
  it('enlace para compartir: ida y vuelta y rechazo de datos malos', () => {
    const v = { layer: 'satelite', lat: 22.99812, lon: -105.87801, zoom: 15.4, sel: 12 };
    const s = encodeView(v);
    expect(s).toBe('sat,22.99812,-105.87801,15,t12');
    expect(decodeView(s)).toEqual({ layer: 'satelite', lat: 22.99812, lon: -105.87801, zoom: 15, sel: 12 });
    expect(decodeView('map,1,2,3')).toEqual({ layer: 'oscuro', lat: 1, lon: 2, zoom: 3, sel: null });
    ['', 'foo,1,2,3', 'map,99,2,3', 'map,1,200,3', 'map,1,2,30', 'map,1,2,3,x9', 'map,a,b,c'].forEach((x) => expect(decodeView(x)).toBeNull());
  });
});
