// Reportes del día: horas de motor por rancho y por tractor (barras con el promedio de la flota), o en tabla.
import { useMemo, useState } from 'react';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { navigate } from '../app/router.js';
import { STATUS } from '../lib/fleet.js';
import { DataTable, PageHeader, Segmented, StatusDot } from '../ui/page.jsx';
import { Stat } from '../ui/index.jsx';

const nf1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

// Barras horizontales accesibles (cada barra es un botón si hay onPick).
// Geometría: padding 0.25rem + etiqueta 9rem + hueco 0.75rem → la barra empieza en 10rem y mide 100% − 15.5rem.
function Bars({ data, avg, onPick, unit = 'h' }) {
  const max = Math.max(0.1, ...data.map((d) => d.value), avg || 0);
  return (
    <ol className="relative grid gap-1.5">
      {avg ? <span aria-hidden className="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-accent/60" style={{ left: `calc(10rem + (100% - 15.5rem) * ${avg / max})` }} /> : null}
      {data.map((d) => {
        const Tag = onPick ? 'button' : 'div';
        return (
          <li key={d.key}>
            <Tag type={onPick ? 'button' : undefined} onClick={onPick ? () => onPick(d) : undefined}
              className="grid w-full grid-cols-[9rem_1fr_4.5rem] items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-ink/[0.04]">
              <span className="flex min-w-0 items-center gap-2 truncate text-[13.5px] text-soft">{d.tone ? <StatusDot tone={d.tone} /> : null}<span className="truncate">{d.label}</span></span>
              <span className="h-2.5 overflow-hidden rounded-full bg-ink/[0.05]">
                <span className="block h-full rounded-full bg-gradient-to-r from-ok/70 to-accent" style={{ width: `${(100 * d.value) / max}%` }} />
              </span>
              <span className="text-right text-[13px] tabular-nums">{nf1.format(d.value)} {unit}</span>
            </Tag>
          </li>
        );
      })}
    </ol>
  );
}

export function Reportes() {
  const { store, snap } = useFleet();
  const [top, setTop] = useState('10');
  const [vista, setVista] = useState('grafica');

  const { ranchos, all, total, avg, running } = useMemo(() => {
    const by = new Map();
    snap.positions.forEach((p, id) => {
      const name = store.fenceOf(id)?.name?.split(' · ')[0] || 'Fuera de lote';
      const r = by.get(name) || { ms: 0, count: 0, running: 0 };
      r.ms += snap.engineToday.get(id) || 0; r.count++; if (store.statusOf(id) === 'running') r.running++;
      by.set(name, r);
    });
    const ranchos = [...by].sort((a, b) => b[1].ms - a[1].ms).map(([name, r]) => ({ key: name, label: name, value: r.ms / 3600e3, count: r.count, running: r.running }));
    const all = [...snap.devices.values()].map((d) => ({ key: d.id, id: d.id, label: d.name, value: (snap.engineToday.get(d.id) || 0) / 3600e3, tone: STATUS[store.statusOf(d.id)].tone }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    let total = 0; snap.engineToday.forEach((ms) => { total += ms; });
    const activos = all.filter((d) => d.value > 0).length;
    return { ranchos, all, total, avg: total / 3600e3 / Math.max(1, activos), running: all.filter((d) => d.tone === 'ok').length };
  }, [snap, store]);
  const shown = top === 'all' ? all : all.slice(0, Number(top));

  return (
    <div>
      <PageHeader title="Reportes del día" subtitle="Horas de motor de hoy por rancho y por tractor. Toca un tractor para verlo en el mapa." />
      <section className="grid-stats mb-8" aria-label="Resumen">
        <Stat label="Horas totales" value={nf1.format(total / 3600e3)} hint="motor encendido hoy" />
        <Stat label="Promedio" value={nf1.format(avg)} hint="h por tractor activo" />
        <Stat label="Utilización" value={`${Math.round((100 * running) / Math.max(1, all.length))} %`} tone="ok" hint="tractores en marcha ahora" />
        <Stat label="Ranchos" value={ranchos.filter((r) => r.key !== 'Fuera de lote').length} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="glass p-5" aria-labelledby="r-rancho">
          <h2 id="r-rancho" className="mb-4 font-display text-xl font-light">Horas por rancho</h2>
          <Bars data={ranchos} />
          <ul className="mt-4 grid gap-1 text-[12.5px] text-muted">
            {ranchos.map((r) => <li key={r.key}>{r.label}: {r.count} tractores · {r.running} en marcha</li>)}
          </ul>
        </section>

        <section className="glass p-5" aria-labelledby="r-trac">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="r-trac" className="font-display text-xl font-light">Horas por tractor</h2>
            <div className="flex flex-wrap gap-2">
              <Segmented label="Cuántos" value={top} onChange={setTop} options={[['10', 'Top 10'], ['20', 'Top 20'], ['all', 'Todos']]} />
              <Segmented label="Vista" value={vista} onChange={setVista} options={[['grafica', 'Gráfica'], ['tabla', 'Tabla']]} />
            </div>
          </div>
          {vista === 'grafica' ? (
            <>
              <Bars data={shown} avg={avg} onPick={(d) => navigate(`/mapa?d=${d.id}`)} />
              <p className="mt-3 text-[12px] text-faint">La línea punteada es el promedio de la flota ({nf1.format(avg)} h).</p>
            </>
          ) : (
            <DataTable caption="Horas por tractor" onRow={(r) => navigate(`/mapa?d=${r.id}`)} rows={shown}
              cols={[
                { key: 'label', label: 'Tractor', render: (r) => <b className="font-medium">{r.label}</b> },
                { key: 'st', label: 'Estado', render: (r) => { const s = store.statusOf(r.id); return <span className="flex items-center gap-2"><StatusDot tone={STATUS[s].tone} />{STATUS[s].label}</span>; } },
                { key: 'l', label: 'Lote', render: (r) => store.fenceOf(r.id)?.name || '—' },
                { key: 'v', label: 'Horas hoy', align: 'right', render: (r) => nf1.format(r.value) },
              ]} />
          )}
        </section>
      </div>
      <p className="mt-8 rounded-2xl border border-dashed border-ink/10 px-4 py-3 text-[12.5px] text-muted">L/h, costo por lote y preventivos se agregan cuando la API tenga base de datos (historial en <code>position_samples</code>).</p>
    </div>
  );
}
