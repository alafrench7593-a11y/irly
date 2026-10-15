// Removes the stored files of deleted accounts (and other leftovers the
// database queued in private.storage_cleanup) through the Supabase Storage
// API. The database cannot delete stored files itself; this job can, with
// the project's server key, which it reads from the Management API at run
// time and never prints.
//
// Each run: sweep (queue leftovers), then claim a batch (FOR UPDATE SKIP
// LOCKED, with a lease: two runs never get the same files, a crashed run's
// files come back once the lease ends), delete through the Storage API,
// and mark each file done (only once it is really gone; "not found" counts
// as gone) or failed (tried again at a later run, then flagged for a person
// after 5 attempts). Safe to run as often as wanted.
//
// Logs counts per bucket only: never a file name, a member id or a key.
//
// Env: SUPABASE_ACCESS_TOKEN (personal access token, sbp_…),
//      SUPABASE_PROJECT_REF (default: the IRLY project),
//      PURGE_LEASE_SECONDS (default 900), PURGE_BATCH (default 200),
//      SUPABASE_API_URL / SUPABASE_URL (only to point at a local stand-in).
// Run by .github/workflows/storage-purge.yml; locally:
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/storage-purge.mjs

const raw = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const token = raw.match(/sbp_[^\s"'`]+/)?.[0];
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
const API = (process.env.SUPABASE_API_URL || 'https://api.supabase.com').replace(/\/+$/, '');
const PROJECT_URL = (process.env.SUPABASE_URL || `https://${ref}.supabase.co`).replace(/\/+$/, '');
const LEASE = intEnv('PURGE_LEASE_SECONDS', 900, 0, 86_400);
const BATCH = intEnv('PURGE_BATCH', 200, 1, 1000);
/** Files per Storage API call. */
const CHUNK = 100;
/** A run stops claiming after this long or this many batches (the next run continues). */
const BUDGET_MS = 10 * 60_000;
const MAX_ROUNDS = 25;
const HTTP_MS = 30_000;

function intEnv(name, fallback, min, max) {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN (a personal access token starting with "sbp_") is not set: nothing purged.');
  process.exit(1);
}
mask(token);

/** GitHub Actions hides this value in every later log line. Only there: locally it would print it. */
function mask(value) {
  if (process.env.GITHUB_ACTIONS === 'true' && value) process.stdout.write(`::add-mask::${value}\n`);
}

const mgmt = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

/** One SQL statement through the Management API; rows as JSON. Errors never echo the statement. */
async function sql(query) {
  const res = await fetch(`${API}/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: mgmt,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(HTTP_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${scrub(text).slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

/** Ids and keys out of anything that might be printed. */
function scrub(s) {
  return String(s)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/sb_secret_[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<key>');
}

/** A json(b) column, whether the API sends it parsed or as text. */
const obj = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const textArray = (names) => `array[${names.map(lit).join(',')}]::text[]`;

/**
 * The project's server key, from the Management API: a secret key (sb_secret_…)
 * when the project has one, else the legacy service_role key. Masked at once.
 */
async function serverKey() {
  const res = await fetch(`${API}/v1/projects/${ref}/api-keys?reveal=true`, { headers: mgmt, signal: AbortSignal.timeout(HTTP_MS) });
  if (!res.ok) throw new Error(`Could not read the project's API keys (${res.status}).`);
  const keys = await res.json();
  const usable = (k) => typeof k?.api_key === 'string' && k.api_key.length > 20 && !/[·*•]/.test(k.api_key);
  const secret = (Array.isArray(keys) ? keys : []).find((k) => k.type === 'secret' && usable(k) && k.api_key.startsWith('sb_secret_'));
  const legacy = (Array.isArray(keys) ? keys : []).find((k) => k.name === 'service_role' && usable(k));
  const key = (secret ?? legacy)?.api_key;
  if (!key) throw new Error('The project has no server key the purge can use (secret or service_role).');
  mask(key);
  return key;
}

/**
 * Deletes files of one bucket. ok: the API answered (deleted, or nothing
 * there: a missing file or bucket is gone). Whether each file is really gone
 * is checked by the database before it is marked done.
 */
async function removeFiles(key, bucket, names) {
  let res;
  try {
    res = await fetch(`${PROJECT_URL}/storage/v1/object/${encodeURIComponent(bucket)}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: names }),
      signal: AbortSignal.timeout(HTTP_MS),
    });
  } catch (e) {
    return { ok: false, error: `storage unreachable (${e?.name === 'TimeoutError' ? 'timeout' : 'network'})` };
  }
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true };
  // Storage answers a missing bucket or file with 404 (or 400 + "not found").
  if (res.status === 404 || (res.status === 400 && /not[\s_]?found/i.test(text))) return { ok: true };
  return { ok: false, error: `storage ${res.status}` };
}

const started = Date.now();
const t = { claimed: 0, done: 0, failed: 0, stillStored: 0 };
const perBucket = new Map();
const bump = (bucket, k, n) => {
  const b = perBucket.get(bucket) ?? { claimed: 0, done: 0, failed: 0 };
  b[k] += n;
  perBucket.set(bucket, b);
};

try {
  const [ready] = await sql("select to_regprocedure('private.storage_purge_claim(integer,integer)') is not null as ok");
  if (!ready?.ok) {
    console.log('The purge queue is not installed yet (migration 20261020001400): nothing to do.');
    process.exit(0);
  }
  const [{ n: swept }] = await sql('select private.storage_purge_sweep(1000) as n');
  console.log(`sweep: ${swept} leftover file(s) queued`);

  let key = null;
  for (let round = 0; round < MAX_ROUNDS && Date.now() - started < BUDGET_MS; round++) {
    const rows = await sql(`select bucket_id, name from private.storage_purge_claim(${BATCH}, ${LEASE})`);
    if (!rows.length) break;
    key ??= await serverKey();
    t.claimed += rows.length;
    const byBucket = new Map();
    for (const r of rows) byBucket.set(r.bucket_id, [...(byBucket.get(r.bucket_id) ?? []), r.name]);
    for (const [bucket, names] of byBucket) {
      bump(bucket, 'claimed', names.length);
      for (let i = 0; i < names.length; i += CHUNK) {
        const chunk = names.slice(i, i + CHUNK);
        const r = await removeFiles(key, bucket, chunk);
        if (r.ok) {
          const [row] = await sql(`select private.storage_purge_done(${lit(bucket)}, ${textArray(chunk)}) as r`);
          const res = obj(row.r);
          t.done += res.done;
          t.stillStored += res.still_stored;
          bump(bucket, 'done', res.done);
          bump(bucket, 'failed', res.still_stored);
        } else {
          await sql(`select private.storage_purge_failed(${lit(bucket)}, ${textArray(chunk)}, ${lit(r.error)}) as n`);
          t.failed += chunk.length;
          bump(bucket, 'failed', chunk.length);
          console.log(`${bucket}: ${chunk.length} file(s) not deleted (${r.error}), tried again at a later run`);
        }
      }
    }
  }

  for (const [bucket, b] of [...perBucket].sort()) console.log(`${bucket}: ${b.claimed} claimed, ${b.done} removed, ${b.failed} to retry`);
  const status = obj((await sql('select private.storage_purge_status() as s'))[0].s);
  console.log(
    `run: ${t.claimed} claimed, ${t.done} removed, ${t.failed + t.stillStored} to retry · queue: ${status.waiting} waiting, ${status.in_progress} in progress, ${status.flagged} flagged, ${status.done} done (last 30 days)`,
  );
  if (Number(status.flagged) > 0) {
    console.log(`::warning::${status.flagged} file(s) could not be removed after 5 attempts: look into it, then run "select private.storage_purge_requeue()".`);
  }
  // A run where storage refused everything (a key revoked, an outage) shows up as a failed job.
  if (t.claimed > 0 && t.done === 0 && t.failed + t.stillStored > 0) process.exit(1);
} catch (e) {
  console.error(`Storage purge stopped: ${scrub(e instanceof Error ? e.message : String(e))}`);
  process.exit(1);
}
