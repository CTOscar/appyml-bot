// Ficha interna de un enlace (#/enlaces/<id>): resumen, características, configuración, instalación y fuentes,
// para no salir a la página del fabricante o de la tienda. El sitio oficial queda como botón secundario.
// El contenido vive en src/lib/linkDetails.js; cada dato indica su origen (Proyecto, Fabricante, Tienda o Confirmar).
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowLeft, ExternalLink, FileText, Info, TriangleAlert } from 'lucide-react';
import { LINK_GROUPS, hostOf, safeHref } from '../lib/links.js';
import { FETCHED, SRC, TABS, detailOf } from '../lib/linkDetails.js';
import { navigate } from '../app/router.js';
import { Badge, Button } from '../ui/index.jsx';
import { DataTable, Empty, Pills } from '../ui/page.jsx';

const allLinks = () => LINK_GROUPS.flatMap((g) => g.links.map((l) => ({ ...l, cat: g.title })));
export const findLink = (id) => allLinks().find((l) => l.id === id) || null;

const back = () => navigate('/enlaces');

function Callout({ tone = 'info', children }) {
  const warn = tone === 'warn', Icon = warn ? TriangleAlert : Info;
  return (
    <p role="note" className={clsx('flex items-start gap-3 rounded-2xl px-4 py-3 text-[14px] leading-relaxed',
      warn ? 'bg-warn/10 text-fg shadow-[inset_0_0_0_1px_rgb(var(--warn-rgb)/0.35)]' : 'bg-info/10 text-fg shadow-[inset_0_0_0_1px_rgb(var(--info-rgb)/0.3)]')}>
      <Icon className={clsx('mt-0.5 size-4 shrink-0', warn ? 'text-warn' : 'text-info')} strokeWidth={2} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function SrcBadge({ src }) {
  const [label, tone] = SRC[src] || SRC.confirmar;
  return <Badge tone={tone}>{label}</Badge>;
}

// Tabla de texto: { head: [..], rows: [[..]] } → DataTable (en celular cada fila se vuelve una tarjeta).
function TextTable({ t, caption }) {
  const cols = t.head.map((h, i) => ({ key: String(i), label: h, render: (r) => (i === 0 ? <b className="font-medium">{r[i]}</b> : r[i]) }));
  return <DataTable caption={caption} cols={cols} rowKey={(r) => r._k} rows={t.rows.map((r, k) => Object.assign([...r], { _k: k }))} />;
}

function Block({ b }) {
  return (
    <section className="grid gap-3" aria-label={b.title}>
      <h3 className="font-display text-xl font-light">{b.title}</h3>
      {b.intro ? <p className="text-[14.5px] leading-relaxed text-soft">{b.intro}</p> : null}
      {b.steps ? (
        <ol className="grid gap-2">
          {b.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed">
              <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-ink/[0.07] text-[12px] font-medium tabular-nums text-soft">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {b.table ? <TextTable t={b.table} caption={b.title} /> : null}
    </section>
  );
}

export function EnlaceDetalle({ id }) {
  const item = useMemo(() => findLink(id), [id]);
  const d = detailOf(id);
  const [tab, setTab] = useState('resumen');

  if (!item || !d) {
    return (
      <div className="grid gap-6">
        <Button size="sm" onClick={back}><ArrowLeft className="size-4" aria-hidden />Enlaces</Button>
        <Empty title="No encontré ese enlace" text={`No hay una ficha con el identificador «${id}».`} />
      </div>
    );
  }

  const tabs = TABS.filter(([k]) => k === 'resumen' || k === 'fuentes' || (k === 'specs' && d.specs) || (k === 'config' && d.config) || (k === 'install' && d.install));
  const cur = tabs.some(([k]) => k === tab) ? tab : 'resumen';
  const avisos = d.avisos || [];

  return (
    <article className="grid gap-6" aria-label={item.label}>
      <div><Button size="sm" onClick={back}><ArrowLeft className="size-4" aria-hidden />Enlaces</Button></div>

      <header className="glass grid overflow-hidden p-0 md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="relative grid min-h-48 place-items-center bg-white">
          {item.image ? <img src={item.image} alt="" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 m-auto max-h-[calc(100%-2rem)] max-w-[calc(100%-2rem)] object-contain" /> : null}
        </div>
        <div className="grid content-center gap-3 p-5 sm:p-7">
          <p className="flex flex-wrap items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-accent">
            {item.cat}{d.badge ? <Badge tone="accent" dot={false} className="normal-case tracking-normal">{d.badge}</Badge> : null}
          </p>
          <h1 className="display text-[clamp(1.8rem,4vw,3rem)] leading-[1.1] tracking-[-0.02em]">{item.label}</h1>
          <p className="max-w-2xl text-[15.5px] leading-relaxed text-soft">{d.resumen}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a href={safeHref(item.href)} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-ink/[0.08] px-4 text-sm font-medium text-fg shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] transition hover:bg-ink/[0.13]">
              <ExternalLink className="size-4" aria-hidden />Abrir en {hostOf(item.href)}
            </a>
            <span className="text-[12.5px] text-muted">{item.note}</span>
          </div>
        </div>
      </header>

      <Pills label="Secciones de la ficha" options={tabs} value={cur} onChange={setTab} />

      <div className="grid gap-8" role="tabpanel">
        {cur === 'resumen' ? (
          <>
            {d.rol ? (
              <section className="glass grid gap-2 p-5" aria-label="En este proyecto">
                <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-accent">En este proyecto</h2>
                <p className="text-[15.5px] leading-relaxed">{d.rol}</p>
              </section>
            ) : null}
            {avisos.length ? <div className="grid gap-3">{avisos.map((a, i) => <Callout key={i} tone={a.tone}>{a.text}</Callout>)}</div> : null}
            {d.specs ? (
              <div className="grid gap-2">
                <h3 className="font-display text-xl font-light">Datos clave</h3>
                <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {d.specs.slice(0, 4).map(([k, v]) => (
                    <div key={k} className="grid gap-0.5 border-t border-ink/[0.08] pt-2.5"><dt className="text-[12px] uppercase tracking-[0.1em] text-muted">{k}</dt><dd className="text-[14.5px]">{v}</dd></div>
                  ))}
                </dl>
              </div>
            ) : null}
          </>
        ) : null}

        {cur === 'specs' ? (
          <>
            <DataTable caption="Características" cols={[
              { key: 'k', label: 'Característica', render: (r) => <b className="font-medium">{r[0]}</b> },
              { key: 'v', label: 'Valor', render: (r) => r[1] },
              { key: 's', label: 'Origen', render: (r) => <SrcBadge src={r[2]} /> },
            ]} rowKey={(r) => r[0]} rows={d.specs} />
            <p className="text-[12.5px] leading-relaxed text-muted">
              Origen: <b className="font-medium text-soft">Proyecto</b> = decisión o dato de la carpeta docs/ · <b className="font-medium text-soft">Fabricante</b> y <b className="font-medium text-soft">Tienda</b> = página oficial o anuncio, consultados el {FETCHED} ·{' '}
              <b className="font-medium text-soft">Confirmar</b> = dato de distribuidores o buscadores: úsalo de referencia y contrástalo con la hoja de datos.
            </p>
            {avisos.filter((a) => a.tone === 'warn').map((a, i) => <Callout key={i} tone="warn">{a.text}</Callout>)}
          </>
        ) : null}

        {cur === 'config' ? d.config.map((b) => <Block key={b.title} b={b} />) : null}
        {cur === 'install' ? d.install.map((b) => <Block key={b.title} b={b} />) : null}

        {cur === 'fuentes' ? (
          <>
            <section className="grid gap-3" aria-label="Sitios consultados">
              <h3 className="font-display text-xl font-light">Sitios consultados</h3>
              <ul className="grid gap-2">
                {[{ label: `Sitio de ${hostOf(item.href)} (el enlace original)`, url: item.href }, ...(d.fuentes || []).filter((f) => f.url !== item.href)].map((f) => (
                  <li key={f.url}>
                    <a href={safeHref(f.url)} target="_blank" rel="noopener noreferrer" className="group inline-flex flex-wrap items-center gap-2 text-[14.5px] text-fg underline-offset-4 hover:text-accent hover:underline">
                      <ExternalLink className="size-4 text-muted group-hover:text-accent" aria-hidden />{f.label}<span className="font-mono text-[12px] text-faint">{hostOf(f.url)}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-[12.5px] text-muted">Datos de fabricantes y tiendas consultados el {FETCHED}; pueden cambiar.</p>
            </section>
            {d.docs?.length ? (
              <section className="grid gap-3" aria-label="Documentos del proyecto">
                <h3 className="font-display text-xl font-light">Más detalle en el repositorio</h3>
                <ul className="grid gap-1.5 text-[14.5px] text-soft">{d.docs.map((x) => <li key={x} className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-muted" aria-hidden /><code className="text-[13px]">{x}</code></li>)}</ul>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}
