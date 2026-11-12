// «Ajustes del lote»: nombre, cultivo, superficie, etapa, responsable, color y alertas. El contorno (polígono) viene de Traccar y no se edita aquí.
import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button, Field, Input } from '../ui/index.jsx';
import { COLORES, CULTIVOS, ETAPAS, applyLoteForm, loteForm, validateLote } from './loteAlerts.js';

const SEL = 'h-11 w-full rounded-2xl bg-ink/[0.04] px-3.5 text-[15px] text-fg outline-none shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))] focus:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.55)]';
const Opts = ({ list }) => <><option value="">Sin definir</option>{list.map((o) => <option key={o} value={o}>{o}</option>)}</>;

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1.5">
      <span className="grid gap-0.5"><span className="text-[14px] font-medium">{label}</span>{hint ? <span className="text-[12.5px] text-muted">{hint}</span> : null}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[rgb(var(--accent-rgb))]" />
    </label>
  );
}

export function LoteEditor({ g, store, onClose }) {
  const [f, setF] = useState(() => loteForm(g));
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const on = (k) => (e) => set(k)(e.target.value);

  async function submit(e) {
    e.preventDefault();
    const err = validateLote(f);
    if (err) return setMsg({ ok: false, text: err });
    setBusy(true);
    try { await store.saveFence(applyLoteForm(g, f)); setMsg({ ok: true, text: 'Lote guardado.' }); }
    catch { setMsg({ ok: false, text: 'No se pudo guardar el lote. Intenta de nuevo.' }); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" aria-label={`Ajustes del lote ${g.name}`}>
      <h3 className="text-[12px] uppercase tracking-[0.14em] text-accent">General</h3>
      <Field label="Nombre del lote" error={msg && !msg.ok && !f.name.trim() ? msg.text : null}>{(id) => <Input id={id} value={f.name} onChange={on('name')} required aria-invalid={!f.name.trim() && msg && !msg.ok ? true : undefined} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cultivo">{(id) => <select id={id} className={SEL} value={f.cultivo} onChange={on('cultivo')}><Opts list={CULTIVOS} /></select>}</Field>
        <Field label="Superficie (ha)">{(id) => <Input id={id} type="number" min="0" step="0.1" inputMode="decimal" placeholder="0.0" value={f.superficie} onChange={on('superficie')} />}</Field>
      </div>
      <Field label="Etapa del cultivo">{(id) => <select id={id} className={SEL} value={f.etapa} onChange={on('etapa')}><Opts list={ETAPAS} /></select>}</Field>
      <Field label="Responsable">{(id) => <Input id={id} placeholder="Nombre del encargado del lote" value={f.responsable} onChange={on('responsable')} />}</Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[13px] font-medium text-soft">Color en el mapa</legend>
        <div className="flex flex-wrap gap-2">
          {COLORES.map(([hex, name]) => (
            <label key={hex} className="cursor-pointer" title={name}>
              <input type="radio" name="color" value={hex} checked={f.color.toLowerCase() === hex.toLowerCase()} onChange={on('color')} className="peer sr-only" />
              <span className="grid size-9 place-items-center rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-transparent transition peer-checked:ring-fg peer-focus-visible:ring-accent" style={{ background: hex }}><span className="sr-only">{name}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <h3 className="mt-2 text-[12px] uppercase tracking-[0.14em] text-accent">Alertas del lote</h3>
      <div className="grid gap-2 rounded-2xl bg-ink/[0.04] p-4">
        <Switch checked={f.alertaEntrada} onChange={set('alertaEntrada')} label="Avisar cuando un tractor entra" hint="Evento de entrada a la geocerca" />
        <Switch checked={f.alertaSalida} onChange={set('alertaSalida')} label="Avisar cuando un tractor sale" hint="Útil para detectar trabajos fuera del lote asignado" />
        <Field label="Horas máximas por tractor al día" hint="Alerta si un tractor pasa de estas horas de motor dentro del lote.">{(id) => <Input id={id} type="number" min="0" max="24" step="0.5" inputMode="decimal" placeholder="Sin límite" value={f.horasMax} onChange={on('horasMax')} />}</Field>
      </div>
      <div role="status" className={msg ? `rounded-xl px-3 py-2.5 text-[13.5px] ${msg.ok ? 'bg-ok/10 text-ok' : 'bg-crit/10 text-crit'}` : 'sr-only'}>{msg?.text}</div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={busy}><Check className="size-4" aria-hidden />Guardar lote</Button>
        <Button type="button" variant="ghost" onClick={onClose}>{msg?.ok ? 'Cerrar' : 'Cancelar'}</Button>
      </div>
    </form>
  );
}
