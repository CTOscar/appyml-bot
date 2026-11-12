// Selector de apariencia. `compact`: solo los círculos de color (menú del perfil); completo: tarjetas con nombre (página Perfil).
import clsx from 'clsx';
import { Check, MonitorSmartphone } from 'lucide-react';
import { THEMES, useTheme } from './theme.js';

function Swatch({ colors, size = 'size-9' }) {
  const [bg, panel, accent, fg] = colors;
  return (
    <span aria-hidden className={clsx('relative block shrink-0 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgb(128_128_128/0.45)]', size)} style={{ background: bg }}>
      <span className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: panel }} />
      <span className="absolute left-[18%] top-[22%] size-[34%] rounded-full" style={{ background: accent }} />
      <span className="absolute bottom-[18%] right-[18%] h-[14%] w-[44%] rounded-full" style={{ background: fg }} />
    </span>
  );
}

export function ThemePicker({ compact = false }) {
  const { mode, active, setTheme } = useTheme();
  const options = [...THEMES, { id: 'auto', label: 'Automático', note: 'Sigue a tu dispositivo' }];
  return (
    <div role="radiogroup" aria-label="Apariencia" className={compact ? 'flex flex-wrap items-center gap-1.5' : 'grid gap-2 sm:grid-cols-2'}>
      {options.map((o) => {
        const on = mode === o.id;
        const swatch = o.swatch || THEMES.find((t) => t.id === active)?.swatch;
        return compact ? (
          <button key={o.id} type="button" role="radio" aria-checked={on} aria-label={o.label} title={o.label} onClick={() => setTheme(o.id)}
            className={clsx('relative grid size-8 place-items-center rounded-full transition', on ? 'ring-2 ring-accent ring-offset-2 ring-offset-panel' : 'hover:scale-110')}>
            {o.id === 'auto' ? <MonitorSmartphone className="size-4 text-soft" aria-hidden /> : <Swatch colors={swatch} size="size-7" />}
          </button>
        ) : (
          <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setTheme(o.id)}
            className={clsx('flex items-center gap-3 rounded-2xl p-3 text-left transition', on ? 'bg-ink/10 shadow-[inset_0_0_0_2px_var(--t-accent)]' : 'bg-ink/[0.04] shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))] hover:bg-ink/[0.08]')}>
            {o.id === 'auto' ? <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/10 text-soft"><MonitorSmartphone className="size-[18px]" aria-hidden /></span> : <Swatch colors={swatch} />}
            <span className="min-w-0 flex-1"><b className="block text-[14px] font-medium">{o.label}</b><small className="block text-[12.5px] text-muted">{o.note || (o.scheme === 'light' ? 'Fondo claro' : 'Fondo oscuro')}</small></span>
            {on ? <Check className="size-4 text-accent" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}
