// Panel lateral del mapa: lista «Flota», detalle del tractor y «Ajustes del tractor».
// Mismo contenido y comportamiento que el panel actual (bundle; fuente equivalente en
// versiones/antiguas/panel-flota/src/features/fleet/{list,detail}.js y settings/settings.js), con el diseño nuevo.
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowLeft, Bolt, Box, Check, Copy, Cpu, Crosshair, Eraser, Fuel, Gauge, Gauge as GaugeIcon, IdCard, LocateFixed, MapPin, Navigation, Play, Plug, Radio, Settings, Signal, Square, StickyNote, Timer, Wrench,
} from 'lucide-react';
import { CATALOG, brandName } from '../lib/catalog.js';
import { STATUS } from '../lib/fleet.js';
import { describeEvent, fmtAgo } from '../lib/format.js';
import { kmh, trailKm } from './ops.js';
import { Tractor3D } from './Tractor3D.jsx';
import { UbicacionTractor } from './UbicacionTractor.jsx';
import { EmptyFleet, FleetSearch, OperacionTractor, ServiceStatus } from './DeviceOps.jsx';
import { imeiCopied, normalizeCode, saveErrorMessage } from './deviceOps.js';

const nf1 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const h1 = (ms) => nf1.format((ms || 0) / 3600e3);
const RING = { running: '#6fd48f', idle: '#919c89', nosignal: '#ff6f61' };
const ORDER = { nosignal: 0, running: 1, idle: 2 };

/* ---------- avatar con logo de la marca y aro de estado ---------- */
export function BrandAvatar({ marca, st, size = 40 }) {
  const b = CATALOG[marca];
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full bg-white" style={{ width: size, height: size, boxShadow: `0 0 0 2px #0b140e, 0 0 0 4px ${RING[st]}, 0 0 14px -2px ${RING[st]}` }}>
      {(b?.mark || b?.logo) ? <img src={b.mark || b.logo} alt={b.name} className="size-[70%] object-contain" /> : <span className="text-[11px] font-bold text-slate-600">{b?.mono || '··'}</span>}
      <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-[3px] ring-2 ring-[#0b140e]" style={{ background: RING[st] }} />
    </span>
  );
}

/* ---------- lista ---------- */
export function FleetList({ store, snap, ids, onPick, onGear, q, onQ }) {
  const sum = store.summary();
  const tot = sum.total || 1;
  const rows = [...ids].sort((a, b) => ORDER[store.statusOf(a)] - ORDER[store.statusOf(b)] || snap.devices.get(a).name.localeCompare(snap.devices.get(b).name, 'es', { numeric: true }));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid gap-3 border-b border-ink/[0.06] p-4">
        <div className="flex items-baseline justify-between"><h2 className="display text-3xl">Flota</h2><span className="text-[13px] text-muted">{rows.length} de {sum.total} tractores</span></div>
        {onQ ? <FleetSearch value={q || ''} onChange={onQ} /> : null}
        <div className="flex h-1.5 overflow-hidden rounded-full bg-ink/[0.06]" role="img" aria-label="Estado de la flota">
          <i className="bg-ok" style={{ width: `${(100 * sum.running) / tot}%` }} /><i className="bg-muted" style={{ width: `${(100 * sum.idle) / tot}%` }} /><i className="bg-crit" style={{ width: `${(100 * sum.nosignal) / tot}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[['En marcha', sum.running, 'text-ok'], ['Apagados', sum.idle, ''], ['Sin señal', sum.nosignal, 'text-crit'], ['Horas hoy', h1(sum.engineMs), '']].map(([l, v, c]) => (
            <div key={l} className="rounded-xl bg-ink/[0.04] px-2.5 py-2 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.06*var(--t-hair-a)))]"><small className="block text-[11px] text-muted">{l}</small><b className={clsx('font-display text-xl font-normal tabular-nums', c)}>{v}</b></div>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Tractores">
        {!snap.loaded ? <li className="p-6 text-center text-muted">Cargando la flota…</li> : snap.error ? <li className="p-6 text-center text-crit">{snap.error}</li> : rows.length ? rows.map((id) => {
          const d = snap.devices.get(id), st = store.statusOf(id), lote = store.fenceOf(id);
          return (
            <li key={id} className="group flex items-center border-b border-ink/[0.04] transition hover:bg-ink/[0.04]">
              <button type="button" data-id={id} onClick={() => onPick(id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left">
                <BrandAvatar marca={d.attributes?.marca} st={st} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="truncate font-medium text-fg underline-offset-4 group-hover:underline">{d.name}</span>{d.attributes?.nivel ? <span className="rounded-md bg-ink/[0.06] px-1.5 text-[10.5px] text-muted shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))]">Niv. {d.attributes.nivel}</span> : null}</span>
                  <span className="block truncate text-[12.5px]"><span style={{ color: RING[st] }}>{STATUS[st].label}</span><span className="text-muted"> · {lote?.name || 'Fuera de lote'}</span></span>
                  <span className="block text-[11.5px] text-faint">{fmtAgo(d.lastUpdate)}</span>
                </span>
                <span className="text-right"><b className="block font-display text-lg font-normal tabular-nums">{h1(snap.engineToday.get(id))}</b><small className="text-[11px] text-faint">h hoy</small></span>
              </button>
              <button type="button" data-dev-gear={id} onClick={() => onGear(id)} aria-label={`Ajustes de ${d.name}`} title={`Ajustes de ${d.name}`}
                className="mr-3 grid size-9 shrink-0 place-items-center rounded-full text-muted opacity-70 transition hover:bg-ink/[0.08] hover:text-fg group-hover:opacity-100"><Settings className="size-[18px]" /></button>
            </li>
          );
        }) : <EmptyFleet />}
      </ul>
    </div>
  );
}

/* ---------- detalle ---------- */
function Row({ icon: Icon, main, sub }) {
  return <li className="flex items-start gap-4 border-b border-ink/[0.04] px-5 py-3 last:border-0"><Icon className="mt-0.5 size-[18px] shrink-0 text-accent" aria-hidden /><span className="min-w-0"><span className="block text-[14px]">{main}</span>{sub ? <span className="block text-[12.5px] text-muted">{sub}</span> : null}</span></li>;
}
function Quick({ icon: Icon, label, value, unit }) {
  return (
    <div className="rounded-2xl bg-ink/[0.04] p-3 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.06*var(--t-hair-a)))]">
      <span className="grid size-7 place-items-center rounded-lg bg-ink/[0.06] text-muted"><Icon className="size-4" aria-hidden /></span>
      <b className="mt-2 block font-display text-xl font-normal tabular-nums">{value}<small className="text-[12px] text-muted">{unit}</small></b>
      <span className="text-[11.5px] text-muted">{label}</span>
    </div>
  );
}
function Action({ icon: Icon, label, onClick, pressed, aria }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} aria-label={aria}
      className={clsx('grid justify-items-center gap-1.5 rounded-2xl px-2 py-3 text-[12.5px] transition', pressed ? 'bg-fg text-onfg' : 'bg-ink/[0.05] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))] hover:bg-ink/[0.09] hover:text-fg')}>
      <Icon className="size-[18px]" aria-hidden />{label}
    </button>
  );
}

export function FleetDetail({ id, store, snap, onBack, onFocus, follow, setFollow, onScene }) {
  const [tab, setTab] = useState('resumen');
  const [copied, setCopied] = useState(false);
  const d = snap.devices.get(id), p = snap.positions.get(id) || {};
  if (!d) return null;
  const st = store.statusOf(id), lote = store.fenceOf(id), a = p.attributes || {}, nivel = d.attributes?.nivel;
  const trail = snap.trails.get(id) || [];
  let ms = 0; for (let i = 1; i < trail.length; i++) { const dt = trail[i][2] - trail[i - 1][2]; if (dt > 0 && dt < 5 * 60e3) ms += dt; }
  const secs = Math.round(ms / 1000);
  const dur = secs < 3600 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${Math.floor(secs / 3600)} h ${Math.floor((secs % 3600) / 60)} min`;
  const sim = store.simState(), simOn = sim.id === id;
  const evs = snap.events.filter((e) => e.deviceId === id).slice(0, 30);
  const b = CATALOG[d.attributes?.marca];
  const [en3d, setEn3d] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(d.uniqueId); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sin portapapeles */ } };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4 animate-pop">
      <button type="button" onClick={onBack} className="m-3 flex items-center gap-2 rounded-xl px-2 py-1.5 text-[14px] text-accent hover:bg-ink/[0.06]"><ArrowLeft className="size-4" />Volver a flota</button>
      <section className="relative mx-4 overflow-hidden rounded-2xl bg-[linear-gradient(140deg,var(--t-raise),var(--t-panel))] p-5 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))]">
        {/* Solo el logo de la marca, en grande (sin el tractor dibujado) */}
        <span className="grid h-28 w-full place-items-center rounded-xl bg-white">
          {b?.logo ? <img src={b.logo} alt={b.name} className="max-h-24 max-w-[75%] object-contain" /> : <b className="text-3xl text-slate-500" title="Marca sin logotipo">{b?.mono || '··'}</b>}
        </span>
        <p className="mt-3 text-[14px] font-medium">{d.attributes?.modelo ? `Modelo ${d.attributes.modelo}` : brandName(d.attributes?.marca)}</p>
        <h2 className="display mt-2 text-4xl">{d.name}</h2>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-ink/[0.07] px-2 py-0.5 text-[12px] font-medium uppercase tracking-wide shadow-[inset_0_0_0_1px_currentColor]" style={{ color: RING[st] }}>
          <span className={clsx('size-1.5 rounded-full bg-current', st === 'running' && 'animate-pulse')} /><span className="text-fg">{STATUS[st].label}</span>
        </span>
        <p className="mt-3 flex items-center gap-1.5 text-[14px] text-soft"><MapPin className="size-4" />{lote?.name || 'Fuera de lote'}</p>
        {en3d ? <Tractor3D device={d} onClose={() => setEn3d(false)} /> : null}
      </section>
      <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
        <Quick icon={Timer} label="Horas hoy" value={h1(snap.engineToday.get(id))} unit=" h" />
        <Quick icon={GaugeIcon} label="Horómetro" value={typeof a.hours === 'number' ? h1(a.hours) : '—'} unit={typeof a.hours === 'number' ? ' h' : ''} />
        <Quick icon={Fuel} label="Diésel" value={typeof a.fuel === 'number' ? nf0.format(a.fuel) : '—'} unit={typeof a.fuel === 'number' ? ' L' : ''} />
      </div>
      <div className="mx-4 mt-3 grid grid-cols-4 gap-2">
        <Action icon={Crosshair} label="Centrar" onClick={() => onFocus(id)} />
        <Action icon={Box} label="Ver en 3D" onClick={() => setEn3d(true)} />
        <Action icon={LocateFixed} label={follow ? 'Siguiendo' : 'Seguir'} pressed={follow} onClick={() => setFollow(!follow)} />
        <Action icon={copied ? Check : Copy} label={copied ? 'Copiado' : 'IMEI'} aria="Copiar IMEI" onClick={copy} />
      </div>
      <p role="status" className="sr-only">{copied ? imeiCopied(d.uniqueId) : ''}</p>
      <UbicacionTractor key={`u${id}`} lat={p.latitude} lon={p.longitude} name={d.name} />
      {store.canCommand() ? <OperacionTractor key={id} id={id} store={store} simulated={snap.mode === 'mock'} /> : null}

      <section aria-label="Recorrido" className={clsx('mx-4 mt-3 rounded-2xl p-4 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))]', simOn && 'bg-accent/5 shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.5)]')}>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-accent/15 text-accent"><Navigation className="size-[18px]" /></span>
          <div className="min-w-0 flex-1"><b className="block text-[14px] font-medium">Recorrido</b><span className="block truncate text-[12px] text-muted">{simOn ? <span className="text-accent">Simulando trabajo por surcos</span> : trail.length > 1 ? 'Trazo de esta sesión' : 'Aún sin movimiento en esta sesión'}</span></div>
          {trail.length > 1 ? <button type="button" onClick={() => store.clearTrail(id)} aria-label="Limpiar trazo" title="Limpiar trazo" className="grid size-9 place-items-center rounded-full text-muted hover:bg-ink/[0.08] hover:text-fg"><Eraser className="size-4" /></button> : null}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[['Distancia', `${trailKm(trail).toFixed(2)} km`], ['En movimiento', dur], ['Puntos', trail.length]].map(([l, v]) => <div key={l} className="rounded-xl bg-ink/[0.04] px-3 py-2"><b className="block font-display text-lg font-normal tabular-nums">{v}</b><small className="text-[11px] text-muted">{l}</small></div>)}
        </div>
        {store.canSim() ? (
          <>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => store.simulate(simOn ? null : id)} className={clsx('flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-medium', simOn ? 'bg-ink/[0.08] text-fg' : 'bg-fg text-onfg')}>
                {simOn ? <Square className="size-4" /> : <Play className="size-4" />}{simOn ? 'Detener simulación' : 'Simular recorrido'}
              </button>
              <div className="flex rounded-full bg-ink/[0.06] p-0.5" role="group" aria-label="Velocidad de la simulación">
                {[1, 2, 4].map((v) => <button key={v} type="button" aria-pressed={sim.speed === v} onClick={() => store.simulate(sim.id, v)} className={clsx('rounded-full px-2.5 py-1 font-mono text-xs', sim.speed === v ? 'bg-ink/[0.14] text-fg' : 'text-muted hover:text-fg')}>{v}×</button>)}
              </div>
            </div>
            <p className="mt-2 text-[12px] text-faint">Modo simulado: el tractor recorre su lote surco por surco y el mapa lo sigue. Con Traccar se usará el historial de /api/positions.</p>
          </>
        ) : null}
      </section>

      <div role="tablist" className="mx-4 mt-4 grid grid-cols-2 border-b border-ink/[0.07]">
        {[['resumen', 'Resumen'], ['eventos', `Eventos${evs.length ? ` · ${evs.length}` : ''}`]].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={clsx('-mb-px border-b-2 py-2.5 text-[14px]', tab === k ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-soft')}>{l}</button>
        ))}
      </div>
      {tab === 'resumen' ? (
        <ul>
          <Row icon={MapPin} main={lote?.name || 'Fuera de lote'} sub={`${p.latitude?.toFixed(5) ?? '—'}, ${p.longitude?.toFixed(5) ?? '—'}`} />
          <Row icon={Gauge} main={`${nf0.format(kmh(p))} km/h`} sub={a.motion ? 'En movimiento' : 'Detenido'} />
          <Row icon={Bolt} main={typeof a.power === 'number' ? `${a.power.toFixed(1)} V` : 'Sin dato de voltaje'} sub={a.ignition ? 'Alternador cargando (D+ activo)' : 'Batería en reposo'} />
          {a.rpm !== undefined ? <Row icon={Cpu} main={`${Math.round(a.rpm)} RPM`} sub="Leído por CAN J1939" /> : null}
          <Row icon={Fuel} main={typeof a.fuel === 'number' ? `${Math.round(a.fuel)} L en tanque` : 'Sin sensor de combustible'} sub={typeof a.fuel === 'number' ? (nivel === 'B' ? 'Nivel por CAN' : 'Sonda BLE calibrada') : 'Solo tractores con sonda o nivel B'} />
          <Row icon={Signal} main={`Último reporte ${fmtAgo(d.lastUpdate)}`} sub={`IMEI ${d.uniqueId}`} />
        </ul>
      ) : (
        <ul>
          {evs.length ? evs.map((e) => {
            const { label, sev } = describeEvent(e);
            return <li key={e.id} className="flex items-center gap-3 border-b border-ink/[0.04] px-5 py-2.5"><span className={clsx('min-w-0 flex-1 text-[14px]', sev === 'crit' && 'font-medium text-crit')}>{label}</span><span className="font-mono text-[12px] text-muted">{new Date(e.eventTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}</span></li>;
          }) : <li className="px-5 py-8 text-center text-[13.5px] text-muted">Este tractor no tiene eventos hoy.</li>}
        </ul>
      )}
    </div>
  );
}

/* ---------- ajustes del tractor ---------- */
const input = 'h-10 w-full rounded-xl bg-ink/[0.05] px-3 text-[14px] text-fg outline-none shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))] focus:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.6)] placeholder:text-faint';
function Field({ label, hint, children }) { return <label className="grid gap-1.5 text-[13px] font-medium text-soft">{label}{children}{hint ? <span className="text-[11.5px] font-normal text-muted">{hint}</span> : null}</label>; }
function Section({ icon: Icon, title, text, children }) {
  return (
    <section className="grid gap-3 border-b border-ink/[0.06] px-4 py-5 last:border-0">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink/[0.06] text-accent"><Icon className="size-[18px]" /></span><div><b className="block text-[14.5px] font-medium">{title}</b><span className="text-[12.5px] text-muted">{text}</span></div></div>
      {children}
    </section>
  );
}

export function TractorSettings({ id, store, snap, onClose }) {
  const d = snap.devices.get(id);
  const a = d?.attributes || {};
  const [f, setF] = useState(() => ({ name: d?.name || '', operador: a.operador || '', marca: a.marca || '', modelo: a.modelo || '', loteBase: a.loteBase ?? '', nivel: a.nivel || 'A', sondaBLE: !!a.sondaBLE, servicioCada: a.servicioCada ?? 250, ultimoServicio: a.ultimoServicio ?? '', notas: a.notas || '' }));
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setMsg(null); }, [id]);
  if (!d) return null;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const hours = snap.positions.get(id)?.attributes?.hours;
  const actual = typeof hours === 'number' ? hours / 3600e3 : null;
  const cada = Number(f.servicioCada) || 250;

  async function guardar(e) {
    e.preventDefault();
    if (!normalizeCode(f.name)) return setMsg({ ok: false, text: 'Escribe el código del tractor.' });
    setSaving(true); setMsg(null);
    try {
      await store.saveDevice({ ...d, name: normalizeCode(f.name), attributes: { ...a, operador: f.operador.trim(), marca: f.marca, modelo: f.modelo.trim(), loteBase: f.loteBase === '' ? '' : Number(f.loteBase), nivel: f.nivel, sondaBLE: f.sondaBLE, servicioCada: cada, ultimoServicio: f.ultimoServicio === '' ? '' : Number(f.ultimoServicio), notas: f.notas.trim() } });
      setMsg({ ok: true, text: 'Tractor guardado.' });
      setTimeout(onClose, 500);
    } catch (err) { setMsg({ ok: false, text: saveErrorMessage(err) }); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={guardar} noValidate className="flex min-h-0 flex-1 flex-col animate-pop">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <button type="button" onClick={onClose} className="m-3 flex items-center gap-2 rounded-xl px-2 py-1.5 text-[14px] text-accent hover:bg-ink/[0.06]"><ArrowLeft className="size-4" />Volver a flota</button>
        <div className="mx-4 rounded-2xl bg-[linear-gradient(140deg,var(--t-raise),var(--t-panel))] p-5 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))]">
          <span className="text-[11.5px] uppercase tracking-[0.14em] text-accent">Ajustes del tractor</span>
          <h2 className="display mt-1 text-3xl">{f.name || d.name}</h2>
          <span className="text-[13.5px] text-soft">{f.marca ? `${brandName(f.marca)}${f.modelo ? ` · ${f.modelo}` : ''}` : 'Marca sin definir'}</span>
        </div>
        <Section icon={IdCard} title="Identificación" text="Cómo se llama y quién lo opera.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código del tractor" hint="Ej. TRC-0012"><input className={clsx(input, 'font-mono')} value={f.name} onChange={set('name')} required /></Field>
            <Field label="Operador asignado"><input className={input} value={f.operador} onChange={set('operador')} placeholder="Nombre" /></Field>
            <Field label="Marca"><select className={input} value={f.marca} onChange={set('marca')}><option value="">Sin especificar</option>{Object.entries(CATALOG).map(([k, b]) => <option key={k} value={k}>{b.name}</option>)}</select></Field>
            <Field label="Modelo"><input className={input} value={f.modelo} onChange={set('modelo')} placeholder="Ej. 5075E" /></Field>
          </div>
          <Field label="Lote habitual"><select className={input} value={f.loteBase} onChange={set('loteBase')}><option value="">Sin lote fijo</option>{snap.geofences.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        </Section>
        <Section icon={Radio} title="Equipo instalado" text="Define cómo se leen las horas y el combustible.">
          <fieldset className="grid grid-cols-2 gap-2"><legend className="sr-only">Nivel del rastreador</legend>
            {[['A', 'Nivel A', 'FMC130 · horas por señal D+', Plug], ['B', 'Nivel B', 'FMC150 · lectura por CAN', Cpu]].map(([v, t, s, Icon]) => (
              <label key={v} className={clsx('relative grid cursor-pointer gap-1 rounded-2xl p-3 transition', f.nivel === v ? 'bg-accent/10 shadow-[inset_0_0_0_1.5px_rgb(var(--accent-rgb)/0.7)]' : 'bg-ink/[0.04] shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))] hover:bg-ink/[0.07]')}>
                <input type="radio" name="nivel" value={v} checked={f.nivel === v} onChange={set('nivel')} className="sr-only" />
                <Icon className="size-4 text-muted" /><b className="text-[14px] font-medium">{t}</b><span className="text-[12px] text-muted">{s}</span>
                {f.nivel === v ? <Check className="absolute right-3 top-3 size-4 text-accent" /> : null}
              </label>
            ))}
          </fieldset>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl px-4 py-3 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))]">
            <span><b className="block text-[14px] font-medium">Sonda de combustible BLE</b><span className="text-[12px] text-muted">Activa la lectura de litros y las alertas de extracción.</span></span>
            <input type="checkbox" checked={f.sondaBLE} onChange={set('sondaBLE')} className="peer sr-only" />
            <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-ink/15 transition peer-checked:bg-ok after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
          </label>
        </Section>
        <Section icon={Wrench} title="Mantenimiento preventivo" text="Avisa cuando toca el siguiente servicio.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Servicio cada (h)"><input type="number" min="1" step="1" className={input} value={f.servicioCada} onChange={set('servicioCada')} /></Field>
            <Field label="Último servicio (h)"><input type="number" min="0" step="0.1" inputMode="decimal" className={input} value={f.ultimoServicio} onChange={set('ultimoServicio')} placeholder={actual != null ? actual.toFixed(1) : ''} /></Field>
          </div>
          <ServiceStatus hoursMs={hours} cada={cada} ultimo={f.ultimoServicio} />
        </Section>
        <Section icon={StickyNote} title="Notas" text="Fallas, refacciones u observaciones de la instalación.">
          <textarea rows={3} className={clsx(input, 'h-auto resize-y py-2')} value={f.notas} onChange={set('notas')} placeholder="Escribe aquí…" />
        </Section>
      </div>
      <div className="flex items-center gap-2 border-t border-ink/[0.07] p-3">
        <button type="submit" disabled={saving} className="flex h-10 items-center gap-2 rounded-2xl bg-fg px-5 text-[14px] font-medium text-onfg disabled:opacity-50"><Check className="size-4" />Guardar tractor</button>
        <button type="button" onClick={onClose} className="h-10 rounded-2xl px-4 text-[14px] text-soft hover:bg-ink/[0.06]">Cancelar</button>
        {msg ? <span role={msg.ok ? 'status' : 'alert'} className={clsx('ml-auto text-[13px]', msg.ok ? 'text-ok' : 'text-crit')}>{msg.text}</span> : null}
      </div>
    </form>
  );
}
