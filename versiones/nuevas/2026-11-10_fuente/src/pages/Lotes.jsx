// Lotes: cada geocerca con su forma, superficie, cultivo, tractores dentro y horas de motor de hoy. Tocar uno lo abre en el mapa.
import { useMemo, useState } from 'react';
import { MapPinned, Search } from 'lucide-react';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { navigate } from '../app/router.js';
import { DataTable, Empty, PageHeader, Segmented, StatusDot } from '../ui/page.jsx';
import { Button, Skeleton, Stat } from '../ui/index.jsx';
import { LoteEditor } from '../fleet/LoteEditor.jsx';
import { alertasTexto } from '../fleet/loteAlerts.js';
import { ago, evInfo } from '../lib/events.js';
import { distM } from '../fleet/geoTools.js';
import { STATUS } from '../lib/fleet.js';

const nf1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

// Dibujo del contorno del lote, normalizado a su caja (lat hacia arriba, lon a la derecha).
function Shape({ g, color }) {
  const s = g.shape;
  if (!s || s.type !== 'polygon' || s.points.length < 3) return <span className="grid size-16 place-items-center rounded-xl bg-ink/[0.05] text-faint"><MapPinned className="size-6" /></span>;
  const lat = s.points.map((p) => p[0]), lon = s.points.map((p) => p[1]);
  const [a, b, c, d] = [Math.min(...lat), Math.max(...lat), Math.min(...lon), Math.max(...lon)];
  const k = Math.cos(((a + b) / 2) * Math.PI / 180), w = (d - c) * k || 1e-6, h = b - a || 1e-6, sc = 52 / Math.max(w, h);
  const pts = s.points.map(([y, x]) => `${(6 + ((x - c) * k) * sc + (52 - w * sc) / 2).toFixed(1)},${(6 + (b - y) * sc + (52 - h * sc) / 2).toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 rounded-xl bg-ink/[0.04]" aria-hidden>
      <polygon points={pts} fill={color} fillOpacity="0.14" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />
    </svg>
  );
}

// Malla del lote (forma dibujada): tipo, perímetro, vértices o radio y centro. Igual que «Malla del lote» del panel actual.
export function meshOf(g) {
  const sh = g.shape; if (!sh) return null;
  if (sh.type === 'circle') return { kind: 'Círculo', per: 2 * Math.PI * sh.radius, r: sh.radius, pts: [], c: sh.center };
  const pts = sh.points || [];
  let per = 0; for (let i = 0; i < pts.length; i++) per += distM(pts[i], pts[(i + 1) % pts.length]);
  const c = pts.length ? [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length] : [0, 0];
  return { kind: sh.type === 'line' ? 'Línea' : 'Polígono', per, pts, c };
}
const M = ({ l, v }) => <div className="rounded-xl bg-ink/[0.05] px-3 py-2"><small className="block text-[11.5px] text-muted">{l}</small><b className="block text-[15px] font-medium tabular-nums">{v}</b></div>;

function LoteDetail({ g, snap, store, onClose }) {
  const [edit, setEdit] = useState(false);
  const ids = [...snap.positions.values()].filter((p) => (p.geofenceIds || []).includes(g.id)).map((p) => p.deviceId);
  const trs = ids.map((id) => ({ id, st: store.statusOf(id), h: (snap.engineToday.get(id) || 0) / 3600e3 })).sort((a, b) => b.h - a.h);
  const horas = trs.reduce((n, t) => n + t.h, 0), run = trs.filter((t) => t.st === 'running').length;
  const av = store.avanceLotes().find((x) => x.id === g.id);
  const at = g.attributes || {}, mesh = meshOf(g);
  const set = new Set(ids);
  const ev = snap.events.filter((e) => e.geofenceId === g.id || set.has(e.deviceId)).map((e) => ({ e, i: evInfo(e), at: new Date(e.eventTime).getTime() })).sort((a, b) => b.at - a.at).slice(0, 15);
  return (
    <section className="glass mt-6 grid gap-6 p-6 animate-rise" aria-label={`Detalle de ${g.name}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-light">{g.name}</h2>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="primary" onClick={() => navigate(`/mapa?l=${g.id}`)}>Ver en el mapa</Button><Button size="sm" variant="ghost" onClick={() => setEdit(!edit)} aria-expanded={edit}>{edit ? 'Cerrar ajustes' : 'Ajustes del lote'}</Button><Button size="sm" variant="ghost" onClick={() => navigate('/reportes')}>Reportes</Button><Button size="sm" variant="ghost" onClick={onClose}>Cerrar</Button></div>
      </div>
      {edit ? <div className="rounded-2xl border border-ink/10 p-4 sm:p-5"><LoteEditor key={g.id} g={g} store={store} onClose={() => setEdit(false)} /></div> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <M l="Tractores dentro" v={trs.length} /><M l="En marcha" v={run} /><M l="Horas motor hoy" v={`${nf1.format(horas)} h`} /><M l="Superficie" v={`${nf1.format(g.ha || 0)} ha`} />
        <M l="Promedio por tractor" v={`${nf1.format(trs.length ? horas / trs.length : 0)} h`} />
        <M l="Eficiencia" v={`${Math.round(trs.length ? (run / trs.length) * 100 : 0)} %`} />
        <M l="Ha por tractor" v={trs.length && (g.ha || at.superficie) ? nf1.format((Number(at.superficie) || g.ha) / trs.length) : '—'} />
        <M l="Apagados · sin señal" v={`${trs.filter((t) => t.st === 'idle').length} · ${trs.filter((t) => t.st === 'nosignal').length}`} />
        {av ? <M l="Avance de hoy" v={`${nf1.format(av.done)} ha · ${Math.round(av.pct)} %`} /> : null}
      </div>
      <div>
        <h3 className="mb-2 text-[12px] uppercase tracking-[0.14em] text-accent">Tractores en el lote</h3>
        {trs.length ? <ul className="grid gap-0.5 sm:grid-cols-2">{trs.map((t) => (
          <li key={t.id}><button type="button" onClick={() => navigate(`/mapa?d=${t.id}`)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-ink/[0.05]"><StatusDot tone={STATUS[t.st].tone} /><span className="min-w-0 flex-1"><b className="block truncate text-[14px] font-medium">{snap.devices.get(t.id)?.name}</b><small className="text-[12px] text-muted">{STATUS[t.st].label}</small></span><em className="not-italic tabular-nums text-[13px] text-soft">{nf1.format(t.h)} h</em></button></li>))}</ul>
          : <p className="text-[13.5px] text-muted">Ahora mismo ningún tractor reporta posición dentro del lote.</p>}
      </div>
      <div>
        <h3 className="mb-2 text-[12px] uppercase tracking-[0.14em] text-accent">Malla del lote</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <M l="Cultivo" v={at.cultivo || '—'} /><M l="Etapa" v={at.etapa || '—'} /><M l="Responsable" v={at.responsable || '—'} /><M l="Superficie registrada" v={at.superficie ? `${at.superficie} ha` : '—'} /><M l="Horas máx. por tractor" v={at.horasMax ? `${at.horasMax} h` : 'Sin límite'} /><M l="Alertas de lote" v={alertasTexto(at)} />
          {mesh ? <><M l="Tipo" v={mesh.kind} /><M l="Perímetro" v={`${nf1.format(mesh.per)} m`} />{mesh.pts.length ? <M l="Vértices" v={mesh.pts.length} /> : <M l="Radio" v={`${nf1.format(mesh.r)} m`} />}<M l="Centro" v={`${mesh.c[0].toFixed(5)}, ${mesh.c[1].toFixed(5)}`} /></> : null}
        </div>
        {!mesh ? <p className="mt-2 text-[13px] text-muted">Este lote no tiene una malla (polígono) dibujada.</p> : null}
        {mesh?.pts.length ? <details className="mt-3 text-[13px]"><summary className="cursor-pointer text-accent">Ver vértices de la malla</summary><ol className="mt-2 grid gap-0.5 pl-6 font-mono text-[12px] text-muted">{mesh.pts.map((p, i) => <li key={i}>{p[0].toFixed(5)}, {p[1].toFixed(5)}</li>)}</ol></details> : null}
      </div>
      <div>
        <h3 className="mb-2 text-[12px] uppercase tracking-[0.14em] text-accent">Registros del lote</h3>
        {ev.length ? <ul className="grid gap-0.5">{ev.map((x) => (
          <li key={x.e.id} className="flex items-start gap-3 rounded-xl px-2 py-1.5 text-[13.5px]"><StatusDot tone={x.i.high ? 'crit' : 'muted'} /><span><b className="font-medium">{snap.devices.get(x.e.deviceId)?.name || `#${x.e.deviceId}`} — {x.i.label}</b><small className="block text-[12px] text-muted">{new Date(x.at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })} · {ago(x.at)}</small></span></li>))}</ul>
          : <p className="text-[13.5px] text-muted">No hay eventos de este lote ni de sus tractores.</p>}
      </div>
    </section>
  );
}

export function Lotes() {
  const { store, snap } = useFleet();
  const [orden, setOrden] = useState('horas');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);

  const rows = useMemo(() => {
    const st = new Map(snap.geofences.map((g) => [g.id, { g, total: 0, running: 0, ms: 0 }]));
    snap.positions.forEach((p, id) => {
      const r = st.get(p.geofenceIds?.[0]); if (!r) return;
      r.total++; if (store.statusOf(id) === 'running') r.running++;
      r.ms += snap.engineToday.get(id) || 0;
    });
    const t = q.trim().toLowerCase();
    const list = [...st.values()].filter((r) => !t || r.g.name.toLowerCase().includes(t) || String(r.g.attributes?.cultivo || '').toLowerCase().includes(t));
    const by = { horas: (a, b) => b.ms - a.ms, nombre: (a, b) => a.g.name.localeCompare(b.g.name, 'es', { numeric: true }), superficie: (a, b) => b.g.ha - a.g.ha };
    return list.sort(by[orden]);
  }, [snap, store, orden, q]);

  const haTot = snap.geofences.reduce((s, g) => s + (g.ha || 0), 0);
  const ocupados = rows.filter((r) => r.total > 0).length;
  const enLotes = rows.reduce((n, r) => n + r.total, 0);

  return (
    <div>
      <PageHeader title="Lotes" subtitle="Geocercas del rancho con su superficie, cultivo y actividad de hoy. Toca un lote para verlo en el mapa." />
      <section className="grid-stats mb-6" aria-label="Resumen">
        <Stat label="Lotes" value={snap.geofences.length} />
        <Stat label="Superficie" value={`${nf1.format(haTot)}`} hint="hectáreas" />
        <Stat label="Tractores en lotes" value={enLotes} tone="ok" hint={`${ocupados} lote${ocupados === 1 ? '' : 's'} con tractores`} />
        <Stat label="En marcha" value={rows.reduce((s, r) => s + r.running, 0)} hint="dentro de lotes" />
        <Stat label="Fuera de lotes" value={Math.max(0, snap.positions.size - enLotes)} hint="en tránsito o sin lote" />
        <Stat label="Horas hoy" value={nf1.format(rows.reduce((s, r) => s + r.ms, 0) / 3600e3)} hint="en lotes" />
      </section>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-full max-w-sm items-center gap-2 rounded-full bg-ink/[0.05] px-4 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))] focus-within:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.5)]">
          <Search className="size-4 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lote o cultivo" aria-label="Buscar lote" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
        </div>
        <Segmented label="Ordenar" value={orden} onChange={setOrden} options={[['horas', 'Más actividad'], ['superficie', 'Superficie'], ['nombre', 'Nombre']]} />
      </div>

      {!snap.loaded ? <Skeleton lines={4} label="Cargando lotes…" /> : rows.length ? (
        <section className="grid-cards" aria-label="Lotes">
          {rows.map(({ g, total, running, ms }, i) => {
            const color = g.attributes?.color || '#e6c97c';
            return (
              <button key={g.id} type="button" onClick={() => { setSel(sel === g.id ? null : g.id); setTimeout(() => document.getElementById('detalle-lote')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }} aria-pressed={sel === g.id} style={{ animationDelay: 40 * i + 'ms' }}
                className="glass flex min-w-0 items-center gap-4 overflow-hidden p-4 text-left transition animate-rise hover:-translate-y-0.5 hover:shadow-glow">
                <Shape g={g} color={color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg">{g.name}</span>
                  <span className="block text-[13px] text-muted">{g.ha ? `${nf1.format(g.ha)} ha` : 'Superficie sin calcular'}{g.attributes?.cultivo ? ` · ${g.attributes.cultivo}` : ''}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-[13px] text-soft"><StatusDot tone={running ? 'ok' : 'muted'} />{total} tractor{total === 1 ? '' : 'es'} · {running} en marcha</span>
                </span>
                <span className="text-right">
                  <span className="block font-display text-2xl tabular-nums">{nf1.format(ms / 3600e3)}</span>
                  <span className="block text-[11px] text-faint">h hoy</span>
                </span>
              </button>
            );
          })}
        </section>
      ) : <Empty icon={MapPinned} title={q ? 'Ningún lote coincide' : 'No hay lotes'} text={q ? `Nada coincide con «${q}».` : 'Dibuja los lotes (geocercas) en Traccar para verlos aquí.'} />}
      {rows.length ? (
        <section className="mt-8" aria-label="Todos los lotes">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-display text-xl font-light">Todos los lotes</h2><p className="text-[13px] text-muted">Resumen comparativo. Toca una fila para ver su detalle.</p></div><Button size="sm" variant="ghost" onClick={() => navigate('/reportes')}>Reportes</Button></div>
          <DataTable caption="Todos los lotes" rows={rows} rowKey={(r) => r.g.id} onRow={(r) => { setSel(r.g.id); setTimeout(() => document.getElementById('detalle-lote')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }}
            cols={[
              { key: 'n', label: 'Lote', render: (r) => <b className="font-medium">{r.g.name}</b> },
              { key: 't', label: 'Tractores', align: 'right', render: (r) => r.total },
              { key: 'r', label: 'En marcha', align: 'right', render: (r) => r.running },
              { key: 'h', label: 'Horas hoy', align: 'right', render: (r) => `${nf1.format(r.ms / 3600e3)} h` },
              { key: 'e', label: 'Eficiencia', align: 'right', render: (r) => `${Math.round(r.total ? (r.running / r.total) * 100 : 0)} %` },
              { key: 's', label: 'Superficie', align: 'right', render: (r) => `${nf1.format(r.g.ha || 0)} ha` },
            ]} />
        </section>
      ) : null}
    <div id="detalle-lote" className="scroll-mt-28">{sel != null && snap.geofences.find((g) => g.id === sel) ? <LoteDetail g={snap.geofences.find((g) => g.id === sel)} snap={snap} store={store} onClose={() => setSel(null)} /> : null}</div>
    </div>
  );
}
