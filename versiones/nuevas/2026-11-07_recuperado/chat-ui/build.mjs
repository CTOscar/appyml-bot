// Compila el chat (React + assistant-ui) a un solo archivo que taller.js carga al abrir «Automatización».
// Uso: npm run build   (o npm run watch mientras se edita)
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', 'panelpack', 'assets', 'taller-chat.js');
const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: [path.join(here, 'src', 'main.jsx')],
  outfile: out,
  bundle: true,
  format: 'iife',
  minify: !watch,
  sourcemap: false,
  legalComments: 'eof',
  target: ['chrome100', 'firefox100', 'safari15'],
  jsx: 'automatic',
  // El CSS entra como texto (se inyecta al montar); antes se baja la anidación y se minifica para los mismos navegadores.
  plugins: [{
    name: 'css-texto',
    setup(b) {
      b.onLoad({ filter: /\.css$/ }, async (args) => {
        const fs = await import('node:fs/promises');
        const r = await esbuild.transform(await fs.readFile(args.path, 'utf8'), { loader: 'css', minify: !watch, target: ['chrome100', 'firefox100', 'safari15'] });
        return { contents: r.code, loader: 'text' };
      });
    },
  }],
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  logLevel: 'info',
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
