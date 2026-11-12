// Acceso: entrar, crear cuenta (la primera queda como administradora), recuperar contraseña y Google/Apple.
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ArrowRight, Check, Circle, Eye, EyeOff, Lock, Mail, Phone, UserRound } from 'lucide-react';
import { useAuth, PW_RULES, passwordOk } from '../app/auth.jsx';
import { Button, Divider, Field, Input } from '../ui/index.jsx';
import { Cosmos } from '../layout/Cosmos.jsx';
import { AppleIcon, GoogleIcon } from '../ui/icons.jsx';

function Password({ value, onChange, autoComplete, id }) {
  const [ver, setVer] = useState(false);
  return (
    <Input id={id} icon={Lock} type={ver ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required
      right={<button type="button" onClick={() => setVer((v) => !v)} className="text-muted hover:text-fg" aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>} />
  );
}

// Google y Apple se muestran siempre. Google se activa cuando la API lo tiene configurado; Apple aparece como «Próximamente» hasta tener credenciales.
function Social({ providers, client }) {
  const lista = [['google', 'Google', GoogleIcon], ['apple', 'Apple', AppleIcon]];
  const BASE = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl text-[14px] shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))]';
  return (
    <>
      <Divider>o</Divider>
      <div className="grid grid-cols-2 gap-2.5">
        {lista.map(([k, nombre, Icon]) => (client.socialUrl && providers?.[k] ? (
          <a key={k} href={client.socialUrl(k)} className={`${BASE} bg-ink/[0.06] text-fg transition hover:bg-ink/[0.1]`}>
            <Icon />Entrar con {nombre}
          </a>
        ) : (
          <span key={k} aria-disabled="true" title={k === 'apple' ? 'Acceso con Apple: próximamente' : 'Acceso con Google no disponible: la API no lo tiene configurado'} className={`${BASE} flex-wrap gap-x-2 bg-ink/[0.03] px-2 text-faint`}>
            <span className="opacity-50"><Icon /></span>{nombre}
            {k === 'apple' ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">Próximamente</span> : <span className="text-[11px]">no disponible</span>}
          </span>
        )))}
      </div>
    </>
  );
}

export function Login() {
  const { client, login, register } = useAuth();
  const [modo, setModo] = useState('entrar'); // entrar | crear | recuperar
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', remember: true });
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [providers, setProviders] = useState(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    client.socialProviders?.().then(setProviders, () => setProviders(null));
    const q = new URLSearchParams(window.location.search);
    if (q.get('auth_error')) setError('No se pudo entrar con el proveedor. Inténtalo otra vez o usa tu correo.');
  }, [client]);

  async function enviar(e) {
    e.preventDefault();
    setError(''); setAviso('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) { setError('Escribe tu correo (por ejemplo nombre@empresa.mx), no tu teléfono ni tu nombre.'); return; }
    if (modo === 'crear' && !passwordOk(f.password)) { setError('La contraseña no cumple los requisitos.'); return; }
    setEnviando(true);
    try {
      if (modo === 'entrar') await login(f.email.trim(), f.password, f.remember);
      else if (modo === 'crear') await register({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password });
      else { await client.resetPassword(f.email.trim()); setAviso('Si el correo está registrado, te enviamos las instrucciones para cambiar la contraseña.'); }
    } catch (err) {
      setError(err.status === 0 ? 'No hay conexión con el servidor del panel.' : err.message || 'No se pudo completar.');
    } finally { setEnviando(false); }
  }

  const titulo = { entrar: ['Tu flota,', 'bajo control.'], crear: ['Crea tu', 'cuenta.'], recuperar: ['Recupera tu', 'acceso.'] }[modo];
  const cambiar = (m) => { setModo(m); setError(''); setAviso(''); };

  return (
    <div className="relative min-h-dvh">
      <Cosmos planet />
      <div className="grid min-h-dvh w-full items-center gap-10 px-5 py-10 sm:px-10 lg:grid-cols-[1.2fr_0.8fr] lg:px-20">
        <section className="hidden lg:block">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-ink/[0.06] px-3 py-1 text-[13px] text-soft shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]">
            <span className="size-1.5 rounded-full bg-ok shadow-[0_0_8px_#6fd48f]" />Rancho agrícola Las Cabras · Sinaloa
          </p>
          <h1 className="display glow text-[clamp(3rem,6vw,5.4rem)] animate-rise">
            {titulo[0]}<br /><span className="fade-text">{titulo[1]}</span>
          </h1>
          <p className="mt-6 max-w-md text-[17px] text-soft animate-rise [animation-delay:120ms]">Rastreo en vivo, horas de motor, diésel, taller y lotes en un solo lugar.</p>
        </section>

        <section className="glass-strong mx-auto w-full max-w-md p-7 sm:p-8 animate-rise">
          <div className="mb-7 lg:hidden">
            <h1 className="display glow text-5xl">{titulo[0]} <span className="fade-text">{titulo[1]}</span></h1>
          </div>
          <h2 className="font-display text-2xl font-light">{modo === 'entrar' ? 'Bienvenido de nuevo' : modo === 'crear' ? 'Cuenta nueva' : '¿Olvidaste tu contraseña?'}</h2>
          <p className="mt-1 text-[14px] text-muted">
            {modo === 'entrar' ? 'Entra con tu correo y contraseña.' : modo === 'crear' ? 'La primera cuenta es super administradora; las demás quedan pendientes hasta que se les asigne un rol.' : 'Escribe tu correo y te enviamos cómo cambiarla.'}
          </p>

          <form onSubmit={enviar} className="mt-6 grid gap-4" noValidate>
            {modo === 'crear' ? (
              <Field label="Nombre">{(id) => <Input id={id} icon={UserRound} value={f.name} onChange={(e) => set('name')(e.target.value)} autoComplete="name" required />}</Field>
            ) : null}
            <Field label="Correo">{(id) => <Input id={id} icon={Mail} type="email" inputMode="email" placeholder="nombre@empresa.mx" value={f.email} onChange={(e) => set('email')(e.target.value)} autoComplete="email" required />}</Field>
            {modo === 'crear' ? (
              <Field label="Teléfono" hint="Opcional">{(id) => <Input id={id} icon={Phone} type="tel" value={f.phone} onChange={(e) => set('phone')(e.target.value)} autoComplete="tel" />}</Field>
            ) : null}
            {modo !== 'recuperar' ? (
              <Field label="Contraseña" aside={modo === 'entrar' ? <button type="button" onClick={() => cambiar('recuperar')} className="text-[13px] text-accent hover:text-fg">¿La olvidaste?</button> : null}>
                {(id) => <Password id={id} value={f.password} onChange={set('password')} autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} />}
              </Field>
            ) : null}
            {modo === 'crear' ? (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
                {PW_RULES.map(([re, txt]) => {
                  const ok = re.test(f.password);
                  return <li key={txt} className={clsx('flex items-center gap-1.5', ok ? 'text-ok' : 'text-muted')}>{ok ? <Check className="size-3.5" /> : <Circle className="size-3" />}{txt}</li>;
                })}
              </ul>
            ) : null}
            {modo === 'entrar' ? (
              <label className="flex items-center gap-2.5 text-[14px] text-soft">
                <input type="checkbox" checked={f.remember} onChange={(e) => set('remember')(e.target.checked)} className="size-4 rounded accent-accent" />Recordarme en este equipo
              </label>
            ) : null}

            {error ? <p className="rounded-xl bg-crit/10 px-3 py-2 text-[13.5px] text-crit" role="alert">{error}</p> : null}
            {aviso ? <p className="rounded-xl bg-ok/10 px-3 py-2 text-[13.5px] text-ok" role="status">{aviso}</p> : null}

            <Button type="submit" variant="primary" size="lg" loading={enviando} className="mt-1 w-full">
              {modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Enviar instrucciones'}<ArrowRight className="size-4" aria-hidden />
            </Button>
          </form>

          {modo !== 'recuperar' ? <div className="mt-5 grid gap-5"><Social providers={providers} client={client} /></div> : null}

          <p className="mt-7 text-center text-[14px] text-muted">
            {modo === 'entrar' ? <>¿Cliente nuevo? <button type="button" onClick={() => cambiar('crear')} className="text-fg hover:text-accent">Crea tu cuenta</button></>
              : <button type="button" onClick={() => cambiar('entrar')} className="text-fg hover:text-accent">Volver a entrar</button>}
          </p>
        </section>
      </div>
      <footer className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[12px] text-faint">Rastreo y Medición · Las Cabras Sinaloa · Hecho por BuildWise Labs</footer>
    </div>
  );
}
