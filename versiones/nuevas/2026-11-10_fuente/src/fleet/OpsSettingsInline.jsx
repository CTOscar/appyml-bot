// Ajustes de operación dentro del menú «Ajustes de mapa» (como el panel viejo, que inyectaba esto en su panel de ajustes):
// interruptores de lo que se calcula y se muestra, parámetros numéricos, horario permitido y borrar los datos de hoy.
import { useState } from 'react';
import clsx from 'clsx';
import { OPS_FIELDS, OPS_SWITCHES, getOps, saveOps } from './opsConfig.js';

const lbl = 'text-[11.5px] uppercase tracking-[0.12em] text-muted';
const num = 'h-8 w-16 rounded-lg bg-ink/[0.06] px-2 text-right text-[13px] tabular-nums outline-none shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))] focus:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.55)]';

export function OpsSettingsInline({ store, onFlash }) {
  const [cfg, setCfg] = useState(() => ({ ...getOps() }));
  const upd = (patch) => setCfg({ ...saveOps(patch) });
  const setNum = (f, raw) => { const n = Number(raw); if (Number.isFinite(n)) upd({ [f.k]: Math.min(f.max, Math.max(f.min, n)) }); };
  const setTime = (k, v) => { if (/^\d{1,2}:\d{2}$/.test(v)) upd({ [k]: v }); };
  return (
    <>
      <div className="grid gap-1 border-b border-ink/[0.07] px-4 py-3">
        <span className={lbl}>Qué se calcula y se muestra</span>
        {OPS_SWITCHES.map((f) => (
          <label key={f.k} title={f.hint} className="flex items-center justify-between gap-3 py-1 text-[13.5px]">
            <span className="min-w-0">{f.label}</span>
            <input type="checkbox" role="switch" checked={!!cfg[f.k]} onChange={(e) => upd({ [f.k]: e.target.checked })} className="peer sr-only" />
            <span aria-hidden className="relative h-5 w-9 shrink-0 rounded-full bg-ink/15 transition peer-checked:bg-ok after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
          </label>
        ))}
      </div>
      <div className="grid gap-1.5 border-b border-ink/[0.07] px-4 py-3">
        <span className={lbl}>Parámetros</span>
        {OPS_FIELDS.map((f) => (
          <label key={f.k} title={f.hint} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="min-w-0 leading-tight">{f.label}</span>
            <span className="flex shrink-0 items-center gap-1"><input type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step} value={cfg[f.k]} onChange={(e) => setNum(f, e.target.value)} className={num} aria-label={f.label} /><span className="w-8 text-[11.5px] text-muted">{f.unit}</span></span>
          </label>
        ))}
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="leading-tight">Horario permitido</span>
          <span className="flex shrink-0 items-center gap-1">
            <input type="time" aria-label="Inicio del horario" value={cfg.hIni} onChange={(e) => setTime('hIni', e.target.value)} className={clsx(num, 'w-[5.25rem] text-center')} />
            <span className="text-muted">a</span>
            <input type="time" aria-label="Fin del horario" value={cfg.hFin} onChange={(e) => setTime('hFin', e.target.value)} className={clsx(num, 'w-[5.25rem] text-center')} />
          </span>
        </div>
      </div>
      <div className="grid gap-2 border-b border-ink/[0.07] px-4 py-3">
        <span className={lbl}>Datos de hoy</span>
        <button type="button" onClick={() => { if (confirm('¿Borrar los tiempos, la superficie y las alertas de hoy?')) { store.clearToday(); onFlash?.('Se borraron los datos de hoy.'); } }} className="h-9 rounded-xl text-[13.5px] font-medium shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.06]">Borrar datos de hoy</button>
        {store.canDemo?.() ? <button type="button" onClick={() => { store.demo(); onFlash?.('Se cargó la demostración.'); }} className="h-9 rounded-xl text-[13.5px] font-medium shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.06]">Cargar demostración</button> : null}
      </div>
    </>
  );
}
