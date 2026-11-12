// Cierre común de las páginas internas: tres accesos a secciones relacionadas, en rejilla con líneas finas.
import { ArrowRight } from 'lucide-react';
import { navigate } from '../app/router.js';

const NEXT = {
  '/tractores': [['/mapa', 'Mapa', 'Ver cada tractor en vivo'], ['/costeo', 'Costeo de diésel', 'Litros y costo por equipo'], ['/taller', 'Taller', 'Órdenes y refacciones']],
  '/lotes': [['/mapa', 'Mapa', 'Encuadrar un lote'], ['/alertas', 'Alertas', 'Salidas de lote'], ['/reportes', 'Reportes', 'Horas por lote']],
  '/alertas': [['/mapa', 'Mapa', 'Ver dónde ocurrió'], ['/lotes', 'Lotes', 'Geocercas'], ['/tractores', 'Tractores', 'Ficha del equipo']],
  '/reportes': [['/costeo', 'Costeo de diésel', 'Costo del trabajo'], ['/tractores', 'Tractores', 'Estado de la flota'], ['/mapa', 'Mapa', 'Ruta del día']],
  '/costeo': [['/reportes', 'Reportes', 'Horas de motor'], ['/tractores', 'Tractores', 'Sondas y niveles'], ['/taller', 'Taller', 'Costos y KPIs']],
  '/taller': [['/tractores', 'Tractores', 'Horas y servicio'], ['/costeo', 'Costeo de diésel', 'Combustible'], ['/alertas', 'Alertas', 'Eventos altos']],
  '/enlaces': [['/status', 'Status', 'Estado de los servicios'], ['/mapa', 'Mapa', 'Flota en vivo'], ['/', 'Inicio', 'Resumen del día']],
  '/status': [['/enlaces', 'Enlaces', 'Accesos útiles'], ['/mapa', 'Mapa', 'Flota en vivo'], ['/', 'Inicio', 'Resumen del día']],
  '/perfil': [['/', 'Inicio', 'Resumen del día'], ['/mapa', 'Mapa', 'Flota en vivo'], ['/enlaces', 'Enlaces', 'Accesos útiles']],
  '/ajustes': [['/mapa', 'Mapa', 'Ver los cambios en vivo'], ['/alertas', 'Alertas', 'Eventos de operación'], ['/reportes', 'Reportes', 'Tiempos del día']],
  '/buscar': [['/mapa', 'Mapa', 'Flota en vivo'], ['/tractores', 'Tractores', 'Ficha del equipo'], ['/lotes', 'Lotes', 'Geocercas']],
};

export function Next({ path }) {
  const items = path === '/taller' && /#\/taller\/auto/.test(globalThis.location?.hash || '') ? null : NEXT[path];
  if (!items) return null;
  return (
    // Compacto: un título pequeño y tres accesos bajos (antes ocupaba ~250 px y dejaba huecos grandes).
    <nav aria-label="Sigue explorando" className="mt-12 grid gap-4">
      <h2 className="font-display text-xl font-light tracking-[-0.01em] sm:text-2xl">Sigue <span className="text-muted">explorando</span>.</h2>
      <div className="grid overflow-hidden rounded-3xl border border-ink/10 md:grid-cols-3 [&>*]:border-b [&>*]:border-ink/10 md:[&>*]:border-b-0 md:[&>*+*]:border-l">
        {items.map(([to, t, c]) => (
          <button key={to} type="button" onClick={() => navigate(to)} className="group grid min-h-20 content-between gap-2 px-5 py-4 text-left transition hover:bg-ink/[0.04]">
            <span className="flex items-center justify-between"><b className="font-display text-lg font-medium">{t}</b><ArrowRight className="size-5 text-muted transition group-hover:translate-x-1 group-hover:text-accent" aria-hidden /></span>
            <span className="text-[14px] text-muted">{c}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
