// Alertas: misma estructura y comportamiento que el panel actual (home.js, buildAlertas), con el diseño nuevo.
//  - Indicadores que filtran: Eventos, Alertas altas, Combustible, Corte de energía, Eventos de lote.
//  - «Eventos recientes» con filtros (Todos, Altas, Combustible, Energía, Encendido, Apagado, Lotes) y «Mostrar más» de 15 en 15.
//  - A la derecha: resumen por tipo de evento y tractores con más alertas altas.
//  - El nombre del tractor abre el mapa. #/alertas?ev=ID (desde la campana) marca ese evento y lo trae a la vista.
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { AL_FILTERS, ago, countEvents, matchFilter, sortedEvents } from '../lib/events.js';
import { STATUS } from '../lib/fleet.js';
import { navigate, useRoute } from '../app/router.js';
import { Empty, PageHeader, Pills, Section } from '../ui/page.jsx';
import { IconChip } from '../ui/index.jsx';
import { EventIcon } from '../ui/EventIcon.jsx';
import { BellRing, Fuel, ListFilter, MapPin, Plug, ShieldAlert, Siren, Trophy, BarChart3 } from 'lucide-react';

const hhmm = (ms) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

function CalBox({ ms }) {
  const d = new Date(ms);
  return (
    <time dateTime={d.toISOString().slice(0, 10)} className="grid w-12 shrink-0 overflow-hidden rounded-xl text-center shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]">
      <span className="bg-accent/90 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-onfg">{d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}</span>
      <span className="py-1 font-display text-xl leading-none">{String(d.getDate()).padStart(2, '0')}</span>
    </time>
  );
}

function Kpi({ value, label, tone, active, onClick, icon }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={clsx('glass stat-card grid gap-1.5 p-3.5 text-left transition hover:shadow-glow sm:p-4', active && 'shadow-[inset_0_0_0_1.5px_rgb(var(--accent-rgb)/0.7)]')}>
      <span className="flex items-center justify-between gap-2"><span className="min-w-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted sm:text-[12px]">{label}</span><IconChip icon={icon} tone={tone || (active ? 'accent' : 'muted')} size="sm" /></span>
      <span className={clsx('display text-[2rem] sm:text-4xl', tone === 'crit' && 'text-crit')}>{value}</span>
    </button>
  );
}

export function Alertas() {
  const { store, snap } = useFleet();
  const { query } = useRoute();
  // 'auto' = abre en «Altas» si las hay (lo importante primero) y en «Todos» si no; al elegir un filtro se respeta.
  const [picked, setFilter] = useState('auto');
  const [limit, setLimit] = useState(15);
  const [focus, setFocus] = useState(null);

  const ev = useMemo(() => sortedEvents(snap.events), [snap.events]);
  const cnt = countEvents(ev);
  const filter = picked === 'auto' ? (cnt.altas ? 'altas' : 'todos') : picked;
  const fences = useMemo(() => Object.fromEntries(snap.geofences.map((g) => [g.id, g.name])), [snap.geofences]);
  const devName = (id) => snap.devices.get(id)?.name || `Equipo ${id}`;
  const shown = ev.filter((x) => matchFilter(x, filter));
  const list = shown.slice(0, limit);

  // Desde la campana: #/alertas?ev=ID → filtro «Todos», abre hasta ese evento, lo marca y lo centra.
  useEffect(() => {
    const id = Number(query.ev);
    if (!id || !ev.length) return;
    const ix = ev.findIndex((x) => x.e.id === id);
    setFilter('todos'); setFocus(id); setLimit(Math.max(15, Math.ceil((ix + 1) / 15) * 15));
    setTimeout(() => document.getElementById('al-' + id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
  }, [query.ev, ev.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (f) => { setFilter(f); setLimit(15); };
  const byType = {}; ev.forEach((x) => { byType[x.i.label] = (byType[x.i.label] || 0) + 1; });
  const types = Object.keys(byType).sort((a, b) => byType[b] - byType[a]), mx = types.length ? byType[types[0]] : 1;
  const byDev = {}; ev.forEach((x) => { if (x.i.high) byDev[x.e.deviceId] = (byDev[x.e.deviceId] || 0) + 1; });
  const worst = Object.keys(byDev).map(Number).sort((a, b) => byDev[b] - byDev[a]).slice(0, 6);

  return (
    <div>
      <PageHeader title="Alertas" />
      <section className="grid-stats mb-8" aria-label="Indicadores">
        <Kpi icon={BellRing} value={cnt.todos} label="Eventos" active={filter === 'todos'} onClick={() => pick('todos')} />
        <Kpi icon={Siren} value={cnt.altas} label="Alertas altas" tone="crit" active={filter === 'altas'} onClick={() => pick('altas')} />
        <Kpi icon={Fuel} value={cnt.combustible || 0} label="Combustible" active={filter === 'combustible'} onClick={() => pick('combustible')} />
        <Kpi icon={Plug} value={cnt.energia || 0} label="Corte de energía" active={filter === 'energia'} onClick={() => pick('energia')} />
        <Kpi icon={MapPin} value={cnt.geocerca || 0} label="Eventos de lote" active={filter === 'geocerca'} onClick={() => pick('geocerca')} />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Section id="al-rec" icon={BellRing} title="Eventos recientes" subtitle="Alertas y avisos de tus tractores" action={<span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted"><ListFilter className="size-3.5" aria-hidden />{shown.length} {shown.length === 1 ? 'evento' : 'eventos'}</span>}>
          <Pills label="Filtro" className="mb-4" value={filter} onChange={pick} options={AL_FILTERS.map(([k, l]) => [k, l, cnt[k] || 0])} />
          {list.length ? (
            <ol className="grid gap-1">
              {list.map((x) => {
                const lote = x.e.geofenceId && fences[x.e.geofenceId];
                return (
                  <li key={x.e.id} id={'al-' + x.e.id}
                    className={clsx('flex items-center gap-3 rounded-2xl p-2.5 transition', focus === x.e.id ? 'bg-accent/10 shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.5)]' : 'hover:bg-ink/[0.03]')}>
                    <CalBox ms={x.at} />
                    <EventIcon e={x.e} />
                    <div className="min-w-0">
                      <button type="button" onClick={() => navigate(`/mapa?d=${x.e.deviceId}`)} className="text-left font-medium text-fg underline-offset-4 hover:text-accent hover:underline">
                        {devName(x.e.deviceId)} — {x.i.label}
                      </button>
                      <p className="text-[12.5px] text-muted">
                        {hhmm(x.at)} · {ago(x.at)}{lote ? ` · ${lote}` : ''}{x.i.high ? <> · <b className="font-semibold text-crit">alta</b></> : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : <Empty title="Sin eventos" text="No hay eventos para este filtro." />}
          {shown.length > limit ? (
            <button type="button" onClick={() => setLimit(limit + 15)} className="mt-3 w-full rounded-2xl bg-ink/[0.05] py-2.5 text-[14px] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))] hover:bg-ink/[0.09] hover:text-fg">
              Mostrar más ({shown.length - limit})
            </button>
          ) : null}
        </Section>

        <aside className="grid gap-4 sm:gap-6">
          <Section id="al-res" icon={BarChart3} title="Resumen" subtitle="Por tipo de evento">
            <ul className="grid gap-2.5">
              {types.map((t) => (
                <li key={t} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-3 text-[13.5px]">
                  <span className="text-soft" title={t}>{t}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-ink/[0.06]"><span className="block h-full rounded-full bg-gradient-to-r from-ok/70 to-accent" style={{ width: `${(100 * byType[t]) / mx}%` }} /></span>
                  <b className="text-right font-medium tabular-nums">{byType[t]}</b>
                </li>
              ))}
            </ul>
          </Section>
          <Section id="al-mas" icon={Trophy} tone="crit" title="Más alertas" subtitle="Tractores con más alertas altas">
            {worst.length ? (
              <ul className="line-list grid">
                {worst.map((id) => (
                  <li key={id} className="flex items-center gap-3">
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-crit/15 text-crit shadow-[inset_0_0_0_1px_rgb(var(--crit-rgb)/0.35),0_0_18px_-4px_rgb(var(--crit-rgb)/0.7)]"><ShieldAlert className="size-[18px]" strokeWidth={2.2} /></span>
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => navigate(`/mapa?d=${id}`)} className="font-medium hover:text-accent">{devName(id)}</button>
                      <p className="text-[12.5px] text-muted">{STATUS[store.statusOf(id)].label}</p>
                    </div>
                    <em className="text-[13px] not-italic text-crit">{byDev[id]} {byDev[id] === 1 ? 'alerta' : 'alertas'}</em>
                  </li>
                ))}
              </ul>
            ) : <Empty title="Sin alertas altas" text="Ningún tractor tiene alertas altas." />}
          </Section>
        </aside>
      </div>
    </div>
  );
}

