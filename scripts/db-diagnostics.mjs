/**
 * Reads the health of the live Supabase project and prints it: the plan and the size of the machine, the
 * database's settings and connections, the queries that really cost the most (pg_stat_statements), tables and
 * indexes, scheduled jobs, Realtime, storage. READ ONLY: every statement is a SELECT, sent with read_only.
 * Nothing personal is printed: counts, sizes, timings and query shapes (pg_stat_statements stores queries with
 * their values replaced by $1, $2…), never rows of members' data.
 * Env: SUPABASE_ACCESS_TOKEN (the database deploy's). Usage: node scripts/db-diagnostics.mjs
 */
const raw = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const token = (raw.match(/sbp_[A-Za-z0-9_]+/) || [])[0];
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is not set: nothing read.');
  process.exit(1);
}
const ref = 'yqutcmgslwxcmnsqmhvy';
const base = 'https://api.supabase.com/v1';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const title = (s) => console.log(`\n## ${s}`);
const cut = (v, n = 150) => {
  const s = String(v ?? '').replace(/\s+/g, ' ');
  return s.length > n ? `${s.slice(0, n)}…` : s;
};
function table(rows, max = 40) {
  if (!Array.isArray(rows)) return console.log(cut(JSON.stringify(rows), 600));
  if (!rows.length) return console.log('(no row)');
  const cols = Object.keys(rows[0]);
  console.log(cols.join(' | '));
  for (const r of rows.slice(0, max)) console.log(cols.map((c) => cut(r[c], c === 'query' ? 230 : 70)).join(' | '));
  if (rows.length > max) console.log(`… ${rows.length - max} more`);
}
async function get(path) {
  try {
    const res = await fetch(base + path, { headers });
    const text = await res.text();
    if (!res.ok) return { failed: `${res.status} ${cut(text, 160)}` };
    return JSON.parse(text);
  } catch (e) {
    return { failed: String(e.message) };
  }
}
async function sql(label, query, max) {
  title(label);
  try {
    const res = await fetch(`${base}/projects/${ref}/database/query`, { method: 'POST', headers, body: JSON.stringify({ query, read_only: true }) });
    const text = await res.text();
    if (!res.ok) return console.log(`could not read: ${res.status} ${cut(text, 300)}`);
    table(JSON.parse(text), max);
  } catch (e) {
    console.log(`could not read: ${e.message}`);
  }
}
/** Only the named keys of an object, so that no token, key or address is ever printed. */
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));

/* ───────── The project, the plan, the machine ───────── */
title('Project');
const project = await get(`/projects/${ref}`);
console.log(project.failed ?? JSON.stringify(pick(project, ['name', 'region', 'status', 'created_at']) ));
console.log('database:', project.failed ? '' : JSON.stringify(pick(project.database ?? {}, ['version', 'postgres_engine', 'release_channel'])));
title('Organisation and plan');
if (!project.failed && project.organization_id) {
  const org = await get(`/organizations/${project.organization_id}`);
  console.log(org.failed ?? JSON.stringify(pick(org, ['plan', 'opt_in_tags', 'allowed_release_channels'])));
  const projects = await get('/projects');
  console.log('projects in this account:', Array.isArray(projects) ? projects.map((p) => `${p.name} (${p.region}, ${p.status})`).join('; ') : projects.failed);
}
title('Compute and add-ons');
const addons = await get(`/projects/${ref}/billing/addons`);
if (addons.failed) console.log(addons.failed);
else {
  console.log('selected:', JSON.stringify((addons.selected_addons ?? []).map((a) => pick(a, ['type', 'variant'])).map((a) => ({ type: a.type, id: a.variant?.id, name: a.variant?.name, meta: a.variant?.meta }))));
  console.log('available compute sizes:', (addons.available_addons ?? []).filter((a) => a.type === 'compute_instance').flatMap((a) => (a.variants ?? []).map((v) => `${v.name} ${v.price?.amount ?? ''}${v.price?.interval ? `/${v.price.interval}` : ''}`)).join('; '));
}
for (const [label, path, keys] of [
  ['Pooler', `/projects/${ref}/config/database/pooler`, null],
  ['Postgres settings set by the owner', `/projects/${ref}/config/database/postgres`, null],
  ['Realtime settings', `/projects/${ref}/config/realtime`, null],
  ['PostgREST settings', `/projects/${ref}/postgrest`, ['max_rows', 'db_pool', 'db_schema']],
]) {
  title(label);
  const r = await get(path);
  if (r.failed) console.log(r.failed);
  else if (Array.isArray(r)) console.log(JSON.stringify(r.map((x) => pick(x, ['database_type', 'pool_mode', 'default_pool_size', 'max_client_conn', 'db_port']))));
  else console.log(JSON.stringify(keys ? pick(r, keys) : Object.fromEntries(Object.entries(r).filter(([k]) => !/secret|key|password|token|connection|host|user/i.test(k)))));
}
for (const [label, path] of [
  ['API requests, last 24 hours (by service)', `/projects/${ref}/analytics/endpoints/usage.api-counts?interval=1day`],
  ['API requests count', `/projects/${ref}/analytics/endpoints/usage.api-requests-count`],
]) {
  title(label);
  const r = await get(path);
  if (r.failed) console.log(r.failed);
  else table((r.result ?? []).slice(-30), 30);
}

/* ───────── What this token may read, the machine's disk, the services, the API's response times ───────── */
title('What this token may read (GET only, nothing is created)');
for (const [label, path] of [
  ['organisations', '/organizations'],
  ['branches (staging copies) of this project', `/projects/${ref}/branches`],
  ['connection pool', `/projects/${ref}/config/database/pgbouncer`],
]) {
  const r = await get(path);
  if (r.failed) console.log(`${label}: ${r.failed}`);
  else if (Array.isArray(r)) console.log(`${label}: ${r.length} — ${JSON.stringify(r.map((x) => pick(x, ['name', 'plan', 'status', 'is_default', 'persistent'])))}`);
  else console.log(`${label}: ${JSON.stringify(pick(r, ['pool_mode', 'default_pool_size', 'max_client_conn', 'pgbouncer_enabled', 'ignore_startup_parameters']))}`);
}
title('Services');
{
  const r = await get(`/projects/${ref}/health?services=db&services=pooler&services=realtime&services=rest&services=auth&services=storage`);
  console.log(r.failed ?? JSON.stringify((Array.isArray(r) ? r : []).map((x) => pick(x, ['name', 'healthy', 'status']))));
}
title('Disk');
for (const path of [`/projects/${ref}/config/disk`, `/projects/${ref}/config/disk/util`]) {
  const r = await get(path);
  console.log(r.failed ?? JSON.stringify(r));
}
/** The API gateway's own log of requests (path, status, time taken): counts and percentiles only. */
async function logs(label, query, hours = 24) {
  title(label);
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600 * 1000);
  const r = await get(`/projects/${ref}/analytics/endpoints/logs.all?sql=${encodeURIComponent(query)}&iso_timestamp_start=${start.toISOString()}&iso_timestamp_end=${end.toISOString()}`);
  if (r.failed) console.log(`could not read: ${r.failed}`);
  else if (r.error) console.log(`could not read: ${cut(JSON.stringify(r.error), 300)}`);
  else table(r.result ?? [], 40);
}
await logs(
  'API response times, last 24 hours (gateway log)',
  `select count(*) as requests, countif(r.status_code >= 500) as errors_5xx, countif(r.status_code = 429) as rate_limited, approx_quantiles(r.origin_time, 100)[offset(50)] as p50_ms, approx_quantiles(r.origin_time, 100)[offset(95)] as p95_ms, approx_quantiles(r.origin_time, 100)[offset(99)] as p99_ms, max(r.origin_time) as max_ms from edge_logs cross join unnest(metadata) as m cross join unnest(m.response) as r`,
);
await logs(
  'Slowest API paths, last 24 hours (gateway log)',
  `select regexp_replace(q.path, r'[0-9a-f]{8}-[0-9a-f-]{27}', ':id') as path, count(*) as requests, approx_quantiles(r.origin_time, 100)[offset(95)] as p95_ms, max(r.origin_time) as max_ms from edge_logs cross join unnest(metadata) as m cross join unnest(m.request) as q cross join unnest(m.response) as r group by 1 order by 3 desc limit 25`,
);
await logs(
  'API requests per hour, last 7 days (gateway log)',
  `select timestamp_trunc(t.timestamp, day) as day, count(*) as requests, countif(r.status_code >= 500) as errors_5xx from edge_logs as t cross join unnest(metadata) as m cross join unnest(m.response) as r group by 1 order by 1 desc limit 8`,
  24 * 7,
);

/* ───────── The database ───────── */
await sql('Server', `select current_setting('server_version') as version, current_setting('max_connections') as max_connections, current_setting('shared_buffers') as shared_buffers, current_setting('effective_cache_size') as effective_cache_size, current_setting('work_mem') as work_mem, current_setting('max_worker_processes') as workers, pg_size_pretty(pg_database_size(current_database())) as database_size, (select stats_reset from pg_stat_database where datname = current_database()) as stats_since`);
await sql('Statement timeouts by role', `select rolname, rolconfig from pg_roles where rolname in ('anon', 'authenticated', 'authenticator', 'service_role', 'postgres') order by 1`);
await sql('Connections right now', `select usename, coalesce(nullif(application_name, ''), '(none)') as application, state, count(*) as connections from pg_stat_activity where datname = current_database() group by 1, 2, 3 order by 4 desc`);
await sql('Waiting or long-running right now (no query text)', `select count(*) filter (where wait_event_type = 'Lock') as waiting_on_locks, count(*) filter (where state = 'active' and now() - query_start > interval '5 seconds') as active_over_5s, count(*) filter (where state = 'idle in transaction') as idle_in_transaction, max(now() - query_start) filter (where state = 'active') as longest_active from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()`);
await sql('Database counters since the statistics were last reset', `select xact_commit, xact_rollback, round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) as cache_hit_pct, tup_returned, tup_fetched, temp_files, pg_size_pretty(temp_bytes) as temp_bytes, deadlocks, conflicts from pg_stat_database where datname = current_database()`);
await sql('Biggest tables', `select n.nspname || '.' || c.relname as table_name, pg_size_pretty(pg_total_relation_size(c.oid)) as total, pg_size_pretty(pg_indexes_size(c.oid)) as indexes, c.reltuples::bigint as rows_estimate, s.seq_scan, s.seq_tup_read, s.idx_scan, s.n_live_tup, s.n_dead_tup, s.last_autovacuum::date as last_autovacuum from pg_class c join pg_namespace n on n.oid = c.relnamespace left join pg_stat_user_tables s on s.relid = c.oid where c.relkind = 'r' and n.nspname in ('public', 'private', 'auth', 'storage', 'realtime', 'cron', 'net') order by pg_total_relation_size(c.oid) desc limit 30`, 30);
await sql('Tables read mostly by sequential scan (rows read that way)', `select schemaname || '.' || relname as table_name, seq_scan, seq_tup_read, idx_scan, n_live_tup, case when seq_scan > 0 then seq_tup_read / seq_scan end as rows_per_seq_scan from pg_stat_user_tables where schemaname in ('public', 'private') and seq_scan > 0 order by seq_tup_read desc limit 25`, 25);
await sql('Foreign keys without an index on their column', `select c.conrelid::regclass::text as table_name, a.attname as column_name, c.confrelid::regclass::text as refers_to, pg_size_pretty(pg_relation_size(c.conrelid)) as table_size from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1] where c.contype = 'f' and array_length(c.conkey, 1) = 1 and c.connamespace::regnamespace::text in ('public', 'private') and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]) order by pg_relation_size(c.conrelid) desc limit 60`, 60);
await sql('Indexes never used since the statistics were reset', `select s.schemaname || '.' || s.relname as table_name, s.indexrelname as index_name, pg_size_pretty(pg_relation_size(s.indexrelid)) as size from pg_stat_user_indexes s join pg_index i on i.indexrelid = s.indexrelid where s.idx_scan = 0 and not i.indisunique and not i.indisprimary and s.schemaname in ('public', 'private') order by pg_relation_size(s.indexrelid) desc limit 30`, 30);

/* ───────── What really costs: pg_stat_statements ───────── */
await sql('Statements: totals', `select count(*) as distinct_statements, sum(calls) as calls, round(sum(total_exec_time)::numeric / 1000, 1) as total_seconds, (select stats_reset from pg_stat_statements_info) as since from extensions.pg_stat_statements`);
await sql('Statements by total time (where the database spends its time)', `select round(total_exec_time::numeric / 1000, 1) as total_s, round(100 * total_exec_time::numeric / sum(total_exec_time::numeric) over (), 1) as pct, calls, round(mean_exec_time::numeric, 2) as mean_ms, round(max_exec_time::numeric, 0) as max_ms, rows, r.rolname as role, left(regexp_replace(query, '\\s+', ' ', 'g'), 230) as query from extensions.pg_stat_statements s left join pg_roles r on r.oid = s.userid order by total_exec_time desc limit 30`, 30);
await sql('Slowest statements on average (called at least 20 times)', `select round(mean_exec_time::numeric, 1) as mean_ms, round(max_exec_time::numeric, 0) as max_ms, round(stddev_exec_time::numeric, 1) as stddev_ms, calls, r.rolname as role, left(regexp_replace(query, '\\s+', ' ', 'g'), 230) as query from extensions.pg_stat_statements s left join pg_roles r on r.oid = s.userid where calls >= 20 order by mean_exec_time desc limit 25`, 25);
await sql('Most called statements', `select calls, round(mean_exec_time::numeric, 2) as mean_ms, round(total_exec_time::numeric / 1000, 1) as total_s, r.rolname as role, left(regexp_replace(query, '\\s+', ' ', 'g'), 230) as query from extensions.pg_stat_statements s left join pg_roles r on r.oid = s.userid order by calls desc limit 25`, 25);
await sql('Functions called through the API, by total time', `select substring(query from 'FROM "public"\\."([a-z_0-9]+)"') as rpc, sum(calls) as calls, round(sum(total_exec_time)::numeric / 1000, 1) as total_s, round((sum(total_exec_time) / nullif(sum(calls), 0))::numeric, 2) as mean_ms, round(max(max_exec_time)::numeric, 0) as max_ms from extensions.pg_stat_statements where query like '%pgrst_source%' group by 1 order by sum(total_exec_time) desc limit 40`, 40);

/* ───────── Scheduled jobs ───────── */
await sql('Scheduled jobs', `select jobname, schedule, active from cron.job order by jobname`, 40);
await sql('Scheduled jobs, last 24 hours', `select j.jobname, count(*) as runs, count(*) filter (where d.status <> 'succeeded') as not_succeeded, round(avg(extract(epoch from d.end_time - d.start_time))::numeric * 1000) as avg_ms, round(max(extract(epoch from d.end_time - d.start_time))::numeric * 1000) as max_ms from cron.job_run_details d join cron.job j on j.jobid = d.jobid where d.start_time > now() - interval '24 hours' group by 1 order by avg_ms desc nulls last`, 40);
await sql('Size of the scheduled jobs history', `select count(*) as rows, pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as size, min(start_time)::date as oldest from cron.job_run_details`);

/* ───────── Realtime ───────── */
await sql('Tables sent to Realtime', `select schemaname || '.' || tablename as table_name from pg_publication_tables where pubname = 'supabase_realtime' order by 1`, 60);
await sql('Realtime subscriptions to database changes, right now', `select entity::text as table_name, count(*) as subscriptions, count(distinct subscription_id) as clients from realtime.subscription group by 1 order by 2 desc`, 30);
await sql('Replication slots', `select slot_name, plugin, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) as wal_kept from pg_replication_slots`);
await sql('Cost of Realtime reading the changes', `select calls, round(mean_exec_time::numeric, 2) as mean_ms, round(total_exec_time::numeric / 1000, 1) as total_s, left(regexp_replace(query, '\\s+', ' ', 'g'), 120) as query from extensions.pg_stat_statements where query ilike '%realtime.list_changes%' or query ilike '%realtime.apply_rls%' order by total_exec_time desc limit 5`);

/* ───────── Row security written in the slow way ───────── */
await sql('Policies that call auth.uid() once per row (not wrapped in a sub-select)', `select schemaname || '.' || tablename as table_name, policyname, cmd from pg_policies where schemaname in ('public', 'private', 'storage') and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\\.uid\\(\\)' and (coalesce(qual, '') || coalesce(with_check, '')) !~* 'select auth\\.uid\\(\\)' order by 1, 2`, 80);
await sql('Policies per table', `select schemaname || '.' || tablename as table_name, count(*) as policies from pg_policies where schemaname in ('public', 'storage') group by 1 order by 2 desc limit 20`, 20);

/* ───────── Volumes (counts only) ───────── */
await sql('Storage by bucket', `select bucket_id, count(*) as files, pg_size_pretty(sum(coalesce((metadata ->> 'size')::bigint, 0))) as size from storage.objects group by 1 order by sum(coalesce((metadata ->> 'size')::bigint, 0)) desc`);
await sql('Accounts and activity (counts only)', `select (select count(*) from auth.users) as accounts, (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days') as signed_in_last_7_days, (select count(*) from auth.sessions) as sessions, (select count(*) from public.game_rooms) as game_rooms, (select count(*) from public.game_rooms where status = 'playing') as games_playing, (select count(*) from public.game_presence where seen_at > now() - interval '5 minutes') as in_games_last_5_min`);
await sql('Extensions', `select extname, extversion from pg_extension order by 1`, 60);
console.log('\nEnd of the reading. Nothing was written.');
