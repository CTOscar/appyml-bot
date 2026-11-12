// Mi perfil: foto, datos personales, seguridad (contraseña), apariencia y, para administradores, las cuentas y sus roles.
//  · Datos: validación en cada campo, botón «Guardar» solo con cambios válidos, «Descartar» y aviso si sales con cambios sin guardar.
//  · Seguridad: pide la contraseña actual (la API lo exige) y avisa que cierra las demás sesiones.
//  · Foto: ver PerfilFoto.jsx (archivo, arrastrar o pegar, y editor de encuadre).
//  · Las cuentas de todas las personas (solo administradores) están en la página Accounts (#/accounts).
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { BadgeCheck, Briefcase, Check, Circle, Eye, EyeOff, KeyRound, Lock, Mail, Phone, ShieldCheck, UserRound, Users } from 'lucide-react';
import { useAuth, PW_RULES } from '../app/auth.jsx';
import { atributosCon, formDe, hayCambios, normalizaTelefono, textoError, validarClave, validarPerfil, PUESTO_MAX } from '../lib/perfil.js';
import { permisosDe, roleLabel } from '../lib/roles.js';
import { PageHeader, Section, SectionTitle } from '../ui/page.jsx';
import { Badge, Button, Card, Field, Input } from '../ui/index.jsx';
import { FotoPerfil } from './PerfilFoto.jsx';

const fecha = (iso, opts) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('es-MX', opts) : '—'; };

function Aviso({ msg }) {
  if (!msg) return null;
  return <p className={clsx('rounded-xl px-3 py-2 text-[13.5px]', msg.ok ? 'bg-ok/10 text-ok' : 'bg-crit/10 text-crit')} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>;
}

function ClaveInput({ id, value, onChange, autoComplete, placeholder }) {
  const [ver, setVer] = useState(false);
  return (
    <Input id={id} icon={Lock} type={ver ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} placeholder={placeholder}
      right={<button type="button" onClick={() => setVer((x) => !x)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/[0.08] hover:text-fg">{ver ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}</button>} />
  );
}

function DatosPersonales({ client, user, setUser }) {
  const base = useMemo(() => formDe(user), [user]);
  const [f, setF] = useState(base);
  const [tocados, setTocados] = useState({});
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setF(base); setTocados({}); }, [base]); // al guardar (o cambiar de cuenta) el formulario vuelve a lo guardado

  const errs = validarPerfil(f), hayErr = Object.keys(errs).length > 0, cambios = hayCambios(f, base);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: k === 'phone' ? normalizaTelefono(e.target.value) : e.target.value }));
  const blur = (k) => () => setTocados((t) => ({ ...t, [k]: true }));
  const err = (k) => (tocados[k] ? errs[k] : undefined);

  useEffect(() => { // avisa antes de cerrar o recargar con cambios sin guardar
    if (!cambios) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [cambios]);

  async function guardar(e) {
    e.preventDefault(); setMsg(null);
    if (hayErr) { setTocados({ name: true, email: true, phone: true, puesto: true }); return; }
    setGuardando(true);
    try {
      const u = await client.updateUser({ id: user.id, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), attributes: atributosCon(user, f.puesto) });
      setUser({ ...user, ...(u || { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), attributes: atributosCon(user, f.puesto) }) });
      setMsg({ ok: true, text: 'Cambios guardados.' });
    } catch (er) { setMsg({ ok: false, text: textoError(er, 'No se pudo guardar.') }); } finally { setGuardando(false); }
  }
  const descartar = () => { setF(base); setTocados({}); setMsg(null); };

  return (
    <Card as="form" onSubmit={guardar} noValidate className="grid gap-4" aria-label="Datos personales">
      <SectionTitle icon={UserRound}>Datos personales</SectionTitle>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Nombre" error={err('name')}>{(id) => <Input id={id} icon={UserRound} value={f.name} onChange={set('name')} onBlur={blur('name')} autoComplete="name" aria-invalid={err('name') ? true : undefined} maxLength={120} />}</Field>
        <Field label="Puesto" hint="Opcional. Ej. Gerente, Jefe de taller." error={err('puesto')}>{(id) => <Input id={id} icon={Briefcase} value={f.puesto} onChange={set('puesto')} onBlur={blur('puesto')} autoComplete="organization-title" maxLength={PUESTO_MAX + 20} />}</Field>
        <Field label="Correo" hint="Es con el que entras al panel." error={err('email')}>{(id) => <Input id={id} icon={Mail} type="email" value={f.email} onChange={set('email')} onBlur={blur('email')} autoComplete="email" aria-invalid={err('email') ? true : undefined} />}</Field>
        <Field label="Teléfono" hint="Opcional. Con lada o +52." error={err('phone')}>{(id) => <Input id={id} icon={Phone} type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} onBlur={blur('phone')} autoComplete="tel" aria-invalid={err('phone') ? true : undefined} />}</Field>
      </div>
      <Aviso msg={msg} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" loading={guardando} disabled={!cambios} className="max-sm:w-full">Guardar cambios</Button>
        {cambios ? <Button type="button" variant="ghost" onClick={descartar} disabled={guardando}>Descartar</Button> : <span className="text-[12.5px] text-muted">Sin cambios por guardar.</span>}
      </div>
    </Card>
  );
}

function Seguridad({ client, user, setUser }) {
  const requiereActual = user.hasPassword !== false; // las cuentas de Google/Apple no tienen contraseña del panel
  const [f, setF] = useState({ actual: '', nueva: '', repite: '' });
  const [enviado, setEnviado] = useState(false); // muestra los errores tras el primer intento
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const errs = validarClave({ ...f, requiereActual });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function cambiar(e) {
    e.preventDefault(); setMsg(null); setEnviado(true);
    if (Object.keys(errs).length) return;
    setGuardando(true);
    try {
      const u = await client.updateUser({ id: user.id, name: user.name, email: user.email, phone: user.phone, attributes: user.attributes || {}, password: f.nueva, currentPassword: f.actual });
      setUser({ ...user, ...(u || {}), hasPassword: true });
      setF({ actual: '', nueva: '', repite: '' }); setEnviado(false);
      setMsg({ ok: true, text: requiereActual ? 'Contraseña cambiada. Cerramos tus otras sesiones abiertas.' : 'Contraseña creada. Ya puedes entrar también con tu correo y contraseña.' });
    } catch (er) { setMsg({ ok: false, text: textoError(er, 'No se pudo cambiar la contraseña.') }); } finally { setGuardando(false); }
  }

  return (
    <Card as="form" onSubmit={cambiar} noValidate className="grid gap-4" aria-label="Seguridad">
      <SectionTitle icon={KeyRound}>{requiereActual ? 'Cambiar contraseña' : 'Crear contraseña'}</SectionTitle>
      {!requiereActual ? <p className="text-[13.5px] text-muted">Tu cuenta entra con Google o Apple y no tiene contraseña del panel. Si quieres, crea una para entrar también con tu correo.</p> : null}
      {requiereActual ? <Field label="Contraseña actual" error={enviado ? errs.actual : undefined}>{(id) => <ClaveInput id={id} value={f.actual} onChange={set('actual')} autoComplete="current-password" />}</Field> : null}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Contraseña nueva" error={enviado ? errs.nueva : undefined}>{(id) => <ClaveInput id={id} value={f.nueva} onChange={set('nueva')} autoComplete="new-password" />}</Field>
        <Field label="Repite la nueva" error={enviado ? errs.repite : undefined}>{(id) => <ClaveInput id={id} value={f.repite} onChange={set('repite')} autoComplete="new-password" />}</Field>
      </div>
      {f.nueva ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] sm:grid-cols-3" aria-label="Requisitos de la contraseña">
          {PW_RULES.map(([re, txt]) => { const ok = re.test(f.nueva); return <li key={txt} className={clsx('flex items-center gap-1.5', ok ? 'text-ok' : 'text-muted')}>{ok ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}{txt}</li>; })}
        </ul>
      ) : null}
      <Aviso msg={msg} />
      <Button type="submit" variant="primary" loading={guardando} disabled={!f.nueva && !f.actual} className="justify-self-start max-sm:w-full">{requiereActual ? 'Cambiar contraseña' : 'Crear contraseña'}</Button>
    </Card>
  );
}

function Resumen({ user }) {
  return (
    <div className="grid w-full gap-4 text-left">
      <div className="grid gap-1 text-center">
        <p className="font-display text-xl">{user.name || 'Sin nombre'}</p>
        {user.attributes?.puesto ? <p className="text-[13.5px] text-soft">{user.attributes.puesto}</p> : null}
        <p className="break-all text-[13px] text-muted">{user.email}</p>
        <p className="mt-1"><Badge tone={user.role === 'super_admin' ? 'accent' : 'info'} dot={false}><ShieldCheck className="size-3.5" aria-hidden />{roleLabel(user.role)}</Badge></p>
      </div>
      <dl className="grid gap-2 border-t border-ink/[0.07] pt-3 text-[13px]">
        <div className="flex justify-between gap-3"><dt className="text-muted">Miembro desde</dt><dd className="text-right">{fecha(user.createdAt, { dateStyle: 'long' })}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted">Último acceso</dt><dd className="text-right">{fecha(user.lastLoginAt, { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
      </dl>
      <div className="border-t border-ink/[0.07] pt-3">
        <p className="mb-2 text-[12px] uppercase tracking-[0.12em] text-muted">Con tu rol puedes</p>
        <ul className="grid gap-1.5 text-[13px]">{permisosDe(user).map((t) => <li key={t} className="flex items-start gap-2"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />{t}</li>)}</ul>
      </div>
    </div>
  );
}

export function Perfil() {
  const { client, user, setUser } = useAuth();
  const [msgFoto, setMsgFoto] = useState(null);
  return (
    <div className="grid gap-6 sm:gap-8">
      <PageHeader title="Mi perfil" icon={UserRound} subtitle={`${user.email} · ${roleLabel(user.role)}`} />
      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card className="grid justify-items-center gap-5">
          <FotoPerfil client={client} user={user} onMsg={setMsgFoto} />
          <Aviso msg={msgFoto} />
          <Resumen user={user} />
        </Card>
        <div className="grid gap-4 sm:gap-6">
          <DatosPersonales client={client} user={user} setUser={setUser} />
          <Seguridad client={client} user={user} setUser={setUser} />
        </div>
      </div>
      {user.permissions?.includes('usuarios') ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-display text-lg">Cuentas, accesos y permisos</p><p className="text-[13px] text-muted">Ve las tablas de usuarios, accesos e invitaciones y cambia roles.</p></div>
          <a href="#/accounts" className="inline-flex h-10 items-center gap-2 rounded-2xl bg-ink/[0.08] px-4 text-sm font-medium text-fg shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))] transition hover:bg-ink/[0.13]"><Users className="size-4" aria-hidden />Abrir Accounts</a>
        </Card>
      ) : null}
    </div>
  );
}
