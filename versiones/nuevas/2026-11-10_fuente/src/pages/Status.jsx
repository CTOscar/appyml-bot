// Status: estado del servicio (componentes, incidentes, mantenimientos y 90 días de disponibilidad).
// Modelo en src/lib/status-model.js (datos de demostración en este navegador hasta conectar endpoints de salud).
// Solo los administradores ven el botón «Administrar».
import { useMemo, useReducer, useState } from 'react';
import clsx from 'clsx';
import { Activity, CalendarClock, ChevronDown, History, ShieldCheck } from 'lucide-react';
import { useAuth } from '../app/auth.jsx';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { ALL, DAYS, GROUPS, LABELS, PHASES, createStatus, dayKey, worst } from '../lib/status-model.js';
import { PageHeader, SectionTitle } from '../ui/page.jsx';
import { Button } from '../ui/index.jsx';

const DAY = 864e5;
const fmtDay = (d) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtUTC = (d) => `${new Date(d).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false })} UTC`;
const BAR = { operational: 'bg-ok/80', degraded: 'bg-warn', partial: 'bg-[#f08a3c]', major: 'bg-crit', maintenance: 'bg-info', nodata: 'bg-ink/10' };
const TXT = { operational: 'text-ok', degraded: 'text-warn', partial: 'text-[#f08a3c]', major: 'text-crit', maintenance: 'text-info' };
const BANNER = { operational: ['Todos los sistemas operativos', 'bg-ok/10 text-ok'], maintenance: ['Mantenimiento en curso', 'bg-info/10 text-info'], degraded: ['Algunos sistemas con rendimiento degradado', 'bg-warn/10 text-warn'] };
const field = 'h-10 w-full rounded-xl bg-ink/[0.05] px-3 text-[14px] text-fg outline-none shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))] focus:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.55)]';

function Bars({ S, comp, now }) {
  const h = S.hist[comp] || {};
  return (
    <div className="flex h-8 gap-[2px]" role="img" aria-label={`Últimos ${DAYS} días de ${comp}`}>
      {Array.from({ length: DAYS }, (_, k) => {
        const i = DAYS - 1 - k, d = now - i * DAY, s = h[dayKey(d)] || 'operational';
        return <span key={k} title={`${fmtDay(d)} · ${s === 'nodata' ? 'Sin datos' : s === 'operational' ? 'Sin interrupciones' : LABELS[s]}`} className={clsx('flex-1 rounded-[2px] transition hover:opacity-70', BAR[s])} />;
      })}
    </div>
  );
}

export function Status() {
  const { user } = useAuth();
  const { store, snap } = useFleet();
  const model = useMemo(() => createStatus({ storage: globalThis.localStorage }), []);
  const [, redraw] = useReducer((x) => x + 1, 0);
  const [form, setForm] = useState(null); // 'inc' | 'mt'
  const S = model.state(), now = model.clock(), adm = user?.role === 'admin' && S.admin;
  const act = (fn) => { fn(); model.save(); redraw(); };
  const overall = worst(ALL.map((c) => S.comps[c]));
  const [bTxt, bCls] = BANNER[overall] || ['Algunos sistemas con interrupciones', 'bg-crit/10 text-crit'];
  const avg = ALL.reduce((a, c) => a + model.uptime(c), 0) / ALL.length;
  const sum = snap.loaded ? store.summary() : null;

  const submit = (kind) => (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    act(() => (kind === 'inc' ? model.actions.incident(f) : model.actions.maintenance(f)));
    setForm(null);
  };

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Estado del servicio · BuildWise Labs" title="Status">
        {user?.role === 'admin' ? <Button variant={S.admin ? 'primary' : 'glass'} onClick={() => act(() => model.actions.admin())}><ShieldCheck className="size-4" />{S.admin ? 'Modo administrador' : 'Administrar'}</Button> : null}
      </PageHeader>

      <div className={clsx('glass flex items-center gap-3 px-5 py-4 font-display text-xl', bCls)}><span className="size-2.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />{bTxt}</div>
      {sum ? <p className="-mt-3 text-[14px] text-muted">Flota en vivo: <b className="text-fg">{sum.running}</b> en marcha · <b className="text-fg">{sum.idle}</b> apagados · <b className={sum.nosignal ? 'text-crit' : 'text-fg'}>{sum.nosignal}</b> sin señal</p> : null}

      {adm ? (
        <section className="glass grid gap-3 p-5" aria-label="Controles de administrador">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={form === 'inc' ? 'primary' : 'glass'} onClick={() => setForm(form === 'inc' ? null : 'inc')}>Reportar incidente</Button>
            <Button size="sm" variant={form === 'mt' ? 'primary' : 'glass'} onClick={() => setForm(form === 'mt' ? null : 'mt')}>Programar mantenimiento</Button>
            <Button size="sm" variant="ghost" onClick={() => act(() => model.actions.reset())}>Restablecer demostración</Button>
          </div>
          {form === 'inc' ? (
            <form onSubmit={submit('inc')} className="grid gap-2 sm:grid-cols-2">
              <input name="title" required placeholder="Título (p. ej. Errores al iniciar sesión)" className={clsx(field, 'sm:col-span-2')} />
              <select name="comp" className={field}>{ALL.map((c) => <option key={c}>{c}</option>)}</select>
              <select name="sev" className={field} defaultValue="degraded">{['degraded', 'partial', 'major'].map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}</select>
              <select name="phase" className={field}>{PHASES.slice(0, 3).map((p) => <option key={p}>{p}</option>)}</select>
              <input name="msg" required placeholder="Mensaje para los usuarios" className={field} />
              <Button type="submit" variant="primary" className="sm:col-span-2 sm:justify-self-start">Publicar incidente</Button>
            </form>
          ) : null}
          {form === 'mt' ? (
            <form onSubmit={submit('mt')} className="grid gap-2 sm:grid-cols-2">
              <input name="title" required placeholder="Título (p. ej. Actualización de seguridad)" className={clsx(field, 'sm:col-span-2')} />
              <select name="comp" className={field}>{ALL.map((c) => <option key={c}>{c}</option>)}</select>
              <input name="start" type="datetime-local" required className={field} />
              <input name="hours" type="number" min="1" defaultValue="1" className={field} aria-label="Horas" />
              <input name="text" required placeholder="Qué se hará y si habrá interrupción" className={field} />
              <Button type="submit" variant="primary" className="sm:col-span-2 sm:justify-self-start">Programar</Button>
            </form>
          ) : null}
        </section>
      ) : null}

      {S.incidents.map((i) => (
        <article key={i.id} className="glass grid gap-2 border-l-2 border-warn p-5">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-xl">{i.title}</h2><span className="rounded-full bg-info/15 px-2.5 py-0.5 text-[12px] text-info">{i.phase}</span><span className="text-[13px] text-muted">{i.comp}</span></div>
          {i.updates.map((u, k) => <p key={k} className="text-[14px] text-soft"><b className="font-medium text-fg">{u.phase}</b> — {u.msg}<span className="block text-[12px] text-faint">{fmtUTC(u.t)}</span></p>)}
          {adm ? (
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); act(() => model.actions.update(i.id, f.phase, f.msg)); e.currentTarget.reset(); }}>
              <select name="phase" defaultValue={i.phase} className={clsx(field, 'w-auto')}>{PHASES.map((p) => <option key={p}>{p}</option>)}</select>
              <input name="msg" required placeholder="Agrega una actualización" className={clsx(field, 'min-w-48 flex-1')} />
              <Button type="submit" size="sm" variant="primary" className="h-10">Actualizar</Button>
            </form>
          ) : null}
        </article>
      ))}

      <div className="flex flex-wrap items-baseline justify-between gap-2"><SectionTitle icon={Activity}>Disponibilidad</SectionTitle><span className="text-[14px] text-muted">Últimos {DAYS} días: <b className="text-fg">{avg.toFixed(2)} %</b></span></div>
      {GROUPS.map((g) => {
        const gs = worst(g.comps.map((c) => S.comps[c[0]]));
        return (
          <details key={g.name} open className="glass group overflow-hidden p-0">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
              <ChevronDown className="size-4 text-muted transition group-open:rotate-180" aria-hidden /><span className="font-display text-lg">{g.name}</span>
              <span className={clsx('ml-auto text-[13px]', TXT[gs])}>{LABELS[gs]}</span>
            </summary>
            <div className="grid gap-5 border-t border-ink/[0.06] px-5 py-4">
              {g.comps.map(([name, desc]) => {
                const st = S.comps[name];
                return (
                  <div key={name} className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="font-medium">{name}</b><span className="text-[13px] text-muted">· {desc}</span>
                      {adm ? (
                        <select value={st} onChange={(e) => act(() => model.actions.setComp(name, e.target.value))} className={clsx(field, 'ml-auto h-8 w-auto text-[13px]')} aria-label={`Estado de ${name}`}>
                          {Object.keys(LABELS).map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}
                        </select>
                      ) : <span className={clsx('ml-auto text-[13px]', TXT[st])}>{LABELS[st]}</span>}
                    </div>
                    <Bars S={S} comp={name} now={now} />
                    <div className="flex justify-between text-[11.5px] text-faint"><span>Hace {DAYS} días</span><span>{model.uptime(name).toFixed(2)} % de disponibilidad</span><span>Hoy</span></div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}

      <SectionTitle icon={CalendarClock} tone="warn">Mantenimiento programado</SectionTitle>
      {[...S.maint].sort((a, b) => a.start - b.start).map((m) => {
        const prog = m.state === 'progress';
        return (
          <article key={m.id} className="glass grid gap-1.5 border-l-2 border-info p-5">
            <div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-lg">{m.title}</h3><span className={clsx('rounded-full px-2.5 py-0.5 text-[12px]', prog ? 'bg-warn/15 text-warn' : 'bg-info/15 text-info')}>{prog ? 'En curso' : 'Programado'}</span><span className="text-[13px] text-muted">{m.comp}</span></div>
            <p className="text-[14px]"><b className="font-medium">{fmtUTC(m.start)}</b> – <b className="font-medium">{fmtUTC(m.start + m.hours * 36e5)}</b></p>
            <p className="text-[14px] text-muted">{m.text}</p>
            {adm ? (
              <div className="mt-1 flex gap-2">
                {prog ? <Button size="sm" variant="primary" onClick={() => act(() => model.actions.doneMaint(m.id))}>Completar</Button> : <Button size="sm" onClick={() => act(() => model.actions.startMaint(m.id))}>Iniciar ahora</Button>}
                <Button size="sm" variant="ghost" onClick={() => act(() => model.actions.cancelMaint(m.id))}>Cancelar</Button>
              </div>
            ) : null}
          </article>
        );
      })}
      {!S.maint.length ? <p className="text-muted">No hay mantenimientos programados.</p> : null}

      <SectionTitle icon={History} tone="muted">Incidentes pasados</SectionTitle>
      <div className="grid-wide">
        {S.past.slice(0, 12).map((p) => (
          <article key={p.id} className="glass grid gap-1 p-4">
            <span className="text-[12px] text-faint">{fmtDay(`${p.day}T12:00:00Z`)}</span>
            <h3 className="font-medium">{p.title} <span className="ml-1 rounded-full bg-ok/15 px-2 py-0.5 text-[11px] text-ok">Resuelto</span></h3>
            <p className="text-[13.5px] text-muted">{p.text}</p>
          </article>
        ))}
      </div>
      <p className="rounded-2xl border border-dashed border-ink/10 px-4 py-3 text-[12.5px] text-muted">Los datos son de demostración y se guardan en este navegador. Para estado real, conecta cada componente a un endpoint de salud.</p>
    </div>
  );
}
