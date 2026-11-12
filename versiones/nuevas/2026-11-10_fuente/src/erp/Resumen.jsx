// Resumen de supervisión (solo lectura) como centro de mando agrícola. Todo está conectado:
//   · los indicadores de arriba filtran los tractores (en marcha, apagados, sin señal);
//   · un lote con su avance en hectáreas filtra los tractores que están dentro;
//   · un tractor se abre con su detalle del día (tiempo trabajando, tránsito, parado…, combustible, última señal y alertas);
//   · una alerta lleva al tractor que la causó.
// Solo consulta: ningún botón cambia datos. Los números salen del estado en vivo de la flota (store.js) y del taller.
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowUpRight, Clock, Fuel, Gauge, MapPin, Search, X } from 'lucide-react';
import { Badge } from '../ui/index.jsx';
import { Section } from '../ui/page.jsx';
import { EventIcon } from '../ui/EventIcon.jsx';
import { navigate } from '../app/router.js';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { STATUS } from '../lib/fleet.js';
import { AL_FILTERS, ago, countEvents, highToday, matchFilter, sortedEvents } from '../lib/events.js';
import { WORK, WORK_ORDER, fmtDur, kmh } from '../fleet/ops.js';
import { brandName } from '../lib/catalog.js';
import { ico } from '../ui/menuIcons.js';
import { Ficha, ICONOS_KPI } from './iconos.jsx';
import { useTaller } from '../taller/useTaller.js';

const ESTADOS = [['running', 'En marcha'], ['idle', 'Apagados'], ['nosignal', 'Sin señal']];
const ALERTAS = AL_FILTERS.filter(([k]) => ['todos', 'altas', 'combustible', 'energia', 'geocerca'].includes(k));
const n1 = (x) => (Math.round(x * 10) / 10).toLocaleString('es-MX');

/** Indicador de ERP: ficha de color con su ícono a la izquierda, etiqueta, valor y pista a la derecha. Si recibe `onClick` es un botón que filtra (aria-pressed). */
function Kpi({ label, value, hint, tone, icono, activo, onClick }) {
  const cuerpo = (
    <>
      <Ficha icono={icono} />
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.1em] text-muted">{label}</span>
        <span className={clsx('display text-[1.75rem] leading-none sm:text-[2rem]', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn', tone === 'crit' && 'text-crit')}>{value}</span>
        <span className="truncate text-[12px] leading-snug text-muted">{hint || ' '}</span>
      </span>
    </>
  );
  const cls = 'glass stat-card flex items-center gap-3 p-3 text-left sm:p-3.5';
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={!!activo} className={clsx(cls, 'cursor-pointer transition hover:-translate-y-0.5', activo && 'ring-2 ring-accent')}>{cuerpo}</button>
  ) : <div className={cls}>{cuerpo}</div>;
}

/** Barra apilada con el tiempo de hoy en cada estado de trabajo. */
function BarraDia({ work }) {
  const total = WORK_ORDER.reduce((n, k) => n + (work[k] || 0), 0);
  return (
    <span role="img" aria-label={total ? WORK_ORDER.map((k) => `${WORK[k].label} ${fmtDur(work[k] || 0)}`).join(', ') : 'Sin actividad registrada hoy'} className="flex h-2 overflow-hidden rounded-full bg-ink/[0.07]">
      {total ? WORK_ORDER.map((k) => (work[k] ? <span key={k} style={{ width: `${(work[k] / total) * 100}%`, background: WORK[k].color }} /> : null)) : null}
    </span>
  );
}

function Detalle({ t, eventos, onMapa }) {
  const { d, pos, work } = t;
  const recientes = eventos.filter((x) => x.e.deviceId === d.id).slice(0, 3);
  return (
    <div className="grid gap-4 border-t border-ink/10 px-4 pb-4 pt-3 text-[13.5px]">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {[['Velocidad', `${Math.round(kmh(pos))} km/h`, Gauge], ['Última señal', pos?.fixTime ? ago(new Date(pos.fixTime).getTime()) : '—', Clock], ['Combustible', pos?.attributes?.fuel != null ? `${Math.round(pos.attributes.fuel)} L` : 'Sin sonda', Fuel], ['Lote', t.lote?.name || 'Fuera de lotes', MapPin]].map(([k, v, Icon]) => (
          <div key={k}><dt className="flex items-center gap-1.5 text-[12px] text-muted"><Icon className="size-3.5" aria-hidden />{k}</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>
      <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2" aria-label="Tiempo de hoy por estado">
        {WORK_ORDER.map((k) => <li key={k} className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-full" style={{ background: WORK[k].color }} /><span className="text-soft">{WORK[k].label}</span><b className="ml-auto font-medium">{fmtDur(work[k] || 0)}</b></li>)}
      </ul>
      <div>
        <p className="mb-1 text-[12px] text-muted">Últimas alertas</p>
        {recientes.length ? <ul className="grid gap-1">{recientes.map((x) => <li key={x.e.id} className="flex items-center gap-2"><EventIcon e={x.e} size="sm" /><span className="min-w-0 flex-1 truncate">{x.i.label}</span><span className="text-[12px] text-muted">{ago(x.at)}</span></li>)}</ul> : <p className="text-muted">Sin alertas hoy.</p>}
      </div>
      <button type="button" onClick={onMapa} className="inline-flex w-fit items-center gap-1 text-accent hover:text-fg">Verlo en el mapa<ArrowUpRight className="size-3.5" aria-hidden /></button>
    </div>
  );
}

export function Resumen() {
  const { store, snap } = useFleet();
  const T = useTaller();
  const [estado, setEstado] = useState(null); // null | running | idle | nosignal
  const [lote, setLote] = useState(null);     // id de lote
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(null); // id de tractor abierto
  const [alFiltro, setAlFiltro] = useState('todos');
  const [todosLotes, setTodosLotes] = useState(false);

  const filas = useMemo(() => [...snap.devices.values()].map((d) => ({
    d, id: d.id, st: store.statusOf(d.id), work: store.workToday(d.id), pos: snap.positions.get(d.id), lote: store.fenceOf(d.id),
    horas: (snap.engineToday.get(d.id) || 0) / 36e5,
  })), [snap, store]);
  const lotes = useMemo(() => store.avanceLotes().sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name, 'es')), [snap, store]);
  const eventos = useMemo(() => sortedEvents(snap.events), [snap.events]);
  const cuenta = countEvents(eventos);

  const por = (st) => filas.filter((f) => f.st === st).length;
  const horasMotor = filas.reduce((n, f) => n + f.horas, 0);
  const haHechas = lotes.reduce((n, l) => n + l.done, 0);
  const haTotal = lotes.reduce((n, l) => n + l.ha, 0);
  const altasHoy = highToday(snap.events);

  // Si hay un lote elegido siempre se ve, aunque quede fuera de los primeros.
  const lotesVista = todosLotes ? lotes : lotes.filter((l, i) => i < 6 || l.id === lote);
  const visibles = filas.filter((f) => (!estado || f.st === estado) && (!lote || f.lote?.id === lote) && (!q.trim() || f.d.name.toLowerCase().includes(q.trim().toLowerCase())));
  const hayFiltro = !!(estado || lote || q.trim());
  const limpiar = () => { setEstado(null); setLote(null); setQ(''); };
  const alertas = eventos.filter((x) => matchFilter(x, alFiltro)).slice(0, 8);
  const nombre = (id) => snap.devices.get(id)?.name || `#${id}`;
  // Una alerta lleva al tractor: quita los filtros y lo abre.
  const irAlTractor = (id) => { limpiar(); setAbierto(id); requestAnimationFrame(() => document.getElementById(`tractor-${id}`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })); };

  const S = T.state();
  const otsAb = S.ots.filter(T.abierta);
  const bajos = S.productos.filter((p) => p.exist - p.res + p.camino <= p.min);
  const venc = S.equipos.filter((e) => e.usaH).map((e) => T.peorSemaforo(e.id)).filter((s) => s?.sem === 'VENCIDO').length;
  const productivo = store.summary().productive;

  return (
    <div className="grid gap-6">
      <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi label="En marcha" value={por('running')} tone="ok" icono={ICONOS_KPI.enMarcha} hint={`de ${filas.length} tractores`} activo={estado === 'running'} onClick={() => setEstado(estado === 'running' ? null : 'running')} />
        <Kpi label="Apagados" value={por('idle')} hint="motor apagado" icono={ICONOS_KPI.apagado} activo={estado === 'idle'} onClick={() => setEstado(estado === 'idle' ? null : 'idle')} />
        <Kpi label="Sin señal" value={por('nosignal')} hint="sin reportar" tone={por('nosignal') ? 'crit' : undefined} icono={ICONOS_KPI.sinSenal} activo={estado === 'nosignal'} onClick={() => setEstado(estado === 'nosignal' ? null : 'nosignal')} />
        <Kpi label="Horas motor" value={n1(horasMotor)} icono={ICONOS_KPI.horas} hint={productivo != null ? `hoy · ${Math.round(productivo * 100)} % trabajando` : 'hoy · midiendo…'} />
        <Kpi label="Hectáreas" value={n1(haHechas)} icono={ICONOS_KPI.hectareas} hint={haTotal ? `hoy · de ${n1(haTotal)} ha` : 'sin lotes con superficie'} />
        <Kpi label="Alertas altas" value={altasHoy} tone={altasHoy ? 'warn' : 'ok'} icono={ICONOS_KPI.alertas} activo={alFiltro === 'altas'} onClick={() => setAlFiltro(alFiltro === 'altas' ? 'todos' : 'altas')} hint="hoy · toca para filtrar" />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-4">
          <Section svg={ico('tractores')} title="Tractores" subtitle="Estado en vivo. Toca uno para ver su día."
            action={<button type="button" onClick={() => navigate('/tractores')} className="inline-flex items-center gap-1 text-[13px] text-accent hover:text-fg">Abrir Tractores<ArrowUpRight className="size-3.5" aria-hidden /></button>}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="relative min-w-0 flex-1 basis-48">
                <span className="sr-only">Buscar tractor</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tractor" className="h-10 w-full rounded-xl bg-ink/[0.06] pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent" />
              </label>
              {ESTADOS.map(([k, txt]) => <button key={k} type="button" aria-pressed={estado === k} onClick={() => setEstado(estado === k ? null : k)} className={clsx('h-10 rounded-xl px-3 text-[13.5px] transition', estado === k ? 'bg-accent text-onfg' : 'bg-ink/[0.06] text-soft hover:bg-ink/[0.1]')}>{txt} ({por(k)})</button>)}
              {hayFiltro ? <button type="button" onClick={limpiar} className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-[13.5px] text-muted hover:text-fg"><X className="size-4" aria-hidden />Quitar filtros</button> : null}
            </div>
            <p role="status" className="mb-2 text-[12.5px] text-muted">{visibles.length} de {filas.length} tractores{lote ? ` · lote ${lotes.find((l) => l.id === lote)?.name || ''}` : ''}</p>
            {visibles.length ? (
              <div className="overflow-hidden rounded-2xl ring-1 ring-ink/10">
                <div aria-hidden className="hidden md:grid-cols-[minmax(0,1fr)_6.5rem_9.5rem_4.5rem_3.75rem_minmax(5rem,0.8fr)] gap-x-3 border-b border-ink/10 bg-ink/[0.05] px-3.5 py-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted md:grid">
                  <span>Tractor</span><span>Estado</span><span>Lote</span><span>Diésel</span><span>Motor</span><span>Hoy</span>
                </div>
                <ul className="divide-y divide-ink/10">
                  {visibles.map((f) => {
                    const st = STATUS[f.st], ab = abierto === f.id;
                    return (
                      <li key={f.id} id={`tractor-${f.id}`} className={clsx(ab && 'bg-accent/[0.06]')}>
                        <button type="button" aria-expanded={ab} aria-controls={`detalle-${f.id}`} onClick={() => setAbierto(ab ? null : f.id)}
                          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3.5 py-3 text-left transition hover:bg-ink/[0.04] md:grid-cols-[minmax(0,1fr)_6.5rem_9.5rem_4.5rem_3.75rem_minmax(5rem,0.8fr)]">
                          <span className="order-1 min-w-0 md:order-none"><b className="block truncate font-medium">{f.d.name}</b><span className="block truncate text-[12.5px] text-muted">{brandName(f.d.attributes?.marca)}{f.d.attributes?.modelo ? ` · ${f.d.attributes.modelo}` : ''}</span></span>
                          <span className="order-1 md:order-none"><Badge tone={st.tone}>{st.label}</Badge></span>
                          <span className="order-3 col-span-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-muted md:contents">
                            <span className="min-w-0 truncate md:text-[13.5px] md:text-soft">{f.lote?.name || 'Fuera de lotes'}</span>
                            <span className="md:text-[13.5px] md:text-soft">{f.pos?.attributes?.fuel != null ? `${Math.round(f.pos.attributes.fuel)} L` : <span className="md:text-faint">Sin sonda</span>}</span>
                            <span className="md:text-[13.5px] md:text-soft">{n1(f.horas)} h</span>
                          </span>
                          <span className="order-2 col-span-2 md:order-none md:col-span-1"><BarraDia work={f.work} /></span>
                        </button>
                        {ab ? <div id={`detalle-${f.id}`}><Detalle t={f} eventos={eventos} onMapa={() => navigate(`/mapa?d=${f.id}`)} /></div> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : <p className="py-3 text-[13.5px] text-muted">Ningún tractor coincide con los filtros.</p>}
          </Section>

          <Section svg={ico('lotes')} title="Lotes" subtitle="Avance de hoy en hectáreas. Toca un lote para ver sus tractores.">
            {lotes.length ? (
              <>
              <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                {lotesVista.map((l) => (
                  <li key={l.id}>
                    <button type="button" aria-pressed={lote === l.id} onClick={() => setLote(lote === l.id ? null : l.id)}
                      className={clsx('grid w-full gap-1.5 rounded-xl bg-ink/[0.04] p-3 text-left transition hover:bg-ink/[0.08]', lote === l.id && 'ring-2 ring-accent')}>
                      <span className="flex items-baseline justify-between gap-2"><b className="truncate font-medium">{l.name}</b><span className="shrink-0 text-[13px] text-muted">{Math.round(l.pct)} %</span></span>
                      <span role="progressbar" aria-label={`Avance de ${l.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(l.pct)} className="h-2 overflow-hidden rounded-full bg-ink/[0.08]"><span className="block h-full rounded-full bg-accent" style={{ width: `${l.pct}%` }} /></span>
                      <span className="text-[12.5px] text-muted">{n1(l.done)} de {n1(l.ha)} ha · faltan {n1(l.pend)} ha</span>
                    </button>
                  </li>
                ))}
              </ul>
              {lotes.length > 6 ? <button type="button" onClick={() => setTodosLotes(!todosLotes)} aria-expanded={todosLotes} className="mt-3 text-[13px] text-accent hover:text-fg">{todosLotes ? 'Ver menos lotes' : `Ver los ${lotes.length} lotes`}</button> : null}
              </>
            ) : <p className="text-[13.5px] text-muted">Aún no hay lotes dados de alta.</p>}
          </Section>
        </div>

        <div className="grid gap-4">
          <Section chip={<Ficha icono={ICONOS_KPI.alertas} />} title="Alertas" subtitle="Toca una para ir a su tractor.">
            <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar alertas">
              {ALERTAS.map(([k, txt]) => <button key={k} type="button" aria-pressed={alFiltro === k} onClick={() => setAlFiltro(k)} className={clsx('h-8 rounded-full px-3 text-[12.5px] transition', alFiltro === k ? 'bg-accent text-onfg' : 'bg-ink/[0.06] text-soft hover:bg-ink/[0.1]')}>{txt}{cuenta[k] ? ` ${cuenta[k]}` : ''}</button>)}
            </div>
            {alertas.length ? (
              <ul className="grid min-w-0 gap-1">
                {alertas.map((x) => (
                  <li key={x.e.id} className="min-w-0">
                    <button type="button" onClick={() => irAlTractor(x.e.deviceId)} className="flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-ink/[0.06]">
                      <EventIcon e={x.e} size="sm" />
                      <span className="min-w-0 flex-1"><b className="block truncate text-[14px] font-medium">{x.i.label}</b><span className="block truncate text-[12.5px] text-muted">{nombre(x.e.deviceId)}</span></span>
                      <span className="shrink-0 text-[12px] text-muted">{ago(x.at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13.5px] text-muted">Sin alertas con este filtro.</p>}
          </Section>

          <Section svg={ico('taller')} title="Taller" subtitle="Lo que pide atención"
            action={<button type="button" onClick={() => navigate('/taller/tablero')} className="inline-flex items-center gap-1 text-[13px] text-accent hover:text-fg">Abrir<ArrowUpRight className="size-3.5" aria-hidden /></button>}>
            <ul className="grid gap-2 text-[14px]">
              {[['Órdenes abiertas', otsAb.length, '/taller/ordenes', otsAb.length ? 'warn' : 'ok'], ['Servicios vencidos', venc, '/taller/tablero', venc ? 'crit' : 'ok'], ['Refacciones por pedir', bajos.length, '/taller/almacen', bajos.length ? 'warn' : 'ok']].map(([txt, n, ruta, tono]) => (
                <li key={txt}><button type="button" onClick={() => navigate(ruta)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-3 py-2.5 text-left transition hover:bg-ink/[0.08]"><span>{txt}</span><Badge tone={tono}>{n}</Badge></button></li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
