// Taller: pestañas Tablero · Órdenes · Almacén · Costos y KPIs · Automatización (ruta #/taller/<pestaña>).
import { useEffect } from 'react';
import { RotateCcw, Wrench } from 'lucide-react';
import { navigate } from '../app/router.js';
import { PageHeader, Pills, Empty } from '../ui/page.jsx';
import { Ordenes } from '../taller/Ordenes.jsx';
import { Tablero } from '../taller/Tablero.jsx';
import { Almacen } from '../taller/Almacen.jsx';
import { Kpis } from '../taller/Kpis.jsx';
import { Automatizacion } from '../taller/Automatizacion.jsx';
import { useToast, useTaller, resetDemo, esLectura } from '../taller/useTaller.js';
import { Button } from '../ui/index.jsx';
import { useFleet } from '../fleet/FleetProvider.jsx';
import { vincularPorModelo } from '../taller/vincular.js';
import { config } from '../config.js';
import { mutate } from '../taller/useTaller.js';

const TABS = [['tablero', 'Tablero'], ['ordenes', 'Órdenes de trabajo'], ['almacen', 'Almacén'], ['kpis', 'Costos y KPIs'], ['auto', 'Automatización']];

// `tabs` (opcional) limita las pestañas visibles, p. ej. la pantalla ERP no muestra Automatización (eso es del bot).
export function Taller({ route, tabs: tabsVisibles }) {
  useTaller();
  const lectura = esLectura();
  const TABS_VISIBLES = tabsVisibles ? TABS.filter((t) => tabsVisibles.includes(t[0])) : TABS;
  const { snap } = useFleet();
  // Horómetro desde Traccar: se entrega la flota en vivo a la lógica del taller y se sincronizan las horas de los equipos vinculados.
  useEffect(() => { mutate((L) => { L.setGpsSource({ devices: snap.devices, positions: snap.positions }); if (!config.useMock) vincularPorModelo(L, snap.devices); /* con datos simulados el horómetro es inventado: se vincula a mano */ L.syncGps(); }, { sistema: true }); }, [snap]);
  const toast = useToast();
  const tab = TABS_VISIBLES.some((t) => t[0] === route.rest[0]) ? route.rest[0] : TABS_VISIBLES[0][0];
  const go = (t, q = '') => navigate(`/taller/${t}${q}`);

  return (
    <div>
      {/* En Automatización el chat ocupa toda la altura: el encabezado se compacta en una sola fila con las pestañas */}
      {tab === 'auto' ? (
        <div className="-mt-6 mb-3 flex items-center justify-between gap-2 max-sm:-mx-1">
          <Pills label="Secciones del taller" options={TABS_VISIBLES} value={tab} onChange={(t) => go(t)} className="min-w-0" />
          {lectura ? null : <Button size="sm" variant="glass" onClick={() => { if (confirm('¿Reiniciar el taller con los datos de ejemplo? Se pierde lo capturado.')) resetDemo(); }}><RotateCcw className="size-3.5" aria-hidden />Reiniciar demo</Button>}
        </div>
      ) : (
        <>
          <PageHeader title="Taller" subtitle="Órdenes de trabajo, refacciones y mano de obra de los tractores del piloto. Datos de ejemplo guardados en este navegador.">
            {lectura ? null : <Button size="sm" variant="glass" onClick={() => { if (confirm('¿Reiniciar el taller con los datos de ejemplo? Se pierde lo capturado.')) resetDemo(); }}><RotateCcw className="size-3.5" aria-hidden />Reiniciar demo</Button>}
          </PageHeader>
          <Pills label="Secciones del taller" options={TABS_VISIBLES} value={tab} onChange={(t) => go(t)} className="mb-6" />
        </>
      )}
      {tab === 'tablero' ? <Tablero onOrden={() => go('ordenes')} />
        : tab === 'almacen' ? <Almacen />
        : tab === 'kpis' ? <Kpis />
        : tab === 'auto' ? <Automatizacion />
        : tab === 'ordenes' ? <Ordenes sel={route.query.ot} onSel={(id) => go('ordenes', `?ot=${id}`)} />
        : <Empty icon={Wrench} title={TABS.find((t) => t[0] === tab)[1]} text="Esta pestaña se porta en el siguiente paso de la fase 4." />}
      {toast ? <div role="status" className="fixed bottom-4 left-1/2 z-[60] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-fg px-4 py-2.5 text-sm text-onfg shadow-xl">{toast}</div> : null}
    </div>
  );
}
