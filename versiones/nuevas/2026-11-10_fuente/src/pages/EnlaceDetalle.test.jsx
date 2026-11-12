import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { LINK_GROUPS, safeHref } from '../lib/links.js';
import { LINK_DETAILS, SRC, TABS, detailOf } from '../lib/linkDetails.js';
import { EnlaceDetalle } from './EnlaceDetalle.jsx';

const links = LINK_GROUPS.flatMap((g) => g.links);

describe('fichas de Enlaces', () => {
  it('cada enlace tiene id único y su ficha', () => {
    const ids = links.map((l) => l.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(detailOf(id), `falta la ficha de ${id}`).toBeTruthy());
    Object.keys(LINK_DETAILS).forEach((id) => expect(ids, `ficha sin enlace: ${id}`).toContain(id));
  });

  it('los datos usan orígenes y pestañas conocidos, y solo enlaces http(s)', () => {
    Object.entries(LINK_DETAILS).forEach(([id, d]) => {
      (d.specs || []).forEach(([k, v, src]) => { expect(v, `${id}/${k}`).toBeTruthy(); expect(SRC[src], `${id}/${k}: origen «${src}»`).toBeTruthy(); });
      [...(d.config || []), ...(d.install || [])].forEach((b) => {
        expect(b.steps || b.table, `${id}/${b.title}`).toBeTruthy();
        if (b.table) b.table.rows.forEach((r) => expect(r.length, `${id}/${b.title}: fila de otra longitud`).toBe(b.table.head.length));
      });
      (d.fuentes || []).forEach((f) => expect(safeHref(f.url)).toBe(f.url));
    });
    expect(TABS.map((t) => t[0])).toEqual(['resumen', 'specs', 'config', 'install', 'fuentes']);
  });

  it('el FMC150 avisa que está en fin de vida', () => {
    const txt = JSON.stringify(detailOf('fmc150'));
    expect(txt).toMatch(/End of life/);
  });
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const montar = async (id) => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<EnlaceDetalle id={id} />); });
  return { host, root };
};
const tab = (host, nombre) => [...host.querySelectorAll('[role=tab]')].find((b) => b.textContent.trim() === nombre);

describe('<EnlaceDetalle>', () => {
  it('muestra la ficha del FMC130 y cambia de pestaña', async () => {
    const { host, root } = await montar('fmc130');
    expect(host.querySelector('h1').textContent).toMatch(/FMC130/);
    expect(host.textContent).toContain('En este proyecto');
    await act(async () => { tab(host, 'Configuración').click(); });
    expect(host.textContent).toContain('Codec 8 Extended');
    expect(host.textContent).toContain('5027');
    await act(async () => { tab(host, 'Características').click(); });
    expect(host.textContent).toContain('Proyecto');
    expect(host.textContent).toContain('Confirmar');
    root.unmount();
  });

  it('el FMC150 muestra el aviso de fin de vida en el resumen', async () => {
    const { host, root } = await montar('fmc150');
    expect(host.textContent).toContain('End of life');
    root.unmount();
  });

  it('un id desconocido no truena', async () => {
    const { host, root } = await montar('nada');
    expect(host.textContent).toContain('No encontré ese enlace');
    root.unmount();
  });
});
