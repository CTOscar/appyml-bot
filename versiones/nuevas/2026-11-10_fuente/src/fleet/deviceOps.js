// Lógica de la ficha y los ajustes del tractor (portada del panel actual: «Operación del tractor» y «Ajustes del tractor»).
// Sin React ni red: se prueba en deviceOps.test.js.

/* ---------- ajustes del tractor ---------- */
// El código se guarda en mayúsculas (igual que el panel actual).
export const normalizeCode = (s) => String(s ?? '').trim().toUpperCase();

// Mensaje al fallar el guardado: 400 = el código ya existe en otro tractor.
export function saveErrorMessage(err) {
  return err?.status === 400 ? 'Ese código ya lo usa otro tractor.' : 'No se pudo guardar el tractor. Intenta de nuevo.';
}

// Mantenimiento preventivo. hoursMs = horómetro en milisegundos (Traccar), cada / ultimo en horas.
// Devuelve { kind: 'sin-horometro' | 'sin-ultimo' | 'ok' | 'warn' | 'crit', actual, faltan, pct, text }.
export function serviceInfo({ hoursMs, cada, ultimo }) {
  const fmt = (n) => new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
  if (typeof hoursMs !== 'number' || !Number.isFinite(hoursMs)) return { kind: 'sin-horometro', actual: null, faltan: null, pct: 0, text: 'Este tractor aún no reporta horómetro.' };
  const actual = hoursMs / 3600e3;
  const u = ultimo === '' || ultimo == null ? null : Number(ultimo);
  const c = Number(cada);
  if (u === null || !Number.isFinite(u) || !(c > 0)) return { kind: 'sin-ultimo', actual, faltan: null, pct: 0, text: 'Captura el horómetro del último servicio para calcular el próximo.' };
  const faltan = u + c - actual;
  const pct = Math.max(0, Math.min(100, ((actual - u) / c) * 100));
  const kind = faltan <= 0 ? 'crit' : faltan <= 25 ? 'warn' : 'ok';
  return { kind, actual, faltan, pct, text: faltan <= 0 ? `Servicio vencido hace ${fmt(-faltan)} h` : `Próximo servicio en ${fmt(faltan)} h` };
}

/* ---------- operación del tractor (comandos al equipo) ---------- */
// Estado de los controles: llave, motor, trabajo en lote y corte de energía del equipo.
export const CMD_INITIAL = Object.freeze({ key: false, eng: false, move: false, cut: false });

// Intervalo de reportes del rastreador: 60 s en movimiento (trabajando), 30 min detenido.
export const REPORT_MOVING_S = 60;
export const REPORT_STOPPED_S = 1800;
export const reportInterval = (st) => (st?.move ? REPORT_MOVING_S : REPORT_STOPPED_S);

// Reglas del panel actual: el motor pide llave abierta; trabajar en lote pide motor en marcha.
// Devuelve la lista de controles con su texto y si están disponibles.
export function controls(st = CMD_INITIAL) {
  return [
    { act: 'key', on: !!st.key, enabled: true, label: st.key ? 'Cerrar llave' : 'Abrir llave', sub: st.key ? 'Motor apagado: no cuenta horas' : 'El sistema aún no cuenta horas', simOnly: true },
    { act: 'eng', on: !!st.eng, enabled: !!st.key, label: st.eng ? 'Apagar motor' : 'Encender motor', sub: st.eng ? 'D+ = 1 · contando horas' : 'Requiere llave abierta', simOnly: true },
    { act: 'move', on: !!st.move, enabled: !!st.eng, label: st.move ? 'Detener' : 'Trabajar en lote', sub: st.move ? 'Reportes cada 60 s' : 'Requiere motor en marcha', simOnly: true },
    { act: 'cut', on: !!st.cut, enabled: true, label: st.cut ? 'Reconectar equipo' : 'Desconectar equipo', sub: st.cut ? 'Sin alimentación · batería interna' : 'Corta la energía del rastreador', simOnly: false },
  ];
}

// Aplica una acción. Devuelve { state, log: [{ text, sev }], error? }; si la acción no está permitida devuelve error y no cambia nada.
export function applyAction(st = CMD_INITIAL, act) {
  const s = { ...CMD_INITIAL, ...st };
  const log = [];
  if (act === 'key') {
    s.key = !s.key;
    if (s.key) log.push({ text: 'Llave abierta · motor apagado: el sistema NO cuenta horas', sev: 'warn' });
    else {
      if (s.eng) log.push({ text: 'Motor apagado (D+ = 0) · se cierra el conteo de horas', sev: 'ok' });
      s.eng = false; s.move = false;
      log.push({ text: 'Llave cerrada' });
    }
  } else if (act === 'eng') {
    if (!s.key) return { state: s, log, error: 'Requiere llave abierta.' };
    s.eng = !s.eng;
    if (!s.eng) s.move = false;
    log.push(s.eng ? { text: 'Encendido detectado (D+ = 1) · inicia conteo de horas', sev: 'ok' } : { text: 'Motor apagado (D+ = 0) · se cierra el conteo de horas', sev: 'ok' });
  } else if (act === 'move') {
    if (!s.eng) return { state: s, log, error: 'Requiere motor en marcha.' };
    s.move = !s.move;
    log.push({ text: s.move ? 'Trabajando en lote · reportes cada 60 s' : 'Tractor detenido · reportes cada 30 min' });
  } else if (act === 'cut') {
    s.cut = !s.cut;
    log.push(s.cut ? { text: 'Equipo desconectado · sin alimentación externa, corre con batería interna', sev: 'crit' } : { text: 'Equipo reconectado · alimentación externa restablecida', sev: 'ok' });
  } else return { state: s, log, error: 'Acción desconocida.' };
  return { state: s, log };
}

// Comando de Traccar (POST /api/commands/send) que corresponde a una acción ya aplicada. null = solo simulado.
// Tipos de Traccar: engineStop / engineResume (corte y restablecimiento) y positionPeriodic (frecuencia en segundos).
export function commandFor(act, st) {
  if (act === 'cut') return st.cut ? { type: 'engineStop', attributes: {} } : { type: 'engineResume', attributes: {} };
  if (act === 'move') return { type: 'positionPeriodic', attributes: { frequency: reportInterval(st) } };
  return null;
}

// Copia del IMEI: texto del aviso.
export const imeiCopied = (imei) => `IMEI copiado: ${imei}`;
