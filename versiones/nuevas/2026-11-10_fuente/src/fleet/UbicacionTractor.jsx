// Tarjeta «Ubicación» de la ficha del tractor: coordenadas, lugar más cercano y elevación (a petición) y enlaces de Google Maps.
// Lugar y elevación se piden con un clic y no antes: salen las coordenadas del tractor hacia OpenStreetMap (Nominatim) y Open-Meteo.
import { useState } from 'react';
import clsx from 'clsx';
import { ExternalLink, MapPin, Mountain, Navigation, Search } from 'lucide-react';
import { fetchElevation, fetchPlace, googleDirectionsUrl, googleMapsUrl, streetViewUrl } from '../lib/mapApis.js';

const btn = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.16*var(--t-hair-a)))] transition hover:bg-ink/[0.07]';

export function UbicacionTractor({ lat, lon, name }) {
  const [r, setR] = useState(null); // null = sin consultar · { st: 'cargando' | 'ok' | 'error', lugar, m }
  const ok = Number.isFinite(lat) && Number.isFinite(lon);
  const pt = [lat, lon];

  async function consultar() {
    setR({ st: 'cargando' });
    const [lugar, elev] = await Promise.allSettled([fetchPlace(pt), fetchElevation(pt)]);
    const l = lugar.status === 'fulfilled' ? lugar.value : null, m = elev.status === 'fulfilled' ? elev.value : null;
    setR({ st: l || m !== null ? 'ok' : 'error', lugar: l, m, falloLugar: lugar.status === 'rejected', falloElev: elev.status === 'rejected' });
  }

  return (
    <section aria-label="Ubicación" className="mx-4 mt-3 rounded-2xl p-4 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.08*var(--t-hair-a)))]">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-accent/15 text-accent"><MapPin className="size-[18px]" aria-hidden /></span>
        <div className="min-w-0 flex-1"><b className="block text-[14px] font-medium">Ubicación</b><span className="block truncate text-[12px] tabular-nums text-muted">{ok ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'Sin posición todavía'}</span></div>
      </div>

      {r?.st === 'cargando' ? <p role="status" className="mt-3 text-[13px] text-muted">Buscando el lugar y la elevación…</p> : null}
      {r?.st === 'ok' ? (
        <dl className="mt-3 grid gap-1.5 rounded-xl bg-ink/[0.04] px-3 py-2 text-[13px]">
          <div className="flex items-baseline justify-between gap-3"><dt className="shrink-0 text-muted">Cerca de</dt><dd className="min-w-0 text-right">{r.lugar ? <><b className="font-medium">{r.lugar.titulo}</b>{r.lugar.detalle ? <span className="block text-[12px] text-muted">{r.lugar.detalle}</span> : null}</> : <span className="text-muted">{r.falloLugar ? 'No disponible' : 'Sin dato'}</span>}</dd></div>
          <div className="flex items-baseline justify-between gap-3"><dt className="flex shrink-0 items-center gap-1 text-muted"><Mountain className="size-3.5" aria-hidden />Elevación</dt><dd className="text-right">{r.m !== null ? <b className="font-medium tabular-nums">{Math.round(r.m).toLocaleString('es-MX')} m s. n. m.</b> : <span className="text-muted">No disponible</span>}</dd></div>
        </dl>
      ) : null}
      {r?.st === 'error' ? <p role="status" className="mt-3 rounded-xl bg-crit/10 px-3 py-2 text-[13px] text-crit">No se pudo consultar el lugar (sin conexión o servicio ocupado). Intenta de nuevo en un momento.</p> : null}

      <div className={clsx('mt-3 flex flex-wrap gap-2', !ok && 'pointer-events-none opacity-50')}>
        <button type="button" className={btn} onClick={consultar} disabled={!ok || r?.st === 'cargando'}><Search className="size-3.5" aria-hidden />{r ? 'Actualizar' : '¿Dónde está?'}</button>
        <a className={btn} href={ok ? googleDirectionsUrl({ dest: pt }) : undefined} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a ${name} en Google Maps`}><Navigation className="size-3.5" aria-hidden />Cómo llegar</a>
        <a className={btn} href={ok ? streetViewUrl(pt) : undefined} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" aria-hidden />Street View</a>
        <a className={btn} href={ok ? googleMapsUrl(pt) : undefined} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" aria-hidden />Google Maps</a>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-faint">«Cómo llegar» parte de tu ubicación. El lugar y la elevación se consultan a OpenStreetMap y Open-Meteo solo al pulsar el botón.</p>
    </section>
  );
}
