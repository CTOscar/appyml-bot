// Pruebas de la lógica del Taller (portadas de patch/taller.test.cjs del panel actual).
import { test, expect } from 'vitest';
import * as t from './logic.js';

const assert = {
  strictEqual: (a, b) => expect(a).toBe(b),
  deepStrictEqual: (a, b) => expect(a).toEqual(b),
  ok: (v, msg) => expect(v, msg).toBeTruthy(),
  match: (s, r) => expect(s).toMatch(r),
};
function fresh() { t.setState(t.seed()); return t; }
const S = (x) => x.state();
const eq = (x, eco) => S(x).equipos.find((e) => e.eco === eco);

test('datos de ejemplo: flota del piloto (2 John Deere + 1 New Holland) y un implemento', () => {
  const t = fresh();
  assert.deepStrictEqual(S(t).equipos.map((e) => e.eco), ['JD-01', 'JD-02', 'NH-01', 'IM-01']);
  assert.ok(S(t).bitacora.length > 30, 'genera histórico para los KPIs');
});

test('semáforo: al NH-01 le faltan 45 h para el servicio de 250 h (próximo) y ya tiene OT abierta', () => {
  const t = fresh();
  const s = t.peorSemaforo(eq(t, 'NH-01').id);
  assert.strictEqual(s.sem, 'PROXIMO'); assert.strictEqual(s.restH, 45);
  assert.ok(s.otAbierta && s.otAbierta.folio === 'OT-00010');
});

test('OT preventiva: carga tareas, aparta el kit y pide a compras lo que falta', () => {
  const t = fresh();
  const o = t.abrirOT({ eq: eq(t, 'JD-02').id, tipo: 'PREVENTIVA', planId: 1 });
  assert.strictEqual(o.tareas.length, 4);
  const filtroComb = o.refs.find((r) => r.p === 2); // existencia 0
  assert.strictEqual(filtroComb.res, 0);
  assert.ok(S(t).requisiciones.some((r) => r.ot === o.folio && r.p === 2));
});

test('no se termina una correctiva sin clasificar la falla, ni se libera sin terminar', () => {
  const t = fresh();
  const o = t.abrirOT({ eq: eq(t, 'JD-01').id, tipo: 'CORRECTIVA', falla: 'Ruido en la transmisión' });
  assert.strictEqual(t.cambiarEstatus(o, 'LIBERADA'), false);
  assert.strictEqual(t.cambiarEstatus(o, 'TERMINADA'), false);
  assert.match(o.error, /Clasifica la falla/);
  o.fallas.push({ sis: 'Transmisión y embrague', causa: 'DESGASTE_NORMAL' });
  assert.ok(t.cambiarEstatus(o, 'TERMINADA'));
  assert.ok(t.cambiarEstatus(o, 'LIBERADA'));
  assert.strictEqual(eq(t, 'JD-01').estatus, 'OPERANDO');
});

test('surtir descuenta existencia, libera lo apartado y deja kardex', () => {
  const t = fresh();
  const o = S(t).ots.find((x) => x.folio === 'OT-00010');
  const aceite = S(t).productos.find((p) => p.id === 4);
  const antes = aceite.exist;
  t.surtir(o, 0);
  assert.strictEqual(aceite.exist, antes - 12);
  assert.strictEqual(aceite.res, 0);
  assert.ok(S(t).movs.some((m) => m.ref === 'OT-00010' && m.tipo === 'SALIDA'));
});

test('entrada al almacén recalcula costo promedio', () => {
  const t = fresh();
  const p = S(t).productos.find((x) => x.id === 3); // 4 pzas a 780
  t.entradaAlmacen(3, 4, 820, 'F-1');
  assert.strictEqual(p.exist, 8);
  assert.strictEqual(Math.round(p.costo), 800);
});

test('KPIs del periodo completo: horas, costo por hora y disponibilidad con valores razonables', () => {
  const t = fresh();
  const k = t.kpis('todo');
  assert.ok(k.horas > 100 && k.total > 0 && k.porH > 0);
  assert.ok(k.disp > 0 && k.disp <= 100);
  assert.strictEqual(k.filas.length, 3);
});

test('chat local: la jornada guarda bitácora, actualiza horómetro y valida lecturas menores', () => {
  const t = fresh();
  const e = eq(t, 'JD-01'), op = 5;
  const h0 = e.horas;
  t.procesarLocal(`JD-01 terminé, horómetro ${h0 + 8}, rastreo lote 2, 14 ha`, op);
  assert.strictEqual(e.horas, h0 + 8);
  const b = S(t).bitacora.slice(-1)[0];
  assert.strictEqual(b.labor, 'Rastreo'); assert.strictEqual(b.lote, 'Lote 2 - La Loma'); assert.strictEqual(b.cant, 14);
  t.procesarLocal('JD-01 terminé, horómetro 100', op);
  assert.match(t.chatOp(op).slice(-1)[0].txt, /no puede ser menor/);
});

test('chat local: una falla con el tractor parado abre OT correctiva urgente y lo marca descompuesto', () => {
  const t = fresh();
  const n = S(t).ots.length;
  t.procesarLocal('El JD-01 está tirando aceite del levante, quedó parado', 5);
  const o = S(t).ots.slice(-1)[0];
  assert.strictEqual(S(t).ots.length, n + 1);
  assert.strictEqual(o.tipo, 'CORRECTIVA'); assert.strictEqual(o.prioridad, 'URGENTE');
  assert.strictEqual(S(t).reportes.slice(-1)[0].sis, 'Hidráulico');
});

test('chat local: diésel fuera de rango alerta al jefe; equipo desconocido se rechaza', () => {
  const t = fresh();
  const tanque = S(t).diesel.exist;
  t.procesarLocal('Cargué 250 litros al JD-01', 5);
  assert.strictEqual(S(t).diesel.exist, tanque - 250);
  assert.match(S(t).wa.jefe.slice(-1)[0].txt, /fuera de rango/);
  t.procesarLocal('JD-09 terminé, horómetro 3000', 5);
  assert.match(t.chatOp(5).slice(-1)[0].txt, /No encontré ese equipo/);
});

test('requisiciones: se generan por bajo mínimo y siguen el flujo aprobar → recibir', () => {
  const t = fresh();
  t.syncReqs();
  const r = S(t).requisiciones.find((x) => x.estatus === 'PENDIENTE');
  assert.ok(r);
  t.aprobarReq(r.folio); assert.strictEqual(r.estatus, 'APROBADA');
  t.recibirReq(r.folio); assert.strictEqual(r.estatus, 'RECIBIDA');
});
