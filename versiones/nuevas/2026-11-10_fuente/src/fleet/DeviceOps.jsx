// Piezas de la ficha del tractor: «Operación del tractor» (comandos al equipo), estado del servicio con horómetro,
// buscador de la lista de flota y estados vacíos. Lógica en deviceOps.js.
import { useState } from 'react';
import clsx from 'clsx';
import { Plug, Power, Search, Tractor, X } from 'lucide-react';
import { controls, serviceInfo } from './deviceOps.js';

const nf1 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const hair = 'shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))]';
const TONE = { ok: ['bg-ok', 'text-ok'], warn: ['bg-warn', 'text-warn'], crit: ['bg-crit', 'text-crit'] };

/* ---------- servicio preventivo con «Horómetro actual» ---------- */
export function ServiceStatus({ hoursMs, cada, ultimo }) {
  const s = serviceInfo({ hoursMs, cada, ultimo });
  if (s.kind === 'sin-horometro') return <p className="text-[13px] text-muted">{s.text}</p>;
  const [bar, txt] = TONE[s.kind] || [];
  return (
    <div className={clsx('grid gap-2.5 rounded-xl bg-ink/[0.04] p-4', hair)} aria-live="polite">
      <div className="flex items-baseline justify-between gap-2 text-[13px]"><span className="text-muted">Horómetro actual</span><span className="font-mono tabular-nums">{nf1.format(s.actual)} h</span></div>
      {s.kind === 'sin-ultimo' ? <p className="text-[13px] text-muted">{s.text}</p> : (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.pct)} aria-label="Avance hacia el próximo servicio"><div className={clsx('h-full rounded-full', bar)} style={{ width: `${s.pct}%` }} /></div>
          <p className={clsx('text-[13px] font-medium', txt)}>{s.text}</p>
        </>
      )}
    </div>
  );
}

/* ---------- Operación del tractor ---------- */
// Cada control es un interruptor. «simOnly» solo existe con datos simulados; el corte de energía manda engineStop/engineResume.
export function OperacionTractor({ id, store, simulated }) {
  const [log, setLog] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const st = store.cmdState(id);
  const list = controls(st).filter((c) => simulated || !c.simOnly);
  const run = async (act) => {
    setBusy(true); setMsg(null);
    try {
      const r = await store.sendCommand(id, act);
      setLog((l) => [...r.log.map((x) => ({ ...x, t: new Date() })), ...l].slice(0, 6));
    } catch (e) { setMsg(e.message || 'No se pudo enviar el comando.'); } finally { setBusy(false); }
  };
  return (
    <section aria-label="Controles" className={clsx('mx-4 mt-3 grid gap-2 rounded-2xl p-4', hair)}>
      <div className="flex items-center gap-2"><Power className="size-4 text-accent" aria-hidden /><h3 className="text-[14px] font-medium">Operación del tractor</h3></div>
      {list.map((c) => (
        <button key={c.act} type="button" disabled={!c.enabled || busy} aria-pressed={c.on} onClick={() => run(c.act)}
          className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50', c.on ? 'bg-accent/10 shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.5)]' : cx(), c.act === 'cut' && c.on && 'bg-crit/10')}>
          <span className="min-w-0 flex-1"><b className="block text-[14px] font-medium">{c.label}</b><span className="block text-[12px] text-muted">{c.sub}</span></span>
          <span aria-hidden className={clsx('relative h-5 w-9 shrink-0 rounded-full transition', c.on ? 'bg-accent' : 'bg-ink/15')}><i className={clsx('absolute left-0.5 top-0.5 size-4 rounded-full bg-white transition', c.on && 'translate-x-4')} /></span>
        </button>
      ))}
      {msg ? <p role="alert" className="text-[12.5px] text-crit">{msg}</p> : null}
      <p className="flex items-center gap-1.5 px-1 text-[12px] text-muted"><Plug className="size-3.5" aria-hidden />{st.cut ? 'Equipo sin alimentación externa' : 'Alimentación externa conectada'} · {st.move ? 'Reportes cada 60 s' : 'Reportes cada 30 min detenido'}</p>
      {log.length ? (
        <ol className="max-h-32 overflow-y-auto border-t border-ink/[0.07] text-[12.5px]" aria-label="Bitácora de comandos">
          {log.map((x, i) => <li key={i} className="grid grid-cols-[44px_1fr] gap-2 border-b border-ink/[0.05] py-1.5"><time className="font-mono text-muted">{x.t.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}</time><span className={clsx(x.sev === 'crit' && 'font-medium text-crit', x.sev === 'warn' && 'font-medium text-warn', x.sev === 'ok' && 'font-medium text-ok')}>{x.text}</span></li>)}
        </ol>
      ) : null}
    </section>
  );
}
const cx = () => `bg-ink/[0.04] ${hair} hover:bg-ink/[0.07]`;

/* ---------- buscador de la lista (con «Borrar búsqueda») ---------- */
export function FleetSearch({ value, onChange }) {
  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className={clsx('flex h-10 items-center gap-2 rounded-xl bg-ink/[0.05] pl-3 pr-1 focus-within:bg-ink/[0.08]', hair)}>
      <Search className="size-4 shrink-0 text-muted" aria-hidden />
      <label htmlFor="fleet-q" className="sr-only">Buscar tractor o lote</label>
      <input id="fleet-q" type="search" autoComplete="off" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Buscar tractor, IMEI o lote…"
        className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden" />
      {value ? <button type="button" aria-label="Borrar búsqueda" title="Borrar búsqueda" onClick={() => onChange('')} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/[0.08] hover:text-fg"><X className="size-4" /></button> : null}
    </form>
  );
}

/* ---------- estados vacíos ---------- */
export function EmptyFleet() {
  return (
    <li className="grid justify-items-center gap-1 px-6 py-12 text-center">
      <Tractor className="mb-1 size-6 text-faint" aria-hidden />
      <span className="font-medium">Ningún tractor coincide</span>
      <span className="text-sm text-muted">Cambia la búsqueda o quita filtros en los chips de arriba.</span>
    </li>
  );
}
