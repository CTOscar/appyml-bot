// Íconos planos a color (src/assets/menu/*.svg + el de Google Maps): los usa el menú de la barra superior
// y el encabezado de cada página, para que se vean igual en los dos lados.
import mapaIcono from '../assets/google-maps-svgrepo-com.svg';
import gasIcono from '../assets/gas-svgrepo-com.svg';

const ICONOS = import.meta.glob('../assets/menu/*.svg', { eager: true, query: '?url', import: 'default' });

/** URL del ícono `nombre` (alertas, lotes…), o undefined si no existe. */
// «Tractores» usa el logo de John Deere (public/brands), no un dibujo. «Costeo» (combustible) usa el ícono de gas descargado (SVG Repo).
export const ico = (nombre) => (nombre === 'mapa' ? mapaIcono : nombre === 'tractores' ? '/brands/john-deere.png' : nombre === 'costeo' ? gasIcono : ICONOS[`../assets/menu/${nombre}.svg`]);

// Primera regla que coincida con el título de la página (sin acentos, en minúsculas).
const REGLAS = [
  // El orden importa: la primera que coincida gana (p. ej. «descarga» antes que «carga», «kpi» antes que «costo»).
  [/descarga|robo|baj[ao]s? sosp/, 'descargas'], [/carga/, 'cargas'],
  [/lote|geocerca|rancho/, 'lotes'], [/alerta|evento/, 'alertas'], [/energ/, 'energia'],
  [/reporte/, 'reportes'], [/informe/, 'informes'],
  [/costeo|diesel|combustible|litro/, 'costeo'], [/consumo/, 'consumo'],
  [/kpi|costos y|velocidad/, 'kpis'], [/costo|\$|precio|dinero/, 'costo'],
  [/mtbf|mttr|vencid|servicio|preventivo|mantenim/, 'servicio'],
  [/disponib|utiliz|cumpl|%/, 'porcentaje'], [/hora|promedio|tiempo/, 'horas'],
  [/hect|superficie/, 'superficie'], [/en marcha|operando|encendid/, 'enmarcha'],
  [/descompuest/, 'descompuesto'], [/pedir|refaccion|existencia|almac/, 'almacen'],
  [/tablero|resumen/, 'tablero'], [/orden/, 'ordenes'], [/automat|asistente/, 'automatizacion'],
  [/taller/, 'taller'], [/tractor|modelo|marca|flota|equipo|unidad/, 'tractores'], [/mapa/, 'mapa'],
  [/enlace/, 'enlaces'], [/accounts|cuentas/, 'accounts'], [/aplicacion/, 'apps'], [/status/, 'status'], [/ajuste/, 'ajustes'], [/perfil|identificacion|cuenta/, 'perfil'],
  [/buscar|busqueda/, 'buscar'], [/nota/, 'notas'], [/apariencia/, 'apariencia'],
];
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Ícono a color para el título de una página, o undefined si no hay. */
export function icoPara(titulo) {
  const t = sinAcentos(titulo);
  const r = REGLAS.find(([re]) => re.test(t));
  return r ? ico(r[1]) : undefined;
}
