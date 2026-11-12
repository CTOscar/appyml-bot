// Íconos de los indicadores del ERP: símbolos de Google Material (gris claro #E3E3E3, descargados en src/assets) sobre una ficha de color.
// El glifo es claro, así que el fondo es un color pleno oscuro (hex fijos: se leen igual en cualquier tema).
import power from '../assets/power_settings_new_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
import senal from '../assets/signal_cellular_alt_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
import campana from '../assets/notifications_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
import reloj from '../assets/clock_loader_60_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
import pasto from '../assets/grass_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

// Cada ficha: glifo + color de fondo (contraste del glifo sobre el fondo ≥ 3:1).
export const ICONOS_KPI = {
  enMarcha: { src: power, fondo: '#188038', nombre: 'En marcha' },
  apagado: { src: power, fondo: '#5f6368', nombre: 'Apagado' },
  sinSenal: { src: senal, fondo: '#d93025', nombre: 'Sin señal' },
  horas: { src: reloj, fondo: '#1a73e8', nombre: 'Horas de motor' },
  hectareas: { src: pasto, fondo: '#33691e', nombre: 'Hectáreas' },
  alertas: { src: campana, fondo: '#b06000', nombre: 'Alertas' },
};

/** Ficha cuadrada con esquinas redondeadas: glifo claro sobre fondo de color. Decorativa (aria-hidden): el texto de al lado dice qué es. */
export function Ficha({ icono, size = 'md' }) {
  return (
    <span aria-hidden className={size === 'sm' ? 'grid size-7 shrink-0 place-items-center rounded-lg' : 'grid size-10 shrink-0 place-items-center rounded-xl'} style={{ background: icono.fondo }}>
      <img src={icono.src} alt="" decoding="async" className={size === 'sm' ? 'size-4' : 'size-6'} />
    </span>
  );
}
