import { describe, expect, it } from 'vitest';
import { evInfo, countEvents, sortedEvents } from './events.js';
import { fmtDur } from '../fleet/ops.js';

describe('etiquetas de eventos', () => {
  it('traduce los tipos de Traccar sin clasificación propia', () => {
    expect(evInfo({ type: 'deviceOffline' }).label).toBe('Sin señal');
    expect(evInfo({ type: 'deviceOnline' }).label).toBe('Con señal');
  });
  it('un tipo desconocido conserva su nombre original', () => {
    expect(evInfo({ type: 'algoNuevo' }).label).toBe('algoNuevo');
  });
  it('cuenta las altas aparte de Encendido/Apagado', () => {
    const ev = sortedEvents([
      { id: 1, type: 'ignitionOn', eventTime: '2026-11-12T10:00:00Z' },
      { id: 2, type: 'deviceFuelDrop', eventTime: '2026-11-12T11:00:00Z' },
      { id: 3, type: 'ignitionOff', eventTime: '2026-11-12T12:00:00Z' },
    ]);
    const c = countEvents(ev);
    expect(c.todos).toBe(3);
    expect(c.altas).toBe(1);
  });
});

describe('fmtDur con tiempos cortos', () => {
  it('no dice «0 min» cuando ya hay tiempo medido', () => {
    expect(fmtDur(0)).toBe('0 min');
    expect(fmtDur(20_000)).toBe('<1 min');
    expect(fmtDur(60_000)).toBe('1 min');
  });
});

import { icoPara } from '../ui/menuIcons.js';

describe('íconos a color por significado', () => {
  it('asigna un SVG a las etiquetas de indicadores y secciones', () => {
    const con = ['Descompuestos', 'Servicios vencidos', 'Por pedir', 'Operando', 'Costo total', '$ por hora', 'Consumo', 'Horas hoy', 'Superficie',
      'Descargas', 'Cargas', 'Disponibilidad', 'Preventivo al día', 'Corte de energía', 'Notas', 'Apariencia', 'Identificación', 'En marcha'];
    con.forEach((t) => expect(icoPara(t), `sin SVG: ${t}`).toBeTruthy());
  });
  it('mantiene los significados que podrían confundirse', () => {
    expect(icoPara('Descargas')).not.toBe(icoPara('Cargas'));
    expect(icoPara('Costos y KPIs')).not.toBe(icoPara('Costo total'));
    expect(icoPara('Algo que no tiene ícono')).toBeUndefined();
  });
});
