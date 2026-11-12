// Foto de perfil compartida: la barra superior y «Mi perfil» leen la misma, así que al cambiarla se actualizan las dos.
// Cada foto se pide a la API una sola vez por cuenta y se guarda como URL de objeto (blob:).
import { useEffect, useSyncExternalStore } from 'react';

const urls = new Map(); // id -> blob:…
const pedidos = new Set(); // ids ya consultados
const subs = new Set();
let ver = 0;
const emit = () => { ver++; subs.forEach((f) => f()); };
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
const soltar = (u) => { if (u && u.startsWith('blob:')) URL.revokeObjectURL(u); };

/** Fija (o quita, con null) la foto de una cuenta, p. ej. justo después de subirla. */
export function setAvatar(id, url) {
  const k = String(id);
  const antes = urls.get(k);
  if (antes && antes !== url) soltar(antes);
  if (url) urls.set(k, url); else urls.delete(k);
  pedidos.add(k);
  emit();
}

/** Olvida todas las fotos (al cerrar sesión). */
export function limpiarAvatares() {
  urls.forEach(soltar); urls.clear(); pedidos.clear(); emit();
}

/** URL de la foto de la cuenta `userId` o null. La primera vez la pide con client.getPhoto. */
export function useAvatar(client, userId) {
  useSyncExternalStore(subscribe, () => ver, () => 0);
  useEffect(() => {
    const k = String(userId);
    if (!userId || pedidos.has(k) || typeof client?.getPhoto !== 'function') return;
    pedidos.add(k);
    Promise.resolve(client.getPhoto(userId)).then((u) => { if (u) { urls.set(k, u); emit(); } }, () => { pedidos.delete(k); });
  }, [client, userId]);
  return urls.get(String(userId)) || null;
}
