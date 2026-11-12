// Sección «Lotes» del panel lateral del mapa (como la del panel viejo): lista de lotes con su actividad de hoy y, al elegir uno,
// «Lote y malla», tractores dentro y registros, con «Ver en mapa» y los ajustes del lote.
import { useState } from 'react';
import { ArrowLeft, MapPinned, Search, Settings } from 'lucide-react';
import { evInfo } from '../lib/events.js';
import { STATUS } from '../lib/fleet.js';
import { StatusDot } from '../ui/page.jsx';
import { LoteEditor } from './LoteEditor.jsx';
import { meshOf } from '../pages/Lotes.jsx';

const nf1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const Row = ({ k, v }) => <div className="flex justify-between gap-3 py-2 text-[13.5px]"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
const hm = (t) => new Date(t).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

// Tractores dentro de cada lote (con estado y horas de hoy)
function statsOf(g, snap, store) {
  const ids = [...snap.positions.values()].filter((p) => (p.geofenceIds || []).includes(g.id)).map((p) => p.deviceId);
  const trs = ids.map((id) => ({ id, st: store.statusOf(id), h: (snap.engineToday.get(id) || 0) / 3600e3 })).sort((a, b) => b.h - a.h);
  return { ids, trs, run: trs.filter((t) => t.st === 'running').length, horas: trs.reduce((n, t) => n + t.h, 0) };
}

function Detalle({ g, snap, store, onBack, onFit, onPick }) {
  const [edit, setEdit] = useState(false);
  const { trs, run, horas } = statsOf(g, snap, store);
  const at = g.attributes || {}, mesh = meshOf(g), set = new Set(trs.map((t) => t.id));
  const ev = snap.events.filter((e) => e.geofenceId === g.id || set.has(e.deviceId)).slice(0, 30);
  const ha = Number(at.superficie) || g.ha || 0;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-6 animate-pop">
      <div className="flex items-center gap-1 border-b border-ink/[0.07] px-3 pb-3 pt-2">
        <button type="button" onClick={onBack} aria-label="Volver a Lotes" title="Volver a Lotes" className="grid size-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-ink/[0.08] hover:text-fg"><ArrowLeft className="size-5" /></button>
        <div className="min-w-0 flex-1"><h2 className="truncate font-display text-lg leading-none">{g.name}</h2><p className="mt-1 text-[12px] text-muted">{trs.length} tractores · {run} en marcha · {nf1.format(horas)} h hoy</p></div>
        <button type="button" onClick={() => onFit(g.id)} className="h-9 rounded-xl bg-ink/[0.08] px-3 text-[13px] font-medium hover:bg-ink/[0.14]">Ver en mapa</button>
        <button type="button" onClick={() => setEdit(!edit)} aria-expanded={edit} aria-label={`Ajustes del lote ${g.name}`} title="Ajustes del lote" className="grid size-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-ink/[0.08] hover:text-fg"><Settings className="size-[18px]" /></button>
      </div>
      {edit ? <div className="mx-3 mt-3 rounded-2xl border border-ink/10 p-3"><LoteEditor key={g.id} g={g} store={store} onClose={() => setEdit(false)} /></div> : null}
      <section className="px-5 pt-4">
        <h3 className="text-[11.5px] uppercase tracking-[0.14em] text-accent">Lote y malla</h3>
        <dl className="divide-y divide-ink/[0.07]">
          <Row k="Cultivo" v={at.cultivo || '—'} /><Row k="Etapa" v={at.etapa || '—'} /><Row k="Responsable" v={at.responsable || '—'} />
          <Row k="Superficie registrada" v={at.superficie ? `${at.superficie} ha` : '—'} />
          {mesh ? <>
            <Row k="Superficie de la malla" v={`${nf1.format(g.ha || 0)} ha`} /><Row k="Perímetro" v={`${Math.round(mesh.per).toLocaleString('es-MX')} m`} />
            {mesh.pts.length ? <Row k="Vértices" v={mesh.pts.length} /> : <Row k="Radio" v={`${nf1.format(mesh.r)} m`} />}
            <Row k="Hectáreas por tractor" v={trs.length && ha ? `${nf1.format(ha / trs.length)} ha` : '—'} />
            <Row k="Centro" v={`${mesh.c[0].toFixed(5)}, ${mesh.c[1].toFixed(5)}`} />
          </> : <Row k="Malla" v="Sin polígono" />}
          <Row k="Horas máx. por tractor" v={at.horasMax ? `${at.horasMax} h` : 'Sin límite'} />
          <Row k="Alertas de lote" v={[at.alertaEntrada && 'entrada', at.alertaSalida && 'salida'].filter(Boolean).join(' y ') || 'Ninguna'} />
        </dl>
        {mesh?.pts.length ? <details className="pt-2 text-[13px]"><summary className="cursor-pointer text-accent">Ver vértices de la malla</summary><ol className="mt-2 grid gap-1 font-mono text-[12px] text-muted">{mesh.pts.map((p, i) => <li key={i}>{i + 1}. {p[0].toFixed(5)}, {p[1].toFixed(5)}</li>)}</ol></details> : null}
      </section>
      <section className="px-5 pt-5">
        <h3 className="text-[11.5px] uppercase tracking-[0.14em] text-accent">Tractores en el lote</h3>
        {trs.length ? (
          <ul className="divide-y divide-ink/[0.07]">{trs.map((t) => (
            <li key={t.id}><button type="button" onClick={() => onPick(t.id)} className="flex w-full items-center gap-3 py-2.5 text-left text-[13.5px] hover:text-accent"><StatusDot tone={STATUS[t.st].tone} /><span className="min-w-0 flex-1 truncate font-medium">{snap.devices.get(t.id)?.name || `#${t.id}`}</span><span className="text-[12px] text-muted">{STATUS[t.st].label}</span><span className="tabular-nums text-muted">{nf1.format(t.h)} h</span></button></li>
          ))}</ul>
        ) : <p className="py-2 text-[13.5px] text-muted">Ningún tractor en este lote ahora.</p>}
      </section>
      <section className="px-5 pt-5">
        <h3 className="text-[11.5px] uppercase tracking-[0.14em] text-accent">Registros del lote</h3>
        {ev.length ? (
          <ul className="divide-y divide-ink/[0.07]">{ev.map((e) => { const i = evInfo(e); return (
            <li key={e.id} className="flex items-start gap-3 py-2 text-[13px]"><StatusDot tone={i.high ? 'crit' : 'muted'} /><span className="min-w-0 flex-1"><b className="font-medium">{snap.devices.get(e.deviceId)?.name || `#${e.deviceId}`} — {i.label}</b><span className="block text-[12px] text-muted">{hm(e.eventTime)}</span></span></li>); })}</ul>
        ) : <p className="py-2 text-[13.5px] text-muted">Sin registros recientes en este lote.</p>}
      </section>
    </div>
  );
}

export function LotesPanel({ store, snap, lote, onLote, onFit, onPick }) {
  const [q, setQ] = useState('');
  const g = lote != null ? snap.geofences.find((x) => x.id === lote) : null;
  if (g) return <Detalle g={g} snap={snap} store={store} onBack={() => onLote(null)} onFit={onFit} onPick={onPick} />;
  const t = q.trim().toLowerCase();
  const rows = snap.geofences.map((x) => ({ g: x, ...statsOf(x, snap, store) })).filter((r) => !t || r.g.name.toLowerCase().includes(t) || String(r.g.attributes?.cultivo || '').toLowerCase().includes(t)).sort((a, b) => b.horas - a.horas);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pb-3 pt-4">
        <div className="flex items-baseline justify-between"><h2 className="display text-3xl">Lotes</h2><span className="text-[13px] text-muted">{snap.geofences.length} lotes · {nf1.format(snap.geofences.reduce((n, x) => n + (x.ha || 0), 0))} ha</span></div>
        <p className="text-[12.5px] text-muted">Toca un lote para ver su malla, tractores y registros.</p>
        <div className="mt-3 flex h-10 items-center gap-2 rounded-xl bg-ink/[0.05] px-3 focus-within:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.5)]">
          <Search className="size-4 text-muted" aria-hidden /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lote o cultivo" aria-label="Buscar lote" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
        </div>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-ink/[0.06] overflow-y-auto border-t border-ink/[0.07]">
        {rows.length ? rows.map((r) => (
          <li key={r.g.id}><button type="button" onClick={() => { onLote(r.g.id); onFit(r.g.id); }} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-ink/[0.04]">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink/[0.05]" style={{ color: r.g.attributes?.color || '#e6c97c' }}><MapPinned className="size-5" aria-hidden /></span>
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.g.name}</span><span className="block truncate text-[12.5px] text-muted">{r.trs.length} tractor{r.trs.length === 1 ? '' : 'es'} · {r.run} en marcha · {nf1.format(r.g.ha || 0)} ha</span></span>
            <span className="text-right"><b className="block font-display text-lg font-normal tabular-nums">{nf1.format(r.horas)}</b><span className="text-[11px] text-faint">h hoy</span></span>
          </button></li>
        )) : <li className="px-6 py-12 text-center text-[13.5px] text-muted">{t ? 'Ningún lote coincide.' : 'Aún no hay lotes. Dibuja los lotes en Traccar para verlos aquí.'}</li>}
      </ul>
    </div>
  );
}
