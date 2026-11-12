// Secciones de Inicio con la estructura de una página de producto: título ligero de dos líneas con una palabra atenuada,
// rejilla tipo bento con líneas finas y pie de foto, preguntas cortas y cierre con llamada a la acción.
// Solo toma prestado el estilo; el contenido es del panel de flota.
import { useState } from 'react';
import clsx from 'clsx';
import { Bell, Fuel, Map, MapPinned, Plus, Wrench, FileText, Tractor } from 'lucide-react';
import { navigate } from '../app/router.js';

export function BigHead({ a, dim, b, sub }) {
  return (
    <div className="grid items-end gap-6 md:grid-cols-2">
      <h2 className="display text-[clamp(2.2rem,4vw,3.3rem)] leading-[1.12] tracking-[-0.02em]">{a}<br />{b} <span className="text-fg/60">{dim}</span>.</h2>
      {sub ? <p className="max-w-[520px] text-[clamp(1rem,1.3vw,1.2rem)] leading-relaxed text-fg/65 md:justify-self-end">{sub}</p> : null}
    </div>
  );
}

const CELLS = [
  { to: '/mapa', icon: Map, t: 'Mapa', c: 'Cada tractor en vivo, con rastro por velocidad, paradas y reproducción de la ruta.', span: 'md:col-span-2' },
  { to: '/alertas', icon: Bell, t: 'Alertas', c: 'Salidas de lote, exceso de velocidad y señal perdida, antes de que alguien llame.' },
  { to: '/tractores', icon: Tractor, t: 'Tractores', c: 'Ficha, horas de motor y combustible de cada equipo.' },
  { to: '/costeo', icon: Fuel, t: 'Costeo de diésel', c: 'Litros y costo por lote, por hora y por hectárea.', span: 'md:col-span-2' },
  { to: '/lotes', icon: MapPinned, t: 'Lotes', c: 'Geocercas, superficies y qué tractor trabaja en cada una.' },
  { to: '/taller', icon: Wrench, t: 'Taller', c: 'Órdenes de trabajo, refacciones y costos de mantenimiento.' },
  { to: '/reportes', icon: FileText, t: 'Reportes', c: 'Trabajo del día y de la semana, listo para compartir.' },
];

export function Bento() {
  return (
    <section aria-label="Módulos del panel" className="grid gap-10">
      <BigHead a="Todo lo de la flota." b="En un" dim="panel" sub="Del tractor en el surco a la orden de trabajo en el taller: la misma información, sin cambiar de herramienta." />
      <div className="grid overflow-hidden rounded-[1.75rem] border border-ink/10 md:grid-cols-3 [&>*]:border-b [&>*]:border-ink/10 md:[&>*]:border-r">
        {CELLS.map(({ to, icon: Icon, t, c, span }, i) => (
          <button key={to} type="button" onClick={() => navigate(to)} aria-label={`${t}: ${c}`}
            onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`); }}
            className={clsx('spot group relative grid min-h-56 content-between gap-8 p-7 text-left transition-colors hover:bg-ink/[0.03]', span)}>
            <span className="flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-2xl bg-ink/[0.06] text-accent shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))] transition duration-300 group-hover:-rotate-6 group-hover:scale-110"><Icon className="size-6" aria-hidden /></span>
              <span className="text-[12px] tabular-nums text-faint" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
            </span>
            <span className="relative block"><b className="font-display text-2xl font-medium">{t}. </b><span className="text-[15.5px] leading-relaxed text-fg/60">{c}</span>
              <span className="mt-4 flex items-center gap-1 text-[13px] text-accent opacity-0 transition duration-300 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>Abrir →</span></span>
          </button>
        ))}
      </div>
    </section>
  );
}

const FAQ = [
  ['¿De dónde salen las posiciones?', 'De los rastreadores Teltonika de cada tractor, a través de Traccar. El panel guarda el historial de combustible y velocidad.'],
  ['¿Qué mide el combustible?', 'Nivel A usa la señal de la ignición y el nivel de la sonda; Nivel B lee el bus CAN del tractor (J1939) para consumo real.'],
  ['¿Puedo ver el historial de una ruta?', 'Sí. En el mapa abre «Herramientas» y usa «Reproducir ruta»; también hay paradas, cobertura del implemento y mapa de calor.'],
  ['¿Cómo sé si un tractor salió de su lote?', 'Con las alertas de lote: el panel marca en rojo el lote y el tractor, y la campana te avisa.'],
  ['¿Funciona en el celular?', 'Sí. El mapa usa una hoja inferior de tres alturas y la navegación se abre a pantalla completa.'],
  ['¿Quién puede entrar?', 'Cada persona con su cuenta. La primera cuenta registrada queda como administradora.'],
  ['¿Qué hace el Taller?', 'Lleva las órdenes de trabajo, las refacciones y el almacén, y calcula costos y KPIs como costo por hora y disponibilidad.'],
  ['¿Cuánto diésel gasta cada tractor?', 'En Costeo ves litros, cargas y descargas por tractor y por día, con el costo por lote y por hora.'],
  ['¿Se puede usar sin conexión a los rastreadores?', 'Sí, en modo simulado: sirve para conocer el panel con datos de ejemplo antes de conectar los equipos reales.'],
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section aria-label="Preguntas y respuestas" className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16">
      <div className="grid content-start gap-6 lg:sticky lg:top-28">
        <p className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-accent"><span className="h-px w-6 bg-accent" />Preguntas frecuentes</p>
        <h2 className="display text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.12] tracking-[-0.02em]">Respuestas cortas<br />a buenas <span className="text-fg/60">preguntas</span>.</h2>
        <p className="max-w-xs text-[15px] leading-relaxed text-fg/65">¿No encuentras la tuya? Revisa los enlaces útiles o abre el estado de los servicios.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/enlaces')} className="h-11 rounded-2xl bg-fg px-5 text-[14px] font-medium text-onfg">Ver enlaces útiles</button>
          <button type="button" onClick={() => navigate('/status')} className="h-11 rounded-2xl px-5 text-[14px] text-fg shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.2*var(--t-hair-a)))] hover:bg-ink/[0.06]">Estado</button>
        </div>
      </div>
      <div>
        {FAQ.map(([q, a], i) => {
          const on = open === i;
          return (
            <div key={q} className={clsx('border-t border-ink/10 transition-colors last:border-b', on && 'bg-ink/[0.025]')}>
              <button type="button" id={`faq-q${i}`} aria-expanded={on} aria-controls={`faq-a${i}`} onClick={() => setOpen(on ? -1 : i)} className="group flex w-full items-center gap-4 px-2 py-5 text-left">
                <span className="w-7 shrink-0 text-[12.5px] tabular-nums text-faint">{String(i + 1).padStart(2, '0')}</span>
                <h3 className={clsx('flex-1 font-display text-[clamp(1.05rem,1.5vw,1.3rem)] font-normal transition-colors', on ? 'text-fg' : 'text-fg/80 group-hover:text-fg')}>{q}</h3>
                <span className={clsx('grid size-8 shrink-0 place-items-center rounded-full border border-ink/15 transition duration-300', on ? 'rotate-45 border-accent text-accent' : 'text-muted group-hover:border-ink/30')} aria-hidden><Plus className="size-4" /></span>
              </button>
              <div id={`faq-a${i}`} role="region" aria-labelledby={`faq-q${i}`} className={clsx('grid transition-[grid-template-rows,opacity] duration-300 ease-out', on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                <div className="overflow-hidden"><p className="pb-6 pl-[2.75rem] pr-12 text-[15px] leading-relaxed text-fg/60">{a}</p></div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function FinalCta({ bg }) {
  return (
    <section aria-label="Abrir el mapa" className="relative isolate mx-auto grid w-full max-w-5xl justify-items-center gap-5 overflow-hidden rounded-[2rem] border border-ink/10 px-6 py-24 text-center">
      {bg ? <img src={bg.src} srcSet={bg.srcSet} sizes="80vw" alt="" loading="lazy" className="absolute inset-0 -z-20 size-full object-cover opacity-50" /> : null}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_80%_at_50%_100%,rgb(var(--accent-rgb)/0.22),transparent_70%),linear-gradient(180deg,rgb(var(--night-rgb)/0.55),rgb(var(--night-rgb)/0.85))]" />
      <h2 className="display text-[clamp(2.2rem,4vw,3.3rem)] leading-[1.12] tracking-[-0.02em]">Mira tu flota <span className="text-fg/65">ahora mismo</span>.</h2>
      <p className="max-w-md text-[clamp(1rem,1.3vw,1.2rem)] text-fg/70">Cada tractor, cada lote, cada alerta, en una sola pantalla.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => navigate('/mapa')} className="inline-flex h-12 items-center rounded-2xl bg-fg px-7 text-[16px] font-medium text-onfg shadow-[0_0_40px_-8px_rgb(var(--accent-rgb)/0.7)] transition hover:scale-[1.03]">Abrir el mapa</button>
        <button type="button" onClick={() => navigate('/tractores')} className="inline-flex h-12 items-center rounded-2xl bg-black/25 px-7 text-[16px] text-fg backdrop-blur-md shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.25*var(--t-hair-a)))] transition hover:bg-black/40">Ver tractores</button>
      </div>
    </section>
  );
}

/* ======================================================================================
   Secciones de la portada larga (misma estructura que la página de referencia, contenido del panel)
   ====================================================================================== */
import { useEffect, useRef } from 'react';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Cifra que sube hasta su valor la primera vez que se ve ("48 %", "1.5 h", "3/3"). Texto accesible estable en aria-label.
export function Count({ value, className }) {
  const ref = useRef(null);
  const m = /^(\d+(?:[.,]\d+)?)(.*)$/.exec(String(value));
  const target = m ? parseFloat(m[1].replace(',', '.')) : null;
  const dec = m && /[.,]\d/.test(m[1]) ? m[1].split(/[.,]/)[1].length : 0;
  const [n, setN] = useState(reduced() || target === null ? target : 0);
  useEffect(() => {
    if (target === null || reduced() || typeof IntersectionObserver === 'undefined') { setN(target); return undefined; }
    setN(0);
    let raf = 0;
    const safety = setTimeout(() => setN(target), 2600);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const step = (t) => { const k = clamp01((t - t0) / 1100); setN(target * (1 - (1 - k) ** 3)); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [target]);
  if (target === null) return <span className={className}>{value}</span>;
  return <span ref={ref} className={className} aria-label={String(value)}><span aria-hidden="true">{(n ?? 0).toFixed(dec).replace('.', m[1].includes(',') ? ',' : '.')}{m[2]}</span></span>;
}

// Progreso 0..1 del scroll dentro de una sección «pegajosa» (alto = varias pantallas).
export function useProgress() {
  const ref = useRef(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      setP(clamp01(-r.top / Math.max(1, r.height - window.innerHeight)));
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setP(0.9); return undefined; }
    on(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  return [ref, p];
}

// Texto que se enciende palabra por palabra según p (0..1).
function Words({ text, p, from = 0, to = 1, dimFrom = Infinity, className }) {
  const ws = text.split(' ');
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{ws.map((w, i) => {
        const t = clamp01((p - (from + ((to - from) * i) / ws.length)) / ((to - from) / ws.length));
        return <span key={i} className={clsx('inline-block transition-none', i >= dimFrom && 'text-fg/60')} style={{ opacity: 0.12 + 0.88 * t, transform: `translateY(${(1 - t) * 10}px)`, filter: `blur(${(1 - t) * 3}px)` }}>{w}&nbsp;</span>;
      })}</span>
    </span>
  );
}

export function Hero({ pill, title, dimWord, sub, onCta, cta, bg, children }) {
  return (
    <section className="relative isolate mx-auto flex min-h-[86vh] w-full max-w-[1280px] flex-col items-center justify-center px-2 pb-[6vh] pt-8 text-center">
      {bg ? (
        <>
          {/* foto de borde a borde: ocupa todo el ancho de la pantalla y sube hasta detrás de la barra superior */}
          <div className="pointer-events-none absolute -top-28 bottom-0 left-1/2 -z-20 w-screen -translate-x-1/2 overflow-hidden [mask-image:linear-gradient(180deg,#000_0%,#000_62%,transparent_100%)]">
            <img src={bg.src} srcSet={bg.srcSet} sizes="100vw" alt={bg.alt} fetchPriority="high" decoding="async" className="size-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(var(--night-rgb)/0.4)_0%,rgb(var(--night-rgb)/0.5)_55%,rgb(var(--night-rgb)/0.9)_100%)]" />
          </div>
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_40%,rgb(var(--accent-rgb)/0.12),transparent_70%)]" />
        </>
      ) : null}
      <div className="rise-1">{pill}</div>
      <h1 className="rise-2 display glow relative mt-6 text-[clamp(2.3rem,6vw,5.9rem)] font-light leading-[1.04] tracking-[-0.035em]">
        {title} <span className="relative inline-block text-fg/60">{dimWord}
          <svg className="absolute -bottom-[0.04em] left-0 h-[0.09em] w-full overflow-visible" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden><defs><linearGradient id="hu" x1="0" x2="100" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="currentColor" stopOpacity="0.8" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs><path d="M1 5 L99 5" fill="none" stroke="url(#hu)" strokeWidth="2.5" strokeLinecap="round" className="animate-[draw_1.2s_0.4s_both]" pathLength="100" strokeDasharray="100" /></svg>
        </span>.
      </h1>
      <p className="rise-3 mt-8 max-w-3xl text-balance text-[clamp(1.05rem,1.5vw,1.35rem)] text-fg/70">{sub}</p>
      <button type="button" onClick={onCta} className="rise-4 mt-11 min-h-12 rounded-2xl bg-fg px-7 py-3.5 text-[17px] font-medium text-onfg shadow-[0_0_40px_-8px_rgb(var(--accent-rgb)/0.7)] transition hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">{cta}</button>
      <div className="rise-5 w-full">{children}</div>
    </section>
  );
}

// Frase fija: dos enunciados que se leen palabra por palabra mientras se baja.
export function Runway({ a, b, c }) {
  const [ref, p] = useProgress();
  return (
    <section ref={ref} className="relative" style={{ height: '240vh' }} aria-label={`${a} ${b} ${c}`}>
      <div className="sticky top-0 grid h-screen place-items-center overflow-hidden px-4">
        <div className="relative w-full max-w-5xl text-center">
          <p className="display text-[clamp(1.9rem,4.8vw,4.2rem)] font-light leading-[1.08] tracking-[-0.03em]" style={{ opacity: p < 0.5 ? 1 : clamp01(1 - (p - 0.5) / 0.12) }}>
            <Words text={a} p={p} from={0} to={0.3} dimFrom={a.split(' ').length - 1} />
          </p>
          <p className="display absolute inset-0 grid content-center text-[clamp(1.7rem,4.4vw,3.8rem)] font-light leading-[1.1] tracking-[-0.03em]" style={{ opacity: clamp01((p - 0.5) / 0.12) }}>
            <span><Words text={b} p={p} from={0.55} to={0.85} /></span>
            <span className="mt-2 block text-fg/60"><Words text={c} p={p} from={0.72} to={0.95} /></span>
          </p>
        </div>
      </div>
    </section>
  );
}

// Marco de ventana (barra con tres puntos y dirección) para mostrar datos reales dentro.
export function Win({ url, children, className }) {
  return (
    <div className={clsx('rounded-[26px] border border-ink/10 p-3 sm:p-4', className)}>
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-night/70">
        <div className="flex items-center gap-3 px-4 py-2.5"><span className="flex gap-1.5">{[0, 1, 2].map((i) => <i key={i} className="size-2.5 rounded-full bg-ink/15" />)}</span><span className="flex h-7 flex-1 items-center rounded-lg bg-ink/[0.06] px-3 text-[12px] text-muted">panelpack.buildwiselabs.net<b className="font-normal text-soft">{url}</b></span></div>
        <div className="border-t border-ink/10">{children}</div>
      </div>
    </div>
  );
}

// «Una flota. Tres vistas.»: bloques apilados con su pie de texto y, a la derecha, pestañas pegajosas.
export function Modes({ items }) {
  const [active, setActive] = useState(0);
  const refs = useRef([]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive(Number(e.target.dataset.i)); }), { rootMargin: '-45% 0px -45% 0px' });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [items.length]);
  return (
    <section aria-labelledby="modos" className="grid gap-10">
      <div id="modos"><BigHead a="Una flota." b="Tres" dim="vistas" sub="Míralos en el mapa, revisa lo que pide atención o consulta cómo está el campo: el mismo panel, sin cambiar de herramienta." /></div>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-[14vh] py-[4vh]">
          {items.map((m, i) => (
            <div key={m.k} ref={(el) => { refs.current[i] = el; }} data-i={i} id={`modo-${m.k}`} role="tabpanel" aria-labelledby={`tab-${m.k}`} className="transition-[opacity,transform] duration-500" style={{ opacity: active === i ? 1 : 0.2, transform: active === i ? 'none' : 'translateY(-14px) scale(0.97)' }}>
              <Win url={m.url}>{m.node}</Win>
              <div className="px-3 pt-7"><h3 className="display text-[clamp(1.5rem,2.4vw,2.05rem)] font-medium leading-tight tracking-[-0.02em]">{m.title} <span className="text-fg/60">{m.dim}</span></h3><p className="mt-3 max-w-[560px] text-[clamp(1rem,1.25vw,1.2rem)] leading-relaxed text-fg/50">{m.caption}</p></div>
            </div>
          ))}
        </div>
        <aside className="md:sticky md:top-[14vh]">
          <div role="tablist" aria-label="Vistas del panel" className="mb-3 flex gap-1" onKeyDown={(e) => {
            const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault();
            const n = (active + d + items.length) % items.length; setActive(n); document.getElementById(`tab-${items[n].k}`)?.focus(); refs.current[n]?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
          }}>
            {items.map((m, i) => <button key={m.k} id={`tab-${m.k}`} type="button" role="tab" aria-selected={active === i} aria-controls={`modo-${m.k}`} tabIndex={active === i ? 0 : -1} onClick={() => refs.current[i]?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' })} className={clsx('flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12px] transition', active === i ? 'bg-ink/[0.1] text-fg' : 'text-muted hover:text-fg')}><span className="tabular-nums">{`0${i + 1}`}</span>{m.tab}</button>)}
          </div>
          <div className="rounded-[18px] bg-night/70 p-4 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))]">
            <p className="text-[12px] uppercase tracking-[0.14em] text-accent">{items[active].tab}</p>
            <ul className="mt-3 grid gap-2">{items[active].facts.map(([k, v]) => <li key={k} className="flex items-baseline justify-between gap-3 text-[14px]"><span className="text-soft">{k}</span><b className="font-medium tabular-nums">{v}</b></li>)}</ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

// Profundidad: el panel «lee» cada tractor; catálogo inclinado en perspectiva que se endereza al bajar.
export function Depth({ rows, count }) {
  const [ref, p] = useProgress();
  return (
    <section ref={ref} className="relative" style={{ height: '200vh' }} aria-label="Lo que lee el panel">
      <div className="sticky top-0 grid h-screen content-center justify-items-center gap-8 overflow-hidden px-4" style={{ perspective: 1800 }}>
        <h2 className="display text-center text-[clamp(1.8rem,3.6vw,3.2rem)] font-light leading-[1.12] tracking-[-0.02em]">El único panel que <span className="text-fg/60">lee cada señal</span><br />del tractor, en vivo.</h2>
        <div className="w-full max-w-3xl" style={{ transform: `rotateX(${(1 - clamp01(p * 1.6)) * 26}deg) translateY(${(1 - clamp01(p * 1.6)) * 30}px)`, transformStyle: 'preserve-3d' }}>
          <div className="glass overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 py-3"><b className="font-display text-lg font-medium">Señales</b><span className="text-[12.5px] text-muted">{count} equipos · en vivo</span></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[30rem] text-[13.5px]"><thead><tr className="border-y border-ink/10 text-left text-muted"><th className="px-5 py-2 font-medium">Señal</th><th className="px-5 py-2 text-right font-medium">Significado</th><th className="px-5 py-2 font-medium">Origen</th></tr></thead>
              <tbody>{rows.map(([k, m, o], i) => <tr key={k} className="border-b border-ink/[0.06] last:border-0 transition-opacity" style={{ opacity: clamp01((p * 1.4 - i * 0.12) * 4) }}><td className="px-5 py-2.5"><code className="rounded-md bg-accent/12 px-2 py-0.5 text-[12px] text-accent">{k}</code></td><td className="px-5 py-2.5 text-right text-soft">{m}</td><td className="px-5 py-2.5 text-muted">{o}</td></tr>)}</tbody></table></div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Franja de confianza: tres celdas con línea fina; la primera lleva un carrusel continuo de nombres.
export function Trust({ names, a, b }) {
  return (
    <section className="mx-auto grid w-full max-w-[1280px] gap-14" aria-labelledby="conf">
      <h2 id="conf" className="text-center text-[clamp(1.4rem,2.3vw,1.9rem)] font-normal tracking-[-0.01em] text-fg/90">Hecho con lo mejor de la maquinaria y los datos abiertos</h2>
      <div className="grid overflow-hidden rounded-[28px] border border-ink/10 bg-ink/[0.02] lg:grid-cols-[1.7fr_1fr_1fr]">
        <div className="grid min-h-[214px] content-between gap-7 p-8">
          <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]"><div className="marquee-track flex w-max animate-[marquee_28s_linear_infinite] gap-12 pr-12 text-[clamp(1.2rem,2vw,1.6rem)] font-medium text-fg/70">{[...names, ...names].map((n, i) => <span key={i} aria-hidden={i >= names.length ? 'true' : undefined} className="flex items-center gap-3 whitespace-nowrap">{n.img ? <img src={n.img} alt="" loading="lazy" className="h-9 w-auto max-w-28 rounded-md bg-white/90 object-contain p-1" /> : null}{n.n}</span>)}</div></div>
          <p className="text-[15.5px] leading-snug text-fg/60">Rastreo con <b className="font-medium text-fg/90">Teltonika</b> y <b className="font-medium text-fg/90">Traccar</b>, mapas abiertos y satélite.</p>
        </div>
        <div className="grid min-h-[214px] content-between gap-7 border-t border-ink/10 p-8 lg:border-l lg:border-t-0"><b className="display text-5xl font-light">{a[0]}</b><p className="text-[15.5px] leading-snug text-fg/60">{a[1]}</p></div>
        <div className="grid min-h-[214px] content-between gap-7 border-t border-ink/10 p-8 lg:border-l lg:border-t-0"><b className="display text-5xl font-light">{b[0]}</b><p className="text-[15.5px] leading-snug text-fg/60">{b[1]}</p></div>
      </div>
    </section>
  );
}

// «Llámalo desde cualquier parte»: ventana de código con la llamada real de la API y las integraciones.
export function Api() {
  const code = `curl -X POST "$API/api/panel/samples" \\\n  -H "X-Ingest-Key: $INGEST_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"samples":[{"deviceId":12,"fuel":200,\n       "speed":3,"ignition":true}]}'`;
  return (
    <section className="grid gap-10" aria-label="Conexión">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h2 className="display text-[clamp(2.2rem,4vw,3.3rem)] font-light leading-[1.12] tracking-[-0.02em]">Conéctalo<br />desde <span className="text-fg/60">cualquier parte</span>.</h2>
        <p className="max-w-[420px] text-[clamp(1rem,1.3vw,1.2rem)] leading-relaxed text-fg/65">Traccar, tu propio script o el sincronizador: cada lectura es una llamada a la API.</p>
      </div>
      <div className="grid gap-5 border-t border-ink/10 pt-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-night/70"><div className="flex items-center gap-2 px-4 py-2.5 text-[12px] text-muted"><span className="flex gap-1.5">{[0, 1, 2].map((i) => <i key={i} className="size-2.5 rounded-full bg-ink/15" />)}</span>sync.sh</div><pre className="overflow-x-auto border-t border-ink/10 p-5 text-[13px] leading-relaxed text-soft"><code>{code}</code></pre></div>
        <ul className="grid content-start gap-3">{[['Traccar', 'Posiciones en vivo por WebSocket'], ['API del panel', 'Historial de combustible y velocidad'], ['npm run sync:traccar', 'Copia /api/positions cada minuto']].map(([t, c]) => <li key={t} className="rounded-2xl border border-ink/10 p-4"><b className="font-display text-lg font-medium">{t}</b><p className="text-[14px] text-fg/65">{c}</p></li>)}</ul>
      </div>
    </section>
  );
}

// «Avisos, hasta 0»: pantalla fija con cifras que suben al bajar.
export function Numbers({ items, head }) {
  const [ref, p] = useProgress();
  return (
    <section ref={ref} className="relative" style={{ height: '170vh' }} aria-label={head[0]}>
      <div className="sticky top-0 grid h-screen content-center gap-14 px-4">
        <div className="text-center"><h2 className="display text-[clamp(1.75rem,5vw,3.3rem)] font-light leading-[1.12] tracking-[-0.02em]">{head[0]}<br />{head[1]} <span className="text-fg/60">{head[2]}</span>.</h2><p className="mt-4 text-[clamp(1rem,1.3vw,1.2rem)] text-fg/65">{head[3]}</p></div>
        <div className="mx-auto grid w-full max-w-5xl gap-8 md:grid-cols-3">
          {items.map(([v, l], i) => { const t = clamp01(p * 2.2 - i * 0.25); return <div key={l} className="text-center" style={{ opacity: t, transform: `translateY(${(1 - t) * 24}px)` }}><b className="display block text-[clamp(3rem,7vw,5.5rem)] font-light tabular-nums"><Count value={v} /></b><span className="text-[clamp(1rem,1.3vw,1.2rem)] text-fg/65">{l}</span></div>; })}
        </div>
      </div>
    </section>
  );
}

// Historias: tarjetas con foto y una cifra grande, al estilo de «libro».
export function Stories({ cards }) {
  return (
    <section aria-label="Del campo" className="grid gap-10">
      <div className="flex flex-wrap items-end justify-between gap-6"><h2 className="display text-[clamp(2.2rem,4vw,3.3rem)] font-light leading-[1.12] tracking-[-0.02em]">Hecho para<br />el <span className="text-fg/60">campo</span>.</h2></div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <button key={c.t} type="button" onClick={c.onClick} className="hover-lift group relative isolate grid min-h-[22rem] content-between overflow-hidden rounded-[1.5rem] border border-ink/10 p-6 text-left" aria-label={`${c.t}: ${c.v} ${c.l}`}>
            {c.img ? <img src={c.img} srcSet={c.srcSet} sizes="33vw" alt="" loading="lazy" className="absolute inset-0 -z-10 size-full object-cover transition duration-700 group-hover:scale-105" /> : null}
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#050a07]/95 via-[#050a07]/45 to-[#050a07]/10" />
            <span className="on-photo text-[13px] uppercase tracking-[0.14em] text-white/70">{c.t}</span>
            <span className="on-photo"><b className="display block text-[clamp(3rem,5vw,4.4rem)] font-light"><Count value={c.v} /></b><span className="text-[15px] text-white/75">{c.l}</span><span className="mt-3 block text-[13px] text-white/55 transition group-hover:text-white">Ver →</span></span>
          </button>
        ))}
      </div>
    </section>
  );
}

// Cita grande centrada.
export function Quote({ a, b, bg }) {
  return (
    <section className="relative isolate mx-auto grid max-w-[1180px] justify-items-center gap-10 py-28 text-center" aria-label="Cita">
      {bg ? <img src={bg.src} srcSet={bg.srcSet} sizes="100vw" alt={bg.alt} loading="lazy" className="absolute inset-0 -z-10 size-full rounded-[2rem] object-cover opacity-25 [mask-image:radial-gradient(75%_75%_at_50%_50%,#000,transparent)]" /> : null}
      <blockquote className="display text-balance text-[clamp(2.25rem,4.6vw,4.6rem)] font-normal leading-[1.08] tracking-[-0.038em]"><span className="block text-fg/60">“{a}</span><span>{b}”</span></blockquote>
    </section>
  );
}

// Piloto: ficha única centrada con precio-estilo «lo que incluye».
export function Pilot({ rows, logos = [] }) {
  return (
    <section className="grid justify-items-center gap-6 py-10 text-center" aria-label="Piloto">
      <div className="flex items-center gap-4">{logos.map((l) => <img key={l} src={l} alt="" loading="lazy" className="h-12 w-auto max-w-32 rounded-lg bg-white/90 object-contain p-1.5" />)}</div>
      <h2 className="text-[13px] uppercase tracking-[0.2em] text-accent">Piloto · Las Cabras</h2>
      <div className="display flex items-baseline gap-1 text-[clamp(4rem,9vw,7rem)] font-light leading-none">{rows[0][0]}<span className="text-[clamp(1.2rem,2vw,1.6rem)] text-fg/60">{rows[0][1]}</span></div>
      <ul className="grid w-full max-w-md gap-2 text-left">{rows.slice(1).map(([k, v]) => <li key={k} className="flex justify-between gap-4 border-b border-ink/10 py-2.5 text-[15px]"><span className="text-soft">{k}</span><b className="font-medium">{v}</b></li>)}</ul>
    </section>
  );
}
