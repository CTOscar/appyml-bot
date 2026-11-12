import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// En desarrollo, /api/panel se reenvía a panel-flota-api (misma dirección = la cookie de sesión funciona).
// PANEL_ORIGIN (opcional, solo desarrollo): Origin con el que llega la petición, para una API cuyo ALLOWED_ORIGINS no incluye :5174.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.PANEL_PROXY || 'http://localhost:3000';
  return {
    plugins: [react(), tailwindcss(), {
      // /bot (sin diagonal final) debe abrir el bot y no el panel
      name: 'bot-slash',
      configureServer(server) { server.middlewares.use((req, res, next) => { if (req.url === '/bot' || req.url?.startsWith('/bot?')) { res.statusCode = 302; res.setHeader('Location', req.url.replace('/bot', '/bot/')); res.end(); return; } next(); }); },
      configurePreviewServer(server) { server.middlewares.use((req, res, next) => { if (req.url === '/bot' || req.url?.startsWith('/bot?')) { res.statusCode = 302; res.setHeader('Location', req.url.replace('/bot', '/bot/')); res.end(); return; } next(); }); },
    }],
    server: {
      port: 5174,
      strictPort: true,
      // Túneles (la URL gratuita cambia en cada arranque; el punto inicial acepta cualquier subdominio).
      allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.trycloudflare.com', '.loca.lt'],
      proxy: {
        '/api/panel': {
          target,
          changeOrigin: false,
          configure: (proxy) => {
            if (env.PANEL_ORIGIN) proxy.on('proxyReq', (req) => req.setHeader('origin', env.PANEL_ORIGIN));
          },
        },
      },
    },
    
    // Dos entradas: el panel (index.html) y el bot instalable (bot/index.html → /bot/).
    // APP_SOLO_BOT=1 (apps/build-web.mjs): solo el bot, en la carpeta APP_OUT_DIR, para empaquetarlo en las apps de escritorio y Android.
    build: { outDir: env.APP_OUT_DIR || 'dist', sourcemap: false, chunkSizeWarningLimit: 900, rollupOptions: { input: env.APP_SOLO_BOT === '1' ? { bot: resolve(process.cwd(), 'bot/index.html') } : { main: resolve(process.cwd(), 'index.html'), bot: resolve(process.cwd(), 'bot/index.html') } } },
    test: { environment: 'jsdom', include: ['src/**/*.test.{js,jsx}'] },
  };
});
