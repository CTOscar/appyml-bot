// Almacén: existencias con nivel, requisiciones (aprobar y recibir), entrada de mercancía y movimientos.
import { useState } from 'react';
import { Badge, Button, Card } from '../ui/index.jsx';
import { DataTable, Pills } from '../ui/page.jsx';
import { mutate, useTaller } from './useTaller.js';

const TONE = { ok: 'ok', warn: 'warn', bad: 'crit', info: 'info', plain: 'muted' };
const inp = 'h-10 w-full rounded-xl bg-ink/[0.05] px-3 text-[14px] outline-none shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))] focus:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.55)] [&>option]:bg-deep';

function Entrada({ T, onDone }) {
  const S = T.state();
  const [pid, setPid] = useState(S.productos[0]?.id);
  const [cant, setCant] = useState('');
  const [costo, setCosto] = useState('');
  const p = T.prod(+pid);
  const submit = (e) => {
    e.preventDefault();
    const c = T.num(cant), cu = costo === '' ? p.costo : T.num(costo);
    if (!(c > 0)) return;
    mutate((L) => { const a = L.entradaAlmacen(p.id, c, cu, 'Entrada manual'); L.hooks.toast('Entrada registrada' + (a.length ? ` · apartado: ${a.join(', ')}` : '')); });
    setCant(''); setCosto(''); onDone?.();
  };
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <label className="grid gap-1 text-[12px] uppercase tracking-[0.1em] text-muted">Producto<select className={inp} value={pid} onChange={(e) => setPid(e.target.value)}>{S.productos.map((x) => <option key={x.id} value={x.id}>{x.desc}</option>)}</select></label>
      <label className="grid gap-1 text-[12px] uppercase tracking-[0.1em] text-muted">Cantidad ({p?.u})<input className={inp} inputMode="decimal" value={cant} onChange={(e) => setCant(e.target.value)} required /></label>
      <label className="grid gap-1 text-[12px] uppercase tracking-[0.1em] text-muted">Costo unitario<input className={inp} inputMode="decimal" placeholder={String(p?.costo ?? '')} value={costo} onChange={(e) => setCosto(e.target.value)} /></label>
      <Button type="submit" variant="primary">Registrar entrada</Button>
    </form>
  );
}

export function Almacen() {
  const T = useTaller();
  const S = T.state();
  const [vista, setVista] = useState('existencias');
  const [cat, setCat] = useState('todas');
  T.syncReqs();
  const cats = ['todas', ...new Set(S.productos.map((p) => p.cat))];
  const prods = S.productos.filter((p) => cat === 'todas' || p.cat === cat);
  const pend = S.requisiciones.filter((r) => r.estatus === 'PENDIENTE');
  const surtir = T.pendientesSurtir();

  const existencias = [
    { key: 'desc', label: 'Producto', render: (p) => <span><b className="font-medium">{p.desc}</b><span className="block text-[12px] text-muted">{p.codigo} · {p.cat}</span></span> },
    { key: 'exist', label: 'Existencia', align: 'right', render: (p) => `${T.n1(p.exist)} ${p.u}` },
    { key: 'res', label: 'Apartado', align: 'right', render: (p) => T.n1(p.res) },
    { key: 'camino', label: 'En camino', align: 'right', render: (p) => T.n1(p.camino) },
    { key: 'min', label: 'Mín / Máx', align: 'right', render: (p) => `${T.n1(p.min)} / ${T.n1(p.max)}` },
    { key: 'costo', label: 'Costo', align: 'right', render: (p) => T.money(p.costo) },
    { key: 'nivel', label: 'Nivel', render: (p) => { const n = T.nivelProd(p); return <Badge tone={TONE[n[1]]}>{n[0]}</Badge>; } },
    { key: 'pedir', label: '', render: (p) => <Button size="sm" variant="ghost" onClick={() => mutate((L) => L.pedirManual(p.id))}>Pedir</Button> },
  ];
  const reqs = [
    { key: 'folio', label: 'Folio', render: (r) => <b className="font-medium">{r.folio}</b> },
    { key: 'p', label: 'Producto', render: (r) => { const p = T.prod(r.p); return `${T.n1(r.pedido)} ${p.u} · ${p.desc}${r.ot ? ` · ${r.ot}` : ''}`; } },
    { key: 'monto', label: 'Monto', align: 'right', render: (r) => T.money(r.pedido * T.prod(r.p).costo) },
    { key: 'estatus', label: 'Estado', render: (r) => <Badge tone={r.estatus === 'PENDIENTE' ? 'warn' : r.estatus === 'APROBADA' ? 'info' : 'ok'}>{r.estatus === 'PENDIENTE' ? `Por aprobar · ${T.quienAprueba(r.pedido * T.prod(r.p).costo)}` : r.estatus === 'APROBADA' ? 'En camino' : 'Recibida'}</Badge> },
    { key: 'acc', label: '', render: (r) => r.estatus === 'PENDIENTE' ? <Button size="sm" variant="primary" onClick={() => mutate((L) => L.aprobarReq(r.folio))}>Aprobar compra</Button>
      : r.estatus === 'APROBADA' ? <Button size="sm" onClick={() => mutate((L) => L.recibirReq(r.folio))}>Registrar llegada</Button> : null },
  ];
  const movs = [
    { key: 'fecha', label: 'Fecha', render: (m) => T.fFechaHora(m.fecha) },
    { key: 'tipo', label: 'Tipo', render: (m) => <Badge tone={TONE[T.MOV[m.tipo][1]]}>{T.MOV[m.tipo][0]}</Badge> },
    { key: 'p', label: 'Producto', render: (m) => T.prod(m.p)?.desc },
    { key: 'cant', label: 'Cantidad', align: 'right', render: (m) => T.n1(m.cant) },
    { key: 'costo', label: 'Costo', align: 'right', render: (m) => T.money(m.costo) },
    { key: 'ref', label: 'Referencia', render: (m) => m.ref || '—' },
  ];

  return (
    <div className="grid gap-6">
      <Card><h2 className="mb-3 font-display text-xl">Entrada de mercancía</h2><Entrada T={T} /></Card>
      {surtir.length ? <Card><h2 className="font-display text-xl">Por surtir a órdenes ({surtir.length})</h2>
        <ul className="mt-3 grid gap-2">{surtir.map(({ o, r, i }) => (
          <li key={`${o.id}-${i}`} className="flex items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-3 py-2 text-[13.5px]">
            <span>{o.folio} · {T.prod(r.p)?.desc} · {T.n1(r.sol - r.sur)} {T.prod(r.p)?.u}</span>
            <Button size="sm" onClick={() => mutate((L) => L.surtir(o, i))}>Surtir</Button>
          </li>))}</ul></Card> : null}
      <Pills label="Vista del almacén" value={vista} onChange={setVista} options={[['existencias', 'Existencias'], ['reqs', 'Requisiciones', pend.length || null], ['movs', 'Movimientos']]} />
      {vista === 'existencias' ? <>
        <Pills label="Categoría" value={cat} onChange={setCat} options={cats.map((c) => [c, c === 'todas' ? 'Todas' : c])} />
        <DataTable caption="Existencias" rows={prods} cols={existencias} />
      </> : vista === 'reqs' ? <DataTable caption="Requisiciones" rows={[...S.requisiciones].reverse()} rowKey={(r) => r.folio} cols={reqs} empty="Sin requisiciones." />
        : <DataTable caption="Movimientos" rows={[...S.movs].reverse().slice(0, 60)} rowKey={(m) => m.fecha + m.p + m.tipo + m.cant} cols={movs} empty="Sin movimientos." />}
    </div>
  );
}
