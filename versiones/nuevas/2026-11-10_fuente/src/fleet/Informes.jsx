// Informes · Combustible y velocidad (portado del panel anterior; ahora es una página: #/informes).
// Periodo + tractores con sonda; pestañas Resumen, Gráfica (un tractor), Gráficas (flota por lote) y Lista de cargas/descargas.
// Las gráficas son SVG a mano (sin librerías). Lee el historial con client.getRoute, 4 tractores a la vez.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Copy, Download, Search } from 'lucide-react';
import { navigate } from '../app/router.js';
import { useAuth } from '../app/auth.jsx';
import { useFleet } from './FleetProvider.jsx';
import { dayKey, readPrice } from '../lib/diesel.js';
import { config } from '../config.js';
import {
  QUICK, allEvents, analyzeSeries, byLot, csvName, cumulative, eventsCsv, fleetTotals, fmtClock, fmtDateTime, litersOf, periodRange, shiftDay, toSeries,
} from '../lib/informes.js';
import { Button } from '../ui/index.jsx';
import { Pills } from '../ui/page.jsx';

const nf = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const TABS = [['resumen', 'Resumen'], ['grafica', 'Combustible y velocidad'], ['graficas', 'Gráficas'], ['eventos', 'Cargas y descargas']];
const C = { cons: 'rgb(var(--ink-rgb) / 0.7)', rl: 'rgb(var(--accent-rgb))', dl: 'rgb(var(--crit-rgb))', ok: 'rgb(var(--ok-rgb))', warn: 'rgb(var(--warn-rgb))', info: 'rgb(var(--info-rgb))' };
const PALETTE = [C.rl, C.ok, C.info, C.warn, C.dl, C.cons];
const TXT = 'rgb(var(--ink-rgb) / 0.5)', GRID = 'rgb(var(--ink-rgb) / 0.08)';
const field = 'h-9 rounded-xl bg-ink/[0.05] px-2.5 text-[13.5px] text-fg outline-none shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))] focus-visible:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.6)]';
const rangeLabel = (a, b) => (a === b ? a : `${a} a ${b}`);

/* ---------- piezas pequeñas ---------- */
function CopyImei({ imei }) {
  const [ok, setOk] = useState(false);
  if (!imei) return null;
  const copy = (e) => {
    e.stopPropagation();
    Promise.resolve(navigator.clipboard?.writeText(imei)).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }, () => { window.prompt('Copia el IMEI:', imei); });
  };
  return (
    <button type="button" onClick={copy} aria-label="Copiar IMEI" title={ok ? 'Copiado' : 'Copiar IMEI'}
      className="inline-grid size-6 shrink-0 place-items-center rounded-md text-muted transition hover:bg-ink/[0.08] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
      {ok ? <Check className="size-3.5 text-ok" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

function Panel({ title, aside, children, className }) {
  return (
    <section className={clsx('glass overflow-hidden p-0 animate-rise', className)}>
      <div className="flex items-center gap-3 border-b border-ink/[0.07] px-4 py-2.5"><h3 className="min-w-0 flex-1 truncate text-[13px] font-medium">{title}</h3>{aside ? <span className="text-[12px] text-muted">{aside}</span> : null}</div>
      {children}
    </section>
  );
}

const Legend = ({ items }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-[12px] text-muted">
    {items.map(([c, l, dash]) => <li key={l} className="inline-flex items-center gap-1.5"><i aria-hidden className={clsx('inline-block h-0 w-4 border-t-2', dash && 'border-dashed')} style={{ borderColor: c }} />{l}</li>)}
  </ul>
);

const Th = ({ children, right }) => <th scope="col" className={clsx('whitespace-nowrap px-3 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted', right ? 'text-right' : 'text-left')}>{children}</th>;
const Td = ({ children, right, className }) => <td className={clsx('whitespace-nowrap px-3 py-2', right && 'text-right tabular-nums', className)}>{children}</td>;
const Empty = ({ children }) => <p className="px-4 py-14 text-center text-[14px] text-muted">{children}</p>;

/* ---------- gráficas SVG ---------- */
// Volumen de combustible (L) y velocidad (km/h) en el tiempo, con marcas de carga/descarga y franja de motor encendido.
function FuelSpeed({ series, events }) {
  const pts = series.filter((p) => Number.isFinite(p.t));
  if (pts.length < 2) return <Empty>Sin datos en el periodo.</Empty>;
  const W = 820, H1 = 190, H2 = 110, L = 44, R = 10;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = Math.max(1, t1 - t0);
  const x = (t) => L + (W - L - R) * ((t - t0) / span);
  const step = Math.max(1, Math.ceil(pts.length / 900));
  const fuel = pts.filter((p, i) => typeof p.fuel === 'number' && i % step === 0);
  const fmax = Math.max(10, Math.ceil(Math.max(...fuel.map((p) => p.fuel), 0) / 50) * 50);
  const vmax = Math.max(10, Math.ceil(Math.max(...pts.map((p) => p.kmh)) / 5) * 5);
  const yf = (v) => 10 + (H1 - 28) * (1 - v / fmax), ys = (v) => 8 + (H2 - 24) * (1 - v / vmax);
  const line = (arr, get, y) => arr.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(get(p)).toFixed(1)}`).join('');
  const ticks = Array.from({ length: 6 }, (_, i) => t0 + (span * i) / 5);
  const sp = pts.filter((_, i) => i % step === 0);
  // franjas de motor encendido
  const bands = []; let cur = null;
  pts.forEach((p) => { if (p.ign && !cur) cur = p.t; if (!p.ign && cur != null) { bands.push([cur, p.t]); cur = null; } });
  if (cur != null) bands.push([cur, t1]);
  const axis = (H, Y) => ticks.map((t) => <text key={t} x={x(t)} y={H - 4} textAnchor="middle" fontSize="10" fill={TXT}>{fmtClock(t)}</text>);
  return (
    <div className="grid gap-1 p-3">
      <svg viewBox={`0 0 ${W} ${H1}`} className="w-full" role="img" aria-label="Volumen de combustible en litros durante el periodo">
        {[0, 1, 2, 3, 4].map((i) => { const v = (fmax * i) / 4, y = yf(v); return <g key={i}><line x1={L} x2={W - R} y1={y} y2={y} stroke={GRID} /><text x={L - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill={TXT}>{nf.format(v)}</text></g>; })}
        <text x="4" y="10" fontSize="10" fill={TXT}>L</text>
        <path d={line(fuel, (p) => p.fuel, yf)} fill="none" stroke="rgb(var(--ink-rgb) / 0.85)" strokeWidth="1.8" strokeLinejoin="round" />
        {events.map((e) => <line key={e.t} x1={x(e.t)} x2={x(e.t)} y1="8" y2={H1 - 18} stroke={e.type === 'drain' ? C.dl : C.ok} strokeDasharray="4 3" strokeWidth="1.5"><title>{e.type === 'drain' ? `Descarga −${e.liters} L` : `Carga +${e.liters} L`} · {fmtClock(e.t)}</title></line>)}
        {axis(H1)}
      </svg>
      <svg viewBox={`0 0 ${W} ${H2}`} className="w-full" role="img" aria-label="Velocidad en kilómetros por hora durante el periodo">
        {[0, 1, 2].map((i) => { const v = (vmax * i) / 2, y = ys(v); return <g key={i}><line x1={L} x2={W - R} y1={y} y2={y} stroke={GRID} /><text x={L - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill={TXT}>{nf.format(v)}</text></g>; })}
        <text x="4" y="10" fontSize="10" fill={TXT}>km/h</text>
        {bands.map(([a, b]) => <rect key={a} x={x(a)} y={H2 - 20} width={Math.max(1, x(b) - x(a))} height="4" rx="2" fill={C.ok} opacity="0.55" />)}
        <path d={line(sp, (p) => p.kmh, ys)} fill="none" stroke={C.rl} strokeWidth="1.6" strokeLinejoin="round" />
        {events.map((e) => <line key={e.t} x1={x(e.t)} x2={x(e.t)} y1="8" y2={H2 - 24} stroke={e.type === 'drain' ? C.dl : C.ok} strokeDasharray="4 3" opacity="0.7" />)}
        {axis(H2)}
      </svg>
    </div>
  );
}

function arc(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const big = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${big} 1 ${x1} ${y1}${r0 ? `L${x2} ${y2}A${r0} ${r0} 0 ${big} 0 ${x3} ${y3}Z` : `L${cx} ${cy}Z`}`;
}

// Dona (donut) o pastel: data = [{ label, value, color }]
function Pie({ data, donut, label, unit = 'L' }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return <Empty>Sin datos en el periodo.</Empty>;
  let a = -Math.PI / 2;
  const R1 = 90, R0 = donut ? 56 : 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 p-4">
      <svg viewBox="0 0 200 200" className="size-[200px] shrink-0" role="img" aria-label={label}>
        {data.filter((d) => d.value > 0).map((d) => {
          const a0 = a, a1 = a + (d.value / total) * Math.PI * 2; a = a1;
          const full = d.value >= total;
          return full ? <g key={d.label}><circle cx="100" cy="100" r={R1} fill={d.color} />{donut ? <circle cx="100" cy="100" r={R0} fill="rgb(var(--night-rgb))" /> : null}<title>{d.label}: {nf.format(d.value)} {unit}</title></g>
            : <path key={d.label} d={arc(100, 100, R0, R1, a0, a1 - 0.0001)} fill={d.color} stroke="rgb(var(--night-rgb))" strokeWidth="2"><title>{d.label}: {nf.format(d.value)} {unit} ({Math.round((100 * d.value) / total)} %)</title></path>;
        })}
        {donut ? <text x="100" y="104" textAnchor="middle" fontSize="18" fill="rgb(var(--ink-rgb) / 0.9)" className="tabular-nums">{nf.format(total)} {unit}</text> : null}
      </svg>
      <ul className="grid gap-1.5 text-[13px]">
        {data.map((d) => <li key={d.label} className="flex items-center gap-2"><i aria-hidden className="size-2.5 rounded-sm" style={{ background: d.color }} /><span className="text-soft">{d.label}</span><b className="ml-auto pl-4 font-medium tabular-nums">{nf.format(d.value)} {unit}</b><span className="w-10 text-right text-[12px] tabular-nums text-muted">{Math.round((100 * d.value) / total)} %</span></li>)}
      </ul>
    </div>
  );
}

// Barras horizontales apiladas: rows = [{ label, cons, rl, dl }]
function Stacked({ rows, label }) {
  const max = Math.max(1, ...rows.map((r) => r.cons + r.rl + r.dl));
  if (!rows.length || max <= 1) return <Empty>Sin datos en el periodo.</Empty>;
  return (
    <div className="grid gap-2 p-4" role="img" aria-label={label}>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(70px,120px)_1fr_auto] items-center gap-2 text-[12.5px]">
          <span className="truncate text-soft" title={r.label}>{r.label}</span>
          <div className="flex h-5 overflow-hidden rounded bg-ink/[0.04]" style={{ width: '100%' }}>
            {[['cons', 'Consumo'], ['rl', 'Cargas'], ['dl', 'Descargas']].map(([k, n]) => r[k] > 0 ? <span key={k} title={`${n}: ${nf.format(r[k])} L`} style={{ width: `${(100 * r[k]) / max}%`, background: C[k] }} /> : null)}
          </div>
          <b className="font-medium tabular-nums">{nf.format(r.cons + r.rl + r.dl)} L</b>
        </div>
      ))}
    </div>
  );
}

// Área: consumo acumulado de la flota en el periodo.
function Area({ pts }) {
  if (pts.length < 2) return <Empty>Sin consumo suficiente en el periodo.</Empty>;
  const W = 640, H = 200, L = 44, R = 10, t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = Math.max(1, t1 - t0);
  const max = Math.max(10, Math.ceil(pts[pts.length - 1].y / 50) * 50);
  const x = (t) => L + (W - L - R) * ((t - t0) / span), y = (v) => 10 + (H - 32) * (1 - v / max);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.y).toFixed(1)}`).join('');
  const ticks = Array.from({ length: 5 }, (_, i) => t0 + (span * i) / 4);
  const dd = (t) => new Date(t).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', hour12: false, timeZone: config.tz });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full p-3" role="img" aria-label="Consumo acumulado de la flota en litros">
      <defs><linearGradient id="inf-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="rgb(var(--accent-rgb))" stopOpacity="0.35" /><stop offset="1" stopColor="rgb(var(--accent-rgb))" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((i) => { const v = (max * i) / 4; return <g key={i}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} /><text x={L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill={TXT}>{nf.format(v)}</text></g>; })}
      <path d={`${d}L${x(t1)} ${y(0)}L${x(t0)} ${y(0)}Z`} fill="url(#inf-area)" />
      <path d={d} fill="none" stroke={C.rl} strokeWidth="1.8" strokeLinejoin="round" />
      {ticks.map((t) => <text key={t} x={x(t)} y={H - 6} textAnchor="middle" fontSize="10" fill={TXT}>{dd(t)}</text>)}
    </svg>
  );
}

/* ---------- datos ---------- */
// Historial del periodo por tractor: { st: 'loading' | 'error' | 'ok', series, a }. Carga 4 a la vez.
function usePeriodData(client, ids, from, to) {
  const cache = useRef(new Map());
  const [, bump] = useState(0);
  const key = ids.join(',');
  useEffect(() => {
    if (typeof client.getRoute !== 'function') return undefined;
    let vivo = true;
    const [f, t] = periodRange(from, to);
    const hoyIncl = to >= dayKey(Date.now());
    const jobs = ids.filter((id) => { const c = cache.current.get(`${from}|${to}|${id}`); return !c || c.st === 'error' || (hoyIncl && c.st === 'ok' && Date.now() - c.at > 5 * 60000); });
    jobs.forEach((id) => { const k = `${from}|${to}|${id}`; if (cache.current.get(k)?.st !== 'ok') cache.current.set(k, { st: 'loading' }); });
    if (jobs.length) bump((n) => n + 1);
    const worker = async () => {
      for (let id; (id = jobs.shift()) != null;) {
        let r;
        try { const series = toSeries(await client.getRoute(id, f, t)); r = { st: 'ok', series, a: analyzeSeries(series), at: Date.now() }; } catch { r = { st: 'error' }; }
        cache.current.set(`${from}|${to}|${id}`, r);
        if (vivo) bump((n) => n + 1);
      }
    };
    Promise.all([worker(), worker(), worker(), worker()]);
    return () => { vivo = false; };
  }, [client, key, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  return useCallback((id) => cache.current.get(`${from}|${to}|${id}`), [from, to]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ---------- componente ---------- */
export function Informes() {
  const { client } = useAuth();
  const { store, snap } = useFleet();
  const price = useMemo(() => readPrice(undefined, config.dieselPrice), []);
  const hoy = dayKey(Date.now());
  const [from, setFrom] = useState(hoy);
  const [to, setTo] = useState(hoy);
  const [tab, setTab] = useState('resumen');
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);

  const devs = useMemo(() => [...snap.devices.values()].filter((d) => typeof snap.positions.get(d.id)?.attributes?.fuel === 'number').sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })), [snap]);
  const get = usePeriodData(client, devs.map((d) => d.id), from, to);
  const items = devs.map((d) => ({ d, r: get(d.id) })).filter((x) => x.r?.st === 'ok');
  const pending = devs.filter((d) => get(d.id)?.st === 'loading').length;
  const cur = sel != null && devs.some((d) => d.id === sel) ? sel : (items.find((x) => x.r.a.events.length)?.d.id ?? devs[0]?.id ?? null);
  const curDev = devs.find((d) => d.id === cur);
  const curRes = cur != null ? get(cur) : null;
  const shown = devs.filter((d) => { const s = q.trim().toLowerCase(); return !s || d.name.toLowerCase().includes(s) || String(d.uniqueId || '').includes(s); });
  const tot = fleetTotals(items);
  const events = allEvents(items, all ? null : cur);
  const period = rangeLabel(from, to);

  const setPeriod = (a, b) => { if (a && b) { setFrom(a <= b ? a : b); setTo(a <= b ? b : a); } };
  const exportCsv = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([eventsCsv(events, price)], { type: 'text/csv;charset=utf-8' }));
    a.download = csvName(from, to); a.click(); URL.revokeObjectURL(a.href);
  };
  const lotOf = (d) => store.fenceOf(d.id)?.name;

  /* --- pestañas --- */
  const resumen = (
    <Panel title={`Resumen del periodo · ${period}`} aside={`${items.length} tractores`}>
      {!items.length ? <Empty>{pending ? `Cargando datos (${pending})…` : 'Sin datos en el periodo.'}</Empty> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13.5px]">
              <caption className="sr-only">Resumen de combustible y velocidad por tractor</caption>
              <thead><tr className="border-b border-ink/[0.07]"><Th>Tractor</Th><Th>IMEI</Th><Th right>Consumo, L</Th><Th right>Cargas, L</Th><Th right>Descargas, L</Th><Th right>Costo descargas</Th><Th right>Vel. prom., km/h</Th><Th right>Vel. máx., km/h</Th><Th right>En movimiento, h</Th></tr></thead>
              <tbody>
                {items.map(({ d, r }) => { const dl = litersOf(r.a, 'drain'), rl = litersOf(r.a, 'refuel'); return (
                  <tr key={d.id} className={clsx('border-b border-ink/[0.04] transition hover:bg-ink/[0.04]', d.id === cur && 'bg-ink/[0.05]')}>
                    <Td><button type="button" onClick={() => { setSel(d.id); setTab('grafica'); }} className="font-medium hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" title="Ver su gráfica">{d.name}</button></Td>
                    <Td className="font-mono text-[12px]"><span className="inline-flex items-center gap-1">{d.uniqueId || '—'}<CopyImei imei={d.uniqueId} /></span></Td>
                    <Td right>{nf.format(r.a.consumed)}</Td><Td right>{rl || '—'}</Td><Td right className={dl ? 'font-medium text-crit' : ''}>{dl || '—'}</Td>
                    <Td right>{dl ? mxn.format(dl * price) : '—'}</Td><Td right>{r.a.avgKmh}</Td><Td right>{r.a.maxKmh}</Td><Td right>{nf1.format(r.a.movingH)}</Td>
                  </tr>); })}
              </tbody>
              <tfoot><tr className="bg-ink/[0.04] font-medium"><Td>Total</Td><Td /><Td right>{nf.format(tot.cons)}</Td><Td right>{nf.format(tot.rl)}</Td><Td right className={tot.dl ? 'text-crit' : ''}>{nf.format(tot.dl)}</Td><Td right>{mxn.format(tot.dl * price)}</Td><Td right /><Td right /><Td right>{nf1.format(tot.h)}</Td></tr></tfoot>
            </table>
          </div>
          <p className="border-t border-ink/[0.07] px-4 py-2.5 text-[12px] text-muted">Descarga: baja de 20 L o más con el tractor detenido. Carga: sube 20 L o más. Costo a {mxn.format(price)} por litro. Toca un tractor para ver su gráfica.</p>
        </>
      )}
    </Panel>
  );

  const grafica = !curDev ? <Panel title="Combustible y velocidad"><Empty>No hay tractores con sonda.</Empty></Panel>
    : !curRes || curRes.st === 'loading' ? <Panel title={`Combustible y velocidad · ${curDev.name}`}><Empty>Cargando historial…</Empty></Panel>
    : curRes.st === 'error' ? <Panel title={`Combustible y velocidad · ${curDev.name}`}><Empty>No se pudo cargar el historial.</Empty></Panel> : (
      <Panel title={`Volumen de combustible y velocidad · ${curDev.name} · IMEI ${curDev.uniqueId || '—'}`} aside={period}>
        <FuelSpeed series={curRes.series} events={curRes.a.events} />
        <Legend items={[['rgb(var(--ink-rgb) / 0.85)', 'Volumen de combustible, L'], [C.rl, 'Velocidad, km/h'], [C.ok, 'Motor encendido / carga', true], [C.dl, 'Descarga', true]]} />
        <dl className="grid grid-cols-2 gap-px border-t border-ink/[0.07] bg-ink/[0.07] text-[13px] sm:grid-cols-4">
          {[['Consumo', `${nf.format(curRes.a.consumed)} L`], ['Eventos', curRes.a.events.length], ['Vel. promedio', `${curRes.a.avgKmh} km/h`], ['Vel. máxima', `${curRes.a.maxKmh} km/h`]].map(([k, v]) => (
            <div key={k} className="bg-night px-4 py-2.5"><dt className="text-[12px] text-muted">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>
          ))}
        </dl>
      </Panel>
    );

  const lots = byLot(items, lotOf);
  const graficas = !items.length ? <Panel title="Gráficas"><Empty>{pending ? `Cargando datos (${pending})…` : 'Sin datos en el periodo.'}</Empty></Panel> : (
    <div className="grid gap-3 xl:grid-cols-2">
      <Panel title="Dona · Consumo por lote" aside={period}><Pie donut label="Consumo por lote en litros" data={lots.map(([k, v], i) => ({ label: k, value: v.cons, color: PALETTE[i % PALETTE.length] }))} /></Panel>
      <Panel title="Pastel · Consumo, cargas y descargas" aside={period}><Pie label="Consumo, cargas y descargas en litros" data={[{ label: 'Consumo', value: tot.cons, color: C.cons }, { label: 'Cargas', value: tot.rl, color: C.rl }, { label: 'Descargas', value: tot.dl, color: C.dl }]} /></Panel>
      <Panel title="Barras apiladas · Combustible por lote" aside={period}><Stacked label="Combustible por lote en litros" rows={lots.map(([k, v]) => ({ label: k, ...v }))} /><Legend items={[[C.cons, 'Consumo'], [C.rl, 'Cargas'], [C.dl, 'Descargas']]} /></Panel>
      <Panel title="Área · Consumo acumulado de la flota" aside={period}><Area pts={cumulative(items)} /></Panel>
      <Panel title="Barras · Consumo por tractor (12 mayores)" aside={period} className="xl:col-span-2"><Stacked label="Combustible por tractor en litros" rows={items.map(({ d, r }) => ({ label: d.name, cons: r.a.consumed, rl: litersOf(r.a, 'refuel'), dl: litersOf(r.a, 'drain') })).sort((a, b) => b.cons - a.cons).slice(0, 12)} /><Legend items={[[C.cons, 'Consumo'], [C.rl, 'Cargas'], [C.dl, 'Descargas']]} /></Panel>
    </div>
  );

  const fly = (e) => navigate(`/mapa?d=${e.d.id}`);
  const lista = (
    <Panel title="Lista de cargas y descargas" aside={`${events.length} evento(s)`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-ink/[0.07] px-4 py-2 text-[13px]">
        <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="size-4 accent-[rgb(var(--accent-rgb))]" />Todos los tractores</label>
        <Button size="sm" className="ml-auto" onClick={exportCsv} disabled={!events.length}><Download className="size-3.5" aria-hidden />Exportar CSV</Button>
      </div>
      {!events.length ? <Empty>{pending ? 'Cargando…' : 'Sin cargas ni descargas en el periodo.'}</Empty> : (
        <>
          <ul className="md:hidden">
            {events.map((e) => { const dr = e.type === 'drain'; return (
              <li key={`${e.d.id}-${e.t}`} className="border-b border-ink/[0.05] px-4 py-2.5 text-[13px]">
                <div className="flex items-baseline justify-between"><b className="font-medium">{e.d.name} <span className={dr ? 'text-crit' : 'text-ok'}>· {dr ? 'Descarga' : 'Carga'}</span></b><b className="tabular-nums">{nf.format(e.liters)} L</b></div>
                <div className="font-mono text-[11px] text-muted">IMEI {e.d.uniqueId || '—'}</div>
                <div className="mt-0.5 flex justify-between text-[12px] text-muted"><span>{fmtDateTime(e.t)}</span><span>≈ {mxn.format(e.liters * price)}</span></div>
                <div className="mt-1 flex items-center justify-between text-[12px] text-muted"><span>{Number.isFinite(e.lat) ? `${e.lat.toFixed(4)}, ${e.lon.toFixed(4)}` : '—'}</span><button type="button" onClick={() => fly(e)} className="font-medium text-accent hover:underline">Ver en mapa</button></div>
              </li>); })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-[13px]">
              <caption className="sr-only">Cargas y descargas de combustible</caption>
              <thead><tr className="border-b border-ink/[0.07]"><Th>Tractor</Th><Th>IMEI</Th><Th>Fecha y hora</Th><Th>Evento</Th><Th right>Volumen, L</Th><Th right>Costo estimado</Th><Th>Ubicación</Th><Th><span className="sr-only">Acciones</span></Th></tr></thead>
              <tbody>
                {events.map((e) => { const dr = e.type === 'drain'; return (
                  <tr key={`${e.d.id}-${e.t}`} className="border-b border-ink/[0.04] hover:bg-ink/[0.04]">
                    <Td>{e.d.name}</Td><Td className="font-mono text-[12px]"><span className="inline-flex items-center gap-1">{e.d.uniqueId || '—'}<CopyImei imei={e.d.uniqueId} /></span></Td>
                    <Td>{fmtDateTime(e.t)}</Td><Td className={dr ? 'font-medium text-crit' : 'text-ok'}>{dr ? 'Descarga' : 'Carga'}</Td>
                    <Td right>{nf.format(e.liters)}</Td><Td right>{mxn.format(e.liters * price)}</Td>
                    <Td>{Number.isFinite(e.lat) ? `${e.lat.toFixed(5)}, ${e.lon.toFixed(5)}` : '—'}</Td>
                    <Td><button type="button" onClick={() => fly(e)} className="font-medium text-accent hover:underline">Ver en mapa</button></Td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );

  return (
    <div className="glass overflow-hidden p-0 lg:h-[calc(100dvh-15rem)] lg:min-h-[520px]">
      <div className="grid h-full min-h-0 max-lg:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-ink/[0.08] lg:border-b-0 lg:border-r" aria-label="Periodo y tractores">
          <div className="grid gap-2 border-b border-ink/[0.08] p-3">
            <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted">Periodo</span>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-0.5 text-[12px] text-muted">Desde<input type="date" value={from} max={hoy} onChange={(e) => setPeriod(e.target.value || from, to)} className={field} /></label>
              <label className="grid gap-0.5 text-[12px] text-muted">Hasta<input type="date" value={to} max={hoy} onChange={(e) => setPeriod(from, e.target.value || to)} className={field} /></label>
            </div>
            <label className="grid gap-0.5 text-[12px] text-muted lg:hidden">Tractor
              <select value={cur ?? ''} onChange={(e) => setSel(Number(e.target.value))} className={field}>{devs.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.uniqueId || '—'}</option>)}</select>
            </label>
            <div className="flex gap-3 text-[12.5px]">{QUICK.map(([l, a, b]) => <button key={l} type="button" onClick={() => setPeriod(shiftDay(a), shiftDay(b))} className="font-medium text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{l}</button>)}</div>
          </div>
          <div className="border-b border-ink/[0.08] p-3 max-lg:hidden">
            <label className="flex h-9 items-center gap-2 rounded-xl bg-ink/[0.05] px-2.5 text-muted focus-within:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.6)]">
              <Search className="size-3.5 shrink-0" aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tractor o IMEI" aria-label="Buscar tractor o IMEI" className="min-w-0 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-faint" />
            </label>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto text-[13px] max-lg:hidden" aria-label="Tractores con sonda">
            {shown.map((d) => { const r = get(d.id), n = r?.st === 'ok' ? r.a.events.length : 0; return (
              <li key={d.id}>
                <button type="button" onClick={() => setSel(d.id)} aria-current={d.id === cur ? 'true' : undefined}
                  className={clsx('flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-ink/[0.05] focus-visible:bg-ink/[0.07]', d.id === cur && 'bg-ink/[0.07]')}>
                  <span className="min-w-0 flex-1"><span className={clsx('block truncate', d.id === cur && 'font-medium')}>{d.name}</span><span className="block truncate font-mono text-[11px] text-muted">{d.uniqueId || '—'}</span></span>
                  {n ? <span className="text-[12px] text-muted">{n} ev.</span> : null}
                  <span className="w-12 text-right text-[12px] tabular-nums text-muted">{Math.round(snap.positions.get(d.id).attributes.fuel)} L</span>
                </button>
              </li>); })}
            {!shown.length ? <li className="px-3 py-6 text-center text-muted">Sin resultados</li> : null}
          </ul>
          <p className="border-t border-ink/[0.08] px-3 py-2 text-[12px] text-muted max-lg:hidden">{devs.length} tractores con sonda</p>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex flex-col gap-2 border-b border-ink/[0.08] px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
            <Pills label="Secciones del informe" options={TABS} value={tab} onChange={setTab} />
            {curDev ? (
              <div className="flex shrink-0 items-center gap-2 text-[12.5px]" title="Tractor seleccionado">
                <b className="max-w-[160px] truncate font-medium">{curDev.name}</b>
                <span className="inline-flex items-center gap-1 rounded-lg bg-ink/[0.06] py-0.5 pl-2 pr-1 font-mono tabular-nums">IMEI {curDev.uniqueId || '—'}<CopyImei imei={curDev.uniqueId} /></span>
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 max-lg:max-h-[75dvh]" role="tabpanel">
            {typeof client.getRoute !== 'function' ? <Panel title="Informes"><Empty>El cliente de datos no tiene historial de posiciones (getRoute).</Empty></Panel>
              : !devs.length ? <Panel title="Informes"><Empty>Ningún tractor tiene sonda de combustible.</Empty></Panel>
              : tab === 'resumen' ? resumen : tab === 'grafica' ? grafica : tab === 'graficas' ? graficas : lista}
          </div>
        </div>
      </div>
    </div>
  );
}
