// Cuenta dentro del bot instalable: sesión (la misma de la API del panel), acceso con Google / Apple / correo y perfil con foto.
// El bot no obliga a entrar (sigue funcionando sin cuenta); entrar sirve para ver tu nombre, tu foto y tu rol.
import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowRight, Camera, Check, Circle, Eye, EyeOff, KeyRound, Loader2, LogIn, LogOut, Lock, Mail, Phone, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { PW_RULES, passwordOk } from '../app/auth.jsx';
import { initials, resizeImage } from '../lib/photo.js';
import { roleLabel } from '../lib/roles.js';
import { AppleIcon, GoogleIcon } from '../ui/icons.jsx';
import { Badge, Button, Divider, Field, Input } from '../ui/index.jsx';

// Estado de la cuenta: undefined = revisando, null = sin sesión, objeto = usuario. La foto se pide aparte (blob:).
export function useCuenta(client) {
  const [user, setUser] = useState(undefined);
  const [photo, setPhoto] = useState(null);
  const [prov, setProv] = useState(null);
  const [provEst, setProvEst] = useState('cargando'); // cargando | ok | error | sin-api
  const canPhoto = typeof client.getPhoto === 'function';

  const cargarProv = useCallback(() => {
    if (typeof client.socialProviders !== 'function') { setProvEst('sin-api'); return () => {}; }
    let vivo = true;
    setProvEst('cargando');
    Promise.resolve().then(() => client.socialProviders()).then((p) => { if (vivo) { setProv(p || null); setProvEst('ok'); } }, () => { if (vivo) { setProv(null); setProvEst('error'); } });
    return () => { vivo = false; };
  }, [client]);

  useEffect(() => {
    let vivo = true;
    Promise.resolve().then(() => client.getSession?.()).then((u) => vivo && setUser(u || null), () => vivo && setUser(null));
    const fin = cargarProv();
    return () => { vivo = false; fin(); };
  }, [client, cargarProv]);

  useEffect(() => {
    let url = null, vivo = true;
    if (user && canPhoto) Promise.resolve(client.getPhoto(user.id)).then((u) => { url = u; if (vivo) setPhoto(u || null); }, () => {});
    else setPhoto(null);
    return () => { vivo = false; if (url?.startsWith?.('blob:')) URL.revokeObjectURL(url); };
  }, [client, user?.id, canPhoto]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password) => { const u = await client.login(email, password, true); setUser(u); return u; }, [client]);
  const register = useCallback(async (d) => { await client.register(d); return login(d.email, d.password); }, [client, login]);
  const logout = useCallback(async () => { try { await client.logout?.(); } finally { setUser(null); } }, [client]);

  // Google y Apple: siempre se muestran; los que la API no tenga activos aparecen apagados con su motivo.
  const social = [['google', 'Google', GoogleIcon], ['apple', 'Apple', AppleIcon]].map(([k, n, I]) => ({
    k, n, I,
    href: client.socialUrl ? `${client.socialUrl(k)}?volver=bot` : null, // la API regresa a /bot/ (no al panel)
    activo: !!(client.socialUrl && prov?.[k]),
    motivo: provEst === 'ok' ? 'no-configurado' : provEst, // por qué está apagado
    proximamente: k === 'apple', // Apple se muestra como «Próximamente» hasta que la API tenga sus credenciales
  }));
  return { client, user, setUser, photo, setPhoto, canPhoto, social, reintentar: cargarProv, login, register, logout };
}

export function Avatar({ user, photo, className = 'size-9 text-[13px]' }) {
  return (
    <span aria-hidden className={clsx('relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-ok/70 font-display font-medium text-onfg ring-1 ring-ink/15', className)}>
      {photo ? <img src={photo} alt="" className="absolute inset-0 size-full object-cover" /> : user ? initials(user.name || user.email) : <UserRound className="size-[55%]" strokeWidth={1.75} />}
    </span>
  );
}

const MOTIVO = {
  cargando: 'comprobando…',
  error: 'sin conexión con la API · toca para reintentar',
  'sin-api': 'el panel usa datos simulados (falta VITE_PANEL_API_URL)',
  'no-configurado': 'no configurado en la API',
};

function SocialBotones({ social, texto = 'Continuar con', className, onReintentar }) {
  return (
    <div className={clsx('grid gap-2', className)}>
      {social.map(({ k, n, I, href, activo, motivo, proximamente }) => (activo ? (
        <a key={k} href={href} className="inline-flex h-11 items-center justify-center gap-2.5 rounded-2xl bg-fg text-[14.5px] font-medium text-onfg shadow-[0_0_24px_-6px_rgb(var(--accent-rgb)/0.5)] transition hover:brightness-95 active:scale-[0.99]">
          <I />{texto} {n}
        </a>
      ) : proximamente ? (
        <span key={k} aria-disabled="true" className="inline-flex h-11 items-center justify-center gap-2.5 rounded-2xl bg-ink/[0.05] px-3 text-[14px] text-faint shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]">
          <span className="opacity-50"><I /></span>{texto} {n}
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">Próximamente</span>
        </span>
      ) : (
        <button key={k} type="button" aria-disabled={motivo !== 'error'} onClick={motivo === 'error' ? onReintentar : undefined} title={MOTIVO[motivo]}
          className="inline-flex min-h-11 items-center justify-center gap-2.5 rounded-2xl bg-ink/[0.05] px-3 py-1.5 text-center text-[13px] leading-tight text-faint shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]">
          <span className="shrink-0 opacity-50"><I /></span><span>{n}: {MOTIVO[motivo]}</span>
        </button>
      )))}
    </div>
  );
}

// Bloque de la barra lateral: tarjeta de cuenta (con sesión) o invitación a entrar (sin sesión).
export function CuentaTarjeta({ cuenta, onAbrir }) {
  const { user, photo, social, logout } = cuenta;
  if (user === undefined) return <div className="flex h-16 items-center justify-center rounded-2xl bg-ink/[0.04] text-muted" role="status" aria-label="Revisando la sesión"><Loader2 className="size-4 animate-spin" aria-hidden /></div>;
  if (!user) {
    return (
      <div className="grid gap-2 rounded-2xl bg-gradient-to-b from-accent/10 to-transparent p-3 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.12*var(--t-hair-a)))]">
        <p className="flex items-center gap-2 text-[13.5px] font-medium"><ShieldCheck className="size-4 text-accent" strokeWidth={1.75} aria-hidden />Entra a tu cuenta</p>
        <p className="text-[12px] leading-snug text-muted">Guarda tu perfil y tu foto, y abre el panel sin volver a entrar.</p>
        <SocialBotones social={social.filter((s) => s.activo).length ? social.filter((s) => s.activo) : social.slice(0, 1)} className="mt-0.5" onReintentar={cuenta.reintentar} />
        <button type="button" onClick={() => onAbrir('entrar')} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl text-[13.5px] text-soft transition hover:bg-ink/[0.07] hover:text-fg"><Mail className="size-4" strokeWidth={1.75} aria-hidden />Entrar con correo</button>
      </div>
    );
  }
  return (
    <div className="grid gap-2 rounded-2xl bg-ink/[0.04] p-2.5 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]">
      <button type="button" onClick={() => onAbrir('perfil')} className="flex items-center gap-3 rounded-xl p-1 text-left transition hover:bg-ink/[0.06]" aria-label="Abrir mi perfil">
        <Avatar user={user} photo={photo} className="size-11 text-[15px]" />
        <span className="min-w-0 flex-1"><b className="block truncate text-[14px] font-medium">{user.name || 'Sin nombre'}</b><span className="block truncate text-[12px] text-muted">{user.email}</span></span>
        {user.role === 'super_admin' ? <Badge tone="accent" dot={false}>Super admin</Badge> : null}
      </button>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => onAbrir('perfil')} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-ink/[0.07] text-[13px] transition hover:bg-ink/[0.12]"><UserRound className="size-4" strokeWidth={1.75} aria-hidden />Mi perfil</button>
        <button type="button" onClick={logout} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl text-[13px] text-soft transition hover:bg-crit/10 hover:text-crit"><LogOut className="size-4" strokeWidth={1.75} aria-hidden />Salir</button>
      </div>
    </div>
  );
}

function Password({ id, value, onChange, autoComplete }) {
  const [ver, setVer] = useState(false);
  return <Input id={id} icon={Lock} type={ver ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
    right={<button type="button" onClick={() => setVer((v) => !v)} className="text-muted hover:text-fg" aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>} />;
}

function FormAcceso({ cuenta, modoInicial, onListo }) {
  const [modo, setModo] = useState(modoInicial === 'crear' ? 'crear' : 'entrar'); // entrar | crear | recuperar
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState(() => (new URLSearchParams(location.search).get('auth_error') ? 'No se pudo entrar con el proveedor. Inténtalo otra vez o usa tu correo.' : '')), [aviso, setAviso] = useState(''), [ocupado, setOcupado] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const cambiar = (m) => { setModo(m); setError(''); setAviso(''); };
  async function enviar(e) {
    e.preventDefault(); setError(''); setAviso('');
    if (modo === 'crear' && !passwordOk(f.password)) { setError('La contraseña no cumple los requisitos.'); return; }
    setOcupado(true);
    try {
      if (modo === 'entrar') { await cuenta.login(f.email.trim(), f.password); onListo(); }
      else if (modo === 'crear') { await cuenta.register({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password }); onListo(); }
      else { await cuenta.client.resetPassword?.(f.email.trim()); setAviso('Si el correo está registrado, te enviamos las instrucciones.'); }
    } catch (er) { setError(er.status === 0 ? 'No hay conexión con el servidor del panel.' : er.message || 'No se pudo completar.'); } finally { setOcupado(false); }
  }
  return (
    <div className="grid gap-4">
      <div>
        <h2 id="bot-cuenta-t" className="font-display text-2xl font-light">{modo === 'entrar' ? 'Bienvenido de nuevo' : modo === 'crear' ? 'Crea tu cuenta' : 'Recupera tu acceso'}</h2>
        <p className="mt-1 text-[13.5px] text-muted">{modo === 'entrar' ? 'Entra para ver tu perfil y abrir el panel.' : modo === 'crear' ? 'La primera cuenta registrada es super administradora; las demás quedan pendientes hasta que se les asigne rol.' : 'Escribe tu correo y te decimos cómo cambiarla.'}</p>
      </div>
      {modo !== 'recuperar' ? <><SocialBotones social={cuenta.social} onReintentar={cuenta.reintentar} /><Divider>o con tu correo</Divider></> : null}
      <form onSubmit={enviar} className="grid gap-3.5" noValidate>
        {modo === 'crear' ? <Field label="Nombre">{(id) => <Input id={id} icon={UserRound} value={f.name} onChange={(e) => set('name')(e.target.value)} autoComplete="name" />}</Field> : null}
        <Field label="Correo">{(id) => <Input id={id} icon={Mail} type="email" inputMode="email" placeholder="nombre@empresa.mx" value={f.email} onChange={(e) => set('email')(e.target.value)} autoComplete="email" />}</Field>
        {modo !== 'recuperar' ? (
          <Field label="Contraseña" aside={modo === 'entrar' ? <button type="button" onClick={() => cambiar('recuperar')} className="text-[12.5px] text-accent hover:text-fg">¿La olvidaste?</button> : null}>
            {(id) => <Password id={id} value={f.password} onChange={set('password')} autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} />}
          </Field>
        ) : null}
        {modo === 'crear' ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">{PW_RULES.map(([re, txt]) => { const ok = re.test(f.password); return <li key={txt} className={clsx('flex items-center gap-1.5', ok ? 'text-ok' : 'text-muted')}>{ok ? <Check className="size-3.5" /> : <Circle className="size-3" />}{txt}</li>; })}</ul>
        ) : null}
        {error ? <p className="rounded-xl bg-crit/10 px-3 py-2 text-[13px] text-crit" role="alert">{error}</p> : null}
        {aviso ? <p className="rounded-xl bg-ok/10 px-3 py-2 text-[13px] text-ok" role="status">{aviso}</p> : null}
        <Button type="submit" variant="primary" size="lg" loading={ocupado} className="w-full">{modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Enviar instrucciones'}<ArrowRight className="size-4" aria-hidden /></Button>
      </form>
      <p className="text-center text-[13.5px] text-muted">
        {modo === 'entrar' ? <>¿Cuenta nueva? <button type="button" onClick={() => cambiar('crear')} className="text-fg hover:text-accent">Créala aquí</button></>
          : <button type="button" onClick={() => cambiar('entrar')} className="text-fg hover:text-accent">Volver a entrar</button>}
      </p>
    </div>
  );
}

function FormPerfil({ cuenta, onListo }) {
  const { client, user, photo, setPhoto, setUser, canPhoto, logout } = cuenta;
  const [f, setF] = useState({ name: user.name || '', phone: user.phone || '', password: '' });
  const [msg, setMsg] = useState(null), [guardando, setGuardando] = useState(false), [fotoOcupada, setFotoOcupada] = useState(false);
  const file = useRef(null);
  const puedeEditar = typeof client.updateUser === 'function';
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function guardar(e) {
    e.preventDefault(); setMsg(null);
    if (f.password && !passwordOk(f.password)) return setMsg({ ok: false, text: 'La contraseña nueva no cumple los requisitos.' });
    setGuardando(true);
    try {
      const u = await client.updateUser({ id: user.id, name: f.name.trim(), email: user.email, phone: f.phone.trim(), attributes: user.attributes || {}, ...(f.password ? { password: f.password } : {}) });
      setUser(u || { ...user, name: f.name.trim(), phone: f.phone.trim() }); setF((x) => ({ ...x, password: '' })); setMsg({ ok: true, text: 'Cambios guardados.' });
    } catch (er) { setMsg({ ok: false, text: er.message || 'No se pudo guardar.' }); } finally { setGuardando(false); }
  }
  async function subir(ev) {
    const fl = ev.target.files?.[0]; ev.target.value = '';
    if (!fl) return;
    setFotoOcupada(true); setMsg(null);
    try { await client.setPhoto(user.id, await resizeImage(fl)); setPhoto(await client.getPhoto(user.id)); setMsg({ ok: true, text: 'Foto actualizada.' }); } catch (er) { setMsg({ ok: false, text: er.message }); } finally { setFotoOcupada(false); }
  }
  async function quitar() {
    setFotoOcupada(true);
    try { await client.removePhoto(user.id); setPhoto(null); } catch (er) { setMsg({ ok: false, text: er.message }); } finally { setFotoOcupada(false); }
  }
  return (
    <div className="grid gap-5">
      <div className="grid justify-items-center gap-3 text-center">
        <Avatar user={user} photo={photo} className="size-24 text-3xl shadow-[0_0_40px_-8px_rgb(var(--accent-rgb)/0.6)]" />
        <div><h2 id="bot-cuenta-t" className="font-display text-xl">{user.name || 'Sin nombre'}</h2><p className="break-all text-[13px] text-muted">{user.email}</p></div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge tone={user.role === 'super_admin' ? 'accent' : 'muted'}>{roleLabel(user.role)}</Badge>
          {canPhoto && typeof client.setPhoto === 'function' ? (
            <>
              <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={subir} />
              <Button size="sm" loading={fotoOcupada} onClick={() => file.current?.click()}><Camera className="size-4" strokeWidth={1.75} />{photo ? 'Cambiar foto' : 'Subir foto'}</Button>
              {photo ? <Button size="sm" variant="ghost" onClick={quitar}><Trash2 className="size-4" strokeWidth={1.75} />Quitar</Button> : null}
            </>
          ) : null}
        </div>
      </div>
      {puedeEditar ? (
        <form onSubmit={guardar} className="grid gap-3.5" noValidate>
          <Field label="Nombre">{(id) => <Input id={id} icon={UserRound} value={f.name} onChange={set('name')} autoComplete="name" />}</Field>
          <Field label="Teléfono">{(id) => <Input id={id} icon={Phone} type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />}</Field>
          <Field label="Contraseña nueva" hint="Déjala vacía para no cambiarla.">{(id) => <Input id={id} icon={KeyRound} type="password" value={f.password} onChange={set('password')} autoComplete="new-password" />}</Field>
          {f.password ? <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">{PW_RULES.map(([re, txt]) => { const ok = re.test(f.password); return <li key={txt} className={clsx('flex items-center gap-1.5', ok ? 'text-ok' : 'text-muted')}>{ok ? <Check className="size-3.5" /> : <Circle className="size-3" />}{txt}</li>; })}</ul> : null}
          {msg ? <p className={clsx('rounded-xl px-3 py-2 text-[13px]', msg.ok ? 'bg-ok/10 text-ok' : 'bg-crit/10 text-crit')} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p> : null}
          <Button type="submit" variant="primary" loading={guardando} className="w-full">Guardar cambios</Button>
        </form>
      ) : null}
      <div className="grid gap-1.5 border-t border-ink/10 pt-3">
        <a href="/" className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-[14px] text-soft transition hover:bg-ink/[0.06] hover:text-fg"><ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />Abrir el panel de flota</a>
        <button type="button" onClick={async () => { await logout(); onListo(); }} className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-left text-[14px] text-soft transition hover:bg-crit/10 hover:text-crit"><LogOut className="size-4" strokeWidth={1.75} aria-hidden />Cerrar sesión</button>
      </div>
    </div>
  );
}

// Hoja inferior en celular, ventana centrada en pantallas grandes. Esc o tocar fuera la cierran.
export function CuentaDialogo({ cuenta, modo, onCerrar }) {
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onCerrar(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onCerrar]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bot-cuenta-t" className="fixed inset-0 z-[80] grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={onCerrar}>
      <div className="glass-strong max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-pop sm:rounded-3xl sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex justify-end"><button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-ink/10 hover:text-fg"><X className="size-4" /></button></div>
        {cuenta.user ? <FormPerfil cuenta={cuenta} onListo={onCerrar} /> : <FormAcceso cuenta={cuenta} modoInicial={modo} onListo={onCerrar} />}
      </div>
    </div>
  );
}

// Botón con la foto de la cuenta para el encabezado del chat
export function CuentaBoton({ cuenta, onAbrir }) {
  const { user, photo } = cuenta;
  if (user === undefined) return null;
  return (
    <button type="button" onClick={() => onAbrir(user ? 'perfil' : 'entrar')} aria-label={user ? `Mi perfil (${user.name || user.email})` : 'Entrar a mi cuenta'} title={user ? user.name || user.email : 'Entrar'}
      className="grid size-10 place-items-center rounded-xl transition hover:bg-ink/[0.08]">
      {user ? <Avatar user={user} photo={photo} className="size-8 text-[12px]" /> : <LogIn className="size-5 text-soft" strokeWidth={1.75} aria-hidden />}
    </button>
  );
}
