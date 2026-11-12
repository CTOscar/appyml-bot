// Interfaz de las herramientas interactivas del mapa: menú, barra de modo, Inspector, Radio de alcance, Notas, Buscar y aviso.
// La lógica de Leaflet está en mapInteract.js; aquí solo se dibuja y se llama (misma funcionalidad que maptools.js del panel actual).
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { Crosshair, Link2, Locate, MapPin, Radar, Search, StickyNote, Trash2, X } from 'lucide-react';
import { createMapInteract, MODE_TXT } from './mapInteract.js';
import { TIPOS, fmtDist } from './geoTools.js';
import { SNAP_AVISO_M, googleDirectionsUrl, googleMapsUrl, resumenRuta, streetViewUrl } from '../lib/mapApis.js';

const NOP = () => () => {};
const EMPTY = { mode: null, insp: null, radio: { c: null, km: 1, list: [] }, notes: [], draft: null, editing: null, total: 0 };

export function useMapInteract(getMap, snap, selected, ready) {
  const [ctl, setCtl] = useState(null);
  const live = useMemo(() => ({ snap: null, selected: null }), []);
  live.snap = snap; live.selected = selected;
  useEffect(() => {
    const map = ready ? getMap() : null;
    if (!map) return undefined;
    const c = createMapInteract(map, () => ({ devices: live.snap.devices, positions: live.snap.positions, geofences: live.snap.geofences, selected: live.selected }));
    setCtl(c);
    return () => { c.destroy(); setCtl(null); };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ctl?.refresh(); }, [ctl, snap]);
  return ctl;
}
export const useInteractState = (ctl) => useSyncExternalStore(ctl ? ctl.subscribe : NOP, ctl ? ctl.getState : () => EMPTY);

const card = 'glass-strong pointer-events-auto w-[min(21rem,calc(100vw-1rem))] p-4';
const btn = 'h-9 rounded-xl px-3 text-[13px] shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.16*var(--t-hair-a)))] hover:bg-ink/[0.07]';

function NoteForm({ ctl, st }) {
  const n = st.editing != null ? st.notes.find((x) => x.id === st.editing) : null;
  const [f, setF] = useState({ titulo: n?.titulo || '', tipo: n?.tipo || 'otro', nota: n?.nota || '' });
  const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const inp = 'w-full rounded-xl bg-ink/[0.06] px-3 py-2 text-[14px] text-fg outline-none focus:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.55)] [&>option]:bg-deep';
  return (
    <form onSubmit={(e) => { e.preventDefault(); ctl.noteSave(f); }} className="grid gap-2.5">
      <h3 className="font-display text-lg">{n ? 'Editar nota' : 'Nueva nota'}</h3>
      <label className="grid gap-1 text-[12px] text-muted">Título<input ref={first} className={inp} maxLength={60} value={f.titulo} onChange={set('titulo')} placeholder="Ej. Pozo 3" /></label>
      <label className="grid gap-1 text-[12px] text-muted">Tipo<select className={inp} value={f.tipo} onChange={set('tipo')}>{Object.entries(TIPOS).map(([k, t]) => <option key={k} value={k}>{t[0]} {t[1]}</option>)}</select></label>
      <label className="grid gap-1 text-[12px] text-muted">Nota<textarea className={inp} rows={3} maxLength={300} value={f.nota} onChange={set('nota')} placeholder="Detalles, contacto, horario…" /></label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="h-9 rounded-xl bg-fg px-4 text-[13px] font-medium text-onfg">Guardar</button>
        <button type="button" className={btn} onClick={ctl.noteCancel}>Cancelar</button>
        {n ? <button type="button" className={clsx(btn, 'ml-auto text-crit')} onClick={() => { if (confirm(`¿Eliminar la nota «${n.titulo || 'sin título'}»?`)) ctl.noteDel(n.id); }}><Trash2 className="inline size-4" aria-hidden /> Eliminar</button> : null}
      </div>
    </form>
  );
}

function Dato({ k, children }) {
  return <div className="flex items-baseline justify-between gap-3"><dt className="shrink-0 text-muted">{k}</dt><dd className="min-w-0 text-right">{children}</dd></div>;
}

function Inspector({ ctl, st, copy }) {
  const i = st.insp;
  if (!i) return <p className="text-[13.5px] text-muted">Haz clic en cualquier punto del mapa para ver sus coordenadas, el lote y el tractor más cercano.</p>;
  const ll = `${i.lat.toFixed(5)}, ${i.lon.toFixed(5)}`, pt = [i.lat, i.lon];
  const lugar = i.place?.st === 'ok' ? <><b className="font-medium">{i.place.titulo || '—'}</b>{i.place.detalle ? <span className="block text-[12px] text-muted">{i.place.detalle}</span> : null}</> : i.place?.st === 'cargando' ? <span className="text-muted">Buscando…</span> : <span className="text-muted">{i.place?.st === 'error' ? 'No disponible' : 'Sin dato'}</span>;
  const elev = i.elev?.st === 'ok' ? <b className="font-medium tabular-nums">{Math.round(i.elev.m).toLocaleString('es-MX')} m s. n. m.</b> : i.elev?.st === 'cargando' ? <span className="text-muted">Consultando…</span> : <span className="text-muted">No disponible</span>;
  const r = i.route;
  const enlace = clsx(btn, 'inline-flex items-center');
  return (
    <div className="grid gap-2 text-[13.5px]">
      <h3 className="font-display text-lg">Punto seleccionado</h3>
      <p className="tabular-nums text-muted">{ll}</p>
      <p>{i.lote ? <>Lote: <b className="font-medium">{i.lote.name}</b> · {i.lote.ha.toFixed(1)} ha</> : 'Fuera de los lotes'}</p>
      {i.near ? <p>Tractor más cercano: <b className="font-medium">{i.near.name}</b> · {fmtDist(i.near.d)}</p> : null}
      {i.sel ? <p className="rounded-xl bg-info/10 px-3 py-2">Desde <b className="font-medium">{i.sel.name}</b> (seleccionado): <b className="font-medium">{fmtDist(i.sel.d)}</b> · ≈ {i.sel.eta} a {i.sel.kmh} km/h</p> : null}
      <dl className="grid gap-1.5 rounded-xl bg-ink/[0.04] px-3 py-2"><Dato k="Cerca de">{lugar}</Dato><Dato k="Elevación">{elev}</Dato></dl>
      {r ? (
        <p role="status" className={clsx('rounded-xl px-3 py-2', r.st === 'error' ? 'bg-crit/10 text-crit' : 'bg-[#4285F4]/10')}>
          {r.st === 'cargando' ? `Calculando la ruta desde ${r.from}…` : r.st === 'ok' ? <>Por camino desde <b className="font-medium">{r.from}</b>: <b className="font-medium">{resumenRuta(r)}</b> <span className="text-[12px] text-muted">(sin tráfico; no incluye caminos de terracería que falten en el mapa)</span>{r.snapM && Math.max(...r.snapM) > SNAP_AVISO_M ? <span className="mt-1 block text-[12px] text-warn">Ojo: {r.snapM[0] > SNAP_AVISO_M ? `la salida (${r.from}) está a ${Math.round(r.snapM[0])} m del camino más cercano` : ''}{r.snapM[0] > SNAP_AVISO_M && r.snapM[1] > SNAP_AVISO_M ? ' y ' : ''}{r.snapM[1] > SNAP_AVISO_M ? `el punto elegido está a ${Math.round(r.snapM[1])} m del camino más cercano` : ''}. La ruta llega solo hasta el camino (tramos punteados); el resto es a campo traviesa.</span> : null}{r.directM && r.distM > 3 * r.directM && r.distM - r.directM > 5000 ? <span className="mt-1 block text-[12px] text-warn">El camino ({fmtDist(r.distM)}) es mucho más largo que la línea recta ({fmtDist(r.directM)}): puede haber un río, una autopista dividida con retorno lejano o falta de caminos.</span> : null}</> : r.msg}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className={btn} onClick={() => copy(ll, 'Coordenadas copiadas')}>Copiar</button>
        <button type="button" className={btn} onClick={ctl.routeHere} disabled={r?.st === 'cargando'}>Ruta por camino</button>
        <a className={enlace} href={googleDirectionsUrl({ dest: pt })} target="_blank" rel="noopener noreferrer">Cómo llegar</a>
        <a className={enlace} href={googleMapsUrl(pt)} target="_blank" rel="noopener noreferrer">Google Maps</a>
        <a className={enlace} href={streetViewUrl(pt)} target="_blank" rel="noopener noreferrer">Street View</a>
        <button type="button" className={btn} onClick={() => ctl.noteHere(i.lat, i.lon)}>Nota aquí</button>
      </div>
      <p className="text-[11px] leading-snug text-faint">Lugar, elevación y ruta se consultan a OpenStreetMap, Open-Meteo y OSRM con las coordenadas de este punto. «Cómo llegar» y «Street View» abren Google Maps (parten de tu ubicación).</p>
    </div>
  );
}

function RadioPanel({ ctl, st, onGo }) {
  const r = st.radio;
  return (
    <div className="grid gap-2.5 text-[13.5px]">
      <h3 className="font-display text-lg">Radio de alcance</h3>
      <label className="grid gap-1"><span className="flex justify-between text-muted"><span>Radio</span><b className="font-medium text-fg tabular-nums">{r.km.toFixed(1)} km</b></span>
        <input type="range" min="0.1" max="10" step="0.1" value={r.km} onChange={(e) => ctl.setRadioKm(+e.target.value)} className="w-full accent-[#e6c97c]" aria-label="Radio en kilómetros" /></label>
      {r.c ? (
        <>
          <p className="text-muted">{r.list.length} de {st.total} tractores dentro</p>
          <ul className="grid max-h-56 gap-0.5 overflow-y-auto">{r.list.length ? r.list.slice(0, 40).map((o) => (
            <li key={o.id}><button type="button" onClick={() => onGo(o.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ink/[0.06]"><b className="truncate font-medium">{o.name}</b><em className="shrink-0 not-italic tabular-nums text-muted">{fmtDist(o.d)}</em></button></li>)) : <li className="px-2 text-muted">Ningún tractor dentro de este radio.</li>}
            {r.list.length > 40 ? <li className="px-2 text-muted">y {r.list.length - 40} más…</li> : null}</ul>
          <p className="text-[12px] text-faint">Arrastra el centro o haz clic para moverlo.</p>
        </>
      ) : <p className="text-muted">Haz clic en el mapa para colocar el centro.</p>}
    </div>
  );
}

function SearchBox({ ctl, onClose, goCtx }) {
  const [q, setQ] = useState(''), [sel, setSel] = useState(0);
  const res = useMemo(() => (q.trim() ? ctl.search(q) : []), [q, ctl]); // eslint-disable-line react-hooks/exhaustive-deps
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const go = (r) => { if (!r) return; onClose(); ctl.go(r, goCtx); };
  return (
    <div role="dialog" aria-label="Buscar en el mapa" className="glass-strong pointer-events-auto w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden p-2">
      <div className="flex items-center gap-2 px-2"><Search className="size-4 text-muted" aria-hidden />
        <input ref={ref} type="search" value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder="Buscar tractor, lote o nota…" autoComplete="off" aria-label="Buscar en el mapa" aria-controls="mi-res"
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(res.length - 1, x + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)); } else if (e.key === 'Enter') { e.preventDefault(); go(res[sel]); } else if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-muted" />
        <button type="button" onClick={onClose} aria-label="Cerrar búsqueda" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/[0.07]"><X className="size-4" /></button></div>
      <ul id="mi-res" role="listbox" className="mt-1 grid max-h-72 overflow-y-auto">
        {res.map((r, i) => <li key={`${r.k}${r.id}`} role="option" aria-selected={i === sel}><button type="button" onClick={() => go(r)} onMouseEnter={() => setSel(i)} className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left', i === sel && 'bg-ink/[0.08]')}><span aria-hidden>{r.ico}</span><b className="min-w-0 flex-1 truncate text-[14px] font-medium">{r.t}</b><small className="shrink-0 text-[12px] text-muted">{r.s}</small></button></li>)}
        {q.trim() && !res.length ? <li className="px-3 py-3 text-[13.5px] text-muted">Sin resultados para «{q.trim()}».</li> : null}
        {!q.trim() ? <li className="px-3 py-3 text-[13px] text-muted">Escribe para buscar tractores, lotes o tus notas. Atajo: tecla «/».</li> : null}
      </ul>
    </div>
  );
}

// Menú del botón «Ubicar y medir» (se pinta dentro de la columna de controles) y todas las superposiciones.
export function InteractMenu({ ctl, st, onOpenSearch, onShare, onMode }) {
  const items = [['inspect', Crosshair, 'Inspector'], ['radio', Radar, 'Radio'], ['notas', StickyNote, `Notas${st.notes.length ? ` (${st.notes.length})` : ''}`]];
  return (
    <div className="menu-surface absolute right-[calc(100%+8px)] top-0 w-56 p-1.5 animate-pop" role="menu" aria-label="Ubicar y medir">
      {items.map(([k, Icon, l]) => <button key={k} type="button" role="menuitemradio" aria-checked={st.mode === k} onClick={() => onMode(k)} className={clsx('flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px]', st.mode === k ? 'bg-accent/20 text-accent' : 'text-soft hover:bg-ink/[0.06] hover:text-fg')}><Icon className="size-4" aria-hidden />{l}</button>)}
      <button type="button" role="menuitem" onClick={onOpenSearch} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] text-soft hover:bg-ink/[0.06] hover:text-fg"><Search className="size-4" aria-hidden />Buscar <kbd className="ml-auto rounded bg-ink/10 px-1.5 text-[11px]">/</kbd></button>
      <button type="button" role="menuitem" onClick={onShare} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] text-soft hover:bg-ink/[0.06] hover:text-fg"><Link2 className="size-4" aria-hidden />Compartir vista</button>
    </div>
  );
}

export function InteractOverlays({ ctl, st, search, setSearch, goCtx, padLeft, toast, copy }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && st.mode) { ctl?.setMode(null); return; }
      const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setSearch(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ctl, st.mode, setSearch]);
  if (!ctl) return null;
  const left = padLeft ? padLeft + 24 : 12;
  const panel = st.draft || st.editing != null ? <NoteForm key={st.editing ?? 'nuevo'} ctl={ctl} st={st} />
    : st.mode === 'inspect' ? <Inspector ctl={ctl} st={st} copy={copy} />
    : st.mode === 'radio' ? <RadioPanel ctl={ctl} st={st} onGo={(id) => goCtx.go(id)} />
    : st.mode === 'notas' ? <div className="grid gap-2 text-[13.5px]"><h3 className="font-display text-lg">Notas</h3><p className="text-muted">Haz clic en el mapa para dejar un pin (pozo, bodega, taller, combustible, riesgo…). Los pines se pueden arrastrar.</p>
        {st.notes.length ? <ul className="grid max-h-48 gap-0.5 overflow-y-auto">{st.notes.map((n) => <li key={n.id}><button type="button" onClick={() => ctl.go({ k: 'nota', id: n.id, lat: n.lat, lon: n.lon }, goCtx)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ink/[0.06]"><span aria-hidden>{(TIPOS[n.tipo] || TIPOS.otro)[0]}</span><b className="truncate font-medium">{n.titulo || (TIPOS[n.tipo] || TIPOS.otro)[1]}</b></button></li>)}</ul> : null}</div>
    : null;
  return (
    <>
      {st.mode && !search ? (
        <div className="pointer-events-auto absolute left-1/2 top-24 z-[520] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-accent px-4 py-2 text-[13.5px] font-medium text-onfg shadow-[0_10px_30px_-10px_rgb(var(--shadow-rgb)/0.7)]">
          <MapPin className="size-4" aria-hidden />{MODE_TXT[st.mode]}<button type="button" onClick={() => ctl.setMode(null)} className="rounded-lg bg-black/15 px-2 py-1 text-[12px] hover:bg-black/25">Salir (Esc)</button></div>
      ) : null}
      {search ? <div className="absolute left-1/2 top-24 z-[530] -translate-x-1/2"><SearchBox ctl={ctl} onClose={() => setSearch(false)} goCtx={goCtx} /></div> : null}
      {/* Panel de la herramienta (nota, inspector, radio…): pegado abajo. En celular ocupa el ancho y queda sobre la hoja
          de la flota; en escritorio va junto al panel. Si la pantalla es baja, el contenido se desplaza dentro de la tarjeta. */}
      {panel ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[560] flex justify-center sm:inset-x-auto sm:bottom-4 sm:left-[var(--pl)] sm:justify-start" style={{ '--pl': `${left}px` }}>
          <div className={clsx(card, 'max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain')}>{panel}</div>
        </div>
      ) : null}
      {toast ? <div role="status" className="pointer-events-none absolute bottom-6 left-1/2 z-[540] -translate-x-1/2 rounded-2xl bg-fg px-4 py-2 text-[13.5px] text-onfg shadow-xl"><Locate className="mr-2 inline size-4" aria-hidden />{toast}</div> : null}
    </>
  );
}
