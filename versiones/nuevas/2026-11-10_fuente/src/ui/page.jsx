// Piezas compartidas de las páginas: encabezado, sección con ícono, pestañas tipo píldora, tabla y estado vacío.
import clsx from 'clsx';
import { Inbox } from 'lucide-react';
import { IconChip } from './index.jsx';
import { iconFor } from './iconFor.js';
import { icoPara } from './menuIcons.js';

// Encabezado de página al estilo de las páginas de producto: título ligero de una o dos líneas con la última palabra atenuada,
// subtítulo a la derecha en pantallas anchas y las acciones debajo. El ícono sale del título (o se pasa en `icon`; `icon={null}` lo quita).
export function PageHeader({ title, subtitle, children, eyebrow, icon }) {
  const words = String(title).trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : null;
  const Icon = icon === null ? null : icon || iconFor(title, null);
  // Si la página tiene ícono a color (src/assets/menu), se usa ese en vez del de línea.
  const svg = icon == null ? icoPara(title) : undefined;
  return (
    <header className="grid gap-4 pb-6 pt-0 md:gap-6 md:pb-10 md:pt-4">
      <div className="grid items-end gap-4 md:gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="mb-3 flex items-center gap-2.5 text-[12px] uppercase tracking-[0.16em] text-accent">
            {svg || Icon ? <IconChip icon={Icon} svg={svg} size="sm" /> : <span className="h-px w-6 bg-accent" />}
            {eyebrow ? <span className="min-w-0 truncate">{eyebrow}</span> : <span className="h-px w-10 bg-gradient-to-r from-accent/70 to-transparent" />}
          </p>
          <h1 className="display glow text-[clamp(2rem,5.5vw,4.6rem)] leading-[1.08] tracking-[-0.03em] animate-rise">{words.join(' ')}{last ? <> <span className="text-fg/60">{last}</span></> : null}</h1>
        </div>
        {subtitle ? <p className="max-w-[520px] text-[clamp(0.95rem,1.3vw,1.2rem)] leading-relaxed text-muted animate-rise [animation-delay:80ms] md:justify-self-end">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      <div className="h-px bg-gradient-to-r from-accent/40 via-ink/10 to-transparent" />
    </header>
  );
}

// Sección en tarjeta de línea fina: ficha con ícono, título, subtítulo, acción a la derecha y un filete bajo el encabezado.
// `as` permite usar `aside`/`div`; `flush` quita el relleno del cuerpo (tablas o listas a todo el ancho).
export function Section({ icon, svg: svgProp, chip, title, subtitle, action, tone = 'accent', children, className, bodyClassName, flush = false, as: As = 'section', id }) {
  const Icon = icon === null ? null : icon || iconFor(title, null);
  const svg = svgProp || (icon == null && typeof title === 'string' ? icoPara(title) : undefined);
  const hid = id ? `${id}-t` : undefined;
  return (
    <As id={id} aria-labelledby={hid} className={clsx('glass overflow-hidden', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink/[0.07] px-4 py-3.5 sm:px-5">
        {chip || <IconChip icon={Icon} svg={svg} tone={tone} />}
        <div className="min-w-0 flex-1">
          <h2 id={hid} className="font-display text-[1.35rem] font-light leading-tight sm:text-2xl">{title}</h2>
          {subtitle ? <p className="text-[13px] leading-snug text-muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <div className={clsx(!flush && 'p-4 sm:p-5', bodyClassName)}>{children}</div>
    </As>
  );
}

// Título de sección suelto (sin tarjeta): ficha con ícono + h2 + filete a la derecha. `aside` va al extremo.
export function SectionTitle({ icon, id, children, aside, tone = 'accent' }) {
  const Icon = icon === null ? null : icon || iconFor(typeof children === 'string' ? children : '', null);
  const svg = icon == null && typeof children === 'string' ? icoPara(children) : undefined;
  return (
    <div className="flex items-center gap-3">
      <IconChip icon={Icon} svg={svg} tone={tone} />
      <h2 id={id} className="font-display text-[1.35rem] font-light leading-tight sm:text-2xl">{children}</h2>
      <span aria-hidden className="hidden h-px min-w-6 flex-1 bg-gradient-to-r from-ink/15 to-transparent sm:block" />
      {aside ? <span className="ml-auto text-[13px] text-muted sm:ml-0">{aside}</span> : null}
    </div>
  );
}

// options = [[valor, etiqueta, cuenta?, Icono?]]
export function Pills({ options, value, onChange, label, className }) {
  return (
    <div role="tablist" aria-label={label} className={clsx('flex flex-wrap gap-1.5 max-sm:-mx-3 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-3 max-sm:pb-1 max-sm:[scrollbar-width:none]', className)}>
      {options.map(([v, l, n, Icon]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={clsx('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] transition sm:px-4',
            value === v ? 'bg-fg text-onfg shadow-[0_0_20px_-6px_rgb(var(--accent-rgb)/0.6)]' : 'bg-ink/[0.05] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))] hover:bg-ink/[0.09] hover:text-fg')}>
          {Icon ? <Icon className="size-3.5 opacity-80" strokeWidth={1.75} aria-hidden /> : null}
          {l}{n != null ? <span className={clsx('tabular-nums', value === v ? 'text-onfg/60' : 'text-faint')}>{n}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-full bg-ink/[0.05] p-1 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))] [scrollbar-width:none]">
      {options.map(([v, l, Icon]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className={clsx('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition', value === v ? 'bg-ink/[0.14] text-fg shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))]' : 'text-muted hover:text-fg')}>
          {Icon ? <Icon className="size-3.5" strokeWidth={1.75} aria-hidden /> : null}{l}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, text, icon: Icon = Inbox }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-ink/10 px-6 py-10 text-center sm:py-12">
      <IconChip icon={Icon} tone="muted" size="lg" />
      <p className="mt-1 font-display text-lg">{title}</p>
      {text ? <p className="max-w-md text-[14px] text-muted">{text}</p> : null}
    </div>
  );
}

// cols = [{ key, label, align, render(row) }]
// En celular (<640 px) cada fila se vuelve una tarjeta con «etiqueta · valor» (clase .dt-stack en styles.css), sin scroll horizontal.
export function DataTable({ cols, rows, onRow, rowKey = (r) => r.id, empty = 'Sin datos.', caption }) {
  return (
    <div className="glass overflow-x-auto p-0">
      <table className="dt-stack w-full text-[14px] sm:min-w-[640px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-ink/[0.07] text-left">
            {cols.map((c) => <th key={c.key} scope="col" className={clsx('px-4 py-3 text-[11.5px] font-medium uppercase tracking-[0.1em] text-muted', c.align === 'right' && 'text-right')}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} tabIndex={onRow ? 0 : undefined}
              onKeyDown={onRow ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRow(r); } } : undefined}
              className={clsx('border-b border-ink/[0.04] last:border-0', onRow && 'cursor-pointer transition hover:bg-ink/[0.04] focus-visible:bg-ink/[0.06]')}>
              {cols.map((c) => <td key={c.key} data-label={c.label} className={clsx('px-4 py-3', c.align === 'right' && 'text-right tabular-nums')}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          )) : <tr><td colSpan={cols.length} className="px-4 py-10 text-center text-muted">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function StatusDot({ tone }) {
  return <span aria-hidden className={clsx('inline-block size-2 rounded-full', tone === 'ok' && 'bg-ok shadow-[0_0_8px_#6fd48f]', tone === 'crit' && 'bg-crit shadow-[0_0_8px_#ff6f61]', tone === 'warn' && 'bg-warn', tone === 'info' && 'bg-info', (!tone || tone === 'muted') && 'bg-muted')} />;
}
