// Cliente de la API propia del panel (panel-flota-api, rutas /api/panel).
// Sesión por cookie: todas las llamadas usan credentials: 'include'.
export function createPanelClient(baseUrl) {
  const root = `${baseUrl.replace(/\/$/, '')}/api/panel`;

  async function req(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(root + path, {
        method,
        credentials: 'include',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw Object.assign(new Error('No hay conexión con el servidor del panel'), { status: 0 });
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(data?.error || `Error ${res.status}`), { status: res.status });
    return data;
  }

  // Foto de perfil como URL de objeto (blob:); null si no hay o no se pudo leer.
  // Quien no tiene foto responde 404: se recuerda para no repetir la petición (y el error en consola) en cada visita.
  const sinFoto = new Set();
  async function getPhoto(userId) {
    if (sinFoto.has(String(userId))) return null;
    let res;
    try {
      res = await fetch(`${root}/users/${userId}/photo`, { credentials: 'include' });
    } catch {
      return null;
    }
    if (res.status === 404) sinFoto.add(String(userId));
    return res.ok ? URL.createObjectURL(await res.blob()) : null;
  }

  const iso = (d) => new Date(d).toISOString();

  return {
    getSession: () => req('/session'),
    providers: () => req('/auth/providers'),
    socialUrl: (provider) => `${root}/auth/${provider}`,
    login: (email, password, remember = true) => req('/login', { method: 'POST', body: { email, password, remember } }),
    logout: () => req('/session', { method: 'DELETE' }),
    register: (u) =>
      req('/register', { method: 'POST', body: { name: u.name, email: u.email, phone: u.phone, password: u.password, attributes: u.attributes } }),
    resetPassword: (email) => req('/password/reset', { method: 'POST', body: { email } }),
    updateUser: (u) =>
      req(`/users/${u.id}`, {
        method: 'PUT',
        body: { name: u.name, email: u.email, phone: u.phone, attributes: u.attributes, ...(u.password ? { password: u.password, currentPassword: u.currentPassword } : {}) },
      }),
    listUsers: () => req('/users'),
    getRoles: () => req('/roles'),
    loginLog: (limit = 100) => req(`/login-log?limit=${limit}`),
    oauthAccounts: () => req('/oauth-accounts'),
    invitations: () => req('/invitations'),
    createInvitation: ({ email, role }) => req('/invitations', { method: 'POST', body: { email, role } }),
    deleteInvitation: (id) => req(`/invitations/${id}`, { method: 'DELETE' }),
    setRole: (id, role) => req(`/users/${id}/role`, { method: 'PATCH', body: { role } }),
    getPhoto,
    setPhoto: (id, image) => { sinFoto.delete(String(id)); return req(`/users/${id}/photo`, { method: 'PUT', body: { image } }); },
    removePhoto: (id) => req(`/users/${id}/photo`, { method: 'DELETE' }),
    getDevices: () => req('/devices'),
    saveDevice: (d) => req(`/devices/${d.id}`, { method: 'PUT', body: { name: d.name, attributes: d.attributes } }),
    getFences: () => req('/fences'),
    saveFence: (g) => req(`/fences/${g.id}`, { method: 'PUT', body: { name: g.name, attributes: g.attributes } }),
    getRoute: (deviceId, from, to) => req(`/route?deviceId=${deviceId}&from=${encodeURIComponent(iso(from))}&to=${encodeURIComponent(iso(to))}`),
  };
}
