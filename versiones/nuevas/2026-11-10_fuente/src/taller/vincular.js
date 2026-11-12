// Une cada equipo del taller con el tractor de la flota que tenga la misma marca y modelo («John Deere 6110J»),
// solo si la coincidencia es única y el tractor no está ya vinculado. Si la persona elige «Sin vincular» a mano
// (`vincManual`), no se vuelve a vincular solo. Devuelve cuántos equipos vinculó.
// Al vincular, las horas del equipo se sincronizan con el horómetro del rastreador (L.syncGps).
import { brandName } from '../lib/catalog.js';

const clave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function vincularPorModelo(L, devices, { forzar = false } = {}) {
  const S = L.state();
  const lista = [...(typeof devices?.values === 'function' ? devices.values() : devices || [])];
  const usados = new Set(S.equipos.map((e) => e.deviceId).filter((x) => x != null));
  let n = 0;
  S.equipos.forEach((e) => {
    if (!e.usaH || e.deviceId != null || (e.vincManual && !forzar)) return;
    const k = clave(S.modelos[e.modelo]);
    const c = lista.filter((d) => !usados.has(d.id) && clave(`${brandName(d.attributes?.marca)} ${d.attributes?.modelo}`) === k);
    if (c.length === 1) { e.deviceId = c[0].id; e.vincManual = false; usados.add(c[0].id); n++; }
  });
  return n;
}
