// Genera src/theme/tokens.css desde design/tokens.json. Uso: npm run tokens  (también corre antes de dev y build).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateAll, renderCss } from '../design/lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const doc = JSON.parse(readFileSync(root + 'design/tokens.json', 'utf8'));
const errs = validateAll(doc);
if (errs.length) { console.error('design/tokens.json inválido:\n - ' + errs.join('\n - ')); process.exit(1); }
const css = renderCss(doc);
writeFileSync(root + 'src/theme/tokens.css', css);
console.log(`tokens.css: ${Object.keys(doc.themes).length} temas (${Object.keys(doc.themes).join(', ')})`);
