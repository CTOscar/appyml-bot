// «Importar y exportar» del panel de herramientas del mapa:
//  · Exportar recorridos y lotes a GPX, KML o GeoJSON (sirven en Google Earth, QGIS, Garmin, etc.).
//  · Importar lotes desde KML o GeoJSON: se muestra una vista previa en el mapa y, solo al confirmar, se crean los lotes.
import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Download, FileUp } from 'lucide-react';
import { descargar, parseLotes, toGPX, toGeoJSON, toKML, toWkt } from '../lib/geoFormats.js';

const MAX_BYTES = 5 * 1024 * 1024, MAX_LOTES = 200;
const btn = 'h-9 rounded-xl text-[13px] shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] hover:bg-ink/[0.06] disabled:pointer-events-none disabled:opacity-40';
const fechaCorta = () => new Date().toISOString().slice(0, 10);

export function ImportarExportar({ tools, store }) {
  const [msg, setMsg] = useState(null); // { ok, text }
  const [imp, setImp] = useState(null); // { archivo, lotes (nuevos), repetidos, saltados }
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const simulado = store?.getSnapshot().mode === 'mock';
  const puedeCrear = !!store?.canCreateFence?.();

  function exportar(fmt) {
    const { tracks, lotes } = tools.getExport();
    if (fmt === 'gpx') {
      if (!tracks.length) return setMsg({ ok: false, text: 'No hay recorridos para exportar. Elige un tractor (o «Toda la flota») y espera a que haya historial, o carga el historial demo.' });
      descargar(`recorridos-${fechaCorta()}.gpx`, 'application/gpx+xml', toGPX(tracks));
      return setMsg({ ok: true, text: `Exportados ${tracks.length} recorrido(s) a GPX.` });
    }
    if (!tracks.length && !lotes.length) return setMsg({ ok: false, text: 'No hay nada que exportar todavía.' });
    if (fmt === 'kml') descargar(`flota-${fechaCorta()}.kml`, 'application/vnd.google-earth.kml+xml', toKML({ tracks, lotes }));
    else descargar(`flota-${fechaCorta()}.geojson`, 'application/geo+json', toGeoJSON({ tracks, lotes }));
    setMsg({ ok: true, text: `Exportados ${lotes.length} lote(s) y ${tracks.length} recorrido(s).` });
  }

  async function elegirArchivo(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    tools.clearPreview(); setImp(null); setMsg(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setMsg({ ok: false, text: 'El archivo pesa más de 5 MB. Divídelo o simplifica los contornos.' });
    const r = parseLotes(file.name, await file.text());
    if (r.error) return setMsg({ ok: false, text: r.error });
    const existentes = new Set((store?.getSnapshot().geofences || []).map((g) => g.name.trim().toLowerCase()));
    const nuevos = [], repetidos = [];
    r.lotes.slice(0, MAX_LOTES).forEach((l) => (existentes.has(l.name.trim().toLowerCase()) ? repetidos : nuevos).push(l));
    if (!nuevos.length) return setMsg({ ok: false, text: `Los ${repetidos.length} lote(s) del archivo ya existen (mismo nombre). No se creó nada.` });
    tools.previewLotes(nuevos);
    setImp({ archivo: file.name, lotes: nuevos, repetidos: repetidos.length, saltados: r.saltados, recortados: Math.max(0, r.lotes.length - MAX_LOTES) });
  }

  async function crear() {
    setBusy(true); let n = 0; const fallos = [];
    for (const l of imp.lotes) {
      try { await store.addFence({ name: l.name, area: toWkt(l.points) }); n++; } catch { fallos.push(l.name); }
    }
    tools.clearPreview(); setImp(null); setBusy(false);
    setMsg(fallos.length
      ? { ok: false, text: `Se crearon ${n} lote(s); fallaron ${fallos.length}: ${fallos.slice(0, 3).join(', ')}${fallos.length > 3 ? '…' : ''}.` }
      : { ok: true, text: `Se crearon ${n} lote(s). Ya aparecen en la pestaña Lotes.` });
  }
  const cancelar = () => { tools.clearPreview(); setImp(null); };

  return (
    <div className="grid gap-2 border-t border-ink/[0.07] px-4 py-3 text-[13px]" aria-label="Importar y exportar">
      <p className="font-medium">Exportar</p>
      <div className="grid grid-cols-3 gap-2">
        {[['gpx', 'GPX'], ['kml', 'KML'], ['geojson', 'GeoJSON']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => exportar(k)} className={clsx(btn, 'flex items-center justify-center gap-1.5')}><Download className="size-3.5" aria-hidden />{l}</button>
        ))}
      </div>
      <p className="text-[11.5px] leading-snug text-muted">GPX: solo recorridos (los del botón «Tractor elegido / Toda la flota»). KML y GeoJSON: recorridos y lotes.</p>

      <p className="mt-1 font-medium">Importar lotes</p>
      <input ref={input} type="file" accept=".kml,.geojson,.json,application/geo+json,application/vnd.google-earth.kml+xml" onChange={elegirArchivo} className="sr-only" aria-label="Archivo KML o GeoJSON con lotes" tabIndex={-1} />
      <button type="button" onClick={() => input.current?.click()} disabled={!puedeCrear || busy} className={clsx(btn, 'flex items-center justify-center gap-2')}><FileUp className="size-4" aria-hidden />Elegir archivo KML o GeoJSON…</button>
      {!puedeCrear ? <p className="text-[11.5px] text-muted">Este cliente de datos no permite crear lotes.</p> : null}

      {imp ? (
        <div className="grid gap-2 rounded-xl bg-[#4285F4]/10 p-3" role="group" aria-label="Vista previa de la importación">
          <p><b className="font-medium">{imp.lotes.length} lote(s) nuevos</b> en «{imp.archivo}» (contorno punteado azul en el mapa).</p>
          <ul className="grid max-h-28 gap-0.5 overflow-y-auto text-[12px]">
            {imp.lotes.slice(0, 12).map((l, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">{l.name}</span><span className="shrink-0 tabular-nums text-muted">{l.ha.toFixed(1)} ha</span></li>)}
            {imp.lotes.length > 12 ? <li className="text-muted">y {imp.lotes.length - 12} más…</li> : null}
          </ul>
          {imp.repetidos ? <p className="text-[12px] text-muted">{imp.repetidos} se omiten porque ya existe un lote con el mismo nombre.</p> : null}
          {imp.saltados ? <p className="text-[12px] text-muted">{imp.saltados} elemento(s) del archivo no eran polígonos y se omiten.</p> : null}
          {imp.recortados ? <p className="text-[12px] text-crit">Solo se toman los primeros {MAX_LOTES} lotes.</p> : null}
          <p className="text-[12px]">{simulado ? 'Modo simulado: los lotes se guardan solo en este navegador.' : <b className="font-medium text-crit">Se crearán geocercas reales en Traccar.</b>}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={crear} disabled={busy} className="h-9 rounded-xl bg-fg text-[13px] font-medium text-onfg disabled:opacity-50">{busy ? 'Creando…' : `Crear ${imp.lotes.length} lote(s)`}</button>
            <button type="button" onClick={cancelar} disabled={busy} className={btn}>Cancelar</button>
          </div>
        </div>
      ) : null}
      {msg ? <p role="status" className={clsx('text-[12.5px]', msg.ok ? 'text-ok' : 'text-crit')}>{msg.text}</p> : null}
    </div>
  );
}
