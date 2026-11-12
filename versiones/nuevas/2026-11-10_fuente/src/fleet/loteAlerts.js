// Editor de lotes y alertas por lote. Mismos campos y textos que «Ajustes del lote» del panel actual.
// Los datos propios del lote viajan en `attributes` de la geocerca (fence_settings de la API los guarda como JSON).

export const CULTIVOS = ['Tomate', 'Chile', 'Maíz', 'Mango', 'Frijol', 'Calabaza', 'Pepino', 'Otro'];
export const ETAPAS = ['Preparación de suelo', 'Siembra', 'Desarrollo', 'Floración', 'Fructificación', 'Cosecha', 'Descanso'];
export const COLORES = [['#9D6B99', 'Malva'], ['#0A58F0', 'Azul'], ['#1C965E', 'Verde'], ['#E0791E', 'Naranja'], ['#D6453A', 'Rojo'], ['#0E8F80', 'Turquesa']];

const num = (v) => (v === '' || v == null ? '' : Number(v));

// Valores iniciales del formulario a partir de la geocerca.
export function loteForm(g) {
  const a = g?.attributes || {};
  return {
    name: g?.name || '', cultivo: a.cultivo || '', etapa: a.etapa || '', superficie: a.superficie ?? '', responsable: a.responsable || '',
    color: a.color || COLORES[0][0], alertaEntrada: !!a.alertaEntrada, alertaSalida: !!a.alertaSalida, horasMax: a.horasMax ?? '',
  };
}

// Texto del error o null si el formulario es válido.
export function validateLote(f) {
  if (!String(f.name || '').trim()) return 'Escribe el nombre del lote.';
  if (f.superficie !== '' && !(Number(f.superficie) >= 0)) return 'La superficie debe ser un número positivo.';
  if (f.horasMax !== '' && !(Number(f.horasMax) >= 0 && Number(f.horasMax) <= 24)) return 'Las horas máximas deben estar entre 0 y 24.';
  return null;
}

// Geocerca lista para guardar: conserva los demás attributes y no manda la forma calculada en el panel.
export function applyLoteForm(g, f) {
  const { shape, ha, ...raw } = g;
  return {
    ...raw, name: String(f.name).trim(),
    attributes: {
      ...(g.attributes || {}), cultivo: f.cultivo, etapa: f.etapa, superficie: num(f.superficie), responsable: String(f.responsable || '').trim(),
      color: f.color, alertaEntrada: !!f.alertaEntrada, alertaSalida: !!f.alertaSalida, horasMax: num(f.horasMax),
    },
  };
}

// Resumen «Alertas de lote» del detalle: «entrada y salida», «entrada», «salida» o «Ninguna».
export const alertasTexto = (a = {}) => [a.alertaEntrada && 'entrada', a.alertaSalida && 'salida'].filter(Boolean).join(' y ') || 'Ninguna';

// Alertas por lote para una lectura de posición. `r` es el estado del tractor (se muta): { lh: {day, ms:{fid}}, hDone: {} }.
// Entrada y salida solo cuando hay una lectura anterior (first = false). Horas máximas: tiempo con motor encendido dentro
// del lote en el día, con una alerta por tractor, lote y día.
export function loteAlerts({ r, prevFid = 0, fid = 0, first = false, ign = false, dt = 0, day, fences, deviceName = 'Tractor' }) {
  const by = (id) => fences.find((g) => g.id === id);
  const out = [];
  if (!first && prevFid !== fid) {
    const prev = by(prevFid), cur = by(fid);
    if (prev?.attributes?.alertaSalida) out.push({ key: `salida-${prevFid}`, sev: 'warn', titulo: `Salió de ${prev.name}`, det: `${deviceName} dejó el lote ${prev.name}` });
    if (cur?.attributes?.alertaEntrada) out.push({ key: `entrada-${fid}`, sev: 'info', titulo: `Entró a ${cur.name}`, det: `${deviceName} entró al lote ${cur.name}` });
  }
  if (!r.lh || r.lh.day !== day) { r.lh = { day, ms: {} }; r.hDone = {}; }
  const g = by(fid), max = Number(g?.attributes?.horasMax);
  if (g && ign && dt > 0 && dt <= 90000) {
    r.lh.ms[fid] = (r.lh.ms[fid] || 0) + dt;
    if (max > 0 && !r.hDone[fid] && r.lh.ms[fid] >= max * 3600e3) {
      r.hDone[fid] = true;
      out.push({ key: `horas-${fid}-${day}`, sev: 'warn', titulo: `Horas máximas en ${g.name}`, det: `${deviceName} pasó de ${max} h de motor hoy en el lote ${g.name}` });
    }
  }
  return out;
}
