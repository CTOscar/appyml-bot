// Barra superior flotante (cristal): marca, navegación principal, «Más», búsqueda, avisos y perfil.
// En celular se vuelve un botón que abre la navegación a pantalla completa.
import { useEffect, useRef, useState } from 'react';
import { ico } from '../ui/menuIcons.js';
import { useAvatar } from '../app/avatar.js';
import { roleLabel } from '../lib/roles.js';
import clsx from 'clsx';
import { ArrowRight, Bell, BarChart3, ChevronDown, ClipboardList, FileText, Fuel, Gauge, Home as HomeIcon, Link2, LogOut, Map as MapIcon, MapPinned, Menu, Package, Search, Sparkles, Tractor, UserRound, Wrench, X, Activity, LayoutGrid } from 'lucide-react';
import { ROUTES, navigate, useRoute } from '../app/router.js';
import { useAuth } from '../app/auth.jsx';
import { IconButton } from '../ui/index.jsx';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { ago, highToday, sortedEvents } from '../lib/events.js';
import { EventIcon } from '../ui/EventIcon.jsx';

const MAIN = ROUTES.filter((r) => r.main);
// Los enlaces con `admin` solo se muestran a quien tiene el permiso «usuarios».
const veAdmin = (user) => !!user?.permissions?.includes('usuarios');
const visibles = (user) => MAIN.filter((r) => !r.admin || veAdmin(user));
const MORE = ROUTES.filter((r) => !r.main && !r.hidden);

function useClickAway(open, close) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, close]);
  return ref;
}

function NavLink({ to, children, active, onClick, className, chevron, open, icon: Icon, iconSrc }) {
  return (
    <a href={'#' + to} onClick={onClick} aria-current={active ? 'page' : undefined}
      className={clsx('relative flex items-center gap-1 rounded-xl px-4 py-2 text-[16.5px] font-medium tracking-[-0.01em] transition',
        active ? 'bg-ink/[0.09] text-fg shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))]' : 'text-soft hover:bg-ink/[0.05] hover:text-fg', className)}>
      {iconSrc ? <img src={iconSrc} alt="" className="size-5 object-contain" /> : Icon ? <Icon className="size-4 opacity-80" aria-hidden /> : null}{children}
      {chevron ? <ChevronDown className={clsx('size-4 opacity-80 transition-transform duration-200', open && 'rotate-180')} aria-hidden /> : null}
    </a>
  );
}

function Brand() {
  return (
    <a href="#/" className="flex shrink-0 items-center gap-2.5 rounded-xl pr-2" aria-label="Inicio · Panel de flota Las Cabras">
      <span className="grid size-8 place-items-center overflow-hidden rounded-[10px] bg-ink/95 shadow-[0_0_18px_-4px_rgb(var(--accent-rgb)/0.6)]">
        <img src="/brand/favicon-32.png" alt="" className="size-6 object-contain" />
      </span>
      <span className="hidden leading-tight sm:block">
        <span className="block font-display text-[15px] font-medium tracking-tight">panelpack</span>
        <span className="block text-[11px] uppercase tracking-[0.16em] text-muted"></span>
      </span>
    </a>
  );
}

// Contenido de cada enlace principal: se muestra al pasar el cursor (o con el teclado), sin hacer clic.
const GROUPS = {
  '/': [['/', 'Resumen del día', 'Clima, flota y atención', HomeIcon, '/brand/las-cabras-logo.webp'], ['/alertas', 'Alertas', 'Eventos y geocercas', Bell, ico('alertas')], ['/reportes', 'Reportes', 'Trabajo y consumo', FileText, ico('reportes')]],
  '/mapa': [['/mapa', 'Mapa en vivo', 'Flota, rastro y herramientas', MapIcon, ico('mapa')], ['/lotes', 'Lotes', 'Geocercas y superficies', MapPinned, ico('lotes')], ['/buscar', 'Buscar', 'Tractor, lote o página', Search, ico('buscar')]],
  '/tractores': [['/tractores', 'Tractores', 'Ficha, horas y combustible', Tractor, '/brands/john-deere.png'], ['/costeo', 'Costeo de diésel', 'Litros y costo por lote', Fuel, '/brands/new-holland.png'], ['/informes', 'Informes', 'Combustible y velocidad por periodo', BarChart3, ico('informes')]],
  '/taller': [['/taller/tablero', 'Tablero', 'Resumen del taller', LayoutGrid, ico('tablero')], ['/taller/ordenes', 'Órdenes de trabajo', 'Pasos, refacciones y mano de obra', ClipboardList, ico('ordenes')],
    ['/taller/almacen', 'Almacén', 'Refacciones y existencias', Package, ico('almacen')], ['/taller/kpis', 'Costos y KPIs', 'Costo por hora y disponibilidad', BarChart3, ico('kpis')], ['/taller/auto', 'Automatización', 'Asistente del taller', Sparkles, ico('automatizacion')]],
  more: [['/enlaces', 'Enlaces', 'Accesos útiles', Link2, ico('enlaces')], ['/status', 'Status', 'Estado de los servicios', Activity, ico('status')], ['/perfil', 'Mi perfil', 'Cuenta y apariencia', UserRound, ico('perfil')]],
};
// Ícono de cada enlace principal (se muestra junto al texto)
const NAV_ICON = { '/': HomeIcon, '/mapa': MapIcon, '/tractores': Tractor, '/taller': Wrench };

// Menú que abre al pasar el cursor (con pequeña espera para no cerrarse al cruzar el hueco) y al enfocar con el teclado.
function HoverMenu({ trigger, items, path, active }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(0);
  const show = () => { clearTimeout(timer.current); setOpen(true); };
  const hide = (ms = 140) => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), ms); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const mouse = (fn) => (e) => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') fn(); };
  return (
    <div className="relative" onPointerEnter={mouse(show)} onPointerLeave={mouse(() => hide())}
      onFocus={show} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) hide(0); }}>
      {trigger({ open, active })}
      {open ? (
        <div className="absolute left-1/2 top-full -translate-x-1/2 pt-3">
          <div role="menu" className="w-[21rem] rounded-[20px] bg-white p-2 text-[#071331] shadow-[0_5px_28px_rgba(0,0,0,0.18)] animate-pop">
            {items.map(([to, label, hint, Icon, img]) => {
              const here = to === path;
              return (
                <a key={to} role="menuitem" href={'#' + to} onClick={() => setOpen(false)}
                  className={clsx('group flex items-center gap-3 rounded-xl p-2 transition', here ? 'bg-[#f3f5f9]' : 'hover:bg-[#f3f5f9]')}>
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(7,19,49,0.06)]">
                    {img ? <img src={img} alt="" loading="lazy" className="size-6 object-contain" /> : Icon ? <Icon className="size-[19px] text-[#071331]" aria-hidden /> : <Gauge className="size-[19px]" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block text-[16px] font-medium tracking-[-0.01em]">{label}</span>
                  <span className="block truncate text-[13.5px] text-[#7c8a99]">{hint}</span></span>
                  <ArrowRight className="size-4 shrink-0 -translate-x-1 text-[#1260eb] opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MoreMenu({ path }) {
  const activeMore = MORE.some((r) => r.path === path);
  return (
    <HoverMenu path={path} items={GROUPS.more} active={activeMore}
      trigger={({ open }) => (
        <button type="button" aria-haspopup="menu" aria-expanded={open}
          className={clsx('flex items-center gap-1 rounded-xl px-4 py-2 text-[16.5px] font-medium tracking-[-0.01em] transition', activeMore || open ? 'bg-ink/[0.09] text-fg' : 'text-soft hover:bg-ink/[0.05] hover:text-fg')}>
          Más <ChevronDown className={clsx('size-4 opacity-80 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
        </button>
      )} />
  );
}

// Campana: panel debajo del botón, igual que el panel actual (home.js, fillBell): alertas altas de hoy,
// pestañas Altas / Todos los eventos, últimos 8 y «Todas las alertas». Tocar un evento abre Alertas con ese evento marcado.
function BellMenu() {
  const { snap } = useFleet();
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  const ev = sortedEvents(snap.events);
  const high = ev.filter((x) => x.i.high);
  const today = highToday(snap.events);
  // Globo = altas de hoy SIN VER: se limpia al abrir la campana y vuelve a subir solo con alertas nuevas.
  const [seen, setSeen] = useState(() => { try { return Number(localStorage.getItem('pf-bell-seen')) || 0; } catch { return 0; } });
  const unseen = high.filter((x) => x.at > seen && x.at >= new Date().setHours(0, 0, 0, 0)).length;
  const markSeen = () => { const t = Date.now(); setSeen(t); try { localStorage.setItem('pf-bell-seen', String(t)); } catch { /* sin almacenamiento */ } };
  const fences = Object.fromEntries(snap.geofences.map((g) => [g.id, g.name]));
  const list = (all ? ev : high).slice(0, 8);
  const hhmm = (ms) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  const go = (to) => { setOpen(false); navigate(to); };
  return (
    <div ref={ref} className="relative">
      <IconButton label={unseen ? `Alertas: ${unseen} sin ver, ${today} altas hoy` : `Alertas: ${today} altas hoy`} badge={unseen ? (unseen > 99 ? '99+' : unseen) : null} onClick={() => { if (!open) markSeen(); setOpen((v) => !v); }} aria-expanded={open}>
        <Bell className="size-[18px]" />
      </IconButton>
      {open ? (
        <div role="dialog" aria-label="Alertas" className="menu-surface absolute right-0 top-[calc(100%+12px)] w-[min(24rem,calc(100vw-1.5rem))] p-4 animate-pop">
          <h2 className="font-display text-xl">Alertas</h2>
          <p className="text-[13px] text-muted">{today} {today === 1 ? 'alerta alta hoy' : 'alertas altas hoy'}</p>
          <div className="mt-3 flex gap-1.5">
            {[[false, `Altas (${high.length})`], [true, `Todos los eventos (${ev.length})`]].map(([v, l]) => (
              <button key={l} type="button" aria-pressed={all === v} onClick={() => setAll(v)}
                className={clsx('h-8 rounded-full px-3 text-[12.5px] transition', all === v ? 'bg-fg text-onfg' : 'bg-ink/[0.06] text-soft hover:text-fg')}>{l}</button>
            ))}
          </div>
          <ul className="mt-3 grid gap-0.5">
            {list.length ? list.map((x) => (
              <li key={x.e.id}>
                <button type="button" onClick={() => go(`/alertas?ev=${x.e.id}`)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-ink/[0.06]">
                  <EventIcon e={x.e} size="sm" />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] text-fg">{snap.devices.get(x.e.deviceId)?.name || `Equipo ${x.e.deviceId}`} — {x.i.label}</span>
                    <span className="block text-[12px] text-muted">{hhmm(x.at)} · {ago(x.at)}{x.e.geofenceId && fences[x.e.geofenceId] ? ` · ${fences[x.e.geofenceId]}` : ''}</span>
                  </span>
                </button>
              </li>
            )) : <li className="px-2 py-4 text-center text-[13px] text-muted">Sin eventos para mostrar.</li>}
          </ul>
          <button type="button" onClick={() => go('/alertas')} className="mt-2 w-full rounded-xl py-2 text-[13px] text-accent hover:bg-ink/[0.05]">Todas las alertas »</button>
        </div>
      ) : null}
    </div>
  );
}

function ProfileMenu() {
  const { user, logout, client } = useAuth();
  const foto = useAvatar(client, user?.id);
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  const nombre = user?.name || user?.email || 'Cuenta';
  const iniciales = nombre.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`Perfil de ${nombre}`}
        className="relative grid size-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-accent/90 to-info/70 text-[12px] font-semibold text-onfg shadow-[0_0_16px_-4px_rgb(var(--accent-rgb)/0.7)]">
        {foto ? <img src={foto} alt="" className="absolute inset-0 size-full object-cover" /> : iniciales}
      </button>
      {open ? (
        <div className="menu-surface absolute right-0 top-[calc(100%+12px)] w-72 p-1.5 animate-pop">
          <div className="px-3 py-2.5">
            <p className="truncate text-[14px] font-medium">{nombre}</p>
            <p className="truncate text-[12.5px] text-muted">{user?.email} · {roleLabel(user?.role)}</p>
          </div>
          <div className="my-1 h-px bg-ink/[0.07]" />
          <a href="#/perfil" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] text-soft hover:bg-ink/[0.06] hover:text-fg"><UserRound className="size-4" aria-hidden />Mi perfil</a>
          <button type="button" onClick={logout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] text-soft hover:bg-ink/[0.06] hover:text-fg"><LogOut className="size-4" aria-hidden />Cerrar sesión</button>
        </div>
      ) : null}
    </div>
  );
}

function MobileNav({ path, onClose }) {
  const { user } = useAuth();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-night/80 backdrop-blur-xl md:hidden" role="dialog" aria-modal="true" aria-label="Navegación">
      <div className="mx-3 mt-3 glass-strong p-3 animate-pop">
        <div className="flex items-center justify-between"><Brand /><IconButton label="Cerrar menú" onClick={onClose}><X className="size-5" /></IconButton></div>
        <nav className="mt-3 grid gap-1">
          {[...visibles(user), ...MORE].map((r) => (
            <NavLink key={r.path} to={r.path} active={r.path === path} onClick={onClose} iconSrc={r.path === '/accounts' ? ico('accounts') : undefined} icon={NAV_ICON[r.path] || Object.fromEntries(Object.values(GROUPS).flat().map((g) => [g[0], g[3]]))[r.path]} className="px-4 py-3 text-[16px]">{r.label}</NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function TopBar() {
  const { path } = useRoute();
  const { user } = useAuth();
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 sm:pt-[max(1rem,env(safe-area-inset-top))] lg:px-6">
        <div className={clsx('flex h-14 w-full items-center gap-2 rounded-2xl px-2.5 transition-[background,box-shadow] duration-300',
          scrolled || path === '/mapa' ? 'glass-strong' : 'bg-transparent')}>
          <Brand />
          <nav className="ml-6 hidden items-center gap-2 lg:gap-3 md:flex" aria-label="Principal">
            {visibles(user).map((r) => r.path === '/' ? <NavLink key={r.path} to={r.path} active={r.path === path} >{r.label}</NavLink> : r.path === '/accounts' ? <NavLink key={r.path} to={r.path} active={r.path === path} iconSrc={ico('accounts')}>{r.label}</NavLink> : (
              <HoverMenu key={r.path} path={path} items={GROUPS[r.path] || []}
                trigger={({ open }) => <NavLink to={r.path} active={r.path === path} chevron open={open}>{r.label}</NavLink>} />
            ))}
            <MoreMenu path={path} />
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => navigate('/buscar')}
              className="hidden h-9 items-center gap-2 rounded-xl bg-ink/[0.05] px-3 text-[13px] text-muted shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.07*var(--t-hair-a)))] transition hover:text-soft lg:flex">
              <Search className="size-4" aria-hidden />Buscar tractor, lote…
            </button>
            <IconButton label="Buscar" className="lg:hidden" onClick={() => navigate('/buscar')}><Search className="size-[18px]" /></IconButton>
            <BellMenu />
            <ProfileMenu />
            <IconButton label="Abrir menú" className="md:hidden" onClick={() => setMobile(true)}><Menu className="size-5" /></IconButton>
          </div>
        </div>
      </header>
      {mobile ? <MobileNav path={path} onClose={() => setMobile(false)} /> : null}
    </>
  );
}
