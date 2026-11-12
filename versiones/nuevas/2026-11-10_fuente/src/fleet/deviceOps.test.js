import { describe, expect, it } from 'vitest';
import { CMD_INITIAL, applyAction, commandFor, controls, imeiCopied, normalizeCode, reportInterval, saveErrorMessage, serviceInfo } from './deviceOps.js';

describe('ajustes del tractor', () => {
  it('normaliza el código a mayúsculas', () => {
    expect(normalizeCode('  trc-0012 ')).toBe('TRC-0012');
    expect(normalizeCode(null)).toBe('');
  });
  it('mensajes de error al guardar', () => {
    expect(saveErrorMessage({ status: 400 })).toBe('Ese código ya lo usa otro tractor.');
    expect(saveErrorMessage(new Error('x'))).toBe('No se pudo guardar el tractor. Intenta de nuevo.');
  });
  it('servicio: sin horómetro, sin último servicio, ok, por vencer y vencido', () => {
    expect(serviceInfo({ hoursMs: undefined, cada: 250, ultimo: 100 }).kind).toBe('sin-horometro');
    expect(serviceInfo({ hoursMs: 3600e3 * 300, cada: 250, ultimo: '' }).kind).toBe('sin-ultimo');
    const ok = serviceInfo({ hoursMs: 3600e3 * 150, cada: 250, ultimo: 100 });
    expect(ok.kind).toBe('ok'); expect(Math.round(ok.faltan)).toBe(200); expect(Math.round(ok.pct)).toBe(20);
    expect(serviceInfo({ hoursMs: 3600e3 * 340, cada: 250, ultimo: 100 }).kind).toBe('warn');
    const crit = serviceInfo({ hoursMs: 3600e3 * 400, cada: 250, ultimo: 100 });
    expect(crit.kind).toBe('crit'); expect(crit.text).toMatch(/^Servicio vencido hace 50\.0 h/); expect(crit.pct).toBe(100);
  });
});

describe('operación del tractor', () => {
  it('el motor requiere llave abierta y trabajar en lote requiere motor', () => {
    const c0 = controls(CMD_INITIAL);
    expect(c0.find((c) => c.act === 'eng')).toMatchObject({ enabled: false, label: 'Encender motor', sub: 'Requiere llave abierta' });
    expect(c0.find((c) => c.act === 'move')).toMatchObject({ enabled: false, sub: 'Requiere motor en marcha' });
    expect(applyAction(CMD_INITIAL, 'eng').error).toBe('Requiere llave abierta.');
    expect(applyAction(CMD_INITIAL, 'move').error).toBe('Requiere motor en marcha.');
  });
  it('flujo completo y cierre en cascada', () => {
    let s = applyAction(CMD_INITIAL, 'key').state;
    s = applyAction(s, 'eng').state;
    s = applyAction(s, 'move').state;
    expect(s).toEqual({ key: true, eng: true, move: true, cut: false });
    expect(controls(s).find((c) => c.act === 'eng').label).toBe('Apagar motor');
    const r = applyAction(s, 'key');
    expect(r.state).toEqual({ key: false, eng: false, move: false, cut: false });
    expect(r.log.map((l) => l.text)).toContain('Llave cerrada');
  });
  it('desconectar y reconectar equipo', () => {
    const a = applyAction(CMD_INITIAL, 'cut');
    expect(a.state.cut).toBe(true); expect(a.log[0].sev).toBe('crit');
    expect(controls(a.state).find((c) => c.act === 'cut').label).toBe('Reconectar equipo');
    expect(applyAction(a.state, 'cut').state.cut).toBe(false);
  });
  it('intervalo de reportes y comandos de Traccar', () => {
    expect(reportInterval({ move: true })).toBe(60);
    expect(reportInterval({ move: false })).toBe(1800);
    expect(commandFor('cut', { cut: true })).toEqual({ type: 'engineStop', attributes: {} });
    expect(commandFor('cut', { cut: false })).toEqual({ type: 'engineResume', attributes: {} });
    expect(commandFor('move', { move: true })).toEqual({ type: 'positionPeriodic', attributes: { frequency: 60 } });
    expect(commandFor('key', { key: true })).toBeNull();
    expect(imeiCopied('123')).toBe('IMEI copiado: 123');
  });
});

describe('comandos desde el estado de la flota', () => {
  it('sendCommand valida reglas, manda el comando al cliente y guarda el estado', async () => {
    const { createFleetStore } = await import('./store.js');
    const sent = [], m = new Map();
    const client = { mode: 'mock', getDevices: async () => [], getPositions: async () => [], sendCommand: async (c) => { sent.push(c); return c; } };
    const store = createFleetStore(client, { storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } });
    expect(store.canCommand()).toBe(true);
    await expect(store.sendCommand(7, 'eng')).rejects.toThrow('Requiere llave abierta.');
    await store.sendCommand(7, 'key'); await store.sendCommand(7, 'eng'); await store.sendCommand(7, 'move');
    await store.sendCommand(7, 'cut');
    expect(sent).toEqual([{ deviceId: 7, type: 'positionPeriodic', attributes: { frequency: 60 } }, { deviceId: 7, type: 'engineStop', attributes: {} }]);
    expect(store.cmdState(7)).toEqual({ key: true, eng: true, move: true, cut: true });
    expect(JSON.parse(m.get('pf2-cmd-7')).cut).toBe(true);
  });
});
