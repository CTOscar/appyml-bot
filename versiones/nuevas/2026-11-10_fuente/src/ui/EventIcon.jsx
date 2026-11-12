// Ícono llamativo por tipo de evento (en vez de un punto): combustible, energía, alarma, velocidad, encendido, apagado, lote.
// Las alertas altas van en rojo con brillo; el resto en el color de su tipo.
import clsx from 'clsx';
import { Fuel, Gauge, MapPin, Plug, Power, PowerOff, ShieldAlert, Siren } from 'lucide-react';
import { evInfo } from '../lib/events.js';

const LOOK = {
  combustible: [Fuel, 'crit'],
  energia: [Plug, 'crit'],
  alarma: [ShieldAlert, 'crit'],
  velocidad: [Gauge, 'crit'],
  encendido: [Power, 'ok'],
  apagado: [PowerOff, 'muted'],
  geocerca: [MapPin, 'info'],
  otros: [Siren, 'warn'],
};
const TONE = {
  crit: 'bg-crit/15 text-crit shadow-[inset_0_0_0_1px_rgb(var(--crit-rgb)/0.35),0_0_18px_-4px_rgb(var(--crit-rgb)/0.7)]',
  warn: 'bg-warn/15 text-warn shadow-[inset_0_0_0_1px_rgb(var(--warn-rgb)/0.35)]',
  ok: 'bg-ok/12 text-ok shadow-[inset_0_0_0_1px_rgb(var(--ok-rgb)/0.3)]',
  info: 'bg-info/12 text-info shadow-[inset_0_0_0_1px_rgb(var(--info-rgb)/0.3)]',
  muted: 'bg-ink/[0.06] text-muted shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]',
};

export function EventIcon({ e, size = 'md', className }) {
  const i = evInfo(e);
  const kind = e.type === 'deviceOverspeed' ? 'velocidad' : i.k;
  const [Icon, tone] = LOOK[kind] || LOOK.otros;
  return (
    <span aria-hidden className={clsx('relative grid shrink-0 place-items-center rounded-xl', size === 'sm' ? 'size-8' : 'size-10', TONE[i.high ? 'crit' : tone], className)}>
      <Icon className={size === 'sm' ? 'size-4' : 'size-5'} strokeWidth={2.2} />
      {i.high ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-crit ring-2 ring-[#0b150f] motion-safe:animate-pulse" /> : null}
    </span>
  );
}
