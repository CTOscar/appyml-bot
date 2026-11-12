// Tabla al estilo de un cliente de MySQL: consulta arriba, cuadrícula con nombres de columna de la base, pie «N filas en el conjunto»,
// orden por columna, filtro, actualización (manual o cada 30 s) y exportación a CSV. Marca los registros nuevos.
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, Download, RefreshCw, Search } from 'lucide-react';
import { aCSV, filtrar, ordenar, pieResultado, valorDe } from '../lib/dbtable.js';
import { descargar } from '../lib/geoFormats.js';

export const celdaMono = 'px-3 py-1.5 font-mono text-[12.5px] align-top border-b border-r border-ink/[0.07] last:border-r-0';

export function TablaDB({ nombre, consulta, cols, rows, segundos, cargando, error, onRefresh, esNueva, onRow, seleccionada, rowKey = (r) => r.id, extra, vacio }) {
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState({ key: cols[0]?.key, dir: 'desc' }); // como «ORDER BY id DESC»: lo último arriba
  const col = cols.find((c) => c.key === orden.key);
  const vis = useMemo(() => ordenar(filtrar(rows || [], cols, q), col, orden.dir), [rows, cols, q, col, orden.dir]);
  const alternar = (c) => setOrden((o) => (o.key === c.key ? { key: c.key, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' }));
  const nuevos = esNueva ? (rows || []).filter(esNueva).length : 0;
  const exportar = () => descargar(`${nombre}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv', aCSV(cols, vis));

  return (
    <section className="grid gap-2" aria-label={`Tabla ${nombre}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-ink/[0.05] px-3 py-2 font-mono text-[12.5px] text-soft" title={consulta}><span className="text-accent">mysql&gt;</span> {consulta}</code>
        <label className="flex h-9 items-center gap-2 rounded-xl bg-ink/[0.05] px-3 text-[13px] shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))] focus-within:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.5)]">
          <Search className="size-3.5 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar filas…" aria-label={`Filtrar ${nombre}`} className="w-36 bg-transparent outline-none placeholder:text-faint sm:w-44" />
        </label>
        <button type="button" onClick={onRefresh} disabled={cargando} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.06] disabled:opacity-50"><RefreshCw className={clsx('size-3.5', cargando && 'animate-spin')} aria-hidden />Actualizar</button>
        <button type="button" onClick={exportar} disabled={!vis.length} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.06] disabled:opacity-40"><Download className="size-3.5" aria-hidden />CSV</button>
      </div>
      {extra}
      {error ? <p role="alert" className="rounded-xl bg-crit/10 px-3 py-2 text-[13px] text-crit">{error} <button type="button" onClick={onRefresh} className="underline">Reintentar</button></p> : null}

      <div className="max-h-[30rem] overflow-auto rounded-2xl bg-panel/60 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))]">
        <table className="w-full min-w-max border-collapse">
          <caption className="sr-only">{nombre}</caption>
          <thead className="sticky top-0 z-10 bg-deep/95 backdrop-blur">
            <tr>
              {cols.map((c) => {
                const activa = orden.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={activa ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="border-b border-r border-ink/[0.14] p-0 text-left last:border-r-0">
                    <button type="button" onClick={() => alternar(c)} className="flex w-full items-center justify-between gap-2 px-3 py-2 font-mono text-[12px] font-semibold tracking-tight text-fg hover:bg-ink/[0.06]" title={`Ordenar por ${c.key}`}>
                      {c.key}{activa ? (orden.dir === 'asc' ? <ArrowUp className="size-3 text-accent" aria-hidden /> : <ArrowDown className="size-3 text-accent" aria-hidden />) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {vis.map((r) => {
              const nueva = esNueva?.(r), sel = seleccionada && rowKey(r) === seleccionada;
              return (
                <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} tabIndex={onRow ? 0 : undefined}
                  onKeyDown={onRow ? (e) => { if (e.key === 'Enter') onRow(r); } : undefined}
                  aria-selected={sel || undefined}
                  className={clsx(onRow && 'cursor-pointer', sel ? 'bg-accent/[0.12]' : nueva ? 'bg-ok/[0.08]' : 'odd:bg-ink/[0.02]', onRow && 'hover:bg-ink/[0.06] focus-visible:bg-ink/[0.08] focus-visible:outline-none')}>
                  {cols.map((c, i) => (
                    <td key={c.key} className={clsx(celdaMono, c.align === 'right' && 'text-right tabular-nums', c.nowrap !== false && 'whitespace-nowrap')}>
                      {i === 0 && nueva ? <span className="mr-2 rounded bg-ok/20 px-1 py-px text-[10px] font-bold uppercase text-ok">nuevo</span> : null}
                      {c.render ? c.render(r) : <Valor v={valorDe(c, r)} />}
                    </td>
                  ))}
                </tr>
              );
            })}
            {!vis.length ? <tr><td colSpan={cols.length} className="px-3 py-6 text-center font-mono text-[12.5px] text-muted">{cargando && !rows ? 'Consultando…' : q ? `Sin coincidencias para «${q}».` : vacio || 'Empty set'}</td></tr> : null}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap items-center justify-between gap-2 font-mono text-[12px] text-muted" aria-live="polite">
        <span>{pieResultado(vis.length, segundos)}{q && rows ? ` · de ${rows.length}` : ''}</span>
        {nuevos ? <span className="text-ok">{nuevos} {nuevos === 1 ? 'registro nuevo' : 'registros nuevos'} desde tu última visita</span> : null}
      </p>
    </section>
  );
}

function Valor({ v }) {
  if (v === null || v === undefined || v === '') return <span className="text-faint">NULL</span>;
  if (typeof v === 'object') return <span>{JSON.stringify(v)}</span>;
  return <span>{String(v)}</span>;
}

/** Un registro en vertical, como el resultado de «\G» del cliente de MySQL. */
export function RegistroG({ fila, cols, numero = 1, onClose }) {
  const ancho = Math.max(...cols.map((c) => c.key.length));
  const lineas = cols.map((c) => {
    const v = c.texto ? c.texto(fila) : valorDe(c, fila);
    const t = v === null || v === undefined || v === '' ? 'NULL' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `${c.key.padStart(ancho)}: ${t}`;
  });
  return (
    <section className="grid gap-2 rounded-2xl bg-panel/60 p-3 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))]" aria-label="Registro seleccionado">
      <div className="flex items-center justify-between gap-3">
        <code className="truncate font-mono text-[12.5px] text-soft"><span className="text-accent">mysql&gt;</span> ... \G</code>
        <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-[12.5px] text-muted hover:bg-ink/[0.07] hover:text-fg">Cerrar</button>
      </div>
      <pre className="overflow-x-auto font-mono text-[12.5px] leading-relaxed text-fg">{`${'*'.repeat(27)} ${numero}. row ${'*'.repeat(27)}\n${lineas.join('\n')}`}</pre>
    </section>
  );
}
