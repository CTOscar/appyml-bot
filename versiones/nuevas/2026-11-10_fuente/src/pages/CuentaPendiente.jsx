// Cuenta recién registrada: no ve nada del panel ni del bot hasta que un administrador le asigne un rol.
// Se usa en el panel completo (App.jsx) y en el bot (BotApp.jsx).
import { useState } from 'react';
import { Hourglass, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '../ui/index.jsx';
import { Cosmos } from '../layout/Cosmos.jsx';
import { esPendiente } from '../lib/roles.js';

/**
 * @param {{ user: object, onRevisar: () => Promise<object|null>, onSalir: () => void }} props
 * onRevisar vuelve a pedir la sesión a la API y devuelve el usuario; si ya tiene rol, quien la usa deja de mostrar esta pantalla.
 */
export function CuentaPendiente({ user, onRevisar, onSalir }) {
  const [revisando, setRevisando] = useState(false);
  const [aviso, setAviso] = useState('');

  async function revisar() {
    setRevisando(true);
    setAviso('');
    try {
      const u = await onRevisar();
      if (!u || esPendiente(u)) setAviso('Todavía no tienes un rol asignado. Avísale a tu administrador.');
    } catch {
      setAviso('No se pudo revisar ahora. Inténtalo otra vez en un momento.');
    } finally {
      setRevisando(false);
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <Cosmos />
      <section className="glass relative w-full max-w-md rounded-3xl p-7 text-center sm:p-9" aria-labelledby="pendiente-titulo">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-warn/15 text-warn"><Hourglass className="size-6" aria-hidden /></span>
        <h1 id="pendiente-titulo" className="display mt-5 text-3xl sm:text-4xl">Tu cuenta está pendiente de aprobación</h1>
        <p className="mt-3 text-[15px] text-soft">
          Ya te registraste{user?.email ? <> como <b className="font-medium text-fg">{user.email}</b></> : null}. Un administrador debe asignarte un rol
          (administrador, jefe de almacén, supervisor u operador) para que puedas ver la flota. Cuando lo haga, toca «Revisar de nuevo».
        </p>
        {aviso ? <p role="status" className="mt-4 rounded-xl bg-warn/10 px-3 py-2 text-[13.5px] text-warn">{aviso}</p> : null}
        <div className="mt-6 grid gap-2.5">
          <Button type="button" variant="primary" size="lg" loading={revisando} onClick={revisar} className="w-full"><RefreshCw className="size-4" aria-hidden />Revisar de nuevo</Button>
          <Button type="button" variant="glass" onClick={onSalir} className="w-full"><LogOut className="size-4" aria-hidden />Salir</Button>
        </div>
      </section>
    </div>
  );
}
