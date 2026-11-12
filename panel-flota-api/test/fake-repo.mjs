// test/fake-repo.mjs — repo en memoria para `npm run dev:memory`
export function createFakeRepo() {
  const users = new Map(), sessions = new Map(), oauth = new Map(),
        resets = new Map(), loginLogs = [], samples = new Map(),
        fuel = new Map(), photos = new Map(), invites = new Map();
  let seq = 1;
  const nid = () => seq++; // ids numéricos, igual que MySQL (las rutas comparan con Number(req.params.id))
  const now = () => new Date().toISOString();
  const publicUser = (u) => { if (!u) return null; const { passwordHash, password_hash, resetToken, resetExpires, ...r } = u; return r; };

  const devSet = new Map();
  const fenSet = new Map();
  const repo = {
    mysql: null,
    async ping() { return true; },

    async createUser({ email, passwordHash = null, role = 'user', name = '', ...x }) {
      const u = { id: nid(), email, passwordHash, password_hash: passwordHash, role, name, createdAt: now(), lastLoginAt: null, ...x };
      users.set(u.id, u); return u.id; // igual que repo.mysql: devuelve el id, no el objeto
    },
    async findUserByEmail(email) { for (const u of users.values()) if (u.email === email) return u; return null; },
    async findUserById(id) { return users.get(id) ?? null; },
    async countUsers() { return users.size; },
    async listUsers() { return [...users.values()]; },
    async updateUser(id, ch) { const u = users.get(id); if (!u) return null; const n = { ...u, ...ch }; users.set(id, n); return n; },
    async setPassword(id, h) { return repo.updateUser(id, { passwordHash: h, password_hash: h }); },
    async setRole(id, r) { return repo.updateUser(id, { role: r }); },
    async createInvitation({ tokenHash, email, role, createdBy, expiresAt }) { const id = Number(nid()); invites.set(id, { id, tokenHash, email, role, createdBy, expiresAt: new Date(expiresAt), createdAt: new Date(), usedAt: null }); return id; },
    async findInvitation(h) { for (const i of invites.values()) if (i.tokenHash === h && !i.usedAt && i.expiresAt > new Date()) return i; return null; },
    async findInvitationByEmail(e) { return [...invites.values()].reverse().find((i) => i.email === e && !i.usedAt && i.expiresAt > new Date()) || null; },
    async useInvitation(id) { const i = invites.get(id); if (!i || i.usedAt) return false; i.usedAt = new Date(); return true; },
    async listInvitations() { return [...invites.values()].filter((i) => !i.usedAt && i.expiresAt > new Date()).map(({ id, email, role, createdAt, expiresAt }) => ({ id, email, role, createdAt, expiresAt })).reverse(); },
    async deleteInvitation(id) { const i = invites.get(id); if (!i || i.usedAt) return false; return invites.delete(id); },
    async touchLogin(id) { return repo.updateUser(id, { lastLoginAt: now() }); },
    publicUser,

    deviceSettings: async () => [...devSet.values()],
    saveDeviceSettings: async ({ id, name, attributes }) => { devSet.set(id, { id, name, attributes: attributes || {} }); },
    fenceSettings: async () => [...fenSet.values()],
    saveFenceSettings: async ({ id, name, attributes }) => { fenSet.set(id, { id, name, attributes: attributes || {} }); },

    async createSession({ userId, token, tokenHash, ...x }) { const k = tokenHash ?? token; const s = { token: k, userId, createdAt: now(), ...x }; sessions.set(k, s); return s; },
    async findSessionUser(tk) { const s = sessions.get(tk); return s ? (users.get(s.userId) ?? null) : null; },
    async deleteSession(tk) { return sessions.delete(tk); },
    async deleteUserSessions(uid) { let n = 0; for (const [tk, s] of sessions) if (s.userId === uid) { sessions.delete(tk); n++; } return n; },

    // Mismo contrato que repo.mysql: linkOAuth({ userId, provider, uid, email }); findOAuth devuelve { user_id, ... }
    async linkOAuth({ userId, provider, uid, providerId, ...x }) { const pid = uid ?? providerId; const r = { userId, user_id: userId, provider, providerId: pid, provider_uid: pid, linkedAt: now(), ...x }; oauth.set(`${provider}:${pid}`, r); return r; },
    async findOAuth(p, pid) { return oauth.get(`${p}:${pid}`) ?? null; },
    // Igual que repo.mysql: [{ id, provider, email, userId, name, createdAt, lastLoginAt }]
    async listOAuth(uid) { const o = []; for (const r of oauth.values()) if (uid === undefined || r.userId === uid) o.push({ id: o.length + 1, provider: r.provider, email: r.email ?? null, userId: r.userId, name: users.get(r.userId)?.name ?? null, createdAt: r.linkedAt, lastLoginAt: r.lastLoginAt ?? r.linkedAt }); return o.reverse(); },

    async createReset({ userId, token, expiresAt = Date.now() + 15 * 60 * 1000, ...x }) {
      const u = users.get(userId);
      const r = { userId, email: u?.email ?? null, token, expiresAt, createdAt: Date.now(), ...x };
      resets.set(token, r); return r;
    },
    async consumeReset(tk) { const r = resets.get(tk); if (!r) return null; resets.delete(tk); if (r.expiresAt < Date.now()) return null; return users.get(r.userId) ?? null; },

    // Igual que repo.mysql: logLogin({ userId, email, ok, ip }) y loginLog(limit) → [{ id, userId, email, ok, ip, createdAt }], lo más nuevo primero.
    async logLogin({ userId = null, email = null, ok = true, ip = null }) {
      const r = { id: nid(), userId, email, ok: !!ok, ip, createdAt: now() }; loginLogs.push(r); return r;
    },
    async loginLog(limit = 100) {
      return [...loginLogs].reverse().slice(0, Math.min(Number(limit) || 100, 500));
    },

    async insertSamples(a1, a2) {
      let vid, batch;
      if (Array.isArray(a2)) { vid = a1; batch = a2; } else { batch = a1; vid = null; }
      let n = 0;
      for (const raw of batch) {
        const v = vid ?? raw.vehicleId; if (v == null) continue;
        const s = { id: nid(), at: raw.at ?? raw.ts ?? now(), ...raw };
        if (!samples.has(v)) samples.set(v, []);
        samples.get(v).push(s); n++;
      }
      return n;
    },
    async route(vehicleId, { from = null, to = null, limit = 5000 } = {}) {
      const arr = samples.get(vehicleId) ?? [];
      const f = from ? new Date(from).getTime() : -Infinity;
      const t = to   ? new Date(to).getTime()   : +Infinity;
      return arr.filter(s => { const x = new Date(s.at).getTime(); return x >= f && x <= t; }).slice(-limit);
    },

    async fuelEvents(vehicleId, { from = null, to = null, limit = 500 } = {}) {
      const arr = fuel.get(vehicleId) ?? [];
      const f = from ? new Date(from).getTime() : -Infinity;
      const t = to   ? new Date(to).getTime()   : +Infinity;
      return arr.filter(e => { const x = new Date(e.at).getTime(); return x >= f && x <= t; }).slice(-limit);
    },

    // Foto de perfil: una por cuenta (igual que repo.mysql: savePhoto(userId, mime, data) y getPhoto(userId) → { mime, data, updatedAt }).
    async savePhoto(userId, mime, data) { photos.set(Number(userId), { mime, data, updatedAt: now() }); },
    async getPhoto(userId) { return photos.get(Number(userId)) ?? null; },
    async deletePhoto(userId) { return photos.delete(Number(userId)); },
  };
  return repo;
}

export default createFakeRepo;
