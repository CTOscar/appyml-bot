import 'dotenv/config';

const list = (v) =>
  String(v || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 3100,
    production: env.NODE_ENV === 'production',
    anthropicKey: env.ANTHROPIC_API_KEY || '',
    models: {
      campo: env.MODEL_CAMPO || 'claude-haiku-5-5',
      taller: env.MODEL_TALLER || 'claude-sonnet-5-5',
      estrategia: env.MODEL_ESTRATEGIA || 'claude-opus-5-5',
    },
    db: {
      host: env.DB_HOST || 'localhost',
      port: Number(env.DB_PORT) || 3306,
      user: env.DB_USER || '',
      password: env.DB_PASSWORD ?? '',
      name: env.DB_NAME || '',
    },
    // Usuario de solo lectura para el MCP Fleet-DB (si no hay, usa el normal).
    mcpDb: {
      user: env.MCP_DB_USER || env.DB_USER || '',
      password: env.MCP_DB_USER ? (env.MCP_DB_PASSWORD ?? '') : (env.DB_PASSWORD ?? ''),
    },
    panelApiUrl: (env.PANEL_API_URL || 'http://localhost:3000/api/panel').replace(/\/$/, ''),
    sessionCookie: env.SESSION_COOKIE || 'pf_sid',
    allowedOrigins: list(env.ALLOWED_ORIGINS),
  };
}
