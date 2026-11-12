// Costeo de diésel: por tractor con sonda y por día de la semana (lunes a domingo, hora de Mazatlán).
// Lee el historial de posiciones de cada tractor (client.getRoute) y calcula litros usados, cargas y descargas.
// Tocar un día abre su detalle: litros por hora y nivel del tanque con cargas (verde) y descargas (rojo).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Fuel, X } from 'lucide-react';
import { useAuth } from '../app/auth.jsx';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { analyzeDay, dayKey, dayRange, PRICE_KEY, readPrice, totals, week, weekLabel } from '../lib/diesel.js';
import { config } from '../config.js';
import { brandName } from '../lib/catalog.js';
import { Empty, PageHeader } from '../ui/page.jsx';
import { Stat } from '../ui/index.jsx';

const money = (n, d = 0) => (Number.isFinite(n) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: d, maximumFractionDigits: d }).format(n) : '—');
const num = (n, d = 0) => (Number.isFinite(n) ? new Intl.NumberFormat('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n) : '—');
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const LIVE_MS = 5 * 60000;

// Caché de días analizados: los días pasados no cambian; hoy se renueva cada 5 min. Pide 4 a la vez.
function useDays(client, ids, days) {
  const cache = useRef(new Map());
  const montado = useRef(true);
  const [, bump] = useState(0);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  useEffect(() => {
    if (!client.getRoute) return undefined;
    let vivo = true;
    const hoy = dayKey(Date.now());
    const jobs = [];
    ids.forEach((id) => days.filter((d) => d <= hoy).forEach((d) => {
      const k = id + '|' + d, c = cache.current.get(k);
      if (c && (c.st === 'loading' || (c.st === 'ok' && (d < hoy || Date.now() - c.at < LIVE_MS)))) return;
      cache.current.set(k, { ...(c || {}), st: c?.st === 'ok' ? 'ok' : 'loading', at: c?.at || 0 });
      jobs.push([id, d]);
    }));
    let busy = 0;
    const next = () => {
      if (!vivo) return;
      while (busy < 4 && jobs.length) {
        const [id, d] = jobs.shift(); busy++;
        const [from, to] = dayRange(d);
        Promise.resolve(client.getRoute(id, from, to)).then((rows) => ({ st: 'ok', v: analyzeDay(rows) }), () => ({ st: 'error' }))
          // Aunque este efecto ya se haya cancelado (cambio de semana o doble montaje), el resultado se guarda y se repinta;
          // solo se deja de encadenar trabajos nuevos.
          .then((r) => { cache.current.set(id + '|' + d, { ...r, at: Date.now() }); busy--; if (montado.current) bump((x) => x + 1); next(); });
      }
    };
    next();
    return () => {
      vivo = false;
      // Los trabajos que no llegaron a arrancar se liberan: si no, quedarían «cargando» para siempre.
      jobs.forEach(([id, d]) => { const c = cache.current.get(id + '|' + d); if (c?.st === 'loading' && !c.at) cache.current.delete(id + '|' + d); });
    };
  }, [client, ids.join(','), days.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return useCallback((id, d) => cache.current.get(id + '|' + d), []);
}

function BarsHour({ hr }) {
  const max = Math.max(0.5, ...hr), pk = hr.indexOf(Math.max(...hr));
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label="Litros usados por hora">
        {hr.map((v, h) => (
          <span key={h} title={`${String(h).padStart(2, '0')}:00 · ${num(v, 1)} L`}
            className={clsx('flex-1 rounded-t-sm', h === pk && v > 0 ? 'bg-accent shadow-[0_0_12px_rgb(var(--accent-rgb)/0.6)]' : 'bg-ok/50')} style={{ height: `${v > 0 ? Math.max(2, (100 * v) / max) : 0}%` }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-faint">{[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h}>{String(h % 24).padStart(2, '0')}h</span>)}</div>
    </div>
  );
}

function TankLine({ pts, evs, day }) {
  if (pts.length < 2) return <p className="text-[13px] text-muted">Sin lecturas de nivel suficientes este día.</p>;
  const W = 640, H = 170, t0 = new Date(day + 'T00:00:00-07:00').getTime();
  const fs = pts.map((p) => p[1]); let lo = Math.floor(Math.min(...fs) / 10) * 10, hi = Math.ceil(Math.max(...fs) / 10) * 10; if (hi - lo < 10) hi = lo + 10;
  const x = (t) => 36 + (W - 46) * Math.max(0, Math.min(1, (t - t0) / 864e5)), y = (f) => 10 + (H - 34) * (1 - (f - lo) / (hi - lo));
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Nivel del tanque durante el día">
      <defs><linearGradient id="tanque" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#e6c97c" stopOpacity="0.35" /><stop offset="1" stopColor="#e6c97c" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((i) => { const yy = 10 + (H - 34) * (i / 4); return <g key={i}><line x1="36" x2={W - 10} y1={yy} y2={yy} stroke="#fff" strokeOpacity="0.06" /><text x="30" y={yy + 4} textAnchor="end" fontSize="10" fill="#919c89">{num(hi - ((hi - lo) * i) / 4)}</text></g>; })}
      <path d={`${d}L${x(pts[pts.length - 1][0]).toFixed(1)} ${H - 24}L${x(pts[0][0]).toFixed(1)} ${H - 24}Z`} fill="url(#tanque)" />
      <path d={d} fill="none" stroke="#e6c97c" strokeWidth="2" strokeLinejoin="round" />
      {evs.map((e, i) => <g key={i}><line x1={x(e.t)} x2={x(e.t)} y1="10" y2={H - 24} stroke={e.k === 'load' ? '#6fd48f' : '#ff6f61'} strokeDasharray="3 3" /><title>{e.k === 'load' ? `Carga +${e.L} L` : `Descarga −${e.L} L`}</title></g>)}
      {[0, 6, 12, 18, 24].map((h) => <text key={h} x={x(t0 + h * 36e5)} y={H - 6} textAnchor="middle" fontSize="10" fill="#919c89">{String(h % 24).padStart(2, '0')}h</text>)}
    </svg>
  );
}

export function Costeo() {
  const { client } = useAuth();
  const { snap } = useFleet();
  const [off, setOff] = useState(0);
  const [price, setPrice] = useState(() => readPrice(undefined, config.dieselPrice));
  const [sel, setSel] = useState(null); // { id, day }
  const days = useMemo(() => week(off), [off]);
  const hoy = dayKey(Date.now());

  // Solo tractores con sonda de combustible (la posición trae attributes.fuel).
  const devs = useMemo(() => [...snap.devices.values()].filter((d) => typeof snap.positions.get(d.id)?.attributes?.fuel === 'number')
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })), [snap]);
  const get = useDays(client, devs.map((d) => d.id), days);
  const sinSonda = useMemo(() => [...snap.devices.values()].filter((d) => !devs.includes(d)).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })), [snap, devs]);

  const savePrice = (v) => { setPrice(v); try { if (v > 0) localStorage.setItem(PRICE_KEY, String(v)); } catch { /* sin almacenamiento */ } };
  const rows = devs.map((d) => ({ d, cells: days.map((day) => get(d.id, day)) }));
  const fleet = totals(rows.flatMap((r) => r.cells.map((c) => c?.v)));
  const loading = rows.some((r) => r.cells.some((c) => c?.st === 'loading'));
  const avgCh = fleet.h > 0 ? (fleet.L * price) / fleet.h : null;
  const resumen = rows.map(({ d, cells }) => {
    const t = totals(cells.map((c) => c?.v)), vs = cells.map((c) => c?.v).filter(Boolean);
    const ch = t.h > 0 ? (t.L * price) / t.h : NaN;
    return { d, t, ch, cargas: vs.reduce((n, v) => n + v.loads.length, 0), worked: vs.filter((v) => v.h >= 0.1 || v.L >= 1).length, loading: cells.some((c) => c?.st === 'loading'), alto: Number.isFinite(ch) && avgCh != null && ch > avgCh * 1.2 };
  });
  const det = sel ? get(sel.id, sel.day)?.v : null;
  const selDev = sel ? snap.devices.get(sel.id) : null;

  return (
    <div>
      <PageHeader title="Costeo de diésel" subtitle="Litros usados, cargas y descargas por tractor con sonda y por día. Toca un día para ver el detalle por hora.">
        <label className="flex h-10 items-center gap-2 rounded-full bg-ink/[0.05] px-4 text-[13.5px] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]">
          Precio $<input type="number" min="1" step="0.1" value={price} onChange={(e) => savePrice(parseFloat(e.target.value) || 0)} className="w-16 bg-transparent text-fg outline-none" aria-label="Precio del diésel por litro" />/L
        </label>
        <div className="flex items-center gap-1 rounded-full bg-ink/[0.05] p-1 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]">
          <button type="button" onClick={() => { setOff(off - 1); setSel(null); }} aria-label="Semana anterior" className="grid size-8 place-items-center rounded-full hover:bg-ink/[0.08]"><ChevronLeft className="size-4" /></button>
          <span className="min-w-44 px-2 text-center text-[13.5px] tabular-nums">{weekLabel(days)}</span>
          <button type="button" onClick={() => { setOff(Math.min(0, off + 1)); setSel(null); }} disabled={off >= 0} aria-label="Semana siguiente" className="grid size-8 place-items-center rounded-full hover:bg-ink/[0.08] disabled:opacity-30"><ChevronRight className="size-4" /></button>
        </div>
      </PageHeader>

      <section className="grid-stats mb-6" aria-label="Resumen de la semana">
        <Stat label="Litros usados" value={num(fleet.L)} hint={loading ? 'calculando…' : 'en la semana'} />
        <Stat label="Costo" value={money(fleet.L * price)} hint={`a ${money(price, 2)}/L`} />
        <Stat label="Consumo" value={fleet.h > 0 ? num(fleet.L / fleet.h, 1) : '—'} hint="L por hora de motor" />
        <Stat label="Horas trabajadas" value={num(fleet.h, 1)} hint="motor encendido" />
        <Stat label="Costo por hora" value={fleet.h > 0 ? money(fleet.L * price / fleet.h) : '—'} hint="promedio de la flota" />
        <Stat label="Descargas" value={fleet.nDrains} tone={fleet.nDrains ? 'crit' : undefined} hint={fleet.drains ? `−${num(fleet.drains)} L sospechosos` : 'sin bajas sospechosas'} />
      </section>

      {!client.getRoute ? <Empty icon={Fuel} title="Sin historial disponible" text="El cliente de datos no tiene historial de posiciones (getRoute)." />
        : !devs.length ? <Empty icon={Fuel} title="Ningún tractor tiene sonda" text="El costeo usa la lectura de la sonda de combustible (attributes.fuel)." /> : (
        <div className="glass overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-[13.5px]">
            <caption className="sr-only">Litros por tractor y día</caption>
            <thead>
              <tr className="border-b border-ink/[0.07] text-left">
                <th scope="col" className="px-4 py-3 text-[11.5px] font-medium uppercase tracking-[0.1em] text-muted">Tractor</th>
                {days.map((d, i) => <th key={d} scope="col" className={clsx('px-2 py-3 text-center text-[11.5px] font-medium uppercase tracking-[0.1em]', d === hoy ? 'text-accent' : 'text-muted')}>{DOW[i]} {Number(d.slice(8))}</th>)}
                <th scope="col" className="px-4 py-3 text-right text-[11.5px] font-medium uppercase tracking-[0.1em] text-muted">Semana</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ d, cells }) => {
                const t = totals(cells.map((c) => c?.v));
                return (
                  <tr key={d.id} className="border-b border-ink/[0.04] last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium">{d.name}<span className="block text-[11.5px] font-normal text-muted">{brandName(d.attributes?.marca)} {d.attributes?.modelo || ''}</span></th>
                    {cells.map((c, i) => {
                      const day = days[i], futuro = day > hoy, on = sel?.id === d.id && sel?.day === day;
                      return (
                        <td key={day} className="px-1 py-1.5 text-center">
                          {futuro ? <span className="text-faint">·</span> : !c || c.st === 'loading' ? <span className="inline-block h-8 w-14 animate-pulse rounded-lg bg-ink/[0.04]" />
                            : c.st === 'error' ? <span className="text-[12px] text-crit">error</span> : (
                              <button type="button" onClick={() => setSel(on ? null : { id: d.id, day })} aria-pressed={on}
                                className={clsx('w-full rounded-lg px-1.5 py-1 tabular-nums transition', on ? 'bg-fg text-onfg' : 'hover:bg-ink/[0.06]', c.v.drains.length && !on && 'text-crit')}>
                                <span className="block">{c.v.L > 0 ? `${num(c.v.L)} L` : '—'}</span>
                                <span className={clsx('block text-[11px]', on ? 'text-onfg/70' : 'text-muted')}>{c.v.L > 0 ? money(c.v.L * price) : ''}{c.v.drains.length ? ' ⚠' : ''}</span>
                              </button>
                            )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right tabular-nums"><b className="font-medium">{num(t.L)} L</b><span className="block text-[11.5px] text-muted">{money(t.L * price)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {devs.length && sinSonda.length ? (
        <p className="mt-3 text-[12.5px] text-muted">
          No aparecen en el costeo por no tener sonda de combustible: <b className="font-medium text-soft">{sinSonda.map((d) => d.name).join(', ')}</b>.
          {' '}Si un tractor sí tiene sonda, revisa que el rastreador envíe el nivel (<code>fuel</code>).
        </p>
      ) : null}

      {devs.length && client.getRoute ? (
        <section className="mt-6" aria-label="Resumen semanal por tractor">
          <h2 className="mb-2 font-display text-xl font-light">Resumen semanal · {weekLabel(days)}</h2>
          <div className="glass overflow-x-auto p-0">
            <table className="w-full min-w-[860px] text-[13.5px] tabular-nums">
              <caption className="sr-only">Resumen semanal de diésel por tractor</caption>
              <thead><tr className="border-b border-ink/[0.07] text-right text-[11.5px] font-medium uppercase tracking-[0.1em] text-muted">
                {['Tractor', 'Cargas/sem', 'Costo cargas', 'Horas/día', 'L/día usados', 'Horas/sem', 'Costo/hora', 'Total litros', 'Total costo'].map((h, i) => <th key={h} scope="col" className={clsx('px-3 py-3', i === 0 && 'text-left')}>{h}</th>)}
              </tr></thead>
              <tbody>
                {resumen.map((r) => (
                  <tr key={r.d.id} className="border-b border-ink/[0.04] text-right">
                    <th scope="row" className="px-3 py-2.5 text-left font-medium">{r.d.name}<span className="block text-[11.5px] font-normal text-muted">{brandName(r.d.attributes?.marca)} {r.d.attributes?.modelo || ''}</span></th>
                    <td className="px-3">{r.cargas}</td><td className="px-3">{r.loading ? '…' : money(r.t.loads * price)}</td>
                    <td className="px-3">{r.worked ? num(r.t.h / r.worked, 1) : '—'}</td><td className="px-3">{r.worked ? num(r.t.L / r.worked) : '—'}</td>
                    <td className="px-3">{num(r.t.h, 1)}</td>
                    <td className={clsx('px-3', r.alto && 'font-medium text-crit')} title={r.alto ? '20 % o más arriba del promedio de la flota' : undefined}>{Number.isFinite(r.ch) ? money(r.ch) : '—'}</td>
                    <td className="px-3">{num(r.t.L)} L</td><td className="px-3 font-medium">{money(r.t.L * price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="text-right font-medium"><td className="px-3 py-2.5 text-left">Total</td><td className="px-3">{resumen.reduce((n, r) => n + r.cargas, 0)}</td><td className="px-3">{money(fleet.loads * price)}</td><td /><td /><td className="px-3">{num(fleet.h, 1)}</td><td className="px-3">{avgCh != null ? money(avgCh) : '—'}</td><td className="px-3">{num(fleet.L)} L</td><td className="px-3">{money(fleet.L * price)}</td></tr></tfoot>
            </table>
          </div>
          <p className="mt-2 text-[12.5px] text-muted">Costo = litros usados × $/L. Costo cargas = litros cargados × $/L. En rojo: costo por hora 20 % o más arriba del promedio de la flota.</p>
        </section>
      ) : null}

      {sel && det ? (
        <section className="glass mt-6 grid gap-5 p-5 animate-rise" aria-label="Detalle del día">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl font-light">{selDev?.name} · {new Date(sel.day + 'T12:00:00Z').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</h2>
            <a href={`#/mapa?d=${sel.id}`} className="ml-auto self-center text-[13.5px] text-accent hover:underline">Ver en el mapa</a>
            <button type="button" onClick={() => setSel(null)} aria-label="Cerrar detalle" className="grid size-9 place-items-center rounded-xl text-muted hover:bg-ink/[0.08] hover:text-fg"><X className="size-4" /></button>
          </div>
          <div className="grid-stats">
            <Stat label="Litros usados" value={`${num(det.L, 1)}`} hint="L" />
            <Stat label="Horas de motor" value={num(det.h, 1)} hint="h" />
            <Stat label="Consumo" value={det.h > 0 ? num(det.L / det.h, 1) : '—'} hint="L/h" />
            <Stat label="Costo" value={money(det.L * price)} />
            <Stat label="Cargas" value={det.loads.length ? `+${num(det.loads.reduce((s, x) => s + x, 0))}` : '0'} tone="ok" hint={`${det.loads.length} carga(s)`} />
            <Stat label="Descargas" value={det.drains.length ? `−${num(det.drains.reduce((s, x) => s + x, 0))}` : '0'} tone={det.drains.length ? 'crit' : undefined} hint={`${det.drains.length} descarga(s)`} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div><h3 className="mb-3 text-[12px] uppercase tracking-[0.12em] text-muted">Litros usados por hora</h3><BarsHour hr={det.hr} /></div>
            <div><h3 className="mb-3 text-[12px] uppercase tracking-[0.12em] text-muted">Nivel del tanque (L)</h3><TankLine pts={det.pts} evs={det.evs} day={sel.day} /></div>
          </div>
          <p className="text-[12px] text-faint">Las barras suman solo el consumo (bajas menores a 20 L). Las líneas verticales marcan cargas (verde) y descargas (rojo): bajas de 20 L o más con el tractor parado.</p>
        </section>
      ) : null}
    </div>
  );
}
