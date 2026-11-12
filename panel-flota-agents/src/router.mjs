// Enrutamiento por rol (permisos) y, solo si no hay rol, por canal. El rol manda sobre el canal:
// un operador que entra por la web sigue siendo operador.
const POR_ROL = {
  operador: 'campo',
  jefe_campo: 'campo',
  jefe_taller: 'taller',
  almacenista: 'taller',
  director: 'estrategia',
};
const POR_CANAL = { voz_movil: 'campo', app_movil: 'campo', web_taller: 'taller', web_estrategia: 'estrategia' };

// Agentes ya construidos en esta etapa. Los demás responden 501 hasta su fase.
export const AGENTES_ACTIVOS = new Set(['campo']);

// `requested` solo lo respeta si la cuenta es administradora (útil para probar).
export function resolveAgent({ agentRole, channel, requested, isAdmin }) {
  let agent;
  if (isAdmin && requested && Object.values(POR_ROL).includes(requested)) agent = requested;
  else if (agentRole && POR_ROL[agentRole]) agent = POR_ROL[agentRole];
  else if (channel && POR_CANAL[channel]) agent = POR_CANAL[channel];
  else agent = 'campo'; // respaldo: el modelo rápido y barato, con herramientas de solo lectura
  return { agent, available: AGENTES_ACTIVOS.has(agent) };
}
