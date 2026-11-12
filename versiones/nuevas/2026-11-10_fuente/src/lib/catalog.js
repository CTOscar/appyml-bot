// Catálogo de marcas y modelos de la flota (portado de panelpack/assets/tractores.js).
// La potencia es REFERENCIAL: confirmarla con la ficha del fabricante o del distribuidor.
export const CATALOG = {
  'john-deere': { name: 'John Deere', mono: 'JD', logo: '/brands/john-deere.png', mark: '/brands/john-deere.png', models: { '5075E': { tipo: 'Tractor utilitario', hp: 75 }, '5090E': { tipo: 'Tractor utilitario', hp: 90 }, '6110J': { tipo: 'Tractor utilitario', hp: 110 } } },
  'new-holland': { name: 'New Holland', mono: 'NH', logo: '/brands/new-holland.png', mark: '/brands/new-holland-mark.png', models: { 'TT4.75': { tipo: 'Tractor utilitario', hp: 75 }, 'T6.110': { tipo: 'Tractor utilitario', hp: 110 } } },
};
const ORDER = ['john-deere', 'new-holland'];

export const slug = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const brandName = (m) => CATALOG[m]?.name || (m ? m.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') : 'Otra marca');
export const brandMono = (m) => CATALOG[m]?.mono || '··';

// Agrupa dispositivos por marca y modelo: [{ key, marca, brand, mono, logo, modelo, tipo, hp, ids }], ordenado por marca, potencia y modelo.
export function groupDevices(devs) {
  const map = new Map(), out = [];
  devs.forEach((d) => {
    const a = d.attributes || {}, marca = slug(a.marca) || 'otra', modelo = String(a.modelo || '').trim() || 'Sin modelo', key = `${marca}|${modelo}`;
    let g = map.get(key);
    if (!g) {
      const b = CATALOG[marca], m = b?.models[modelo];
      g = { key, marca, brand: b ? b.name : a.marca ? String(a.marca) : 'Otra marca', mono: b?.mono || '··', logo: b?.logo || '', modelo, tipo: m?.tipo || 'Tractor', hp: m?.hp || 0, ids: [] };
      map.set(key, g); out.push(g);
    }
    g.ids.push(d.id);
  });
  const ord = (m) => { const i = ORDER.indexOf(m); return i < 0 ? 99 : i; };
  return out.sort((x, y) => ord(x.marca) - ord(y.marca) || x.brand.localeCompare(y.brand) || (x.hp || 999) - (y.hp || 999) || x.modelo.localeCompare(y.modelo));
}

export function brandsOf(groups) {
  const seen = new Set(), out = [];
  groups.forEach((g) => { if (!seen.has(g.marca)) { seen.add(g.marca); out.push({ marca: g.marca, name: g.brand }); } });
  return out;
}
