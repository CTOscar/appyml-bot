// Accounts (solo administradores): las tablas de la base de datos del panel vistas como en un cliente de MySQL.
//   users · login_log · oauth_accounts · invitations  +  roles y permisos (matriz)
// Marca los registros nuevos desde tu última visita, permite cambiar el rol, invitar a alguien y exportar a CSV.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Copy, Plus, ShieldCheck, ShieldX, Trash2, X } from 'lucide-react';
import { useAuth } from '../app/auth.jsx';
import { PageHeader, Empty } from '../ui/page.jsx';
import { Button, Stat } from '../ui/index.jsx';
import { TablaDB, RegistroG, celdaMono } from '../accounts/TablaDB.jsx';
import { contarNuevos, esNuevo, fechaHora, leerVistos, marcarVisto, relativo } from '../lib/dbtable.js';
import { PERMISO_TXT, ROLES_BASE, roleLabel } from '../lib/roles.js';
import { textoError } from '../lib/perfil.js';

const AUTO_MS = 30000;
const TABLAS = [
  ['users', 'users'], ['login_log', 'login_log'], ['oauth_accounts', 'oauth_accounts'], ['invitations', 'invitations'], ['roles', 'roles y permisos'],
];
const CONSULTA = {
  users: 'SELECT * FROM users ORDER BY id DESC;',
  login_log: 'SELECT id, user_id, email, ok, ip, created_at FROM login_log ORDER BY id DESC LIMIT {n};',
  oauth_accounts: 'SELECT o.*, u.name FROM oauth_accounts o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC;',
  invitations: 'SELECT id, email, role, created_at, expires_at FROM invitations WHERE used_at IS NULL AND expires_at > UTC_TIMESTAMP(3) ORDER BY id DESC;',
};
const CAMPO_NUEVO = { users: 'createdAt', login_log: 'createdAt', oauth_accounts: 'createdAt', invitations: 'createdAt' };
const sinPermiso = (roles, role) => (roles.find((r) => r.id === (role === 'user' ? 'operador' : role))?.permissions) || [];

/* ---------- datos: se piden juntos y cada uno falla por separado ---------- */
function useCuentas(client, limite, habilitado) {
  const [d, setD] = useState({ users: null, log: null, oauth: null, inv: null, roles: ROLES_BASE, err: {}, seg: {}, at: null, cargando: true });
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const cargar = useCallback(async () => {
    setD((x) => ({ ...x, cargando: true }));
    const med = async (f) => { const t0 = performance.now(); const v = await f(); return [v, (performance.now() - t0) / 1000]; };
    const pedir = {
      users: () => client.listUsers(), log: () => client.loginLog(limite), oauth: () => client.oauthAccounts(), inv: () => client.invitations(),
      roles: () => (typeof client.getRoles === 'function' ? client.getRoles() : Promise.resolve(ROLES_BASE)),
    };
    const ks = Object.keys(pedir);
    const res = await Promise.allSettled(ks.map((k) => med(pedir[k])));
    if (!vivo.current) return;
    setD((x) => {
      const n = { ...x, err: {}, seg: {}, at: Date.now(), cargando: false };
      ks.forEach((k, i) => {
        const r = res[i];
        if (r.status === 'fulfilled') { n[k] = Array.isArray(r.value[0]) ? r.value[0] : n[k]; n.seg[k] = r.value[1]; } else n.err[k] = textoError(r.reason, 'No se pudo consultar.');
      });
      if (!n.roles?.length) n.roles = ROLES_BASE;
      return n;
    });
  }, [client, limite]);
  useEffect(() => { if (habilitado) cargar(); }, [cargar, habilitado]); // sin permiso no se consulta nada
  return { ...d, cargar, setUsers: (f) => setD((x) => ({ ...x, users: f(x.users || []) })) };
}

/* ---------- celdas ---------- */
const Fecha = ({ v }) => (v ? <span title={relativo(v)}>{fechaHora(v)}</span> : <span className="text-faint">NULL</span>);
const Chips = ({ items }) => (items.length ? <span className="flex gap-1">{items.map((p) => <span key={p} className="rounded bg-ok/15 px-1.5 py-px text-[11px] text-ok" title={PERMISO_TXT[p]}>{p}</span>)}</span> : <span className="text-faint">—</span>);

function SelectRol({ user, me, roles, onChange }) {
  if (String(user.id) === String(me.id)) return <span className="text-muted">{roleLabel(user.role)} (tú)</span>;
  return (
    <select value={user.role === 'user' ? 'operador' : user.role} onChange={(e) => onChange(user.id, e.target.value)} onClick={(e) => e.stopPropagation()} aria-label={`Rol de ${user.email}`}
      className="h-7 rounded-lg bg-ink/[0.06] px-1.5 font-mono text-[12px] text-fg outline-none [&>option]:bg-deep">
      {roles.map((r) => <option key={r.id} value={r.id}>{r.id}</option>)}
    </select>
  );
}

/* ---------- matriz de roles y permisos ---------- */
function MatrizRoles({ roles, users }) {
  const perms = Object.keys(PERMISO_TXT);
  const n = (id) => (users || []).filter((u) => (u.role === 'user' ? 'operador' : u.role) === id).length;
  return (
    <section className="grid gap-2" aria-label="Roles y permisos">
      <code className="rounded-lg bg-ink/[0.05] px-3 py-2 font-mono text-[12.5px] text-soft"><span className="text-accent">mysql&gt;</span> SELECT role, COUNT(*) AS cuentas FROM users GROUP BY role;  <span className="text-muted">-- permisos de panel-flota-api/src/roles.mjs</span></code>
      <div className="overflow-auto rounded-2xl bg-panel/60 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.14*var(--t-hair-a)))]">
        <table className="w-full min-w-max border-collapse">
          <caption className="sr-only">Permisos por rol</caption>
          <thead className="bg-deep/95"><tr>
            {['role', 'nombre', 'cuentas', ...perms].map((c) => <th key={c} scope="col" className="border-b border-r border-ink/[0.14] px-3 py-2 text-left font-mono text-[12px] font-semibold last:border-r-0" title={PERMISO_TXT[c]}>{c}</th>)}
          </tr></thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="odd:bg-ink/[0.02]">
                <td className={celdaMono}>{r.id}</td><td className={celdaMono}>{r.label}</td><td className={clsx(celdaMono, 'text-right')}>{users ? n(r.id) : '…'}</td>
                {perms.map((p) => (r.permissions || []).includes(p)).map((ok, i) => (
                  <td key={i} className={clsx(celdaMono, 'text-center')}>{ok ? <Check className="mx-auto size-4 text-ok" aria-label="sí" /> : <X className="mx-auto size-4 text-faint" aria-label="no" />}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-1 font-mono text-[12px] text-muted sm:grid-cols-2">
        {perms.map((p) => <li key={p}><b className="font-semibold text-soft">{p}</b>: {PERMISO_TXT[p].toLowerCase()}.</li>)}
      </ul>
    </section>
  );
}

/* ---------- invitar ---------- */
function Invitar({ client, roles, onCreada }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('operador');
  const [msg, setMsg] = useState(null);
  const [creada, setCreada] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  async function crear(e) {
    e.preventDefault(); setMsg(null); setCreada(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setMsg('Escribe un correo válido.');
    setOcupado(true);
    try { setCreada(await client.createInvitation({ email: email.trim(), role })); setEmail(''); onCreada(); } catch (er) { setMsg(textoError(er, 'No se pudo crear la invitación.')); } finally { setOcupado(false); }
  }
  const copiar = async () => { try { await navigator.clipboard.writeText(creada.link); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* sin portapapeles */ } };
  return (
    <div className="grid gap-2 rounded-2xl bg-ink/[0.03] p-3 shadow-[inset_0_0_0_var(--t-hair-w)_rgb(var(--ink-rgb)/calc(0.1*var(--t-hair-a)))]">
      <form onSubmit={crear} noValidate className="flex flex-wrap items-end gap-2" aria-label="Nueva invitación">
        <label className="grid min-w-52 flex-1 gap-1 text-[12px] text-muted">Correo a invitar
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@empresa.mx" className="h-9 rounded-xl bg-ink/[0.06] px-3 text-[13.5px] text-fg outline-none focus:shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.55)]" />
        </label>
        <label className="grid gap-1 text-[12px] text-muted">Rol
          <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 rounded-xl bg-ink/[0.06] px-2 text-[13.5px] text-fg outline-none [&>option]:bg-deep">{roles.filter((r) => r.id !== 'pendiente').map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        </label>
        <Button type="submit" variant="primary" size="sm" loading={ocupado}><Plus className="size-4" aria-hidden />Crear invitación</Button>
      </form>
      {msg ? <p role="alert" className="text-[12.5px] text-crit">{msg}</p> : null}
      {creada ? (
        <div role="status" className="grid gap-1.5 rounded-xl bg-ok/10 p-3 text-[12.5px]">
          <p>Invitación para <b className="font-medium">{creada.email}</b> como <b className="font-medium">{roleLabel(creada.role)}</b>. Vale {creada.expiresInDays} días y un solo uso. <b className="font-medium">El enlace se muestra solo ahora</b>: entrégaselo (aún no hay correo automático).</p>
          <div className="flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-ink/[0.08] px-2 py-1.5 font-mono text-[12px]">{creada.link}</code>
            <Button size="sm" onClick={copiar}>{copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}{copiado ? 'Copiado' : 'Copiar'}</Button></div>
        </div>
      ) : null}
    </div>
  );
}

export function Accounts() {
  const { client, user: me } = useAuth();
  const permitido = !!me?.permissions?.includes('usuarios');
  const [tabla, setTabla] = useState('users');
  const [limite, setLimite] = useState(100);
  const [auto, setAuto] = useState(false);
  const [filtroLog, setFiltroLog] = useState('todos');
  const [sel, setSel] = useState(null); // { tabla, id }
  const [rolMsg, setRolMsg] = useState(null);
  const [revocar, setRevocar] = useState(null); // id de la invitación que espera confirmación
  const d = useCuentas(client, limite, permitido && typeof client.listUsers === 'function');

  // Registros nuevos: lo «visto» al entrar se guarda; al cambiar de tabla o salir se marca todo como visto.
  const vistos0 = useRef(null);
  if (vistos0.current === null) vistos0.current = leerVistos();
  const [ajuste, setAjuste] = useState({}); // «marcar como vistos» dentro de la visita
  const visto = (t) => ajuste[t] || vistos0.current[t] || null;
  const tablaRef = useRef(tabla); tablaRef.current = tabla;
  useEffect(() => { // primera vez: empieza a contar desde ahora
    const v = vistos0.current, ahora = new Date().toISOString();
    Object.keys(CAMPO_NUEVO).forEach((t) => { if (!v[t]) marcarVisto(t, ahora); });
    return () => { if (CAMPO_NUEVO[tablaRef.current]) marcarVisto(tablaRef.current, new Date().toISOString()); };
  }, []);
  const irA = (t) => { if (CAMPO_NUEVO[tabla]) marcarVisto(tabla, new Date().toISOString()); setTabla(t); setSel(null); };
  const marcarTodo = () => { const iso = new Date().toISOString(); marcarVisto(tabla, iso); setAjuste((a) => ({ ...a, [tabla]: iso })); };

  useEffect(() => { // actualización automática
    if (!auto || !permitido) return undefined;
    const t = setInterval(() => { d.cargar(); }, AUTO_MS);
    return () => clearInterval(t);
  }, [auto, d.cargar]); // eslint-disable-line react-hooks/exhaustive-deps

  const roles = d.roles;
  const cambiarRol = async (id, role) => {
    setRolMsg(null);
    try { await client.setRole(id, role); d.setUsers((u) => u.map((x) => (String(x.id) === String(id) ? { ...x, role } : x))); setRolMsg({ ok: true, text: `Rol actualizado a ${roleLabel(role)}.` }); }
    catch (e) { setRolMsg({ ok: false, text: textoError(e, 'No se pudo cambiar el rol.') }); }
  };
  const quitarInv = async (id) => {
    try { await client.deleteInvitation(id); setRevocar(null); d.cargar(); } catch (e) { setRolMsg({ ok: false, text: textoError(e, 'No se pudo revocar la invitación.') }); }
  };

  const nuevo = (t, k) => (r) => esNuevo(r[CAMPO_NUEVO[t]], visto(t));
  const logs = useMemo(() => (d.log || []).filter((r) => filtroLog === 'todos' || (filtroLog === 'fallidos' ? !r.ok : r.ok)), [d.log, filtroLog]);
  const hace24 = Date.now() - 864e5;
  const fallidos24 = (d.log || []).filter((r) => !r.ok && new Date(r.createdAt).getTime() > hace24).length;
  const accesos24 = (d.log || []).filter((r) => r.ok && new Date(r.createdAt).getTime() > hace24).length;
  const badgeNuevos = { users: contarNuevos(d.users || [], 'createdAt', visto('users')), login_log: contarNuevos(d.log || [], 'createdAt', visto('login_log')), oauth_accounts: contarNuevos(d.oauth || [], 'createdAt', visto('oauth_accounts')), invitations: contarNuevos(d.inv || [], 'createdAt', visto('invitations')) };

  if (!permitido) {
    return (<div><PageHeader title="Accounts" subtitle="Cuentas, accesos y permisos del panel." /><Empty icon={ShieldX} title="Solo para administradores" text="Tu rol no tiene acceso a esta sección. Pídele a un administrador que te cambie el rol si lo necesitas." /></div>);
  }
  if (typeof client.listUsers !== 'function') {
    return (<div><PageHeader title="Accounts" subtitle="Cuentas, accesos y permisos del panel." /><Empty icon={ShieldX} title="Falta la API del panel" text="Esta sección lee las tablas de MySQL a través de panel-flota-api. Enciende la API (npm start) y vuelve a entrar." /></div>);
  }

  const colsUsers = [
    { key: 'id', align: 'right' },
    { key: 'name' }, { key: 'email' }, { key: 'phone' },
    { key: 'role', render: (r) => <SelectRol user={r} me={me} roles={roles} onChange={cambiarRol} />, valor: (r) => r.role, texto: (r) => r.role },
    { key: 'permissions', valor: (r) => sinPermiso(roles, r.role).join(', '), render: (r) => <Chips items={sinPermiso(roles, r.role)} />, texto: (r) => sinPermiso(roles, r.role).join(', ') || '(solo ver mapa y flota)' },
    { key: 'puesto', valor: (r) => r.attributes?.puesto },
    { key: 'last_login_at', valor: (r) => r.lastLoginAt, render: (r) => <Fecha v={r.lastLoginAt} /> },
    { key: 'created_at', valor: (r) => r.createdAt, render: (r) => <Fecha v={r.createdAt} /> },
  ];
  const colsLog = [
    { key: 'id', align: 'right' }, { key: 'user_id', valor: (r) => r.userId, align: 'right' }, { key: 'email' },
    { key: 'ok', valor: (r) => (r.ok ? 1 : 0), render: (r) => (r.ok ? <span className="inline-flex items-center gap-1 text-ok"><ShieldCheck className="size-3.5" aria-hidden />1 · acceso</span> : <span className="inline-flex items-center gap-1 text-crit"><ShieldX className="size-3.5" aria-hidden />0 · rechazado</span>) },
    { key: 'ip' }, { key: 'created_at', valor: (r) => r.createdAt, render: (r) => <Fecha v={r.createdAt} /> },
  ];
  const colsOAuth = [
    { key: 'id', align: 'right' }, { key: 'provider' }, { key: 'email' }, { key: 'user_id', valor: (r) => r.userId, align: 'right' }, { key: 'name' },
    { key: 'created_at', valor: (r) => r.createdAt, render: (r) => <Fecha v={r.createdAt} /> }, { key: 'last_login_at', valor: (r) => r.lastLoginAt, render: (r) => <Fecha v={r.lastLoginAt} /> },
  ];
  const colsInv = [
    { key: 'id', align: 'right' }, { key: 'email' }, { key: 'role', valor: (r) => r.role },
    { key: 'created_at', valor: (r) => r.createdAt, render: (r) => <Fecha v={r.createdAt} /> },
    { key: 'expires_at', valor: (r) => r.expiresAt, render: (r) => <span title={fechaHora(r.expiresAt)}>{relativo(r.expiresAt)}</span> },
    { key: 'acción', csv: false, valor: () => '', render: (r) => (revocar === r.id
      ? <span className="inline-flex items-center gap-1.5"><span>¿Revocar?</span><button type="button" onClick={(e) => { e.stopPropagation(); quitarInv(r.id); }} className="rounded bg-crit/20 px-1.5 text-crit">Sí</button><button type="button" onClick={(e) => { e.stopPropagation(); setRevocar(null); }} className="rounded bg-ink/[0.08] px-1.5">No</button></span>
      : <button type="button" onClick={(e) => { e.stopPropagation(); setRevocar(r.id); }} className="inline-flex items-center gap-1 text-muted hover:text-crit"><Trash2 className="size-3.5" aria-hidden />Revocar</button>) },
  ];

  const T = { users: [d.users, colsUsers, 'users'], login_log: [logs, colsLog, 'login_log'], oauth_accounts: [d.oauth, colsOAuth, 'oauth_accounts'], invitations: [d.inv, colsInv, 'invitations'] };
  const [rowsT, colsT] = T[tabla] || [];
  const filaSel = sel && sel.tabla === tabla && rowsT ? rowsT.find((r) => r.id === sel.id) : null;
  const keyErr = { users: 'users', login_log: 'log', oauth_accounts: 'oauth', invitations: 'inv' }[tabla];

  return (
    <div className="grid gap-6">
      <PageHeader title="Accounts" subtitle="Las tablas de la base de datos del panel: cuentas, accesos, invitaciones y permisos.">
        <span className="text-[12.5px] text-muted" aria-live="polite">{d.at ? `Actualizado ${new Date(d.at).toLocaleTimeString('es-MX', { hour12: false })}` : 'Consultando…'}</span>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-ink/[0.05] px-3 py-2 text-[13px]"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[rgb(var(--accent-rgb))]" />Actualizar cada 30 s</label>
        {rolMsg ? <span role="status" className={clsx('text-[13px]', rolMsg.ok ? 'text-ok' : 'text-crit')}>{rolMsg.text}</span> : null}
      </PageHeader>

      <section className="grid-stats" aria-label="Resumen">
        <Stat label="Cuentas" value={d.users ? d.users.length : '…'} hint={d.users ? `${d.users.filter((u) => u.role === 'super_admin').length} super administrador(es)` : undefined} />
        <Stat label="Accesos (24 h)" value={d.log ? accesos24 : '…'} tone="ok" hint="inicios de sesión correctos" />
        <Stat label="Rechazados (24 h)" value={d.log ? fallidos24 : '…'} tone={fallidos24 ? 'warn' : undefined} hint="contraseña o correo incorrectos" />
        <Stat label="Invitaciones" value={d.inv ? d.inv.length : '…'} hint="vigentes y sin usar" />
        <Stat label="Google / Apple" value={d.oauth ? d.oauth.length : '…'} hint="cuentas ligadas" />
      </section>

      <div role="tablist" aria-label="Tablas" className="flex flex-wrap gap-1.5">
        {TABLAS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tabla === k} onClick={() => irA(k)}
            className={clsx('inline-flex h-9 items-center gap-2 rounded-full px-4 font-mono text-[13px] transition', tabla === k ? 'bg-fg text-onfg' : 'bg-ink/[0.05] text-soft hover:bg-ink/[0.09] hover:text-fg')}>
            {label}
            {badgeNuevos[k] ? <span className="rounded-full bg-ok px-1.5 text-[10.5px] font-bold text-night" title="Registros nuevos desde tu última visita">+{badgeNuevos[k]}</span> : null}
          </button>
        ))}
      </div>

      {tabla === 'roles' ? <MatrizRoles roles={roles} users={d.users} /> : (
        <>
          <TablaDB key={tabla} nombre={tabla} consulta={(CONSULTA[tabla] || '').replace('{n}', limite)} cols={colsT} rows={rowsT} segundos={d.seg[{ users: 'users', login_log: 'log', oauth_accounts: 'oauth', invitations: 'inv' }[tabla]]}
            cargando={d.cargando} error={d.err[keyErr]} onRefresh={d.cargar} esNueva={nuevo(tabla)} onRow={(r) => setSel({ tabla, id: r.id })} seleccionada={sel?.tabla === tabla ? sel.id : null}
            vacio={tabla === 'oauth_accounts' ? 'Empty set (nadie ha entrado con Google o Apple)' : undefined}
            extra={(
              <>
                {tabla === 'login_log' ? (
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    {[['todos', 'Todos'], ['fallidos', 'Rechazados'], ['ok', 'Correctos']].map(([k, l]) => <button key={k} type="button" aria-pressed={filtroLog === k} onClick={() => setFiltroLog(k)} className={clsx('rounded-full px-3 py-1', filtroLog === k ? 'bg-fg text-onfg' : 'bg-ink/[0.06] text-soft hover:bg-ink/[0.1]')}>{l}</button>)}
                    <label className="ml-auto flex items-center gap-2 text-muted">LIMIT <select value={limite} onChange={(e) => setLimite(+e.target.value)} className="h-7 rounded-lg bg-ink/[0.06] px-1.5 font-mono text-[12px] text-fg outline-none [&>option]:bg-deep">{[50, 100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                  </div>
                ) : null}
                {tabla === 'invitations' ? <Invitar client={client} roles={roles} onCreada={d.cargar} /> : null}
                {CAMPO_NUEVO[tabla] && badgeNuevos[tabla] ? <button type="button" onClick={marcarTodo} className="justify-self-start text-[12.5px] text-muted underline hover:text-fg">Marcar los {badgeNuevos[tabla]} registros nuevos como vistos</button> : null}
              </>
            )} />
          {filaSel ? <RegistroG fila={filaSel} cols={colsT.filter((c) => c.csv !== false)} onClose={() => setSel(null)} /> : (rowsT?.length ? <p className="font-mono text-[12px] text-faint">Toca una fila para verla en vertical (como «\G»).</p> : null)}
        </>
      )}
    </div>
  );
}
