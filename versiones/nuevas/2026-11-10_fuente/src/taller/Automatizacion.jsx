// Automatización del taller: chat del asistente (el operador escribe como al jefe de taller), avisos al jefe, reglas activas y reporte semanal.
// Responde el agente del servicio agents/ (/health y /chat) si está en línea; si no, las reglas locales de logic.js (procesarLocal).
// Es la versión en React de vistaAuto de panelpack/assets/taller.js (mismas reglas y mismo respaldo local).
import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { Bell, ChevronDown, ClipboardCheck, Copy, FileText, Fuel, ListChecks, MessageSquare, SquarePen, Timer, Trash2, Wrench, X } from 'lucide-react';
import { DotsIcon, SidebarIcon } from '../ui/icons.jsx';
import { Badge, Button } from '../ui/index.jsx';
import { navigate } from '../app/router.js';
import { mutate, useTaller } from './useTaller.js';
import { AvisosHilo, ChatHilo, Logo, convertir } from './AsistenteChat.jsx';

export const AGENTS_URL = (import.meta.env?.VITE_AGENTS_URL || 'http://localhost:3100').replace(/\/$/, '');

// *negritas* y saltos de línea, sin HTML (React escapa el resto)
function Fmt({ text }) {
  return String(text).split('\n').map((line, i) => (
    <span key={i} className="block min-h-[1.2em]">{line.split(/(\*[^*\n]+\*)/g).map((p, j) => (/^\*[^*]+\*$/.test(p) ? <b key={j} className="font-medium">{p.slice(1, -1)}</b> : p))}</span>
  ));
}

function useAgent() {
  const [est, setEst] = useState('sin-probar'); // sin-probar | probando | en-linea | fuera
  const probar = useCallback(() => {
    setEst('probando');
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 3500);
    fetch(`${AGENTS_URL}/health`, { credentials: 'include', signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(() => setEst('en-linea'), () => setEst('fuera'))
      .finally(() => clearTimeout(to));
  }, []);
  useEffect(() => { probar(); }, [probar]);
  return [est, probar];
}

function sugerencias(T, op) {
  const S = T.state(), e = T.eqp(T.eqDeOp(op)), ult = S.bitacora.filter((b) => b.op === op).slice(-1)[0], lab = ult ? ult.labor : 'Rastreo';
  return [
    ['Checklist', 'checklist', ClipboardCheck],
    ['Jornada', `${e.eco} terminé, horómetro ${(e.horas + 8.5).toFixed(1)}, ${lab.toLowerCase()} lote 2, ${lab === 'Acarreo' ? '12 viajes' : '14 ha'}`, Timer],
    ['Diésel', `Cargué 150 litros al ${e.eco}`, Fuel],
    ['Falla', `El ${e.eco} está tirando aceite del levante, quedó parado`, Wrench],
  ];
}

function Reglas({ T, S }) {
  return (
    <ul className="grid gap-2">{T.REGLAS.map((r) => { const n = S.wa.cont[r[0]] || 0; return (
      <li key={r[0]} className="flex items-start justify-between gap-2 rounded-xl bg-ink/[0.05] px-3 py-2 text-[12.5px] leading-snug"><div><b className="block text-[13px] font-medium">{r[1]}</b><span className="text-muted">Cuando: {r[2]}. Hace: {r[3]}.</span></div><Badge tone={n ? 'ok' : 'muted'} title="Veces que se disparó">{n}</Badge></li>); })}</ul>
  );
}
function Reporte({ T, onCopy }) {
  return (
    <div className="grid gap-2">
      <p className="text-[12px] text-muted">Lunes 7:00 · al dueño</p>
      <div className="rounded-xl bg-ink/[0.06] px-3 py-2.5 text-[12.5px] leading-snug"><Fmt text={T.reporteSemanal()} /></div>
      <Button size="sm" variant="ghost" onClick={() => onCopy(T.reporteSemanal())}>Copiar reporte</Button>
    </div>
  );
}

export function Automatizacion({ full = false, onVerOt, sidebarExtra = null, headerRight = null, vistaInicial = 'chat' }) {
  const T = useTaller();
  const S = T.state();
  const [agente, reprobar] = useAgent();
  const [busy, setBusy] = useState(false);
  const op = S.wa.op;
  const modo = S.ui.chatModo || 'auto';
  const usaAgente = modo === 'agente' || (modo === 'auto' && agente === 'en-linea');
  const msgs = T.chatOp(op);
  const e = T.eqp(T.eqDeOp(op));

  // Copia con el portapapeles del navegador y, si no hay permiso o conexión segura, con un campo temporal.
  const copiar = async (t) => {
    const x = String(t ?? '').replace(/\*\*?/g, '');
    let ok = false;
    try { await navigator.clipboard.writeText(x); ok = true; } catch {
      try { const a = document.createElement('textarea'); a.value = x; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(a); a.select(); ok = document.execCommand('copy'); a.remove(); } catch { /* sin permiso */ }
    }
    T.hooks.toast(ok ? 'Copiado' : 'No se pudo copiar');
  };
  const votos = S.ui.votos || {};
  const votar = (id, v) => { mutate((L) => { const u = L.state().ui; u.votos = u.votos || {}; if (u.votos[id] === v) delete u.votos[id]; else u.votos[id] = v; }); T.hooks.toast(votos[id] === v ? 'Opinión quitada' : v === 'si' ? 'Gracias, me alegra que sirviera' : 'Gracias, lo tomaré en cuenta'); };

  const enviar = async (texto) => {
    const t = String(texto || '').trim();
    if (!t || busy) return;
    mutate((L) => L.chatOp(op).push({ de: 'yo', t: L.ahora(), txt: t }));
    setBusy(true);
    const local = () => mutate((L) => { try { L.procesarLocal(t, op); } catch { L.chatOp(op).push({ de: 'bot', t: L.ahora(), txt: 'No pude procesar el mensaje. Inténtalo otra vez.' }); } });
    if (usaAgente) {
      const hist = T.chatOp(op).filter((m) => m.txt).slice(-20).map((m) => ({ role: m.de === 'yo' ? 'user' : 'assistant', content: m.txt }));
      while (hist.length && hist[0].role !== 'user') hist.shift();
      try {
        const r = await fetch(`${AGENTS_URL}/chat`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: hist, channel: 'web_taller' }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        mutate((L) => L.botOp(op, String(j.reply || '(sin respuesta)'), null, { agente: j.agent, modelo: j.model }));
      } catch (er) {
        mutate((L) => L.botOp(op, `El agente no respondió (${er.message}). Lo resolví con las reglas locales del taller:`, null, { error: true }));
        local();
      }
    } else {
      await new Promise((r) => setTimeout(r, 600));
      local();
    }
    setBusy(false);
  };

  const accion = (act, id) => {
    if (act === 'ver-ot') { if (onVerOt) onVerOt(id); else navigate(`/taller/ordenes?ot=${id}`); return; }
    if (act === 'chk-ok' || act === 'chk-falla') mutate((L) => L.chatCheck(act, +id));
    else if (act === 'req-aprobar') mutate((L) => L.aprobarReq(id));
    else if (act === 'req-recibir') mutate((L) => L.recibirReq(id));
  };
  const btnDis = (b, i, total) => {
    const r = S.requisiciones.find((x) => x.folio === b[2]) || {};
    if (b[1] === 'req-aprobar') return r.estatus !== 'PENDIENTE';
    if (b[1] === 'req-recibir') return r.estatus !== 'APROBADA';
    if (b[1].startsWith('chk-')) return i !== total - 1;
    return false;
  };
  const vacioHilo = !msgs.some((m) => m.de === 'yo'); // solo el saludo: el hilo queda vacío y se muestra la pantalla de inicio
  const lista = vacioHilo ? [] : msgs.map((m, i) => convertir(m, i, { op, total: msgs.length, btnDis }));
  const avisos = S.wa.jefe.map((m, i) => convertir(m, i, { op: 'jefe', total: S.wa.jefe.length, btnDis, extra: 'av-' }));
  const sug = sugerencias(T, op);
  const estBadge = agente === 'en-linea' ? ['Agente en línea', 'ok'] : agente === 'fuera' ? ['Agente fuera de línea', 'warn'] : ['Probando agente…', 'muted'];
  const vacio = !msgs.some((m) => m.de === 'yo'); // solo el saludo: pantalla de inicio con la caja al centro
  const [vista, setVista] = useState(vistaInicial); // chat | avisos
  const [drawer, setDrawer] = useState(false); // celular: la barra lateral se abre como panel sobre el chat
  // Escritorio (bot a pantalla completa): la barra lateral va fija y se puede ocultar y volver a mostrar, como en ChatGPT o DeepSeek. Se recuerda.
  const [fijo, setFijo] = useState(() => { try { return localStorage.getItem('pf-bot-lateral') !== 'cerrada'; } catch { return true; } });
  const guardarFijo = (v) => { setFijo(v); try { localStorage.setItem('pf-bot-lateral', v ? 'abierta' : 'cerrada'); } catch { /* sin almacenamiento: vale para esta sesión */ } };
  const escritorio = () => typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches;
  const [panel, setPanel] = useState(null); // null | 'reglas' | 'reporte' (secciones de la barra lateral)
  const [mas, setMas] = useState(false); // menú «más opciones» (tres puntos)
  const copiarChat = () => { copiar(msgs.map((m) => `${m.de === 'yo' ? 'Yo' : 'Asistente'}: ${m.txt}`).join('\n\n')); setMas(false); };
  const setModo = (m) => mutate((L) => { L.state().ui.chatModo = m; });
  const nuevoChat = () => { mutate((L) => { delete L.state().wa.chats[op]; delete L.state().wa.espera[op]; }); setDrawer(false); };
  const ops = T.operadores();
  const ultimo = (id) => { const m = T.chatOp(id).filter((x) => x.de === 'yo').slice(-1)[0]; return m ? m.txt : 'Chat nuevo'; };


  return (
    <div className={full ? 'h-full' : 'grid gap-6'}>
      <section aria-label="Agente agrícola" className={clsx('relative grid grid-cols-[minmax(0,1fr)] overflow-hidden p-0', !full && 'md:grid-cols-[18rem_minmax(0,1fr)]', full && (fijo ? 'lg:grid-cols-[19rem_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)]'), full ? 'h-full bg-night/80 backdrop-blur-xl' : 'glass h-[calc(100dvh-10.5rem)] min-h-[34rem]')}>
        {/* barra lateral: un chat por operador */}
        {drawer ? <button type="button" aria-label="Cerrar el menú del asistente" onClick={() => setDrawer(false)} className={clsx('absolute inset-0 z-20 bg-black/50', full ? 'lg:hidden' : 'md:hidden')} /> : null}
        <aside id="menu-asistente" aria-label="Menú del asistente" className={clsx('min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain border-r border-ink/10 bg-night/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl', !full && 'md:static md:z-auto md:flex md:w-auto md:bg-ink/[0.025]', full && (fijo ? 'lg:static lg:z-auto lg:flex lg:w-auto lg:animate-none lg:bg-ink/[0.025] lg:shadow-none' : 'lg:hidden'), drawer ? 'absolute inset-y-0 left-0 z-30 flex w-[min(20rem,88%)] shadow-2xl animate-pop' : 'hidden')}>
          <div className="flex shrink-0 items-center gap-2 px-2 pt-1"><Logo className="size-8" /><b className="flex-1 font-display text-[17px] font-medium">Agente agrícola</b><button type="button" onClick={() => setDrawer(false)} aria-label="Cerrar el menú" className={clsx('grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/10', full ? 'lg:hidden' : 'md:hidden')}><X className="size-4" /></button>{full ? <button type="button" onClick={() => guardarFijo(false)} aria-label="Ocultar la barra lateral" title="Ocultar la barra lateral" className="hidden size-9 place-items-center rounded-lg text-muted transition hover:bg-ink/10 hover:text-fg lg:grid"><SidebarIcon className="size-5" /></button> : null}</div>
          <button type="button" onClick={nuevoChat} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-ink/[0.08] text-[14px] transition hover:bg-ink/[0.14]"><SquarePen className="size-4" aria-hidden />Nuevo chat</button>
          <p className="shrink-0 px-2 pt-1 text-[12px] text-muted">Hoy</p>
          <nav aria-label="Chats por operador" className="grid min-h-[5rem] flex-1 content-start gap-0.5 overflow-y-auto">
            {ops.map((x) => (
              <button key={x.id} type="button" aria-current={x.id === op ? 'true' : undefined} onClick={() => { mutate((L) => { L.state().wa.op = x.id; }); setDrawer(false); }}
                className={clsx('grid rounded-xl px-3 py-2 text-left transition', x.id === op ? 'bg-ink/[0.1]' : 'hover:bg-ink/[0.05]')}>
                <span className="flex items-center gap-2.5"><span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-ink/10 text-[11px] font-semibold">{x.nombre.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span><span className="grid min-w-0"><span className="truncate text-[14px]">{x.nombre}</span><span className="truncate text-[12px] text-muted">{ultimo(x.id)}</span></span></span>
              </button>
            ))}
          </nav>
          {/* Reglas activas y Reporte semanal, en la barra lateral */}
          <div className="grid shrink-0 gap-1 border-t border-ink/10 pt-2">
            {[['reglas', 'Reglas activas', ListChecks, T.REGLAS.reduce((n, r) => n + (S.wa.cont[r[0]] || 0), 0)], ['reporte', 'Reporte semanal', FileText, null]].map(([k, label, Icon, n]) => (
              <div key={k}>
                <button type="button" aria-expanded={panel === k} aria-controls={`panel-${k}`} onClick={() => setPanel(panel === k ? null : k)} className={clsx('flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[14px] transition', panel === k ? 'bg-ink/[0.1]' : 'hover:bg-ink/[0.05]')}>
                  <Icon className="size-4 text-accent" aria-hidden /><span className="flex-1">{label}</span>{n ? <Badge tone="ok">{n}</Badge> : null}<ChevronDown className={clsx('size-4 text-muted transition', panel === k && 'rotate-180')} aria-hidden />
                </button>
                {panel === k ? <div id={`panel-${k}`} className="mt-1 max-h-[28vh] overflow-y-auto px-1 pb-1 animate-rise">{k === 'reglas' ? <Reglas T={T} S={S} /> : <Reporte T={T} onCopy={copiar} />}</div> : null}
              </div>
            ))}
          </div>
          {sidebarExtra}
          <div className="flex shrink-0 items-center gap-2.5 border-t border-ink/10 px-2 pt-3"><span aria-hidden className="grid size-8 place-items-center rounded-full bg-ink/10 text-[11px] font-semibold">{T.emp(op).nombre.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span><span className="min-w-0 text-[13px]"><b className="block truncate font-medium">{T.emp(op).nombre}</b><span className="text-muted">{e.eco}</span></span></div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col">
          <header className="relative flex items-center justify-between gap-2 border-b border-ink/10 bg-gradient-to-b from-ink/[0.04] to-transparent px-3 py-3 sm:px-5">
            <button type="button" onClick={() => { if (full && escritorio()) guardarFijo(true); else setDrawer(true); }} aria-expanded={full && escritorio() ? fijo : drawer} aria-controls="menu-asistente" aria-label="Abrir el menú: chats, reglas activas y reporte semanal" title="Mostrar la barra lateral" className={clsx('grid size-10 shrink-0 place-items-center rounded-xl bg-ink/[0.07]', full ? (fijo ? 'lg:hidden' : 'lg:grid') : 'md:hidden')}><SidebarIcon className="size-5" /></button>
            <div className="min-w-0 flex-1"><h2 className="truncate text-[15px] font-medium">{vista === 'chat' ? `${T.emp(op).nombre} · ${e.eco}` : 'Avisos al jefe de taller'}</h2><p className="truncate text-[12.5px] text-muted">{vista === 'chat' ? (usaAgente ? 'Responde el agente' : 'Responden las reglas locales') : `${T.emp(1).nombre} · Jefe de taller`}</p></div>
<div className="flex items-center gap-1">
{headerRight}
            <div role="tablist" aria-label="Vista" className="flex gap-1 rounded-full bg-ink/[0.06] p-1">
              {[['chat', 'Chat', MessageSquare], ['avisos', `Avisos${S.wa.jefe.length ? ` (${S.wa.jefe.length})` : ''}`, Bell]].map(([k, l, I]) => <button key={k} type="button" role="tab" aria-selected={vista === k} onClick={() => setVista(k)} className={clsx('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition', vista === k ? 'bg-fg text-onfg shadow-[0_0_18px_-6px_rgb(var(--accent-rgb)/0.7)]' : 'text-soft hover:text-fg')}><I className="size-3.5" strokeWidth={1.75} aria-hidden /><span className="max-[400px]:sr-only">{l}</span></button>)}
            </div>
            <div className="relative">
              <button type="button" onClick={() => setMas(!mas)} aria-haspopup="menu" aria-expanded={mas} aria-label="Más opciones" className="grid size-10 place-items-center rounded-xl text-soft transition hover:bg-ink/[0.08] hover:text-fg"><DotsIcon className="size-5" /></button>
              {mas ? (
                <>
                  <button type="button" aria-label="Cerrar el menú" onClick={() => setMas(false)} className="fixed inset-0 z-30 cursor-default" />
                  <div role="menu" className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-2xl bg-night p-1.5 text-[14px] shadow-2xl ring-1 ring-ink/10 animate-pop">
                    {[[SquarePen, 'Nuevo chat', () => { nuevoChat(); setMas(false); }], [Copy, 'Copiar conversación', copiarChat], [Trash2, 'Borrar este chat', () => { nuevoChat(); setMas(false); }]].map(([Icon, label, fn]) => (
                      <button key={label} type="button" role="menuitem" onClick={fn} className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left transition hover:bg-ink/[0.07]"><Icon className="size-4 text-muted" aria-hidden />{label}</button>))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          </header>

          {vista === 'avisos' ? <AvisosHilo mensajes={avisos} onAct={accion} onCopy={copiar} />
            : <ChatHilo mensajes={lista} ocupado={busy} onNuevo={enviar} saludo={msgs[0]?.txt ? String(msgs[0].txt).replace(/\*/g, '') : ''} sugerencias={sug} onAct={accion} onCopy={copiar} votos={votos} onVoto={votar}
                compacto={full} modo={modo} setModo={setModo} estBadge={estBadge} reprobar={reprobar} urlAgente={AGENTS_URL} />}
        </div>
      </section>

    </div>
  );
}
