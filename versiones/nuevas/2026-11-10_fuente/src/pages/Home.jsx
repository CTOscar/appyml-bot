// Inicio: mismas secciones y comportamiento que el panel actual (home.js, buildInicio + renderFleet/Weather; las noticias se quitaron del Inicio),
// con el diseño nuevo:
//   portada con el logo · indicadores (en marcha, apagados, sin señal, horas, temperatura, lluvia)
//   «La flota»: carrusel (equipo activo, pronóstico, precipitación, alertas altas, trabajo diario) + accesos
//   «El campo»: clima ahora y ventana de aplicación (ya sin la sección de océano)
//   Noticias con pestañas · Alertas recientes · Tus lotes
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Bell, ChevronLeft, ChevronRight, CloudRain, CloudSun, Fuel, List, Map, MapPinned, Wrench } from 'lucide-react';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { MiniMap } from '../fleet/MiniMap.jsx';
import { navigate } from '../app/router.js';
import { centroid, summarizeWeather, weatherUrl, wmo } from '../lib/weather.js';
import { ago } from '../lib/events.js';
import { Skeleton } from '../ui/index.jsx';
import { EventIcon } from '../ui/EventIcon.jsx';
import { WeatherIcon } from '../ui/WeatherIcon.jsx';
import { greeting } from '../lib/fleet.js';
import { CAMPO_FOTOS, fotoSrc, fotoSrcSet } from '../lib/campo.js';
import { useAuth } from '../app/auth.jsx';
import mapaIcono from '../assets/google-maps-svgrepo-com.svg';
import mapaIconoClasico from '../assets/google-maps-old-svgrepo-com.svg';
import { Api, Bento, Count, Depth, Faq, FinalCta, Hero, Modes, Numbers, Pilot, Quote, Runway, Stories, Trust } from './HomeSections.jsx';

const fmt = (n, d = 0) => (Number.isFinite(n) ? new Intl.NumberFormat('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n) : '—');
const wd = (t, long) => new Date(t + 'T12:00:00').toLocaleDateString('es-MX', long ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'short' }).replace('.', '');
const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

/* ---------- datos externos: clima (10 min) y noticias por pestaña (10 min) ---------- */
function useWeather(ll) {
  const [w, setW] = useState({ data: null, error: false, at: 0 });
  const load = useCallback(() => {
    fetch(weatherUrl(ll)).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((d) => setW({ data: summarizeWeather(d), error: false, at: Date.now() }), () => setW((x) => ({ ...x, error: true })));
  }, [ll[0], ll[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); const t = setInterval(load, 10 * 60000); return () => clearInterval(t); }, [load]);
  return [w, load];
}
function Head({ eyebrow, title, sub, right }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-accent"><span className="h-px w-6 bg-accent" />{eyebrow}</p>
        <h2 className="display mt-2 text-3xl sm:text-4xl">{title}</h2>
        {sub ? <p className="mt-1 text-[14.5px] text-muted">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}
function QuickLink({ icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group inline-flex h-11 shrink-0 items-center gap-2.5 rounded-2xl bg-ink/[0.05] px-4 text-[14px] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.09*var(--t-hair-a)))] transition hover:-translate-y-0.5 hover:bg-ink/[0.1] hover:text-fg hover:shadow-glow">
      <Icon className="size-[18px] text-accent" aria-hidden />{label}
    </button>
  );
}
function M({ l, v }) { return <div className="rounded-xl bg-ink/[0.04] px-3 py-2"><small className="block text-[11.5px] text-muted">{l}</small><b className="font-display text-lg font-normal">{v}</b></div>; }
function EmptyBox({ title, children }) { return <p className="rounded-2xl border border-dashed border-ink/10 p-4 text-center text-[13.5px] text-muted"><b className="block font-medium text-soft">{title}</b>{children}</p>; }
function Dot({ tone, color }) { return <span className={clsx('size-2 shrink-0 rounded-full', tone === 'ok' && 'bg-ok', tone === 'crit' && 'bg-crit shadow-[0_0_8px_#ff6f61]')} style={color ? { background: color } : undefined} />; }

function Kpi({ v, l, tone, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${l}: ${v}`} className="glass grid min-h-24 gap-1 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-glow">
      <span className={clsx('display text-4xl', tone === 'ok' && 'text-ok', tone === 'crit' && 'text-crit')}><Count value={v} /></span>
      <span className="text-[12px] uppercase tracking-[0.12em] text-muted">{l}</span>
    </button>
  );
}

function Carousel({ slides, index, setIndex }) {
  const n = slides.length;
  return (
    <div className="glass min-w-0 overflow-hidden p-0" aria-roledescription="carrusel">
      <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => (
          <article key={s.title} aria-hidden={i !== index} className="w-full shrink-0 p-5">
            <h3 className="mb-4 text-[12px] uppercase tracking-[0.14em] text-accent">{s.title}</h3>
            <div id={s.id}>{s.body}</div>
          </article>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-ink/[0.06] px-4 py-2.5">
        <button type="button" onClick={() => setIndex((index + n - 1) % n)} aria-label="Anterior" className="grid size-8 place-items-center rounded-full hover:bg-ink/[0.08]"><ChevronLeft className="size-4" /></button>
        <div className="flex">{slides.map((s, i) => (
          // área de toque de 24×24 px (WCAG 2.5.8); el punto visible es el hijo
          <button key={s.title} type="button" onClick={() => setIndex(i)} aria-label={s.title} aria-current={i === index} className="group grid h-6 min-w-6 place-items-center rounded-full">
            <span className={clsx('block h-1.5 rounded-full transition-all', i === index ? 'w-6 bg-accent' : 'w-1.5 bg-ink/25 group-hover:bg-ink/50')} />
          </button>
        ))}</div>
        <button type="button" onClick={() => setIndex((index + 1) % n)} aria-label="Siguiente" className="grid size-8 place-items-center rounded-full hover:bg-ink/[0.08]"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}

/* ---------- página ---------- */
export function Home() {
  const { store, snap } = useFleet();
  const { user } = useAuth();
  const nombre = (user?.name || '').split(/\s+/)[0];
  const [slide, setSlide] = useState(0);
  const ll = useMemo(() => centroid(snap.positions.values()), [snap.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const [wx, reloadWx] = useWeather(ll);
  const w = wx.data;
  const devs = [...snap.devices.values()];
  const st = { running: 0, idle: 0, nosignal: 0 };
  devs.forEach((d) => { st[store.statusOf(d.id)]++; });
  const hrs = (id) => (snap.engineToday.get(id) || 0) / 36e5;
  let totalH = 0, working = 0; devs.forEach((d) => { const x = hrs(d.id); totalH += x; if (x > 0.05) working++; });
  const name = (id) => snap.devices.get(id)?.name || `#${id}`;
  const highEv = snap.events.filter((e) => e.type === 'alarm' || e.type === 'deviceFuelDrop');
  const altTxt = (e) => (e.type === 'deviceFuelDrop' ? 'Caída de combustible' : e.attributes?.alarm === 'powerCut' ? 'Corte de energía' : 'Alarma');
  const altList = (n) => highEv.length ? (
    <ul className="grid gap-2">{highEv.slice(0, n).map((e) => <li key={e.id} className="flex items-center gap-3"><EventIcon e={e} size="sm" /><div><b className="block text-[14px] font-medium">{name(e.deviceId)}</b><small className="text-[12.5px] text-muted">{altTxt(e)} · {ago(new Date(e.eventTime).getTime())}</small></div></li>)}</ul>
  ) : <EmptyBox title="No hay alertas altas recientes">Para ver otras alertas y avisos, visite <button type="button" onClick={() => navigate('/alertas')} className="text-accent hover:underline">Alertas</button>.</EmptyBox>;
  const tot = devs.length || 1;
  const topRunning = devs.filter((d) => store.statusOf(d.id) === 'running').sort((a, b) => hrs(b.id) - hrs(a.id)).slice(0, 3);
  const errBox = (what) => <div className="grid justify-items-center gap-2 py-4 text-center text-[13.5px] text-muted"><p>No se pudo cargar {what}. Revisa tu conexión.</p><button type="button" onClick={reloadWx} className="rounded-full bg-ink/[0.08] px-4 py-1.5 text-fg">Reintentar</button></div>;

  const forecast = !w ? (wx.error ? errBox('el pronóstico') : <Skeleton lines={3} label="Cargando el pronóstico…" />) : (() => {
    const lo = Math.min(...w.days.map((d) => d.min)), hi = Math.max(...w.days.map((d) => d.max)), span = Math.max(1, hi - lo);
    return (
      <ul className="grid gap-1.5">{w.days.map((d, k) => (
        <li key={d.t} className="grid grid-cols-[3rem_1.5rem_2.5rem_1fr_2rem_2rem] items-center gap-2 text-[13.5px]">
          <span className="capitalize">{k === 0 ? 'Hoy' : wd(d.t)}</span><WeatherIcon glyph={wmo(d.code)[1]} /><span className="text-info">{fmt(d.prob)}%</span>
          <span className="relative h-1.5 rounded-full bg-ink/[0.06]"><span className="absolute inset-y-0 rounded-full bg-gradient-to-r from-info to-accent" style={{ left: `${((d.min - lo) / span) * 100}%`, width: `${Math.max(6, ((d.max - d.min) / span) * 100)}%` }} /></span>
          <b className="text-right font-normal text-muted">{fmt(d.min)}°</b><b className="text-right font-medium">{fmt(d.max)}°</b>
        </li>
      ))}</ul>
    );
  })();
  const rain = !w ? (wx.error ? errBox('la precipitación') : <Skeleton lines={3} label="Cargando la precipitación…" />) : (() => {
    const max = Math.max(2, ...w.rain.map((r) => r.mm));
    return (
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-2"><M l="Hoy" v={`${fmt(w.rainToday, 1)} mm`} /><M l="Últimos 7 días" v={`${fmt(w.rainPast, 1)} mm`} /><M l="Próximos 7 días" v={`${fmt(w.rainNext, 1)} mm`} /></div>
        <div className="flex h-20 items-end gap-1" role="img" aria-label="Precipitación diaria">
          {w.rain.map((r) => <span key={r.t} title={`${wd(r.t, true)}: ${fmt(r.mm, 1)} mm`} className={clsx('flex-1 rounded-t', r.kind === 'pasado' ? 'bg-info/60' : r.kind === 'hoy' ? 'bg-accent' : 'bg-info/25')} style={{ height: `${r.mm > 0 ? Math.max(4, (100 * r.mm) / max) : 2}%` }} />)}
        </div>
        <p className="flex gap-4 text-[12px] text-muted"><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-info/60" />Registrado</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-accent" />Hoy</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-info/25" />Pronóstico</span></p>
      </div>
    );
  })();

  const slides = [
    { title: 'Equipo activo', id: 'dh-equip', body: devs.length ? (
      <div className="grid gap-3">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-ink/[0.06]" role="img" aria-label={`Estado de la flota: ${st.running} en marcha, ${st.idle} apagados, ${st.nosignal} sin señal`}><i className="bg-ok" style={{ width: `${(100 * st.running) / tot}%` }} /><i className="bg-muted" style={{ width: `${(100 * st.idle) / tot}%` }} /><i className="bg-crit" style={{ width: `${(100 * st.nosignal) / tot}%` }} /></div>
        <div className="grid grid-cols-3 gap-2"><M l="En marcha" v={st.running} /><M l="Apagados" v={st.idle} /><M l="Sin señal" v={st.nosignal} /></div>
        <ul className="grid gap-2">{topRunning.map((d) => <li key={d.id} className="flex items-center gap-3"><Dot tone="ok" /><div className="flex-1"><b className="block text-[14px] font-medium">{d.name}</b><small className="text-[12.5px] text-muted">En marcha</small></div><em className="not-italic tabular-nums text-soft">{fmt(hrs(d.id), 1)} h</em></li>)}</ul>
      </div>
    ) : <EmptyBox title="No se ha encontrado ningún equipo">Añada equipos para ver su estado en tiempo real.</EmptyBox> },
    { title: 'Pronóstico · próximos 7 días', id: 'dh-fc', body: forecast },
    { title: 'Precipitación', id: 'dh-rain', body: rain },
    { title: 'Alertas altas', id: 'dh-alerts', body: altList(4) },
    { title: 'Resumen del trabajo diario', id: 'dh-work', body: (
      <div className="grid gap-3"><div className="grid grid-cols-3 gap-2"><M l="Horas motor" v={`${fmt(totalH, 1)} h`} /><M l="Trabajando" v={`${working} de ${devs.length}`} /><M l="Promedio" v={`${fmt(working ? totalH / working : 0, 1)} h`} /></div>
        <p className="text-[12.5px] text-faint">Calculado con las horas de motor reportadas hoy por cada tractor.</p></div>
    ) },
  ];
  const goSlide = (i) => { setSlide(i); document.getElementById('dh-flota')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  const lotes = snap.geofences.length ? (
    <ul className="grid gap-1 sm:grid-cols-2">
      {snap.geofences.map((g) => {
        const n = [...snap.positions.values()].filter((p) => (p.geofenceIds || []).includes(g.id)).length;
        return (
          <li key={g.id}>
            <button type="button" onClick={() => navigate(`/lotes?l=${g.id}`)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-ink/[0.05]">
              <Dot color={g.attributes?.color || '#6fd48f'} /><div className="min-w-0 flex-1"><b className="block truncate text-[14px] font-medium">{g.name}</b><small className="text-[12.5px] text-muted">{n} tractor{n === 1 ? '' : 'es'} dentro</small></div><em className="not-italic text-[13px] text-accent">Ver</em>
            </button>
          </li>
        );
      })}
    </ul>
  ) : <EmptyBox title="Aún no hay lotes">Dibuje lotes para ver cuántos tractores trabajan en cada uno.</EmptyBox>;

  const foto = (f, w = 1280) => ({ src: fotoSrc(f, w), srcSet: fotoSrcSet(f), alt: f.alt });
  const prod = Math.round(100 * (store.summary().productive ?? 0));
  const marcas = [{ n: 'John Deere', img: '/brands/john-deere.png' }, { n: 'New Holland', img: '/brands/new-holland.png' }, { n: 'Las Cabras', img: '/brand/las-cabras-logo.webp' }, { n: 'BuildWise Labs', img: '/brand/buildwise-mark.webp' }, { n: 'Google Maps', img: mapaIcono }, { n: 'Google Maps (clásico)', img: mapaIconoClasico }, { n: 'Teltonika' }, { n: 'Traccar' }, { n: 'OpenStreetMap' }, { n: 'NASA GIBS' }];
  const lotesN = snap.geofences.length;
  const hoyAltas = highEv.length;

  const modes = [
    { k: 'vivo', tab: 'En vivo', url: '/mapa', title: 'Cada tractor,', dim: 'en su lugar', caption: 'Posición, estado y rastro de la flota en el mapa, con filtros por marca y nivel.',
      node: <div className="h-[28rem]"><MiniMap className="h-full" /></div>,
      facts: [['En marcha', st.running], ['Apagados', st.idle], ['Sin señal', st.nosignal], ['Horas motor hoy', `${fmt(totalH, 1)} h`]] },
    { k: 'atencion', tab: 'Atención', url: '/alertas', title: 'Lo que pide', dim: 'tu atención', caption: 'Alertas altas recientes y qué tractores están dentro de cada lote, para actuar a tiempo.',
      node: (
        <div className="grid gap-0 md:grid-cols-2">
          <div className="relative min-h-52 overflow-hidden"><img src={fotoSrc(CAMPO_FOTOS[2], 640)} srcSet={fotoSrcSet(CAMPO_FOTOS[2])} sizes="40vw" alt={CAMPO_FOTOS[2].alt} loading="lazy" className="absolute inset-0 size-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-night/90 to-night/10" /><div className="on-photo relative grid h-full content-end p-5"><b className="display text-3xl font-light">{lotesN} lotes</b><span className="text-[13px] text-white/70">{snap.geofences.length ? 'con geocerca activa' : 'sin geocercas todavía'}</span></div></div>
          <div className="grid gap-4 p-5"><h3 className="text-[12px] uppercase tracking-[0.14em] text-accent">Alertas recientes</h3>{altList(3)}</div>
        </div>),
      facts: [['Alertas altas hoy', hoyAltas], ['Lotes', lotesN], ['Tractores sin señal', st.nosignal], ['Productivo', `${prod} %`]] },
    { k: 'campo', tab: 'Campo', url: '/', title: 'Cómo está', dim: 'el campo', caption: 'Clima ahora, ventana de aplicación, pronóstico de siete días y precipitación.',
      node: (
        <div id="dh-now" className="grid gap-0 md:grid-cols-[1fr_1.1fr]">
          <div className="relative min-h-52 overflow-hidden"><img src={fotoSrc(CAMPO_FOTOS[1], 640)} srcSet={fotoSrcSet(CAMPO_FOTOS[1])} sizes="40vw" alt={CAMPO_FOTOS[1].alt} loading="lazy" className="absolute inset-0 size-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-night/90 to-transparent" /></div>
          <div className="grid gap-4 p-5">
            {!w ? (wx.error ? errBox('el clima') : <Skeleton lines={3} label="Cargando el clima…" />) : (
              <>
                <div className="flex items-center gap-4"><WeatherIcon glyph={w.now.cond[1]} className="size-14" /><div><div className="display text-5xl">{fmt(w.now.temp)}<small className="text-xl text-muted">°C</small></div><div className="text-[13.5px] text-soft">{w.now.cond[0]} · El Rosario, Sinaloa</div></div></div>
                <div className="grid grid-cols-3 gap-2"><M l="Sensación" v={`${fmt(w.now.feels)} °C`} /><M l="Humedad" v={`${fmt(w.now.hum)} %`} /><M l="Viento" v={`${fmt(w.now.wind)} km/h`} /></div>
                <div className={clsx('rounded-2xl px-4 py-3 text-[13.5px]', w.risk[0] === 'ok' ? 'bg-ok/10 text-ok' : w.risk[0] === 'warn' ? 'bg-warn/10 text-warn' : 'bg-crit/10 text-crit')}><b className="block font-medium">Ventana de aplicación: {w.risk[1]}</b><span className="opacity-80">{w.risk[2]}</span></div>
              </>
            )}
          </div>
        </div>),
      facts: [['Temperatura', w ? `${fmt(w.now.temp)} °C` : '—'], ['Lluvia hoy', w ? `${fmt(w.rainToday, 1)} mm` : '—'], ['Humedad', w ? `${fmt(w.now.hum)} %` : '—'], ['Ventana', w ? w.risk[1] : '—']] },
  ];

  const senales = [['ignition', 'motor encendido o apagado', 'Teltonika'], ['speed', 'velocidad en km/h', 'GPS'], ['hours', 'horas de motor', 'CAN / ignición'], ['fuel', 'nivel de combustible', 'sonda'], ['geofenceIds', 'lote donde está', 'panel']];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-28 sm:gap-36">
      {/* 1 · portada */}
      <Hero bg={foto(CAMPO_FOTOS[0])} title={<>Un panel para tu flota que hace que el trabajo</>} dimWord="avance"
        pill={<p className="inline-flex w-fit items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-[13px] text-soft backdrop-blur-md"><span className="size-1.5 rounded-full bg-ok shadow-[0_0_8px_#6fd48f]" />{snap.mode === 'mock' ? 'Datos simulados' : 'En vivo'} · El Rosario, Sinaloa</p>}
        sub={<>{greeting()}{nombre ? <>, <b className="font-medium text-fg">{nombre}</b></> : null}. Tienes <b className="font-medium text-fg">{st.running}</b> de {devs.length} tractores trabajando ahora: míralos, revisa el campo y actúa a tiempo.</>}
        cta="Abrir el mapa" onCta={() => navigate('/mapa')}>
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-80">{marcas.filter((m) => m.img).map((m) => <img key={m.n} src={m.img} alt={m.n} loading="lazy" className="h-9 w-auto max-w-32 rounded-lg bg-white/90 object-contain p-1.5" />)}</div>
        <section className="relative z-10 mx-auto mt-14 grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Indicadores">
          <Kpi v={st.running} l="En marcha" tone="ok" onClick={() => navigate('/mapa')} />
          <Kpi v={st.idle} l="Apagados" onClick={() => navigate('/mapa')} />
          <Kpi v={st.nosignal} l="Sin señal" tone="crit" onClick={() => navigate('/alertas')} />
          <Kpi v={`${fmt(totalH, 1)} h`} l="Horas motor hoy" onClick={() => navigate('/reportes')} />
          <Kpi v={w ? `${fmt(w.now.temp)} °C` : '—'} l="Temperatura" onClick={() => scrollTo('dh-now')} />
          <Kpi v={w ? `${fmt(w.rainToday, 1)} mm` : '—'} l="Lluvia hoy" onClick={() => goSlide(2)} />
        </section>
      </Hero>

      {/* el resto del Inicio va en un ancho contenido y centrado; solo la foto de la portada ocupa toda la pantalla */}
      <div className="mx-auto grid w-full max-w-[1120px] gap-28 sm:gap-36">
        {/* 2 · frase fija */}
        <Runway a="Cada tractor tiene su lugar." b="Ve lo que pasa en el campo," c="al momento." />

        {/* 3 · una flota, tres vistas */}
        <Modes items={modes} />

        {/* 4 · profundidad */}
        <Depth rows={senales} count={devs.length} />

        {/* 5 · confianza */}
        <Trust names={marcas} a={[`${devs.length}`, 'tractores rastreados en el piloto: dos John Deere y un New Holland.']} b={['24/7', 'posiciones en vivo y un historial que se guarda solo.']} />

        {/* 6 · rejilla de módulos */}
        <Bento />

        {/* 7 · conexión */}
        <Api />

        {/* 8 · números */}
        <Numbers head={['“¿Dónde está el tractor?”', 'avisos,', 'hasta 0', 'Da a cada persona el dato correcto, en el momento correcto.']}
          items={[[`${st.running}/${devs.length}`, 'tractores trabajando ahora'], [`${fmt(totalH, 1)} h`, 'de motor registradas hoy'], [`${prod} %`, 'del tiempo, productivo']]} />

        {/* 9 · del campo */}
        <Stories cards={[
          { t: 'Mapa', v: `${devs.length}`, l: 'tractores en vivo', img: fotoSrc(CAMPO_FOTOS[0], 640), srcSet: fotoSrcSet(CAMPO_FOTOS[0]), onClick: () => navigate('/mapa') },
          { t: 'Lotes', v: `${lotesN}`, l: 'geocercas con su superficie', img: fotoSrc(CAMPO_FOTOS[2], 640), srcSet: fotoSrcSet(CAMPO_FOTOS[2]), onClick: () => navigate('/lotes') },
          { t: 'Costeo de diésel', v: 'L / ha', l: 'litros y costo por hectárea', img: fotoSrc(CAMPO_FOTOS[3], 640), srcSet: fotoSrcSet(CAMPO_FOTOS[3]), onClick: () => navigate('/costeo') },
        ]} />

        {/* 10 · cita */}
        <Quote a="Un tractor parado sin que nadie lo sepa" b="cuesta más que cualquier panel." bg={foto(CAMPO_FOTOS[1])} />

        {/* 11 · piloto */}
        <Pilot logos={['/brands/john-deere.png', '/brands/new-holland.png', '/brand/las-cabras-logo.webp']} rows={[[`${devs.length}`, ' tractores'], ['Marcas', 'John Deere y New Holland'], ['Rastreo', 'Teltonika + Traccar'], ['Historial', 'API propia con MySQL'], ['Ubicación', 'Las Cabras, Sinaloa']]} />

        <Faq />
        <FinalCta bg={foto(CAMPO_FOTOS[3])} />
      </div>
    </div>
  );
}
