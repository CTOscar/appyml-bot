import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Aplica sql/*.sql (todas las sentencias son CREATE TABLE IF NOT EXISTS: es idempotente).
export async function applySchema(pool) {
  const file = fileURLToPath(new URL('../sql/001_agentes.sql', import.meta.url));
  const text = await readFile(file, 'utf8');
  const sinComentarios = text.replace(/^\s*--.*$/gm, '');
  const sentencias = sinComentarios.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentencias) await pool.query(s);
  return sentencias.length;
}
