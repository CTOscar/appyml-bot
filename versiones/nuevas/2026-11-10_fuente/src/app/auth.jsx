// Sesión del panel: un solo cliente de datos (API del panel + Traccar/simulado) y el usuario actual.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '../api/index.js';
import { limpiarAvatares } from './avatar.js';

const AuthCtx = createContext(null);

// Requisitos de contraseña del registro (los mismos que el panel actual).
export const PW_RULES = [
  [/.{8,}/, 'Al menos 8 caracteres'],
  [/[A-ZÑ]/, 'Una mayúscula'],
  [/[a-zñ]/, 'Una minúscula'],
  [/\d/, 'Un número'],
  [/[^A-Za-z0-9ñÑ\s]/, 'Un símbolo'],
];
export const passwordOk = (p) => PW_RULES.every(([re]) => re.test(p || ''));

export function AuthProvider({ children, client: injected }) {
  const client = useMemo(() => injected || createClient(), [injected]);
  const [user, setUser] = useState(undefined); // undefined = revisando; null = sin sesión

  useEffect(() => {
    let vivo = true;
    client.getSession().then((u) => vivo && setUser(u || null), () => vivo && setUser(null));
    return () => { vivo = false; };
  }, [client]);

  const login = useCallback(async (email, password, remember) => { const u = await client.login(email, password, remember); setUser(u); return u; }, [client]);
  const register = useCallback(async (data) => { await client.register(data); return login(data.email, data.password, true); }, [client, login]);
  const logout = useCallback(async () => { try { await client.logout(); } finally { limpiarAvatares(); setUser(null); } }, [client]);

  const value = useMemo(() => ({ client, user, setUser, login, register, logout }), [client, user, login, register, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
}
