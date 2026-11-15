/**
 * The staging copy of the Supabase project (a « branch »: its own database, separate from production).
 * Modes: `probe` only reads (what the plan allows, whether a staging copy exists); `create` asks Supabase
 * for a staging branch named « staging »; `adopt` compares the branch's schema with production's (read only on production) and records on the
 * branch the migrations production has already received, since Supabase copies the schema, not our record of
 * it; `schema` applies supabase/migrations to that branch, and only to it (it refuses to run if the branch's
 * reference is production's). Nothing here reads or writes production
 * data, and no key, password or address is printed.
 * Env: SUPABASE_ACCESS_TOKEN. Usage: node scripts/staging.mjs probe|create|adopt|schema
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

if (mode === 'adopt') {
  console.log('\n## Comparing the staging branch with production, then recording what it already holds');
  const staging = Array.isArray(branches) ? branches.find((b) => b.name === 'staging') : null;
  if (!staging?.project_ref || staging.project_ref === ref || staging.is_default) {
    console.log('no separate staging branch: nothing done');
    process.exit(1);
  }
  const sql = (project, query, readOnly) => call('POST', `/projects/${project}/database/query`, { query, read_only: readOnly });
  const shape = `select
    (select count(*) from information_schema.tables where table_schema in ('public', 'private'))::int as tables,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private'))::int as functions,
    (select count(*) from pg_policies where schemaname in ('public', 'private', 'storage'))::int as policies,
    (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname in ('public', 'private', 'auth', 'storage'))::int as triggers,
    (select count(*) from pg_indexes where schemaname in ('public', 'private'))::int as indexes,
    (select count(*) from pg_publication_tables where pubname = 'supabase_realtime')::int as realtime_tables,
    (select md5(string_agg(md5(pg_get_functiondef(p.oid)), ',' order by p.oid::regprocedure::text)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prokind = 'f') as functions_print,
    (select md5(string_agg(schemaname || '.' || tablename || '.' || policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), ',' order by schemaname, tablename, policyname)) from pg_policies where schemaname in ('public', 'private', 'storage')) as policies_print,
    (select count(*) from cron.job)::int as scheduled_jobs,
    (select count(*) from auth.users)::int as accounts,
    (select count(*) from public.profiles)::int as profiles,
    (select count(*) from public.messages)::int as messages,
    (select count(*) from public.push_tokens)::int as push_tokens,
    current_setting('server_version') as version, current_setting('max_connections') as max_connections, current_setting('shared_buffers') as shared_buffers, current_setting('effective_cache_size') as effective_cache_size`;
  const live = await sql(ref, shape, true);
  const copy = await sql(staging.project_ref, shape, true);
  console.log('production:', live.failed ?? JSON.stringify(live[0]));
  console.log('staging:   ', copy.failed ?? JSON.stringify(copy[0]));
  if (live.failed || copy.failed) process.exit(1);
  const same = ['tables', 'functions', 'policies', 'triggers', 'indexes', 'functions_print', 'policies_print'].filter((k) => live[0][k] !== copy[0][k]);
  console.log(same.length ? `DIFFERENT: ${same.join(', ')}` : 'same tables, functions, policies, triggers and indexes');
  if (copy[0].accounts > 0 || copy[0].profiles > 0 || copy[0].messages > 0) console.log('WARNING: the staging branch holds rows');
  const names = await sql(ref, 'select name from private.irly_migrations order by 1', true);
  if (names.failed) {
    console.log(names.failed);
    process.exit(1);
  }
  if (same.length) {
    // Supabase copies the public and private schemas; what is attached to its own schemas (storage's
    // policies, triggers on auth and storage) is not. Those are read from production's catalogue
    // (definitions only, no rows) and created on the branch.
    const policySql = `select schemaname, tablename, policyname, permissive, array_to_string(roles, ',') as roles, cmd, qual, with_check from pg_policies where schemaname in ('public', 'private', 'storage') order by 1, 2, 3`;
    const triggerSql = `select n.nspname as schema, c.relname as tbl, t.tgname as name, pg_get_triggerdef(t.oid) as def from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname in ('public', 'private', 'auth', 'storage') order by 1, 2, 3`;
    const [lp, cp, lt, ct] = [await sql(ref, policySql, true), await sql(staging.project_ref, policySql, true), await sql(ref, triggerSql, true), await sql(staging.project_ref, triggerSql, true)];
    if ([lp, cp, lt, ct].some((r) => r.failed)) {
      console.log([lp, cp, lt, ct].map((r) => r.failed).filter(Boolean).join('\n'));
      process.exit(1);
    }
    const key = (r) => `${r.schemaname ?? r.schema}.${r.tablename ?? r.tbl}.${r.policyname ?? r.name}`;
    const haveP = new Set(cp.map(key));
    const haveT = new Set(ct.map(key));
    const missingP = lp.filter((r) => !haveP.has(key(r)));
    const missingT = lt.filter((r) => !haveT.has(key(r)));
    const extra = [...cp.filter((r) => !new Set(lp.map(key)).has(key(r))), ...ct.filter((r) => !new Set(lt.map(key)).has(key(r)))].map(key);
    console.log(`policies missing on staging: ${missingP.map(key).join(', ') || 'none'}`);
    console.log(`triggers missing on staging: ${missingT.map(key).join(', ') || 'none'}`);
    console.log(`only on staging: ${extra.join(', ') || 'none'}`);
    const changed = lp.filter((r) => haveP.has(key(r)) && JSON.stringify(r) !== JSON.stringify(cp.find((x) => key(x) === key(r)))).map(key);
    console.log(`policies with another definition: ${changed.join(', ') || 'none'}`);
    if (missingP.some((r) => r.schemaname !== 'storage') || changed.length || extra.length) {
      console.log('differences outside what Supabase leaves out: nothing changed');
      process.exit(1);
    }
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const ddl = [
      ...missingP.map((r) => `create policy ${q(r.policyname)} on ${q(r.schemaname)}.${q(r.tablename)} as ${r.permissive === 'PERMISSIVE' ? 'permissive' : 'restrictive'} for ${r.cmd.toLowerCase()} to ${r.roles.split(',').map((x) => (x === 'public' ? 'public' : q(x))).join(', ')}${r.qual ? ` using (${r.qual})` : ''}${r.with_check ? ` with check (${r.with_check})` : ''};`),
      ...missingT.map((r) => `${r.def};`),
    ];
    const made = await sql(staging.project_ref, `begin;\n${ddl.join('\n')}\ncommit;`, false);
    console.log(made.failed ?? `created on staging: ${missingP.length} policies, ${missingT.length} triggers`);
    if (made.failed) process.exit(1);
    const again = await sql(staging.project_ref, shape, true);
    const still = ['tables', 'functions', 'policies', 'triggers', 'indexes', 'functions_print', 'policies_print'].filter((k) => live[0][k] !== again[0]?.[k]);
    console.log(still.length ? `STILL DIFFERENT: ${still.join(', ')}` : 'now the same tables, functions, policies, triggers and indexes');
    if (still.length) process.exit(1);
  }
  // Scheduled jobs are rows, so they were not copied: the ones that only call a function of ours are
  // scheduled on the branch too (their text holds no key). Jobs with anything else in them are left out.
  const jobs = await sql(ref, 'select jobname, schedule, command from cron.job order by jobname', true);
  if (!jobs.failed) {
    const plain = jobs.filter((j) => /^\s*select\s+(private|public)\.[a-z_0-9]+\(\s*\)\s*;?\s*$/i.test(j.command));
    console.log(`scheduled jobs in production: ${jobs.length}; copied (plain function calls): ${plain.map((j) => j.jobname).join(', ') || 'none'}; left out: ${jobs.filter((j) => !plain.includes(j)).map((j) => j.jobname).join(', ') || 'none'}`);
    const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
    if (plain.length) {
      const sched = await sql(staging.project_ref, plain.map((j) => `select cron.schedule(${lit(j.jobname)}, ${lit(j.schedule)}, ${lit(j.command)});`).join('\n'), false);
      console.log(sched.failed ?? 'jobs scheduled on staging');
    }
  }
  const values = names.map((r) => `('${String(r.name).replace(/'/g, "''")}')`).join(', ');
  const done = await sql(staging.project_ref, `create schema if not exists private; create table if not exists private.irly_migrations (name text primary key, applied_at timestamptz not null default now()); insert into private.irly_migrations (name) values ${values} on conflict do nothing; select count(*)::int as recorded from private.irly_migrations;`, false);
  console.log(done.failed ?? `recorded on staging: ${JSON.stringify(done)} (production has ${names.length})`);
}
