// Hilos del Agente agrícola con assistant-ui (@assistant-ui/react, mismas versiones que el panel recuperado: chat-ui/).
// La fuente de verdad son los mensajes de logic.js (chatOp / S.wa.jefe); aquí solo se pintan con los primitivos de assistant-ui
// usando useExternalStoreRuntime: el hilo del chat (con la caja al centro cuando está vacío) y el hilo de solo lectura de los avisos al jefe.
import { createContext, useContext, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowUp, Bell, Check, ChevronDown, Copy, ListChecks, RefreshCw, RotateCcw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { AssistantRuntimeProvider, ComposerPrimitive, MessagePrimitive, ThreadPrimitive, useAuiState, useExternalStoreRuntime } from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import { Badge } from '../ui/index.jsx';

// Las reglas locales escriben al estilo WhatsApp (*negritas*, «• » para listas): se pasa a Markdown.
export function aMarkdown(txt, esAgente) {
  if (esAgente) return String(txt ?? '');
  return String(txt ?? '').replace(/\*([^*\n]+)\*/g, '**$1**').replace(/^• /gm, '- ').replace(/\n(?!- )/g, '  \n');
}

// Mensajes de logic.js -> mensajes de assistant-ui. `btnDis` decide qué botones se ven deshabilitados (compra ya aprobada, etc.).
export function convertir(m, i, { op, total, btnDis, extra = '' }) {
  const yo = m.de === 'yo';
  return {
    id: `${extra}${op}-${i}-${String(m.t)}`,
    role: yo ? 'user' : 'assistant',
    content: [{ type: 'text', text: yo ? String(m.txt) : aMarkdown(m.txt, !!m.meta?.agente) }],
    createdAt: new Date(m.t),
    status: yo ? undefined : { type: 'complete', reason: 'stop' },
    metadata: { custom: { hora: String(m.t).slice(11, 16), agente: m.meta?.agente, modelo: m.meta?.modelo, respaldo: !!m.meta?.error, botones: (m.btns || []).map((b) => ({ texto: b[0], act: b[1], id: b[2], deshabilitado: btnDis(b, i, total) })) } },
  };
}
const TECLANDO = { id: 'tecleando', role: 'assistant', content: [{ type: 'text', text: '' }], status: { type: 'running' }, createdAt: new Date() };

function Markdown() { return <MarkdownTextPrimitive className="tlc-md" />; }

// Marca del Agente agrícola: el logo de Las Cabras sobre fondo blanco
export const Logo = ({ className = 'size-7' }) => <span aria-hidden className={clsx('relative block shrink-0 overflow-hidden rounded-full bg-[#fafafa] ring-1 ring-black/10', className)}><img src="/brand/las-cabras-logo.webp" alt="" className="absolute inset-[8%] size-[84%] object-contain" /></span>;

const ICO = 'grid size-8 place-items-center rounded-lg text-muted transition hover:bg-ink/[0.08] hover:text-fg';

// Datos y acciones que comparten los mensajes del hilo (copiar, regenerar, votar). Se pasan por contexto para no depender de los primitivos.
const Acc = createContext({ msgs: [], onCopy: () => {}, onNuevo: null, votos: {}, onVoto: () => {} });

// Acciones bajo la respuesta (como en DeepSeek): copiar, regenerar, me gusta / no me gusta.
function Acciones({ aviso }) {
  const { msgs, onCopy, onNuevo, votos, onVoto } = useContext(Acc);
  const c = useAuiState((s) => s.message.metadata?.custom);
  const id = useAuiState((s) => s.message.id);
  const texto = useAuiState((s) => s.message.content.filter((p) => p.type === 'text').map((p) => p.text).join('\n'));
  const [ok, setOk] = useState(false);
  const voto = votos[id] || null;
  // Regenerar: vuelve a mandar lo último que escribió el operador antes de esta respuesta.
  const i = msgs.findIndex((m) => m.id === id);
  const previo = i > 0 ? [...msgs.slice(0, i)].reverse().find((m) => m.role === 'user')?.content?.[0]?.text : null;
  const copiar = async () => { await onCopy(texto); setOk(true); setTimeout(() => setOk(false), 1600); };
  return (
    <div className="-ml-1.5 flex flex-wrap items-center gap-0.5 text-[11.5px] text-faint">
      <button type="button" onClick={copiar} className={ICO} aria-label="Copiar mensaje" title="Copiar">{ok ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />}</button>
      {!aviso && previo && onNuevo ? <button type="button" onClick={() => onNuevo(previo)} className={ICO} aria-label="Regenerar respuesta" title="Regenerar"><RotateCcw className="size-4" aria-hidden /></button> : null}
      {!aviso ? (
        <>
          <button type="button" onClick={() => onVoto(id, 'si')} aria-pressed={voto === 'si'} className={clsx(ICO, voto === 'si' && 'bg-accent/15 text-accent')} aria-label="Respuesta útil" title="Útil"><ThumbsUp className={clsx('size-4', voto === 'si' && 'fill-current')} aria-hidden /></button>
          <button type="button" onClick={() => onVoto(id, 'no')} aria-pressed={voto === 'no'} className={clsx(ICO, voto === 'no' && 'bg-crit/15 text-crit')} aria-label="Respuesta no útil" title="No útil"><ThumbsDown className={clsx('size-4', voto === 'no' && 'fill-current')} aria-hidden /></button>
        </>
      ) : null}
      <span className="ml-1.5">{c?.hora}</span>
      {c?.agente ? <span className="ml-1.5">{c.agente}{c.modelo ? ` · ${c.modelo}` : ''}</span> : c?.respaldo ? <span className="ml-1.5 text-warn">respaldo local</span> : null}
    </div>
  );
}

function Botones({ onAct }) {
  const c = useAuiState((s) => s.message.metadata?.custom);
  if (!c?.botones?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">{c.botones.map((b) => (
      <button key={b.act + b.id} type="button" disabled={b.deshabilitado} onClick={() => onAct(b.act, b.id)}
        className="h-8 rounded-full px-3 text-[12.5px] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.2*var(--t-hair-a)))] transition hover:bg-ink/[0.07] hover:text-fg disabled:opacity-40">{b.texto}</button>))}
    </div>
  );
}

function Escribiendo() {
  const vacio = useAuiState((s) => s.message.status?.type === 'running' && !s.message.content.some((p) => p.type === 'text' && p.text));
  if (!vacio) return null;
  return <div role="status" aria-label="Escribiendo" className="flex items-center gap-2 py-1 text-[14px] text-muted"><span className="flex gap-1">{[0, 1, 2].map((i) => <i key={i} className="size-1.5 animate-pulse rounded-full bg-accent" style={{ animationDelay: `${i * 150}ms` }} />)}</span>Pensando…</div>;
}

function mensajes({ onAct, aviso }) {
  const Asistente = () => (
    <MessagePrimitive.Root className="flex gap-3">
      {aviso ? <span aria-hidden className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ok/15 text-ok"><Bell className="size-4" /></span> : <Logo className="mt-0.5 size-7" />}
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="text-[15.5px] leading-relaxed text-fg"><MessagePrimitive.Parts components={{ Text: Markdown }} /><Escribiendo /></div>
        <Botones onAct={onAct} />
        <Acciones aviso={aviso} />
      </div>
    </MessagePrimitive.Root>
  );
  const Usuario = () => (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[85%] rounded-3xl bg-ink/[0.09] px-4 py-2.5 text-[15.5px] leading-snug text-fg"><MessagePrimitive.Parts /></div>
    </MessagePrimitive.Root>
  );
  return { AssistantMessage: Asistente, UserMessage: Usuario };
}

// Caja de mensaje: textarea, interruptores Agente / Reglas locales (como «Pensamiento profundo» / «Búsqueda inteligente») y botón de enviar.
function Caja({ modo, setModo, estBadge, reprobar, urlAgente, vacio, compacto }) {
  const chip = (act) => clsx('inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] transition', act ? 'bg-accent/20 text-accent shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.5)]' : 'text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.2*var(--t-hair-a)))] hover:text-fg');
  return (
    <ComposerPrimitive.Root className="w-full rounded-[1.75rem] bg-ink/[0.07] p-3 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))] focus-within:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.5)]">
      <ComposerPrimitive.Input rows={vacio ? 2 : 1} placeholder="Mensaje al Agente agrícola" aria-label="Mensaje" submitMode="enter" autoFocus={false}
        className="block max-h-40 w-full resize-none bg-transparent px-2 py-1.5 text-[15.5px] text-fg outline-none placeholder:text-muted" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={modo === 'agente'} onClick={() => setModo(modo === 'agente' ? 'auto' : 'agente')} className={chip(modo === 'agente')}><Sparkles className="size-4" aria-hidden />Agente</button>
        <button type="button" aria-pressed={modo === 'local'} onClick={() => setModo(modo === 'local' ? 'auto' : 'local')} className={chip(modo === 'local')}><ListChecks className="size-4" aria-hidden />Reglas locales</button>
        <span className={clsx('ml-1 hidden items-center gap-1.5 text-[12.5px] text-muted', !compacto && 'sm:flex')}><Badge tone={estBadge[1]}>{estBadge[0]}</Badge>
          <button type="button" onClick={reprobar} className="inline-flex items-center gap-1 text-accent hover:underline" title={urlAgente}><RefreshCw className="size-3.5" aria-hidden />Reintentar</button></span>
        <ComposerPrimitive.Send aria-label="Enviar" className="ml-auto grid size-10 place-items-center rounded-full bg-accent text-onfg transition hover:brightness-110 disabled:opacity-40"><ArrowUp className="size-5" aria-hidden /></ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
}

export function ChatHilo({ mensajes: msgs, ocupado, onNuevo, saludo, sugerencias, onAct, onCopy, votos = {}, onVoto, ...caja }) {
  const lista = ocupado ? [...msgs, TECLANDO] : msgs;
  const runtime = useExternalStoreRuntime({
    messages: lista, isRunning: ocupado, convertMessage: (m) => m,
    onNew: async (msg) => { const t = msg.content.filter((p) => p.type === 'text').map((p) => p.text).join('\n').trim(); if (t) await onNuevo(t); },
  });
  const comps = useMemo(() => mensajes({ onAct }), [onAct]);
  const ctx = useMemo(() => ({ msgs, onCopy, onNuevo: ocupado ? null : onNuevo, votos, onVoto }), [msgs, onCopy, onNuevo, ocupado, votos, onVoto]);
  const sug = (cls) => sugerencias.map(([l, c, I]) => <ThreadPrimitive.Suggestion key={l} prompt={c} send disabled={ocupado} className={clsx(cls, 'inline-flex items-center justify-center gap-1.5')}>{I ? <I className="size-3.5 text-accent" strokeWidth={1.75} aria-hidden /> : null}{l}</ThreadPrimitive.Suggestion>);
  return (
    <Acc.Provider value={ctx}><AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport className="grid min-h-0 flex-1 content-start overflow-y-auto scroll-smooth px-5 py-5" aria-label="Mensajes">
          <ThreadPrimitive.Empty>
            <div className="grid place-content-center justify-items-center gap-5 py-8 sm:py-16">
              <span className="relative grid place-items-center"><span aria-hidden className="absolute size-28 rounded-full bg-accent/25 blur-2xl" /><Logo className="relative size-16 shadow-[0_8px_30px_-8px_rgb(var(--accent-rgb)/0.5)] ring-4 ring-ink/10" /></span>
              <div className="grid gap-1.5 text-center"><h3 className="display glow text-[clamp(1.7rem,6.5vw,2.4rem)] leading-tight">Agente agrícola</h3><p className="text-[clamp(1rem,3.6vw,1.2rem)] text-muted">¿En qué te ayudo hoy?</p></div>
              <p className="max-w-md text-center text-[13.5px] text-faint">{saludo}</p>
              <div className="flex max-w-2xl flex-wrap justify-center gap-2" aria-label="Sugerencias">{sug('h-9 rounded-full px-4 text-[13.5px] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.2*var(--t-hair-a)))] transition hover:bg-ink/[0.07] hover:text-fg disabled:opacity-50')}</div>
            </div>
          </ThreadPrimitive.Empty>
          <div className="mx-auto grid w-full max-w-3xl gap-4"><ThreadPrimitive.Messages components={comps} /></div>
        </ThreadPrimitive.Viewport>
        {/* La caja de mensaje va siempre abajo (también con el chat vacío) */}
        <div className="relative mx-auto w-full max-w-3xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <ThreadPrimitive.If empty={false}>
            <ThreadPrimitive.ScrollToBottom className="absolute -top-12 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full bg-night/90 text-soft shadow-lg disabled:hidden" aria-label="Ir al final"><ChevronDown className="size-4" /></ThreadPrimitive.ScrollToBottom>
            <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]" aria-label="Sugerencias">{sug('h-8 shrink-0 rounded-full bg-ink/[0.06] px-3 text-[12.5px] text-soft transition hover:bg-ink/[0.1] hover:text-fg disabled:opacity-50')}</div>
          </ThreadPrimitive.If>
          <Caja {...caja} />
          <p className="mt-2 text-center text-[11.5px] text-faint">El contenido lo genera IA o reglas locales; revísalo antes de actuar.</p>
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider></Acc.Provider>
  );
}

// Avisos al jefe de taller: hilo de solo lectura. Los botones aprueban compras, registran llegadas o abren la OT.
export function AvisosHilo({ mensajes: msgs, onAct, onCopy }) {
  const ctx = useMemo(() => ({ msgs, onCopy, onNuevo: null, votos: {}, onVoto: () => {} }), [msgs, onCopy]);
  const runtime = useExternalStoreRuntime({ messages: msgs, isRunning: false, isDisabled: true, convertMessage: (m) => m, onNew: async () => {} });
  const comps = useMemo(() => ({ ...mensajes({ onAct, aviso: true }), UserMessage: () => null }), [onAct]);
  return (
    <Acc.Provider value={ctx}><AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport className="grid min-h-0 flex-1 content-start overflow-y-auto px-5 py-5" aria-label="Avisos">
          <ThreadPrimitive.Empty><p className="text-[14px] text-muted">Sin avisos todavía. Aquí llegan fallas, servicios por vencer y compras por aprobar, sin que nadie lo capture.</p></ThreadPrimitive.Empty>
          <div className="mx-auto grid w-full max-w-3xl gap-4"><ThreadPrimitive.Messages components={comps} /></div>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider></Acc.Provider>
  );
}
