// Ícono por palabra clave: así los indicadores y encabezados de todas las páginas tienen ícono sin repetir el mapeo en cada una.
// Se busca la primera regla cuya expresión coincida con el texto (sin acentos, en minúsculas). `iconFor(texto, respaldo)`.
import {
  Activity, Bell, BarChart3, Boxes, CalendarClock, CircleDollarSign, ClipboardList, Clock3, Droplets, FileText, Fuel, Gauge, Hammer,
  HeartPulse, Layers, Link2, LayoutGrid, Map as MapIcon, MapPinned, PackageSearch, Percent, Power, Ruler, Search, Settings2, ShieldAlert, Sparkles,
  Sprout, Timer, Tractor, TrendingDown, TrendingUp, UserRound, Wrench, Zap,
} from 'lucide-react';

const RULES = [
  [/descarga|robo|baj[ao]s? sosp/, TrendingDown],
  [/carga/, TrendingUp],
  [/litro|diesel|combustible/, Fuel],
  [/costo|\$|precio|dinero/, CircleDollarSign],
  [/consumo/, Droplets],
  [/disponib|utiliz|cumpl|preventivo|%/, Percent],
  [/mtbf|mttr|vencid|servicio/, CalendarClock],
  [/hora|promedio|tiempo/, Clock3],
  [/hect|superficie|ha\b/, Ruler],
  [/lote|geocerca|rancho/, MapPinned],
  [/mapa/, MapIcon],
  [/en marcha|operando|encendid/, Power],
  [/taller|descompuest|orden|mantenim/, Wrench],
  [/pedir|refaccion|almacen|existencia/, PackageSearch],
  [/alerta|evento/, ShieldAlert],
  [/energ/, Zap],
  [/modelo|marca|tractor|equipo|unidad|flota/, Tractor],
  [/informe/, BarChart3],
  [/reporte/, FileText],
  [/costeo/, CircleDollarSign],
  [/enlace/, Link2],
  [/ajuste|operacion/, Settings2],
  [/perfil|cuenta/, UserRound],
  [/status|estado/, Activity],
  [/buscar|busca/, Search],
  [/automat|asistente/, Sparkles],
  [/tablero|resumen/, LayoutGrid],
  [/cultivo|siembra/, Sprout],
  [/velocidad/, Gauge],
  [/salud/, HeartPulse],
  [/reparar|herramienta/, Hammer],
  [/pendiente|aviso/, Bell],
  [/almac/, Boxes],
  [/orden/, ClipboardList],
  [/capa/, Layers],
  [/cron|timer/, Timer],
];

const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function iconFor(text, fallback = Activity) {
  const t = strip(text);
  for (const [re, Icon] of RULES) if (re.test(t)) return Icon;
  return fallback;
}
