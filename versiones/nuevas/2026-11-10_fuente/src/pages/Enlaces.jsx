// Enlaces: fichas de equipos, tiendas y servicios del proyecto, por categoría y con buscador. Abren en otra pestaña.
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Cpu, ExternalLink, Fuel, Layers, Search, Wrench } from 'lucide-react';
import { LINK_GROUPS, hostOf, safeHref } from '../lib/links.js';
import { detailOf } from '../lib/linkDetails.js';
import { Empty, PageHeader, Pills } from '../ui/page.jsx';
import { EnlaceDetalle } from './EnlaceDetalle.jsx';

const ICON = { Rastreadores: Cpu, Sensores: Fuel, 'Instalación': Wrench, Plataforma: Layers };
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterLinks(groups, cat, q) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  return groups.flatMap((g) => g.links.map((l) => ({ ...l, cat: g.title })))
    .filter((it) => (cat === 'todos' || it.cat === cat) && toks.every((t) => norm(`${it.label} ${it.note} ${hostOf(it.href)} ${it.cat}`).includes(t)));
}

export function Enlaces({ route }) {
  const id = route?.rest?.[0];
  useEffect(() => { window.scrollTo(0, 0); }, [id]); // abrir o cerrar una ficha cambia solo el hash: se vuelve arriba
  if (id) return <EnlaceDetalle id={decodeURIComponent(id)} />;
  return <Lista />;
}

function Lista() {
  const [cat, setCat] = useState('todos');
  const [q, setQ] = useState('');
  const items = useMemo(() => filterLinks(LINK_GROUPS, cat, q), [cat, q]);
  const total = LINK_GROUPS.reduce((s, g) => s + g.links.length, 0);
  return (
    <div>
      <PageHeader title="Enlaces" subtitle="Fichas de equipos, tiendas y servicios del proyecto. Toca uno para ver sus características, configuración e instalación sin salir del panel.">
        <div className="flex h-10 w-72 max-w-full items-center gap-2 rounded-full bg-ink/[0.05] px-4 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))] focus-within:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.5)]">
          <Search className="size-4 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un enlace…" aria-label="Buscar un enlace" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
        </div>
      </PageHeader>
      <Pills label="Categoría" className="mb-6" value={cat} onChange={setCat} options={[['todos', 'Todos', total], ...LINK_GROUPS.map((g) => [g.title, g.title, g.links.length])]} />
      {items.length ? (
        <section className="grid-cards" aria-label="Enlaces">
          {items.map((it, i) => {
            const Icon = ICON[it.cat] || ExternalLink;
            return (
              <a key={it.href} {...(detailOf(it.id) ? { href: '#/enlaces/' + it.id } : { href: safeHref(it.href), target: '_blank', rel: 'noopener noreferrer' })} style={{ animationDelay: 40 * i + 'ms' }}
                className="glass group flex min-w-0 flex-col overflow-hidden p-0 transition animate-rise hover:-translate-y-0.5 hover:shadow-glow">
                <span className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-white">
                  <Icon className="size-10 text-slate-300" aria-hidden />
                  {it.image ? <img src={it.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(e) => e.currentTarget.remove()} className="absolute inset-0 m-auto max-h-[calc(100%-2rem)] max-w-[calc(100%-2rem)] object-contain transition duration-300 group-hover:scale-105" /> : null}
                  <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg bg-night/70 text-fg opacity-0 transition group-hover:opacity-100">{detailOf(it.id) ? <ChevronRight className="size-4" /> : <ExternalLink className="size-4" />}</span>
                </span>
                <span className="grid gap-0.5 p-4">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-accent">{it.cat}</span>
                  <span className="truncate font-display text-lg">{it.label}</span>
                  <span className="truncate text-[13px] text-muted">{it.note}</span>
                  <span className="truncate font-mono text-[11.5px] text-faint">{hostOf(it.href)}</span>
                </span>
              </a>
            );
          })}
        </section>
      ) : <Empty icon={Search} title="Ningún enlace coincide" text={`Nada coincide con «${q}».`} />}
      <p className="mt-8 rounded-2xl border border-dashed border-ink/10 px-4 py-3 text-[12.5px] text-muted">Los enlaces salen de <code>src/lib/links.js</code> y sus fichas de <code>src/lib/linkDetails.js</code>. Las ligas externas (tiendas, fabricantes) pueden cambiar de precio o desaparecer.</p>
    </div>
  );
}
