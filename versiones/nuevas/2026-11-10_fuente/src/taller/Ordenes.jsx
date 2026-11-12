// Órdenes de trabajo: lista a la izquierda; a la derecha el formulario de nueva OT y el detalle (pasos, refacciones, mano de obra, falla, historial).
import { useState } from 'react';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { Badge, Button, Card, Field } from '../ui/index.jsx';
import { Empty } from '../ui/page.jsx';
import { mutate, useTaller } from './useTaller.js';

const TONE = { ok: 'ok', warn: 'warn', bad: 'crit', info: 'info', plain: 'muted' };
export const Pill = ({ x }) => <Badge tone={TONE[x[1]] || 'muted'}>{x[0]}</Badge>;

const PASOS = [['Recepción', ['ABIERTA']], ['Diagnóstico', ['EN_DIAGNOSTICO']], ['Reparación', ['EN_PROCESO', 'ESPERANDO_REFACCION']], ['Terminada', ['TERMINADA']], ['Liberada', ['LIBERADA']]];
const ACCIONES = {
  ABIERTA: [['EN_DIAGNOSTICO', 'Iniciar diagnóstico', 'primary'], ['CANCELADA', 'Cancelar', 'danger']],
  EN_DIAGNOSTICO: [['EN_PROCESO', 'Iniciar reparación', 'primary'], ['CANCELADA', 'Cancelar', 'danger']],
  EN_PROCESO: [['TERMINADA', 'Terminar', 'primary'], ['ESPERANDO_REFACCION', 'Esperando refacción', 'glass']],
  ESPERANDO_REFACCION: [['EN_PROCESO', 'Reanudar reparación', 'primary']],
  TERMINADA: [['LIBERADA', 'Liberar equipo', 'primary']],
};

const sel = 'h-11 w-full rounded-2xl bg-ink/[0.04] px-3 text-[15px] text-fg outline-none shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))] focus:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.55)] [&>option]:bg-deep';
const lbl = 'text-[12px] font-medium uppercase tracking-[0.12em] text-muted';

function NuevaOT({ T, onClose }) {
  const S = T.state();
  const [eqId, setEq] = useState(S.ui.nuevaEq || S.equipos[0].id);
  const [tipo, setTipo] = useState('CORRECTIVA');
  const e = T.eqp(eqId) || S.equipos[0];
  const planes = S.planes.filter((p) => p.modelos.indexOf(e.modelo) >= 0);
  const reps = S.reportes.filter((r) => r.eq === e.id && r.estatus === 'ABIERTO');
  const [planId, setPlan] = useState('');
  const [prio, setPrio] = useState('MEDIA');
  const [rep, setRep] = useState('');
  const [falla, setFalla] = useState('');
  const [err, setErr] = useState('');
  const tipoOk = tipo === 'PREVENTIVA' && !planes.length ? 'CORRECTIVA' : tipo;
  const plan = +planId || planes[0]?.id || null;

  const submit = (ev) => {
    ev.preventDefault();
    if (tipoOk === 'PREVENTIVA' && S.ots.some((o) => o.eq === e.id && T.abierta(o) && o.plan === plan)) return setErr('Ese equipo ya tiene una preventiva abierta de ese plan.');
    if (tipoOk === 'CORRECTIVA' && !falla.trim() && !rep) return setErr('Describe la falla o elige un reporte.');
    const o = mutate((L) => L.abrirOT({ eq: e.id, tipo: tipoOk, planId: tipoOk === 'PREVENTIVA' ? plan : null, reporteId: +rep || null, falla: falla.trim(), prioridad: prio }));
    T.hooks.toast(`${o.folio} abierta`);
    onClose();
  };
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-xl">Nueva orden de trabajo</h3><Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button></div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Equipo">{(id) => <select id={id} className={sel} value={e.id} onChange={(x) => { setEq(+x.target.value); setRep(''); setPlan(''); }}>{S.equipos.map((x) => <option key={x.id} value={x.id}>{x.eco} · {S.modelos[x.modelo]}</option>)}</select>}</Field>
        <Field label="Tipo">{(id) => <select id={id} className={sel} value={tipoOk} onChange={(x) => setTipo(x.target.value)}><option value="CORRECTIVA">Correctiva</option>{planes.length ? <option value="PREVENTIVA">Preventiva</option> : null}</select>}</Field>
        {tipoOk === 'PREVENTIVA' ? <Field label="Plan">{(id) => <select id={id} className={sel} value={plan} onChange={(x) => setPlan(x.target.value)}>{planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>}</Field> : null}
        <Field label="Prioridad">{(id) => <select id={id} className={sel} value={prio} onChange={(x) => setPrio(x.target.value)}>{['MEDIA', 'ALTA', 'URGENTE', 'BAJA'].map((p) => <option key={p}>{p}</option>)}</select>}</Field>
        {reps.length ? <Field label="Reporte de falla">{(id) => <select id={id} className={sel} value={rep} onChange={(x) => setRep(x.target.value)}><option value="">Ninguno</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.folio} · {r.desc.slice(0, 40)}</option>)}</select>}</Field> : null}
        <div className="sm:col-span-2"><Field label="Falla reportada">{(id) => <input id={id} className={sel} value={falla} onChange={(x) => setFalla(x.target.value)} placeholder="Ruido en la transmisión al meter tercera" />}</Field></div>
        <div className="flex items-center gap-3 sm:col-span-2"><Button type="submit" variant="primary">Abrir orden</Button>{err ? <span role="alert" className="text-[13px] text-crit">{err}</span> : null}</div>
      </form>
    </Card>
  );
}

function Seccion({ titulo, nota, children }) {
  return (
    <div className="grid gap-3 border-t border-ink/[0.07] pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><span className={lbl}>{titulo}</span>{nota ? <span className="text-[12.5px] text-muted">{nota}</span> : null}</div>
      {children}
    </div>
  );
}

const th = 'px-2 py-1.5 text-left text-[12px] font-medium text-muted';
const td = 'px-2 py-2 text-[14px]';

function Detalle({ T, o }) {
  const S = T.state();
  const e = T.eqp(o.eq), c = T.costoOT(o), editable = T.abierta(o);
  const idx = PASOS.findIndex((p) => p[1].indexOf(o.estatus) >= 0);
  const [diag, setDiag] = useState('');
  const [prod, setProd] = useState(S.productos[0].id);
  const [cant, setCant] = useState('1');
  const [mec, setMec] = useState(T.mecanicos()[0]?.id);
  const [horas, setHoras] = useState('1');
  const [sis, setSis] = useState(T.SISTEMAS[0]);
  const [causa, setCausa] = useState(T.CAUSAS[0][0]);
  const act = (fn, msg) => mutate((L) => { const r = fn(L); if (msg && !o.error) L.hooks.toast(typeof msg === 'function' ? msg() : msg); return r; });

  return (
    <Card className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="font-mono text-[12.5px] text-muted">{o.folio} · {o.tipo === 'PREVENTIVA' ? 'Preventiva' : 'Correctiva'} · prioridad {o.prioridad.toLowerCase()}</span>
          <h3 className="font-display text-2xl"><span className="text-accent">{e.eco}</span> {S.modelos[e.modelo]}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {(ACCIONES[o.estatus] || []).map(([st, txt, v]) => (
            <Button key={st} variant={v} size="sm" onClick={() => act((L) => L.cambiarEstatus(o, st), () => `${o.folio}: ${T.ESTATUS_OT[st][0].toLowerCase()}`)}>{txt}</Button>
          ))}
        </div>
      </div>

      {o.estatus === 'CANCELADA' ? <Pill x={T.ESTATUS_OT.CANCELADA} /> : (
        <ol className="grid grid-cols-5 gap-1.5" aria-label="Avance">
          {PASOS.map((p, i) => {
            const done = i < idx || o.estatus === 'LIBERADA', now = i === idx && !done;
            return (
              <li key={p[0]} className="grid gap-1.5 text-center text-[12px]" aria-current={now ? 'step' : undefined}>
                <i className={clsx('h-1.5 rounded-full', done ? 'bg-ok' : now ? 'bg-accent' : 'bg-ink/10')} />
                <span className={clsx(done ? 'text-soft' : now ? 'text-fg' : 'text-faint')}>{p[0]}</span>
              </li>
            );
          })}
        </ol>
      )}
      {o.error ? <p role="alert" className="rounded-xl bg-crit/10 px-3 py-2 text-[14px] text-crit">{o.error}</p> : null}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[['Estatus', <Pill x={T.ESTATUS_OT[o.estatus]} />], ['Recepción', T.fFechaHora(o.recepcion)], ['Responsable', T.emp(o.resp).nombre], ['Operaba', o.opFalla ? T.emp(o.opFalla).nombre : '—'], ['Costo total', <b className="tabular-nums">{T.money(c.total)}</b>]].map(([k, v]) => (
          <div key={k} className="grid content-start gap-1"><dt className={lbl}>{k}</dt><dd className="text-[14px]">{v}</dd></div>
        ))}
      </dl>

      <Seccion titulo="Falla reportada">
        <p className="text-[14px]">{o.falla || '—'}</p>
        {o.diagnostico ? <><span className={lbl}>Diagnóstico</span><p className="text-[14px]">{o.diagnostico}</p></> : null}
        {editable && o.tipo === 'CORRECTIVA' ? (
          <div className="flex gap-2"><input aria-label="Diagnóstico" className={sel} value={diag} onChange={(x) => setDiag(x.target.value)} placeholder="Escribe el diagnóstico" />
            <Button size="sm" onClick={() => { if (diag.trim()) { act((L) => { o.diagnostico = diag.trim(); }); setDiag(''); } }}>Guardar</Button></div>
        ) : null}
      </Seccion>

      {o.tareas.length ? (
        <Seccion titulo="Tareas del plan">
          {o.tareas.map((t, i) => (
            <label key={i} className="flex items-center gap-2.5 text-[14px]"><input type="checkbox" className="size-4 accent-[var(--color-accent,#e6c97c)]" checked={!!t[1]} disabled={!editable} onChange={(x) => act(() => { o.tareas[i][1] = x.target.checked; })} />{t[0]}</label>
          ))}
        </Seccion>
      ) : null}

      <Seccion titulo="Refacciones" nota="Se apartan al pedirlas; nadie más puede usarlas">
        {o.refs.length ? (
          <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className={th}>Producto</th>{['Pedido', 'Apartado', 'Surtido', 'Importe'].map((h) => <th key={h} className={clsx(th, 'text-right')}>{h}</th>)}<th /></tr></thead>
            <tbody>{o.refs.map((r, i) => {
              const p = T.prod(r.p), falta = r.sol - r.sur - r.res;
              return (
                <tr key={i} className="border-t border-ink/[0.05]"><td className={td}>{p.desc}</td>
                  <td className={clsx(td, 'text-right tabular-nums')}>{T.n1(r.sol)} {p.u}</td><td className={clsx(td, 'text-right tabular-nums')}>{T.n1(r.res)}</td><td className={clsx(td, 'text-right tabular-nums')}>{T.n1(r.sur)}</td>
                  <td className={clsx(td, 'text-right tabular-nums')}>{T.money(r.sur * r.costo)}</td>
                  <td className={clsx(td, 'text-right')}>{r.sur >= r.sol ? <Badge tone="ok">Surtido</Badge> : falta > 0 && r.res === 0 && p.exist - p.res < r.sol - r.sur ? <Badge tone="warn">Sin existencia</Badge> : editable ? <Button size="sm" onClick={() => act((L) => L.surtir(o, i), 'Salida de almacén registrada')}>Surtir</Button> : null}</td></tr>
              );
            })}</tbody></table></div>
        ) : <p className="text-[14px] text-muted">Sin refacciones.</p>}
        {editable ? (
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_auto]">
            <Field label="Producto">{(id) => <select id={id} className={sel} value={prod} onChange={(x) => setProd(+x.target.value)}>{S.productos.map((p) => <option key={p.id} value={p.id}>{p.desc} · disp. {T.n1(p.exist - p.res)} {p.u}</option>)}</select>}</Field>
            <Field label="Cantidad">{(id) => <input id={id} className={sel} type="number" min="0.5" step="0.5" value={cant} onChange={(x) => setCant(x.target.value)} />}</Field>
            <Button size="sm" className="h-11" onClick={() => act((L) => { const c2 = parseFloat(cant); if (!(c2 > 0)) { o.error = 'Captura una cantidad mayor a cero.'; return; } L.reservar(o, prod, c2); o.error = ''; })}>Pedir refacción</Button>
          </div>
        ) : null}
      </Seccion>

      <Seccion titulo="Mano de obra">
        {o.mano.length ? (
          <table className="w-full"><tbody>{o.mano.map((m, i) => (
            <tr key={i} className="border-t border-ink/[0.05] first:border-0"><td className={td}>{T.emp(m.emp).nombre}</td><td className={clsx(td, 'text-right tabular-nums')}>{T.n1(m.horas)} h × {T.money0(m.costo)}</td><td className={clsx(td, 'text-right tabular-nums')}>{T.money(m.horas * m.costo)}</td></tr>
          ))}</tbody></table>
        ) : null}
        {editable ? (
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_auto]">
            <Field label="Mecánico">{(id) => <select id={id} className={sel} value={mec} onChange={(x) => setMec(+x.target.value)}>{T.mecanicos().map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>}</Field>
            <Field label="Horas">{(id) => <input id={id} className={sel} type="number" min="0.25" step="0.25" value={horas} onChange={(x) => setHoras(x.target.value)} />}</Field>
            <Button size="sm" className="h-11" onClick={() => act((L) => { const h = parseFloat(horas); if (!(h > 0)) { o.error = 'Captura las horas trabajadas.'; return; } const m = L.emp(mec); o.mano.push({ emp: m.id, horas: h, costo: m.costo }); o.error = ''; })}>Registrar horas</Button>
          </div>
        ) : null}
      </Seccion>

      {o.tipo === 'CORRECTIVA' ? (
        <Seccion titulo="Clasificación de la falla">
          {o.fallas.length ? o.fallas.map((f, i) => { const cz = T.causa(f.causa); return <div key={i} className="flex flex-wrap gap-2"><Badge tone="info">{f.sis}</Badge><Badge tone={cz[2] ? 'crit' : 'muted'}>{cz[1]}</Badge></div>; })
            : <p className="text-[13.5px] text-muted">Obligatoria para terminar la orden: con esto se calculan las fallas por sistema, por causa y por operador.</p>}
          {editable ? (
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="Sistema">{(id) => <select id={id} className={sel} value={sis} onChange={(x) => setSis(x.target.value)}>{T.SISTEMAS.map((s) => <option key={s}>{s}</option>)}</select>}</Field>
              <Field label="Causa">{(id) => <select id={id} className={sel} value={causa} onChange={(x) => setCausa(x.target.value)}>{T.CAUSAS.map((cz) => <option key={cz[0]} value={cz[0]}>{cz[1]}</option>)}</select>}</Field>
              <Button size="sm" className="h-11" onClick={() => act(() => { o.fallas.push({ sis, causa }); o.error = ''; })}>Agregar</Button>
            </div>
          ) : null}
        </Seccion>
      ) : null}

      <Seccion titulo="Historial">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {o.hist.map((h, i) => <span key={i} className="flex items-center gap-2">{i ? <span className="text-faint">→</span> : null}<Pill x={T.ESTATUS_OT[h[0]]} /><span className="tabular-nums text-muted">{T.fFechaHora(h[1])}</span></span>)}
        </div>
      </Seccion>
    </Card>
  );
}

export function Ordenes({ sel: selId, onSel }) {
  const T = useTaller();
  const S = T.state();
  const [filtro, setFiltro] = useState('todas');
  const [nueva, setNueva] = useState(false);
  const lista = S.ots.filter((o) => filtro === 'todas' || T.abierta(o)).slice().reverse();
  const o = T.otById(+selId) || lista[0];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl">Órdenes de trabajo</h2>
          <Button size="sm" variant="primary" onClick={() => setNueva(true)}><Plus className="size-4" aria-hidden />Nueva OT</Button>
        </div>
        <select aria-label="Mostrar" className={sel} value={filtro} onChange={(x) => setFiltro(x.target.value)}><option value="todas">Todas</option><option value="abiertas">Solo abiertas</option></select>
        <div className="grid gap-2">
          {lista.length ? lista.map((x) => (
            <button key={x.id} type="button" aria-current={!!o && x.id === o.id} onClick={() => { onSel(x.id); setNueva(false); }}
              className="grid gap-1 rounded-2xl bg-ink/[0.04] p-3 text-left shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))] transition hover:bg-ink/[0.08] aria-[current=true]:bg-ink/[0.1] aria-[current=true]:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.5)]">
              <span className="flex items-center justify-between gap-2"><span className="font-mono text-[12.5px] text-muted">{x.folio}</span><Pill x={T.ESTATUS_OT[x.estatus]} /></span>
              <span><b className="text-accent">{T.eqp(x.eq).eco}</b> <span className="text-[13px] text-muted">· {x.tipo === 'PREVENTIVA' ? 'Preventiva' : 'Correctiva'}</span></span>
              <span className="text-[13px] text-muted">{T.fFechaHora(x.recepcion)} · {T.money0(T.costoOT(x).total)}</span>
            </button>
          )) : <Empty title="Sin órdenes" text="No hay órdenes abiertas." />}
        </div>
      </Card>
      <div className="grid gap-5">
        {nueva ? <NuevaOT T={T} onClose={() => setNueva(false)} /> : null}
        {o ? <Detalle key={o.id} T={T} o={o} /> : <Card><Empty title="Selecciona una orden" /></Card>}
      </div>
    </div>
  );
}
