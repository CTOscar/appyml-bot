// Mapa incrustado en Inicio: la flota en vivo con filtro por estado, capa, ficha del tractor tocado y salto al mapa completo.
import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Crosshair, Expand, Maximize2 } from 'lucide-react';
import { useFleet } from './FleetProvider.jsx';
import { MapView, LAYER_NAMES } from './MapView.jsx';
import { navigate } from '../app/router.js';
import { STATUS } from '../lib/fleet.js';
import { Badge } from '../ui/index.jsx';

const FILTROS = [[null, 'Todos'], ['running', 'En marcha'], ['idle', 'Apagados'], ['nosignal', 'Sin señal']];
const CAPAS = ['oscuro', 'satelite'];

export function MiniMap({ className }) {
  const { store, snap } = useFleet();
  const ref = useRef(null);
  const [status, setStatus] = useState(null);
  const [layer, setLayer] = useState('oscuro');
  const [sel, setSel] = useState(null);

  const sum = store.summary();
  const cuenta = { null: sum.total, running: sum.running, idle: sum.idle, nosignal: sum.nosignal };
  const filters = useMemo(() => ({ status }), [status]);

  const dev = sel != null ? snap.devices.get(sel) : null;
  const pos = sel != null ? snap.positions.get(sel) : null;
  const st = sel != null ? store.statusOf(sel) : null;
  const horas = sel != null ? (snap.engineToday.get(sel) || 0) / 3600e3 : 0;
  const lote = sel != null ? store.fenceOf(sel) : null;

  return (
    <section aria-label="Mapa interactivo de la flota" className={clsx('glass flex flex-col overflow-hidden p-0', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h3 className="font-display text-xl">Mapa en vivo</h3>
        <div role="group" aria-label="Capa del mapa" className="inline-flex rounded-full bg-ink/[0.05] p-0.5 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))]">
          {CAPAS.map((c) => (
            <button key={c} type="button" aria-pressed={layer === c} onClick={() => setLayer(c)}
              className={clsx('h-7 rounded-full px-3 text-[12.5px] transition', layer === c ? 'bg-ink/[0.14] text-fg' : 'text-muted hover:text-fg')}>{LAYER_NAMES[c]}</button>
          ))}
        </div>
      </div>

      <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5 px-5 pb-3">
        {FILTROS.map(([v, l]) => (
          <button key={String(v)} type="button" aria-pressed={status === v} onClick={() => { setStatus(v); setSel(null); }}
            className={clsx('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition',
              status === v ? 'bg-fg text-onfg' : 'bg-ink/[0.05] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))] hover:bg-ink/[0.09]')}>
            {l}<span className={clsx('tabular-nums', status === v ? 'text-onfg/60' : 'text-faint')}>{cuenta[String(v)]}</span>
          </button>
        ))}
      </div>

      <div className="relative min-h-[22rem] flex-1 sm:min-h-[26rem]">
        <MapView ref={ref} snap={snap} store={store} filters={filters} selected={sel} onSelect={setSel} layer={layer} fences labels={false} wheelZoom={false} />
        <div className="pointer-events-none absolute left-3 top-3 z-[400] on-photo rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] text-soft backdrop-blur-md">Arrastra para mover · toca un tractor · usa +/− o Ctrl + rueda</div>
        <div className="absolute right-3 top-3 z-[400] grid gap-1.5">
          <button type="button" aria-label="Acercar" onClick={() => ref.current?.zoomIn?.()} className="grid size-9 place-items-center on-photo rounded-xl bg-black/45 text-lg text-fg backdrop-blur-md hover:bg-black/60">+</button>
          <button type="button" aria-label="Alejar" onClick={() => ref.current?.zoomOut()} className="grid size-9 place-items-center on-photo rounded-xl bg-black/45 text-lg text-fg backdrop-blur-md hover:bg-black/60">−</button>
          <button type="button" aria-label="Ver toda la flota" title="Ver toda la flota" onClick={() => { setSel(null); ref.current?.fitAll(); }} className="grid size-9 place-items-center on-photo rounded-xl bg-black/45 text-fg backdrop-blur-md hover:bg-black/60"><Expand className="size-4" aria-hidden /></button>
        </div>
      </div>

      <div className="flex min-h-[4.25rem] flex-wrap items-center gap-3 border-t border-ink/[0.06] px-5 py-3">
        {dev ? (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><b className="font-display text-lg font-normal">{dev.name}</b><Badge tone={STATUS[st].tone}>{STATUS[st].label}</Badge></div>
              <p className="text-[13px] text-muted">
                {horas.toFixed(1)} h de motor hoy{pos && st === 'running' ? ` · ${Math.round((pos.speed || 0) * 1.852)} km/h` : ''}{lote ? ` · ${lote.name}` : ''}
              </p>
            </div>
            <button type="button" onClick={() => ref.current?.focus(sel)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink/[0.07] px-3 text-[13px] hover:bg-ink/[0.12]"><Crosshair className="size-4" aria-hidden />Centrar</button>
            <button type="button" onClick={() => navigate(`/mapa?d=${sel}`)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-fg px-3 text-[13px] font-medium text-onfg"><Maximize2 className="size-4" aria-hidden />Abrir en el mapa</button>
          </>
        ) : (
          <>
            <p className="flex-1 text-[13.5px] text-muted">Toca un tractor para ver su estado, horas de hoy y lote.</p>
            <button type="button" onClick={() => navigate('/mapa')} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink/[0.07] px-3 text-[13px] hover:bg-ink/[0.12]"><Maximize2 className="size-4" aria-hidden />Mapa completo</button>
          </>
        )}
      </div>
    </section>
  );
}
