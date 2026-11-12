import { describe, expect, it } from 'vitest';
import { aCSV, contarNuevos, esNuevo, fechaHora, filtrar, leerVistos, marcarVisto, ordenar, pieResultado, relativo } from './dbtable.js';

const cols = [{ key: 'id' }, { key: 'email' }, { key: 'role' }, { key: 'puesto', valor: (r) => r.attributes?.puesto }];
const rows = [
  { id: 2, email: 'beto@x.mx', role: 'operador', attributes: { puesto: 'Tractorista' } },
  { id: 10, email: 'ana@x.mx', role: 'admin', attributes: { puesto: 'Gerente' } },
  { id: 3, email: 'cruz@x.mx', role: 'supervisor', attributes: {} },
];

describe('filtrar', () => {
  it('busca sin acentos ni mayúsculas, incluso en columnas calculadas', () => {
    expect(filtrar(rows, cols, 'GERENTE').map((r) => r.id)).toEqual([10]);
    expect(filtrar(rows, cols, 'tractorista operador').map((r) => r.id)).toEqual([2]);
    expect(filtrar(rows, cols, '').length).toBe(3);
    expect(filtrar(rows, cols, 'nada').length).toBe(0);
  });
});

describe('ordenar', () => {
  it('ordena números como números y no cambia el original', () => {
    expect(ordenar(rows, cols[0]).map((r) => r.id)).toEqual([2, 3, 10]);
    expect(ordenar(rows, cols[0], 'desc').map((r) => r.id)).toEqual([10, 3, 2]);
    expect(rows[0].id).toBe(2);
  });
  it('los vacíos van al final en cualquier dirección', () => {
    expect(ordenar(rows, cols[3]).map((r) => r.id)).toEqual([10, 2, 3]);
    expect(ordenar(rows, cols[3], 'desc').map((r) => r.id)).toEqual([2, 10, 3]);
  });
});

describe('aCSV', () => {
  it('lleva BOM, encabezados y escapa comillas, comas y saltos', () => {
    const csv = aCSV([{ key: 'a' }, { key: 'b' }], [{ a: 'uno, dos', b: 'dice "hola"\nadiós' }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('a,b\r\n"uno, dos","dice ""hola""\nadiós"');
  });
  it('neutraliza fórmulas de Excel pero respeta números negativos', () => {
    const csv = aCSV([{ key: 'x' }], [{ x: '=HYPERLINK("http://x")' }, { x: '-5' }, { x: '+52 694' }]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('\r\n-5\r\n');
    expect(csv).toContain("'+52 694");
  });
  it('omite las columnas con csv:false', () => {
    expect(aCSV([{ key: 'a' }, { key: 'b', csv: false }], [{ a: 1, b: 2 }])).toBe('﻿a\r\n1\r\n');
  });
});

describe('registros nuevos', () => {
  it('sin fecha de «visto» (primera visita) nada es nuevo', () => {
    expect(esNuevo('2026-11-12T10:00:00Z', null)).toBe(false);
  });
  it('es nuevo lo posterior al visto', () => {
    expect(esNuevo('2026-11-12T10:00:01Z', '2026-11-12T10:00:00Z')).toBe(true);
    expect(esNuevo('2026-11-12T09:59:00Z', '2026-11-12T10:00:00Z')).toBe(false);
    expect(contarNuevos([{ at: '2026-11-12T11:00:00Z' }, { at: '2026-11-01T00:00:00Z' }], 'at', '2026-11-10T00:00:00Z')).toBe(1);
  });
  it('guarda y lee lo visto por tabla', () => {
    const m = new Map(); const st = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    marcarVisto('users', '2026-11-12T10:00:00Z', st); marcarVisto('login_log', '2026-11-12T11:00:00Z', st);
    expect(leerVistos(st)).toEqual({ users: '2026-11-12T10:00:00Z', login_log: '2026-11-12T11:00:00Z' });
    expect(leerVistos({ getItem: () => '{roto' })).toEqual({});
  });
});

describe('formato', () => {
  const t0 = Date.parse('2026-11-12T12:00:00Z');
  it('relativo', () => {
    expect(relativo('2026-11-12T11:55:00Z', t0)).toBe('hace 5 min');
    expect(relativo('2026-11-12T09:00:00Z', t0)).toBe('hace 3 h');
    expect(relativo('2026-11-10T12:00:00Z', t0)).toBe('hace 2 d');
    expect(relativo('2026-11-18T12:00:00Z', t0)).toBe('en 6 d');
    expect(relativo('2026-11-12T11:59:50Z', t0)).toBe('ahora');
    expect(relativo(null, t0)).toBe('—');
  });
  it('fechaHora y pie de resultados', () => {
    expect(fechaHora('no es fecha')).toBe('—');
    expect(fechaHora('2026-11-12T10:36:38Z')).toMatch(/2026/);
    expect(pieResultado(1, 0.012)).toBe('1 fila en el conjunto (0.01 s)');
    expect(pieResultado(5)).toBe('5 filas en el conjunto');
  });
});
