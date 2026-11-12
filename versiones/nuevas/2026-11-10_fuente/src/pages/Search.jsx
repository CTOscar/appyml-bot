// Búsqueda global: tractores (nombre o IMEI), lotes y páginas. Flechas ↑↓ + Enter para abrir.
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { CornerDownLeft, FileText, MapPin, Search as SearchIcon, Tractor } from 'lucide-react';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { ROUTES, navigate } from '../app/router.js';
import { STATUS } from '../lib/fleet.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchAll(q, { devices = [], fences = [], statusOf = () => 'idle' } = {}) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const hit = (txt) => toks.every((t) => norm(txt).includes(t));
  const out = [];
  // Primero los que coinciden por nombre (TRC-0012 antes que un IMEI que contiene «12»); dentro de eso, el número exacto.
  const compact = norm(q).replace(/[^a-z0-9]/g, '');
  const rank = (d) => { const n = norm(d.name).replace(/[^a-z0-9]/g, ''); return hit(d.name) ? (n.replace(/(\D)0+(\d)/, '$1$2') === compact.replace(/(\D)0+(\d)/, '$1$2') ? 0 : 1) : 2; };
  devices.filter((d) => hit(`${d.name} ${d.uniqueId} ${d.attributes?.marca || ''} ${d.attributes?.modelo || ''}`))
    .map((d) => [rank(d), d]).sort((a, b) => a[0] - b[0])
    .forEach(([, d]) => out.push({ kind: 'tractor', id: d.id, title: d.name, sub: `${STATUS[statusOf(d.id)].label} · IMEI ${d.uniqueId}`, go: `/mapa?d=${d.id}` }));
  fences.forEach((g) => { if (hit(g.name)) out.push({ kind: 'lote', id: g.id, title: g.name, sub: g.ha ? `${g.ha.toFixed(1)} ha` : 'Lote', go: `/mapa?l=${g.id}` }); });
  ROUTES.filter((r) => !r.hidden && !r.admin).forEach((r) => { if (hit(r.label)) out.push({ kind: 'pagina', id: r.path, title: r.label, sub: 'Página', go: r.path }); });
  return out.slice(0, 40);
}

const ICON = { tractor: Tractor, lote: MapPin, pagina: FileText };

export function Search() {
  const { store, snap } = useFleet();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  const res = useMemo(() => searchAll(q, { devices: [...snap.devices.values()], fences: snap.geofences, statusOf: store.statusOf }), [q, snap, store]);
  useEffect(() => setSel(0), [q]);

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => Math.min(res.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => Math.max(0, i - 1)); }
    if (e.key === 'Enter' && res[sel]) navigate(res[sel].go);
  };

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-6 pt-10">
      <h1 className="display glow text-center text-5xl sm:text-6xl animate-rise">Buscar</h1>
      <div className="flex h-14 items-center gap-3 rounded-full bg-ink/[0.05] pl-5 pr-2 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a))),0_10px_40px_-12px_rgb(var(--accent-strong-rgb)/0.3)] focus-within:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.55),0_10px_40px_-12px_rgb(var(--accent-strong-rgb)/0.45)]">
        <SearchIcon className="size-5 text-muted" aria-hidden />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Tractor, IMEI, lote o página…" aria-label="Buscar"
          role="combobox" aria-expanded={res.length > 0} aria-controls="resultados" aria-activedescendant={res[sel] ? `r-${sel}` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-faint" />
        <span className="hidden items-center gap-1 rounded-full bg-ink/[0.06] px-2.5 py-1 text-[12px] text-muted sm:flex"><CornerDownLeft className="size-3.5" />abrir</span>
      </div>
      <ul id="resultados" role="listbox" className="grid gap-1">
        {q && !res.length ? <li className="py-8 text-center text-muted">Nada coincide con «{q}».</li> : null}
        {res.map((r, i) => {
          const Icon = ICON[r.kind];
          return (
            <li key={r.kind + r.id} id={`r-${i}`} role="option" aria-selected={i === sel}>
              <a href={'#' + r.go} onMouseEnter={() => setSel(i)}
                className={clsx('flex items-center gap-3 rounded-2xl px-4 py-3 transition', i === sel ? 'bg-ink/[0.08] shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]' : 'hover:bg-ink/[0.04]')}>
                <span className="grid size-9 place-items-center rounded-xl bg-ink/[0.06] text-accent"><Icon className="size-4" aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-fg">{r.title}</span><span className="block truncate text-[13px] text-muted">{r.sub}</span></span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
