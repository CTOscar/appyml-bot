// Pantalla tipo ERP para los roles que no usan el panel completo ni el bot: barra lateral de módulos, encabezado con la ruta y la cuenta,
// y el contenido a la derecha. Reusa las páginas que ya existen (Tractores, Costeo de diésel, Informes, Taller).
//   admin       → «Supervisión»: Resumen, Tractores, Costeo de diésel, Informes y Taller, todo en solo lectura.
//   jefe_taller → «Taller»: Tablero, Órdenes de trabajo, Almacén y Costos y KPIs, con captura.
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, Lock, LogOut, Menu, UserRound, X } from 'lucide-react';
import { useAuth } from '../app/auth.jsx';
import { navigate, useRoute } from '../app/router.js';
import { esSoloLectura, roleLabel } from '../lib/roles.js';
import { setSoloLectura, useToast } from '../taller/useTaller.js';
import { Badge, IconChip } from '../ui/index.jsx';
import { Tractores } from '../pages/Tractores.jsx';
import { Costeo } from '../pages/Costeo.jsx';
import { Informes } from '../pages/Informes.jsx';
import { Taller } from '../pages/Taller.jsx';
import { Perfil } from '../pages/Perfil.jsx';
import { Resumen } from './Resumen.jsx';
import { TALLER_TABS, inicioDe, modulosDe } from './modulos.js';

const PERFIL = { id: 'perfil', path: '/perfil', label: 'Mi perfil' };

function Lateral({ mods, route, user, onNavegar }) {
  return (
    <nav aria-label="Módulos" className="grid content-start gap-1 p-3">
      {mods.map((m) => {
        const activo = route.path === m.path;
        return (
          <div key={m.id}>
            <a href={`#${m.path}${m.hijos ? `/${m.hijos[0][0]}` : ''}`} onClick={onNavegar} aria-current={activo ? 'page' : undefined}
              className={clsx('flex h-11 items-center gap-3 rounded-xl px-2.5 text-[14.5px] transition', activo ? 'bg-ink/[0.08] font-medium text-fg' : 'text-soft hover:bg-ink/[0.05] hover:text-fg')}>
              <IconChip svg={m.svg} size="sm" />{m.label}
            </a>
            {m.hijos && activo ? (
              <ul className="ml-[25px] mt-1 grid gap-0.5 border-l border-ink/10 pl-3">
                {m.hijos.map(([id, txt]) => {
                  const sel = (route.rest[0] || m.hijos[0][0]) === id;
                  return <li key={id}><a href={`#${m.path}/${id}`} onClick={onNavegar} aria-current={sel ? 'page' : undefined} className={clsx('block rounded-lg px-2.5 py-1.5 text-[13.5px] transition', sel ? 'text-accent' : 'text-muted hover:text-fg')}>{txt}</a></li>;
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
      <p className="mt-4 px-3 text-[12px] leading-snug text-faint">{user?.name || user?.email}<br />{roleLabel(user?.role)}</p>
    </nav>
  );
}

export function ErpApp() {
  const { user, logout } = useAuth();
  const route = useRoute();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const mods = modulosDe(user);
  const lectura = esSoloLectura(user);

  // El taller ignora cualquier captura mientras la cuenta sea de solo lectura.
  useEffect(() => { setSoloLectura(lectura); return () => setSoloLectura(false); }, [lectura]);

  const actual = route.path === '/perfil' ? PERFIL : mods.find((m) => m.path === route.path);
  useEffect(() => { if (!actual) navigate(inicioDe(user)); }, [actual, user]);
  useEffect(() => { window.scrollTo(0, 0); setMenu(false); }, [route.full]);

  const tabActual = actual?.hijos ? actual.hijos.find(([id]) => id === route.rest[0]) || actual.hijos[0] : null;
  useEffect(() => { document.title = `${actual?.label || 'Panel'} · ${lectura ? 'Supervisión' : 'Taller'} · Panel de Flota`; }, [actual, lectura]);

  if (!actual) return null;

  let pagina;
  if (actual.id === 'resumen') pagina = <Resumen />;
  else if (actual.id === 'tractores') pagina = <Tractores />;
  else if (actual.id === 'costeo') pagina = <Costeo />;
  else if (actual.id === 'informes') pagina = <Informes />;
  else if (actual.id === 'taller') pagina = <Taller route={route} tabs={TALLER_TABS.map((t) => t[0])} />;
  else pagina = <Perfil />;

  return (
    <div className="min-h-dvh bg-night text-fg lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a href="#erp-contenido" className="skip-link">Saltar al contenido</a>

      {/* Barra lateral: fija en pantallas anchas, cajón en celular */}
      <aside className={clsx('fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-ink/10 bg-deep transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0', menu ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-14 items-center justify-between gap-2 border-b border-ink/10 px-4">
          <span className="font-display text-[15px] tracking-wide">{lectura ? 'Supervisión' : 'Taller'}</span>
          <button type="button" onClick={() => setMenu(false)} aria-label="Cerrar el menú" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/10 lg:hidden"><X className="size-4" /></button>
        </div>
        <Lateral mods={mods} route={route} user={user} onNavegar={() => setMenu(false)} />
      </aside>
      {menu ? <button type="button" aria-label="Cerrar el menú" onClick={() => setMenu(false)} className="fixed inset-0 z-30 bg-black/50 lg:hidden" /> : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink/10 bg-night/90 px-3 backdrop-blur sm:px-5">
          <button type="button" onClick={() => setMenu(true)} aria-label="Abrir el menú" className="grid size-9 place-items-center rounded-lg text-soft hover:bg-ink/10 lg:hidden"><Menu className="size-5" /></button>
          {actual.svg ? <IconChip svg={actual.svg} size="sm" className="max-sm:hidden" /> : null}
          <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1.5 text-[14px]">
            <span className="text-muted max-sm:hidden">{lectura ? 'Supervisión' : 'Taller'}</span>
            <ChevronRight className="size-3.5 shrink-0 text-faint max-sm:hidden" aria-hidden />
            <span className="truncate font-medium">{actual.label}</span>
            {tabActual ? <><ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden /><span className="truncate text-soft">{tabActual[1]}</span></> : null}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {lectura ? <Badge tone="warn" dot={false}><Lock className="size-3.5" aria-hidden />Solo lectura</Badge> : null}
            <a href="#/perfil" aria-label="Mi perfil" className="grid size-9 place-items-center rounded-lg text-soft hover:bg-ink/10 hover:text-fg"><UserRound className="size-[18px]" aria-hidden /></a>
            <button type="button" onClick={logout} aria-label="Cerrar sesión" className="grid size-9 place-items-center rounded-lg text-soft hover:bg-crit/10 hover:text-crit"><LogOut className="size-[18px]" aria-hidden /></button>
          </div>
        </header>

        {lectura ? <p role="note" className="border-b border-warn/20 bg-warn/10 px-4 py-1.5 text-[12.5px] text-warn sm:px-5">Modo solo lectura: puedes consultar todo, pero tu cuenta no puede capturar ni modificar datos.</p> : null}

        <main id="erp-contenido" tabIndex={-1} className="mx-auto w-full max-w-[1600px] px-3 pb-16 pt-5 outline-none sm:px-5 sm:pt-6">
          {pagina}
        </main>
      </div>
      {toast && actual.id !== 'taller' ? <div role="status" className="fixed bottom-4 left-1/2 z-[60] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-fg px-4 py-2.5 text-sm text-onfg shadow-xl">{toast}</div> : null}
    </div>
  );
}
