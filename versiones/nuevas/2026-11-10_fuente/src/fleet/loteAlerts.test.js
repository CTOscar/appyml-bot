import { describe, expect, it } from 'vitest';
import { alertasTexto, applyLoteForm, loteAlerts, loteForm, validateLote } from './loteAlerts.js';

const fences = [
  { id: 1, name: 'Lote 1', attributes: { alertaEntrada: true, alertaSalida: true, horasMax: 1 }, shape: {}, ha: 3 },
  { id: 2, name: 'Lote 2', attributes: {} },
];

describe('formulario del lote', () => {
  it('valida el nombre y los rangos', () => {
    expect(validateLote({ name: '  ', superficie: '', horasMax: '' })).toBe('Escribe el nombre del lote.');
    expect(validateLote({ name: 'A', superficie: '', horasMax: 30 })).toMatch(/entre 0 y 24/);
    expect(validateLote({ name: 'A', superficie: '2', horasMax: '8' })).toBeNull();
  });
  it('conserva attributes ajenos y quita la forma calculada', () => {
    const out = applyLoteForm(fences[0], { ...loteForm(fences[0]), name: ' Nuevo ', horasMax: '5', superficie: '' });
    expect(out.name).toBe('Nuevo');
    expect(out.shape).toBeUndefined(); expect(out.ha).toBeUndefined();
    expect(out.attributes).toMatchObject({ horasMax: 5, superficie: '', alertaEntrada: true });
  });
  it('resume las alertas', () => {
    expect(alertasTexto({ alertaEntrada: true, alertaSalida: true })).toBe('entrada y salida');
    expect(alertasTexto({})).toBe('Ninguna');
  });
});

describe('alertas por lote', () => {
  it('entrada y salida solo con lectura previa y el interruptor del lote', () => {
    const r = {};
    expect(loteAlerts({ r, prevFid: 0, fid: 1, first: true, fences, day: 'd' })).toEqual([]);
    expect(loteAlerts({ r, prevFid: 0, fid: 1, fences, day: 'd' }).map((e) => e.titulo)).toEqual(['Entró a Lote 1']);
    expect(loteAlerts({ r, prevFid: 1, fid: 2, fences, day: 'd' }).map((e) => e.titulo)).toEqual(['Salió de Lote 1']);
    expect(loteAlerts({ r, prevFid: 2, fid: 0, fences, day: 'd' })).toEqual([]);
  });
  it('horas máximas una vez por día y lote', () => {
    const r = {}, a = { r, prevFid: 1, fid: 1, ign: true, dt: 60000, fences, day: 'd' };
    let n = 0;
    for (let i = 0; i < 80; i++) n += loteAlerts(a).length;
    expect(n).toBe(1);
    expect(loteAlerts({ ...a, day: 'e' })).toEqual([]);
  });
  it('no cuenta con el motor apagado', () => {
    const r = {};
    for (let i = 0; i < 80; i++) expect(loteAlerts({ r, prevFid: 1, fid: 1, ign: false, dt: 60000, fences, day: 'd' })).toEqual([]);
  });
});
