// Foto de perfil: avatar con tres formas de cambiarla (elegir archivo, arrastrar una imagen o pegarla con Ctrl+V) y un editor
// para encuadrarla (zoom, arrastrar, girar) antes de guardar. Así también funciona donde no se puede abrir el diálogo de archivos.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Camera, RotateCcw, RotateCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { avatarDataUrl, archivoDePegado, cargarImagen, cropRect, initials, panDelta, renderAvatar, ZOOM_MAX } from '../lib/photo.js';
import { textoError } from '../lib/perfil.js';
import { setAvatar, useAvatar } from '../app/avatar.js';
import { Button } from '../ui/index.jsx';

const VISTA = 288; // px del recuadro de edición

function FotoEditor({ img, guardando, onGuardar, onCancelar }) {
  const canvas = useRef(null), caja = useRef(null);
  const [v, setV] = useState({ zoom: 1, dx: 0, dy: 0, quarter: 0 });
  const arrastre = useRef(null);
  const set = (p) => setV((x) => ({ ...x, ...p }));

  useEffect(() => { // dibuja la vista previa cada vez que cambia el encuadre
    const c = canvas.current; if (!c) return;
    c.getContext('2d').drawImage(renderAvatar(img, { ...v, size: VISTA }), 0, 0);
  }, [img, v]);

  useEffect(() => { // Esc cierra; el fondo no se desplaza
    const onKey = (e) => { if (e.key === 'Escape' && !guardando) onCancelar(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    caja.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [guardando, onCancelar]);

  const dims = () => { const w = v.quarter % 2 ? img.h : img.w, h = v.quarter % 2 ? img.w : img.h; return { w, h, ...cropRect(w, h, v.zoom, v.dx, v.dy) }; };
  const mover = (ddx, ddy) => { const d = dims(); set({ dx: Math.max(-1, Math.min(1, v.dx + panDelta(d.w - d.side, d.side, VISTA, ddx))), dy: Math.max(-1, Math.min(1, v.dy + panDelta(d.h - d.side, d.side, VISTA, ddy))) }); };

  const onDown = (e) => { arrastre.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { const a = arrastre.current; if (!a) return; mover(e.clientX - a.x, e.clientY - a.y); arrastre.current = { x: e.clientX, y: e.clientY }; };
  const onUp = () => { arrastre.current = null; };
  const onWheel = (e) => { e.preventDefault(); set({ zoom: Math.min(ZOOM_MAX, Math.max(1, v.zoom + (e.deltaY < 0 ? 0.1 : -0.1))) }); };
  useEffect(() => { // la rueda necesita un listener no pasivo para poder evitar el desplazamiento de la página
    const el = caja.current; if (!el) return undefined;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });
  const onKey = (e) => {
    const paso = 12, m = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
    if (m) { e.preventDefault(); mover(m[0], m[1]); }
    else if (e.key === '+' || e.key === '=') set({ zoom: Math.min(ZOOM_MAX, v.zoom + 0.1) });
    else if (e.key === '-') set({ zoom: Math.max(1, v.zoom - 0.1) });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Ajustar foto de perfil" className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-night/80 p-4 backdrop-blur-sm">
      <div className="glass-strong grid w-full max-w-sm gap-4 p-5 animate-pop">
        <div><h3 className="font-display text-xl">Ajusta tu foto</h3><p className="text-[13px] text-muted">Arrastra para encuadrar. La parte del círculo es la que se verá.</p></div>
        <div ref={caja} tabIndex={0} role="img" aria-label="Vista previa de la foto. Flechas para mover, más y menos para acercar" onKeyDown={onKey}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-full bg-white ring-2 ring-accent/60 outline-none focus-visible:ring-4 active:cursor-grabbing" style={{ width: VISTA, height: VISTA, maxWidth: '100%' }}>
          <canvas ref={canvas} width={VISTA} height={VISTA} className="size-full" />
        </div>
        <div className="flex items-center gap-3">
          <ZoomOut className="size-4 shrink-0 text-muted" aria-hidden />
          <input type="range" min="1" max={ZOOM_MAX} step="0.05" value={v.zoom} onChange={(e) => set({ zoom: +e.target.value })} aria-label="Acercar" className="min-w-0 flex-1 accent-[#e6c97c]" />
          <ZoomIn className="size-4 shrink-0 text-muted" aria-hidden />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => set({ quarter: (v.quarter + 3) % 4, dx: 0, dy: 0 })} aria-label="Girar a la izquierda"><RotateCcw className="size-4" aria-hidden />Izquierda</Button>
          <Button size="sm" variant="ghost" onClick={() => set({ quarter: (v.quarter + 1) % 4, dx: 0, dy: 0 })} aria-label="Girar a la derecha"><RotateCw className="size-4" aria-hidden />Derecha</Button>
          <Button size="sm" variant="ghost" onClick={() => setV({ zoom: 1, dx: 0, dy: 0, quarter: 0 })}>Restablecer</Button>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" loading={guardando} onClick={() => onGuardar(avatarDataUrl(renderAvatar(img, { ...v, size: 256 })))} className="flex-1">Guardar foto</Button>
          <Button variant="ghost" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}

export function FotoPerfil({ client, user, onMsg }) {
  const foto = useAvatar(client, user.id);
  const canPhoto = typeof client.setPhoto === 'function';
  const input = useRef(null);
  const [img, setImg] = useState(null); // imagen elegida, en el editor
  const [ocupada, setOcupada] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [quitando, setQuitando] = useState(false); // pide confirmación antes de borrar

  const abrir = useCallback(async (file) => {
    onMsg(null);
    try { setImg(await cargarImagen(file)); } catch (e) { onMsg({ ok: false, text: e.message }); }
  }, [onMsg]);
  const cerrar = useCallback(() => setImg((x) => { x?.close(); return null; }), []);

  useEffect(() => { // Ctrl+V con una imagen en el portapapeles
    if (!canPhoto) return undefined;
    const onPaste = (e) => { if (img) return; const f = archivoDePegado(e); if (f) { e.preventDefault(); abrir(f); } };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [canPhoto, img, abrir]);

  async function guardar(dataUrl) {
    setOcupada(true); onMsg(null);
    try {
      await client.setPhoto(user.id, dataUrl);
      setAvatar(user.id, await client.getPhoto(user.id));
      cerrar(); onMsg({ ok: true, text: 'Foto actualizada.' });
    } catch (e) { onMsg({ ok: false, text: textoError(e, 'No se pudo guardar la foto.') }); } finally { setOcupada(false); }
  }
  async function quitar() {
    setOcupada(true); onMsg(null);
    try { await client.removePhoto(user.id); setAvatar(user.id, null); setQuitando(false); onMsg({ ok: true, text: 'Foto quitada.' }); }
    catch (e) { onMsg({ ok: false, text: textoError(e, 'No se pudo quitar la foto.') }); } finally { setOcupada(false); }
  }

  const soltar = (e) => { e.preventDefault(); setArrastrando(false); const f = e.dataTransfer?.files?.[0]; if (f) abrir(f); };
  const avatar = (
    <span className="relative grid size-28 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-ok/70 font-display text-4xl text-onfg shadow-[0_0_40px_-8px_rgb(var(--accent-rgb)/0.6)] ring-2 ring-ink/10">
      {foto ? <img src={foto} alt="" className="absolute inset-0 size-full object-cover" /> : initials(user.name || user.email)}
      {canPhoto ? <span aria-hidden className="absolute inset-x-0 bottom-0 grid h-9 place-items-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"><Camera className="size-4" /></span> : null}
    </span>
  );

  return (
    <div className={clsx('grid justify-items-center gap-3 rounded-2xl transition', arrastrando && 'bg-accent/10 ring-2 ring-dashed ring-accent/60')}
      onDragOver={canPhoto ? (e) => { e.preventDefault(); setArrastrando(true); } : undefined} onDragLeave={() => setArrastrando(false)} onDrop={canPhoto ? soltar : undefined}>
      {canPhoto ? (
        <button type="button" onClick={() => input.current?.click()} className="group rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={foto ? 'Cambiar foto de perfil' : 'Subir foto de perfil'}>{avatar}</button>
      ) : avatar}
      {canPhoto ? (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Elegir foto de perfil" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) abrir(f); }} />
          {quitando ? (
            <div role="group" aria-label="Confirmar quitar la foto" className="grid justify-items-center gap-2">
              <p className="text-[13px]">¿Quitar tu foto?</p>
              <div className="flex gap-2"><Button size="sm" variant="danger" loading={ocupada} onClick={quitar}>Sí, quitar</Button><Button size="sm" variant="ghost" onClick={() => setQuitando(false)} disabled={ocupada}>No</Button></div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => input.current?.click()}><Camera className="size-4" strokeWidth={1.75} aria-hidden />{foto ? 'Cambiar foto' : 'Subir foto'}</Button>
              {foto ? <Button size="sm" variant="ghost" onClick={() => setQuitando(true)}><Trash2 className="size-4" strokeWidth={1.75} aria-hidden />Quitar</Button> : null}
            </div>
          )}
          <p className="max-w-[16rem] text-center text-[12px] leading-snug text-muted">{arrastrando ? 'Suelta la imagen aquí' : 'JPG, PNG o WebP. También puedes arrastrar una imagen aquí o pegarla con Ctrl+V.'}</p>
        </>
      ) : <p className="text-center text-[12.5px] text-muted">La foto se guarda en la API del panel.</p>}
      {/* En el <body>: dentro de la tarjeta (backdrop-filter) un elemento fixed se mediría contra ella y no contra la ventana */}
      {img ? createPortal(<FotoEditor img={img} guardando={ocupada} onGuardar={guardar} onCancelar={cerrar} />, document.body) : null}
    </div>
  );
}
