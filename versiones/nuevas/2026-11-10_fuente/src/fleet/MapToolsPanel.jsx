// Panel «Herramientas del mapa» (rastro, calor, etiquetas, alertas de lote, lluvia, paradas, cobertura, NDVI, agrupar, seguir)
// y barra de reproducción de ruta. La lógica vive en mapTools.js (port de mapx.js); aquí solo se dibuja y se llama.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { Maximize2, Pause, Play, Square } from 'lucide-react';
import { createMapTools } from './mapTools.js';
import { ImportarExportar } from './ImportarExportar.jsx';

export function useMapTools(getMap, snap, selected, ready) {
  const [tools, setTools] = useState(null);
  const live = useMemo(() => ({ snap: null, selected: null }), []);
  live.snap = snap; live.selected = selected;
  useEffect(() => {
    const map = ready ? getMap() : null;
    if (!map) return undefined;
    const t = createMapTools(map, () => ({ devices: live.snap.devices, positions: live.snap.positions, geofences: live.snap.geofences, selected: live.selected }));
    setTools(t);
    return () => { t.destroy(); setTools(null); };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { tools?.onState(); }, [tools, snap, selected]);
  return tools;
}

const NOP = () => () => {};
const EMPTY = { ON: {}, CFG: {}, info: {}, wx: '', PB: {}, hist: { points: 0, tractors: 0 } };
export const useToolState = (tools) => useSyncExternalStore(tools ? tools.subscribe : NOP, tools ? tools.getState : () => EMPTY);

function Toggle({ on, onChange, label, hint, children }) {
  return (
    <div className="py-1.5">
      <label className="flex cursor-pointer items-center justify-between gap-3 text-[14px]">
        <span>{label}</span>
        <input type="checkbox" checked={!!on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span aria-hidden className="relative h-5 w-9 shrink-0 rounded-full bg-ink/15 transition peer-checked:bg-ok after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
      </label>
      {hint ? <p className="text-[11.5px] leading-snug text-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

function Range({ label, value, min, max, step = 1, unit = '', onChange }) {
  return (
    <label className="mt-1 flex items-center gap-2 text-[12px] text-muted">
      <span className="w-28 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="min-w-0 flex-1 accent-[#e6c97c]" />
      <span className="w-14 text-right tabular-nums text-soft">{value}{unit}</span>
    </label>
  );
}

const TONO = { ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit' };
function WxLotes({ i, onRefresh }) {
  if (i.st === 'cargando') return <p className="mt-1 text-[11.5px] text-muted">Consultando el clima de cada lote…</p>;
  if (i.st === 'vacio') return <p className="mt-1 text-[11.5px] text-muted">No hay lotes en el mapa.</p>;
  if (i.st === 'error') return <p className="mt-1 text-[11.5px] text-crit">No se pudo consultar Open-Meteo (sin conexión). <button type="button" onClick={onRefresh} className="underline">Reintentar</button></p>;
  if (!i.rows) return null;
  return (
    <div className="mt-1 grid gap-1">
      <p className="text-[11.5px] text-soft">Favorable en <b className="font-medium text-ok">{i.n.ok}</b> · precaución en <b className="font-medium text-warn">{i.n.warn}</b> · no recomendable en <b className="font-medium text-crit">{i.n.crit}</b> de {i.rows.length} lotes.</p>
      <ul className="grid max-h-40 gap-0.5 overflow-y-auto pr-1 text-[11.5px]">
        {i.rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2" title={`Ráfagas ${r.gust} km/h · lluvia próxima ${r.rain} %`}>
            <span aria-hidden className={clsx('size-2 shrink-0 rounded-full', TONO[r.tone])} />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="shrink-0 tabular-nums text-muted">{r.temp}° · {r.wind} km/h {r.dir}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] leading-snug text-muted">Actualizado a las {new Date(i.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}. Criterio general (viento, ráfagas, lluvia próxima y calor): sigue siempre la etiqueta del producto. <button type="button" onClick={onRefresh} className="underline">Actualizar</button></p>
    </div>
  );
}

export function MapToolsPanel({ tools, store }) {
  const st = useToolState(tools);
  const [msg, setMsg] = useState('');
  if (!tools) return null;
  const { ON, CFG, info } = st;
  const on = (k) => (v) => tools.setOn(k, v);
  const extra = {
    trail: <Range label="Velocidad máx." value={CFG.vmax} min={2} max={20} unit=" km/h" onChange={(v) => tools.setCfg('vmax', v)} />,
    heat: <Range label="Radio" value={CFG.heatR} min={6} max={40} unit=" px" onChange={(v) => tools.setCfg('heatR', v)} />,
    stops: <Range label="Parada mínima" value={CFG.stopMin} min={1} max={30} unit=" min" onChange={(v) => tools.setCfg('stopMin', v)} />,
    cover: <Range label="Ancho implemento" value={CFG.width} min={2} max={30} unit=" m" onChange={(v) => tools.setCfg('width', v)} />,
    ndvi: <Range label="Opacidad" value={CFG.ndviOp} min={10} max={100} unit=" %" onChange={(v) => tools.setCfg('ndviOp', v)} />,
  };
  const detail = (k) => {
    const i = info[k];
    if (!ON[k] || !i) return null;
    if (typeof i === 'string') return <p className="mt-1 text-[11.5px] text-ok">{i}</p>;
    if (k === 'wxlotes') return <WxLotes i={i} onRefresh={tools.refreshWx} />;
    if (k === 'cover' && i.rows) return <ul className="mt-1 grid gap-0.5 text-[11.5px] text-soft">{i.rows.map((r) => <li key={r.name} className="flex justify-between"><span>{r.name}</span><b className="font-medium tabular-nums">{Math.round(r.cov)} %</b></li>)}</ul>;
    return null;
  };
  return (
    <div className="menu-surface absolute right-[calc(100%+8px)] top-0 max-h-[calc(100dvh-8rem)] w-[22rem] overflow-y-auto p-0 animate-pop" role="dialog" aria-label="Herramientas del mapa">
      <h3 className="sticky top-0 border-b border-ink/[0.07] bg-inherit px-4 py-3 font-display text-lg">Herramientas del mapa</h3>
      <div className="grid gap-0.5 px-4 py-2">
        <div className="mb-1 grid grid-cols-2 overflow-hidden rounded-xl shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))]">
          {[['sel', 'Tractor elegido'], ['all', 'Toda la flota']].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={CFG.scope === k} onClick={() => tools.setCfg('scope', k)} className={clsx('h-8 text-[12.5px] font-medium', CFG.scope === k ? 'bg-ok text-onfg' : 'text-soft hover:bg-ink/[0.06]')}>{l}</button>
          ))}
        </div>
        {tools.FEATS.map(([k, label, hint]) => (
          <Toggle key={k} on={ON[k]} onChange={on(k)} label={label} hint={ON[k] ? null : hint}>
            {ON[k] ? <>{extra[k]}{detail(k)}{k === 'rain' && st.wx ? <p className="mt-1 text-[11.5px] text-ok">{st.wx}</p> : null}</> : null}
          </Toggle>
        ))}
      </div>
      <ImportarExportar tools={tools} store={store} />
      <div className="grid gap-2 border-t border-ink/[0.07] px-4 py-3 text-[13px]">
        <p className="text-muted">Historial: {st.hist.points} puntos de {st.hist.tractors} tractores.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => tools.seed(3)} className="h-9 rounded-xl shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.06]">Cargar historial demo</button>
          <button type="button" onClick={() => setMsg(tools.openPlayback() || '')} className="h-9 rounded-xl bg-fg font-medium text-onfg">Reproducir ruta</button>
          <button type="button" onClick={tools.simulateExit} className="h-9 rounded-xl shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.06]">Simular salida de lote</button>
          <button type="button" onClick={tools.clearSim} className="h-9 rounded-xl shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.06]">Quitar simulación</button>
        </div>
        <button type="button" onClick={tools.fullscreen} className="flex h-9 items-center justify-center gap-2 rounded-xl shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.06]"><Maximize2 className="size-4" />Pantalla completa</button>
        {msg ? <p className="text-[12px] text-crit">{msg}</p> : null}
      </div>
    </div>
  );
}

export function PlaybackBar({ tools }) {
  const st = useToolState(tools);
  const pb = st.PB;
  if (!tools || !pb.open) return null;
  return (
    <div className="pointer-events-auto glass-strong flex w-[min(34rem,calc(100vw-1.5rem))] items-center gap-3 px-4 py-2.5" role="group" aria-label="Reproducción de ruta">
      <button type="button" onClick={tools.pbToggle} aria-label={pb.playing ? 'Pausar' : 'Reproducir'} className="grid size-9 shrink-0 place-items-center rounded-full bg-fg text-onfg">{pb.playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between text-[12.5px]"><b className="truncate font-medium">{pb.name}</b><span className="tabular-nums text-muted">{pb.time}</span></div>
        <input type="range" min={0} max={pb.max} value={pb.i} onChange={(e) => tools.pbTo(+e.target.value)} className="w-full accent-[#e6c97c]" aria-label="Posición en la ruta" />
      </div>
      <select value={pb.speed} onChange={(e) => tools.pbSpeed(+e.target.value)} aria-label="Velocidad" className="h-8 rounded-lg bg-ink/[0.08] px-1 text-[12px]">
        {[[4, '1×'], [16, '4×'], [40, '10×'], [80, '20×']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <button type="button" onClick={tools.stopPlayback} aria-label="Cerrar reproducción" className="grid size-8 place-items-center rounded-lg hover:bg-ink/[0.08]"><Square className="size-4" /></button>
    </div>
  );
}
