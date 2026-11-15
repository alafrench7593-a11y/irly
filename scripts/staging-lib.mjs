/**
 * What every staging script that writes or loads shares: the HARD GUARD, and the only door to Supabase's
 * Management API those scripts have.
 *
 * The guard is assertStaging(target, branches). It throws unless the target (a project reference, a
 * Management API path, or a URL about to be loaded) names the staging branch's project, as listed by
 * GET /projects/<production>/branches (name « staging », is_default false), and that reference is not
 * production's. Every Management API call other than that one list, and every URL handed to the load
 * tools, goes through it: there is no other way out of this file.
 *
 * Nothing here prints a key, a token or a secret.
 */
import { createHmac } from 'node:crypto';

export const PRODUCTION_REF = 'yqutcmgslwxcmnsqmhvy';
export const MANAGEMENT_API = 'https://api.supabase.com/v1';
const REF_SHAPE = /^[a-z]{20}$/;
const BRANCH_LIST = `/projects/${PRODUCTION_REF}/branches`;

/** The staging branch's project reference, from the branch list. Throws on anything unexpected. */
export function stagingRefFrom(branches) {
  if (!Array.isArray(branches)) throw new Error('staging guard: the branch list is missing');
  const named = branches.filter((b) => b && b.name === 'staging');
  if (named.length !== 1) throw new Error(`staging guard: expected one branch named staging, found ${named.length}`);
  const [b] = named;
  if (b.is_default !== false) throw new Error('staging guard: the staging branch is marked as the default (production) branch');
  if (typeof b.project_ref !== 'string' || !REF_SHAPE.test(b.project_ref)) throw new Error('staging guard: the staging branch has no usable project reference');
  if (b.project_ref === PRODUCTION_REF) throw new Error('staging guard: the staging branch points at production');
  if (b.parent_project_ref !== undefined && b.parent_project_ref !== PRODUCTION_REF) throw new Error('staging guard: the staging branch belongs to another project');
  return b.project_ref;
}

/**
 * THE GUARD. `target` is a project reference, a Management API path (/projects/<ref>/…) or a URL
 * (https://<ref>.supabase.co/…, wss://<ref>.supabase.co/…). Returns the staging reference, or throws.
 */
export function assertStaging(target, branches) {
  const staging = stagingRefFrom(branches);
  if (staging === PRODUCTION_REF) throw new Error('staging guard: production');
  if (typeof target !== 'string' || !target) throw new Error('staging guard: no target');
  if (target.includes(PRODUCTION_REF)) throw new Error('staging guard: the target names production');
  let ref;
  if (target.includes('://')) {
    let url;
    try {
      url = new URL(target);
    } catch {
      throw new Error('staging guard: the target is not a URL');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'wss:') throw new Error('staging guard: only https and wss targets');
    if (url.username || url.password || url.port) throw new Error('staging guard: unexpected URL parts');
    if (!url.hostname.endsWith('.supabase.co')) throw new Error('staging guard: the target is not a Supabase project host');
    ref = url.hostname.slice(0, -'.supabase.co'.length);
  } else if (target.startsWith('/')) {
    const m = /^\/projects\/([^/?#]+)(?:[/?#]|$)/.exec(target);
    if (!m) throw new Error('staging guard: the path names no project');
    ref = m[1];
  } else {
    ref = target;
  }
  if (ref !== staging) throw new Error('staging guard: the target is not the staging branch');
  return staging;
}

/** The Management API token from the environment (never printed). */
export function accessToken(env = process.env) {
  const token = (String(env.SUPABASE_ACCESS_TOKEN || '').trim().match(/sbp_[A-Za-z0-9_]+/) || [])[0];
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is not set: nothing done.');
  return token;
}

/** Hides a value from GitHub Actions' logs (does nothing elsewhere). */
export function mask(value, env = process.env) {
  if (env.GITHUB_ACTIONS && value) for (const line of String(value).split('\n')) if (line) console.log(`::add-mask::${line}`);
}

/** The password of every fictitious member: derived from the token, so it is in no file and no log. */
export function loadPassword(token) {
  return `Lt-${createHmac('sha256', token).update('irly-staging-load-members').digest('hex').slice(0, 40)}`;
}

const cut = (v, n = 300) => {
  const s = String(v ?? '').replace(/\s+/g, ' ');
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/**
 * The door to the Management API. The branch list is the only thing ever asked of production; every
 * other call is refused by assertStaging unless its path names the staging branch.
 */
export function createStaging({ token, fetch = globalThis.fetch } = {}) {
  if (!token) throw new Error('no token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let branches = null;
  let calls = 0;

  async function send(method, path, body) {
    calls += 1;
    const res = await fetch(MANAGEMENT_API + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text();
    if (!res.ok) throw Object.assign(new Error(`${method} ${path.replace(/\?.*/, '')}: ${res.status} ${cut(text, 400)}`), { status: res.status });
    return text ? JSON.parse(text) : {};
  }

  /** Reads the branch list (once) and returns the staging reference. */
  async function ref() {
    if (!branches) branches = await send('GET', BRANCH_LIST);
    return stagingRefFrom(branches);
  }

  /** Any Management API call about the staging branch. `path` starts after /projects/<ref>. */
  async function request(method, path, body) {
    const staging = await ref();
    const full = `/projects/${staging}${path}`;
    assertStaging(full, branches);
    return send(method, full, body);
  }

  /** SQL on the staging branch. Retries what is safe to retry: a read, or a refusal before anything ran (429, 5xx on connect). */
  async function sql(query, { readOnly = false, tries = 3 } = {}) {
    for (let i = 1; ; i += 1) {
      try {
        return await request('POST', '/database/query', { query, read_only: readOnly });
      } catch (e) {
        const again = i < tries && (e.status === 429 || (readOnly && (e.status === undefined || e.status >= 500)));
        if (!again) throw e;
        await new Promise((r) => setTimeout(r, 2000 * i));
      }
    }
  }

  /** The URLs the load tools may be pointed at: each one has been through the guard. */
  async function targets() {
    const staging = await ref();
    const base = `https://${staging}.supabase.co`;
    const out = { ref: staging, base, rest: `${base}/rest/v1`, auth: `${base}/auth/v1`, realtime: `wss://${staging}.supabase.co/realtime/v1/websocket` };
    for (const url of [out.base, out.rest, out.auth, out.realtime]) assertStaging(url, branches);
    return out;
  }

  return { ref, request, sql, targets, calls: () => calls };
}

/**
 * What on the staging branch could reach the outside world. Read only. The load and the seed refuse to
 * run when a push token is registered (a message would then be sent to a real phone).
 */
export async function outsideReach(api) {
  const rows = await api.sql(
    `select
      (select count(*) from public.push_tokens)::int as push_tokens,
      (select count(*) from public.push_outbox where handled_at is null)::int as push_waiting,
      (select count(*) from private.geocoder where active and coalesce(api_key, '') <> '')::int as geocoders_on,
      (select count(*) from public.news_sources where active and terms_checked and feed_url is not null)::int as news_feeds_on,
      (select count(*) from pg_extension where extname = 'pg_net')::int as pg_net,
      (select count(*) from pg_extension where extname = 'pg_cron')::int as pg_cron`,
    { readOnly: true },
  );
  const r = rows[0] ?? {};
  let jobs = [];
  if (r.pg_cron) jobs = await api.sql('select jobname, schedule, active from cron.job order by jobname', { readOnly: true });
  return { ...r, jobs };
}

/** HS256 JSON Web Token (the kind Supabase's legacy JWT secret signs). */
export function signJwt(claims, secret) {
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

/** The id of fictitious member n (1-based): a fixed, recognisable range. The SQL side is in staging-seed.mjs. */
export const memberId = (n) => `10ad7e57-0001-4000-8000-${n.toString(16).padStart(12, '0')}`;
export const SIZES = { small: 1000, medium: 10000, large: 50000 };
