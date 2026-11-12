import { describe, expect, it } from 'vitest';
import { statusOf, summarize, greeting } from './fleet.js';
import { parseHash } from '../app/router.js';
import { passwordOk } from '../app/auth.jsx';

const now = Date.parse('2026-11-10T18:00:00Z');
const dev = (id, extra = {}) => ({ id, status: 'online', lastUpdate: new Date(now - 60e3).toISOString(), attributes: { marca: 'john-deere' }, ...extra });

describe('estado del tractor', () => {
  it('encendido = en marcha, apagado = apagado', () => {
    expect(statusOf(dev(1), { attributes: { ignition: true } }, now)).toBe('running');
    expect(statusOf(dev(1), { attributes: { ignition: false } }, now)).toBe('idle');
  });
  it('más de 35 min sin reportar o fuera de línea = sin señal', () => {
    expect(statusOf(dev(1, { lastUpdate: new Date(now - 36 * 60e3).toISOString() }), { attributes: { ignition: true } }, now)).toBe('nosignal');
    expect(statusOf(dev(1, { status: 'offline' }), null, now)).toBe('nosignal');
    expect(statusOf(null, null, now)).toBe('nosignal');
  });
  it('resumen de la flota: estados, horas de motor y marcas', () => {
    const r = summarize([dev(1), dev(2, { attributes: { marca: 'new-holland' } }), dev(3, { status: 'offline' })],
      [{ deviceId: 1, attributes: { ignition: true } }, { deviceId: 2, attributes: {} }], [{ deviceId: 1, engineHours: 7200e3 }], now);
    expect(r).toMatchObject({ total: 3, running: 1, idle: 1, nosignal: 1, engineMs: 7200e3, brands: { 'john-deere': 2, 'new-holland': 1 } });
  });
  it('saludo según la hora de Mazatlán', () => {
    expect(greeting(new Date('2026-11-10T15:00:00Z'))).toBe('Buenos días'); // 08:00 MST
    expect(greeting(new Date('2026-11-10T22:00:00Z'))).toBe('Buenas tardes'); // 15:00
    expect(greeting(new Date('2026-11-11T04:00:00Z'))).toBe('Buenas noches'); // 21:00
  });
});

describe('enrutador por hash', () => {
  it('separa ruta, subruta y consulta', () => {
    expect(parseHash('#/taller/ordenes?ot=5')).toMatchObject({ path: '/taller', rest: ['ordenes'], query: { ot: '5' } });
    expect(parseHash('')).toMatchObject({ path: '/', rest: [] });
    expect(parseHash('#tractores')).toMatchObject({ path: '/tractores' });
  });
});

describe('contraseña del registro', () => {
  it('pide largo, mayúscula, minúscula, número y símbolo', () => {
    expect(passwordOk('Prueba12345!')).toBe(true);
    expect(passwordOk('prueba12345!')).toBe(false);
    expect(passwordOk('Corta1!')).toBe(false);
  });
});
