// Agente agrícola (asistente del taller) como app instalable (PWA) sin el resto del panel: chat al estilo ChatGPT / DeepSeek con assistant-ui.
// Reusa la pantalla de Automatización (misma lógica, mismos datos locales) a pantalla completa, y le suma instalación, modo sin conexión y avisos de versión.
import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, RefreshCw, Share, WifiOff, X } from 'lucide-react';
import { Automatizacion } from '../taller/Automatizacion.jsx';
import { createClient } from '../api/index.js';
import { Cosmos } from '../layout/Cosmos.jsx';
import { CuentaBoton, CuentaDialogo, CuentaTarjeta, useCuenta } from './BotCuenta.jsx';
import { mutate, useTaller, useToast } from '../taller/useTaller.js';
import { esNativo } from './nativo.js';
import { CuentaPendiente } from '../pages/CuentaPendiente.jsx';
import { esPendiente, puedePanel } from '../lib/roles.js';

const PANEL = '/'; // el panel completo vive en la raíz del mismo sitio

// beforeinstallprompt (Chrome, Edge, Android): se guarda para lanzarlo desde nuestro botón. iOS no lo tiene: se explica cómo agregarla.
function useInstalar() {
  const [ev, setEv] = useState(null);
  const [hecho, setHecho] = useState(() => esNativo() || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true); // dentro de una app ya está instalada
  useEffect(() => {
    const a = (e) => { e.preventDefault(); setEv(e); }, b = () => { setHecho(true); setEv(null); };
    window.addEventListener('beforeinstallprompt', a); window.addEventListener('appinstalled', b);
    return () => { window.removeEventListener('beforeinstallprompt', a); window.removeEventListener('appinstalled', b); };
  }, []);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !hecho;
  return { puede: !!ev, ios, hecho, instalar: async () => { if (!ev) return; ev.prompt(); await ev.userChoice.catch(() => {}); setEv(null); } };
}

function useEnLinea() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => { const f = () => setOn(navigator.onLine); window.addEventListener('online', f); window.addEventListener('offline', f); return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f); }; }, []);
  return on;
}

// Registra el service worker y avisa cuando hay una versión nueva esperando; al aceptar, se activa y se recarga una sola vez.
function useActualizacion() {
  const [espera, setEspera] = useState(null);
  const pedida = useRef(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV || esNativo()) return undefined; // en la app instalada los archivos ya van dentro
    navigator.serviceWorker.register('/bot/sw.js', { scope: '/bot/' }).then((reg) => {
      const vigila = (w) => w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) setEspera(w); });
      if (reg.waiting && navigator.serviceWorker.controller) setEspera(reg.waiting);
      reg.addEventListener('updatefound', () => vigila(reg.installing));
    }).catch(() => {});
    const cambio = () => { if (pedida.current) location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', cambio);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', cambio);
  }, []);
  return [espera, () => { pedida.current = true; espera?.postMessage('saltar-espera'); }];
}

export function BotApp() {
  useTaller();
  const toast = useToast();
  const inst = useInstalar();
  const enLinea = useEnLinea();
  const [espera, actualizar] = useActualizacion();
  const [guia, setGuia] = useState(false);
  const [client] = useState(() => createClient());
  const cuenta = useCuenta(client);
  const [dlg, setDlg] = useState(() => (new URLSearchParams(location.search).get('auth_error') ? 'entrar' : null)); // null | 'entrar' | 'perfil'
  const q = new URLSearchParams(location.search);
  const pendiente = esPendiente(cuenta.user);
  // Es una aplicación a pantalla completa: el que se mueve es el chat, no la página (evita la barra de desplazamiento sobrante).
  useEffect(() => { const h = document.documentElement; const antes = h.style.overflow; h.style.overflow = 'hidden'; return () => { h.style.overflow = antes; }; }, []);
  const veElPanel = !cuenta.user || puedePanel(cuenta.user); // el panel completo es solo del administrador; sin sesión no se esconde el enlace

  // Atajos del ícono (manifest.shortcuts): ?nuevo=1 abre un chat limpio; ?vista=avisos abre los avisos.
  useEffect(() => {
    if (q.get('nuevo') === '1') { mutate((L) => { const op = L.state().wa.op; delete L.state().wa.chats[op]; delete L.state().wa.espera[op]; }); history.replaceState(null, '', '/bot/'); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const extra = (
    <div className="grid shrink-0 gap-2 border-t border-ink/10 pt-3">
      <CuentaTarjeta cuenta={cuenta} onAbrir={(m) => { setDlg(m); }} />
      {!inst.hecho && (inst.puede || inst.ios) ? (
        <button type="button" onClick={inst.puede ? inst.instalar : () => setGuia(true)} className="flex h-10 items-center gap-2.5 rounded-xl bg-accent/15 px-3 text-[14px] text-accent transition hover:bg-accent/25">
          <Download className="size-4" strokeWidth={1.75} aria-hidden />Instalar la app
        </button>
      ) : null}
      {veElPanel ? <a href={PANEL} className="flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13.5px] text-muted transition hover:bg-ink/[0.05] hover:text-fg"><ExternalLink className="size-4" strokeWidth={1.75} aria-hidden />Abrir el panel de flota</a> : null}
    </div>
  );

  // Cuenta sin rol asignado: no ve el bot hasta que un administrador se lo asigne.
  if (pendiente) return <CuentaPendiente user={cuenta.user} onSalir={cuenta.logout} onRevisar={async () => { const u = await client.getSession?.(); cuenta.setUser(u || null); return u; }} />;

  return (
    <>
      {!enLinea ? <div role="status" className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-warn px-3 py-1 pt-[max(0.25rem,env(safe-area-inset-top))] text-[12.5px] font-medium text-black"><WifiOff className="size-3.5" aria-hidden />Sin conexión: respondo con las reglas locales del taller.</div> : null}
      <Cosmos planet />
      {/* Adaptable: celular (<520 px, o cualquier pantalla de menos de 520 px de alto como un celular en horizontal) = pantalla completa · tableta (520–1023 px) = tarjeta centrada · escritorio (≥1024 px) = ventana completa, sin tarjeta ni márgenes, con barra lateral fija (como ChatGPT o DeepSeek) */}
      <div className="mx-auto h-dvh w-full overflow-hidden pt-[env(safe-area-inset-top)] min-[520px]:my-4 min-[520px]:h-[calc(100dvh-2rem)] min-[520px]:max-w-[34rem] min-[520px]:rounded-[2rem] min-[520px]:pt-0 min-[520px]:shadow-[0_0_0_1px_rgb(var(--ink-rgb)/0.12),0_40px_120px_-30px_rgb(var(--accent-strong-rgb)/0.45)] lg:my-0 lg:h-dvh lg:max-w-none lg:rounded-none lg:shadow-none [@media(max-height:520px)]:!my-0 [@media(max-height:520px)]:!h-dvh [@media(max-height:520px)]:!max-w-none [@media(max-height:520px)]:!rounded-none [@media(max-height:520px)]:!shadow-none">
      <Automatizacion full sidebarExtra={extra} vistaInicial={q.get('vista') === 'avisos' ? 'avisos' : 'chat'} headerRight={<span className="max-sm:hidden"><CuentaBoton cuenta={cuenta} onAbrir={setDlg} /></span>} onVerOt={(id) => { if (veElPanel) location.href = `${PANEL}#/taller/ordenes?ot=${id}`; }} />
      </div>
      {espera ? (
        <div role="alert" className="fixed bottom-4 left-1/2 z-[70] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-fg px-4 py-2.5 text-sm text-onfg shadow-xl">
          Hay una versión nueva.<button type="button" onClick={actualizar} className="inline-flex items-center gap-1 font-medium underline"><RefreshCw className="size-3.5" aria-hidden />Actualizar</button>
        </div>
      ) : toast ? <div role="status" className="fixed bottom-4 left-1/2 z-[60] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-fg px-4 py-2.5 text-sm text-onfg shadow-xl">{toast}</div> : null}
      {dlg ? <CuentaDialogo cuenta={cuenta} modo={dlg} onCerrar={() => setDlg(null)} /> : null}
      {guia ? (
        <div role="dialog" aria-modal="true" aria-label="Instalar en iPhone" className="fixed inset-0 z-[80] grid place-items-end bg-black/60 p-4 sm:place-items-center" onClick={() => setGuia(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-night p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3"><h2 className="font-display text-xl">Instalar en iPhone</h2><button type="button" onClick={() => setGuia(false)} aria-label="Cerrar" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/10"><X className="size-4" /></button></div>
            <ol className="mt-3 grid list-decimal gap-2 pl-5 text-[14.5px] text-soft"><li>Abre esta página en <b>Safari</b>.</li><li>Toca <Share className="inline size-4" aria-label="Compartir" /> <b>Compartir</b>.</li><li>Elige <b>Agregar a pantalla de inicio</b>.</li></ol>
          </div>
        </div>
      ) : null}
    </>
  );
}
