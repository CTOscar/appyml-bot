// Ajustes de operación (equivalente de la página «Ajustes de mapa» del panel actual): parámetros que usa la flota para clasificar el trabajo y
// generar alertas, unidades y capas del mapa, y acciones sobre los datos de hoy. Todo se guarda en este navegador.
import { useState } from 'react';
import clsx from 'clsx';
import { Card, Button } from '../ui/index.jsx';
import { PageHeader, Segmented, SectionTitle } from '../ui/page.jsx';
import { Database, Gauge, Map as MapIcon, Settings2, SlidersHorizontal } from 'lucide-react';
import { MAP_DEFAULTS } from '../lib/units.js';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { OPS_FIELDS, OPS_SWITCHES, getOps, resetOps, saveOps } from '../fleet/opsConfig.js';
import { OPS_DEFAULTS } from '../fleet/ops.js';
import { navigate } from '../app/router.js';

const MAP_KEY = 'pf2-mapa';
const loadMap = () => { try { return { ...MAP_DEFAULTS, ...JSON.parse(localStorage.getItem(MAP_KEY) || '{}') }; } catch { return { ...MAP_DEFAULTS }; } };
const saveMap = (m) => { try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch { /* sin almacenamiento */ } return m; };

const field = 'h-10 w-24 rounded-xl bg-ink/[0.05] px-3 text-right text-[14px] tabular-nums text-fg outline-none shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))] focus:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.6)]';

function Row({ title, hint, children, id }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 py-4 first:border-t-0">
      <div className="min-w-0 max-w-xl"><label htmlFor={id} className="block text-[15px] font-medium">{title}</label>{hint ? <p className="text-[13px] text-muted">{hint}</p> : null}</div>
      {children}
    </div>
  );
}

function Toggle({ id, checked, onChange, label }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={clsx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-ok' : 'bg-ink/20')}>
      <span className={clsx('absolute left-0.5 top-0.5 size-6 rounded-full bg-white transition', checked && 'translate-x-5')} />
    </button>
  );
}

export function Ajustes() {
  const { store } = useFleet();
  const [cfg, setCfg] = useState(() => ({ ...getOps() }));
  const [map, setMap] = useState(loadMap);
  const [msg, setMsg] = useState('');
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };

  const setNum = (f, raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const v = Math.min(f.max, Math.max(f.min, n));
    setCfg(saveOps({ [f.k]: v }));
  };
  const setTime = (k, v) => { if (/^\d{1,2}:\d{2}$/.test(v)) setCfg(saveOps({ [k]: v })); };
  const setM = (k, v) => setMap((m) => saveMap({ ...m, [k]: v }));

  return (
    <div className="mx-auto grid max-w-4xl gap-8">
      <PageHeader icon={Settings2} title="Ajustes de operación"subtitle="Cómo se clasifica el trabajo de cada tractor y cuándo se genera una alerta. Los cambios se aplican al instante." />

      <Card as="section" aria-labelledby="que" className="p-6">
        <SectionTitle id="que" icon={SlidersHorizontal}>Qué se calcula y se muestra</SectionTitle>
        {OPS_SWITCHES.map((f) => (
          <Row key={f.k} id={`sw-${f.k}`} title={f.label} hint={f.hint}><Toggle id={`sw-${f.k}`} checked={!!cfg[f.k]} onChange={(v) => setCfg({ ...saveOps({ [f.k]: v }) })} label={f.label} /></Row>
        ))}
      </Card>

      <Card as="section" aria-labelledby="par" className="p-6">
        <SectionTitle id="par" icon={Gauge}>Parámetros de la flota</SectionTitle>
        {OPS_FIELDS.map((f) => (
          <Row key={f.k} id={`op-${f.k}`} title={f.label} hint={f.hint}>
            <span className="flex items-center gap-2"><input id={`op-${f.k}`} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step} value={cfg[f.k]} onChange={(e) => setNum(f, e.target.value)} className={field} /><span className="w-10 text-[13px] text-muted">{f.unit}</span></span>
          </Row>
        ))}
        <Row id="op-hIni" title="Horario de trabajo permitido" hint="Con el motor encendido fuera de este horario se genera una alerta (una por tractor y día).">
          <span className="flex items-center gap-2"><input id="op-hIni" type="time" aria-label="Inicio" value={cfg.hIni} onChange={(e) => setTime('hIni', e.target.value)} className={clsx(field, 'w-28 text-center')} /><span className="text-muted">a</span><input type="time" aria-label="Fin" value={cfg.hFin} onChange={(e) => setTime('hFin', e.target.value)} className={clsx(field, 'w-28 text-center')} /></span>
        </Row>
      </Card>

      <Card as="section" aria-labelledby="mapa" className="p-6">
        <SectionTitle id="mapa" icon={MapIcon}>Mapa</SectionTitle>
        <Row title="Unidades" hint="Distancias y superficies en el mapa y los reportes."><Segmented label="Unidades" value={map.units} onChange={(v) => setM('units', v)} options={[['metric', 'Métrico (km, ha)'], ['imperial', 'Imperial (mi, ac)']]} /></Row>
        <Row title="Lotes y geocercas" hint="Dibuja los lotes sobre el mapa."><Toggle checked={map.fences} onChange={(v) => setM('fences', v)} label="Lotes y geocercas" /></Row>
        <Row title="Etiquetas de unidades" hint="Muestra el nombre junto a cada tractor."><Toggle checked={map.labels} onChange={(v) => setM('labels', v)} label="Etiquetas de unidades" /></Row>
        <Row title="Tarjeta «Operación de hoy» abierta" hint="Muestra el detalle de la tarjeta al abrir el mapa (se puede plegar desde el mapa)."><Toggle checked={map.ops} onChange={(v) => setM('ops', v)} label="Tarjeta abierta" /></Row>
      </Card>

      <Card as="section" aria-labelledby="hoy" className="p-6">
        <SectionTitle id="hoy" icon={Database}>Datos de hoy</SectionTitle>
        <p className="mt-1 text-[13.5px] text-muted">Se guardan solo en este navegador; no se envían a ningún servidor.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => { if (confirm('¿Borrar los tiempos de trabajo y las alertas de operación de hoy?')) { store.clearToday(); flash('Se borraron los datos de hoy.'); } }}>Borrar datos de hoy</Button>
          {store.canDemo() ? <Button variant="ghost" onClick={() => { store.demo(); flash('Se cargaron tiempos, avance por lote y dos alertas de ejemplo.'); }}>Cargar demostración</Button> : null}
          <Button variant="ghost" onClick={() => { setCfg({ ...resetOps() }); setMap(saveMap({ ...MAP_DEFAULTS })); flash('Valores restablecidos.'); }}>Restablecer valores</Button>
          <Button variant="primary" onClick={() => navigate('/mapa')}>Ver el mapa</Button>
        </div>
        <p role="status" className="mt-3 min-h-5 text-[13.5px] text-ok">{msg}</p>
        <p className="text-[12.5px] text-faint">Valores por defecto: {OPS_DEFAULTS.vLote} km/h en lote, {OPS_DEFAULTS.vTrans} km/h en tránsito, implemento de {OPS_DEFAULTS.ancho} m, {OPS_DEFAULTS.fuelL} L, horario {OPS_DEFAULTS.hIni}–{OPS_DEFAULTS.hFin}.</p>
      </Card>
    </div>
  );
}
