import { describe, expect, it } from 'vitest';
import {
  elevationUrl, googleDirectionsUrl, googleMapsUrl, osrmUrl, parseElevation, parseOsrm, parsePlace, parseWeatherLotes,
  resumenRuta, reverseUrl, streetViewUrl, weatherLotesUrl,
} from './mapApis.js';

describe('enlaces de Google Maps (sin clave)', () => {
  it('indicaciones con y sin origen', () => {
    expect(googleDirectionsUrl({ dest: [22.7, -105.9] })).toBe('https://www.google.com/maps/dir/?api=1&destination=22.700000,-105.900000&travelmode=driving');
    expect(googleDirectionsUrl({ dest: [22.7, -105.9], origin: [22.8, -105.8] })).toContain('&origin=22.800000,-105.800000');
  });
  it('punto y Street View', () => {
    expect(googleMapsUrl([22.7, -105.9])).toContain('query=22.700000,-105.900000');
    expect(streetViewUrl([22.7, -105.9])).toContain('map_action=pano&viewpoint=22.700000,-105.900000');
  });
});

describe('ruta por camino (OSRM)', () => {
  it('arma la URL con lon,lat', () => {
    expect(osrmUrl([22.7, -105.9], [22.8, -105.8])).toContain('/driving/-105.9,22.7;-105.8,22.8?');
  });
  it('convierte la respuesta a [lat, lon]', () => {
    const r = parseOsrm({ code: 'Ok', routes: [{ distance: 3400, duration: 420, geometry: { coordinates: [[-105.9, 22.7], [-105.8, 22.8]] } }], waypoints: [{ distance: 12.5 }, { distance: 2300 }] });
    expect(r).toEqual({ distM: 3400, durS: 420, coords: [[22.7, -105.9], [22.8, -105.8]], snapM: [12.5, 2300] });
    expect(parseOsrm({ code: 'Ok', routes: [{ distance: 1, duration: 1, geometry: { coordinates: [[0, 0]] } }] }).snapM).toEqual([0, 0]);
  });
  it('sin ruta devuelve null', () => {
    expect(parseOsrm({ code: 'NoRoute', routes: [] })).toBeNull();
    expect(parseOsrm(null)).toBeNull();
  });
  it('resume distancia y tiempo', () => {
    expect(resumenRuta({ distM: 850, durS: 100 })).toBe('850 m · 2 min');
    expect(resumenRuta({ distM: 12500, durS: 4000 })).toBe('13 km · 1 h 7 min');
  });
});

describe('elevación y lugar', () => {
  it('elevación', () => {
    expect(elevationUrl([[22.7, -105.9]])).toContain('latitude=22.70000&longitude=-105.90000');
    expect(parseElevation({ elevation: [48.0] })).toEqual([48]);
    expect(parseElevation({})).toEqual([]);
  });
  it('lugar de Nominatim', () => {
    expect(reverseUrl([22.7, -105.9])).toContain('accept-language=es');
    expect(parsePlace({ address: { village: 'El Rosario', county: 'Rosario', state: 'Sinaloa', country: 'México' } })).toEqual({ titulo: 'El Rosario', detalle: 'Rosario, Sinaloa, México' });
    expect(parsePlace({ error: 'Unable to geocode' })).toBeNull();
    expect(parsePlace({ display_name: 'Camino rural, Rosario, Sinaloa, México' })).toEqual({ titulo: 'Camino rural', detalle: 'Rosario, Sinaloa, México' });
  });
});

describe('clima por lote', () => {
  it('pide varios puntos en una sola llamada', () => {
    const u = weatherLotesUrl([[22.7, -105.9], [22.8, -105.8]]);
    expect(u).toContain('latitude=22.7000,22.8000&longitude=-105.9000,-105.8000');
    expect(u).toContain('wind_speed_unit=kmh');
  });
  const punto = (wind, gust, rain = 0, temp = 28) => ({
    current: { temperature_2m: temp, relative_humidity_2m: 40, precipitation: 0, weather_code: 0, wind_speed_10m: wind, wind_direction_10m: 90, wind_gusts_10m: gust },
    hourly: { time: ['2026-11-12T08:00', '2026-11-12T09:00'], precipitation_probability: [rain, rain] },
  });
  it('clasifica favorable, precaución y no recomendable con el criterio de Inicio', () => {
    const [a, b, c] = parseWeatherLotes([punto(8, 14), punto(18, 20), punto(30, 45)], new Date('2026-11-12T08:00').getTime());
    expect(a.risk[0]).toBe('ok');
    expect(b.risk[0]).toBe('warn');
    expect(c.risk[0]).toBe('crit');
    expect(a.dir).toBe('E');
  });
  it('la lluvia próxima pesa en el veredicto', () => {
    const [r] = parseWeatherLotes(punto(8, 14, 70), new Date('2026-11-12T08:00').getTime());
    expect(r.rainMax).toBe(70);
    expect(r.risk[0]).toBe('crit');
  });
  it('acepta un solo punto (objeto) y respuestas vacías', () => {
    expect(parseWeatherLotes(punto(5, 8))).toHaveLength(1);
    expect(parseWeatherLotes(null)).toEqual([]);
    expect(parseWeatherLotes([{}])).toEqual([null]);
  });
});
