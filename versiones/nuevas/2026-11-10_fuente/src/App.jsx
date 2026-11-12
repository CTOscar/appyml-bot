// Raíz: sin sesión → acceso; con sesión → barra superior flotante + página según el hash.
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './app/auth.jsx';
import { useRoute } from './app/router.js';
import { useReveal } from './app/useReveal.js';
import { TopBar } from './layout/TopBar.jsx';
import { Footer } from './layout/Footer.jsx';
import { Cosmos } from './layout/Cosmos.jsx';
import { Next } from './layout/Next.jsx';
import { Spinner } from './ui/index.jsx';
import { Login } from './pages/Login.jsx';
import { Home } from './pages/Home.jsx';
import { Pending } from './pages/Pending.jsx';
import { MapPage } from './pages/MapPage.jsx';
import { Search } from './pages/Search.jsx';
import { FleetProvider } from './fleet/FleetProvider.jsx';
import { Tractores } from './pages/Tractores.jsx';
import { Lotes } from './pages/Lotes.jsx';
import { Alertas } from './pages/Alertas.jsx';
import { Reportes } from './pages/Reportes.jsx';
import { Costeo } from './pages/Costeo.jsx';
import { Informes } from './pages/Informes.jsx';
import { Enlaces } from './pages/Enlaces.jsx';
import { Status } from './pages/Status.jsx';
import { Perfil } from './pages/Perfil.jsx';
import { Taller } from './pages/Taller.jsx';
import { Ajustes } from './pages/Ajustes.jsx';
import { Accounts } from './pages/Accounts.jsx';
import { Aplicaciones } from './pages/Aplicaciones.jsx';
import { CuentaPendiente } from './pages/CuentaPendiente.jsx';
import { vistaDe } from './lib/roles.js';
import { ErpApp } from './erp/ErpApp.jsx';

const TITLES = { '/': 'Inicio' };

function Page({ path, route }) {
  if (path === '/') return <Home />;
  if (path === '/buscar') return <Search />;
  if (path === '/tractores') return <Tractores />;
  if (path === '/lotes') return <Lotes />;
  if (path === '/alertas') return <Alertas />;
  if (path === '/reportes') return <Reportes />;
  if (path === '/costeo') return <Costeo />;
  if (path === '/informes') return <Informes />;
  if (path === '/enlaces') return <Enlaces route={route} />;
  if (path === '/status') return <Status />;
  if (path === '/perfil') return <Perfil />;
  if (path === '/ajustes') return <Ajustes />;
  if (path === '/taller') return <Taller route={route} />;
  if (path === '/accounts') return <Accounts />;
  if (path === '/apps') return <Aplicaciones />;
  return <Pending path={path} />;
}

function Shell() {
  const { user, client, setUser, logout } = useAuth();
  const route = useRoute();
  const { path } = route;
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  // Sin sesión o en el mapa no hay contenedor; useReveal lo ignora. Se espera a que la página pinte.
  useReveal('#contenido > div', path);
  // Qué pantalla le toca a cada cuenta (lib/roles.js): 'panel' (super administrador), 'erp' (admin de solo lectura y jefe de taller),
  // 'bot' (operador, se le manda a /bot/) o 'pendiente' (cuenta sin rol asignado).
  const vista = vistaDe(user);
  useEffect(() => { if (vista !== 'erp') document.title = `${TITLES[path] || path.slice(1).replace(/^./, (c) => c.toUpperCase())} · Panel de Flota`; }, [path, vista]);

  const alBot = vista === 'bot';
  useEffect(() => { if (alBot) { try { window.location.replace('/bot/'); } catch { /* sin navegador real (pruebas) */ } } }, [alBot]);

  if (user === undefined) return (<><Cosmos /><Spinner label="Abriendo el panel…" /></>);
  if (!user) return <Login />;
  if (vista === 'pendiente') return <CuentaPendiente user={user} onSalir={logout} onRevisar={async () => { const u = await client.getSession(); setUser(u || null); return u; }} />;
  if (alBot) return (<><Cosmos /><Spinner label="Abriendo el bot…" /></>);
  if (vista === 'erp') return <FleetProvider><ErpApp /></FleetProvider>;
  return (
    <FleetProvider>
      <div className="relative min-h-dvh overflow-x-clip">
        <a href="#contenido" onClick={(e) => { e.preventDefault(); document.getElementById('contenido')?.focus(); }} className="skip-link">Saltar al contenido</a>
        {path === '/mapa' ? <MapPage /> : (
          <>
            <Cosmos />
            <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-[1760px] px-3 pb-[max(4rem,env(safe-area-inset-bottom))] pt-24 outline-none sm:px-4 sm:pt-28 lg:px-6 2xl:px-10">
              <Page path={path} route={route} />
              <Next path={path} />
            </main>
            <Footer />
          </>
        )}
        <button type="button" onClick={() => { const m = document.getElementById('contenido'); m?.focus(); m?.scrollIntoView(); }}
          className="sr-only fixed left-3 top-3 z-[60] rounded-xl bg-fg px-4 py-2 text-sm font-medium text-onfg focus:not-sr-only">Saltar al contenido</button>
        <TopBar />
      </div>
    </FleetProvider>
  );
}

export function App({ client }) {
  return <AuthProvider client={client}><Shell /></AuthProvider>;
}
