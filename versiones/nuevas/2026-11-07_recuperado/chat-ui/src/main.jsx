/* Chat del taller con assistant-ui (React). Se compila a panelpack/assets/taller-chat.js con `npm run build`.
 * taller.js es la fuente de verdad: guarda los mensajes, decide si responde el agente (agents/ POST /chat) o las reglas locales
 * y avisa los cambios. Este componente solo pinta el hilo con los primitivos de assistant-ui (useExternalStoreRuntime).
 * Puente: window.__taller.chat = { snapshot(), subscribe(fn), send(texto) → Promise, action(act, id), copiado() }. */
import { useSyncExternalStore, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AssistantRuntimeProvider, useExternalStoreRuntime, useAuiState,
  ThreadPrimitive, MessagePrimitive, ComposerPrimitive, ActionBarPrimitive,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import css from './chat.css';

// Las reglas locales escriben al estilo WhatsApp (*negritas*, «• » para listas); se pasa a Markdown.
function aMarkdown(txt, esAgente) {
  if (esAgente) return txt;
  return String(txt)
    .replace(/\*([^*\n]+)\*/g, '**$1**')
    .replace(/^• /gm, '- ')
    .replace(/\n(?!- )/g, '  \n');
}

const Icon = {
  send: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>,
  copy: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>,
  check: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  down: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7" /></svg>,
  bot: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="12" rx="4" /><path d="M12 3v4M9 13h.01M15 13h.01" /></svg>,
  bell: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>,
};

function useBridge(bridge) {
  return useSyncExternalStore(bridge.subscribe, bridge.snapshot, bridge.snapshot);
}

const BridgeCtx = { current: null };

function Markdown() {
  return <MarkdownTextPrimitive className="tlc-md" />;
}

function Hora() {
  const c = useAuiState((s) => s.message.metadata?.custom);
  if (!c) return null;
  return (
    <span className="tlc-time">
      {c.dia ? c.dia + ' · ' : ''}{c.hora}
      {c.agente ? <span className="tlc-badge">{c.agente}</span> : null}
      {c.respaldo ? <span className="tlc-badge warn">respaldo local</span> : null}
    </span>
  );
}

function Botones() {
  const c = useAuiState((s) => s.message.metadata?.custom);
  if (!c || !c.botones || !c.botones.length) return null;
  return (
    <div className="tlc-actions">
      {c.botones.map((b) => (
        <button key={b.act + b.id} type="button" className="tlc-chip" disabled={b.deshabilitado}
          onClick={() => BridgeCtx.current.action(b.act, b.id)}>{b.texto}</button>
      ))}
    </div>
  );
}

function Escribiendo() {
  const vacio = useAuiState((s) => s.message.status?.type === 'running' && !s.message.content.some((p) => p.type === 'text' && p.text));
  if (!vacio) return null;
  return <div className="tlc-typing" aria-label="Escribiendo"><i /><i /><i /></div>;
}

function AssistantMessage({ icono = Icon.bot }) {
  return (
    <MessagePrimitive.Root className="tlc-msg tlc-asst">
      <span className="tlc-av" aria-hidden="true">{icono}</span>
      <div className="tlc-col">
        <div className="tlc-asst-body">
          <MessagePrimitive.Parts components={{ Text: Markdown }} />
          <Escribiendo />
        </div>
        <Botones />
        <div className="tlc-foot">
          <Hora />
          <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" autohideFloat="single-branch" className="tlc-actionbar">
            <ActionBarPrimitive.Copy className="tlc-icon" title="Copiar" onClick={() => BridgeCtx.current.copiado()}>
              <MessagePrimitive.If copied>{Icon.check}</MessagePrimitive.If>
              <MessagePrimitive.If copied={false}>{Icon.copy}</MessagePrimitive.If>
            </ActionBarPrimitive.Copy>
          </ActionBarPrimitive.Root>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="tlc-msg tlc-user">
      <div className="tlc-col">
        <div className="tlc-user-body"><MessagePrimitive.Parts /></div>
        <div className="tlc-foot end"><Hora /></div>
      </div>
    </MessagePrimitive.Root>
  );
}

function Bienvenida({ s }) {
  return (
    <div className="tlc-welcome">
      <span className="tlc-av big" aria-hidden="true">{Icon.bot}</span>
      <h4>Hola, {s.operador.split(' ')[0]}</h4>
      <p>Cuéntame tu jornada, tus cargas de diésel o cualquier falla del {s.eco}.</p>
    </div>
  );
}

function Sugerencias({ s }) {
  return (
    <div className="tlc-suggest" aria-label="Sugerencias">
      {s.sugerencias.map((x) => (
        <ThreadPrimitive.Suggestion key={x.titulo} prompt={x.texto} send className="tlc-sug" disabled={s.ocupado}>
          <b>{x.titulo}</b><span>{x.nota}</span>
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  );
}

function Thread({ s }) {
  const estado = s.modo === 'agente' ? ['Agente', 'ok'] : s.agente === 'en-linea' ? ['Reglas locales', 'info'] : ['Reglas locales', 'info'];
  return (
    <ThreadPrimitive.Root className="tlc">
      <header className="tlc-head">
        <span className="tlc-av" aria-hidden="true">{Icon.bot}</span>
        <div className="tlc-head-txt">
          <b>Asistente del taller</b>
          <span>{s.operador} · {s.eco}</span>
        </div>
        <span className={'tlc-status ' + estado[1]}><i />{estado[0]}</span>
      </header>
      <ThreadPrimitive.Viewport className="tlc-viewport">
        <ThreadPrimitive.Empty><Bienvenida s={s} /></ThreadPrimitive.Empty>
        <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        <ThreadPrimitive.ViewportFooter className="tlc-footer">
          <ThreadPrimitive.ScrollToBottom className="tlc-tobottom" title="Ir al final">{Icon.down}</ThreadPrimitive.ScrollToBottom>
          <Sugerencias s={s} />
          <ComposerPrimitive.Root className="tlc-composer">
            <ComposerPrimitive.Input className="tlc-input" placeholder="Escribe un mensaje…" rows={1} autoFocus={false} submitMode="enter" aria-label="Mensaje" />
            <ComposerPrimitive.Send className="tlc-send" title="Enviar">{Icon.send}</ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
          <p className="tlc-note">{s.modo === 'agente' ? 'Responde el agente del servicio agents/.' : 'Responden las reglas del taller: registran y abren OTs al momento.'} Enter envía · Shift+Enter, nueva línea.</p>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

function App({ bridge }) {
  BridgeCtx.current = bridge;
  const s = useBridge(bridge);
  const convertMessage = useCallback((m) => ({
    id: m.id,
    role: m.rol,
    content: [{ type: 'text', text: m.rol === 'assistant' ? aMarkdown(m.texto, !!m.agente) : m.texto }],
    createdAt: new Date(m.fecha),
    metadata: { custom: { hora: m.hora, dia: m.dia, agente: m.agente, respaldo: m.respaldo, botones: m.botones } },
  }), []);
  const runtime = useExternalStoreRuntime({
    messages: s.mensajes,
    isRunning: s.ocupado,
    convertMessage,
    onNew: async (msg) => {
      const texto = msg.content.filter((p) => p.type === 'text').map((p) => p.text).join('\n').trim();
      if (texto) await bridge.send(texto);
    },
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread s={s} />
    </AssistantRuntimeProvider>
  );
}

// Avisos al jefe de taller: hilo de solo lectura (sin compositor). Los botones aprueban compras, registran llegadas o abren la OT.
const AvisoMessage = () => <AssistantMessage icono={Icon.bell} />;
const NoUser = () => null;
function AvisosApp({ bridge }) {
  BridgeCtx.current = bridge;
  const s = useSyncExternalStore(bridge.subscribe, bridge.avisos, bridge.avisos);
  const convertMessage = useCallback((m) => ({
    id: m.id, role: 'assistant', content: [{ type: 'text', text: aMarkdown(m.texto, false) }], createdAt: new Date(m.fecha),
    status: { type: 'complete', reason: 'stop' },
    metadata: { custom: { hora: m.hora, dia: m.dia, botones: m.botones } },
  }), []);
  const runtime = useExternalStoreRuntime({ messages: s.mensajes, isRunning: false, isDisabled: true, convertMessage, onNew: async () => {} });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="tlc tlc-avisos">
        <header className="tlc-head">
          <span className="tlc-av" aria-hidden="true">{Icon.bell}</span>
          <div className="tlc-head-txt"><b>Avisos del taller</b><span>{s.jefe} · Jefe de taller</span></div>
          {s.pendientes ? <span className="tlc-status warn"><i />{s.pendientes} por aprobar</span> : <span className="tlc-status ok"><i />Al día</span>}
        </header>
        <ThreadPrimitive.Viewport className="tlc-viewport">
          <ThreadPrimitive.Empty>
            <div className="tlc-welcome"><span className="tlc-av big" aria-hidden="true">{Icon.bell}</span><h4>Sin avisos</h4><p>Aquí llegan fallas, servicios por vencer y compras por aprobar.</p></div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage: NoUser, AssistantMessage: AvisoMessage }} />
          <ThreadPrimitive.ViewportFooter className="tlc-footer">
            <ThreadPrimitive.ScrollToBottom className="tlc-tobottom" title="Ir al final">{Icon.down}</ThreadPrimitive.ScrollToBottom>
            <p className="tlc-note">Lo que le llega al jefe de taller, sin que nadie lo capture.</p>
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

let estilos = false;
function ponerEstilos() {
  if (estilos) return;
  const st = document.createElement('style'); st.dataset.tallerChat = ''; st.textContent = css; document.head.appendChild(st); estilos = true;
}
window.__tallerChat = {
  version: '1.1.0',
  mount(el, bridge) {
    ponerEstilos();
    const root = createRoot(el);
    root.render(<App bridge={bridge} />);
    return root;
  },
  mountAvisos(el, bridge) {
    ponerEstilos();
    const root = createRoot(el);
    root.render(<AvisosApp bridge={bridge} />);
    return root;
  },
};
