// Una sola instancia del estado en vivo mientras hay sesión; los componentes la leen con useFleet().
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../app/auth.jsx';
import { createFleetStore } from './store.js';

const Ctx = createContext(null);

export function FleetProvider({ children }) {
  const { client } = useAuth();
  const store = useMemo(() => createFleetStore(client), [client]);
  useEffect(() => { store.start(); return () => store.stop(); }, [store]);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

// Devuelve { store, snap }: snap cambia en cada actualización en vivo (se vuelve a dibujar quien lo use).
export function useFleet() {
  const store = useContext(Ctx);
  if (!store) throw new Error('useFleet fuera de FleetProvider');
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { store, snap };
}
