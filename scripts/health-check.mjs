// Daily production health check (read only), run by .github/workflows/health.yml.
//
// 1. Crashes: what members hit in the last 24 hours, from public.analytics_events
//    (JS_ERROR: errors no screen caught; SCREEN_ERROR: a screen showed "Something
//    went wrong"; SERVER_ERROR: a server call failed). Grouped by kind, scrubbed
//    first line, screen and app version (src/lib/crashReport.ts): nothing personal.
// 2. Backups: the Supabase project's database backups (Management API). The run
//    fails when the newest backup is older than 48 hours, or there is none (a
//    project on the free plan has none: then only a plan with backups fixes it).
//
// The run fails (and GitHub emails the repository's owner) when a crash was
// recorded in the last 24 hours or backups are missing or stale. Logs show
// counts only, never a member, a message or a key.
//
// Env: SUPABASE_ACCESS_TOKEN (the same secret as the database deploy),
//      SUPABASE_PROJECT_REF (default: the IRLY project).

const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const ref = (process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy').trim();
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is not set: nothing checked.');
  process.exit(1);
}
const api = `https://api.supabase.com/v1/projects/${ref}`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function call(path, init = {}) {
  const res = await fetch(`${api}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const query = (sql) => call('/database/query', { method: 'POST', body: JSON.stringify({ query: sql }) });

const problems = [];

// ── 1. Crashes ──
const crashes = await query(`
  select name,
    coalesce(props->>'kind', props->>'code', '') as kind,
    coalesce(props->>'detail', props->>'why', '') as detail,
    coalesce(props->>'screen', props->>'where', '') as screen,
    coalesce(props->>'app', '?') as app,
    coalesce(platform, '?') as platform,
    bool_or(coalesce((props->>'fatal')::boolean, false)) as fatal,
    count(*)::int as n,
    count(distinct user_id)::int as members
  from public.analytics_events
  where name in ('JS_ERROR', 'SCREEN_ERROR', 'SERVER_ERROR') and created_at > now() - interval '24 hours'
  group by 1, 2, 3, 4, 5, 6
  order by n desc
  limit 30`);
const total = crashes.reduce((s, r) => s + r.n, 0);
console.log(`• errors in the last 24 h: ${total}`);
for (const r of crashes) {
  console.log(`  · ${r.name}${r.fatal ? ' (fatal)' : ''} ${r.kind}${r.detail ? `: ${r.detail}` : ''} on ${r.screen || '?'} · ${r.platform} ${r.app} · ${r.n}× for ${r.members} member(s)`);
}
const crashCount = crashes.filter((r) => r.name !== 'SERVER_ERROR').reduce((s, r) => s + r.n, 0);
if (crashCount > 0) problems.push(`${crashCount} app crash(es) in the last 24 h`);

const [week] = await query(`
  select count(*) filter (where name = 'JS_ERROR')::int as js, count(*) filter (where name = 'SCREEN_ERROR')::int as screen,
    count(*) filter (where name = 'SERVER_ERROR')::int as server
  from public.analytics_events where created_at > now() - interval '7 days'
    and name in ('JS_ERROR', 'SCREEN_ERROR', 'SERVER_ERROR')`);
console.log(`• last 7 days: ${week.js} JS errors, ${week.screen} crashed screens, ${week.server} server errors`);

// ── 2. Backups ──
try {
  const b = await call('/database/backups');
  const list = Array.isArray(b?.backups) ? b.backups : [];
  const done = list.filter((x) => String(x.status).toUpperCase() === 'COMPLETED').map((x) => new Date(x.inserted_at)).sort((a, c) => c - a);
  console.log(`• backups: ${list.length} listed, point-in-time recovery ${b?.pitr_enabled ? 'on' : 'off'}`);
  if (done.length) {
    const hours = Math.round((Date.now() - done[0].getTime()) / 36e5);
    console.log(`  · newest completed backup: ${done[0].toISOString().slice(0, 16)} UTC (${hours} h ago)`);
    if (hours > 48 && !b?.pitr_enabled) problems.push(`newest database backup is ${hours} h old`);
  } else if (!b?.pitr_enabled) {
    problems.push('no database backup found (the free plan has none: a paid plan adds daily backups)');
  }
} catch (e) {
  problems.push(`backups could not be read: ${e.message.slice(0, 160)}`);
}

if (problems.length) {
  console.error(`\nNeeds attention:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('\nAll good.');
