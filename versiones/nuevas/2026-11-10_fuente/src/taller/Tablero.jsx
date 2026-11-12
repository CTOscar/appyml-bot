// Tablero del taller: indicadores, estado de los equipos con su semáforo de servicio, reportes abiertos, refacciones por pedir y costo por hora.
import { Badge, Button, Card, Stat } from '../ui/index.jsx';
import { DataTable } from '../ui/page.jsx';
import { mutate, useTaller } from './useTaller.js';
import { vincularPorModelo } from './vincular.js';

const TONE = { ok: 'ok', warn: 'warn', bad: 'crit', info: 'info', plain: 'muted' };
const tone = (x) => TONE[x?.[1]] || 'muted';

export function Tablero({ onOrden }) {
  const T = useTaller();
  const S = T.state();
  const activos = S.equipos;
  const cuenta = (l) => activos.filter((e) => l.includes(e.estatus)).length;
  const operando = cuenta(['OPERANDO']), taller = cuenta(['EN_TALLER', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'LISTO_LIBERAR']), descomp = cuenta(['DESCOMPUESTO']);
  const sems = activos.filter((e) => e.usaH).map((e) => T.peorSemaforo(e.id)).filter(Boolean);
  const venc = sems.filter((s) => s.sem === 'VENCIDO').length, prox = sems.filter((s) => s.sem === 'PROXIMO').length;
  const otsAb = S.ots.filter(T.abierta);
  const repAb = S.reportes.filter((r) => r.estatus === 'ABIERTO');
  const bajos = S.productos.filter((p) => p.exist - p.res + p.camino <= p.min);
  const st = T.stats();
  const maxPH = Math.max(1, ...st.costoEq.map((c) => c.porHora));
  const fallas = Object.entries(st.fallas).sort((a, b) => b[1].n - a[1].n);
  const devs = T.dispositivos();
  const sinVincular = activos.some((e) => e.usaH && e.deviceId == null);

  const cols = [
    { key: 'eco', label: 'Equipo', render: (e) => { const d = e.deviceId != null ? devs.find((x) => x.id === e.deviceId) : null; return <span><b className="font-medium">{e.eco}</b>{d?.name ? <span className="block text-[12px] text-muted">{d.name}</span> : null}</span>; } },
    { key: 'estatus', label: 'Estado', render: (e) => <Badge tone={tone(T.ESTATUS_EQ[e.estatus])}>{(T.ESTATUS_EQ[e.estatus] || [e.estatus])[0]}</Badge> },
    { key: 'horas', label: 'Horas', align: 'right', render: (e) => e.usaH ? T.n1(e.horas) : '—' },
    { key: 'sem', label: 'Servicio', render: (e) => { const s = e.usaH ? T.peorSemaforo(e.id) : null; return s ? <span><Badge tone={tone(T.SEM[s.sem])}>{T.SEM[s.sem][0]}</Badge> <span className="text-[12.5px] text-muted">{s.plan.nombre} · {s.restH <= 0 ? `pasado ${T.n1(-s.restH)} h` : `en ${T.n1(s.restH)} h`}</span></span> : <span className="text-muted">—</span>; } },
    { key: 'gps', label: 'Rastreador', render: (e) => !e.usaH ? <span className="text-muted">—</span> : !devs.length ? <span className="text-[12.5px] text-muted">{e.deviceId != null ? `Vinculado #${e.deviceId}` : 'Sin GPS'}</span> : (
      <select aria-label={`Rastreador del ${e.eco}`} value={e.deviceId ?? ''} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => mutate((L) => { const q = L.eqp(e.id); q.deviceId = ev.target.value === '' ? null : Number(ev.target.value); q.vincManual = ev.target.value === ''; L.syncGps(); })}
        className="h-9 rounded-xl bg-ink/[0.05] px-2 text-[13px] [&>option]:bg-deep"><option value="">Sin vincular</option>{devs.map((d) => <option key={d.id} value={d.id}>{d.name || `#${d.id}`}</option>)}</select>) },
  ];

  return (
    <div className="grid gap-6">
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="Operando" value={operando} hint={`de ${activos.length} equipos`} tone="ok" />
        <Stat label="En taller" value={taller} />
        <Stat label="Descompuestos" value={descomp} tone={descomp ? 'crit' : undefined} />
        <Stat label="Servicios vencidos" value={venc} hint={`${prox} próximos`} tone={venc ? 'crit' : prox ? 'warn' : 'ok'} />
        <Stat label="Órdenes abiertas" value={otsAb.length} hint={`${repAb.length} reportes por atender`} />
        <Stat label="Por pedir" value={bajos.length} hint="refacciones bajo mínimo" tone={bajos.length ? 'warn' : 'ok'} />
      </section>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">Equipos</h2>
          {sinVincular && devs.length ? <Button size="sm" onClick={() => mutate((L) => { const n = vincularPorModelo(L, devs, { forzar: true }); L.syncGps(); L.hooks.toast?.(n ? `Vinculados ${n} equipo(s) por marca y modelo.` : 'Ningún equipo coincide con un tractor de la flota.'); })}>Vincular por marca y modelo</Button> : null}
        </div>
        <DataTable caption="Equipos del taller" rows={activos} cols={cols} empty="Sin equipos." />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl">Reportes abiertos</h2>
          <ul className="mt-3 grid gap-2">
            {repAb.length ? repAb.map((r) => (
              <li key={r.id ?? r.folio} className="flex items-start justify-between gap-3 rounded-xl bg-ink/[0.04] px-3 py-2 text-[13.5px]">
                <span><b className="font-medium">{T.eqp(r.eq)?.eco}</b> · {r.desc || r.texto || r.falla || 'Sin descripción'}</span>
                <button type="button" onClick={() => onOrden?.()} className="shrink-0 text-accent">Abrir OT</button>
              </li>
            )) : <li className="text-[13.5px] text-muted">Sin reportes por atender.</li>}
          </ul>
        </Card>
        <Card>
          <h2 className="font-display text-xl">Refacciones por pedir</h2>
          <ul className="mt-3 grid gap-2">
            {bajos.length ? bajos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-3 py-2 text-[13.5px]">
                <span>{p.desc}</span><span className="tabular-nums text-muted">{T.n1(Math.max(p.exist - p.res, 0))} / mín. {T.n1(p.min)}</span>
              </li>
            )) : <li className="text-[13.5px] text-muted">Todo en rango.</li>}
          </ul>
        </Card>
        <Card>
          <h2 className="font-display text-xl">Costo por hora</h2>
          <ul className="mt-3 grid gap-3">
            {st.costoEq.map((c) => (
              <li key={c.e.id} className="text-[13.5px]">
                <div className="flex justify-between"><b className="font-medium">{c.e.eco}</b><span className="tabular-nums text-muted">{T.money(c.porHora)} / h · {T.n1(c.lph)} L/h</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/[0.06]"><div className="h-full rounded-full bg-accent" style={{ width: `${(100 * c.porHora) / maxPH}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-display text-xl">Fallas por causa</h2>
          <p className="text-[13px] text-muted">Preventivo {st.prev} · correctivo {st.corr}</p>
          <ul className="mt-3 grid gap-2">
            {fallas.length ? fallas.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3 text-[13.5px]"><span>{k}{v.imp ? <Badge tone="crit" className="ml-2">Mal uso</Badge> : null}</span><span className="tabular-nums text-muted">{v.n} · {T.money0(v.costo)}</span></li>
            )) : <li className="text-[13.5px] text-muted">Sin fallas registradas.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
