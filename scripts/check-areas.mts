/**
 * Every neighbourhood the app offers exists on the server (public.areas),
 * so a session created there has its area page, recommendations and map
 * position. Reads the migrations; no database needed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CITIES } from '../src/data/destinations.ts';

const dir = path.join(import.meta.dirname, '..', 'supabase', 'migrations');
const sql = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const server = new Set([...sql.matchAll(/\(\s*'([a-z]+)',\s*'([a-z0-9_]+)'/g)].map((m) => `${m[1]}:${m[2]}`));
const missing: string[] = [];
let n = 0;
for (const city of Object.values(CITIES)) {
  for (const a of city.areas) {
    n += 1;
    if (!server.has(`${city.id}:${a.id}`)) missing.push(`${city.id}:${a.id} (${a.name})`);
  }
}
if (missing.length) {
  console.error(`✗ ${missing.length} app neighbourhood(s) missing on the server:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`areas ok: all ${n} app neighbourhoods exist on the server`);
