// Componentes base del sistema de diseño (botones, campos, tarjetas, insignias).
import { forwardRef, useId } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { iconFor } from './iconFor.js';
import { icoPara } from './menuIcons.js';

const BTN = {
  base: 'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-[background,box-shadow,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 select-none whitespace-nowrap',
  size: { sm: 'h-8 px-3 text-[13px] rounded-xl', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-[15px]' },
  variant: {
    // Principal: blanco con texto marino (como la referencia)
    primary: 'bg-fg text-onfg shadow-[0_0_24px_-4px_rgb(var(--accent-rgb)/0.45)] hover:bg-white hover:shadow-[0_0_32px_-2px_rgb(var(--accent-rgb)/0.6)]',
    // Cristal: blanco al 8 % con borde interior
    glass: 'bg-ink/[0.08] text-fg shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.13]',
    ghost: 'text-soft hover:bg-ink/[0.07] hover:text-fg',
    danger: 'bg-crit/15 text-crit shadow-[inset_0_0_0_1px_rgb(var(--crit-rgb)/0.3)] hover:bg-crit/25',
  },
};

export const Button = forwardRef(function Button({ variant = 'glass', size = 'md', loading = false, className, children, disabled, ...p }, ref) {
  return (
    <button ref={ref} className={clsx(BTN.base, BTN.size[size], BTN.variant[variant], className)} disabled={disabled || loading} {...p}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, badge, ...p }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={clsx('relative grid size-9 place-items-center rounded-xl text-soft transition hover:bg-ink/[0.08] hover:text-fg', className)} {...p}>
      {children}
      {badge ? <span className="absolute -right-0.5 -top-0.5 grid min-w-4 h-4 place-items-center rounded-full bg-crit px-1 text-[10px] font-semibold text-white">{badge}</span> : null}
    </button>
  );
}

export const Input = forwardRef(function Input({ className, icon: Icon, right, ...p }, ref) {
  return (
    <div className={clsx('group flex h-11 items-center gap-2.5 rounded-2xl bg-ink/[0.04] px-3.5 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))] transition focus-within:bg-ink/[0.06] focus-within:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.55),0_0_0_4px_rgb(var(--accent-rgb)/0.08)]', className)}>
      {Icon ? <Icon className="size-4 shrink-0 text-muted group-focus-within:text-accent" aria-hidden /> : null}
      <input ref={ref} className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-faint" {...p} />
      {right}
    </div>
  );
});

export function Field({ label, hint, error, children, aside }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-soft">{label}</label>
        {aside}
      </div>
      {typeof children === 'function' ? children(id) : children}
      {error ? <p className="text-[13px] text-crit" role="alert">{error}</p> : hint ? <p className="text-[12.5px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Card({ className, children, as: As = 'section', ...p }) {
  return <As className={clsx('glass p-5', className)} {...p}>{children}</As>;
}

const TONE = {
  ok: 'bg-ok/12 text-ok', warn: 'bg-warn/12 text-warn', crit: 'bg-crit/12 text-crit', info: 'bg-info/14 text-info', muted: 'bg-ink/[0.06] text-muted', accent: 'bg-accent/14 text-accent',
};
export function Badge({ tone = 'muted', dot = true, className, children }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', TONE[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

const CHIP = {
  ok: 'bg-ok/12 text-ok shadow-[inset_0_0_0_1px_rgb(var(--ok-rgb)/0.3)]',
  warn: 'bg-warn/12 text-warn shadow-[inset_0_0_0_1px_rgb(var(--warn-rgb)/0.35)]',
  crit: 'bg-crit/12 text-crit shadow-[inset_0_0_0_1px_rgb(var(--crit-rgb)/0.35)]',
  info: 'bg-info/12 text-info shadow-[inset_0_0_0_1px_rgb(var(--info-rgb)/0.3)]',
  accent: 'bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.3)]',
  muted: 'bg-ink/[0.06] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]',
};

// Ficha con ícono (línea fina, tono según el estado)
// Con `svg` (URL de un ícono a color de src/assets/menu) se pinta ese en una ficha blanca en vez del ícono de línea.
export function IconChip({ icon: Icon, svg, tone = 'accent', size = 'md', className }) {
  if (svg) {
    return (
      <span aria-hidden className={clsx('grid shrink-0 place-items-center bg-white shadow-[inset_0_0_0_1px_rgb(var(--ink-rgb)/0.12)]', size === 'sm' ? 'size-7 rounded-lg' : size === 'lg' ? 'size-11 rounded-2xl' : 'size-9 rounded-xl', className)}>
        <img src={svg} alt="" decoding="async" className={size === 'sm' ? 'size-5 object-contain' : size === 'lg' ? 'size-8 object-contain' : 'size-6 object-contain'} />
      </span>
    );
  }
  if (!Icon) return null;
  return (
    <span aria-hidden className={clsx('grid shrink-0 place-items-center', size === 'sm' ? 'size-7 rounded-lg' : size === 'lg' ? 'size-11 rounded-2xl' : 'size-9 rounded-xl', CHIP[tone] || CHIP.accent, className)}>
      <Icon className={size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-5' : 'size-[18px]'} strokeWidth={1.75} />
    </span>
  );
}

// Indicador: ícono (explícito o deducido de la etiqueta), valor grande y pista. En celular baja el tamaño del número.
export function Stat({ label, value, hint, tone, icon }) {
  const Icon = icon === null ? null : icon || iconFor(label);
  const svg = icon == null ? icoPara(label) : undefined; // ícono a color si la etiqueta lo tiene (Lotes, Tractores, Alertas…)
  return (
    <div className="glass stat-card grid gap-1.5 p-3.5 animate-rise sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted sm:text-[12px]">{label}</span>
        <IconChip icon={Icon} svg={svg} tone={tone || 'accent'} size="sm" />
      </div>
      <span className={clsx('display text-[2rem] sm:text-4xl', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn', tone === 'crit' && 'text-crit')}>{value}</span>
      {hint ? <span className="text-[12.5px] leading-snug text-muted sm:text-[13px]">{hint}</span> : null}
    </div>
  );
}

export function Divider({ children }) {
  return (
    <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.14em] text-faint">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-ink/10" />{children}<span className="h-px flex-1 bg-gradient-to-l from-transparent to-ink/10" />
    </div>
  );
}

// Esqueleto de carga. `lines` agrega renglones de texto; con `className` se le da el tamaño (p. ej. "h-24").
export function Skeleton({ lines = 0, className, label = 'Cargando…' }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="grid gap-2.5">
      {lines > 0
        ? Array.from({ length: lines }, (_, i) => <div key={i} className={clsx('skeleton h-3.5', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')} />)
        : <div className={clsx('skeleton h-16 w-full', className)} />}
    </div>
  );
}

export function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="grid min-h-[40vh] place-items-center" role="status">
      <div className="flex items-center gap-3 text-muted"><Loader2 className="size-5 animate-spin" aria-hidden />{label}</div>
    </div>
  );
}
