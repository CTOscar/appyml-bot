// Pie de página chico (mismo contenido que el del panel actual, sin el selector de tema: el diseño nuevo tiene uno solo).
import { useEffect, useState } from 'react';

export function Footer() {
  const [upd, setUpd] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setUpd(new Date()), 60000); return () => clearInterval(t); }, []);
  return (
    <footer className="border-t border-ink/[0.06] px-3 py-5 text-[12px] text-faint sm:px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p>© 2026 Agrícola Las Cabras · Hecho por <a href="https://buildwiselabs.net" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent">BuildWise Labs</a></p>
        <p>Clima: <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent">Open-Meteo</a> · Datos actualizados: {upd.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        <nav className="flex gap-4" aria-label="Pie de página">
          <a href="#/status" className="hover:text-accent">Status</a>
          <a href="#/enlaces" className="hover:text-accent">Enlaces</a>
          <a href="https://buildwiselabs.net" target="_blank" rel="noopener noreferrer" className="hover:text-accent">Contacto</a>
        </nav>
      </div>
    </footer>
  );
}
