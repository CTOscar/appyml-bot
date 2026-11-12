// Aparición suave de las secciones al entrar en pantalla. Marca los hijos directos del contenedor de la página
// threshold 0: una página muy alta (el Inicio mide 17 000 px) nunca llegaría al 5 % visible en un celular y quedaría invisible.
// (y las filas de las rejillas con data-stagger) con .pf-reveal; al verse reciben .pf-in. Sin IntersectionObserver no hace nada.
import { useEffect } from 'react';

export function useReveal(rootSel, dep) {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const root = document.querySelector(rootSel);
    if (!root) return undefined;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('pf-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    const els = [...root.children].filter((el) => el.tagName !== 'HEADER');
    els.forEach((el, i) => { el.classList.add('pf-reveal'); el.style.setProperty('--rv-d', `${Math.min(i, 3) * 60}ms`); io.observe(el); });
    return () => { io.disconnect(); els.forEach((el) => el.classList.remove('pf-reveal', 'pf-in')); };
  }, [rootSel, dep]);
}
