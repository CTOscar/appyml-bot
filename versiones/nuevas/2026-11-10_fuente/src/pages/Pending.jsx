// Páginas que se construyen en las siguientes fases: dicen qué tendrán y cuándo.
import { Construction } from 'lucide-react';
import { routeOf } from '../app/router.js';

const PLAN = {
  '/mapa': ['Fase 2', 'Mapa en vivo con Leaflet, lista de tractores, filtros por estado y nivel, y el panel de operación de hoy.'],
  '/tractores': ['Fase 3', 'Tarjetas por marca y modelo con unidades, estado en vivo y horas de motor.'],
  '/lotes': ['Fase 3', 'Lotes (geocercas) con superficie, cultivo y actividad.'],
  '/alertas': ['Fase 3', 'Eventos de la flota con filtros: combustible, energía, encendido y lotes.'],
  '/reportes': ['Fase 3', 'Reportes por tractor y periodo.'],
  '/costeo': ['Fase 3', 'Consumo de diésel, cargas y descargas por tractor y día.'],
  '/enlaces': ['Fase 3', 'Fichas, tiendas y servicios del proyecto.'],
  '/status': ['Fase 3', 'Estado del servicio y disponibilidad.'],
  '/taller': ['Fase 4', 'Órdenes de trabajo, almacén, costos y KPIs, y el asistente con assistant-ui.'],
  '/perfil': ['Fase 3', 'Tus datos, foto y contraseña.'],
  '/buscar': ['Fase 2', 'Búsqueda de tractores, lotes y páginas.'],
};

export function Pending({ path }) {
  const r = routeOf(path);
  const [fase, texto] = PLAN[path] || ['Pronto', 'Esta sección se está construyendo.'];
  return (
    <section className="mx-auto grid max-w-2xl justify-items-center gap-5 pt-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-ink/[0.06] text-accent shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]"><Construction className="size-6" aria-hidden /></span>
      <h1 className="display glow text-5xl sm:text-6xl animate-rise">{r?.label || (path === '/buscar' ? 'Búsqueda' : 'Página')}</h1>
      <p className="text-[17px] text-soft">{texto}</p>
      <span className="rounded-full bg-ink/[0.06] px-3 py-1 text-[13px] text-muted shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]">{fase} de la reconstrucción</span>
    </section>
  );
}
