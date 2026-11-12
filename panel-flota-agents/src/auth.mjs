import { createHash } from 'node:crypto';

const TTL_MS = 15_000;
const cache = new Map();

const readCookie = (header, name) => {
  const m = String(header || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
};

// Valida la sesión contra panel-flota-api (GET /session) reenviando la cookie.
// El rol del navegador no cuenta: solo lo que responde la API del panel.
export async function sessionUser(req, { panelApiUrl, sessionCookie }, fetchImpl = fetch) {
  const token = readCookie(req.headers.cookie, sessionCookie);
  if (!token) return null;
  const key = createHash('sha256').update(token).digest('hex');
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.user;

  let res;
  try {
    res = await fetchImpl(`${panelApiUrl}/session`, { headers: { cookie: `${sessionCookie}=${token}` } });
  } catch (e) {
    console.error('[auth] no se pudo contactar la API del panel:', e.message);
    return null;
  }
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  cache.set(key, { user, exp: Date.now() + TTL_MS });
  if (cache.size > 500) for (const [k, v] of cache) if (v.exp < Date.now()) cache.delete(k);
  return user;
}

export const _clearAuthCache = () => cache.clear();
