// Fondo del panel: noche en el campo. Cielo verde casi negro con pocas estrellas, el horizonte con un resplandor
// de amanecer (más fuerte en portada) y surcos en perspectiva que convergen hacia él. Todo SVG/CSS estático.
import { memo } from 'react';

// Generador pseudoaleatorio con semilla: mismas estrellas en cada carga.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const STARS = (() => {
  const r = rng(20261110), out = [];
  for (let i = 0; i < 70; i++) out.push({ x: r() * 100, y: r() * 52, s: r() < 0.1 ? 1.3 : 0.7, o: 0.15 + r() * 0.45, d: r() * 6, tw: r() < 0.15 });
  return out;
})();

// Surcos: líneas desde el punto de fuga (centro del horizonte) hasta el borde inferior, más juntas al centro.
const HORIZON = 62; // % de la altura
const ROWS = Array.from({ length: 31 }, (_, i) => -150 + i * 10); // x final en % (fuera de pantalla para que no se vea el borde)

export const Cosmos = memo(function Cosmos({ planet = false }) {
  const glow = planet ? 0.55 : 0.28;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-night">
      {/* cielo: un poco de verde arriba */}
      <div className="cosmos-deco absolute inset-x-0 top-0 h-[70%] bg-[radial-gradient(70%_70%_at_50%_0%,rgb(var(--sky-rgb)/0.6),transparent_70%)]" />
      <svg className="cosmos-deco absolute inset-0 size-full" preserveAspectRatio="none" style={{ opacity: "var(--t-stars)" }}>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x + '%'} cy={s.y + '%'} r={s.s} fill="var(--t-fg)" opacity={s.o * 1}
            className={s.tw ? 'motion-safe:animate-twinkle' : undefined} style={s.tw ? { animationDelay: s.d + 's' } : undefined} />
        ))}
      </svg>

      {/* resplandor del amanecer sobre el horizonte */}
      <div className="cosmos-deco absolute inset-x-0" style={{ top: `calc(${HORIZON}% - 30vh)`, height: '60vh', opacity: `calc(${glow} * var(--t-dawn-a))`,
        background: 'radial-gradient(60% 50% at 50% 50%, rgb(var(--dawn-rgb) / 0.55), rgb(var(--dawn-rgb) / 0.16) 45%, transparent 75%)' }} />
      {/* línea del horizonte */}
      <div className="cosmos-deco absolute inset-x-0 h-px" style={{ top: `${HORIZON}%`, opacity: planet ? 0.7 : 0,
        background: 'linear-gradient(90deg, transparent, rgb(var(--dawn-rgb) / 0.7) 30%, rgb(var(--dawn-rgb) / 0.95) 50%, rgb(var(--dawn-rgb) / 0.7) 70%, transparent)' }} />

      {/* el campo: tierra oscura con surcos en perspectiva */}
      <div className="cosmos-deco absolute inset-x-0 bottom-0" style={{ top: `${HORIZON}%`, background: 'linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--t-ground) 75%, transparent) 18%, color-mix(in srgb, var(--t-ground) 90%, transparent) 55%, var(--t-night) 95%)' }} />
      <svg className="cosmos-deco absolute inset-x-0 bottom-0 w-full" style={{ top: `${HORIZON}%`, height: `${100 - HORIZON}%` }} viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id="surco" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--t-accent)" stopOpacity="0" />
            <stop offset="0.25" stopColor="var(--t-accent)" stopOpacity="0.05" />
            <stop offset="1" stopColor="var(--t-accent)" stopOpacity="0.22" />
          </linearGradient>
        </defs>
        {ROWS.map((x) => <line key={x} x1="50" y1="0" x2={x + 50} y2="100" stroke="url(#surco)" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />)}
        {/* curvas de nivel suaves, como un terreno agrícola visto de lejos */}
        {[18, 38, 62].map((y, i) => <path key={y} d={`M0 ${y} Q 25 ${y - 4 + i} 50 ${y} T 100 ${y}`} stroke="var(--t-accent)" strokeOpacity="0.05" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />)}
      </svg>

      {/* viñeta para que el contenido se lea */}
      <div className="cosmos-deco absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-night to-transparent" />
    </div>
  );
});
