/**
 * The staging copy of the Supabase project (a « branch »: its own database, separate from production).
 * Modes: `probe` only reads (what the plan allows, whether a staging copy exists); `create` asks Supabase
 * for a staging branch named « staging »; `schema` applies supabase/migrations to that branch, and only to it
 * (it refuses to run if the branch's reference is production's). Nothing here reads or writes production
 * data, and no key, password or address is printed.
 * Env: SUPABASE_ACCESS_TOKEN. Usage: node scripts/staging.mjs probe|create|schema
 */
import { spawnSync } from 'node:child_process';

const raw = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const token = (raw.match(/sbp_[A-Za-z0-9_]+/) || [])[0];
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is not set: nothing done.');
  process.exit(1);
}
const mode = process.argv[2] || 'probe';
const ref = 'yqutcmgslwxcmnsqmhvy';
const base = 'https://api.supabase.com/v1';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const cut = (v, n = 300) => {
  const s = String(v ?? '').replace(/\s+/g, ' ');
  return s.length > n ? `${s.slice(0, n)}…` : s;
};
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));
async function call(method, path, body) {
  try {
    const res = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await res.text();
    if (!res.ok) return { failed: `${res.status} ${cut(text, 240)}` };
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return { failed: String(e.message) };
  }
}
const BRANCH = ['id', 'name', 'project_ref', 'parent_project_ref', 'is_default', 'persistent', 'status', 'created_at', 'with_data'];

console.log('## Project fields (names only)');
const project = await call('GET', `/projects/${ref}`);
console.log(project.failed ?? Object.keys(project).join(', '));

console.log('\n## Backups (kept only on a paid plan)');
const backups = await call('GET', `/projects/${ref}/database/backups`);
if (backups.failed) console.log(backups.failed);
else {
  const list = backups.backups ?? [];
  console.log(JSON.stringify({ ...pick(backups, ['region', 'walg_enabled', 'pitr_enabled']), count: list.length, newest: list[0]?.inserted_at ?? null, oldest: list[list.length - 1]?.inserted_at ?? null, kinds: [...new Set(list.map((b) => b.status))] }));
}

console.log('\n## Staging branches');
const branches = await call('GET', `/projects/${ref}/branches`);
console.log(branches.failed ?? JSON.stringify((Array.isArray(branches) ? branches : []).map((b) => pick(b, BRANCH))));

if (mode === 'create') {
  console.log('\n## Creating the staging branch');
  const existing = Array.isArray(branches) ? branches.find((b) => b.name === 'staging') : null;
  if (existing) console.log(`already there: ${JSON.stringify(pick(existing, BRANCH))}`);
  else {
    const made = await call('POST', `/projects/${ref}/branches`, { branch_name: 'staging', persistent: true });
    console.log(made.failed ?? JSON.stringify(pick(made, BRANCH)));
    if (made.failed) process.exitCode = 1;
  }
}

if (mode === 'schema') {
  console.log('\n## Applying the migrations to the staging branch');
  const staging = Array.isArray(branches) ? branches.find((b) => b.name === 'staging') : null;
  if (!staging?.project_ref) {
    console.log('no staging branch: nothing applied');
    process.exit(1);
  }
  if (staging.project_ref === ref || staging.is_default) {
    console.log('the staging branch points at production: refused');
    process.exit(1);
  }
  const health = await call('GET', `/projects/${staging.project_ref}/health?services=db&services=rest&services=auth&services=realtime`);
  console.log('services:', health.failed ?? JSON.stringify((Array.isArray(health) ? health : []).map((x) => pick(x, ['name', 'status']))));
  const run = spawnSync(process.execPath, ['scripts/deploy-db.mjs'], { env: { ...process.env, SUPABASE_PROJECT_REF: staging.project_ref }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const lines = `${run.stdout ?? ''}${run.stderr ?? ''}`.split('\n');
  const added = lines.filter((l) => l.startsWith('+ ')).length;
  console.log(`migrations applied in this run: ${added}`);
  console.log(lines.filter((l) => !l.startsWith('+ ') && !l.startsWith('= ')).join('\n').slice(0, 6000));
  process.exitCode = run.status ?? 1;
}
