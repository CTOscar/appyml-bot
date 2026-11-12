// Tractores: tarjetas por marca y modelo con unidades, nivel, estado en vivo, horas de motor y operación de hoy.
// Tocar una tarjeta abre la tabla de sus unidades; tocar una unidad la abre en el mapa.
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { groupDevices, brandsOf } from '../lib/catalog.js';
import { WORK, fmtDur } from '../fleet/ops.js';
import { navigate } from '../app/router.js';
import { DataTable, PageHeader, Pills, StatusDot } from '../ui/page.jsx';
import { IconChip, Stat } from '../ui/index.jsx';
import { Info, Timer, Tractor, TriangleAlert } from 'lucide-react';
import { STATUS } from '../lib/fleet.js';
import { ico } from '../ui/menuIcons.js';

const nf1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

function OpsBar({ op }) {
  const tot = op.trabajo + op.transito + op.ralenti;
  // Con menos de 1 min medido las proporciones no significan nada: se avisa en vez de pintar una barra llena.
  const midiendo = tot < 60_000;
  return (
    <div className="grid gap-1.5">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
        {!midiendo ? ['trabajo', 'transito', 'ralenti'].map((k) => <span key={k} style={{ width: (100 * op[k]) / tot + '%', background: WORK[k].color }} />) : null}
      </div>
      <span className="text-[12px] text-muted">{midiendo ? 'Hoy: midiendo… (se acumula mientras el panel está abierto)' : <>Hoy: {fmtDur(op.trabajo)} trabajo · {fmtDur(op.transito)} tránsito · {fmtDur(op.ralenti)} parado</>}</span>
    </div>
  );
}

export function Tractores() {
  const { store, snap } = useFleet();
  const [brand, setBrand] = useState('todos');
  const [model, setModel] = useState(null);
  const groups = useMemo(() => groupDevices([...snap.devices.values()]), [snap]);
  const brands = brandsOf(groups);

  const live = (ids) => {
    const o = { running: 0, idle: 0, nosignal: 0, h: 0, A: 0, B: 0, op: { trabajo: 0, transito: 0, ralenti: 0 }, alertas: 0 };
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    o.alertas = snap.events.filter((e) => String(e.id).startsWith('op-') && ids.includes(e.deviceId) && new Date(e.eventTime) >= t0).length; // alertas de operación de hoy
    ids.forEach((id) => {
      o[store.statusOf(id)]++;
      o.h += snap.engineToday.get(id) || 0;
      const n = snap.devices.get(id)?.attributes?.nivel; if (n === 'A' || n === 'B') o[n]++;
      const w = store.workToday(id); o.op.trabajo += w.trabajo; o.op.transito += w.transito; o.op.ralenti += w.ralenti;
    });
    return o;
  };

  const vis = groups.filter((g) => brand === 'todos' || g.marca === brand);
  const sel = groups.find((g) => g.key === model);
  const total = snap.devices.size;
  const running = [...snap.devices.keys()].filter((id) => store.statusOf(id) === 'running').length;

  return (
    <div>
      <PageHeader title="Tractores" subtitle="Marcas y modelos de la flota, con su estado en vivo y la operación de hoy." />
      <section className="grid-stats mb-6" aria-label="Resumen">
        <Stat label="Tractores" value={total} />
        <Stat label="En marcha" value={running} tone="ok" />
        <Stat label="Modelos" value={groups.length} />
        <Stat label="Marcas" value={brands.length} />
      </section>

      <Pills label="Marca" className="mb-5" value={brand} onChange={(v) => { setBrand(v); setModel(null); }}
        options={[['todos', 'Todas', total], ...brands.map((b) => [b.marca, b.name, groups.filter((g) => g.marca === b.marca).reduce((s, g) => s + g.ids.length, 0)])]} />

      <section className="grid-cards" aria-label="Modelos">
        {vis.map((g, i) => {
          const l = live(g.ids), on = model === g.key;
          return (
            <button key={g.key} type="button" onClick={() => setModel(on ? null : g.key)} aria-pressed={on} style={{ animationDelay: 50 * i + 'ms' }}
              className={clsx('glass group grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden p-5 text-left transition animate-rise hover:-translate-y-0.5 hover:shadow-glow', on && 'shadow-[inset_0_0_0_1.5px_rgb(var(--accent-rgb)/0.7),0_0_40px_-12px_rgb(var(--accent-strong-rgb)/0.5)]')}>
              <span className="relative -mx-5 -mt-5 grid h-32 place-items-center overflow-hidden bg-white/90 shadow-[inset_0_-1px_0_rgb(var(--ink-rgb)/0.06)]">
                {/* Monograma de respaldo (JD, NH…) si el logo no carga; el logo lo cubre cuando existe */}
                <b aria-hidden className="text-3xl text-slate-300">{g.mono}</b>
                {g.logo ? <img src={g.logo} alt={g.brand} loading="lazy" decoding="async" onError={(e) => e.currentTarget.remove()} className="absolute inset-0 m-auto max-h-24 max-w-[62%] object-contain transition-transform duration-500 group-hover:scale-105" /> : null}
              </span>
              <span className="flex items-center gap-3">
                <span className="min-w-0">
                  <span className="display block text-3xl">{g.modelo}</span>
                  <span className="line-clamp-2 text-[12.5px] text-muted" title={`${g.brand} · ${g.tipo}${g.hp ? ` · ${g.hp} hp aprox.` : ''}`}>{g.brand} · {g.tipo}{g.hp ? ` · ${g.hp} hp aprox.` : ''}</span>
                </span>
              </span>
              {g.ids.length === 1 ? (
                // Una sola unidad del modelo: se muestra el tractor (nombre, nivel y estado), no un «1 unidad» ni contadores en 0/1.
                (() => {
                  const id = g.ids[0], d = snap.devices.get(id), st = store.statusOf(id), w = store.workOf(id), nv = d?.attributes?.nivel;
                  return (
                    <>
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="display text-3xl">{d?.name || `Equipo ${id}`}</span>
                        {nv ? <span className="ml-auto text-[12px] text-muted">Nivel {nv}</span> : null}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                        <span className="flex items-center gap-1.5"><StatusDot tone={STATUS[st].tone} />{STATUS[st].label}</span>
                        {WORK[w].label !== STATUS[st].label ? <span className="flex items-center gap-1.5 text-soft"><span className="size-2 rounded-full" style={{ background: WORK[w].color }} aria-hidden />{WORK[w].label}</span> : null}
                      </span>
                    </>
                  );
                })()
              ) : (
                <>
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="display text-4xl">{g.ids.length}</span><span className="text-soft">unidades</span>
                    <span className="ml-auto text-[12px] text-muted">Nivel A {l.A} · Nivel B {l.B}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                    <span className="flex items-center gap-1.5"><StatusDot tone="ok" />{l.running} en marcha</span>
                    <span className="flex items-center gap-1.5"><StatusDot tone="muted" />{l.idle} apagados</span>
                    <span className="flex items-center gap-1.5"><StatusDot tone="crit" />{l.nosignal} sin señal</span>
                  </span>
                </>
              )}
              <span className="flex items-center gap-2 border-t border-ink/[0.06] pt-3 text-[13px] text-soft"><Timer className="size-4 text-muted" strokeWidth={1.75} aria-hidden />Horas de motor hoy: <b className="font-medium text-fg">{nf1.format(l.h / 3600e3)} h</b></span>
              <OpsBar op={l.op} />
              {l.alertas ? <span className="flex items-center gap-1.5 text-[12.5px] text-warn"><TriangleAlert className="size-3.5" strokeWidth={2} aria-hidden />{l.alertas} {l.alertas === 1 ? 'alerta hoy' : 'alertas hoy'}</span> : null}
            </button>
          );
        })}
      </section>

      {sel ? (
        <section className="mt-8 animate-rise" aria-label={`Unidades ${sel.brand} ${sel.modelo}`}>
          <h2 className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-xl font-light sm:text-2xl">
            <IconChip icon={Tractor} svg={ico('tractores')} />
            <span>{sel.brand} {sel.modelo}</span>
            <span className="text-[13px] text-muted sm:text-[14px]">· {sel.ids.length} unidades · toca una para verla en el mapa</span>
          </h2>
          <DataTable caption="Unidades del modelo" onRow={(r) => navigate(`/mapa?d=${r.id}`)}
            rows={sel.ids.map((id) => ({ id, d: snap.devices.get(id) }))}
            cols={[
              { key: 'n', label: 'Tractor', render: (r) => <b className="font-medium">{r.d?.name}</b> },
              { key: 'nv', label: 'Nivel', render: (r) => r.d?.attributes?.nivel || '—' },
              { key: 'st', label: 'Estado', render: (r) => { const w = store.workOf(r.id); return <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: WORK[w].color }} />{WORK[w].label}</span>; } },
              { key: 'cx', label: 'Conexión', render: (r) => { const s = store.statusOf(r.id); return <span className="flex items-center gap-2"><StatusDot tone={STATUS[s].tone} />{STATUS[s].label}</span>; } },
              { key: 'l', label: 'Lote', render: (r) => store.fenceOf(r.id)?.name || '—' },
              { key: 'm', label: 'Motor hoy', align: 'right', render: (r) => `${nf1.format((snap.engineToday.get(r.id) || 0) / 3600e3)} h` },
              { key: 't', label: 'Trabajo hoy', align: 'right', render: (r) => fmtDur(store.workToday(r.id).trabajo) },
            ]} />
        </section>
      ) : null}

      <p className="mt-8 flex items-start gap-2.5 rounded-2xl border border-dashed border-ink/10 px-4 py-3 text-[12.5px] text-muted"><Info className="mt-0.5 size-4 shrink-0 text-faint" strokeWidth={1.75} aria-hidden /><span>Potencia nominal aproximada; confirma las fichas con el fabricante o el distribuidor. Las horas de operación se acumulan mientras el panel está abierto.</span></p>
    </div>
  );
}
