import express from 'express';
import { sessionUser } from './auth.mjs';
import { resolveAgent } from './router.mjs';
import { runAgent } from './runner.mjs';
import { logUsage } from './usage-log.mjs';
import { botCampo } from './agents/bot-campo.mjs';

const AGENTES = { campo: botCampo };
const MAX_MENSAJES = 20;
const MAX_CHARS = 2000;
const LIMITE_POR_MIN = 20;

// Valida el historial que manda el panel: solo texto, roles user/assistant, empieza y termina en "user".
export function cleanMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out = [];
  for (const m of raw.slice(-MAX_MENSAJES)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null;
    const content = m.content.trim().slice(0, MAX_CHARS);
    if (content) out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}

export function createApp({ config, pool, client, bridge, fetchImpl }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  // CORS: solo los orígenes del panel, con cookies.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  const ventanas = new Map();
  const permitido = (userId) => {
    const ahora = Date.now();
    const v = (ventanas.get(userId) ?? []).filter((t) => ahora - t < 60_000);
    if (v.length >= LIMITE_POR_MIN) return false;
    v.push(ahora);
    ventanas.set(userId, v);
    return true;
  };

  const rolDeAgente = async (userId) => {
    const [rows] = await pool.query('SELECT agent_role FROM agent_roles WHERE user_id = ? LIMIT 1', [userId]);
    return rows[0]?.agent_role ?? null;
  };

  app.get('/health', (_req, res) => res.json({ ok: true, agentes: Object.keys(AGENTES) }));

  app.get('/me', async (req, res) => {
    const user = await sessionUser(req, config, fetchImpl);
    if (!user) return res.status(401).json({ error: 'Sin sesión' });
    const agentRole = await rolDeAgente(user.id);
    const { agent, available } = resolveAgent({ agentRole, isAdmin: user.role === 'admin' });
    res.json({ id: user.id, name: user.name, agentRole, agent, available });
  });

  app.post('/chat', async (req, res) => {
    const user = await sessionUser(req, config, fetchImpl);
    if (!user) return res.status(401).json({ error: 'Sin sesión' });
    if (!permitido(user.id)) return res.status(429).json({ error: 'Demasiadas consultas, espera un momento.' });

    const messages = cleanMessages(req.body?.messages);
    if (!messages) return res.status(400).json({ error: 'messages inválido: texto, roles user/assistant, termina en user.' });

    const agentRole = await rolDeAgente(user.id);
    const { agent, available } = resolveAgent({
      agentRole,
      channel: typeof req.body.channel === 'string' ? req.body.channel : undefined,
      requested: typeof req.body.agent === 'string' ? req.body.agent : undefined,
      isAdmin: user.role === 'admin',
    });
    if (!available) return res.status(501).json({ error: `El agente "${agent}" aún no está disponible.`, agent });

    const def = AGENTES[agent];
    const model = config.models[def.modelKey];
    try {
      const r = await runAgent({ client, bridge, agent: def, model, messages, meta: { userId: user.id } });
      await logUsage(pool, { userId: user.id, agent, model, ...r });
      res.json({
        agent, model, reply: r.text, stopReason: r.stopReason,
        usage: { inputTokens: r.inputTokens, outputTokens: r.outputTokens, toolCalls: r.toolCalls, latencyMs: r.latencyMs },
      });
    } catch (e) {
      console.error('[chat]', e.status ?? '', e.message);
      await logUsage(pool, { userId: user.id, agent, model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, toolCalls: 0, iterations: 0, stopReason: 'error', latencyMs: 0, ok: false });
      res.status(502).json({ error: 'El asistente no pudo responder. Intenta de nuevo.' });
    }
  });

  return app;
}
