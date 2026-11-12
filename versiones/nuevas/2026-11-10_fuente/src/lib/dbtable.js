// Utilidades de las tablas de «Accounts» (estilo cliente de MySQL): ordenar, filtrar, exportar a CSV, marcar registros nuevos y dar formato.
// Todo es puro y se prueba aparte.

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Valor de una celda para ordenar/filtrar/exportar: usa `col.valor(row)` si existe, si no `row[col.key]`. */
export const valorDe = (col, row) => (col.valor ? col.valor(row) : row[col.key]);

/** Filtra por texto en todas las columnas (sin acentos ni mayúsculas); varias palabras = todas deben aparecer. */
export function filtrar(rows, cols, q) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return rows;
  return rows.filter((r) => { const t = norm(cols.map((c) => { const v = valorDe(c, r); return v && typeof v === 'object' ? JSON.stringify(v) : v; }).join(' ')); return toks.every((k) => t.includes(k)); });
}

const cmp = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
};
/** Ordena sin tocar el arreglo original. dir = 'asc' | 'desc'. Los vacíos van siempre al final. */
export function ordenar(rows, col, dir = 'asc') {
  if (!col) return rows;
  const s = dir === 'desc' ? -1 : 1;
  return [...rows].sort((x, y) => {
    const a = valorDe(col, x), b = valorDe(col, y);
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return s * cmp(a, b);
  });
}

const celdaCSV = (v) => {
  const t = v == null ? '' : v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Neutraliza fórmulas (=, +, -, @) que Excel ejecutaría al abrir el archivo.
  const seguro = /^[=+\-@\t\r]/.test(t) && !/^[-+]?\d+(\.\d+)?$/.test(t) ? `'${t}` : t;
  return /[",\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};
/** CSV con BOM (para que Excel lea bien los acentos). Solo las columnas con `csv !== false`. */
export function aCSV(cols, rows) {
  const cs = cols.filter((c) => c.csv !== false);
  return '﻿' + [cs.map((c) => celdaCSV(c.key)).join(','), ...rows.map((r) => cs.map((c) => celdaCSV(valorDe(c, r))).join(','))].join('\r\n') + '\r\n';
}

/** Cuántos registros son posteriores a `visto` (ISO). Sin `visto` (primera visita) ninguno se marca como nuevo. */
export function esNuevo(fecha, visto) {
  if (!visto || !fecha) return false;
  const a = new Date(fecha).getTime(), b = new Date(visto).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && a > b;
}
export const contarNuevos = (rows, campo, visto) => rows.filter((r) => esNuevo(r[campo], visto)).length;

/** «hace 5 min», «hace 3 h», «hace 2 d»; fechas futuras: «en 6 d». */
export function relativo(fecha, ahora = Date.now()) {
  const t = fecha ? new Date(fecha).getTime() : NaN;
  if (!Number.isFinite(t)) return '—';
  const d = t - ahora, a = Math.abs(d), m = Math.round(a / 60000);
  const txt = a < 45e3 ? 'unos segundos' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
  return d > 0 && a >= 45e3 ? `en ${txt}` : a < 45e3 ? 'ahora' : `hace ${txt}`;
}

/** Fecha y hora local corta para celdas: «12 nov 2026 03:36:38». */
export function fechaHora(fecha) {
  const d = fecha ? new Date(fecha) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', '');
}

/** Pie de resultados al estilo del cliente: «5 filas en el conjunto (0.02 s)». */
export const pieResultado = (n, seg) => `${n} ${n === 1 ? 'fila' : 'filas'} en el conjunto${Number.isFinite(seg) ? ` (${seg.toFixed(2)} s)` : ''}`;

// Qué se marcó como visto en cada tabla (localStorage). Se tolera que no haya almacenamiento.
const KEY = 'pf-accounts-vistos-v1';
export const leerVistos = (storage = globalThis.localStorage) => { try { return JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { return {}; } };
export function marcarVisto(tabla, iso, storage = globalThis.localStorage) {
  const v = { ...leerVistos(storage), [tabla]: iso };
  try { storage?.setItem(KEY, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
  return v;
}
