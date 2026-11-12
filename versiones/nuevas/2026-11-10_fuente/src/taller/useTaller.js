// Puente entre la lógica del Taller (estado mutable en logic.js) y React.
// `mutate(fn)` ejecuta un cambio, lo guarda en localStorage y vuelve a pintar a todos los suscriptores.
import { useSyncExternalStore } from 'react';
import * as L from './logic.js';

let version = 0, loaded = false;
const subs = new Set();
let toastMsg = null, toastTimer;

function ensure() { if (!loaded) { L.load(); loaded = true; } }
function emit() { version++; subs.forEach((f) => f()); }

L.hooks.toast = (msg) => {
  toastMsg = msg; emit();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg = null; emit(); }, 3200);
};

// Solo lectura (rol admin en la pantalla ERP): cualquier captura del usuario se ignora y se avisa.
// `sistema: true` es para sincronizaciones internas (horómetro desde Traccar), que no son captura de una persona.
let soloLectura = false;
export function setSoloLectura(v) { soloLectura = !!v; emit(); }
export const esLectura = () => soloLectura;

export function mutate(fn, { sistema = false } = {}) {
  ensure();
  if (soloLectura && !sistema) { L.hooks.toast('Solo lectura: tu rol no puede modificar datos.'); return undefined; }
  const r = fn(L);
  L.save();
  emit();
  return r;
}
export function resetDemo() { ensure(); if (soloLectura) { L.hooks.toast('Solo lectura: tu rol no puede modificar datos.'); return; } L.setState(L.seed()); L.save(); emit(); }

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export function useTaller() {
  ensure();
  useSyncExternalStore(subscribe, () => version, () => 0);
  return L;
}
export function useToast() { return useSyncExternalStore(subscribe, () => toastMsg, () => null); }
