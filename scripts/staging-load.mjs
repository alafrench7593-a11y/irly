/**
 * One stage of progressive load against the STAGING branch, and only it: every Management API call and
 * every URL given to k6 comes from scripts/staging-lib.mjs, whose guard refuses anything but the staging
 * branch. Run it once per stage: --users 100, then 500, 1000, 5000, 10000.
 *
 * What it does:
 *  1. checks the branch (no push token may be registered; enough fictitious members for the stage);
 *  2. gets the members' access tokens: mints them when the project's JWT secret is readable through the
 *     Management API and really works (one call as member 1 proves it), else signs members in with their
 *     password, a few at a time, and says how many sign-ins the auth rate limit refused;
 *  3. puts the Loup-Garou tables back in place (they end by themselves when idle);
 *  4. resets pg_stat_statements on the staging branch, starts k6 (scripts/load/main.js): ramp, hold, ramp down;
 *  5. meanwhile reads the staging database every 10 s (connections by state, lock waits, longest query,
 *     Realtime subscriptions), read only;
 *  6. writes a summary (markdown: $GITHUB_STEP_SUMMARY and stdout; JSON: a file to upload as an artifact).
 *
 * No key, secret, token or member data is printed or written to the summary. Tokens go to k6 in a file
 * in the system's temporary directory, removed at the end.
 *
 * Env: SUPABASE_ACCESS_TOKEN, K6_BIN (default: k6). Usage: node scripts/staging-load.mjs --users 100 [--hold 180] [--realtime-cap 2000]
 */
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { accessToken, createStaging, loadPassword, mask, outsideReach, signJwt } from './staging-lib.mjs';
import { gamesSql } from './staging-seed.mjs';
import { ID_PREFIX, MEMBER_MAIL, SIZES, ids, lobbyMembers, plan, tableMembers } from './load/plan.mjs';

export const STAGES = [100, 500, 1000, 5000, 10000];
const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : null);

/** How many k6 virtual users a stage of `users` members is made of. */
export function stageShape(users, { hold = 180, realtimeCap = 2000, seats = 0 } = {}) {
  const ramp = users <= 100 ? 30 : users <= 500 ? 60 : users <= 1000 ? 90 : users <= 5000 ? 180 : 240;
  const realtime = Math.min(users, realtimeCap);
  // About one member in twenty is at a Loup-Garou table, as far as the prepared tables go.
  const werewolf = Math.min(seats, Math.max(8, Math.round(users / 20)));
  return { users, realtime, werewolf, ramp, hold, down: 30, vus: users + realtime + werewolf };
}

export const SAMPLE_SQL = (withRealtime) => `select
  (select coalesce(jsonb_object_agg(coalesce(state, 'none'), n), '{}') from (select state, count(*) n from pg_stat_activity where datname = current_database() group by state) s) as states,
  (select count(*) from pg_stat_activity where datname = current_database())::int as connections,
  (select count(*) from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock')::int as lock_waits,
  (select coalesce(max(extract(epoch from now() - query_start)), 0)::float from pg_stat_activity where datname = current_database() and state = 'active' and backend_type = 'client backend' and pid <> pg_backend_pid()) as longest_active_s,
  ${withRealtime ? '(select count(*) from realtime.subscription)::int' : 'null::int'} as realtime_subscriptions,
  current_setting('max_connections')::int as max_connections`;
const DATABASE_SQL = `select deadlocks::int, temp_files::int, temp_bytes::bigint, xact_commit::bigint, xact_rollback::bigint from pg_stat_database where datname = current_database()`;
export const STATEMENTS_SQL = (schema, order) => `select left(regexp_replace(query, '\\s+', ' ', 'g'), 150) as query, calls::int, round(total_exec_time)::int as total_ms, round(mean_exec_time::numeric, 2)::float as mean_ms, rows::int
  from ${schema}.pg_stat_statements
  where query !~* '^\\s*(do|begin|commit|set|reset|analyze|alter)\\M' and query !~* 'pg_stat_|pg_extension|pg_namespace' and calls >= ${order === 'mean_exec_time' ? 20 : 1}
  order by ${order} desc limit 12`;

/** The anon key and, when the project still has one that works, the JWT secret. Neither is ever printed. */
async function projectKeys(api) {
  let anon = null;
  try {
    const keys = await api.request('GET', '/api-keys?reveal=true');
    const list = Array.isArray(keys) ? keys : [];
    const pickKey = list.find((k) => k.name === 'anon' && k.api_key) ?? list.find((k) => k.type === 'publishable' && k.api_key);
    anon = pickKey?.api_key ?? null;
  } catch {
    anon = null;
  }
  if (!anon) throw new Error('the staging branch gave no anon key (GET /api-keys?reveal=true): nothing can be loaded');
  mask(anon);
  const secrets = [];
  try {
    const cfg = await api.request('GET', '/postgrest');
    if (typeof cfg?.jwt_secret === 'string' && cfg.jwt_secret.length >= 16) secrets.push(cfg.jwt_secret);
  } catch {
    // Not readable: the next source, then the password.
  }
  try {
    const rows = await api.sql(`select current_setting('app.settings.jwt_secret', true) as s`, { readOnly: true });
    if (typeof rows?.[0]?.s === 'string' && rows[0].s.length >= 16 && !secrets.includes(rows[0].s)) secrets.push(rows[0].s);
  } catch {
    // Same.
  }
  secrets.forEach((s) => mask(s));
  return { anon, secrets };
}

const tokenFor = (n, secret, ref, seconds) => {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({ iss: `https://${ref}.supabase.co/auth/v1`, sub: ids.member(n), aud: 'authenticated', role: 'authenticated', email: MEMBER_MAIL(n), is_anonymous: false, iat: now - 30, exp: now + seconds }, secret);
};

/** True when the API accepts a token as member 1 (her own profile comes back). */
async function tokenWorks(targets, anon, token, fetch) {
  try {
    const res = await fetch(`${targets.rest}/rpc/my_profile`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length === 1 && rows[0].id === ids.member(1);
  } catch {
    return false;
  }
}

/** Password sign-in for the members listed, a few at a time. Returns { tokens: Map, stats }. */
async function signIn(targets, anon, password, members, fetch, { concurrency = 4, budgetMs = 8 * 60 * 1000 } = {}) {
  const tokens = new Map();
  const stats = { asked: members.length, ok: 0, rate_limited: 0, failed: 0, gave_up: 0, first_error: null };
  const started = Date.now();
  let next = 0;
  let pause = 0;
  async function worker() {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= members.length) return;
      const n = members[i];
      for (let tries = 0; ; tries += 1) {
        if (Date.now() - started > budgetMs || tries >= 4) {
          stats.gave_up += 1;
          break;
        }
        if (pause > Date.now()) await sleep(pause - Date.now());
        let res;
        try {
          res = await fetch(`${targets.auth}/token?grant_type=password`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: MEMBER_MAIL(n), password }) });
        } catch {
          stats.failed += 1;
          break;
        }
        if (res.status === 429) {
          stats.rate_limited += 1;
          // Everybody waits: the limit is per address, not per member.
          pause = Date.now() + Math.min(60000, 5000 * (tries + 1));
          continue;
        }
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.access_token) {
          tokens.set(n, body.access_token);
          stats.ok += 1;
        } else {
          stats.failed += 1;
          stats.first_error ??= `${res.status} ${String(body.error_code ?? body.code ?? '')} ${String(body.msg ?? body.error_description ?? body.message ?? '').slice(0, 120)}`.trim();
        }
        break;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { tokens, stats };
}

function markdown(r) {
  const L = [];
  const ms = (v) => (v === null || v === undefined ? '–' : `${v} ms`);
  L.push(`## Load on the staging branch: ${r.stage.users} members`);
  L.push('');
  L.push(`- stage: ramp ${r.stage.ramp} s, hold ${r.stage.hold} s, ramp down ${r.stage.down} s; k6 virtual users: ${r.stage.users} app, ${r.stage.realtime} realtime${r.stage.realtime < r.stage.users ? ' (capped)' : ''}, ${r.stage.werewolf} Loup-Garou`);
  L.push(`- data: ${r.seed.members} fictitious members (${r.seed.size}); auth: ${r.auth.mode}${r.auth.sign_in ? `: ${r.auth.sign_in.ok} of ${r.auth.sign_in.asked} signed in, ${r.auth.sign_in.rate_limited} refused by the rate limit (429), ${r.auth.sign_in.failed} failed, ${r.auth.sign_in.gave_up} given up${r.auth.sign_in.first_error ? `, first error: ${r.auth.sign_in.first_error}` : ''}` : ''}`);
  L.push(`- k6: ${r.k6.finished ? `ended with code ${r.k6.code}${r.k6.code === 99 ? ' (thresholds crossed, reported below, not enforced)' : ''}` : 'did not finish'}${r.k6.note ? `; ${r.k6.note}` : ''}`);
  if (!r.http) return `${L.join('\n')}\n`;
  L.push(`- requests: ${r.http.requests} (${r.http.rps}/s), failed: ${r.http.error_rate_percent} %; all requests p50 ${ms(r.http.p50)}, p95 ${ms(r.http.p95)}, p99 ${ms(r.http.p99)}`);
  L.push(`- thresholds (reported, not enforced): p95 < 500 ms: ${r.http.p95 === null ? 'no data' : r.http.p95 < 500 ? 'met' : 'CROSSED'}; errors < 1 %: ${r.http.error_rate_percent < 1 ? 'met' : 'CROSSED'}`);
  L.push('');
  L.push('| scenario | requests | errors | p50 | p95 | p99 |');
  L.push('|---|---:|---:|---:|---:|---:|');
  for (const g of r.groups) L.push(`| ${g.group} | ${g.requests} | ${g.errors} | ${ms(g.p50)} | ${ms(g.p95)} | ${ms(g.p99)} |`);
  L.push('');
  L.push('Slowest calls (p95):');
  L.push('');
  L.push('| call | count | errors | p50 | p95 | p99 |');
  L.push('|---|---:|---:|---:|---:|---:|');
  for (const e of r.endpoints.slice(0, 12)) L.push(`| ${e.endpoint} | ${e.count} | ${e.errors} | ${ms(e.p50)} | ${ms(e.p95)} | ${ms(e.p99)} |`);
  L.push('');
  L.push(`Errors seen (a sample: each virtual user reports its first few): ${r.errors.length ? '' : 'none'}`);
  for (const e of r.errors.slice(0, 10)) L.push(`- ${e.count} × ${e.where}: ${e.status} ${e.text}`);
  L.push('');
  const t = r.realtime;
  if (t) {
    L.push(`Realtime: connections ok ${t.connected_percent} %; joins ok ${t.joins_ok}, refused ${t.joins_refused}, unanswered ${t.joins_unanswered} (join p95 ${ms(t.join_p95)}); subscriptions confirmed ${t.subscriptions_ok}, errors ${t.subscription_errors}; closed by the server ${t.closed_by_server}`);
    L.push(`Realtime delivery of a message written by another virtual user: ${t.delivery_count} measured, p50 ${ms(t.delivery_p50)}, p95 ${ms(t.delivery_p95)}, p99 ${ms(t.delivery_p99)} (own echo p95 ${ms(t.echo_p95)}; ${t.messages_sent} probes sent, ${t.events} events received)`);
    L.push('');
  }
  const d = r.database;
  L.push(`Database (${d.samples} samples, ${d.missed} missed): connections peak ${d.connections_peak} of ${d.max_connections ?? '?'}, active peak ${d.active_peak}, idle in transaction peak ${d.idle_in_transaction_peak}, waiting on locks peak ${d.lock_waits_peak}, longest active query ${d.longest_active_s_peak} s, Realtime subscriptions peak ${d.realtime_subscriptions_peak ?? 'not readable'}`);
  L.push(`Over the stage: deadlocks ${d.deadlocks ?? '?'}, temp files ${d.temp_files ?? '?'} (${d.temp_mb ?? '?'} MB), commits ${d.commits ?? '?'}, rollbacks ${d.rollbacks ?? '?'}`);
  for (const [title, rows] of [['Top statements by total time', r.statements.by_total], ['Top statements by mean time (20 calls or more)', r.statements.by_mean]]) {
    L.push('');
    L.push(`${title}${rows.length ? '' : ': not readable'}`);
    if (!rows.length) continue;
    L.push('');
    L.push('| total ms | calls | mean ms | statement |');
    L.push('|---:|---:|---:|---|');
    for (const s of rows.slice(0, 10)) L.push(`| ${s.total_ms} | ${s.calls} | ${s.mean_ms} | \`${String(s.query).replace(/[|`]/g, ' ')}\` |`);
  }
  return `${L.join('\n')}\n`;
}

/** k6's end-of-test numbers, as the summary needs them. */
export function digest(summary, errorLines) {
  const m = summary?.metrics ?? {};
  const v = (name, key) => m[name]?.values?.[key];
  const trend = (name) => ({ count: v(name, 'count') ?? 0, p50: round(v(name, 'med')), p95: round(v(name, 'p(95)')), p99: round(v(name, 'p(99)')) });
  const groups = Object.keys(m)
    .filter((k) => k.startsWith('grp_'))
    .map((k) => ({ group: k.slice(4), requests: v(`req_${k.slice(4)}`, 'count') ?? 0, errors: v(`err_${k.slice(4)}`, 'count') ?? 0, ...trend(k) }))
    .filter((g) => g.requests > 0);
  const endpoints = Object.keys(m)
    .filter((k) => k.startsWith('ep_'))
    .map((k) => ({ endpoint: k.slice(3), errors: v(`eperr_${k.slice(3)}`, 'count') ?? 0, ...trend(k) }))
    .filter((e) => e.count > 0)
    .sort((a, b) => (b.p95 ?? 0) - (a.p95 ?? 0));
  const counted = new Map();
  for (const line of errorLines) {
    const [, where, what, status, text] = line.split('|');
    const key = `${where} ${what}|${status}|${text ?? ''}`;
    counted.set(key, (counted.get(key) ?? 0) + 1);
  }
  const errors = [...counted].map(([k, count]) => ({ count, where: k.split('|')[0], status: k.split('|')[1], text: k.split('|')[2] })).sort((a, b) => b.count - a.count);
  const http = m.http_reqs
    ? { requests: v('http_reqs', 'count') ?? 0, rps: round(v('http_reqs', 'rate'), 1), error_rate_percent: round((v('app_errors', 'rate') ?? 0) * 100, 2), p50: round(v('http_req_duration', 'med')), p95: round(v('http_req_duration', 'p(95)')), p99: round(v('http_req_duration', 'p(99)')) }
    : null;
  const realtime = m.rt_connected
    ? {
        connected_percent: round((v('rt_connected', 'rate') ?? 0) * 100, 1),
        joins_ok: v('rt_joins_ok', 'count') ?? 0,
        joins_refused: v('rt_joins_refused', 'count') ?? 0,
        joins_unanswered: v('rt_joins_unanswered', 'count') ?? 0,
        join_p95: round(v('rt_join_time', 'p(95)')),
        subscriptions_ok: v('rt_subscriptions_ok', 'count') ?? 0,
        subscription_errors: v('rt_subscription_errors', 'count') ?? 0,
        closed_by_server: v('rt_closed_by_server', 'count') ?? 0,
        events: v('rt_events', 'count') ?? 0,
        messages_sent: v('rt_messages_sent', 'count') ?? 0,
        delivery_count: v('rt_delivery', 'count') ?? 0,
        delivery_p50: round(v('rt_delivery', 'med')),
        delivery_p95: round(v('rt_delivery', 'p(95)')),
        delivery_p99: round(v('rt_delivery', 'p(99)')),
        echo_p95: round(v('rt_own_echo', 'p(95)')),
      }
    : null;
  return { http, groups, endpoints, errors, realtime };
}

/**
 * Runs one stage. `api` is createStaging()'s door (its URLs have been through the guard).
 * Returns the result object (also written as JSON and markdown).
 */
export async function runStage(api, { users, token, hold = 180, realtimeCap = 2000, k6 = process.env.K6_BIN || 'k6', outDir, fetch = globalThis.fetch, log = console.log, env = process.env }) {
  const targets = await api.targets();
  const reach = await outsideReach(api);
  if (reach.push_tokens > 0) throw new Error(`the staging branch holds ${reach.push_tokens} push token(s): a load-test message could reach a phone. Nothing started.`);
  const [seeded] = await api.sql(`select (select count(*) from public.profiles where id::text like '${ID_PREFIX}-%')::int as members, (select count(*) from public.communities where id::text like '${ID_PREFIX}-%')::int as communities`, { readOnly: true });
  const size = Object.keys(SIZES).find((s) => SIZES[s] === seeded.members);
  if (!size) throw new Error(`the staging branch holds ${seeded.members} fictitious members: run the seed first (small, medium or large, complete).`);
  const p = plan(size);

  // Loup-Garou tables back in place, then their ids.
  for (const [kind, total] of [['waiting', p.games.waiting], ['running', p.games.running]]) for (let a = 1; a <= total; a += 25) await api.sql(gamesSql(p, kind, a, Math.min(total, a + 24)));
  const rooms = await api.sql(`select title, id, status from public.game_rooms where game = 'werewolf' and status in ('waiting', 'playing') and (title like 'Load night %' or title like 'Load lobby %')`, { readOnly: true });
  const seatList = [];
  for (const r of rooms.sort((a, b) => a.title.localeCompare(b.title, 'en', { numeric: true }))) {
    const t = Number(r.title.replace(/\D+/g, ''));
    const running = r.status === 'playing' && r.title.startsWith('Load night ');
    const list = running ? tableMembers(p, t) : lobbyMembers(p, t);
    list.forEach((n, seat) => seatList.push({ room: r.id, kind: running ? 'running' : 'waiting', n, seat, seats: list.length }));
  }
  // Running tables first, whole tables: a table with empty seats would not be the app's.
  seatList.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'running' ? -1 : 1));
  const stage = stageShape(users, { hold, realtimeCap, seats: seatList.length });
  if (stage.users + stage.realtime > p.members) throw new Error(`this stage plays ${stage.users + stage.realtime} members at once and the branch holds ${p.members}: seed a larger size first.`);
  const seats = seatList.slice(0, stage.werewolf);
  const players = Array.from({ length: stage.users + stage.realtime }, (_, i) => i + 1);

  // Tokens.
  const life = stage.ramp + stage.hold + stage.down + 600;
  const { anon, secrets } = await projectKeys(api);
  const auth = { mode: 'minted with the project JWT secret (HS256)', sign_in: null };
  let secret = null;
  for (const s of secrets) {
    if (await tokenWorks(targets, anon, tokenFor(1, s, targets.ref, 120), fetch)) {
      secret = s;
      break;
    }
  }
  let tokenOf;
  if (secret) tokenOf = (n) => tokenFor(n, secret, targets.ref, life);
  else {
    auth.mode = `password sign-in (${secrets.length ? 'the JWT secret read through the Management API is not accepted by the API' : 'no JWT secret readable through the Management API'})`;
    const wanted = [...new Set([...players, ...seats.map((s) => s.n)])];
    const { tokens, stats } = await signIn(targets, anon, loadPassword(token), wanted, fetch);
    auth.sign_in = stats;
    if (!tokens.size) throw new Error(`no member could sign in (${stats.rate_limited} refused by the rate limit, ${stats.failed} failed${stats.first_error ? `: ${stats.first_error}` : ''}). Nothing started.`);
    tokenOf = (n) => tokens.get(n) ?? null;
  }
  const members = players.map((n) => ({ n, t: tokenOf(n) })).filter((x) => x.t);
  const seated = seats.map((s) => ({ ...s, t: tokenOf(s.n) })).filter((x) => x.t);
  log(`stage ${users}: ${stage.vus} k6 virtual users (${stage.users} app, ${stage.realtime} realtime, ${seated.length} Loup-Garou), ${members.length} members with a token, auth: ${auth.mode.split(' (')[0]}`);

  const work = mkdtempSync(join(tmpdir(), 'irly-load-'));
  // Whatever happens next, the tokens do not outlive this process.
  process.once('exit', () => rmSync(work, { recursive: true, force: true }));
  const dataFile = join(work, 'data.json');
  const summaryFile = join(work, 'summary.json');
  writeFileSync(dataFile, JSON.stringify({ members, seats: seated }), { mode: 0o600 });

  // The database's own counters start from zero for this stage (staging only: api.sql is guarded).
  const [ext] = await api.sql(`select (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_stat_statements') as statements, to_regclass('realtime.subscription') is not null as realtime`, { readOnly: true });
  if (ext.statements) await api.sql(`select ${ext.statements}.pg_stat_statements_reset()`).catch(() => undefined);
  const before = (await api.sql(DATABASE_SQL, { readOnly: true }).catch(() => []))[0] ?? null;

  const samples = [];
  let missed = 0;
  let withRealtime = Boolean(ext.realtime);
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      const at = Date.now();
      try {
        const [row] = await api.sql(SAMPLE_SQL(withRealtime), { readOnly: true, tries: 1 });
        samples.push({ at: new Date(at).toISOString(), ...row });
      } catch (e) {
        // realtime.subscription may not be readable by this role: asked once, then left out.
        if (withRealtime && /realtime|permission/i.test(String(e.message))) withRealtime = false;
        else missed += 1;
      }
      const wait = 10000 - (Date.now() - at);
      for (let w = 0; sampling && w < wait; w += 250) await sleep(250);
    }
  })();

  const errorLines = [];
  const other = [];
  const child = spawn(k6, ['run', '--quiet', '--no-color', '--no-usage-report', '--log-format', 'raw', join(HERE, 'load', 'main.js')], {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...env,
      SUPABASE_ACCESS_TOKEN: '',
      BASE_URL: targets.base,
      WS_URL: stage.realtime > 0 ? targets.realtime : '',
      STAGING_REF: targets.ref,
      ANON_KEY: anon,
      DATA_FILE: dataFile,
      SUMMARY_FILE: summaryFile,
      SIZE: size,
      USERS: String(stage.users),
      RT_USERS: String(stage.realtime),
      WW_USERS: String(seated.length),
      RAMP_S: String(stage.ramp),
      HOLD_S: String(stage.hold),
      DOWN_S: String(stage.down),
    },
  });
  createInterface({ input: child.stderr }).on('line', (line) => {
    if (line.startsWith('LOADERR|')) {
      if (errorLines.length < 200000) errorLines.push(line);
    } else if (other.length < 30 && line.trim()) other.push(line.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<token>').replace(/apikey=[^&\s"]+/g, 'apikey=<key>').slice(0, 300));
  });
  const started = Date.now();
  const beat = setInterval(() => {
    const s = samples[samples.length - 1];
    log(`  ${Math.round((Date.now() - started) / 1000)} s: connections ${s?.connections ?? '?'}, active ${s?.states?.active ?? 0}, lock waits ${s?.lock_waits ?? '?'}, realtime subscriptions ${s?.realtime_subscriptions ?? '?'}`);
  }, 30000);
  const code = await new Promise((resolve) => {
    child.on('error', () => resolve(-1));
    child.on('close', (c) => resolve(c ?? -1));
  });
  clearInterval(beat);
  sampling = false;
  await sampler;

  const after = (await api.sql(DATABASE_SQL, { readOnly: true }).catch(() => []))[0] ?? null;
  const top = async (order) => (ext.statements ? api.sql(STATEMENTS_SQL(ext.statements, order), { readOnly: true }).catch(() => []) : []);
  const statements = { by_total: await top('total_exec_time'), by_mean: await top('mean_exec_time') };
  let summary = null;
  try {
    summary = JSON.parse(readFileSync(summaryFile, 'utf8'));
  } catch {
    summary = null;
  }
  rmSync(work, { recursive: true, force: true });

  const peak = (f) => samples.reduce((mx, s) => Math.max(mx, Number(f(s) ?? 0)), 0);
  const delta = (k) => (before && after ? Number(after[k]) - Number(before[k]) : null);
  const result = {
    at: new Date(started).toISOString(),
    stage,
    seed: { size, members: p.members },
    auth,
    k6: { finished: code === 0 || code === 99, code, note: code === -1 ? 'k6 could not be started' : !summary ? `no summary; last lines: ${other.slice(-5).join(' / ')}` : null },
    ...digest(summary, errorLines),
    database: {
      samples: samples.length,
      missed,
      max_connections: samples[0]?.max_connections ?? null,
      connections_peak: peak((s) => s.connections),
      active_peak: peak((s) => s.states?.active),
      idle_in_transaction_peak: peak((s) => s.states?.['idle in transaction']),
      lock_waits_peak: peak((s) => s.lock_waits),
      longest_active_s_peak: round(peak((s) => s.longest_active_s), 1),
      realtime_subscriptions_peak: samples.some((s) => s.realtime_subscriptions !== null && s.realtime_subscriptions !== undefined) ? peak((s) => s.realtime_subscriptions) : null,
      deadlocks: delta('deadlocks'),
      temp_files: delta('temp_files'),
      temp_mb: delta('temp_bytes') === null ? null : round(delta('temp_bytes') / 1048576, 1),
      commits: delta('xact_commit'),
      rollbacks: delta('xact_rollback'),
    },
    statements,
    samples,
  };
  const md = markdown(result);
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `load-${users}.json`), JSON.stringify(result, null, 1));
    writeFileSync(join(outDir, `load-${users}.md`), md);
  }
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, md);
  log(`\n${md}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback);
  const users = opt('--users', 100);
  try {
    if (!STAGES.includes(users)) throw new Error(`--users: one of ${STAGES.join(', ')}`);
    const token = accessToken();
    const api = createStaging({ token });
    const result = await runStage(api, { users, token, hold: opt('--hold', 180), realtimeCap: opt('--realtime-cap', 2000), outDir: join(process.env.RUNNER_TEMP || tmpdir(), 'irly-load') });
    // The stage's numbers are a report, not a verdict: only a run that could not happen fails the job.
    if (!result.k6.finished || !result.http) process.exit(1);
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(1);
  }
}
