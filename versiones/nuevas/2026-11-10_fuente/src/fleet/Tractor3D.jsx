// Vista 3D del tractor y de su instalación (rastreador, sonda, conexión D+ o CAN según el nivel A/B). Reusa el módulo de escena del panel viejo
// (src/vendor/tractorScene.js, Three.js ya empaquetado), que se carga como trozo aparte solo al abrir esta vista.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { Button } from '../ui/index.jsx';

export function Tractor3D({ device, onClose }) {
  const stage = useRef(null), scene = useRef(null);
  const [msg, setMsg] = useState('Cargando escena 3D…');
  const [comps, setComps] = useState([]);
  const [sel, setSel] = useState(null);
  const [eng, setEng] = useState(false);
  const [xray, setXray] = useState(true);
  const nivel = device?.attributes?.nivel || 'A';

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const mod = await import('../vendor/tractorScene.js');
        if (!vivo || !stage.current) return;
        scene.current = mod.mountTractorScene(stage.current, { nivel, onSelect: (id) => setSel(id) });
        setComps(scene.current.components); setMsg('');
      } catch (e) {
        console.error(e);
        if (vivo) setMsg('No se pudo iniciar la vista 3D en este navegador. Prueba con otro navegador o activa la aceleración por hardware.');
      }
    })();
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => { vivo = false; window.removeEventListener('keydown', esc); scene.current?.dispose(); scene.current = null; };
  }, [nivel, onClose]);

  const c = comps.find((x) => x.id === sel);
  const toggleEng = () => { const v = !eng; setEng(v); scene.current?.setEngine(v); };
  const toggleX = () => { const v = !xray; setXray(v); scene.current?.setXray(v); };
  const pick = (id) => { setSel(id); scene.current?.select(id); };

  // Portal al <body>: dentro del panel lateral (con filtro de cristal) un «fixed» se recortaría al tamaño del panel.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="t3d-t" className="fixed inset-0 z-[600] grid place-items-center bg-black/70 p-2 sm:p-4" onClick={onClose}>
      <div className="glass-strong flex max-h-[96dvh] w-[min(1120px,100%)] flex-col overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-ink/10 px-4 py-3">
          <div className="min-w-0"><p className="text-[11px] uppercase tracking-[0.14em] text-accent">Instalación · nivel {nivel}</p><h2 id="t3d-t" className="truncate font-display text-xl">{device ? `${device.name} en 3D` : 'Tractor en 3D'}</h2></div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto grid size-9 place-items-center rounded-xl text-muted hover:bg-ink/10 hover:text-fg"><X className="size-5" /></button>
        </div>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_300px]">
          <div ref={stage} className="relative h-[52dvh] overflow-hidden bg-night md:h-[70dvh]">
            {msg ? <div role="status" className="absolute inset-0 grid place-items-center p-6 text-center text-[14px] text-muted">{msg}</div> : null}
          </div>
          <div className="grid content-start gap-3 border-t border-ink/10 p-4 md:overflow-y-auto md:border-l md:border-t-0">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" aria-pressed={eng} onClick={toggleEng}>{eng ? 'Apagar motor' : 'Encender motor'}</Button>
              <Button size="sm" aria-pressed={xray} onClick={toggleX} variant={xray ? 'primary' : 'glass'}>Rayos X</Button>
              <Button size="sm" onClick={() => { scene.current?.home(); setSel(null); }}>Vista general</Button>
            </div>
            <ol className="grid gap-0.5">
              {comps.map((m, i) => (
                <li key={m.id}><button type="button" onClick={() => pick(m.id)} aria-current={sel === m.id} className={clsx('grid w-full grid-cols-[24px_1fr] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] transition hover:bg-ink/[0.06]', sel === m.id && 'bg-ink/[0.1]')}>
                  <span className="grid size-6 place-items-center rounded-full border border-accent font-mono text-[11px] text-accent">{i + 1}</span>{m.n}</button></li>
              ))}
            </ol>
            <div className="grid gap-1.5 border-t border-ink/10 pt-3" aria-live="polite">
              {c ? <><span className="font-mono text-[11px] uppercase tracking-widest text-accent">{c.tag}</span><h3 className="font-display text-2xl leading-tight">{c.n}</h3><p className="text-[14px] text-soft">{c.d}</p><p className="font-mono text-xs text-muted">{c.c}</p></>
                : <p className="text-[14px] text-muted">Toca un número en la escena o en la lista para ver cada pieza.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
