// Ilustración del tractor con los colores de su marca (la misma del panel viejo: función Pa del bundle).
// `lite` aclara la carrocería (para fondos oscuros). Sin marca conocida usa el verde del panel.
import clsx from 'clsx';

export const TRACTOR_COLORS = {
  'john-deere': { body: '#367c2b', dark: '#2a6122', rim: '#f4cf1c', bg: '#1f5a1b', lite: { body: '#4aa03a', dark: '#2f7a26' } },
  'new-holland': { body: '#1f56b8', dark: '#173f8a', rim: '#e9ecef', bg: '#163f86', lite: { body: '#3d7be0', dark: '#2459b6' } },
  'massey-ferguson': { body: '#c2272d', dark: '#97191e', rim: '#d8dde3', bg: '#8c1a20', lite: { body: '#e04048', dark: '#b32b32' } },
  'case-ih': { body: '#b3262d', dark: '#8a1b21', rim: '#e9ecef', bg: '#7e1a20', lite: { body: '#d9434a', dark: '#a82a31' } },
  kubota: { body: '#e8730c', dark: '#bd5a05', rim: '#e9ecef', bg: '#a24e06', lite: { body: '#f58a2a', dark: '#d06a10' } },
  mahindra: { body: '#c4202b', dark: '#9a1620', rim: '#e9ecef', bg: '#8c1822', lite: { body: '#dc3a47', dark: '#b02432' } },
  valtra: { body: '#8c969e', dark: '#6b747b', rim: '#f4cf1c', bg: '#4d575e', lite: { body: '#a9b3ba', dark: '#808a91' } },
  otra: { body: '#1c8a4a', dark: '#146b38', rim: '#e9ecef', bg: '#14532d', lite: { body: '#2fa862', dark: '#1c8a4a' } },
};
export const tractorColors = (marca) => TRACTOR_COLORS[marca] || TRACTOR_COLORS.otra;

function Wheel({ x, y, r, rim }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill="#1b201d" />
      <circle r={r - 3} fill="none" stroke="#0b0e0c" strokeWidth="7" strokeDasharray="7 6" />
      <circle r={(r * 0.58).toFixed(1)} fill={rim} />
      <path d={`M0 ${-r * 0.5}V${r * 0.5}M${-r * 0.5} 0H${r * 0.5}M${-r * 0.36} ${-r * 0.36}L${r * 0.36} ${r * 0.36}M${r * 0.36} ${-r * 0.36}L${-r * 0.36} ${r * 0.36}`} stroke="#000" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round" />
      <circle r={(r * 0.13).toFixed(1)} fill="#2b302d" />
    </g>
  );
}

export function TractorArt({ marca, lite = false, className, title = 'Tractor' }) {
  const base = tractorColors(marca), c = lite ? { ...base, ...base.lite } : base;
  return (
    <svg viewBox="10 22 250 154" className={clsx('block', className)} role="img" aria-label={title}>
      <ellipse cx="130" cy="170" rx="112" ry="6" fill="#000" opacity=".16" />
      <path d="M150 84Q190 54 232 84" fill="none" strokeWidth="9" strokeLinecap="round" stroke={c.dark} />
      <rect x="96" y="38" width="7" height="36" rx="2" fill="#262b28" /><rect x="93" y="34" width="13" height="6" rx="2" fill="#262b28" />
      <path d="M20 100V82q0-10 10-10h82q10 0 14 10l6 20v18H34q-14 0-14-14z" fill={c.body} />
      <path d="M20 108h118v6H34q-14 0-14-6z" fill={c.dark} />
      <rect x="26" y="84" width="10" height="22" rx="2" fill="#111" opacity=".55" />
      <path d="M118 100V42q0-8 8-8h72q8 0 10 8l8 58z" fill={c.dark} />
      <path d="M128 46h68l7 46h-75z" fill="#bfe3f2" opacity=".9" /><path d="M128 46h30l-12 46h-18z" fill="#fff" opacity=".28" />
      <rect x="112" y="26" width="108" height="9" rx="3" fill="#2b302d" /><rect x="204" y="100" width="42" height="6" rx="2" fill="#2b302d" />
      <circle cx="30" cy="96" r="4" fill="#fff6c8" />
      <Wheel x={190} y={116} r={52} rim={c.rim} /><Wheel x={58} y={138} r={30} rim={c.rim} />
    </svg>
  );
}
