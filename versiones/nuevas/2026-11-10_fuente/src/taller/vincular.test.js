import { describe, expect, it } from 'vitest';
import { vincularPorModelo } from '../taller/vincular.js';

const mk = (equipos, modelos) => ({ state: () => ({ equipos, modelos }) });
const dev = (id, marca, modelo) => [id, { id, name: `TRC-000${id}`, attributes: { marca, modelo } }];

describe('vincularPorModelo', () => {
  it('une por marca y modelo cuando la coincidencia es única', () => {
    const eq = [{ id: 1, modelo: 1, usaH: true, deviceId: null }];
    vincularPorModelo(mk(eq, { 1: 'John Deere 6110J' }), new Map([dev(1, 'john-deere', '5075E'), dev(3, 'john-deere', '6110J')]));
    expect(eq[0].deviceId).toBe(3);
  });
  it('no vincula si dos tractores son del mismo modelo', () => {
    const eq = [{ id: 1, modelo: 1, usaH: true, deviceId: null }];
    vincularPorModelo(mk(eq, { 1: 'John Deere 6110J' }), new Map([dev(1, 'john-deere', '6110J'), dev(2, 'john-deere', '6110J')]));
    expect(eq[0].deviceId).toBeNull();
  });
  it('respeta «Sin vincular» elegido a mano y los implementos', () => {
    const eq = [{ id: 1, modelo: 1, usaH: true, deviceId: null, vincManual: true }, { id: 2, modelo: 2, usaH: false, deviceId: null }];
    vincularPorModelo(mk(eq, { 1: 'John Deere 6110J', 2: 'John Deere 6110J' }), new Map([dev(3, 'john-deere', '6110J')]));
    expect(eq.map((e) => e.deviceId)).toEqual([null, null]);
  });
});
