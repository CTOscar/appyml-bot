// Lógica del Taller (órdenes de trabajo, almacén, KPIs, reglas del chat local).
// Extraída sin cambios de reglas desde panelpack/assets/taller.js del panel actual (líneas 15-741):
// sin DOM. Los avisos pasan por `hooks.toast` y el estado vive en localStorage (`pf-taller-v1`).
/* eslint-disable */
export const hooks = { toast() {} };
function toast(msg) { hooks.toast(msg); }

  /* ================= catálogos ================= */
  var SISTEMAS = ['Motor', 'Enfriamiento', 'Combustible', 'Hidráulico', 'Transmisión y embrague', 'Toma de fuerza (TDF)', 'Eléctrico', 'Frenos', 'Dirección', 'Ejes, llantas y rodaje', 'Enganche de 3 puntos', 'Cabina', 'Chasis y estructura'];
  var CAUSAS = [
    ['DESGASTE_NORMAL', 'Desgaste normal por uso', false], ['FALTA_MANTENIMIENTO', 'Falta de mantenimiento', false],
    ['MAL_USO', 'Mal uso u operación incorrecta', true], ['SOBRECARGA', 'Sobrecarga o implemento inadecuado', true],
    ['SIN_CHECKLIST', 'No se revisó antes de operar', true], ['ACCIDENTE', 'Accidente o golpe', true],
    ['DEFECTO_PIEZA', 'Defecto de la pieza', false], ['MALA_REPARACION', 'Reparación anterior mal hecha', false],
    ['CONTAMINACION', 'Combustible o aceite contaminado', false], ['DESCONOCIDA', 'Causa no determinada', false]
  ];
  var LOTES = ['Lote 1 - El Bajío', 'Lote 2 - La Loma', 'Lote 3 - El Pozo'];
  var LABORES = [['Barbecho', 'ha'], ['Rastreo', 'ha'], ['Nivelación', 'ha'], ['Siembra', 'ha'], ['Cultivo / escarda', 'ha'], ['Fertilización', 'ha'], ['Fumigación', 'ha'], ['Desvare', 'ha'], ['Acarreo', 'viajes'], ['Otros', 'h']];
  var CATS = ['Filtros', 'Lubricantes', 'Refacciones', 'Llantas'];
  var CAP_DIESEL = 10000, CAP_TANQUE = 200, REORDEN_DIESEL = 1500;

  /* ================= datos de ejemplo (piloto Las Cabras) ================= */
  function seedBase() {
    return {
      v: 1,
      seq: { ot: 10, rf: 1, req: 1 },
      empleados: [
        { id: 1, nombre: 'Jorge Treviño', puesto: 'Jefe de taller', costo: 180 },
        { id: 2, nombre: 'Luis Ramírez', puesto: 'Mecánico', costo: 120 },
        { id: 3, nombre: 'Pedro Salinas', puesto: 'Mecánico', costo: 110 },
        { id: 4, nombre: 'Ana Morales', puesto: 'Almacenista', costo: 90 },
        { id: 5, nombre: 'Ramón Cota', puesto: 'Operador', costo: 75 },
        { id: 6, nombre: 'Héctor Valdez', puesto: 'Operador', costo: 75 },
        { id: 7, nombre: 'Carlos Ibarra', puesto: 'Operador', costo: 75 },
        { id: 8, nombre: 'Marta López', puesto: 'Supervisora de campo', costo: 130 }
      ],
      modelos: { 1: 'John Deere 6110J', 2: 'John Deere 5090E', 3: 'New Holland T6.110', 4: 'Rastra 24 discos' },
      autorizaciones: [{ emp: 5, modelo: 1 }, { emp: 6, modelo: 3 }],
      equipos: [
        { id: 1, eco: 'JD-01', modelo: 1, horas: 2266.3, horasAlta: 2240, estatus: 'OPERANDO', usaH: true, deviceId: null },
        { id: 2, eco: 'JD-02', modelo: 2, horas: 1198, horasAlta: 1180, estatus: 'OPERANDO', usaH: true, deviceId: null },
        { id: 3, eco: 'NH-01', modelo: 3, horas: 5905, horasAlta: 5890, estatus: 'EN_TALLER', usaH: true, deviceId: null },
        { id: 4, eco: 'IM-01', modelo: 4, horas: 0, horasAlta: 0, estatus: 'OPERANDO', usaH: false, deviceId: null }
      ],
      planes: [
        { id: 1, modelos: [1, 2], nombre: 'Servicio 250 h', intH: 250, intD: 180,
          tareas: ['Cambiar aceite de motor', 'Cambiar filtro de aceite', 'Cambiar filtro de combustible', 'Engrasar puntos de articulación'],
          kit: [[1, 1], [2, 1], [4, 14], [6, 1]] },
        { id: 2, modelos: [1, 2], nombre: 'Servicio 500 h', intH: 500, intD: 365,
          tareas: ['Cambiar aceite de motor', 'Cambiar filtros de aceite y combustible', 'Cambiar filtro de aire primario', 'Cambiar aceite hidráulico/transmisión'],
          kit: [[1, 1], [2, 1], [3, 1], [4, 14], [5, 60]] },
        { id: 3, modelos: [3], nombre: 'Servicio 250 h', intH: 250, intD: 180,
          tareas: ['Cambiar aceite de motor', 'Cambiar filtro de aceite'], kit: [[4, 12]] }
      ],
      ep: [
        { eq: 1, plan: 1, ultH: 2266, ultF: '2026-10-04' }, { eq: 1, plan: 2, ultH: 2240, ultF: '2026-09-01' },
        { eq: 2, plan: 1, ultH: 1180, ultF: '2026-09-01' }, { eq: 2, plan: 2, ultH: 1180, ultF: '2026-09-01' },
        { eq: 3, plan: 3, ultH: 5700, ultF: '2026-08-16' }
      ],
      productos: [
        { id: 1, codigo: 'FIL-ACE-01', desc: 'Filtro de aceite motor JD', cat: 'Filtros', u: 'pza', costo: 320, min: 4, max: 10, exist: 7, res: 0, camino: 0 },
        { id: 2, codigo: 'FIL-COM-01', desc: 'Filtro de combustible JD', cat: 'Filtros', u: 'pza', costo: 450, min: 4, max: 10, exist: 0, res: 0, camino: 3 },
        { id: 3, codigo: 'FIL-AIR-01', desc: 'Filtro de aire primario JD', cat: 'Filtros', u: 'pza', costo: 780, min: 2, max: 6, exist: 4, res: 0, camino: 0 },
        { id: 12, codigo: 'FIL-HID-NH', desc: 'Filtro hidráulico NH', cat: 'Filtros', u: 'pza', costo: 690, min: 2, max: 4, exist: 2, res: 0, camino: 0 },
        { id: 4, codigo: 'ACE-15W40', desc: 'Aceite motor 15W-40', cat: 'Lubricantes', u: 'L', costo: 75, min: 100, max: 416, exist: 402, res: 12, camino: 0 },
        { id: 5, codigo: 'ACE-HID', desc: 'Aceite hidráulico/transmisión', cat: 'Lubricantes', u: 'L', costo: 82.69, min: 100, max: 416, exist: 408, res: 0, camino: 0 },
        { id: 6, codigo: 'GRASA-MP', desc: 'Grasa multiusos', cat: 'Lubricantes', u: 'kg', costo: 57.89, min: 10, max: 38, exist: 18, res: 0, camino: 0 },
        { id: 11, codigo: 'REF-ANTICONG', desc: 'Refrigerante / anticongelante', cat: 'Lubricantes', u: 'L', costo: 45, min: 40, max: 120, exist: 64, res: 0, camino: 0 },
        { id: 8, codigo: 'BAND-ALT', desc: 'Banda de alternador', cat: 'Refacciones', u: 'pza', costo: 380, min: 1, max: 3, exist: 2, res: 0, camino: 0 },
        { id: 9, codigo: 'MANG-HID-12', desc: 'Manguera hidráulica 1/2"', cat: 'Refacciones', u: 'pza', costo: 650, min: 2, max: 6, exist: 3, res: 0, camino: 0 },
        { id: 10, codigo: 'LLA-18434', desc: 'Llanta trasera 18.4-34', cat: 'Llantas', u: 'pza', costo: 14500, min: 1, max: 2, exist: 1, res: 0, camino: 0 }
      ],
      diesel: { exist: 7285, costo: 24.10 },
      ots: [
        { id: 1, folio: 'OT-00001', eq: 1, tipo: 'PREVENTIVA', plan: 1, aTiempo: true, estatus: 'LIBERADA', prioridad: 'MEDIA',
          recepcion: '2026-08-05T07:00', falla: 'Servicio 250 h', diagnostico: '', resp: 2, opFalla: null, reporte: null,
          tareas: [['Cambiar aceite de motor', true], ['Cambiar filtro de aceite', true], ['Cambiar filtro de combustible', true], ['Engrasar puntos de articulación', true]],
          refs: [{ p: 1, sol: 1, res: 0, sur: 1, costo: 310 }, { p: 2, sol: 1, res: 0, sur: 1, costo: 440 }, { p: 4, sol: 14, res: 0, sur: 14, costo: 72 }, { p: 6, sol: 1, res: 0, sur: 1, costo: 57.89 }],
          mano: [{ emp: 2, horas: 2.5, costo: 120 }], fallas: [],
          hist: [['ABIERTA', '2026-08-05T07:00'], ['EN_PROCESO', '2026-08-05T07:20'], ['TERMINADA', '2026-08-05T09:50'], ['LIBERADA', '2026-08-05T10:10']] },
        { id: 2, folio: 'OT-00002', eq: 3, tipo: 'CORRECTIVA', plan: null, estatus: 'LIBERADA', prioridad: 'ALTA',
          recepcion: '2026-08-12T07:30', falla: 'Se calienta el motor después de dos horas de acarreo.', diagnostico: 'Banda del ventilador vencida y radiador tapado de tierra.', resp: 2, opFalla: 6, reporte: null,
          tareas: [], refs: [{ p: 8, sol: 1, res: 0, sur: 1, costo: 380 }, { p: 11, sol: 20, res: 0, sur: 20, costo: 45 }],
          mano: [{ emp: 2, horas: 4, costo: 120 }], fallas: [{ sis: 'Enfriamiento', causa: 'FALTA_MANTENIMIENTO' }],
          hist: [['ABIERTA', '2026-08-12T07:30'], ['EN_DIAGNOSTICO', '2026-08-12T08:00'], ['ESPERANDO_REFACCION', '2026-08-12T09:30'], ['EN_PROCESO', '2026-08-13T09:00'], ['TERMINADA', '2026-08-13T12:30'], ['LIBERADA', '2026-08-13T13:00']] },
        { id: 3, folio: 'OT-00003', eq: 3, tipo: 'PREVENTIVA', plan: 3, aTiempo: false, estatus: 'LIBERADA', prioridad: 'MEDIA',
          recepcion: '2026-08-16T07:00', falla: 'Servicio 250 h (tocaba a las 5,680 h)', diagnostico: '', resp: 2, opFalla: null, reporte: null,
          tareas: [['Cambiar aceite de motor', true], ['Cambiar filtro de aceite', true]],
          refs: [{ p: 4, sol: 12, res: 0, sur: 12, costo: 72 }], mano: [{ emp: 2, horas: 1.5, costo: 120 }], fallas: [],
          hist: [['ABIERTA', '2026-08-16T07:00'], ['EN_PROCESO', '2026-08-16T07:15'], ['TERMINADA', '2026-08-16T08:45'], ['LIBERADA', '2026-08-16T09:00']] },
        { id: 4, folio: 'OT-00004', eq: 1, tipo: 'PREVENTIVA', plan: 2, aTiempo: true, estatus: 'LIBERADA', prioridad: 'MEDIA',
          recepcion: '2026-09-01T07:00', falla: 'Servicio 500 h (tocaba a las 2,240 h)', diagnostico: '', resp: 2, opFalla: null, reporte: null,
          tareas: [['Cambiar aceite de motor', true], ['Cambiar filtros de aceite y combustible', true], ['Cambiar filtro de aire primario', true], ['Cambiar aceite hidráulico/transmisión', true]],
          refs: [{ p: 1, sol: 1, res: 0, sur: 1, costo: 320 }, { p: 2, sol: 1, res: 0, sur: 1, costo: 450 }, { p: 3, sol: 1, res: 0, sur: 1, costo: 780 }, { p: 4, sol: 14, res: 0, sur: 14, costo: 75 }, { p: 5, sol: 60, res: 0, sur: 60, costo: 82.69 }],
          mano: [{ emp: 2, horas: 4, costo: 120 }], fallas: [],
          hist: [['ABIERTA', '2026-09-01T07:00'], ['EN_PROCESO', '2026-09-01T07:20'], ['TERMINADA', '2026-09-01T11:30'], ['LIBERADA', '2026-09-01T11:45']] },
        { id: 5, folio: 'OT-00005', eq: 2, tipo: 'PREVENTIVA', plan: 2, aTiempo: true, estatus: 'LIBERADA', prioridad: 'MEDIA',
          recepcion: '2026-09-01T12:30', falla: 'Servicio 500 h (tocaba a las 1,180 h)', diagnostico: '', resp: 3, opFalla: null, reporte: null,
          tareas: [['Cambiar aceite de motor', true], ['Cambiar filtros de aceite y combustible', true], ['Cambiar filtro de aire primario', true], ['Cambiar aceite hidráulico/transmisión', true]],
          refs: [{ p: 1, sol: 1, res: 0, sur: 1, costo: 320 }, { p: 2, sol: 1, res: 0, sur: 1, costo: 450 }, { p: 3, sol: 1, res: 0, sur: 1, costo: 780 }, { p: 4, sol: 14, res: 0, sur: 14, costo: 75 }, { p: 5, sol: 60, res: 0, sur: 60, costo: 82.69 }],
          mano: [{ emp: 3, horas: 4.5, costo: 110 }], fallas: [],
          hist: [['ABIERTA', '2026-09-01T12:30'], ['EN_PROCESO', '2026-09-01T12:45'], ['TERMINADA', '2026-09-01T17:15'], ['LIBERADA', '2026-09-01T17:30']] },
        { id: 6, folio: 'OT-00006', eq: 3, tipo: 'CORRECTIVA', plan: null, estatus: 'LIBERADA', prioridad: 'ALTA',
          recepcion: '2026-09-05T11:00', falla: 'Llanta trasera derecha reventada jalando el remolque cargado.', diagnostico: 'Llanta 18.4-34 reventada; el remolque llevaba más carga de la permitida.', resp: 3, opFalla: 6, reporte: null,
          tareas: [], refs: [{ p: 10, sol: 1, res: 0, sur: 1, costo: 14500 }],
          mano: [{ emp: 3, horas: 3, costo: 110 }], fallas: [{ sis: 'Ejes, llantas y rodaje', causa: 'SOBRECARGA' }],
          hist: [['ABIERTA', '2026-09-05T11:00'], ['EN_DIAGNOSTICO', '2026-09-05T11:30'], ['ESPERANDO_REFACCION', '2026-09-05T12:00'], ['EN_PROCESO', '2026-09-06T15:00'], ['TERMINADA', '2026-09-06T18:00'], ['LIBERADA', '2026-09-07T07:00']] },
        { id: 7, folio: 'OT-00007', eq: 3, tipo: 'CORRECTIVA', plan: null, estatus: 'LIBERADA', prioridad: 'ALTA',
          recepcion: '2026-09-22T06:40', falla: 'No levanta el implemento y tira aceite hidráulico.', diagnostico: 'Manguera del cilindro de levante desgastada.', resp: 3, opFalla: 6, reporte: null,
          tareas: [], refs: [{ p: 9, sol: 1, res: 0, sur: 1, costo: 650 }, { p: 5, sol: 10, res: 0, sur: 10, costo: 82.69 }],
          mano: [{ emp: 3, horas: 2, costo: 110 }], fallas: [{ sis: 'Hidráulico', causa: 'DESGASTE_NORMAL' }],
          hist: [['ABIERTA', '2026-09-22T06:40'], ['EN_DIAGNOSTICO', '2026-09-22T07:10'], ['ESPERANDO_REFACCION', '2026-09-22T07:40'], ['EN_PROCESO', '2026-09-22T11:30'], ['TERMINADA', '2026-09-22T13:30'], ['LIBERADA', '2026-09-22T14:00']] },
        { id: 8, folio: 'OT-00008', eq: 2, tipo: 'CORRECTIVA', plan: null, estatus: 'LIBERADA', prioridad: 'ALTA',
          recepcion: '2026-10-03T09:00', falla: 'Checklist: fugas visibles de aceite, diésel o agua. Fuga en manguera del levante.',
          diagnostico: 'Manguera hidráulica del levante rota por roce con el implemento.', resp: 3, opFalla: 7, reporte: 1,
          tareas: [], refs: [{ p: 9, sol: 1, res: 0, sur: 1, costo: 650 }, { p: 5, sol: 8, res: 0, sur: 8, costo: 82.69 }],
          mano: [{ emp: 3, horas: 2.5, costo: 110 }], fallas: [{ sis: 'Hidráulico', causa: 'MAL_USO' }],
          hist: [['ABIERTA', '2026-10-03T09:00'], ['EN_DIAGNOSTICO', '2026-10-03T09:20'], ['EN_PROCESO', '2026-10-03T10:00'], ['TERMINADA', '2026-10-03T12:40'], ['LIBERADA', '2026-10-03T13:10']] },
        { id: 9, folio: 'OT-00009', eq: 1, tipo: 'PREVENTIVA', plan: 1, aTiempo: false, estatus: 'LIBERADA', prioridad: 'MEDIA',
          recepcion: '2026-10-04T08:00', falla: 'Servicio 250 h (tocaba a las 2,250 h)', diagnostico: '', resp: 2, opFalla: null, reporte: null,
          tareas: [['Cambiar aceite de motor', true], ['Cambiar filtro de aceite', true], ['Cambiar filtro de combustible', true], ['Engrasar puntos de articulación', true]],
          refs: [{ p: 1, sol: 1, res: 0, sur: 1, costo: 320 }, { p: 2, sol: 1, res: 0, sur: 1, costo: 450 }, { p: 4, sol: 14, res: 0, sur: 14, costo: 75 }, { p: 6, sol: 1, res: 0, sur: 1, costo: 57.89 }],
          mano: [{ emp: 2, horas: 2.25, costo: 120 }], fallas: [],
          hist: [['ABIERTA', '2026-10-04T08:00'], ['EN_PROCESO', '2026-10-04T08:30'], ['TERMINADA', '2026-10-04T10:50'], ['LIBERADA', '2026-10-04T11:05']] },
        { id: 10, folio: 'OT-00010', eq: 3, tipo: 'PREVENTIVA', plan: 3, aTiempo: true, estatus: 'ABIERTA', prioridad: 'MEDIA',
          recepcion: '2026-11-09T16:00', falla: 'Servicio 250 h (toca a las 5,950 h)', diagnostico: '', resp: 2, opFalla: null, reporte: null,
          tareas: [['Cambiar aceite de motor', false], ['Cambiar filtro de aceite', false]],
          refs: [{ p: 4, sol: 12, res: 12, sur: 0, costo: 75 }], mano: [], fallas: [], hist: [['ABIERTA', '2026-11-09T16:00']] }
      ],
      reportes: [
        { id: 1, folio: 'RF-00001', eq: 2, fecha: '2026-10-03T06:15', op: 7, sis: 'Hidráulico', detenido: true, estatus: 'EN_OT', ot: 8,
          desc: 'Checklist: fugas visibles de aceite, diésel o agua. Fuga en manguera del levante.' }
      ],
      bitacora: [
        { fecha: '2026-10-01', eq: 1, op: 5, lote: LOTES[0], labor: 'Rastreo', hi: 2240, hf: 2248.5, cant: 14 },
        { fecha: '2026-10-02', eq: 1, op: 5, lote: LOTES[0], labor: 'Rastreo', hi: 2248.5, hf: 2257, cant: 13 },
        { fecha: '2026-10-03', eq: 1, op: 5, lote: LOTES[1], labor: 'Rastreo', hi: 2257, hf: 2266, cant: 15 },
        { fecha: '2026-10-01', eq: 2, op: 7, lote: LOTES[2], labor: 'Barbecho', hi: 1180, hf: 1189, cant: 9 },
        { fecha: '2026-10-02', eq: 2, op: 7, lote: LOTES[2], labor: 'Barbecho', hi: 1189, hf: 1198, cant: 8.5 },
        { fecha: '2026-10-01', eq: 3, op: 6, lote: LOTES[1], labor: 'Acarreo', hi: 5890, hf: 5897, cant: 12 },
        { fecha: '2026-10-02', eq: 3, op: 6, lote: LOTES[1], labor: 'Acarreo', hi: 5897, hf: 5905, cant: 14 }
      ],
      cargas: [
        { fecha: '2026-10-01T06:30', eq: 1, op: 5, litros: 160, costo: 24.10 }, { fecha: '2026-10-03T06:30', eq: 1, op: 5, litros: 175, costo: 24.10 },
        { fecha: '2026-10-01T06:40', eq: 2, op: 7, litros: 150, costo: 24.10 }, { fecha: '2026-10-01T06:50', eq: 3, op: 6, litros: 120, costo: 24.10 },
        { fecha: '2026-10-02T06:50', eq: 3, op: 6, litros: 110, costo: 24.10 }
      ],
      inspecciones: [{ fecha: '2026-10-03T06:15', eq: 2, op: 7, resultado: 'NO_APTO' }],
      requisiciones: [],
      notifs: [
        { fecha: '2026-10-01T18:00', nivel: 'warn', titulo: 'Operador sin autorización en JD-02', msg: 'Carlos Ibarra operó el JD-02 sin capacitación vigente para ese modelo.' },
        { fecha: '2026-10-02T18:00', nivel: 'warn', titulo: 'Operador sin autorización en JD-02', msg: 'Carlos Ibarra operó el JD-02 sin capacitación vigente para ese modelo.' },
        { fecha: '2026-10-03T06:15', nivel: 'urg', titulo: 'Falla reportada en JD-02 (detenido)', msg: 'Checklist: fuga en manguera del levante.' }
      ],
      ui: { tab: 'tablero', otSel: 9, almQ: '', almCat: '', almBajo: false, almKardex: 0, kpiPer: 'todo', otFiltro: 'todas', nuevaOT: false, nuevaEq: 1, chatModo: 'auto' }
    };
  }

  // Histórico de agosto a octubre para que los KPIs tengan con qué calcularse.
  function genHist(s) {
    var p2 = function (n) { return String(n).padStart(2, '0'); };
    var dia = function (n) { var d = new Date(2026, 7, 1 + n, 12); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
    var cfg = [
      { eq: 1, op: 5, lph: 18.2, lab: [['Rastreo', LOTES[0], 1.6], ['Barbecho', LOTES[1], 1.1]], chk: 1 },
      { eq: 2, op: 7, lph: 17.4, lab: [['Barbecho', LOTES[2], 1.0], ['Siembra', LOTES[2], 1.8]], chk: 2 },
      { eq: 3, op: 6, lph: 17.8, lab: [['Acarreo', LOTES[1], 1.7]], chk: 3 }
    ];
    var bit = [], car = [], ins = [];
    cfg.forEach(function (c) {
      var e = s.equipos.find(function (x) { return x.id === c.eq; });
      var fin = s.bitacora.find(function (b) { return b.eq === c.eq; }).hi;
      var fechas = [];
      for (var d = 0; d < 61; d += 2) fechas.push(dia(d));
      var libres = fechas.filter(function (f) { return !s.ots.some(function (o) { return o.eq === c.eq && o.tipo === 'CORRECTIVA' && f >= o.recepcion.slice(0, 10) && f <= o.hist[o.hist.length - 1][1].slice(0, 10); }); });
      var hs = libres.map(function (f, i) { return [7.5, 8.5, 9, 8][i % 4]; });
      var h = fin - hs.reduce(function (a, b) { return a + b; }, 0);
      e.horasAlta = Math.round(h * 10) / 10;
      libres.forEach(function (f, i) {
        var l = c.lab[i % c.lab.length];
        var hi = Math.round(h * 10) / 10; h += hs[i]; var hf = Math.round(h * 10) / 10;
        bit.push({ fecha: f, eq: c.eq, op: c.op, lote: l[1], labor: l[0], hi: hi, hf: hf, cant: Math.round(hs[i] * l[2] * 2) / 2 });
        car.push({ fecha: f + 'T06:30', eq: c.eq, op: c.op, litros: Math.round(hs[i] * c.lph), costo: f < '2026-09-01' ? 23.6 : 23.9 });
        if (c.chk === 1 || (c.chk === 2 && i % 2 === 0) || (c.chk === 3 && i % 3 !== 2)) ins.push({ fecha: f + 'T06:10', eq: c.eq, op: c.op, resultado: 'APTO' });
      });
    });
    s.bitacora = bit.concat(s.bitacora); s.cargas = car.concat(s.cargas); s.inspecciones = ins.concat(s.inspecciones);
    var movs = [], sal = {};
    s.ots.forEach(function (o) { o.refs.forEach(function (r) {
      if (!r.sur) return;
      var t = (o.hist.find(function (x) { return x[0] === 'EN_PROCESO'; }) || o.hist[0])[1];
      movs.push({ fecha: t, tipo: 'SALIDA', p: r.p, cant: r.sur, costo: r.costo, ref: o.folio });
      sal[r.p] = (sal[r.p] || 0) + r.sur;
    }); });
    s.productos.forEach(function (p) { movs.push({ fecha: '2026-08-01T08:00', tipo: 'ENTRADA', p: p.id, cant: p.exist + (sal[p.id] || 0), costo: p.costo, ref: 'Inventario inicial' }); });
    s.movs = movs.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    s.cfg = { limiteJefe: 10000 };
    s.pipas = [{ fecha: '2026-09-28T09:00', litros: 6000, precio: 24.10 }];
  }
  function seed() { var s = seedBase(); genHist(s); s.wa = seedChat(); return s; }
  function seedChat() {
    return {
      op: 5, eq: {}, espera: {}, chats: {},
      jefe: [{ de: 'bot', t: '2026-10-03T06:15', txt: '*Falla urgente · JD-02 detenido en campo*\nCarlos Ibarra en el checklist: "fuga en manguera del levante".\nSistema probable: *Hidráulico*.\nAbrí la OT-00008 con prioridad alta, asignada a Pedro Salinas.', btns: [['Ver OT-00008', 'ver-ot', 8]] }],
      cont: { bitacora: 0, preventiva: 0, falla: 0, compra: 0, diesel: 0, alerta: 0 }
    };
  }

  /* ================= utilidades ================= */
  var pad = function (n) { return String(n).padStart(2, '0'); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var n1 = function (n) { return Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 1 }); };
  var money = function (n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var money0 = function (n) { return '$' + Math.round(n).toLocaleString('es-MX'); };
  function ahora() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  var hoyISO = function () { return ahora().slice(0, 10); };
  function fFecha(iso) { var d = new Date(iso.length === 10 ? iso + 'T12:00' : iso); return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }); }
  function fFechaHora(iso) { var d = new Date(iso); return fFecha(iso) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  var dias = function (a, b) { return Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000); };
  var sumarDias = function (iso, n) { var d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  function num(s) { s = String(s); if (/^\d{1,3},\d{3}$/.test(s)) s = s.replace(',', ''); return parseFloat(s.replace(',', '.')); }

  /* ================= estado ================= */
  var KEY = 'pf-taller-v1';
  var S;
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    if (!S || S.v !== 1) S = seed();
    if (!S.wa) S.wa = seedChat();
    if (!S.movs) S.movs = [];
    if (!S.cfg) S.cfg = { limiteJefe: 10000 };
    if (!S.ui.tab) S.ui.tab = 'tablero';
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* sin almacenamiento: sigue en memoria */ } }

  var emp = function (id) { return S.empleados.find(function (e) { return e.id === id; }) || { nombre: '—', costo: 0 }; };
  var eqp = function (id) { return S.equipos.find(function (e) { return e.id === id; }); };
  var prod = function (id) { return S.productos.find(function (p) { return p.id === id; }); };
  var plan = function (id) { return S.planes.find(function (p) { return p.id === id; }); };
  var otById = function (id) { return S.ots.find(function (o) { return o.id === id; }); };
  var operadores = function () { return S.empleados.filter(function (e) { return e.puesto === 'Operador'; }); };
  var mecanicos = function () { return S.empleados.filter(function (e) { return e.puesto === 'Mecánico' || e.puesto === 'Jefe de taller'; }); };
  var causa = function (code) { return CAUSAS.find(function (c) { return c[0] === code; }) || CAUSAS[CAUSAS.length - 1]; };
  var autorizado = function (op, e) { return S.autorizaciones.some(function (a) { return a.emp === op && a.modelo === e.modelo; }); };
  var unidadLab = function (labor) { return (LABORES.find(function (l) { return l[0] === labor; }) || [0, 'ha'])[1]; };
  function notificar(nivel, titulo, msg) { S.notifs.push({ fecha: ahora(), nivel: nivel, titulo: titulo, msg: msg }); }

  var ESTATUS_EQ = {
    OPERANDO: ['Operando', 'ok'], DESCOMPUESTO: ['Descompuesto en campo', 'bad'], EN_TALLER: ['En taller', 'info'],
    EN_REPARACION: ['En reparación', 'info'], ESPERANDO_REFACCION: ['Esperando refacción', 'warn'],
    LISTO_LIBERAR: ['Listo para liberar', 'ok'], FUERA_SERVICIO: ['Fuera de servicio', 'bad']
  };
  var ESTATUS_OT = {
    ABIERTA: ['Abierta', 'info'], EN_DIAGNOSTICO: ['En diagnóstico', 'info'], EN_PROCESO: ['En reparación', 'info'],
    ESPERANDO_REFACCION: ['Esperando refacción', 'warn'], TERMINADA: ['Terminada', 'ok'], LIBERADA: ['Liberada', 'plain'], CANCELADA: ['Cancelada', 'plain']
  };
  var SEM = { VENCIDO: ['Vencido', 'bad'], PROXIMO: ['Próximo', 'warn'], AL_DIA: ['Al día', 'ok'] };
  var pill = function (x) { return '<span class="pill p-' + x[1] + '">' + esc(x[0]) + '</span>'; };
  var abierta = function (o) { return ['LIBERADA', 'CANCELADA'].indexOf(o.estatus) < 0; };

  /* ================= GPS: horómetro desde Traccar ================= */
  var gpsSource = null;
  function setGpsSource(w) { gpsSource = w; }
  function W() { return gpsSource; }
  function dispositivos() { var w = W(); return w && w.devices ? Array.from(w.devices.values()) : []; }
  function horasGps(deviceId) {
    var w = W(); if (!w || !w.positions || deviceId == null) return null;
    var p = w.positions.get(deviceId), h = p && p.attributes && p.attributes.hours;
    return typeof h === 'number' && h > 0 ? Math.round(h / 360000) / 10 : null; // Traccar guarda hours en milisegundos
  }
  function syncGps() {
    S.equipos.forEach(function (e) { if (e.usaH && e.deviceId != null) { var h = horasGps(e.deviceId); if (h !== null && h > e.horas) e.horas = h; } });
  }

  /* ================= reglas del negocio ================= */
  function semaforos(eqId) {
    var e = eqp(eqId), hoy = hoyISO();
    return S.ep.filter(function (x) { return x.eq === eqId; }).map(function (x) {
      var p = plan(x.plan);
      var proxH = x.ultH + p.intH, restH = proxH - e.horas;
      var proxF = sumarDias(x.ultF, p.intD), restD = dias(hoy, proxF);
      var sem = (restH <= 0 || restD <= 0) ? 'VENCIDO' : (restH <= 50 || restD <= 15) ? 'PROXIMO' : 'AL_DIA';
      var otAbierta = S.ots.find(function (o) { return o.eq === eqId && o.plan === p.id && abierta(o); });
      return { plan: p, proxH: proxH, restH: restH, proxF: proxF, restD: restD, sem: sem, otAbierta: otAbierta };
    });
  }
  function peorSemaforo(eqId) {
    var s = semaforos(eqId); if (!s.length) return null;
    var rank = { VENCIDO: 0, PROXIMO: 1, AL_DIA: 2 };
    return s.sort(function (a, b) { return rank[a.sem] - rank[b.sem] || a.restH - b.restH; })[0];
  }
  function costoOT(o) {
    var ref = o.refs.reduce(function (s, r) { return s + r.sur * r.costo; }, 0);
    var mo = o.mano.reduce(function (s, m) { return s + m.horas * m.costo; }, 0);
    return { ref: ref, mo: mo, total: ref + mo };
  }
  function setEstatusEquipo(eqId, est) {
    var e = eqp(eqId);
    if (est === 'OPERANDO' && S.ots.some(function (o) { return o.eq === eqId && abierta(o); })) est = 'EN_TALLER';
    e.estatus = est;
  }
  function reservar(o, prodId, cant) {
    var p = prod(prodId);
    var disp = Math.max(p.exist - p.res, 0), res = Math.min(cant, disp);
    p.res += res;
    o.refs.push({ p: prodId, sol: cant, res: res, sur: 0, costo: p.costo });
    var falta = cant - res;
    if (falta > 0) {
      S.seq.req++;
      S.requisiciones.push({ folio: 'REQ-' + String(S.seq.req).padStart(5, '0'), ot: o.folio, p: prodId, cant: falta, fecha: ahora() });
      notificar('warn', 'Falta refacción para ' + o.folio, 'Faltan ' + n1(falta) + ' ' + p.u + ' de ' + p.desc + '. Se generó requisición a compras.');
    }
  }
  function abrirOT(a) {
    var e = eqp(a.eq);
    S.seq.ot++;
    var o = {
      id: Math.max.apply(null, [0].concat(S.ots.map(function (x) { return x.id; }))) + 1, folio: 'OT-' + String(S.seq.ot).padStart(5, '0'), eq: a.eq, tipo: a.tipo, plan: a.planId || null,
      estatus: 'ABIERTA', prioridad: a.prioridad || 'MEDIA', recepcion: ahora(), falla: a.falla || '', diagnostico: '', resp: a.tipo === 'PREVENTIVA' ? 2 : 3,
      opFalla: a.opFalla || null, reporte: a.reporteId || null, tareas: [], refs: [], mano: [], fallas: [], hist: [['ABIERTA', ahora()]], error: ''
    };
    if (a.planId) {
      var p = plan(a.planId);
      var sem = semaforos(a.eq).find(function (s) { return s.plan.id === a.planId; });
      o.aTiempo = !sem || sem.sem !== 'VENCIDO';
      o.falla = p.nombre + (sem ? ' (tocaba a las ' + n1(sem.proxH) + ' h)' : '');
      o.tareas = p.tareas.map(function (t) { return [t, false]; });
      S.ots.push(o);
      p.kit.forEach(function (k) { reservar(o, k[0], k[1]); });
    } else {
      S.ots.push(o);
    }
    if (a.reporteId) { var r = S.reportes.find(function (x) { return x.id === a.reporteId; }); r.estatus = 'EN_OT'; r.ot = o.id; o.opFalla = r.op; if (!o.falla) o.falla = r.desc; }
    if (['OPERANDO', 'DESCOMPUESTO'].indexOf(e.estatus) >= 0) e.estatus = 'EN_TALLER';
    S.ui.otSel = o.id; S.ui.nuevaOT = false;
    return o;
  }
  function cambiarEstatus(o, nuevo) {
    o.error = '';
    if (nuevo === 'TERMINADA') {
      if (o.tareas.some(function (t) { return !t[1]; })) { o.error = 'Hay tareas sin completar.'; return false; }
      if (o.tipo === 'CORRECTIVA' && !o.fallas.length) { o.error = 'Clasifica la falla (sistema y causa) antes de terminar. Sin esto no hay estadísticas.'; return false; }
      if (o.refs.some(function (r) { return r.sur < r.sol && r.res > 0; })) { o.error = 'Hay refacciones apartadas sin surtir. Súrtelas o quítalas.'; return false; }
    }
    if (nuevo === 'LIBERADA' && o.estatus !== 'TERMINADA') { o.error = 'La OT debe estar terminada antes de liberar el equipo.'; return false; }
    o.estatus = nuevo; o.hist.push([nuevo, ahora()]);
    var mapa = { EN_DIAGNOSTICO: 'EN_TALLER', EN_PROCESO: 'EN_REPARACION', ESPERANDO_REFACCION: 'ESPERANDO_REFACCION', TERMINADA: 'LISTO_LIBERAR', LIBERADA: 'OPERANDO', CANCELADA: 'OPERANDO' };
    if (mapa[nuevo]) setEstatusEquipo(o.eq, mapa[nuevo]);
    if (nuevo === 'TERMINADA' && o.plan) {
      var p = plan(o.plan), e = eqp(o.eq);
      S.ep.filter(function (x) { return x.eq === o.eq; }).forEach(function (x) {
        var px = plan(x.plan);
        if (px.id === p.id || (px.intH < p.intH && p.intH % px.intH === 0)) { x.ultH = Math.floor(e.horas); x.ultF = hoyISO(); }
      });
    }
    if (nuevo === 'LIBERADA' || nuevo === 'CANCELADA') o.refs.forEach(function (r) { if (r.res > 0) { prod(r.p).res -= r.res; r.res = 0; } });
    return true;
  }
  function surtir(o, idx) {
    var r = o.refs[idx], p = prod(r.p), cant = r.sol - r.sur;
    if (p.exist - p.res + r.res < cant) { o.error = 'Existencia insuficiente de ' + p.desc + ': disponible ' + n1(p.exist - p.res + r.res) + ' ' + p.u + '.'; return; }
    p.exist -= cant; p.res -= r.res; r.res = 0; r.sur += cant; r.costo = p.costo;
    S.movs.push({ fecha: ahora(), tipo: 'SALIDA', p: r.p, cant: cant, costo: p.costo, ref: o.folio });
    o.error = '';
    if (p.exist - p.res <= p.min) notificar('warn', 'Bajo mínimo: ' + p.desc, 'Quedan ' + n1(p.exist - p.res) + ' ' + p.u + ' disponibles (mínimo ' + p.min + ').');
  }
  function crearReporte(a) {
    S.seq.rf++;
    var r = { id: Math.max.apply(null, [0].concat(S.reportes.map(function (x) { return x.id; }))) + 1, folio: 'RF-' + String(S.seq.rf).padStart(5, '0'), eq: a.eq, fecha: ahora(), op: a.op, sis: a.sis, detenido: a.detenido, estatus: 'ABIERTO', ot: null, desc: a.desc };
    S.reportes.push(r);
    var e = eqp(a.eq);
    if (a.detenido && e.estatus === 'OPERANDO') e.estatus = 'DESCOMPUESTO';
    notificar(a.detenido ? 'urg' : 'warn', 'Falla reportada en ' + e.eco + (a.detenido ? ' (detenido)' : ''), a.desc);
    return r;
  }

  /* ================= almacén ================= */
  var dispP = function (p) { return Math.max(p.exist - p.res, 0); };
  function nivelProd(p) {
    var d = dispP(p);
    if (d + p.camino <= p.min) return ['Por pedir', 'bad'];
    if (d <= p.min) return ['Pedido en camino', 'warn'];
    if (p.exist > p.max) return ['Sobre máximo', 'info'];
    return ['En rango', 'ok'];
  }
  function pendientesSurtir() {
    var out = [];
    S.ots.filter(abierta).forEach(function (o) { o.refs.forEach(function (r, i) { if (r.sur < r.sol) out.push({ o: o, r: r, i: i }); }); });
    return out;
  }
  var MOV = { ENTRADA: ['Entrada', 'ok'], SALIDA: ['Salida', 'info'], AJUSTE: ['Ajuste', 'warn'] };
  var quienAprueba = function (monto) { return monto > S.cfg.limiteJefe ? 'Dirección' : 'Jefe de taller'; };
  function entradaAlmacen(pid, cant, costoU, ref) {
    var p = prod(pid);
    p.costo = p.exist + cant > 0 ? (p.exist * p.costo + cant * costoU) / (p.exist + cant) : costoU;
    p.exist += cant;
    S.movs.push({ fecha: ahora(), tipo: 'ENTRADA', p: pid, cant: cant, costo: costoU, ref: ref });
    var apart = [];
    S.ots.filter(abierta).forEach(function (o) { o.refs.forEach(function (x) {
      if (x.p !== pid) return;
      var a = Math.min(x.sol - x.sur - x.res, p.exist - p.res);
      if (a > 0) { x.res += a; p.res += a; apart.push(n1(a) + ' ' + p.u + ' para la ' + o.folio); }
    }); });
    return apart;
  }
  function pedirManual(pid) {
    var p = prod(pid);
    if (S.requisiciones.some(function (r) { return r.p === pid && r.estatus === 'PENDIENTE'; })) return toast('Ya hay una requisición pendiente de ese producto');
    var cant = Math.max(p.max - dispP(p) - p.camino, 1);
    S.seq.req++;
    var folio = 'REQ-' + String(S.seq.req).padStart(5, '0');
    S.requisiciones.push({ folio: folio, ot: null, p: pid, cant: cant, pedido: cant, fecha: ahora(), estatus: 'PENDIENTE', manual: true });
    toast(folio + ': ' + n1(cant) + ' ' + p.u + ' de ' + p.desc + ', por aprobar');
  }
  // Requisiciones automáticas: por faltante de OT o por bajo mínimo (pide hasta el máximo).
  function syncReqs() {
    S.requisiciones.forEach(function (r) {
      if (!r.estatus) r.estatus = 'PENDIENTE';
      if (r.pedido == null) { var p = prod(r.p); r.pedido = Math.max(r.cant, p.max - Math.max(p.exist - p.res, 0) - p.camino); }
    });
    S.productos.forEach(function (p) {
      var disp = Math.max(p.exist - p.res, 0);
      if (disp + p.camino > p.min) return;
      if (S.requisiciones.some(function (r) { return r.p === p.id && r.estatus === 'PENDIENTE'; })) return;
      var cant = Math.max(p.max - disp - p.camino, 0); if (!cant) return;
      S.seq.req++;
      S.requisiciones.push({ folio: 'REQ-' + String(S.seq.req).padStart(5, '0'), ot: null, p: p.id, cant: cant, pedido: cant, fecha: ahora(), estatus: 'PENDIENTE' });
    });
    S.requisiciones.filter(function (r) { return !r.avisada; }).forEach(function (r) {
      r.avisada = true; S.wa.cont.compra++;
      var p = prod(r.p);
      botJefe('*Requisición ' + r.folio + ' · ' + (r.ot ? r.ot : 'reabasto') + '*\n' +
        (r.ot ? 'Faltan ' + n1(r.cant) + ' ' + p.u + ' de ' + p.desc + ' para la ' + r.ot + '.' : p.desc + ': quedan ' + n1(Math.max(p.exist - p.res, 0)) + ' ' + p.u + ' disponibles' + (p.camino ? ' y ' + n1(p.camino) + ' en camino' : '') + ' (mínimo ' + n1(p.min) + ').') +
        '\nPropuesta: pedir ' + n1(r.pedido) + ' ' + p.u + ' para llegar al máximo · ' + money(r.pedido * p.costo) + '.', [['Aprobar compra', 'req-aprobar', r.folio]]);
    });
  }
  function aprobarReq(folio) {
    var r = S.requisiciones.find(function (x) { return x.folio === folio; }); if (!r || r.estatus !== 'PENDIENTE') return;
    var p = prod(r.p);
    r.estatus = 'APROBADA'; p.camino += r.pedido;
    r.aprobo = quienAprueba(r.pedido * p.costo) === 'Dirección' ? 'Aprobó Dirección' : 'Aprobó ' + emp(1).nombre;
    botJefe('Compra ' + r.folio + ' aprobada. Se envió la orden al proveedor: ' + n1(r.pedido) + ' ' + p.u + ' de ' + p.desc + '. Te aviso cuando llegue.', [['Registrar llegada', 'req-recibir', r.folio]]);
    toast(r.folio + ' aprobada');
  }
  function recibirReq(folio) {
    var r = S.requisiciones.find(function (x) { return x.folio === folio; }); if (!r || r.estatus !== 'APROBADA') return;
    var p = prod(r.p);
    r.estatus = 'RECIBIDA'; p.camino = Math.max(0, p.camino - r.pedido);
    var apart = entradaAlmacen(p.id, r.pedido, p.costo, r.folio);
    botJefe('Entrada al almacén: ' + n1(r.pedido) + ' ' + p.u + ' de ' + p.desc + '.' + (apart.length ? ' Se apartaron ' + apart.join(', ') + '.' : ''));
    toast('Entrada al almacén registrada');
  }

  /* ================= estadísticas y KPIs ================= */
  function stats() {
    var tractores = S.equipos.filter(function (e) { return e.usaH; });
    var costoEq = tractores.map(function (e) {
      var mant = S.ots.filter(function (o) { return o.eq === e.id && ['TERMINADA', 'LIBERADA'].indexOf(o.estatus) >= 0; }).reduce(function (s, o) { return s + costoOT(o).total; }, 0);
      var cg = S.cargas.filter(function (c) { return c.eq === e.id; });
      var comb = cg.reduce(function (s, c) { return s + c.litros * c.costo; }, 0), litros = cg.reduce(function (s, c) { return s + c.litros; }, 0);
      var horas = e.horas - e.horasAlta;
      return { e: e, mant: mant, comb: comb, total: mant + comb, horas: horas, porHora: horas > 0 ? (mant + comb) / horas : 0, lph: horas > 0 ? litros / horas : 0 };
    });
    var fallas = {};
    S.ots.filter(function (o) { return o.tipo === 'CORRECTIVA' && o.estatus !== 'CANCELADA'; }).forEach(function (o) { o.fallas.forEach(function (f) {
      var c = causa(f.causa); fallas[c[1]] = fallas[c[1]] || { n: 0, costo: 0, imp: c[2] };
      fallas[c[1]].n++; fallas[c[1]].costo += costoOT(o).total;
    }); });
    var ops = operadores().map(function (op) {
      var b = S.bitacora.filter(function (x) { return x.op === op.id; });
      var horas = b.reduce(function (s, x) { return s + (x.hf - x.hi); }, 0);
      var jornadas = new Set(b.map(function (x) { return x.fecha + '|' + x.eq; })).size;
      var checks = new Set(S.inspecciones.filter(function (i) { return i.op === op.id; }).map(function (i) { return i.fecha.slice(0, 10) + '|' + i.eq; })).size;
      var imp = S.ots.filter(function (o) { return o.opFalla === op.id && o.fallas.some(function (f) { return causa(f.causa)[2]; }); });
      return { op: op, horas: horas, jornadas: jornadas, checks: checks, pct: jornadas ? Math.round(100 * Math.min(checks, jornadas) / jornadas) : null, malUso: imp.length, costoMalUso: imp.reduce(function (s, o) { return s + costoOT(o).total; }, 0) };
    });
    var prev = S.ots.filter(function (o) { return o.tipo === 'PREVENTIVA' && o.estatus !== 'CANCELADA'; });
    var corr = S.ots.filter(function (o) { return o.tipo === 'CORRECTIVA' && o.estatus !== 'CANCELADA'; });
    return { costoEq: costoEq, fallas: fallas, ops: ops, prev: prev.length, corr: corr.length };
  }

  function periodos() {
    var out = [['todo', 'Desde agosto 2026']], d = new Date(2026, 7, 1), fin = hoyISO().slice(0, 7);
    var MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    for (var i = 0; i < 24; i++) {
      var k = d.getFullYear() + '-' + pad(d.getMonth() + 1); if (k > fin) break;
      out.push([k, MES[d.getMonth()] + (d.getFullYear() !== 2026 ? ' ' + d.getFullYear() : '')]); d.setMonth(d.getMonth() + 1);
    }
    return out;
  }
  var hrsEntre = function (a, b) { return (new Date(b) - new Date(a)) / 3600000; };
  var enPer = function (iso, per) { return per === 'todo' || iso.slice(0, 7) === per; };
  var tEstado = function (o, st) { return (o.hist.find(function (h) { return h[0] === st; }) || [])[1] || null; };
  var finOT = function (o) { return tEstado(o, 'LIBERADA') || tEstado(o, 'CANCELADA') || ahora(); };
  function esperaRef(o) { var t = 0; o.hist.forEach(function (h, i) { if (h[0] === 'ESPERANDO_REFACCION') t += hrsEntre(h[1], (o.hist[i + 1] || [0, ahora()])[1]); }); return t; }
  function rango(per) {
    var now = ahora();
    if (per === 'todo') return ['2026-08-01T00:00', now];
    var ym = per.split('-').map(Number), y = ym[0], m = ym[1];
    var fin = m === 12 ? (y + 1) + '-01-01T00:00' : y + '-' + pad(m + 1) + '-01T00:00';
    return [per + '-01T00:00', fin < now ? fin : now];
  }
  var isoMax = function (a, b) { return a > b ? a : b; }, isoMin = function (a, b) { return a < b ? a : b; };
  var tRep = function (o) { return tEstado(o, 'TERMINADA') ? hrsEntre(o.recepcion, tEstado(o, 'TERMINADA')) : null; };
  var prom = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; };
  var sum = function (a, f) { return a.reduce(function (s, x) { return s + f(x); }, 0); };

  function kpis(per) {
    var rg = rango(per), ini = rg[0], fin = rg[1];
    var calH = Math.max(hrsEntre(ini, fin), 1);
    var cerr = S.ots.filter(function (o) { return ['TERMINADA', 'LIBERADA'].indexOf(o.estatus) >= 0 && enPer(o.recepcion, per); });
    var filas = S.equipos.filter(function (e) { return e.usaH; }).map(function (e) {
      var os = cerr.filter(function (o) { return o.eq === e.id; });
      var ref = sum(os, function (o) { return costoOT(o).ref; }), mo = sum(os, function (o) { return costoOT(o).mo; });
      var cg = S.cargas.filter(function (c) { return c.eq === e.id && enPer(c.fecha, per); });
      var lts = sum(cg, function (c) { return c.litros; }), comb = sum(cg, function (c) { return c.litros * c.costo; });
      var bt = S.bitacora.filter(function (b) { return b.eq === e.id && enPer(b.fecha, per); });
      var horas = sum(bt, function (b) { return b.hf - b.hi; });
      var ha = sum(bt.filter(function (b) { return unidadLab(b.labor) === 'ha'; }), function (b) { return b.cant; });
      var corr = os.filter(function (o) { return o.tipo === 'CORRECTIVA'; });
      var down = sum(S.ots.filter(function (o) { return o.eq === e.id && o.estatus !== 'CANCELADA'; }), function (o) { return Math.max(0, hrsEntre(isoMax(o.recepcion, ini), isoMin(finOT(o), fin))); });
      var total = ref + mo + comb;
      return { e: e, ref: ref, mo: mo, comb: comb, total: total, lts: lts, horas: horas, ha: ha, porH: horas ? total / horas : 0, mantH: horas ? (ref + mo) / horas : 0, porHa: ha ? total / ha : 0,
        lph: horas ? lts / horas : 0, nCorr: corr.length, nPrev: os.length - corr.length, mtbf: corr.length ? horas / corr.length : null,
        mttr: prom(corr.map(tRep).filter(function (x) { return x !== null; })), espera: sum(corr, esperaRef), disp: Math.max(0, 100 * (1 - down / calH)) };
    });
    var T = function (k) { return sum(filas, function (f) { return f[k]; }); };
    var horas = T('horas'), total = T('total'), ha = T('ha');
    var corr = cerr.filter(function (o) { return o.tipo === 'CORRECTIVA'; }), prev = cerr.filter(function (o) { return o.tipo === 'PREVENTIVA'; });
    var actual = per === 'todo' || per === hoyISO().slice(0, 7);
    var vencSinOT = actual ? S.equipos.filter(function (e) { return e.usaH; }).map(function (e) { return peorSemaforo(e.id); }).filter(function (s) { return s && s.sem === 'VENCIDO' && !s.otAbierta; }).length : 0;
    var cumpl = prev.length + vencSinOT ? 100 * prev.filter(function (o) { return o.aTiempo; }).length / (prev.length + vencSinOT) : null;
    var agrupar = function (key) {
      var g = {};
      corr.forEach(function (o) { o.fallas.forEach(function (f) { var k = key(f); g[k] = g[k] || { n: 0, costo: 0, imp: causa(f.causa)[2] }; g[k].n++; g[k].costo += costoOT(o).total / o.fallas.length; }); });
      return Object.entries(g).sort(function (a, b) { return b[1].costo - a[1].costo; });
    };
    var meses = periodos().slice(1).slice(-6).map(function (pm) {
      var os = S.ots.filter(function (o) { return ['TERMINADA', 'LIBERADA'].indexOf(o.estatus) >= 0 && o.recepcion.slice(0, 7) === pm[0]; });
      var suma = function (t) { return sum(os.filter(function (o) { return o.tipo === t; }), function (o) { return costoOT(o).total; }); };
      return { m: pm[0], nom: pm[1], prev: suma('PREVENTIVA'), corr: suma('CORRECTIVA') };
    });
    var lotes = {};
    S.bitacora.filter(function (b) { return enPer(b.fecha, per); }).forEach(function (b) {
      var f = filas.find(function (x) { return x.e.id === b.eq; }), h = b.hf - b.hi;
      var L = lotes[b.lote] = lotes[b.lote] || { horas: 0, ha: 0, costo: 0, costoHa: 0, labores: new Set() };
      L.horas += h; L.costo += h * (f ? f.porH : 0); if (unidadLab(b.labor) === 'ha') { L.ha += b.cant; L.costoHa += h * (f ? f.porH : 0); } L.labores.add(b.labor);
    });
    var paros = corr.map(function (o) { return { o: o, h: hrsEntre(o.recepcion, finOT(o)), esp: esperaRef(o) }; }).sort(function (a, b) { return b.h - a.h; });
    return { filas: filas, horas: horas, total: total, ha: ha, ref: T('ref'), mo: T('mo'), comb: T('comb'),
      porH: horas ? total / horas : 0, mantH: horas ? (T('ref') + T('mo')) / horas : 0, porHa: ha ? total / ha : 0,
      disp: prom(filas.map(function (f) { return f.disp; })) || 0, mtbf: corr.length ? horas / corr.length : null, mttr: prom(corr.map(tRep).filter(function (x) { return x !== null; })),
      espera: sum(corr, esperaRef), nCorr: corr.length, nPrev: prev.length,
      costoCorr: sum(corr, function (o) { return costoOT(o).total; }), costoPrev: sum(prev, function (o) { return costoOT(o).total; }),
      cumpl: cumpl, vencSinOT: vencSinOT, porSis: agrupar(function (f) { return f.sis; }), porCausa: agrupar(function (f) { return causa(f.causa)[1]; }), meses: meses,
      lotes: Object.entries(lotes).sort(function (a, b) { return b[1].costo - a[1].costo; }), paros: paros };
  }
  function veredicto(f, k) {
    if (!f.horas) return ['Sin operación', 'plain'];
    if (f.mantH > 1.5 * k.mantH && f.nCorr >= 2) return ['Evaluar reemplazo', 'bad'];
    if (f.mantH > 1.15 * k.mantH || f.disp < 95 || f.nCorr >= 2) return ['Vigilar', 'warn'];
    return ['En rango', 'ok'];
  }
  function reporteSemanal() {
    var st = stats();
    var op = S.equipos.filter(function (e) { return e.estatus === 'OPERANDO'; }).length;
    var serv = S.equipos.filter(function (e) { return e.usaH; }).map(function (e) { return [e, peorSemaforo(e.id)]; }).filter(function (x) { return x[1] && x[1].sem !== 'AL_DIA'; });
    var caro = st.costoEq.slice().sort(function (a, b) { return b.porHora - a.porHora; })[0];
    var mal = st.ops.filter(function (o) { return o.malUso; });
    var sinCheck = st.ops.filter(function (o) { return o.pct !== null && o.pct < 90; });
    var bajos = S.productos.filter(function (p) { return p.exist - p.res + p.camino <= p.min; });
    return [
      '*Resumen semanal · Taller Las Cabras*',
      'Disponibilidad: *' + Math.round(100 * op / S.equipos.length) + '%* (' + op + ' de ' + S.equipos.length + ' equipos operando)',
      'Órdenes abiertas: ' + S.ots.filter(abierta).length + ' · preventivo vs correctivo ' + st.prev + ':' + st.corr,
      'Servicios por vencer: ' + (serv.length ? serv.map(function (x) { return x[0].eco + ' (' + x[1].plan.nombre + ', ' + (x[1].restH > 0 ? 'faltan ' + n1(x[1].restH) + ' h' : 'vencido') + ')'; }).join(', ') : 'ninguno'),
      caro ? 'Costo por hora más alto: *' + caro.e.eco + '* ' + money0(caro.porHora) + '/h (mantenimiento + diésel)' : '',
      'Fallas por mal uso: ' + (mal.length ? mal.map(function (o) { return o.op.nombre + ' ' + o.malUso + ' (' + money0(o.costoMalUso) + ')'; }).join(', ') : 'ninguna'),
      'Checklist incompleto: ' + (sinCheck.length ? sinCheck.map(function (o) { return o.op.nombre.split(' ')[0] + ' ' + o.pct + '%'; }).join(', ') : 'nadie'),
      'Por pedir: ' + (bajos.length ? bajos.map(function (p) { return p.desc; }).join(', ') : 'nada')
    ].filter(Boolean).join('\n');
  }

  /* ================= Automatización: intérprete local de reglas ================= */
  var FALLA_RE = /falla|fuga|tira |tirando|gotea|ruido|se calienta|calentando|sobrecalent|no arranca|no prende|ponch|se rompio|roto|rota|quebr|humo|truena|no frena|no levanta|se apago|chilla/;
  var PISTAS = [[/levante|hidraul|manguera|piston/, 'Hidráulico'], [/calienta|calentando|temperatura|radiador|refrigerante|anticongelante/, 'Enfriamiento'],
    [/llanta|ponch|rin\b|rodado/, 'Ejes, llantas y rodaje'], [/freno|frena/, 'Frenos'], [/bateria|luces|no arranca|no prende|marcha|alternador|electric/, 'Eléctrico'],
    [/clutch|embrague|cambios|transmision|velocidad/, 'Transmisión y embrague'], [/direccion|volante/, 'Dirección'], [/toma de fuerza|tdf/, 'Toma de fuerza (TDF)'],
    [/inyector|combustible|diesel/, 'Combustible'], [/enganche|tercer punto|brazo/, 'Enganche de 3 puntos'], [/humo|motor|aceite|truena|ruido/, 'Motor']];
  var LAB_RE = [[/barbech/, 'Barbecho'], [/rastr/, 'Rastreo'], [/nivel/, 'Nivelación'], [/siembr|sembr/, 'Siembra'], [/cultiv|escard/, 'Cultivo / escarda'],
    [/fertiliz|abon/, 'Fertilización'], [/fumig/, 'Fumigación'], [/desvar/, 'Desvare'], [/acarre|viaje/, 'Acarreo']];
  var REGLAS = [
    ['bitacora', 'Jornada por mensaje', 'El operador escribe su jornada como texto libre', 'Guarda la bitácora, actualiza el horómetro y valida la lectura'],
    ['preventiva', 'Servicio que se abre solo', 'El horómetro queda a 50 h o menos del servicio', 'Abre la OT preventiva con tareas y aparta el kit'],
    ['falla', 'Falla directo al taller', 'El operador reporta una falla', 'Abre la OT correctiva, asigna mecánico y sugiere refacción por historial'],
    ['compra', 'Compras automáticas', 'Una refacción baja del mínimo o falta para una OT', 'Arma la requisición hasta el máximo y pide aprobación'],
    ['diesel', 'Diésel por mensaje', 'El operador reporta una carga', 'Descuenta del tanque y la costea al tractor'],
    ['alerta', 'Alertas de control', 'Carga fuera de rango, operador sin capacitación, tanque bajo', 'Avisa al momento al jefe de taller']
  ];
  function chatOp(id) {
    if (!S.wa.chats[id]) S.wa.chats[id] = [{ de: 'bot', t: ahora(), txt: 'Hola ' + emp(id).nombre.split(' ')[0] + ', soy el Agente agrícola. Mándame tu jornada, tus cargas de diésel o cualquier falla, como si le escribieras al jefe de taller. Antes de arrancar escribe *checklist*.' }];
    return S.wa.chats[id];
  }
  function botOp(op, txt, btns, meta) { chatOp(op).push({ de: 'bot', t: ahora(), txt: txt, btns: btns, meta: meta }); }
  function botJefe(txt, btns) { S.wa.jefe.push({ de: 'bot', t: ahora(), txt: txt, btns: btns }); }
  function eqDeOp(op) { return S.wa.eq[op] || (S.bitacora.filter(function (b) { return b.op === op; }).slice(-1)[0] || {}).eq || 1; }
  function horDe(t) {
    var m = t.match(/(?:horometro|quedo en|marca)\D{0,15}(\d+(?:[.,]\d+)?)/) || t.match(/\b(\d{3,6}(?:[.,]\d+)?)\s*(?:h|hrs|horas)\b/);
    return m ? num(m[1]) : null;
  }
  function loteDe(t) {
    var m = t.match(/lote\s*(\d)/); if (m && LOTES[+m[1] - 1]) return LOTES[+m[1] - 1];
    if (/bajio/.test(t)) return LOTES[0]; if (/loma/.test(t)) return LOTES[1]; if (/pozo/.test(t)) return LOTES[2];
    return LOTES[0];
  }
  function cantDe(t) { var m = t.match(/(\d+(?:[.,]\d+)?)\s*(ha|has|hectareas|viajes)\b/); return m ? num(m[1]) : 0; }
  function laborDe(t) { var m = LAB_RE.find(function (x) { return x[0].test(t); }); return m ? m[1] : null; }
  // Busca un número económico (JD-01, nh1, im 1…) en el texto normalizado.
  function ecoDe(t) {
    var m = t.match(/\b(jd|nh|im)\s?-?\s?(\d{1,2})\b/); if (!m) return undefined;
    return S.equipos.find(function (e) { return e.eco === m[1].toUpperCase() + '-' + m[2].padStart(2, '0'); }) || null;
  }

  function procesarLocal(txt, op) {
    var t = norm(txt), espera = S.wa.espera[op], eq = eqDeOp(op);
    var f = ecoDe(t);
    if (f === null) return botOp(op, 'No encontré ese equipo. Los tractores son: ' + S.equipos.filter(function (e) { return e.usaH; }).map(function (e) { return e.eco; }).join(', ') + '.');
    if (f) { if (!f.usaH) return botOp(op, 'El ' + f.eco + ' es un implemento. Registra la jornada con el tractor que lo jaló.'); eq = f.id; }
    S.wa.eq[op] = eq;
    if (espera && espera.tipo === 'falla') { S.wa.espera[op] = null; return chatFalla(txt, t, op, eq, true); }
    if (espera && espera.tipo === 'horometro') {
      var n = t.match(/(\d+(?:[.,]\d+)?)/);
      if (n && !/litro|diesel|falla|fuga/.test(t)) { S.wa.espera[op] = null; var hh = horDe(t); return chatJornada(Object.assign({}, espera, { hf: hh != null ? hh : num(n[1]) }), op); }
    }
    if (/check ?list|revision/.test(t)) return chatChecklist(op, eq);
    if (FALLA_RE.test(t)) return chatFalla(txt, t, op, eq, false);
    var mL = t.match(/(\d+(?:[.,]\d+)?)\s*(l|lt|lts|litros)\b/);
    if (mL || /diesel|cargue|cargamos/.test(t)) {
      if (!mL) return botOp(op, '¿Cuántos litros cargaste?');
      return chatDiesel(op, eq, num(mL[1]), horDe(t));
    }
    var labor = laborDe(t), hf = horDe(t);
    if (labor || hf !== null || /termine|jornada|trabaje|acabe/.test(t)) {
      var d = { tipo: 'horometro', eq: eq, labor: labor || 'Otros', lote: loteDe(t), cant: cantDe(t) };
      if (hf === null) { S.wa.espera[op] = d; return botOp(op, '¿En cuánto quedó el horómetro del ' + eqp(eq).eco + '? La última lectura fue ' + n1(eqp(eq).horas) + ' h.'); }
      return chatJornada(Object.assign({}, d, { hf: hf }), op);
    }
    botOp(op, 'No te entendí. Puedes mandarme, por ejemplo:\n• "JD-01 terminé, horómetro 2275, rastreo lote 2, 14 ha"\n• "Cargué 150 litros"\n• "El JD-01 tira aceite, quedó parado"\n• "checklist"');
  }
  function chatJornada(d, op) {
    var e = eqp(d.eq);
    if (e.estatus !== 'OPERANDO') return botOp(op, 'El ' + e.eco + ' aparece como "' + ESTATUS_EQ[e.estatus][0].toLowerCase() + '", así que no le puedo registrar trabajo. Si ya está trabajando, pide al taller que lo libere.');
    if (d.hf < e.horas) { S.wa.espera[op] = Object.assign({}, d); return botOp(op, 'El horómetro no puede ser menor a la última lectura del ' + e.eco + ' (' + n1(e.horas) + ' h). ¿Me lo confirmas?'); }
    var h = d.hf - e.horas;
    if (h > 20) { S.wa.espera[op] = Object.assign({}, d); return botOp(op, 'Eso serían ' + n1(h) + ' h en un día. ¿Me confirmas el horómetro del ' + e.eco + '?'); }
    S.bitacora.push({ fecha: hoyISO(), eq: e.id, op: op, lote: d.lote, labor: d.labor, hi: e.horas, hf: d.hf, cant: d.cant || 0 });
    e.horas = d.hf; S.wa.cont.bitacora++;
    var extra = '';
    if (!autorizado(op, e)) {
      notificar('warn', 'Operador sin autorización en ' + e.eco, emp(op).nombre + ' operó el ' + e.eco + ' sin capacitación vigente para ese modelo.');
      botJefe('*Aviso · operador sin capacitación*\n' + emp(op).nombre + ' registró ' + n1(h) + ' h en el ' + e.eco + ' (' + S.modelos[e.modelo] + ') sin capacitación vigente para ese modelo.');
      S.wa.cont.alerta++;
    }
    var s = peorSemaforo(e.id);
    if (s && s.sem !== 'AL_DIA' && !s.otAbierta) {
      var antes = e.estatus;
      var o = abrirOT({ eq: e.id, tipo: 'PREVENTIVA', planId: s.plan.id });
      e.estatus = antes; // queda programada; el tractor sigue en campo
      S.wa.cont.preventiva++;
      notificar(s.sem === 'VENCIDO' ? 'urg' : 'warn', e.eco + ': ' + s.plan.nombre + ' ' + (s.sem === 'VENCIDO' ? 'vencido' : 'próximo'), 'Se abrió ' + o.folio + ' automáticamente.');
      botJefe('*Servicio ' + (s.sem === 'VENCIDO' ? 'vencido' : 'próximo') + ' · ' + e.eco + '*\nHorómetro ' + n1(e.horas) + ' h; el ' + s.plan.nombre + ' toca a las ' + n1(s.proxH) + ' h.\nAbrí la ' + o.folio + ' con ' + o.tareas.length + ' tareas y aparté el kit:\n' +
        o.refs.map(function (r) { var p = prod(r.p); return '• ' + n1(r.sol) + ' ' + p.u + ' ' + p.desc + (r.res < r.sol ? ' (falta, se pidió a compras)' : ''); }).join('\n') + '\nPrográmalo cuando el tractor regrese de campo.', [['Ver ' + o.folio, 'ver-ot', o.id]]);
      extra = '\nOjo: al ' + e.eco + ' ' + (s.restH > 0 ? 'le faltan ' + n1(s.restH) + ' h para el ' + s.plan.nombre : 'ya se le pasó el ' + s.plan.nombre) + '. Ya le avisé al taller para programarlo.';
    }
    botOp(op, 'Listo, guardé tu jornada:\n• ' + e.eco + ' · ' + d.labor + (d.cant ? ' · ' + n1(d.cant) + ' ' + unidadLab(d.labor) : '') + '\n• ' + d.lote + '\n• ' + n1(h) + ' h (horómetro ' + n1(d.hf) + ')' + extra);
  }
  function chatDiesel(op, eq, lts, hor) {
    var e = eqp(eq);
    if (!(lts > 0)) return botOp(op, '¿Cuántos litros cargaste?');
    if (lts > S.diesel.exist) return botOp(op, 'El tanque del rancho sólo tiene ' + n1(S.diesel.exist) + ' L. Revisa la cantidad.');
    if (hor !== null && hor < e.horas) return botOp(op, 'El horómetro no puede ser menor a la última lectura del ' + e.eco + ' (' + n1(e.horas) + ' h).');
    S.diesel.exist -= lts;
    S.cargas.push({ fecha: ahora(), eq: e.id, op: op, litros: lts, costo: S.diesel.costo });
    if (hor !== null) e.horas = Math.max(e.horas, hor);
    S.wa.cont.diesel++;
    if (lts > CAP_TANQUE) {
      notificar('urg', 'Carga de diésel fuera de rango', n1(lts) + ' L al ' + e.eco + '; el tanque del tractor es de ' + CAP_TANQUE + ' L.');
      botJefe('*Alerta · carga de diésel fuera de rango*\n' + emp(op).nombre + ' reportó ' + n1(lts) + ' L al ' + e.eco + ', pero al tractor le caben ' + CAP_TANQUE + ' L. Revisa si fue error de captura o si hay una fuga.');
      S.wa.cont.alerta++;
    }
    if (S.diesel.exist < REORDEN_DIESEL) { botJefe('*Tanque de diésel bajo*\nQuedan ' + n1(S.diesel.exist) + ' L en el tanque del rancho. Conviene pedir pipa.'); S.wa.cont.alerta++; }
    botOp(op, 'Registré ' + n1(lts) + ' L al ' + e.eco + ' (' + money(lts * S.diesel.costo) + '). Quedan ' + n1(S.diesel.exist) + ' L en el tanque del rancho.');
  }
  function chatChecklist(op, eq) {
    botOp(op, '*Checklist del ' + eqp(eq).eco + '* antes de arrancar.\nRevisa aceite, refrigerante, fugas, frenos, dirección, llantas, enganche y protecciones. ¿Todo en orden?',
      [['Todo en orden', 'chk-ok', op], ['Encontré una falla', 'chk-falla', op]]);
  }
  function chatCheck(act, op) {
    var eq = eqDeOp(op);
    if (act === 'chk-ok') {
      chatOp(op).push({ de: 'yo', t: ahora(), txt: 'Todo en orden' });
      S.inspecciones.push({ fecha: ahora(), eq: eq, op: op, resultado: 'APTO' });
      botOp(op, 'Registrado: el ' + eqp(eq).eco + ' está apto para trabajar. Buen turno.');
    } else {
      chatOp(op).push({ de: 'yo', t: ahora(), txt: 'Encontré una falla' });
      S.wa.espera[op] = { tipo: 'falla' };
      botOp(op, '¿Qué encontraste? Dime también si el tractor puede trabajar o si quedó parado.');
    }
  }
  function chatFalla(txt, t, op, eq, desdeCheck) {
    var e = eqp(eq);
    var det = /parad|detenid|no arranca|no prende|no camina|no avanza|me quede|no se puede/.test(t);
    var sis = (PISTAS.find(function (x) { return x[0].test(t); }) || [null, 'Motor'])[1];
    if (desdeCheck) S.inspecciones.push({ fecha: ahora(), eq: eq, op: op, resultado: det ? 'NO_APTO' : 'CON_OBSERVACIONES' });
    var antes = e.estatus;
    var previas = S.ots.filter(function (o) { return o.tipo === 'CORRECTIVA' && eqp(o.eq).modelo === e.modelo && o.fallas.some(function (f) { return f.sis === sis; }); });
    var r = crearReporte({ eq: eq, op: op, sis: sis, desc: txt, detenido: det });
    var o = abrirOT({ eq: eq, tipo: 'CORRECTIVA', reporteId: r.id, prioridad: det ? 'URGENTE' : 'ALTA' });
    if (!det && antes === 'OPERANDO') e.estatus = 'OPERANDO';
    var sug = '';
    var ant = previas.filter(function (x) { return x.refs.length; }).slice(-1)[0];
    if (ant) {
      var r0 = ant.refs[0], p = prod(r0.p);
      reservar(o, r0.p, r0.sol);
      var ok = o.refs[0].res >= r0.sol;
      sug = '\nRefacción sugerida por historial (' + ant.folio + '): ' + n1(r0.sol) + ' ' + p.u + ' de ' + p.desc + ', ' + (ok ? 'ya apartada' : 'sin existencia, se pidió a compras') + '.';
    }
    S.wa.cont.falla++;
    botJefe('*Falla' + (det ? ' urgente' : '') + ' · ' + e.eco + (det ? ' detenido en campo' : '') + '*\n' + emp(op).nombre + ': "' + txt + '"\nSistema probable: *' + sis + '*' +
      (previas.length ? ' (' + previas.length + ' falla' + (previas.length === 1 ? '' : 's') + ' previa' + (previas.length === 1 ? '' : 's') + ' en este modelo)' : '') +
      '.\nAbrí la ' + o.folio + ' con prioridad ' + o.prioridad.toLowerCase() + ', asignada a ' + emp(o.resp).nombre + '.' + sug, [['Ver ' + o.folio, 'ver-ot', o.id]]);
    botOp(op, det
      ? 'Recibido. El ' + e.eco + ' queda fuera de operación y ya avisé al taller (' + o.folio + '). No lo muevas; ' + emp(o.resp).nombre.split(' ')[0] + ' va para allá.'
      : 'Recibido, ya avisé al taller (' + o.folio + '). Puedes seguir con precaución; lo revisan al terminar tu jornada.');
  }


export const S_ = () => S;
export {
  SISTEMAS, CAUSAS, LOTES, LABORES, CATS, seed, load, save, setGpsSource, syncGps, dispositivos, horasGps,
  semaforos, peorSemaforo, costoOT, setEstatusEquipo, abrirOT, cambiarEstatus, surtir, reservar, crearReporte,
  entradaAlmacen, pedirManual, syncReqs, aprobarReq, recibirReq, pendientesSurtir, nivelProd, dispP, quienAprueba,
  stats, periodos, kpis, veredicto, reporteSemanal, procesarLocal, chatOp, botOp, botJefe, chatCheck, chatChecklist, eqDeOp,
  ecoDe, horDe, norm, num, esc, money, ahora, hoyISO, fFecha, fFechaHora, dias, sumarDias, emp, eqp, prod, plan, otById, operadores, mecanicos,
  n1, money0, causa, autorizado, unidadLab, ESTATUS_EQ, ESTATUS_OT, SEM, MOV, abierta, REGLAS
};
export function state() { return S; }
export function setState(s) { S = s; }
