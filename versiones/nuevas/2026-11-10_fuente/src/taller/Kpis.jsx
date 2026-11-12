// Costos y KPIs del taller por periodo: costo por hora y por hectárea, disponibilidad, MTBF/MTTR, cumplimiento de preventivo,
// costo por equipo con veredicto, por sistema y causa, por lote, tendencia mensual y paros.
import { useState } from 'react';
import { Badge, Card, Stat } from '../ui/index.jsx';
import { DataTable } from '../ui/page.jsx';
import { useTaller } from './useTaller.js';

const TONE = { ok: 'ok', warn: 'warn', bad: 'crit', info: 'info', plain: 'muted' };

function Bars({ rows, fmt }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="mt-3 grid gap-2.5">
      {rows.length ? rows.map(([k, v, extra]) => (
        <li key={k} className="text-[13.5px]">
          <div className="flex justify-between gap-3"><span>{k}{extra}</span><span className="tabular-nums text-muted">{fmt(v)}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/[0.06]"><div className="h-full rounded-full bg-accent" style={{ width: `${(100 * v) / max}%` }} /></div>
        </li>
      )) : <li className="text-[13.5px] text-muted">Sin datos en este periodo.</li>}
    </ul>
  );
}

export function Kpis() {
  const T = useTaller();
  const pers = T.periodos();
  const [per, setPer] = useState(pers[pers.length - 1][0]);
  const k = T.kpis(per);
  const h = (v) => (v == null ? '—' : `${T.n1(v)} h`);
  const cols = [
    { key: 'eco', label: 'Equipo', render: (f) => <b className="font-medium">{f.e.eco}</b> },
    { key: 'horas', label: 'Horas', align: 'right', render: (f) => T.n1(f.horas) },
    { key: 'total', label: 'Costo total', align: 'right', render: (f) => T.money0(f.total) },
    { key: 'porH', label: '$ / hora', align: 'right', render: (f) => T.money(f.porH) },
    { key: 'lph', label: 'L / hora', align: 'right', render: (f) => T.n1(f.lph) },
    { key: 'corr', label: 'Corr. / Prev.', align: 'right', render: (f) => `${f.nCorr} / ${f.nPrev}` },
    { key: 'mtbf', label: 'MTBF', align: 'right', render: (f) => h(f.mtbf) },
    { key: 'disp', label: 'Disp.', align: 'right', render: (f) => `${Math.round(f.disp)} %` },
    { key: 'v', label: 'Veredicto', render: (f) => { const v = T.veredicto(f, k); return <Badge tone={TONE[v[1]]}>{v[0]}</Badge>; } },
  ];
  return (
    <div className="grid gap-6">
      <label className="flex items-center gap-3 text-[13px] text-muted">Periodo
        <select value={per} onChange={(e) => setPer(e.target.value)} className="h-10 rounded-xl bg-ink/[0.05] px-3 text-[14px] text-fg [&>option]:bg-deep">{pers.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </label>
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="Costo total" value={T.money0(k.total)} hint={`Mant. ${T.money0(k.ref + k.mo)} · Diésel ${T.money0(k.comb)}`} />
        <Stat label="$ por hora" value={T.money0(k.porH)} hint={`Mantenimiento ${T.money0(k.mantH)} / h`} />
        <Stat label="$ por hectárea" value={k.ha ? T.money0(k.porHa) : '—'} hint={`${T.n1(k.ha)} ha trabajadas`} />
        <Stat label="Disponibilidad" value={`${Math.round(k.disp)} %`} tone={k.disp >= 95 ? 'ok' : k.disp >= 85 ? 'warn' : 'crit'} />
        <Stat label="MTBF / MTTR" value={h(k.mtbf)} hint={`Reparar: ${h(k.mttr)}`} />
        <Stat label="Preventivo al día" value={k.cumpl == null ? '—' : `${Math.round(k.cumpl)} %`} hint={`${k.nPrev} prev. · ${k.nCorr} corr. · ${k.vencSinOT} vencidos sin OT`} tone={k.cumpl == null ? undefined : k.cumpl >= 90 ? 'ok' : 'warn'} />
      </section>
      <div><h2 className="mb-3 font-display text-xl">Por equipo</h2><DataTable caption="Costos por equipo" rows={k.filas} rowKey={(f) => f.e.id} cols={cols} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="font-display text-xl">Costo de fallas por sistema</h2><Bars rows={k.porSis.map(([n, v]) => [n, v.costo])} fmt={T.money0} /></Card>
        <Card><h2 className="font-display text-xl">Costo de fallas por causa</h2><Bars rows={k.porCausa.map(([n, v]) => [n, v.costo, v.imp ? <Badge tone="crit" className="ml-2">Mal uso</Badge> : null])} fmt={T.money0} /></Card>
        <Card><h2 className="font-display text-xl">Costo por lote</h2><Bars rows={k.lotes.map(([n, v]) => [n, v.costo])} fmt={T.money0} /></Card>
        <Card><h2 className="font-display text-xl">Últimos meses</h2>
          <ul className="mt-3 grid gap-2 text-[13.5px]">{k.meses.map((m) => <li key={m.m} className="flex justify-between"><span>{m.nom}</span><span className="tabular-nums text-muted">Prev. {T.money0(m.prev)} · Corr. {T.money0(m.corr)}</span></li>)}</ul></Card>
      </div>
      <Card><h2 className="font-display text-xl">Paros por falla</h2>
        <ul className="mt-3 grid gap-2 text-[13.5px]">{k.paros.length ? k.paros.map((p) => <li key={p.o.id} className="flex justify-between gap-3"><span>{p.o.folio} · {T.eqp(p.o.eq)?.eco}</span><span className="tabular-nums text-muted">{h(p.h)} parado · {h(p.esp)} esperando refacción</span></li>) : <li className="text-muted">Sin paros en este periodo.</li>}</ul></Card>
    </div>
  );
}
