/* taller.js — página «Taller» del marco Debian (igual que Status, Tractores y Enlaces).
 * Lógica adaptada del prototipo «Taller y Almacén Las Cabras» al piloto (2 John Deere + 1 New Holland):
 *   Tablero · Órdenes de trabajo (diagnóstico, refacciones, liberación) · Almacén · Costos y KPIs · Automatización (chat).
 * Módulos 04 Taller, 05 Almacén y 06 Costos de docs/agentes/prototipo-agentes.txt.
 *
 * Datos: localStorage `pf-taller-v1` (datos de ejemplo; «Reiniciar demo» los restaura). Aún no hay tablas en MySQL.
 * GPS: cada equipo se puede vincular a un dispositivo de Traccar (window.__pf); si la posición trae attributes.hours,
 *      el horómetro toma esa lectura cuando es mayor que la capturada.
 * Automatización: interfaz de chat estilo assistant-ui. Si el servicio de agentes (agents/, POST /chat) responde,
 *      contesta el agente; si no, un intérprete local de reglas registra jornadas, diésel y fallas y dispara las reglas del taller.
 *      URL del servicio: window.PF_AGENTS_URL (por defecto http://localhost:3100). */
(function () {
  'use strict';

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
  function W() { return window.__pf && window.__pf.w; }
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
    if (!S.wa.chats[id]) S.wa.chats[id] = [{ de: 'bot', t: ahora(), txt: 'Hola ' + emp(id).nombre.split(' ')[0] + ', soy el asistente del taller. Mándame tu jornada, tus cargas de diésel o cualquier falla, como si le escribieras al jefe de taller. Antes de arrancar escribe *checklist*.' }];
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

  /* ================= Automatización: agente (servicio agents/) ================= */
  var AG = { url: (typeof window !== 'undefined' && window.PF_AGENTS_URL) || 'http://localhost:3100', estado: 'sin-probar', agentes: [], probando: false };
  function probarAgente(force) {
    if (AG.probando || (!force && AG.estado !== 'sin-probar')) return;
    AG.probando = true;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 3500);
    fetch(AG.url.replace(/\/$/, '') + '/health', { credentials: 'include', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (j) { AG.estado = 'en-linea'; AG.agentes = j.agentes || []; })
      .catch(function () { AG.estado = 'fuera'; })
      .then(function () { clearTimeout(to); AG.probando = false; if (S.ui.tab === 'auto') render(); });
  }
  function usaAgente() { return S.ui.chatModo === 'agente' || (S.ui.chatModo === 'auto' && AG.estado === 'en-linea'); }
  var ocupado = false, foco = false;
  function enviar(txt) {
    if (ocupado) return Promise.resolve();
    var op = S.wa.op;
    chatOp(op).push({ de: 'yo', t: ahora(), txt: txt });
    ocupado = true; foco = true; render();
    if (usaAgente()) {
      var hist = chatOp(op).filter(function (m) { return m.txt; }).slice(-20).map(function (m) { return { role: m.de === 'yo' ? 'user' : 'assistant', content: m.txt }; });
      while (hist.length && hist[0].role !== 'user') hist.shift();
      return fetch(AG.url.replace(/\/$/, '') + '/chat', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: hist, channel: 'web_taller' }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); })
        .then(function (j) { botOp(op, String(j.reply || '(sin respuesta)'), null, { agente: j.agent, modelo: j.model }); })
        .catch(function (e) {
          botOp(op, 'El agente no respondió (' + e.message + '). Lo resolví con las reglas locales del taller:', null, { error: true });
          try { procesarLocal(txt, op); } catch (er) { botOp(op, 'No pude procesar el mensaje. Inténtalo otra vez.'); }
        })
        .then(function () { ocupado = false; foco = true; render(); });
    }
    return new Promise(function (ok) {
      setTimeout(function () {
        ocupado = false;
        try { procesarLocal(txt, op); } catch (e) { botOp(op, 'No pude procesar el mensaje. Inténtalo otra vez.'); }
        foco = true; render(); ok();
      }, 600);
    });
  }

  /* ================= exporta la lógica pura (pruebas en Node) ================= */
  var root = typeof window !== 'undefined' ? window : globalThis;
  var api = (root.__taller = root.__taller || {});
  api._t = {
    seed: seed, state: function () { return S; }, setState: function (s) { S = s; }, semaforos: semaforos, peorSemaforo: peorSemaforo, costoOT: costoOT,
    abrirOT: abrirOT, cambiarEstatus: cambiarEstatus, surtir: surtir, reservar: reservar, entradaAlmacen: entradaAlmacen, syncReqs: syncReqs,
    aprobarReq: aprobarReq, recibirReq: recibirReq, kpis: kpis, stats: stats, procesarLocal: procesarLocal, chatOp: chatOp, ecoDe: ecoDe, norm: norm, horDe: horDe
  };
  var toastTimer;
  function toast(msg) {
    if (typeof document === 'undefined') return;
    var t = document.getElementById('tl-toast');
    if (!t) { t = document.createElement('div'); t.id = 'tl-toast'; t.className = 'tl-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  load();
  if (typeof document === 'undefined') return; // en pruebas de Node solo se exporta la lógica

  /* ================= vistas ================= */
  var $ = function (s) { return document.querySelector('#tl-root ' + s); };
  var fmt = function (s) { return esc(s).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); };

  function vistaTablero() {
    var activos = S.equipos.filter(function (e) { return e.estatus !== 'BAJA'; });
    var operando = activos.filter(function (e) { return e.estatus === 'OPERANDO'; }).length;
    var taller = activos.filter(function (e) { return ['EN_TALLER', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'LISTO_LIBERAR'].indexOf(e.estatus) >= 0; }).length;
    var descomp = activos.filter(function (e) { return e.estatus === 'DESCOMPUESTO'; }).length;
    var sems = S.equipos.filter(function (e) { return e.usaH; }).map(function (e) { return peorSemaforo(e.id); }).filter(Boolean);
    var venc = sems.filter(function (s) { return s.sem === 'VENCIDO'; }).length, prox = sems.filter(function (s) { return s.sem === 'PROXIMO'; }).length;
    var otsAb = S.ots.filter(abierta).length;
    var repAb = S.reportes.filter(function (r) { return r.estatus === 'ABIERTO'; });
    var bajos = S.productos.filter(function (p) { return p.exist - p.res + p.camino <= p.min; });
    var st = stats();
    var maxPH = Math.max.apply(null, [1].concat(st.costoEq.map(function (c) { return c.porHora; })));
    var fallasArr = Object.entries(st.fallas).sort(function (a, b) { return b[1].n - a[1].n; });
    var totalF = sum(fallasArr, function (f) { return f[1].n; });
    var devs = dispositivos();
    var gpsSel = function (e) {
      if (!e.usaH) return '<span class="muted small">—</span>';
      if (!devs.length) return '<span class="muted small">' + (e.deviceId != null ? 'Vinculado #' + esc(e.deviceId) : 'Sin GPS') + '</span>';
      return '<select data-gps="' + e.id + '" aria-label="Rastreador del ' + esc(e.eco) + '"><option value="">Sin vincular</option>' +
        devs.map(function (d) { return '<option value="' + esc(d.id) + '"' + (String(d.id) === String(e.deviceId) ? ' selected' : '') + '>' + esc(d.name || ('#' + d.id)) + '</option>'; }).join('') + '</select>';
    };
    return '' +
    '<section class="kpis" aria-label="Indicadores">' +
      '<div class="kpi"><span class="label">Disponibilidad</span><span class="v">' + Math.round(100 * operando / activos.length) + '%</span><span class="s">' + operando + ' de ' + activos.length + ' equipos operando</span></div>' +
      '<div class="kpi ' + (descomp ? 'alert' : '') + '"><span class="label">Descompuestos en campo</span><span class="v">' + descomp + '</span><span class="s">' + repAb.length + ' reporte' + (repAb.length === 1 ? '' : 's') + ' sin atender</span></div>' +
      '<div class="kpi"><span class="label">En taller</span><span class="v">' + taller + '</span><span class="s">' + otsAb + ' ' + (otsAb === 1 ? 'orden abierta' : 'órdenes abiertas') + '</span></div>' +
      '<div class="kpi ' + (venc ? 'alert' : '') + '"><span class="label">Servicios vencidos</span><span class="v">' + venc + '</span><span class="s">' + prox + ' próximo' + (prox === 1 ? '' : 's') + '</span></div>' +
      '<div class="kpi"><span class="label">Preventivo vs correctivo</span><span class="v">' + st.prev + ':' + st.corr + '</span><span class="s">Meta: más preventivo</span></div>' +
    '</section>' +
    '<div class="grid-2">' +
      '<section class="panel"><div class="panel-head"><h3>Reportes de falla sin atender</h3></div>' +
        (repAb.length ? '<div class="feed">' + repAb.map(function (r) {
          return '<div class="note urg"><span class="dot"></span><div><b><span class="eco">' + esc(eqp(r.eq).eco) + '</span> · ' + esc(r.sis || 'Sin clasificar') + (r.detenido ? ' · detenido' : '') + '</b>' +
            '<span class="muted small">' + esc(r.desc) + '<br>' + esc(emp(r.op).nombre) + ' · ' + fFechaHora(r.fecha) + '</span></div>' +
            '<button class="primary small" data-act="ot-desde-reporte" data-id="' + r.id + '">Crear OT</button></div>';
        }).join('') + '</div>' : '<div class="empty">Sin reportes pendientes. Los reportes llegan desde Automatización (chat del operador).</div>') +
      '</section>' +
      '<section class="panel"><div class="panel-head"><h3>Avisos</h3><span class="muted small">' + S.notifs.length + ' en total</span></div>' +
        '<div class="feed">' + S.notifs.slice(-4).reverse().map(function (n) {
          return '<div class="note ' + n.nivel + '"><span class="dot"></span><div><b>' + esc(n.titulo) + '</b><span class="muted small">' + esc(n.msg) + '</span></div><span class="muted small mono">' + fFecha(n.fecha) + '</span></div>';
        }).join('') + '</div></section>' +
    '</div>' +
    '<section class="panel"><div class="panel-head"><h3>Flota</h3><span class="muted small">El semáforo compara el horómetro contra el plan de cada modelo. Vincula el rastreador para tomar las horas de motor del GPS.</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Equipo</th><th>Modelo</th><th class="r">Horómetro</th><th>GPS</th><th>Estatus</th><th>Próximo servicio</th><th>Semáforo</th><th></th></tr></thead><tbody>' +
      S.equipos.map(function (e) {
        var s = e.usaH ? peorSemaforo(e.id) : null;
        var otAb = S.ots.find(function (o) { return o.eq === e.id && abierta(o); });
        var accion = '';
        if (otAb) accion = '<button class="small" data-act="ver-ot" data-id="' + otAb.id + '">Ver ' + esc(otAb.folio) + '</button>';
        else if (s && s.sem !== 'AL_DIA') accion = '<button class="primary small" data-act="ot-preventiva" data-eq="' + e.id + '" data-plan="' + s.plan.id + '">Abrir preventiva</button>';
        var hg = e.deviceId != null ? horasGps(e.deviceId) : null;
        return '<tr><td class="eco">' + esc(e.eco) + '</td><td>' + esc(S.modelos[e.modelo]) + '</td>' +
          '<td class="r num">' + (e.usaH ? n1(e.horas) + ' h' + (hg !== null ? '<br><span class="muted small">GPS ' + n1(hg) + ' h</span>' : '') : '<span class="muted">Sin horómetro</span>') + '</td>' +
          '<td>' + gpsSel(e) + '</td><td>' + pill(ESTATUS_EQ[e.estatus]) + '</td>' +
          '<td>' + (s ? esc(s.plan.nombre) + ' <span class="muted small num">· ' + (s.restH > 0 ? 'faltan ' + n1(s.restH) + ' h' : n1(-s.restH) + ' h pasado') + '</span>' : '<span class="muted">—</span>') + '</td>' +
          '<td>' + (s ? pill(SEM[s.sem]) : '') + '</td><td class="r">' + accion + '</td></tr>';
      }).join('') + '</tbody></table></div></section>' +
    '<div class="grid-2">' +
      '<section class="panel"><div class="panel-head"><h3>Costo por hora de operación</h3><span class="muted small">Mantenimiento + diésel</span></div>' +
        '<div class="bars">' + st.costoEq.map(function (c) { return '<div class="bar"><span class="eco">' + esc(c.e.eco) + '</span><span class="track"><span class="fill" style="width:' + (100 * c.porHora / maxPH).toFixed(1) + '%"></span></span><span class="num small">' + money0(c.porHora) + '/h</span></div>'; }).join('') + '</div>' +
        '<div class="table-wrap" style="margin-top:.9rem"><table><thead><tr><th>Equipo</th><th class="r">Horas</th><th class="r">Manten.</th><th class="r">Diésel</th><th class="r">L/h</th></tr></thead><tbody>' +
        st.costoEq.map(function (c) { return '<tr><td class="eco">' + esc(c.e.eco) + '</td><td class="r num">' + n1(c.horas) + '</td><td class="r num">' + money0(c.mant) + '</td><td class="r num">' + money0(c.comb) + '</td><td class="r num">' + (c.lph ? c.lph.toFixed(1) : '—') + '</td></tr>'; }).join('') +
        '</tbody></table></div></section>' +
      '<section class="panel"><div class="panel-head"><h3>Fallas por causa</h3><span class="muted small">' + totalF + ' falla' + (totalF === 1 ? '' : 's') + ' clasificada' + (totalF === 1 ? '' : 's') + '</span></div>' +
        (fallasArr.length ? '<div class="bars">' + fallasArr.map(function (x) {
          return '<div class="bar wide"><span class="small">' + esc(x[0]) + '</span><span class="track"><span class="fill ' + (x[1].imp ? 'bad' : '') + '" style="width:' + (100 * x[1].n / totalF).toFixed(1) + '%"></span></span><span class="num small">' + x[1].n + ' · ' + money0(x[1].costo) + '</span></div>';
        }).join('') + '</div><p class="muted small" style="margin:.8rem 0 0">En rojo, las causas atribuibles al operador.</p>' : '<div class="empty">Aún no hay fallas clasificadas.</div>') +
      '</section>' +
    '</div>' +
    '<div class="grid-2">' +
      '<section class="panel"><div class="panel-head"><h3>Operadores</h3><span class="muted small">Checklist hecho antes de cada jornada</span></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Operador</th><th class="r">Horas</th><th class="r">Checklist</th><th class="r">Fallas por mal uso</th><th class="r">Costo</th></tr></thead><tbody>' +
        st.ops.map(function (o) { return '<tr><td>' + esc(o.op.nombre) + '</td><td class="r num">' + n1(o.horas) + '</td><td class="r">' + (o.pct === null ? '<span class="muted">—</span>' : pill([o.pct + '%', o.pct >= 90 ? 'ok' : o.pct >= 50 ? 'warn' : 'bad'])) + '</td><td class="r num">' + o.malUso + '</td><td class="r num">' + money0(o.costoMalUso) + '</td></tr>'; }).join('') +
        '</tbody></table></div></section>' +
      '<section class="panel"><div class="panel-head"><h3>Inventario por pedir</h3><span class="muted small">Disponible + en camino ≤ mínimo</span></div>' +
        (bajos.length ? '<div class="table-wrap"><table><thead><tr><th>Producto</th><th class="r">Disponible</th><th class="r">En camino</th><th class="r">Mínimo</th></tr></thead><tbody>' +
          bajos.map(function (p) { return '<tr><td>' + esc(p.desc) + ' <span class="muted small mono">' + esc(p.codigo) + '</span></td><td class="r num">' + n1(p.exist - p.res) + ' ' + p.u + '</td><td class="r num">' + n1(p.camino) + '</td><td class="r num">' + p.min + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : '<div class="empty">Todo el inventario está arriba del mínimo.</div>') +
        (S.requisiciones.length ? '<p class="small" style="margin:.8rem 0 0"><b>' + S.requisiciones.length + '</b> requisición(es). Se aprueban en Almacén o desde Automatización. <button class="small" data-act="tab" data-tab="almacen">Ir a Almacén</button></p>' : '') +
      '</section>' +
    '</div>';
  }

  var PASOS = [['Recepción', ['ABIERTA']], ['Diagnóstico', ['EN_DIAGNOSTICO']], ['Reparación', ['EN_PROCESO', 'ESPERANDO_REFACCION']], ['Terminada', ['TERMINADA']], ['Liberada', ['LIBERADA']]];
  function vistaOrdenes() {
    var lista = S.ots.filter(function (o) { return S.ui.otFiltro === 'todas' || abierta(o); }).slice().reverse();
    var o = otById(S.ui.otSel) || lista[0];
    return '<div class="ot-layout"><section class="panel">' +
      '<div class="panel-head"><h3>Órdenes de trabajo</h3><button class="primary small" data-act="nueva-ot">Nueva OT</button></div>' +
      '<label class="field" style="margin-bottom:.75rem"><span class="sr">Mostrar</span><select id="tl-ot-filtro"><option value="todas"' + (S.ui.otFiltro === 'todas' ? ' selected' : '') + '>Todas</option><option value="abiertas"' + (S.ui.otFiltro === 'abiertas' ? ' selected' : '') + '>Sólo abiertas</option></select></label>' +
      '<div class="ot-list">' + (lista.length ? lista.map(function (x) {
        return '<button class="ot-item" data-act="ver-ot" data-id="' + x.id + '" aria-current="' + (o && x.id === o.id) + '"><span class="top"><span class="mono small">' + esc(x.folio) + '</span>' + pill(ESTATUS_OT[x.estatus]) + '</span>' +
          '<span><span class="eco">' + esc(eqp(x.eq).eco) + '</span> <span class="muted small">· ' + (x.tipo === 'PREVENTIVA' ? 'Preventiva' : 'Correctiva') + '</span></span>' +
          '<span class="muted small">' + fFechaHora(x.recepcion) + ' · ' + money0(costoOT(x).total) + '</span></button>';
      }).join('') : '<div class="empty">No hay órdenes abiertas.</div>') + '</div></section>' +
      '<div class="ot-main">' + (S.ui.nuevaOT ? formNuevaOT() : '') + (o ? detalleOT(o) : '<section class="panel"><div class="empty">Selecciona una orden.</div></section>') + '</div></div>';
  }
  function planesDe(e) { return S.planes.filter(function (p) { return p.modelos.indexOf(e.modelo) >= 0; }); }
  function formNuevaOT() {
    var eqSel = Number(S.ui.nuevaEq || 1), e = eqp(eqSel) || S.equipos[0];
    var planes = planesDe(e);
    var reps = S.reportes.filter(function (r) { return r.eq === e.id && r.estatus === 'ABIERTO'; });
    return '<section class="panel"><div class="panel-head"><h3>Nueva orden de trabajo</h3><button class="small" data-act="cerrar-nueva">Cancelar</button></div>' +
      '<form id="tl-form-ot" class="form-grid">' +
      '<label class="field"><span>Equipo</span><select id="tl-n-eq">' + S.equipos.map(function (x) { return '<option value="' + x.id + '"' + (x.id === e.id ? ' selected' : '') + '>' + esc(x.eco) + ' · ' + esc(S.modelos[x.modelo]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Tipo</span><select id="tl-n-tipo"><option value="CORRECTIVA">Correctiva</option>' + (planes.length ? '<option value="PREVENTIVA">Preventiva</option>' : '') + '</select></label>' +
      (planes.length ? '<label class="field"><span>Plan (si es preventiva)</span><select id="tl-n-plan">' + planes.map(function (p) { return '<option value="' + p.id + '">' + esc(p.nombre) + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="field"><span>Prioridad</span><select id="tl-n-prio"><option>MEDIA</option><option>ALTA</option><option>URGENTE</option><option>BAJA</option></select></label>' +
      (reps.length ? '<label class="field"><span>Reporte de falla</span><select id="tl-n-rep"><option value="">Ninguno</option>' + reps.map(function (r) { return '<option value="' + r.id + '">' + esc(r.folio) + ' · ' + esc(r.desc.slice(0, 40)) + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="field span"><span>Falla reportada</span><input id="tl-n-falla" placeholder="Ruido en la transmisión al meter tercera"></label>' +
      '<div class="row span"><button class="primary" type="submit">Abrir orden</button><span id="tl-n-err" class="error"></span></div></form></section>';
  }
  function detalleOT(o) {
    var e = eqp(o.eq), c = costoOT(o);
    var idxPaso = PASOS.findIndex(function (p) { return p[1].indexOf(o.estatus) >= 0; });
    var editable = abierta(o);
    var acciones = ({
      ABIERTA: [['EN_DIAGNOSTICO', 'Iniciar diagnóstico', 'primary'], ['CANCELADA', 'Cancelar', 'danger']],
      EN_DIAGNOSTICO: [['EN_PROCESO', 'Iniciar reparación', 'primary'], ['CANCELADA', 'Cancelar', 'danger']],
      EN_PROCESO: [['TERMINADA', 'Terminar', 'primary'], ['ESPERANDO_REFACCION', 'Esperando refacción', '']],
      ESPERANDO_REFACCION: [['EN_PROCESO', 'Reanudar reparación', 'primary']],
      TERMINADA: [['LIBERADA', 'Liberar equipo', 'primary']]
    })[o.estatus] || [];
    return '<section class="panel"><div class="panel-head"><div style="display:grid;gap:.2rem">' +
      '<span class="mono small muted">' + esc(o.folio) + ' · ' + (o.tipo === 'PREVENTIVA' ? 'Preventiva' : 'Correctiva') + ' · prioridad ' + esc(o.prioridad.toLowerCase()) + '</span>' +
      '<h3 class="big-h"><span class="eco">' + esc(e.eco) + '</span> ' + esc(S.modelos[e.modelo]) + '</h3></div>' +
      '<div class="row">' + acciones.map(function (a) { return '<button class="' + a[2] + '" data-act="estatus" data-st="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div></div>' +
      (o.estatus === 'CANCELADA' ? pill(ESTATUS_OT.CANCELADA) : '<div class="steps">' + PASOS.map(function (p, i) { return '<div class="step ' + (i < idxPaso || o.estatus === 'LIBERADA' ? 'done' : i === idxPaso ? 'now' : '') + '"><i></i>' + p[0] + '</div>'; }).join('') + '</div>') +
      (o.error ? '<p class="error" role="alert">' + esc(o.error) + '</p>' : '') +
      '<div class="facts"><div><span class="label">Estatus</span>' + pill(ESTATUS_OT[o.estatus]) + '</div><div><span class="label">Recepción</span><span class="num">' + fFechaHora(o.recepcion) + '</span></div>' +
      '<div><span class="label">Responsable</span><span>' + esc(emp(o.resp).nombre) + '</span></div><div><span class="label">Operaba</span><span>' + (o.opFalla ? esc(emp(o.opFalla).nombre) : '—') + '</span></div>' +
      '<div><span class="label">Costo total</span><span class="num" style="font-weight:600">' + money(c.total) + '</span></div></div>' +
      '<div class="sub"><span class="label">Falla reportada</span><span>' + esc(o.falla || '—') + '</span>' +
        (o.diagnostico ? '<span class="label">Diagnóstico</span><span>' + esc(o.diagnostico) + '</span>' : '') +
        (editable && o.tipo === 'CORRECTIVA' ? '<div class="row"><input id="tl-diag" placeholder="Escribe el diagnóstico" style="flex:1"><button class="small" data-act="diag">Guardar</button></div>' : '') + '</div>' +
      (o.tareas.length ? '<div class="sub"><span class="label">Tareas del plan</span>' + o.tareas.map(function (t, i) { return '<label class="task"><input type="checkbox" data-act="tarea" data-i="' + i + '"' + (t[1] ? ' checked' : '') + (editable ? '' : ' disabled') + '>' + esc(t[0]) + '</label>'; }).join('') + '</div>' : '') +
      '<div class="sub"><div class="panel-head" style="margin:0"><span class="label">Refacciones</span><span class="muted small">Se apartan al pedirlas; nadie más puede usarlas</span></div>' +
        (o.refs.length ? '<div class="table-wrap"><table><thead><tr><th>Producto</th><th class="r">Pedido</th><th class="r">Apartado</th><th class="r">Surtido</th><th class="r">Importe</th><th></th></tr></thead><tbody>' +
          o.refs.map(function (r, i) { var p = prod(r.p), falta = r.sol - r.sur - r.res;
            return '<tr><td>' + esc(p.desc) + '</td><td class="r num">' + n1(r.sol) + ' ' + p.u + '</td><td class="r num">' + n1(r.res) + '</td><td class="r num">' + n1(r.sur) + '</td><td class="r num">' + money(r.sur * r.costo) + '</td><td class="r">' +
              (r.sur >= r.sol ? pill(['Surtido', 'ok']) : falta > 0 && r.res === 0 && p.exist - p.res < r.sol - r.sur ? pill(['Sin existencia', 'warn']) : editable ? '<button class="small" data-act="surtir" data-i="' + i + '">Surtir</button>' : '') + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : '<div class="empty">Sin refacciones.</div>') +
        (editable ? '<div class="form-grid"><label class="field"><span>Producto</span><select id="tl-r-prod">' + S.productos.map(function (p) { return '<option value="' + p.id + '">' + esc(p.desc) + ' · disp. ' + n1(p.exist - p.res) + ' ' + p.u + '</option>'; }).join('') + '</select></label>' +
          '<label class="field"><span>Cantidad</span><input id="tl-r-cant" type="number" min="0.5" step="0.5" value="1"></label><button class="small" data-act="add-ref">Pedir refacción</button></div>' : '') + '</div>' +
      '<div class="sub"><span class="label">Mano de obra</span>' +
        (o.mano.length ? '<div class="table-wrap"><table><tbody>' + o.mano.map(function (m) { return '<tr><td>' + esc(emp(m.emp).nombre) + '</td><td class="r num">' + n1(m.horas) + ' h × ' + money0(m.costo) + '</td><td class="r num">' + money(m.horas * m.costo) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
        (editable ? '<div class="form-grid"><label class="field"><span>Mecánico</span><select id="tl-m-emp">' + mecanicos().map(function (m) { return '<option value="' + m.id + '">' + esc(m.nombre) + '</option>'; }).join('') + '</select></label>' +
          '<label class="field"><span>Horas</span><input id="tl-m-horas" type="number" min="0.25" step="0.25" value="1"></label><button class="small" data-act="add-mano">Registrar horas</button></div>' : '') + '</div>' +
      (o.tipo === 'CORRECTIVA' ? '<div class="sub"><span class="label">Clasificación de la falla</span>' +
        (o.fallas.length ? o.fallas.map(function (f) { var cz = causa(f.causa); return '<div class="row">' + pill([f.sis, 'info']) + pill([cz[1], cz[2] ? 'bad' : 'plain']) + '</div>'; }).join('') : '<span class="muted small">Obligatoria para terminar la orden: con esto se calculan las fallas por sistema, por causa y por operador.</span>') +
        (editable ? '<div class="form-grid"><label class="field"><span>Sistema</span><select id="tl-f-sis">' + SISTEMAS.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select></label>' +
          '<label class="field"><span>Causa</span><select id="tl-f-causa">' + CAUSAS.map(function (cz) { return '<option value="' + cz[0] + '">' + esc(cz[1]) + '</option>'; }).join('') + '</select></label><button class="small" data-act="add-falla">Agregar</button></div>' : '') + '</div>' : '') +
      '<div class="sub"><span class="label">Historial</span><div class="row small">' + o.hist.map(function (h) { return '<span>' + pill(ESTATUS_OT[h[0]]) + ' <span class="muted num">' + fFechaHora(h[1]) + '</span></span>'; }).join('<span class="muted">→</span>') + '</div></div>' +
      '</section>';
  }

  function vistaAlmacen() {
    var u = S.ui, q = norm(u.almQ || ''), cat = u.almCat || '', solo = !!u.almBajo;
    var lista = S.productos.filter(function (p) { return (!cat || p.cat === cat) && (!q || norm(p.codigo + ' ' + p.desc).indexOf(q) >= 0) && (!solo || ['bad', 'warn'].indexOf(nivelProd(p)[1]) >= 0); });
    var valor = sum(S.productos, function (p) { return p.exist * p.costo; }), apartado = sum(S.productos, function (p) { return p.res * p.costo; });
    var porPedir = S.productos.filter(function (p) { return nivelProd(p)[1] === 'bad'; });
    var pend = pendientesSurtir();
    var rank = { PENDIENTE: 0, APROBADA: 1, RECIBIDA: 2 };
    var reqs = S.requisiciones.slice().sort(function (a, b) { return rank[a.estatus] - rank[b.estatus] || (a.fecha < b.fecha ? 1 : -1); }).slice(0, 8);
    var enCamino = sum(S.requisiciones.filter(function (r) { return r.estatus === 'APROBADA'; }), function (r) { return r.pedido * prod(r.p).costo; });
    var kp = +u.almKardex || 0;
    var movs = S.movs.filter(function (m) { return !kp || m.p === kp; }).slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, 14);
    var sal30 = sum(S.movs.filter(function (m) { return m.tipo === 'SALIDA' && dias(m.fecha.slice(0, 10), hoyISO()) <= 30; }), function (m) { return m.cant * m.costo; });
    var dsl = S.diesel;
    var opts = function (sel) { return S.productos.map(function (p) { return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.codigo) + ' · ' + esc(p.desc) + '</option>'; }).join(''); };
    var ESTREQ = { PENDIENTE: ['Por aprobar', 'warn'], APROBADA: ['En camino', 'info'], RECIBIDA: ['Recibida', 'ok'] };
    return '' +
    '<section class="kpis" aria-label="Indicadores de almacén">' +
      '<div class="kpi"><span class="label">Valor del inventario</span><span class="v">' + money0(valor) + '</span><span class="s">' + S.productos.length + ' productos a costo promedio</span></div>' +
      '<div class="kpi"><span class="label">Apartado para OTs</span><span class="v">' + money0(apartado) + '</span><span class="s">Comprometido, no disponible</span></div>' +
      '<div class="kpi ' + (pend.length ? 'alert' : '') + '"><span class="label">Por surtir</span><span class="v">' + pend.length + '</span><span class="s">Partidas de órdenes abiertas</span></div>' +
      '<div class="kpi ' + (porPedir.length ? 'alert' : '') + '"><span class="label">Por pedir</span><span class="v">' + porPedir.length + '</span><span class="s">Disponible + en camino ≤ mínimo</span></div>' +
      '<div class="kpi"><span class="label">Compras en camino</span><span class="v">' + money0(enCamino) + '</span><span class="s">Salidas últimos 30 días: ' + money0(sal30) + '</span></div>' +
    '</section>' +
    '<div class="grid-2">' +
      '<section class="panel"><div class="panel-head"><h3>Pendiente de surtir</h3><span class="muted small">Ninguna refacción sale sin OT</span></div>' +
        (pend.length ? '<div class="table-wrap"><table><thead><tr><th>OT</th><th>Equipo</th><th>Producto</th><th class="r">Falta</th><th class="r">Disponible</th><th></th></tr></thead><tbody>' +
          pend.map(function (x) { var p = prod(x.r.p), falta = x.r.sol - x.r.sur, hay = dispP(p) + x.r.res;
            return '<tr><td><button class="small" data-act="ver-ot" data-id="' + x.o.id + '">' + esc(x.o.folio) + '</button></td><td class="eco">' + esc(eqp(x.o.eq).eco) + '</td>' +
              '<td>' + esc(p.desc) + (x.r.res ? '<br><span class="muted small">' + n1(x.r.res) + ' ' + p.u + ' apartado</span>' : '') + '</td><td class="r num">' + n1(falta) + ' ' + p.u + '</td><td class="r num">' + n1(hay) + '</td>' +
              '<td class="r">' + (hay >= falta ? '<button class="primary small" data-act="alm-surtir" data-ot="' + x.o.id + '" data-i="' + x.i + '">Surtir</button>' : pill(['Sin existencia', 'warn'])) + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : '<div class="empty">No hay refacciones pendientes de surtir. Cuando el taller pide una refacción en una OT aparece aquí.</div>') +
      '</section>' +
      '<section class="panel"><div class="panel-head"><h3>Requisiciones y compras</h3><span class="muted small">Jefe de taller autoriza hasta ' + money0(S.cfg.limiteJefe) + '; arriba, Dirección</span></div>' +
        (reqs.length ? '<div class="table-wrap"><table><thead><tr><th>Folio</th><th>Producto</th><th class="r">Cantidad</th><th class="r">Monto</th><th>Estatus</th><th></th></tr></thead><tbody>' +
          reqs.map(function (r) { var p = prod(r.p), monto = r.pedido * p.costo;
            var acc = r.estatus === 'PENDIENTE' ? '<button class="primary small" data-act="req-aprobar" data-id="' + esc(r.folio) + '">Aprobar</button>' : r.estatus === 'APROBADA' ? '<button class="small" data-act="req-recibir" data-id="' + esc(r.folio) + '">Registrar llegada</button>' : '';
            return '<tr><td><span class="mono small">' + esc(r.folio) + '</span><br><span class="muted small">' + (r.ot ? esc(r.ot) : r.manual ? 'Manual' : 'Reabasto') + '</span></td><td>' + esc(p.desc) + '</td><td class="r num">' + n1(r.pedido) + ' ' + p.u + '</td><td class="r num">' + money0(monto) + '</td>' +
              '<td>' + pill(ESTREQ[r.estatus] || ESTREQ.PENDIENTE) + '<br><span class="muted small">' + (r.aprobo ? esc(r.aprobo) : 'Autoriza: ' + quienAprueba(monto)) + '</span></td><td class="r">' + acc + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : '<div class="empty">Sin requisiciones.</div>') +
      '</section>' +
    '</div>' +
    '<section class="panel"><div class="panel-head"><h3>Existencias</h3><div class="row">' +
      '<input id="tl-alm-q" type="search" placeholder="Buscar código o producto" value="' + esc(u.almQ || '') + '" style="width:min(100%,230px)" aria-label="Buscar producto">' +
      '<select id="tl-alm-cat" style="width:auto" aria-label="Categoría"><option value="">Todas las categorías</option>' + CATS.map(function (c) { return '<option' + (c === cat ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select>' +
      '<label class="task small"><input type="checkbox" id="tl-alm-bajo"' + (solo ? ' checked' : '') + '> Solo bajo mínimo</label></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Producto</th><th class="r">Existencia</th><th class="r">Apartado</th><th class="r">Disponible</th><th class="r">En camino</th><th>Nivel · mín–máx</th><th class="r">Costo prom.</th><th class="r">Valor</th><th>Estado</th><th></th></tr></thead><tbody>' +
      (lista.map(function (p) { var d = dispP(p), nv = nivelProd(p), pct = Math.min(100, 100 * d / p.max), pm = 100 * p.min / p.max;
        var tienePend = S.requisiciones.some(function (r) { return r.p === p.id && r.estatus === 'PENDIENTE'; });
        return '<tr><td>' + esc(p.desc) + '<br><span class="muted small mono">' + esc(p.codigo) + ' · ' + esc(p.cat) + '</span></td>' +
          '<td class="r num">' + n1(p.exist) + ' ' + p.u + '</td><td class="r num">' + n1(p.res) + '</td><td class="r num" style="font-weight:600">' + n1(d) + '</td><td class="r num">' + n1(p.camino) + '</td>' +
          '<td><div class="level" title="Disponible ' + n1(d) + ' · mínimo ' + p.min + ' · máximo ' + p.max + '"><span class="f f-' + nv[1] + '" style="width:' + pct.toFixed(1) + '%"></span><span class="m" style="left:' + pm.toFixed(1) + '%"></span></div><span class="muted small num">' + p.min + '–' + p.max + ' ' + p.u + '</span></td>' +
          '<td class="r num">' + money(p.costo) + '</td><td class="r num">' + money0(p.exist * p.costo) + '</td><td>' + pill(nv) + '</td>' +
          '<td class="r"><div class="row nowrap">' + (tienePend ? '' : '<button class="small" data-act="alm-pedir" data-id="' + p.id + '">Pedir</button>') + '<button class="small" data-act="alm-kardex" data-id="' + p.id + '">Kardex</button></div></td></tr>'; }).join('') ||
        '<tr><td colspan="10"><div class="empty">Ningún producto coincide.</div></td></tr>') +
      '</tbody></table></div><p class="muted small" style="margin:.6rem 0 0">La marca negra en la barra es el mínimo. «Pedir» arma una requisición hasta el máximo.</p></section>' +
    '<div class="grid-2">' +
      '<section class="panel"><div class="panel-head"><h3>Entradas y conteo físico</h3></div>' +
        '<form id="tl-form-ent" class="form-grid"><span class="label span">Entrada de mercancía</span>' +
          '<label class="field"><span>Producto</span><select id="tl-e-p">' + opts(kp || 2) + '</select></label>' +
          '<label class="field"><span>Cantidad</span><input id="tl-e-c" type="number" min="0" step="0.5" placeholder="10"></label>' +
          '<label class="field"><span>Costo unitario</span><input id="tl-e-u" type="number" min="0" step="0.01" placeholder="Costo actual"></label>' +
          '<label class="field"><span>Factura / proveedor</span><input id="tl-e-r" placeholder="F-4512 Agrotractores"></label>' +
          '<button class="primary" type="submit">Registrar entrada</button></form>' +
        '<form id="tl-form-aju" class="form-grid sub"><span class="label span">Conteo físico</span>' +
          '<label class="field"><span>Producto</span><select id="tl-a-p">' + opts(kp || 1) + '</select></label>' +
          '<label class="field"><span>Conteo real</span><input id="tl-a-c" type="number" min="0" step="0.5"></label>' +
          '<label class="field"><span>Motivo</span><input id="tl-a-m" placeholder="Conteo mensual"></label>' +
          '<button type="submit">Ajustar existencia</button></form>' +
        '<p class="muted small" style="margin:.6rem 0 0">Las entradas recalculan el costo promedio y apartan lo que esté pendiente en OTs abiertas.</p></section>' +
      '<section class="panel"><div class="panel-head"><h3>Diésel · tanque del rancho</h3><span class="muted small">Capacidad ' + n1(CAP_DIESEL) + ' L</span></div>' +
        '<div class="facts"><div><span class="label">Existencia</span><span class="num" style="font-size:1.3rem;font-weight:600">' + n1(dsl.exist) + ' L</span></div><div><span class="label">Costo promedio</span><span class="num">' + money(dsl.costo) + '/L</span></div><div><span class="label">Valor</span><span class="num">' + money0(dsl.exist * dsl.costo) + '</span></div></div>' +
        '<div class="level" style="margin:.9rem 0 .25rem;height:.7rem"><span class="f f-' + (dsl.exist < REORDEN_DIESEL ? 'bad' : 'ok') + '" style="width:' + Math.min(100, 100 * dsl.exist / CAP_DIESEL).toFixed(1) + '%"></span><span class="m" style="left:' + (100 * REORDEN_DIESEL / CAP_DIESEL) + '%"></span></div>' +
        '<span class="muted small">La marca es el punto de reorden (' + n1(REORDEN_DIESEL) + ' L).</span>' +
        '<form id="tl-form-pipa" class="form-grid sub"><span class="label span">Entrada de pipa</span>' +
          '<label class="field"><span>Litros</span><input id="tl-p-l" type="number" min="0" step="1" placeholder="2000"></label>' +
          '<label class="field"><span>Precio por litro</span><input id="tl-p-u" type="number" min="0" step="0.01" placeholder="' + dsl.costo.toFixed(2) + '"></label>' +
          '<button class="primary" type="submit">Registrar pipa</button></form>' +
        ((S.pipas || []).length ? '<div class="table-wrap" style="margin-top:.6rem"><table><tbody>' + S.pipas.slice(-3).reverse().map(function (x) { return '<tr><td class="num">' + fFechaHora(x.fecha) + '</td><td class="r num">' + n1(x.litros) + ' L</td><td class="r num">' + money(x.precio) + '/L</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '</section>' +
    '</div>' +
    '<section class="panel" id="tl-kardex"><div class="panel-head"><h3>Kardex' + (kp ? ' · ' + esc(prod(kp).desc) : '') + '</h3>' +
      '<select id="tl-alm-kprod" style="width:auto" aria-label="Producto del kardex"><option value="">Todos los productos</option>' + S.productos.map(function (p) { return '<option value="' + p.id + '"' + (p.id === kp ? ' selected' : '') + '>' + esc(p.desc) + '</option>'; }).join('') + '</select></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Producto</th><th class="r">Cantidad</th><th class="r">Costo unit.</th><th class="r">Importe</th><th>Referencia</th></tr></thead><tbody>' +
      movs.map(function (m) { var p = prod(m.p), v = m.tipo === 'SALIDA' ? -m.cant : m.cant, ot = S.ots.find(function (o) { return o.folio === m.ref; });
        return '<tr><td class="num">' + fFechaHora(m.fecha) + '</td><td>' + pill(MOV[m.tipo]) + '</td><td>' + esc(p.desc) + '</td><td class="r num">' + (v > 0 ? '+' : '') + n1(v) + ' ' + p.u + '</td><td class="r num">' + money(m.costo) + '</td><td class="r num">' + money0(Math.abs(m.cant) * m.costo) + '</td>' +
          '<td>' + (ot ? '<button class="small" data-act="ver-ot" data-id="' + ot.id + '">' + esc(m.ref) + '</button> <span class="eco">' + esc(eqp(ot.eq).eco) + '</span>' : esc(m.ref)) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="small muted" style="margin:.6rem 0 0">' + (kp ? 'Saldo actual: <b class="num">' + n1(prod(kp).exist) + ' ' + prod(kp).u + '</b>. ' : 'Últimos 14 movimientos. ') + 'Cada salida lleva la OT y el equipo al que se cargó el costo.</p></section>';
  }

  function vistaKpis() {
    var PER = periodos(), per = PER.some(function (p) { return p[0] === S.ui.kpiPer; }) ? S.ui.kpiPer : 'todo', k = kpis(per);
    var maxH = Math.max.apply(null, [1].concat(k.filas.map(function (f) { return f.porH; })));
    var maxM = Math.max.apply(null, [1].concat(k.meses.map(function (m) { return Math.max(m.prev, m.corr); })));
    var maxSis = Math.max.apply(null, [1].concat(k.porSis.map(function (x) { return x[1].costo; }))), maxCau = Math.max.apply(null, [1].concat(k.porCausa.map(function (x) { return x[1].costo; })));
    var h1 = function (v) { return v === null ? '—' : n1(v); };
    var pctCorr = k.costoCorr + k.costoPrev ? Math.round(100 * k.costoCorr / (k.costoCorr + k.costoPrev)) : 0;
    var pct = function (a, b) { return b ? Math.round(100 * a / b) : 0; };
    var peor = k.filas.filter(function (f) { return veredicto(f, k)[1] === 'bad'; })[0];
    var barras = function (arr, max) { return arr.length ? arr.map(function (x) { return '<div class="bar wide"><span class="small">' + esc(x[0]) + '</span><span class="track"><span class="fill ' + (x[1].imp ? 'bad' : '') + '" style="width:' + (100 * x[1].costo / max).toFixed(1) + '%"></span></span><span class="num small">' + x[1].n + ' · ' + money0(x[1].costo) + '</span></div>'; }).join('') : '<div class="empty">Sin fallas en el periodo.</div>'; };
    return '' +
    '<section class="panel intro"><div style="display:grid;gap:.3rem;max-width:74ch"><h3>Costos y KPIs de maquinaria</h3>' +
      '<p class="muted small" style="margin:0">Todo sale de lo que ya se captura: órdenes cerradas (refacciones y mano de obra), cargas de diésel y bitácoras de campo. Sirve para decidir qué tractor reparar, cuál vigilar y cuál reemplazar.</p>' +
      (peor ? '<p class="small" style="margin:0"><b>' + esc(peor.e.eco) + '</b> gasta ' + money0(peor.mantH) + '/h en mantenimiento, ' + (peor.mantH / (k.mantH || 1)).toFixed(1) + ' veces el promedio de la flota, con ' + peor.nCorr + ' fallas en el periodo.</p>' : '') + '</div>' +
      '<label class="field" style="min-width:200px"><span>Periodo</span><select id="tl-kpi-per">' + PER.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === per ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></label></section>' +
    '<section class="kpis" aria-label="Indicadores de la flota">' +
      '<div class="kpi"><span class="label">Costo total</span><span class="v">' + money0(k.total) + '</span><span class="s">Diésel ' + pct(k.comb, k.total) + '% · mantenimiento ' + pct(k.ref + k.mo, k.total) + '%</span></div>' +
      '<div class="kpi"><span class="label">Costo por hora</span><span class="v">' + money0(k.porH) + '</span><span class="s">' + n1(k.horas) + ' h trabajadas · mant. ' + money0(k.mantH) + '/h</span></div>' +
      '<div class="kpi"><span class="label">Costo por hectárea</span><span class="v">' + (k.ha ? money0(k.porHa) : '—') + '</span><span class="s">' + n1(k.ha) + ' ha en labores de campo</span></div>' +
      '<div class="kpi ' + (k.disp < 95 ? 'alert' : '') + '"><span class="label">Disponibilidad mecánica</span><span class="v">' + k.disp.toFixed(1) + '%</span><span class="s">Tiempo fuera del taller, promedio por tractor</span></div>' +
      '<div class="kpi"><span class="label">MTBF</span><span class="v">' + h1(k.mtbf) + '</span><span class="s">Horas de operación entre fallas</span></div>' +
      '<div class="kpi"><span class="label">MTTR</span><span class="v">' + h1(k.mttr) + '</span><span class="s">Horas por reparación · ' + n1(k.espera) + ' h esperando refacción</span></div>' +
      '<div class="kpi ' + (k.cumpl !== null && k.cumpl < 80 ? 'alert' : '') + '"><span class="label">Cumplimiento preventivo</span><span class="v">' + (k.cumpl === null ? '—' : Math.round(k.cumpl) + '%') + '</span><span class="s">Servicios hechos antes de vencer' + (k.vencSinOT ? ' · ' + k.vencSinOT + ' vencido sin OT' : '') + '</span></div>' +
      '<div class="kpi ' + (pctCorr > 50 ? 'alert' : '') + '"><span class="label">Gasto en correctivo</span><span class="v">' + pctCorr + '%</span><span class="s">' + k.nCorr + ' correctivas · ' + k.nPrev + ' preventivas</span></div>' +
    '</section>' +
    '<section class="panel"><div class="panel-head"><h3>Costo por hora de cada tractor</h3><div class="legend"><span><i class="s1"></i>Refacciones</span><span><i class="s2"></i>Mano de obra</span><span><i class="s3"></i>Diésel</span></div></div>' +
      '<div class="bars">' + k.filas.map(function (f) { var w = function (v) { return f.horas ? (100 * v / f.horas / maxH).toFixed(2) : 0; }, ph = function (v) { return money0(f.horas ? v / f.horas : 0); };
        return '<div class="bar stackbar"><span class="eco">' + esc(f.e.eco) + '</span><span class="stack" role="img" aria-label="' + esc(f.e.eco) + ': refacciones ' + ph(f.ref) + ', mano de obra ' + ph(f.mo) + ', diésel ' + ph(f.comb) + ' por hora">' +
          '<span class="s1" style="width:' + w(f.ref) + '%" title="Refacciones ' + ph(f.ref) + '/h"></span><span class="s2" style="width:' + w(f.mo) + '%" title="Mano de obra ' + ph(f.mo) + '/h"></span><span class="s3" style="width:' + w(f.comb) + '%" title="Diésel ' + ph(f.comb) + '/h"></span></span>' +
          '<span class="num small" style="text-align:right">' + money0(f.porH) + '/h</span></div>'; }).join('') + '</div>' +
      '<div class="table-wrap" style="margin-top:1rem"><table><thead><tr><th>Equipo</th><th class="r">Horas</th><th class="r">ha</th><th class="r">L/h</th><th class="r">Diésel</th><th class="r">Refacciones</th><th class="r">Mano obra</th><th class="r">Total</th><th class="r">$/h</th><th class="r">Mant./h</th><th class="r">$/ha</th><th class="r">Disp.</th><th class="r">Fallas</th><th class="r">MTBF</th><th class="r">MTTR</th><th>Lectura</th></tr></thead><tbody>' +
      k.filas.map(function (f) { return '<tr><td class="eco">' + esc(f.e.eco) + '<br><span class="muted small" style="font-weight:400">' + esc(S.modelos[f.e.modelo]) + '</span></td>' +
        '<td class="r num">' + n1(f.horas) + '</td><td class="r num">' + n1(f.ha) + '</td><td class="r num">' + (f.lph ? f.lph.toFixed(1) : '—') + '</td><td class="r num">' + money0(f.comb) + '</td><td class="r num">' + money0(f.ref) + '</td><td class="r num">' + money0(f.mo) + '</td><td class="r num" style="font-weight:600">' + money0(f.total) + '</td>' +
        '<td class="r num">' + money0(f.porH) + '</td><td class="r num">' + money0(f.mantH) + '</td><td class="r num">' + (f.ha ? money0(f.porHa) : '—') + '</td><td class="r num">' + f.disp.toFixed(1) + '%</td><td class="r num">' + f.nCorr + '</td><td class="r num">' + h1(f.mtbf) + '</td><td class="r num">' + h1(f.mttr) + '</td><td>' + pill(veredicto(f, k)) + '</td></tr>'; }).join('') +
      '<tr><td><b>Flota</b></td><td class="r num"><b>' + n1(k.horas) + '</b></td><td class="r num"><b>' + n1(k.ha) + '</b></td><td></td><td class="r num"><b>' + money0(k.comb) + '</b></td><td class="r num"><b>' + money0(k.ref) + '</b></td><td class="r num"><b>' + money0(k.mo) + '</b></td><td class="r num"><b>' + money0(k.total) + '</b></td><td class="r num"><b>' + money0(k.porH) + '</b></td><td class="r num"><b>' + money0(k.mantH) + '</b></td><td class="r num"><b>' + (k.ha ? money0(k.porHa) : '—') + '</b></td><td class="r num"><b>' + k.disp.toFixed(1) + '%</b></td><td class="r num"><b>' + k.nCorr + '</b></td><td class="r num"><b>' + h1(k.mtbf) + '</b></td><td class="r num"><b>' + h1(k.mttr) + '</b></td><td></td></tr>' +
      '</tbody></table></div></section>' +
    '<div class="grid-2">' +
      '<section class="panel"><div class="panel-head"><h3>Gasto de mantenimiento por mes</h3><div class="legend"><span><i class="lp"></i>Preventivo</span><span><i class="lc"></i>Correctivo</span></div></div>' +
        '<div class="cols" style="grid-template-columns:repeat(' + Math.max(1, k.meses.length) + ',minmax(0,1fr))">' + k.meses.map(function (m) { return '<div class="col"><div class="pair" role="img" aria-label="' + m.nom + ': preventivo ' + money0(m.prev) + ', correctivo ' + money0(m.corr) + '">' +
          '<span class="lp" style="height:' + (100 * m.prev / maxM).toFixed(1) + '%" title="Preventivo ' + money0(m.prev) + '"></span><span class="lc" style="height:' + (100 * m.corr / maxM).toFixed(1) + '%" title="Correctivo ' + money0(m.corr) + '"></span></div>' +
          '<span class="lbl"><b>' + m.nom.slice(0, 3) + '</b><br><span class="num">' + money0(m.prev) + '</span><br><span class="num">' + money0(m.corr) + '</span></span></div>'; }).join('') + '</div>' +
        '<p class="muted small" style="margin:.8rem 0 0">Por mes de recepción de la orden. La meta es que el correctivo baje conforme se cumple el preventivo.</p></section>' +
      '<section class="panel"><div class="panel-head"><h3>¿En qué se va el correctivo?</h3><span class="muted small">Número de fallas · costo</span></div>' +
        '<div class="grp"><span class="label">Por sistema</span><div class="bars">' + barras(k.porSis.map(function (x) { return [x[0], Object.assign({}, x[1], { imp: false })]; }), maxSis) + '</div></div>' +
        '<div class="grp"><span class="label">Por causa</span><div class="bars">' + barras(k.porCausa, maxCau) + '</div></div>' +
        '<p class="muted small" style="margin:.8rem 0 0">En rojo, causas atribuibles al operador (mal uso, sobrecarga, no revisar).</p></section>' +
    '</div>' +
    '<div class="grid-2">' +
      '<section class="panel"><div class="panel-head"><h3>Costo por lote</h3><span class="muted small">$/ha solo con labores medidas en hectáreas</span></div>' +
        (k.lotes.length ? '<div class="table-wrap"><table><thead><tr><th>Lote</th><th>Labores</th><th class="r">Horas</th><th class="r">ha</th><th class="r">Costo</th><th class="r">$/ha</th></tr></thead><tbody>' +
          k.lotes.map(function (x) { var L = x[1]; return '<tr><td>' + esc(x[0]) + '</td><td class="small">' + esc(Array.from(L.labores).join(', ')) + '</td><td class="r num">' + n1(L.horas) + '</td><td class="r num">' + n1(L.ha) + '</td><td class="r num">' + money0(L.costo) + '</td><td class="r num">' + (L.ha ? money0(L.costoHa / L.ha) : '—') + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : '<div class="empty">Sin bitácoras en el periodo.</div>') + '</section>' +
      '<section class="panel"><div class="panel-head"><h3>Tiempo fuera de servicio por falla</h3><span class="muted small">Recepción → liberación</span></div>' +
        (k.paros.length ? '<div class="table-wrap"><table><thead><tr><th>OT</th><th>Equipo</th><th>Causa</th><th class="r">Horas paradas</th><th class="r">Esperando refacción</th></tr></thead><tbody>' +
          k.paros.map(function (x) { return '<tr><td><button class="small" data-act="ver-ot" data-id="' + x.o.id + '">' + esc(x.o.folio) + '</button></td><td class="eco">' + esc(eqp(x.o.eq).eco) + '</td><td class="small">' + esc(x.o.fallas.map(function (f) { return causa(f.causa)[1]; }).join(', ') || '—') + '</td><td class="r num">' + n1(x.h) + '</td>' +
            '<td class="r">' + (x.esp ? pill([n1(x.esp) + ' h · ' + pct(x.esp, x.h) + '%', x.esp / x.h > 0.4 ? 'bad' : 'warn']) : '<span class="muted">—</span>') + '</td></tr>'; }).join('') +
          '</tbody></table></div><p class="muted small" style="margin:.6rem 0 0">Cuando la espera de refacción pesa más que la reparación, conviene subir el mínimo de esa pieza en Almacén.</p>' : '<div class="empty">Sin correctivas en el periodo.</div>') + '</section>' +
    '</div>';
  }

  // Automatización: hilo estilo assistant-ui (Thread · Message · Composer · Suggestions) + avisos al jefe + reglas.
  function btnDis(b, i, n) {
    var r = S.requisiciones.find(function (x) { return x.folio === b[2]; }) || {};
    if (b[1] === 'req-aprobar') return r.estatus !== 'PENDIENTE';
    if (b[1] === 'req-recibir') return r.estatus !== 'APROBADA';
    if (b[1].indexOf('chk-') === 0) return i !== n - 1;
    return false;
  }
  function sugerencias(op) {
    var e = eqp(eqDeOp(op)), ult = S.bitacora.filter(function (b) { return b.op === op; }).slice(-1)[0], lab = ult ? ult.labor : 'Rastreo';
    return [
      ['Checklist', 'antes de arrancar', 'checklist'],
      ['Jornada', 'horómetro, labor y lote', e.eco + ' terminé, horómetro ' + (e.horas + 8.5).toFixed(1) + ', ' + lab.toLowerCase() + ' lote 2, ' + (lab === 'Acarreo' ? '12 viajes' : '14 ha')],
      ['Diésel', 'carga del tanque', 'Cargué 150 litros al ' + e.eco],
      ['Falla', 'directo al taller', 'El ' + e.eco + ' está tirando aceite del levante, quedó parado']
    ];
  }
  function burbuja(m, i, arr) {
    var btns = (m.btns || []).map(function (b) {
      var dis = btnDis(b, i, arr.length);
      return '<button type="button" data-act="' + b[1] + '" data-id="' + esc(b[2]) + '"' + (dis ? ' disabled' : '') + '>' + esc(b[0]) + '</button>';
    }).join('');
    var yo = m.de === 'yo';
    var meta = m.meta && m.meta.agente ? '<span class="aui-meta">' + esc(m.meta.agente) + (m.meta.modelo ? ' · ' + esc(m.meta.modelo) : '') + '</span>' : m.meta && m.meta.error ? '<span class="aui-meta warn">respaldo local</span>' : '';
    return '<div class="aui-msg ' + (yo ? 'user' : 'asst') + '">' + (yo ? '' : '<span class="aui-av" aria-hidden="true">AT</span>') +
      '<div class="aui-body"><div class="aui-bubble">' + fmt(m.txt) + '</div>' + (btns ? '<div class="aui-actions">' + btns + '</div>' : '') +
      '<div class="aui-foot"><span>' + esc(m.t.slice(11, 16)) + '</span>' + meta + (yo ? '' : '<button type="button" class="aui-copy" data-act="copiar" data-i="' + i + '" title="Copiar">Copiar</button>') + '</div></div></div>';
  }
  function vistaAuto() {
    probarAgente(false);
    var op = S.wa.op, e = eqp(eqDeOp(op)), msgs = chatOp(op);
    var sug = sugerencias(op).map(function (x) { return x[2]; });
    var conAui = !!(typeof window !== 'undefined' && window.__tallerChat);
    if (!conAui) ensureChatLib();
    var modo = usaAgente();
    var est = AG.estado === 'en-linea' ? ['Agente en línea', 'ok'] : AG.estado === 'fuera' ? ['Agente fuera de línea', 'warn'] : ['Probando agente…', 'plain'];
    return '' +
    '<section class="panel intro"><div style="display:grid;gap:.3rem;max-width:72ch"><h3>Automatización · asistente del taller</h3>' +
      '<p class="muted small" style="margin:0">El operador escribe como le escribiría al jefe de taller. ' + (modo ? 'Responde el <b>agente</b> (servicio <span class="mono">agents/</span>).' : 'Responden las <b>reglas locales</b>: registran la jornada, el diésel o la falla y abren la OT. Todo se refleja en Tablero, Órdenes y Almacén.') + '</p></div>' +
      '<div class="row"><label class="field" style="min-width:190px"><span>Escribir como</span><select id="tl-chat-op">' + operadores().map(function (x) { return '<option value="' + x.id + '"' + (x.id === op ? ' selected' : '') + '>' + esc(x.nombre) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field" style="min-width:170px"><span>Responde</span><select id="tl-chat-modo"><option value="auto"' + (S.ui.chatModo === 'auto' ? ' selected' : '') + '>Automático</option><option value="agente"' + (S.ui.chatModo === 'agente' ? ' selected' : '') + '>Agente</option><option value="local"' + (S.ui.chatModo === 'local' ? ' selected' : '') + '>Reglas locales</option></select></label>' +
      '<span>' + pill(est) + ' <button class="small" data-act="ag-probar" title="' + esc(AG.url) + '">Reintentar</button></span></div></section>' +
    '<div class="auto-layout">' + (conAui ? '<div id="tl-aui-slot" class="aui-host"></div>' :
      '<section class="aui" aria-label="Chat del asistente del taller">' +
        '<header class="aui-head"><span class="aui-av" aria-hidden="true">AT</span><div><b>Asistente del taller</b><span class="small">' + esc(emp(op).nombre) + ' · ' + esc(e.eco) + (modo ? ' · agente' : ' · reglas locales') + '</span></div></header>' +
        '<div class="aui-viewport" aria-live="polite">' + msgs.map(burbuja).join('') + (ocupado ? '<div class="aui-msg asst"><span class="aui-av" aria-hidden="true">AT</span><div class="aui-body"><div class="aui-bubble aui-typing"><i></i><i></i><i></i></div></div></div>' : '') + '</div>' +
        '<div class="aui-suggest" aria-label="Sugerencias">' + sug.map(function (c) { return '<button type="button" data-act="chat-sug" data-txt="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
        '<form id="tl-form-chat" class="aui-composer"><input id="tl-chat-txt" placeholder="Escribe un mensaje…" autocomplete="off" aria-label="Mensaje"' + (ocupado ? ' disabled' : '') + '><button class="aui-send" type="submit" aria-label="Enviar"' + (ocupado ? ' disabled' : '') + '>↑</button></form>' +
      '</section>') +
      (conAui ? '<div id="tl-avisos-slot" class="aui-host"></div>' :
      '<section class="aui jefe" aria-label="Avisos al jefe de taller">' +
        '<header class="aui-head"><span class="aui-av" aria-hidden="true">JT</span><div><b>Avisos del taller</b><span class="small">' + esc(emp(1).nombre) + ' · Jefe de taller</span></div></header>' +
        '<div class="aui-viewport">' + S.wa.jefe.map(burbuja).join('') + '</div>' +
        '<div class="aui-foot-note small muted">Lo que le llega al jefe de taller, sin que nadie lo capture</div>' +
      '</section>') +
      '<div class="auto-side">' +
        '<section class="panel"><div class="panel-head"><h3>Reglas activas</h3><span class="muted small">Veces que se dispararon</span></div>' +
          '<div class="reglas">' + REGLAS.map(function (r) { return '<div class="regla"><div><b>' + esc(r[1]) + '</b><span class="muted">Cuando: ' + esc(r[2]) + '.<br>Hace: ' + esc(r[3]) + '.</span></div>' + pill([String(S.wa.cont[r[0]] || 0), S.wa.cont[r[0]] ? 'ok' : 'plain']) + '</div>'; }).join('') + '</div></section>' +
        '<section class="panel"><div class="panel-head"><h3>Reporte semanal</h3><span class="muted small">Lunes 7:00 · al dueño</span></div>' +
          '<div class="aui-bubble solo">' + fmt(reporteSemanal()) + '</div><button class="small" data-act="reporte" style="margin-top:.75rem">Copiar reporte</button></section>' +
      '</div>' +
    '</div>';
  }

  /* ================= navegación ================= */
  var VISTAS = { tablero: ['Tablero', vistaTablero], ordenes: ['Órdenes de trabajo', vistaOrdenes], almacen: ['Almacén', vistaAlmacen], kpis: ['Costos y KPIs', vistaKpis], auto: ['Automatización', vistaAuto] };
  function inner() {
    syncGps(); syncReqs();
    var v = VISTAS[S.ui.tab] ? S.ui.tab : 'tablero';
    var cuenta = { tablero: S.reportes.filter(function (r) { return r.estatus === 'ABIERTO'; }).length, ordenes: S.ots.filter(abierta).length, almacen: pendientesSurtir().length, auto: S.requisiciones.filter(function (r) { return r.estatus === 'PENDIENTE'; }).length };
    var html = '<div class="tl-top"><div class="tl-brand"><h2>Taller</h2><span class="tag">Datos de ejemplo</span></div>' +
      '<nav class="tl-tabs" role="tablist" aria-label="Vistas del taller">' + Object.keys(VISTAS).map(function (k) {
        var n = cuenta[k] || 0;
        return '<button type="button" role="tab" data-act="tab" data-tab="' + k + '" aria-selected="' + (k === v) + '">' + VISTAS[k][0] + (n ? '<span class="badge-n">' + n + '</span>' : '') + '</button>';
      }).join('') + '</nav><button type="button" class="small" data-act="reset">Reiniciar demo</button></div>' +
      '<div class="tl-view">' + VISTAS[v][1]() + '</div>';
    save();
    return html;
  }
  function pageHtml() { load(); setTimeout(function () { attachChat(); notify(); }, 0); return '<div class="tl" id="tl-root">' + inner() + '</div>'; }
  function render() {
    var r = document.getElementById('tl-root'); if (!r) return;
    // El chat de assistant-ui (React) vive en un nodo propio que se saca y se vuelve a poner: así no pierde estado, scroll ni foco.
    var vps = [chatHost, avisosHost].map(function (h) { var v = h && h.querySelector('.tlc-viewport'); return [v, v ? v.scrollTop : 0]; });
    var tenia = chatHost && chatHost.contains(document.activeElement);
    r.innerHTML = inner();
    r.querySelectorAll('.aui-viewport').forEach(function (l) { l.scrollTop = l.scrollHeight; });
    if (attachChat()) {
      vps.forEach(function (x) { if (x[0]) x[0].scrollTop = x[1]; });
      if (tenia || foco) { var ta = chatHost.querySelector('textarea'); if (ta) ta.focus({ preventScroll: true }); }
    } else {
      var t = document.getElementById('tl-chat-txt'); if (foco && t && !t.disabled) t.focus({ preventScroll: true });
    }
    foco = false;
    notify();
  }

  /* ================= puente con el chat de assistant-ui (taller-chat.js) ================= */
  var chatHost = null, avisosHost = null, chatLib = 'sin-cargar', subs = [], snap = null, snapAv = null;
  function ensureChatLib() {
    if (chatLib !== 'sin-cargar' || window.__tallerChat) return;
    chatLib = 'cargando';
    var sc = document.createElement('script');
    sc.src = '/assets/taller-chat.js'; sc.async = true;
    sc.onload = function () { chatLib = 'lista'; if (S.ui.tab === 'auto') render(); };
    sc.onerror = function () { chatLib = 'error'; }; // se queda el chat en HTML
    document.head.appendChild(sc);
  }
  function attachChat() {
    var slot = document.getElementById('tl-aui-slot');
    if (!slot || !window.__tallerChat) return false;
    if (!chatHost) { chatHost = document.createElement('div'); chatHost.className = 'aui-host'; window.__tallerChat.mount(chatHost, api.chat); }
    slot.replaceWith(chatHost);
    var sa = document.getElementById('tl-avisos-slot');
    if (sa && window.__tallerChat.mountAvisos) {
      if (!avisosHost) { avisosHost = document.createElement('div'); avisosHost.className = 'aui-host'; window.__tallerChat.mountAvisos(avisosHost, api.chat); }
      sa.replaceWith(avisosHost);
    }
    return true;
  }
  function notify() { snap = null; snapAv = null; subs.slice().forEach(function (f) { try { f(); } catch (e) { /* un suscriptor no tumba a los demás */ } }); }
  function chatSnap() {
    if (snap) return snap;
    var op = S.wa.op, e = eqp(eqDeOp(op)), msgs = chatOp(op);
    snap = {
      op: op, operador: emp(op).nombre, eco: e.eco, ocupado: ocupado, modo: usaAgente() ? 'agente' : 'local',
      agente: AG.estado, agenteUrl: AG.url,
      sugerencias: sugerencias(op).map(function (x) { return { titulo: x[0], nota: x[1], texto: x[2] }; }),
      mensajes: msgs.map(function (m, i) {
        return { id: op + '-' + i, i: i, rol: m.de === 'yo' ? 'user' : 'assistant', texto: m.txt, hora: m.t.slice(11, 16), fecha: m.t,
          agente: m.meta && m.meta.agente ? m.meta.agente + (m.meta.modelo ? ' · ' + m.meta.modelo : '') : '', respaldo: !!(m.meta && m.meta.error),
          botones: (m.btns || []).map(function (b) { return { texto: b[0], act: b[1], id: b[2], deshabilitado: btnDis(b, i, msgs.length) }; }) };
      })
    };
    return snap;
  }
  function avisosSnap() {
    if (snapAv) return snapAv;
    var msgs = S.wa.jefe;
    snapAv = {
      jefe: emp(1).nombre, pendientes: S.requisiciones.filter(function (r) { return r.estatus === 'PENDIENTE'; }).length,
      mensajes: msgs.map(function (m, i) {
        return { id: 'jefe-' + i, i: i, rol: 'assistant', texto: m.txt, hora: m.t.slice(11, 16), fecha: m.t, dia: fFecha(m.t), agente: '', respaldo: false,
          botones: (m.btns || []).map(function (b) { return { texto: b[0], act: b[1], id: b[2], deshabilitado: btnDis(b, i, msgs.length) }; }) };
      })
    };
    return snapAv;
  }
  function accion(act, id) {
    if (act === 'ver-ot') { S.ui.otSel = +id; ir('ordenes'); return; }
    if (act === 'chk-ok' || act === 'chk-falla') chatCheck(act, +id);
    else if (act === 'req-aprobar') aprobarReq(id);
    else if (act === 'req-recibir') recibirReq(id);
    else return;
    render();
  }
  api.chat = {
    snapshot: chatSnap,
    avisos: avisosSnap,
    subscribe: function (f) { subs.push(f); return function () { subs = subs.filter(function (x) { return x !== f; }); }; },
    send: function (txt) { return enviar(String(txt || '').trim()); },
    action: accion,
    copiado: function () { toast('Copiado'); }
  };
  function ir(tab) { S.ui.tab = tab; render(); var r = document.getElementById('tl-root'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'start' }); }
  function copiar(txt) {
    try { navigator.clipboard.writeText(txt).then(function () { toast('Copiado'); }, function () { toast('No se pudo copiar'); }); } catch (e) { toast('No se pudo copiar'); }
  }

  /* ================= eventos (delegados, solo dentro de .tl) ================= */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('#tl-root [data-act]');
    if (!b || b.tagName === 'SELECT' || (b.tagName === 'INPUT' && b.type !== 'checkbox')) return;
    var act = b.dataset.act, o = otById(S.ui.otSel);
    switch (act) {
      case 'tab': ir(b.dataset.tab); return;
      case 'reset': if (!confirm('¿Reiniciar el taller con los datos de ejemplo? Se pierde lo capturado.')) return; S = seed(); toast('Taller reiniciado con los datos de ejemplo'); break;
      case 'ot-desde-reporte': { var r = S.reportes.find(function (x) { return x.id === +b.dataset.id; }); var n = abrirOT({ eq: r.eq, tipo: 'CORRECTIVA', reporteId: r.id, prioridad: r.detenido ? 'URGENTE' : 'ALTA' }); toast(n.folio + ' abierta para ' + eqp(r.eq).eco); ir('ordenes'); return; }
      case 'ot-preventiva': { var n2 = abrirOT({ eq: +b.dataset.eq, tipo: 'PREVENTIVA', planId: +b.dataset.plan }); toast(n2.folio + ' abierta. Se cargaron las tareas y se apartó el kit.'); ir('ordenes'); return; }
      case 'ver-ot': S.ui.otSel = +b.dataset.id; if (S.ui.tab !== 'ordenes') { ir('ordenes'); return; } break;
      case 'nueva-ot': S.ui.nuevaOT = true; S.ui.nuevaEq = S.ui.nuevaEq || 1; break;
      case 'cerrar-nueva': S.ui.nuevaOT = false; break;
      case 'estatus': if (cambiarEstatus(o, b.dataset.st)) toast(o.folio + ': ' + ESTATUS_OT[b.dataset.st][0].toLowerCase()); break;
      case 'tarea': o.tareas[+b.dataset.i][1] = b.checked; break;
      case 'surtir': surtir(o, +b.dataset.i); if (!o.error) toast('Salida de almacén registrada'); break;
      case 'add-ref': { var c = parseFloat($('#tl-r-cant').value); if (!(c > 0)) { o.error = 'Captura una cantidad mayor a cero.'; break; } reservar(o, +$('#tl-r-prod').value, c); o.error = ''; break; }
      case 'add-mano': { var h = parseFloat($('#tl-m-horas').value); if (!(h > 0)) { o.error = 'Captura las horas trabajadas.'; break; } var m = emp(+$('#tl-m-emp').value); o.mano.push({ emp: m.id, horas: h, costo: m.costo }); o.error = ''; break; }
      case 'add-falla': o.fallas.push({ sis: $('#tl-f-sis').value, causa: $('#tl-f-causa').value }); o.error = ''; break;
      case 'diag': { var d = $('#tl-diag').value.trim(); if (d) o.diagnostico = d; break; }
      case 'chat-sug': enviar(b.dataset.txt); return;
      case 'chk-ok': case 'chk-falla': chatCheck(act, +b.dataset.id); break;
      case 'req-aprobar': aprobarReq(b.dataset.id); break;
      case 'req-recibir': recibirReq(b.dataset.id); break;
      case 'alm-surtir': { var x = otById(+b.dataset.ot); surtir(x, +b.dataset.i); toast(x.error || 'Salida registrada a la ' + x.folio); x.error = ''; break; }
      case 'alm-pedir': pedirManual(+b.dataset.id); break;
      case 'alm-kardex': S.ui.almKardex = +b.dataset.id; render(); { var k = document.getElementById('tl-kardex'); if (k) k.scrollIntoView({ block: 'start' }); } return;
      case 'ag-probar': probarAgente(true); render(); return;
      case 'copiar': { var msg = chatOp(S.wa.op)[+b.dataset.i]; if (msg) copiar(msg.txt.replace(/\*/g, '')); return; }
      case 'reporte': copiar(reporteSemanal().replace(/\*/g, '')); return;
      default: return;
    }
    render();
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t.closest || !t.closest('#tl-root')) return;
    if (t.dataset && t.dataset.gps) { var e = eqp(+t.dataset.gps); e.deviceId = t.value === '' ? null : (isNaN(+t.value) ? t.value : +t.value); var hg = horasGps(e.deviceId); toast(e.eco + (e.deviceId == null ? ' sin rastreador' : ' vinculado' + (hg !== null ? ' · GPS ' + n1(hg) + ' h' : ' (el GPS aún no reporta horas de motor)'))); render(); return; }
    var id = t.id;
    if (id === 'tl-ot-filtro') S.ui.otFiltro = t.value;
    else if (id === 'tl-n-eq') S.ui.nuevaEq = +t.value;
    else if (id === 'tl-chat-op') S.wa.op = +t.value;
    else if (id === 'tl-chat-modo') { S.ui.chatModo = t.value; if (t.value !== 'local') probarAgente(true); }
    else if (id === 'tl-alm-cat') S.ui.almCat = t.value;
    else if (id === 'tl-alm-bajo') S.ui.almBajo = t.checked;
    else if (id === 'tl-alm-kprod') S.ui.almKardex = +t.value || 0;
    else if (id === 'tl-kpi-per') S.ui.kpiPer = t.value;
    else return;
    render();
  });
  document.addEventListener('submit', function (ev) {
    var f = ev.target; if (!f.closest || !f.closest('#tl-root')) return;
    ev.preventDefault();
    if (f.id === 'tl-form-chat') { var v = $('#tl-chat-txt').value.trim(); if (v) enviar(v); return; }
    if (f.id === 'tl-form-ot') {
      var eq = +$('#tl-n-eq').value, tipo = $('#tl-n-tipo').value, rep = $('#tl-n-rep') ? +$('#tl-n-rep').value || null : null;
      var falla = $('#tl-n-falla').value.trim(), planSel = $('#tl-n-plan') ? +$('#tl-n-plan').value : null;
      if (tipo === 'PREVENTIVA' && S.ots.some(function (o) { return o.eq === eq && abierta(o) && o.plan === planSel; })) { $('#tl-n-err').textContent = 'Ese equipo ya tiene una preventiva abierta de ese plan.'; return; }
      if (tipo === 'CORRECTIVA' && !falla && !rep) { $('#tl-n-err').textContent = 'Describe la falla o elige un reporte.'; return; }
      var o = abrirOT({ eq: eq, tipo: tipo, planId: tipo === 'PREVENTIVA' ? planSel : null, reporteId: rep, falla: falla, prioridad: $('#tl-n-prio').value });
      toast(o.folio + ' abierta');
    }
    if (f.id === 'tl-form-ent') {
      var pid = +$('#tl-e-p').value, c = parseFloat($('#tl-e-c').value), pu = parseFloat($('#tl-e-u').value);
      if (!(c > 0)) return toast('Captura la cantidad que entra.');
      var ap = entradaAlmacen(pid, c, pu >= 0 ? pu : prod(pid).costo, $('#tl-e-r').value.trim() || 'Compra directa');
      toast('Entrada registrada' + (ap.length ? '. Se apartó ' + ap.join(', ') : ''));
    }
    if (f.id === 'tl-form-aju') {
      var p = prod(+$('#tl-a-p').value), cc = parseFloat($('#tl-a-c').value), mot = $('#tl-a-m').value.trim();
      if (!(cc >= 0)) return toast('Captura el conteo real.');
      if (!mot) return toast('Escribe el motivo del ajuste.');
      if (cc < p.res) return toast('No puede quedar menos de lo apartado para OTs (' + n1(p.res) + ' ' + p.u + ').');
      var d = cc - p.exist; if (!d) return toast('El conteo coincide con el sistema.');
      p.exist = cc; S.movs.push({ fecha: ahora(), tipo: 'AJUSTE', p: p.id, cant: d, costo: p.costo, ref: mot });
      if (d < 0) notificar('warn', 'Faltante en conteo: ' + p.desc, n1(-d) + ' ' + p.u + ' menos que en sistema (' + money0(-d * p.costo) + '). Motivo: ' + mot + '.');
      toast('Ajuste de ' + (d > 0 ? '+' : '') + n1(d) + ' ' + p.u + ' en ' + p.desc);
    }
    if (f.id === 'tl-form-pipa') {
      var l = parseFloat($('#tl-p-l').value), pu2 = parseFloat($('#tl-p-u').value) || S.diesel.costo;
      if (!(l > 0)) return toast('Captura los litros de la pipa.');
      if (S.diesel.exist + l > CAP_DIESEL) return toast('No caben: el tanque tiene espacio para ' + n1(CAP_DIESEL - S.diesel.exist) + ' L.');
      S.diesel.costo = (S.diesel.exist * S.diesel.costo + l * pu2) / (S.diesel.exist + l); S.diesel.exist += l;
      (S.pipas = S.pipas || []).push({ fecha: ahora(), litros: l, precio: pu2 });
      toast('Pipa registrada: ' + n1(l) + ' L a ' + money(pu2) + '/L');
    }
    render();
  });
  document.addEventListener('input', function (ev) {
    if (ev.target.id !== 'tl-alm-q') return;
    S.ui.almQ = ev.target.value; render();
    var i = document.getElementById('tl-alm-q'); if (i) { i.focus(); var n = i.value.length; try { i.setSelectionRange(n, n); } catch (e) { /* tipo search */ } }
  });

  /* ================= estilos (con #home-view delante: el marco Debian resetea márgenes con selectores de id) ================= */
  var css = document.createElement('style');
  var R = [
    '.tl{--surface:#fff;--surface-2:#eef0ec;--ink:#1d231f;--muted:#5b655e;--line:#d3d8cf;--accent:#23566a;--accent-ink:#fff;--ok:#2c7a4b;--warn:#9a6200;--bad:#b2362b;--data:ui-monospace,Menlo,Consolas,monospace;max-width:1320px;margin:0 auto;padding:6px 14px 34px;color:var(--ink);font-size:15px;line-height:1.5}',
    '.tl *{box-sizing:border-box}',
    '.tl h2,.tl h3{margin:0;font-family:inherit;font-weight:650;letter-spacing:-.005em}.tl h2{font-size:24px}.tl h3{font-size:1.05rem}.tl h3.big-h{font-size:1.3rem}',
    '.tl p{margin:0}.tl .mono,.tl .num{font-family:var(--data);font-variant-numeric:tabular-nums}.tl .muted{color:var(--muted)}.tl .small{font-size:.82rem}',
    '.tl .label{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600}.tl .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
    '.tl button,.tl select,.tl input,.tl textarea{font:inherit;color:inherit}',
    '.tl button{cursor:pointer;border:1px solid var(--line);background:var(--surface);border-radius:6px;padding:.4rem .8rem}.tl button:hover{border-color:var(--muted)}.tl button.small{padding:.25rem .6rem;font-size:.82rem}',
    '.tl button.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:600}.tl button.danger{color:var(--bad)}.tl button:disabled{opacity:.45;cursor:default}',
    '.tl button:focus-visible,.tl select:focus-visible,.tl input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
    '.tl select,.tl input:not([type=checkbox]),.tl textarea{background:var(--surface)!important;border:1px solid var(--line)!important;border-radius:6px;padding:.42rem .55rem;width:100%;min-width:0;color:var(--ink)!important}',
    '.tl label.field{display:grid;gap:.25rem;font-size:.85rem;color:var(--muted)}.tl label.field>span{font-weight:600}',
    '.tl-top{display:flex;align-items:center;gap:10px 16px;flex-wrap:wrap;margin:14px 0 14px}.tl-brand{display:flex;align-items:baseline;gap:.6rem;margin-right:auto}',
    '.tl .tag{font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:.1rem .45rem;border-radius:4px;background:#f4ead7;color:var(--warn)}',
    '.tl-tabs{display:flex;gap:6px;flex-wrap:wrap}.tl-tabs button{border-radius:99px;padding:6px 14px;font-weight:600;font-size:.88rem;background:transparent}',
    '.tl-tabs button[aria-selected=true]{background:#a80030;border-color:#a80030;color:#fff}',
    '.tl .badge-n{display:inline-block;min-width:1.2rem;text-align:center;font-size:.7rem;border-radius:999px;background:var(--bad);color:#fff;margin-left:.35rem;padding:0 .3rem}',
    '.tl-view{display:grid;gap:1.1rem}',
    '.tl .panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:1rem 1.1rem;min-width:0}',
    '.tl .panel-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin-bottom:.75rem}',
    '.tl .intro{display:flex;justify-content:space-between;align-items:end;gap:1rem;flex-wrap:wrap}',
    '.tl .grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:1.1rem}',
    '.tl .row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}.tl .row.nowrap{flex-wrap:nowrap;justify-content:flex-end}.tl .span{grid-column:1/-1}',
    '.tl .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem}',
    '.tl .kpi{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:.8rem .95rem;display:grid;gap:.15rem}',
    '.tl .kpi .v{font-size:1.8rem;font-weight:650;line-height:1.1;font-variant-numeric:tabular-nums}.tl .kpi .s{font-size:.8rem;color:var(--muted)}',
    '.tl .kpi.alert{border-color:#e2b3ad}.tl .kpi.alert .v{color:var(--bad)}',
    '.tl .pill{display:inline-flex;align-items:center;gap:.35rem;font-size:.78rem;font-weight:600;padding:.12rem .55rem;border-radius:999px;white-space:nowrap;background:var(--surface-2);color:var(--muted)}',
    '.tl .pill::before{content:"";width:.45rem;height:.45rem;border-radius:50%;background:currentColor}',
    '.tl .pill.p-ok{background:#e1efe6;color:var(--ok)}.tl .pill.p-warn{background:#f4ead7;color:var(--warn)}.tl .pill.p-bad{background:#f5e0de;color:var(--bad)}.tl .pill.p-info{background:#dde8ec;color:var(--accent)}.tl .pill.p-plain::before{display:none}',
    '.tl .table-wrap{overflow-x:auto}.tl table{width:100%;border-collapse:collapse;font-size:.9rem}',
    '.tl th{text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:600;padding:.45rem .5rem;border-bottom:1px solid var(--line);white-space:nowrap}',
    '.tl td{padding:.55rem .5rem;border-bottom:1px solid var(--line);vertical-align:middle}.tl tr:last-child td{border-bottom:none}.tl td.r,.tl th.r{text-align:right}',
    '.tl td select{min-width:130px;padding:.25rem .4rem;font-size:.82rem}',
    '.tl .eco{font-weight:700;letter-spacing:.02em;white-space:nowrap}',
    '.tl .bars{display:grid;gap:.55rem}.tl .bar{display:grid;grid-template-columns:4.5rem 1fr auto;gap:.6rem;align-items:center;font-size:.86rem}.tl .bar.wide{grid-template-columns:minmax(0,10rem) 1fr auto}.tl .bar.stackbar{grid-template-columns:4.5rem 1fr 5.5rem}',
    '.tl .bar .track{height:.6rem;background:var(--surface-2);border-radius:3px;overflow:hidden}.tl .bar .fill{display:block;height:100%;background:var(--accent);border-radius:3px}.tl .bar .fill.bad{background:var(--bad)}',
    '.tl .feed{display:grid;gap:.5rem}.tl .note{display:grid;grid-template-columns:auto 1fr auto;gap:.6rem;align-items:start;padding:.6rem .7rem;border-radius:8px;background:var(--surface-2);font-size:.88rem}',
    '.tl .note .dot{width:.55rem;height:.55rem;border-radius:50%;margin-top:.4rem;background:var(--accent)}.tl .note.urg .dot{background:var(--bad)}.tl .note.warn .dot{background:var(--warn)}.tl .note b{display:block}',
    '.tl .empty{padding:1rem;text-align:center;color:var(--muted);font-size:.9rem;border:1px dashed var(--line);border-radius:8px}',
    '.tl .ot-layout{display:grid;grid-template-columns:minmax(250px,320px) minmax(0,1fr);gap:1.1rem;align-items:start}.tl .ot-main{display:grid;gap:1.1rem;min-width:0}',
    '.tl .ot-list{display:grid;gap:.4rem;max-height:70vh;overflow:auto}',
    '.tl .ot-item{display:grid;gap:.2rem;text-align:left;padding:.65rem .75rem;border-radius:8px;width:100%}.tl .ot-item[aria-current=true]{border-color:var(--accent);box-shadow:inset 3px 0 0 var(--accent)}',
    '.tl .ot-item .top{display:flex;justify-content:space-between;gap:.5rem;align-items:center}',
    '.tl .steps{display:grid;grid-template-columns:repeat(5,1fr);gap:.3rem;margin:.25rem 0 1rem}.tl .step{font-size:.74rem;color:var(--muted);display:grid;gap:.3rem;text-align:center}',
    '.tl .step i{height:.35rem;border-radius:2px;background:var(--surface-2);display:block}.tl .step.done i{background:var(--ok)}.tl .step.now i{background:var(--warn)}.tl .step.now{color:var(--ink);font-weight:600}',
    '.tl .sub{display:grid;gap:.5rem;padding-top:.9rem;margin-top:.9rem;border-top:1px solid var(--line)}',
    '.tl .task{display:flex;align-items:center;gap:.6rem;font-size:.92rem}.tl .task input{width:1.1rem;height:1.1rem;accent-color:var(--ok)}',
    '.tl .error{color:var(--bad);font-size:.86rem;font-weight:600}',
    '.tl .facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.6rem 1rem}.tl .facts div{display:grid;gap:.1rem;justify-items:start}',
    '.tl .form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:.6rem;align-items:end}',
    '.tl .level{position:relative;height:.5rem;background:var(--surface-2);border-radius:3px;min-width:90px;margin-bottom:.15rem}',
    '.tl .level .f{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--ok)}.tl .level .f.f-warn{background:var(--warn)}.tl .level .f.f-bad{background:var(--bad)}.tl .level .f.f-info{background:var(--accent)}',
    '.tl .level .m{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ink)}',
    '.tl .stack{display:flex;height:.95rem;border-radius:3px;overflow:hidden;background:var(--surface-2)}.tl .stack span{height:100%}',
    '.tl .s1{background:var(--accent)}.tl .s2{background:var(--warn)}.tl .s3{background:#a9b1aa}.tl .lp{background:var(--ok)}.tl .lc{background:var(--bad)}',
    '.tl .legend{display:flex;gap:.9rem;flex-wrap:wrap;font-size:.8rem;color:var(--muted)}.tl .legend i{display:inline-block;width:.7rem;height:.7rem;border-radius:2px;margin-right:.35rem;vertical-align:-1px}',
    '.tl .cols{display:grid;gap:.75rem}.tl .col{display:flex;flex-direction:column;gap:.4rem;min-width:0}',
    '.tl .pair{height:170px;display:flex;align-items:flex-end;justify-content:center;gap:4px;border-bottom:1px solid var(--line)}.tl .pair span{width:32%;min-height:2px;border-radius:3px 3px 0 0}',
    '.tl .col .lbl{text-align:center;font-size:.74rem;color:var(--muted);line-height:1.35}.tl .col .lbl b{color:var(--ink);font-size:.82rem}',
    '.tl .grp{display:grid;gap:.5rem}.tl .grp+.grp{margin-top:1rem}',
    '.tl .reglas{display:grid;gap:.5rem}.tl .regla{display:grid;grid-template-columns:1fr auto;gap:.6rem;align-items:start;padding:.55rem .7rem;background:var(--surface-2);border-radius:8px;font-size:.84rem}.tl .regla b{display:block}',
    /* Automatización: hilo estilo assistant-ui */
    '.tl .auto-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,1fr);gap:1.1rem;align-items:start}.tl .auto-side{display:grid;gap:1.1rem;min-width:0}',
    '.tl .aui{display:flex;flex-direction:column;height:640px;min-width:0;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}',
    '.tl .aui-head{display:flex;gap:.65rem;align-items:center;padding:.75rem 1rem;border-bottom:1px solid var(--line)}.tl .aui-head div b,.tl .aui-head div span{display:block;line-height:1.25}.tl .aui-head div .small{color:var(--muted)}',
    '.tl .aui-av{width:2rem;height:2rem;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;font-weight:700;font-size:.7rem;flex:none}.tl .jefe .aui-av{background:var(--accent)}',
    '.tl .aui-viewport{flex:1;min-height:0;overflow-y:auto;padding:1rem .9rem;display:flex;flex-direction:column;gap:.9rem;background:#fafaf9}',
    '.tl .aui-msg{display:flex;gap:.55rem;align-items:flex-start;max-width:100%}.tl .aui-msg.user{justify-content:flex-end}.tl .aui-body{display:grid;gap:.3rem;max-width:85%;min-width:0}',
    '.tl .aui-bubble{padding:.55rem .8rem;border-radius:16px;font-size:.88rem;line-height:1.45;overflow-wrap:anywhere}',
    '.tl .aui-msg.asst .aui-bubble{background:var(--surface);border:1px solid var(--line);border-top-left-radius:4px}.tl .aui-msg.user .aui-bubble{background:var(--ink);color:#fff;border-top-right-radius:4px}',
    '.tl .aui-bubble.solo{background:var(--surface-2);border-radius:12px}',
    '.tl .aui-foot{display:flex;gap:.6rem;align-items:center;font-size:.7rem;color:var(--muted);font-family:var(--data)}.tl .aui-msg.user .aui-foot{justify-content:flex-end}',
    '.tl .aui-meta{padding:0 .4rem;border-radius:99px;background:var(--surface-2)}.tl .aui-meta.warn{color:var(--warn)}',
    '.tl .aui-copy{border:none!important;background:transparent!important;padding:0!important;font:inherit;color:var(--muted);opacity:0;transition:opacity .15s}.tl .aui-msg:hover .aui-copy,.tl .aui-copy:focus-visible{opacity:1}',
    '.tl .aui-actions{display:flex;flex-wrap:wrap;gap:.35rem}.tl .aui-actions button{border-radius:99px;font-size:.8rem;font-weight:600;padding:.25rem .75rem;color:var(--accent)}',
    '.tl .aui-typing{display:flex;gap:4px;padding:.7rem .9rem}.tl .aui-typing i{width:6px;height:6px;border-radius:50%;background:var(--muted);animation:tl-dot 1s infinite ease-in-out}.tl .aui-typing i:nth-child(2){animation-delay:.15s}.tl .aui-typing i:nth-child(3){animation-delay:.3s}',
    '.tl .aui-suggest{display:flex;gap:.4rem;overflow-x:auto;padding:.6rem .8rem 0;border-top:1px solid var(--line)}.tl .aui-suggest button{white-space:nowrap;font-size:.78rem;border-radius:99px;padding:.3rem .75rem;flex:none}',
    '.tl .aui-composer{display:flex;gap:.45rem;align-items:center;margin:.6rem .8rem .8rem;padding:.3rem .3rem .3rem .9rem;border:1px solid var(--line);border-radius:22px;background:var(--surface)}',
    '.tl .aui-composer input{border:none!important;padding:.35rem 0!important;background:transparent!important}.tl .aui-composer input:focus-visible{outline:none}.tl .aui-composer:focus-within{border-color:var(--accent)}',
    '.tl .aui-send{width:2.1rem;height:2.1rem;border-radius:50%!important;padding:0!important;background:var(--ink)!important;color:#fff!important;border:none!important;font-weight:700;flex:none}',
    '.tl .aui-foot-note{padding:.7rem;text-align:center;border-top:1px solid var(--line)}',
    '@media(max-width:1100px){\n.tl .auto-layout{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}\n.tl .auto-side{grid-column:1/-1}\n}',
    '@media(max-width:820px){\n.tl .ot-layout,.tl .auto-layout{grid-template-columns:minmax(0,1fr)}\n.tl .aui{height:560px}\n}',
    '@keyframes tl-dot{0%,80%,100%{opacity:.25}40%{opacity:1}}'
  ];
  css.textContent = R.map(function (r) {
    if (/^@keyframes/.test(r)) return r;
    return r.replace(/(^|[}\n])\s*([^{}@\n][^{}]*)\{/g, function (m, pre, sel) { return pre + sel.split(',').map(function (s) { return '#home-view ' + s.trim(); }).join(',') + '{'; });
  }).join('\n') +
    '\n.tl-toast{position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);background:#1d231f;color:#fff;padding:.65rem 1rem;border-radius:8px;font-size:.9rem;max-width:calc(100% - 32px);z-index:99999}';
  document.head.appendChild(css);

  api.pageHtml = pageHtml; api.render = render;
})();
