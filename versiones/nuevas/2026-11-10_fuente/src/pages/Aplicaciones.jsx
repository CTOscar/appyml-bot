// Aplicaciones (#/apps): descarga del bot («Agente agrícola») para Windows, Linux y Android.
// Lee /descargas/manifest.json (lo genera `npm run apps:manifest`) y recomienda el archivo según el equipo de quien visita.
import { useEffect, useMemo, useState } from 'react';
import { Download, ShieldAlert } from 'lucide-react';
import { PageHeader, Empty } from '../ui/page.jsx';
import { Button, Card } from '../ui/index.jsx';
import { KIND_NOMBRE, OS_NOMBRE, agrupar, detectarPlataforma, elegir, tamano } from '../lib/descargas.js';

const AVISOS = {
  windows: 'Si Windows muestra «SmartScreen» pulsa «Más información → Ejecutar de todos modos». Con «Smart App Control» activo, los instaladores sin firma digital se bloquean.',
  linux: 'Descomprime y ejecuta el binario del interior (chmod +x si hace falta). Los paquetes .AppImage/.deb/.rpm se publican cuando están compilados.',
  android: 'Permite «instalar apps de origen desconocido» para tu navegador o administrador de archivos. La app queda firmada; el sistema te avisará porque no viene de Play Store.',
};

function Fila({ f, recomendado }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{KIND_NOMBRE[f.kind] || f.kind}{f.arch ? <span className="text-muted"> · {f.arch}</span> : null}
          {recomendado ? <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">Recomendado para tu equipo</span> : null}</p>
        <p className="truncate font-mono text-[12px] text-muted" title={f.sha256 ? `SHA-256 ${f.sha256}` : f.file}>{f.file} · {tamano(f.size)}{f.sha256 ? ` · SHA-256 ${f.sha256.slice(0, 12)}…` : ''}</p>
      </div>
      <a href={`/descargas/${encodeURIComponent(f.file)}`} download>
        <Button variant={recomendado ? 'primary' : 'glass'} size="sm"><Download className="size-4" aria-hidden />Descargar</Button>
      </a>
    </li>
  );
}

export function Aplicaciones() {
  const [m, setM] = useState(null);
  const [error, setError] = useState(false);
  const plat = useMemo(() => detectarPlataforma(), []);
  useEffect(() => {
    let vivo = true;
    fetch('/descargas/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((j) => vivo && setM(j), () => vivo && setError(true));
    return () => { vivo = false; };
  }, []);

  const archivos = m?.archivos || [];
  const mejor = elegir(archivos, plat);
  const grupos = agrupar(archivos);
  return (
    <div>
      <PageHeader title="Aplicaciones" subtitle="Lleva el bot (Agente agrícola) a tu escritorio o a tu celular. Cada archivo corresponde a un sistema y una arquitectura." />
      {error ? <Empty title="No se pudo leer la lista de descargas" text="Revisa tu conexión e inténtalo de nuevo." /> : !m ? null : !archivos.length ? (
        <Empty title="Aún no hay instaladores publicados" text="Se generan con «npm run apps:manifest» después de compilar (ver apps/README.md)." />
      ) : (
        <div className="grid gap-5">
          {mejor ? (
            <Card className="p-5">
              <p className="text-[13px] text-muted">Detectamos {OS_NOMBRE[plat.os]}{plat.arch ? ` (${plat.arch})` : ''}</p>
              <ul className="divide-y divide-ink/10"><Fila f={mejor} recomendado /></ul>
            </Card>
          ) : plat.os ? <p className="text-[14px] text-muted">Todavía no hay una app para {OS_NOMBRE[plat.os] || plat.os}; en ese equipo puedes usar el bot desde el navegador (<a className="text-accent" href="/bot/">/bot/</a>).</p> : null}
          {grupos.map((g) => (
            <Card key={g.os} className="p-5">
              <h2 className="font-display text-xl font-light">{OS_NOMBRE[g.os]}</h2>
              <ul className="divide-y divide-ink/10">{g.archivos.map((f) => <Fila key={f.file} f={f} />)}</ul>
              <p className="mt-3 flex gap-2 text-[12.5px] text-muted"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{AVISOS[g.os]}</p>
            </Card>
          ))}
          <p className="text-[12.5px] text-faint">Versión {m.version}. Compara la huella SHA-256 con la del archivo descargado (Get-FileHash en Windows, sha256sum en Linux).</p>
        </div>
      )}
    </div>
  );
}
