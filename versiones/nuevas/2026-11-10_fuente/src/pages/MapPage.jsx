// Mapa en vivo: el mapa ocupa toda la pantalla; encima flotan la barra superior, el panel de flota,
// los controles y la tarjeta «Operación de hoy». En celular el panel es una hoja inferior.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CloudRain, Wrench, Crosshair as CrosshairIcon, Expand, LocateFixed, MapPinned, MessageSquare, Minus, Plus, Ruler, Settings, Trash2,
} from 'lucide-react';
import { MAP_DEFAULTS } from '../lib/units.js';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { MapView, LAYER_NAMES } from '../fleet/MapView.jsx';
import { FleetDetail, FleetList, TractorSettings } from '../fleet/FleetPanel.jsx';
import { WORK, WORK_ORDER, fmtDur, kmh, trailKm } from '../fleet/ops.js';
import { getOps } from '../fleet/opsConfig.js';
import { OpsSettingsInline } from '../fleet/OpsSettingsInline.jsx';
import { LotesPanel } from '../fleet/LotesPanel.jsx';
import { STATUS } from '../lib/fleet.js';
import { fmtAgo } from '../lib/format.js';
import { navigate, useRoute } from '../app/router.js';
import { Badge } from '../ui/index.jsx';
import { MapToolsPanel, PlaybackBar, useMapTools } from '../fleet/MapToolsPanel.jsx';
import { InteractMenu, InteractOverlays, useInteractState, useMapInteract } from '../fleet/MapInteractUI.jsx';
import { decodeView } from '../fleet/geoTools.js';

const nf1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const BRAND = { 'john-deere': 'John Deere', 'new-holland': 'New Holland' };
const MONO = { 'john-deere': 'JD', 'new-holland': 'NH' };
const LS = 'pf2-mapa';

// Ajustes de mapa guardados en el navegador (igual que el panel actual): capa, lotes, etiquetas, unidades y la tarjeta de operación.
function usePrefs() {
  const [p, setP] = useState(() => { try { return { ...MAP_DEFAULTS, ...JSON.parse(localStorage.getItem(LS) || '{}') }; } catch { return { ...MAP_DEFAULTS }; } });
  const save = (n) => { try { localStorage.setItem(LS, JSON.stringify(n)); } catch { /* sin almacenamiento */ } return n; };
  const set = useCallback((k, v) => setP((x) => save({ ...x, [k]: v })), []);
  const reset = useCallback(() => setP(save({ ...MAP_DEFAULTS })), []);
  return [p, set, reset];
}

function Switch({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5 text-[14px]">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-ink/15 transition peer-checked:bg-ok after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

/* ---------- piezas ---------- */
function Chip({ active, onClick, children, count, tone }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={clsx('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] transition',
        active ? 'bg-fg text-onfg' : 'bg-ink/[0.05] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))] hover:bg-ink/[0.09] hover:text-fg')}>
      {tone ? <span className={clsx('size-1.5 rounded-full', tone === 'ok' && 'bg-ok', tone === 'muted' && 'bg-muted', tone === 'crit' && 'bg-crit')} /> : null}
      {children}{count != null ? <span className={clsx('tabular-nums', active ? 'text-onfg/60' : 'text-faint')}>{count}</span> : null}
    </button>
  );
}

function CtlButton({ label, onClick, active, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={active}
      className={clsx('grid size-10 place-items-center transition first:rounded-t-2xl last:rounded-b-2xl', active ? 'bg-accent/20 text-accent shadow-[inset_-3px_0_0_#e6c97c]' : 'text-soft hover:bg-ink/[0.08] hover:text-fg')}>
      {children}
    </button>
  );
}

function WorkBar({ acc, className }) {
  const total = WORK_ORDER.reduce((s, k) => s + (acc[k] || 0), 0);
  return (
    <div className={clsx('flex h-2 overflow-hidden rounded-full bg-ink/[0.06]', className)} role="img"
      aria-label={WORK_ORDER.map((k) => `${WORK[k].label} ${fmtDur(acc[k])}`).join(', ')}>
      {total ? WORK_ORDER.map((k) => acc[k] ? <span key={k} style={{ width: (100 * acc[k]) / total + '%', background: WORK[k].color }} /> : null) : null}
    </div>
  );
}

// «Operación de hoy» (portada de mapops.js): pestañas Estado (tiempos por tractor), Avance (hectáreas por lote) y Alertas (combustible, velocidad, horario).
function OpsCard({ sum, snap, store, open, onToggle, onPick, onFly }) {
  const cfg = getOps();
  const tabs = [cfg.estado && ['estado', 'Estado'], cfg.superficie && ['avance', 'Avance'], (cfg.combustible || cfg.velocidad || cfg.horario) && ['alertas', 'Alertas']].filter(Boolean);
  const [tab, setTab] = useState('estado');
  const cur = tabs.some((t) => t[0] === tab) ? tab : tabs[0]?.[0];
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const on = { opFuel: cfg.combustible, opSpeed: cfg.velocidad, opSchedule: cfg.horario };
  const alerts = snap.events.filter((e) => String(e.id).startsWith('op-') && on[e.type] && new Date(e.eventTime) >= t0).sort((a, b) => new Date(b.eventTime) - new Date(a.eventTime));
  const otras = alerts.filter((e) => e.type !== 'opSchedule'), hor = alerts.filter((e) => e.type === 'opSchedule');
  const SEV = { crit: 'text-crit', warn: 'text-warn', info: 'text-info' };
  const ico = { opFuel: '⛽', opSpeed: '⚡', opSchedule: '🕐' };
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const lots = store.avanceLotes();
  const th = lots.reduce((n, l) => n + l.ha, 0), td = lots.reduce((n, l) => n + l.done, 0);
  const ids = [...snap.devices.keys()];
  const tot = { trabajo: 0, transito: 0, ralenti: 0 };
  const rows = ids.map((id) => { const t = store.workToday(id) || {}; ['trabajo', 'transito', 'ralenti'].forEach((k) => { tot[k] += t[k] || 0; }); return [id, t]; });
  const all = tot.trabajo + tot.transito + tot.ralenti;
  return (
    <section className="glass-strong w-full overflow-hidden" aria-label="Operación de hoy">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span>
          <span className="block text-[12px] uppercase tracking-[0.12em] text-muted">Operación de hoy</span>
          <span className="font-display text-lg">{sum.productive == null ? 'Midiendo…' : <>Tiempo productivo <b className="font-medium text-ok">{Math.round(sum.productive * 100)} %</b></>}</span>
        </span>
        {open ? <ChevronDown className="size-4 text-muted" /> : <ChevronUp className="size-4 text-muted" />}
      </button>
      {open && tabs.length ? (
        <div className="grid gap-3 px-4 pb-4">
          <div role="tablist" aria-label="Operación de hoy" className="flex border-b border-ink/10">
            {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={cur === k} onClick={() => setTab(k)} className={clsx('flex-1 border-b-2 px-1 py-2 text-[12.5px] font-medium transition', cur === k ? 'border-ok text-fg' : 'border-transparent text-muted hover:text-fg')}>{l}{k === 'alertas' && alerts.length ? <i className="ml-1 rounded-full bg-crit px-1.5 text-[11px] not-italic text-white">{alerts.length}</i> : null}</button>)}
          </div>
          <div className="max-h-[17rem] overflow-y-auto pr-1">
            {cur === 'estado' ? (
              <>
                <p className="mb-2 text-[13px] text-soft">Tiempo productivo de la flota: <b className="font-medium text-fg">{all >= 60000 ? `${Math.round((tot.trabajo / all) * 100)} %` : '—'}</b></p>
                <ul className="grid gap-0.5">{rows.map(([id, t]) => { const st = store.workOf(id), W = WORK[st] || WORK.apagado, sm = (t.trabajo || 0) + (t.transito || 0) + (t.ralenti || 0); return (
                  <li key={id}><button type="button" onClick={() => onPick(id)} className="grid w-full grid-cols-[auto_1fr] gap-x-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-ink/[0.05]">
                    <span className="mt-1 size-2.5 rounded-full" style={{ background: W.color }} aria-hidden />
                    <span className="min-w-0"><b className="block truncate text-[13px] font-medium">{snap.devices.get(id)?.name}</b><small className="block text-[11.5px] text-muted">{W.label}</small>
                      <span className="my-1 flex h-1.5 overflow-hidden rounded-full bg-ink/[0.08]" aria-hidden>{['trabajo', 'transito', 'ralenti'].map((k) => <i key={k} className="block h-full" style={{ width: `${sm ? ((t[k] || 0) / sm) * 100 : 0}%`, background: WORK[k].color }} />)}</span>
                      <small className="block text-[11.5px] text-muted">{fmtDur(t.trabajo || 0)} trabajo · {fmtDur(t.transito || 0)} tránsito · {fmtDur(t.ralenti || 0)} parado</small></span>
                  </button></li>); })}</ul>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">{WORK_ORDER.map((k) => <span key={k} className="inline-flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: WORK[k].color }} />{WORK[k].label}</span>)}</div>
                <p className="mt-2 text-[11.5px] text-faint">Los tiempos se acumulan mientras el panel está abierto en este navegador.</p>
              </>
            ) : cur === 'avance' ? (
              <>
                <p className="mb-2 text-[13px] text-soft">Total: <b className="font-medium text-fg">{td.toFixed(1)} ha</b> de {th.toFixed(1)} ha ({th ? Math.round((td / th) * 100) : 0} %)</p>
                {lots.length ? <ul className="grid gap-2">{lots.map((l) => (
                  <li key={l.id} className="border-t border-ink/10 pt-2 first:border-0 first:pt-0"><div className="flex justify-between gap-2 text-[13px]"><b className="font-medium">{l.name}</b><span className="tabular-nums text-muted">{l.done.toFixed(1)} / {l.ha ? l.ha.toFixed(1) : '—'} ha · {Math.round(l.pct)} %</span></div>
                    <div className="my-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]" role="progressbar" aria-valuenow={Math.round(l.pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance de ${l.name}`}><i className="block h-full bg-ok" style={{ width: `${l.pct}%` }} /></div><small className="text-[11.5px] text-muted">Pendiente {l.pend.toFixed(1)} ha</small></li>))}</ul> : <p className="text-[13px] text-muted">No hay lotes.</p>}
                <p className="mt-2 text-[11.5px] text-faint">Aproximado: cuenta una vez cada cuadro de {cfg.ancho} m recorrido trabajando (sin doble conteo en traslapes).</p>
              </>
            ) : alerts.length ? (
              <ul className="grid gap-0.5">{[...otras.slice(0, 30), ...hor.slice(0, 6)].map((e) => { const a = e.attributes; return (
                <li key={e.id}><button type="button" onClick={() => onFly(a.latitude, a.longitude, e.deviceId)} className="grid w-full grid-cols-[auto_1fr] gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-ink/[0.05]"><span className="text-base" aria-hidden>{ico[e.type]}</span>
                  <span className="min-w-0"><b className={clsx('block text-[13px] font-medium', SEV[a.sev])}>{a.titulo}</b><small className="block text-[11.5px] text-muted">{snap.devices.get(e.deviceId)?.name} · {hhmm(e.eventTime)}</small><small className="block text-[11.5px] text-muted">{a.det}</small></span></button></li>); })}
                {hor.length > 6 ? <li className="px-1 pt-1 text-[11.5px] text-faint">y {hor.length - 6} tractores más fuera de horario (anillo morado punteado en el mapa).</li> : null}</ul>
            ) : <p className="text-[13px] text-muted">Sin alertas hoy.</p>}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ---------- página ---------- */
export function MapPage() {
  const { store, snap } = useFleet();
  const { query } = useRoute();
  const mapRef = useRef(null);
  const [prefs, setPref, resetPrefs] = usePrefs();
  const [menu, setMenu] = useState(null); // tipo | ajustes
  const [radar, setRadar] = useState(false);
  const [radarInfo, setRadarInfo] = useState(null);
  const [measuring, setMeasuring] = useState(false);
  const [measure, setMeasure] = useState(null);
  const [aviso, setAviso] = useState(null);
  const toggleMenu = (k) => setMenu((x) => (x === k ? null : k));
  const [f, setF] = useState({ status: null, nivel: null, sonda: false, marca: null, q: '' });
  const [view, setView] = useState('list'); // list | detail | settings
  const [tab, setTab] = useState('flota'); // flota | lotes (secciones del panel lateral)
  const [lote, setLote] = useState(null); // lote abierto en la sección Lotes
  const [panelOpen, setPanelOpen] = useState(true);
  const [selected, setSelected] = useState(null);
  const [follow, setFollow] = useState(false);
  const [sheet, setSheet] = useState('peek'); // celular: peek | half | full (empieza abajo para dejar ver las herramientas del mapa)
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => { const mq = window.matchMedia('(min-width: 1024px)'); const on = () => setWide(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);

  const [mapReady, setMapReady] = useState(false);
  useEffect(() => { setMapReady(true); }, []);
  const tools = useMapTools(() => mapRef.current?.getMap(), snap, selected, mapReady);
  const ctl = useMapInteract(() => mapRef.current?.getMap(), snap, selected, mapReady);
  const ist = useInteractState(ctl);
  const [search, setSearch] = useState(false);
  const [toast, setToast] = useState('');
  const say = useCallback((t) => { setToast(t); setTimeout(() => setToast(''), 2600); }, []);
  const copy = useCallback((text, msg) => { const ok = () => say(msg || 'Copiado'); (navigator.clipboard?.writeText(text) || Promise.reject()).then(ok, () => { window.prompt('Copia este texto:', text); }); }, [say]);

  const sum = store.summary(); // se recalcula en cada actualización en vivo (snap cambia)
  const ids = useMemo(() => {
    const list = [...snap.devices.keys()].filter((id) => store.matches(id, f));
    const rank = { running: 0, idle: 1, nosignal: 2 };
    return list.sort((a, b) => rank[store.statusOf(a)] - rank[store.statusOf(b)] || snap.devices.get(a).name.localeCompare(snap.devices.get(b).name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, f, store]);
  const marcas = Object.keys(sum.brands);

  const pick = useCallback((id) => { setSelected(id); setView('detail'); setPanelOpen(true); setFollow(false); mapRef.current?.focus(id); if (!wide) setSheet('half'); }, [wide]);
  const goCtx = useMemo(() => ({
    select: (id) => pick(id),
    flyTo: (la, lo, z) => mapRef.current?.flyTo(la, lo, z),
    go: (id) => { const p = snap.positions.get(id); pick(id); if (p) { mapRef.current?.flyTo(p.latitude, p.longitude, 16); ctl?.pulse(p.latitude, p.longitude); } },
  }), [pick, snap, ctl]);
  // Enlace compartido (?mv=capa,lat,lon,zoom[,tID]): restaura la vista una sola vez cuando el mapa y la flota están listos.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !ctl || !snap.loaded) return;
    const raw = new URLSearchParams(window.location.search).get('mv');
    restored.current = true;
    const v = decodeView(raw); if (!v) return;
    setPref('layer', v.layer);
    setTimeout(() => { mapRef.current?.getMap()?.setView([v.lat, v.lon], v.zoom, { animate: false }); if (v.sel != null && snap.devices.has(v.sel)) { setSelected(v.sel); setView('detail'); } say('Vista compartida restaurada'); try { window.history.replaceState(null, '', window.location.pathname + window.location.hash); } catch { /* nada */ } }, 400);
  }, [ctl, snap.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const gear = useCallback((id) => { setSelected(id); setView('settings'); setPanelOpen(true); }, []);
  const back = useCallback(() => { setView('list'); setSelected(null); setFollow(false); }, []);
  // #/mapa?d=12 abre ese tractor; #/mapa?l=3 encuadra ese lote (vienen de la búsqueda o de otras páginas).
  useEffect(() => {
    const id = Number(query.d), lote = Number(query.l);
    if (snap.loaded && id && snap.devices.has(id)) { pick(id); navigate('/mapa'); }
    if (snap.loaded && lote) { back(); setTab('lotes'); setLote(lote); setPanelOpen(true); setPref('fences', true); setTimeout(() => mapRef.current?.fitFence(lote), 300); navigate('/mapa'); }
  }, [query.d, query.l, snap.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setF((x) => ({ ...x, [k]: x[k] === v ? (k === 'sonda' ? false : null) : v }));
  const panelW = wide && panelOpen ? 400 : 0;

  const panel = view === 'settings' && selected != null ? <TractorSettings key={selected} id={selected} store={store} snap={snap} onClose={() => setView(selected != null ? 'detail' : 'list')} />
    : view === 'detail' && selected != null ? <FleetDetail id={selected} store={store} snap={snap} onBack={back} onFocus={(id) => mapRef.current?.focus(id)} follow={follow} setFollow={setFollow} />
    : (
      <div className="flex min-h-0 flex-1 flex-col">
        <div role="tablist" aria-label="Sección del panel" className="mx-4 mt-1 grid shrink-0 grid-cols-2 gap-1 rounded-full bg-ink/[0.06] p-1">
          {[['flota', 'Flota'], ['lotes', 'Lotes']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={clsx('h-8 rounded-full text-[13px] font-medium transition', tab === k ? 'bg-fg text-onfg' : 'text-soft hover:text-fg')}>{l}</button>)}
        </div>
        {tab === 'lotes' ? <LotesPanel store={store} snap={snap} lote={lote} onLote={setLote} onFit={(id) => mapRef.current?.fitFence(id)} onPick={pick} />
          : <FleetList store={store} snap={snap} ids={ids} onPick={pick} onGear={gear} q={f.q} onQ={(q) => setF((x) => ({ ...x, q }))} />}
      </div>
    );

  // Filtros sobre el mapa (igual que el panel actual): estado, nivel y sonda.
  const chips = [
    ['status', 'running', 'En marcha', sum.running, 'bg-ok'], ['status', 'idle', 'Apagados', sum.idle, 'bg-muted'], ['status', 'nosignal', 'Sin señal', sum.nosignal, 'bg-crit'],
    ['nivel', 'A', 'Nivel A · D+'], ['nivel', 'B', 'Nivel B · CAN'], ['sonda', true, 'Con sonda'], ...marcas.filter((m) => m !== 'otra').map((m) => ['marca', m, BRAND[m] || m]),
  ];

  return (
    <div className={clsx('fixed inset-0', measuring ? 'cur-medir' : ist.mode && `cur-${ist.mode}`)}>
      <MapView ref={mapRef} onOpenLote={(id) => { setTab('lotes'); setLote(id); setView('list'); setSelected(null); setFollow(false); setPanelOpen(true); setSheet('half'); }} snap={snap} store={store} filters={f} selected={selected} onSelect={pick} layer={prefs.layer} fences={prefs.fences} labels={prefs.labels} units={prefs.units}
        radar={radar} onRadarInfo={setRadarInfo} measuring={measuring} onMeasure={setMeasure} follow={follow} padLeft={panelW} />

      {/* Filtros sobre el mapa */}
      <div className="absolute top-24 z-[500] flex max-w-[calc(100%-5rem)] gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" style={{ left: wide && panelOpen ? 424 : 12 }}>
        {chips.map(([k, v, label, n, dot]) => {
          const on = f[k] === v;
          return (
            <button key={label} type="button" aria-pressed={on} onClick={() => set(k, v)}
              className={clsx('flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] backdrop-blur-md transition', on ? 'bg-fg text-onfg' : 'bg-night/90 text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))] hover:text-fg')}>
              {dot ? <span className={clsx('size-2 rounded-sm', dot)} /> : null}{label}{n != null ? <b className="font-medium tabular-nums">{n}</b> : null}
            </button>
          );
        })}
      </div>

      {/* Panel de flota: lateral en escritorio (se puede ocultar), hoja inferior en celular */}
      {wide ? (
        <>
          <aside className={clsx('glass-strong absolute bottom-4 left-3 top-24 z-[500] flex w-[384px] flex-col overflow-hidden transition-transform duration-300 sm:left-4 lg:left-6', !panelOpen && '-translate-x-[110%]')} aria-label="Flota" aria-hidden={!panelOpen}>{panel}</aside>
          <button type="button" onClick={() => setPanelOpen(!panelOpen)} aria-label={panelOpen ? 'Ocultar panel' : 'Mostrar panel'} title={panelOpen ? 'Ocultar panel' : 'Mostrar panel'}
            className="glass-strong absolute top-1/2 z-[501] grid h-12 w-7 -translate-y-1/2 place-items-center rounded-l-none rounded-r-xl text-soft transition-[left] duration-300 hover:text-fg" style={{ left: panelOpen ? 408 : 0 }}>
            {panelOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </>
      ) : (
        <aside aria-label="Flota" className={clsx('glass-strong absolute inset-x-2 bottom-2 z-[520] flex flex-col overflow-hidden transition-[height] duration-300',
          sheet === 'peek' ? 'h-[92px]' : sheet === 'half' ? 'h-[46vh]' : 'h-[calc(100dvh-88px)]')}>
          <button type="button" onClick={() => setSheet(sheet === 'peek' ? 'half' : sheet === 'half' ? 'full' : 'peek')}
            className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-ink/20" aria-label={sheet === 'full' ? 'Achicar panel' : 'Agrandar panel'} />
          {panel}
        </aside>
      )}

      {/* Controles (mismo orden que el panel actual) */}
      <div className="absolute right-3 top-24 z-[510] grid gap-2 sm:right-4 lg:right-6">
        <div className="glass-strong grid"><CtlButton label="Ampliar a extensión" onClick={() => { back(); mapRef.current?.fitAll(); }}><Expand className="size-4" /></CtlButton></div>
        <div className="glass-strong grid">
          <CtlButton label="Ampliar" onClick={() => mapRef.current?.zoomIn()}><Plus className="size-4" /></CtlButton>
          <CtlButton label="Reducir" onClick={() => mapRef.current?.zoomOut()}><Minus className="size-4" /></CtlButton>
        </div>
        <div className="glass-strong relative grid">
          <CtlButton label="Tipo de mapa" onClick={() => toggleMenu('tipo')} active={menu === 'tipo'}><MapPinned className="size-4" /></CtlButton>
          {menu === 'tipo' ? (
            <div className="menu-surface absolute right-[calc(100%+8px)] top-0 flex overflow-hidden p-0 animate-pop" role="menu">
              {Object.entries(LAYER_NAMES).map(([k, label]) => (
                <button key={k} type="button" role="menuitemradio" aria-checked={prefs.layer === k} onClick={() => { setPref('layer', k); setMenu(null); }}
                  className={clsx('h-10 whitespace-nowrap px-4 text-[14px] font-medium', prefs.layer === k ? 'bg-accent text-onfg' : 'text-soft hover:bg-ink/[0.06]')}>{label}</button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="glass-strong grid">
          <CtlButton label="Ubicación actual" onClick={() => mapRef.current?.locate().catch((e) => { setAviso(e.message); setTimeout(() => setAviso(null), 3000); })}><LocateFixed className="size-4" /></CtlButton>
        </div>
        <div className="glass-strong relative grid">
          <CtlButton label="Ajustes de mapa" onClick={() => toggleMenu('ajustes')} active={menu === 'ajustes'}><Settings className="size-4" /></CtlButton>
          <CtlButton label="Estado del equipo" onClick={() => setPanelOpen(!panelOpen)} active={panelOpen}><MessageSquare className="size-4" /></CtlButton>
          <CtlButton label="Estado del tiempo (radar de lluvia)" onClick={() => setRadar(!radar)} active={radar}><CloudRain className="size-4" /></CtlButton>
          <CtlButton label="Herramientas del mapa (rastro, calor, paradas…)" onClick={() => toggleMenu('tools')} active={menu === 'tools'}><Wrench className="size-4" /></CtlButton>
          <CtlButton label="Ubicar y medir (inspector, radio, notas, buscar)" onClick={() => toggleMenu('interact')} active={menu === 'interact' || !!ist.mode}><CrosshairIcon className="size-4" /></CtlButton>
          <CtlButton label="Herramienta de medición" onClick={() => { if (!measuring) ctl?.setMode(null); setMeasuring(!measuring); }} active={measuring}><Ruler className="size-4" /></CtlButton>
          {menu === 'tools' ? <MapToolsPanel tools={tools} store={store} /> : null}
          {menu === 'interact' && ctl ? <InteractMenu ctl={ctl} st={ist} onOpenSearch={() => { setMenu(null); setSearch(true); }}
            onShare={() => { setMenu(null); copy(ctl.shareUrl(prefs.layer, selected), 'Enlace copiado: abre esta misma vista del mapa'); }}
            onMode={(k) => { setMeasuring(false); setMenu(null); ctl.setMode(k); }} /> : null}
        </div>
      </div>

      {/* Ajustes de mapa: fuera de la columna de botones para que la hoja use toda la altura */}
      {menu === 'ajustes' ? (
        <div className="menu-surface absolute z-[515] right-[4.25rem] top-24 max-h-[calc(100dvh-7rem)] w-80 max-w-[calc(100vw-5.5rem)] overflow-y-auto p-0 animate-pop sm:right-[4.75rem] lg:right-[5.25rem]" role="dialog" aria-label="Ajustes de mapa">
          <h3 className="border-b border-ink/[0.07] px-4 py-3 font-display text-lg">Ajustes de mapa</h3>
          <div className="grid gap-2 border-b border-ink/[0.07] px-4 py-3">
            <span className="text-[11.5px] uppercase tracking-[0.12em] text-muted">Unidades</span>
            <div className="grid grid-cols-2 overflow-hidden rounded-xl shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))]">
              {[['metric', 'Métrico (km, ha)'], ['imperial', 'Imperial (mi, ac)']].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={prefs.units === k} onClick={() => setPref('units', k)} className={clsx('h-9 text-[12.5px] font-medium', prefs.units === k ? 'bg-ok text-onfg' : 'text-soft hover:bg-ink/[0.06]')}>{l}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-1 border-b border-ink/[0.07] px-4 py-3">
            <span className="text-[11.5px] uppercase tracking-[0.12em] text-muted">Visualización</span>
            <Switch label="Lotes y geocercas" checked={prefs.fences} onChange={(v) => setPref('fences', v)} />
            <Switch label="Etiquetas de unidades" checked={prefs.labels} onChange={(v) => setPref('labels', v)} />
          </div>
          <OpsSettingsInline store={store} onFlash={say} />
          <div className="border-b border-ink/[0.07] px-4 py-3"><button type="button" onClick={() => { setMenu(null); navigate('/ajustes'); }} className="h-9 w-full rounded-xl text-[13.5px] font-medium shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.06]">Abrir la página de ajustes…</button></div>
          <div className="px-4 py-3"><button type="button" onClick={resetPrefs} className="h-9 w-full rounded-xl text-[13.5px] font-medium shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.06]">Restablecer valores</button></div>
        </div>
      ) : null}

      {/* Avisos del mapa: medición, radar, ubicación */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-[500] grid -translate-x-1/2 justify-items-center gap-2">
        <PlaybackBar tools={tools} />
        {measuring ? (
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-accent px-4 py-2 text-[14px] font-medium text-onfg shadow-[0_10px_30px_-10px_rgb(var(--shadow-rgb)/0.7)]">
            {measure ? <>Distancia: {measure.dist}{measure.area ? ` · Área: ${measure.area}` : ''}<button type="button" onClick={() => mapRef.current?.clearMeasure()} aria-label="Borrar medición" className="rounded-lg p-1 hover:bg-black/10"><Trash2 className="size-4" /></button></> : 'Haz clic en el mapa para medir'}
          </div>
        ) : null}
        {radar && radarInfo ? <div className="rounded-2xl bg-night/90 px-4 py-2 text-[13px] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))]">{radarInfo}</div> : null}
        {aviso ? <div className="rounded-2xl bg-crit/90 px-4 py-2 text-[13px] text-white">{aviso}</div> : null}
      </div>

      <InteractOverlays ctl={ctl}st={ist} search={search} setSearch={setSearch} goCtx={goCtx} padLeft={panelW} toast={toast} copy={copy} />

      {/* Operación de hoy (escritorio) */}
      {wide && getOps().tarjeta ? (
        <div className="absolute bottom-4 right-3 z-[500] w-[340px] sm:right-4 lg:right-6">
          <OpsCard sum={sum} snap={snap} store={store} open={prefs.ops} onToggle={() => setPref('ops', !prefs.ops)} onPick={pick} onFly={(la, lo, id) => { mapRef.current?.flyTo(la, lo, 16); if (id != null) { setSelected(id); } }} />
        </div>
      ) : null}
    </div>
  );
}
