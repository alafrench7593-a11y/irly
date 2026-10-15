// Applies supabase/migrations to the IRLY Supabase project through the
// Supabase Management API (HTTPS only, no database password), records what
// ran in private.irly_migrations, and configures the sign-in email.
//
// Env: SUPABASE_ACCESS_TOKEN (personal access token, sbp_...),
//      SUPABASE_PROJECT_REF (default: the IRLY project).
// Run by .github/workflows/supabase.yml; also works locally:
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/deploy-db.mjs
import fs from 'node:fs';
import path from 'node:path';

// Tolerates a secret pasted as "SUPABASE_ACCESS_TOKEN=sbp_…", with quotes or spaces.
const raw = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const token = raw.match(/sbp_[^\s"'`]+/)?.[0] ?? raw.replace(/^["']|["']$/g, '');
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
if (!token) {
  console.log('SUPABASE_ACCESS_TOKEN is not set: nothing deployed.');
  process.exit(0);
}
// A personal access token starts with sbp_. The project's publishable,
// anon, secret or service_role keys do not work with the Management API.
if (!token.startsWith('sbp_')) {
  console.error(
    `SUPABASE_ACCESS_TOKEN must be a personal access token starting with "sbp_" (the saved value does not contain one).\n` +
      'Create one at https://supabase.com/dashboard/account/tokens and save it as the repository secret.',
  );
  process.exit(1);
}

const api = `https://api.supabase.com/v1/projects/${ref}`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function query(sql) {
  const res = await fetch(`${api}/database/query`, { method: 'POST', headers, body: JSON.stringify({ query: sql }) });
  const text = await res.text();
  if (res.status === 401) {
    throw new Error(
      `Supabase refused the access token (401: ${text.slice(0, 200)}). Token length ${token.length}. ` +
        'It may be revoked or mistyped: create a new one at https://supabase.com/dashboard/account/tokens and update the repository secret.',
    );
  }
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : [];
}

const lit = (s) => `'${s.replace(/'/g, "''")}'`;

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

// The schema may have been installed by hand (supabase/setup.sql in the SQL
// editor) before this script ever ran: that file contains these migrations.
const IN_SETUP_SQL = [
  '20261005000000_irly_core.sql',
  '20261005000100_irly_match.sql',
  '20261005000200_irly_platform.sql',
  '20261005000300_irly_account.sql',
];

await query(`create schema if not exists private;
create table if not exists private.irly_migrations (name text primary key, applied_at timestamptz not null default now());`);

const applied = new Set((await query('select name from private.irly_migrations')).map((r) => r.name));

if (applied.size === 0) {
  const [probe] = await query("select to_regclass('public.profiles') is not null as ok");
  if (probe?.ok) {
    for (const f of IN_SETUP_SQL) {
      await query(`insert into private.irly_migrations (name) values (${lit(f)}) on conflict do nothing`);
      applied.add(f);
    }
    console.log('= schema installed by hand from setup.sql: recorded as applied');
  }
}

for (const file of files) {
  if (applied.has(file)) {
    console.log(`= ${file} (already applied)`);
    continue;
  }
  const sql = fs.readFileSync(path.join(dir, file), 'utf8');
  // One transaction per migration: it applies entirely or not at all.
  await query(`begin;\n${sql}\ninsert into private.irly_migrations (name) values (${lit(file)});\ncommit;`);
  console.log(`+ ${file}`);
}

// Where sign-in links and Google send people back: getirly.com first (the
// default), then the other places the app runs. Merged with the list already
// on the project, never replaced.
const SITE = 'https://getirly.com/app';
const WANTED = ['https://getirly.com/**', 'https://www.getirly.com/**', 'https://alafrench7593-a11y.github.io/irly/**', 'https://*.vercel.app/**', 'https://*-link-a664.vercel.app/**', 'http://localhost:8081/**', 'http://localhost:19006/**', 'irly://**', 'exp://**'];
const current = await fetch(`${api}/config/auth`, { headers }).then((r) => (r.ok ? r.json() : {}));
const allow = new Set([...String(current.uri_allow_list ?? '').split(','), ...WANTED].map((u) => u.trim()).filter(Boolean));
// Without a custom SMTP, Supabase's default email only reaches the project's
// own team: confirmation emails would never arrive, so new accounts are
// confirmed right away until one is set (Authentication → SMTP).
const ownSmtp = Boolean(current.smtp_host);
const urls = await fetch(`${api}/config/auth`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ site_url: SITE, uri_allow_list: [...allow].join(','), ...(ownSmtp ? {} : { mailer_autoconfirm: true }) }),
});
console.log(urls.ok ? `✓ sign-in: back to ${SITE}; ${ownSmtp ? 'emails confirmed by link' : 'accounts confirmed right away (no custom SMTP yet)'}` : `! redirect URLs not configured (${urls.status}): ${(await urls.text()).slice(0, 300)}`);

// Sign-in email with a 6-digit code (needs a custom SMTP on the free plan;
// without it Supabase sends its default email with a sign-in link).
const auth = await fetch(`${api}/config/auth`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    mailer_subjects_magic_link: 'Your IRLY code',
    mailer_templates_magic_link_content:
      '<h2>Your IRLY code</h2><p>Enter this code in the app:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p><p>It expires in a few minutes. If you did not ask for it, ignore this email.</p>',
    mailer_otp_length: 6,
  }),
});
console.log(auth.ok ? '✓ sign-in email configured (6-digit code)' : `• default sign-in email kept (link): ${(await auth.text()).slice(0, 200)}`);

const [check] = await query("select count(*)::int as n from information_schema.tables where table_schema = 'public'");
console.log(`✓ database ready: ${check.n} tables in public`);

// Health (read only): signed-in accounts whose profile never reached the
// server cannot join anything. The app now publishes it on next launch.
const [orphans] = await query(
  "select count(*)::int as n, count(*) filter (where u.created_at > now() - interval '30 days')::int as recent from auth.users u left join public.profiles p on p.id = u.id where p.id is null and u.email not like 'e2e-%@irly.test'",
);
console.log(`• accounts without a server profile: ${orphans.n} (${orphans.recent} created in the last 30 days)`);

// Diagnostics (read only, nothing personal): how those accounts signed in, and
// the causes of errors members saw as "something went wrong" in the last 7 days.
const how = await query(
  "select coalesce(u.raw_app_meta_data->>'provider', 'unknown') as provider, (u.email_confirmed_at is not null) as confirmed, to_char(u.created_at, 'YYYY-MM-DD') as day from auth.users u left join public.profiles p on p.id = u.id where p.id is null and u.email not like 'e2e-%@irly.test' order by u.created_at desc limit 10",
);
for (const r of how) console.log(`  · no profile: signed in with ${r.provider}, email confirmed ${r.confirmed}, created ${r.day}`);
const errors = await query(
  "select name, coalesce(props->>'code', props->>'why', '') as code, coalesce(props->>'where', '') as place, count(*)::int as n from public.analytics_events where name in ('SERVER_ERROR', 'PROFILE_MISSING', 'PROFILE_SKIPPED') and created_at > now() - interval '7 days' group by 1, 2, 3 order by n desc limit 20",
);
console.log(errors.length ? '• errors members saw (7 days):' : '• errors members saw (7 days): none recorded');
for (const r of errors) console.log(`  · ${r.name} ${r.code}${r.place ? ` (${r.place})` : ''}: ${r.n}`);

// Profile writes refused by profiles_id_fkey: the signed-in account no longer existed in auth.users.
// When, on which platform, and whether an account deletion (E2E test account or not) happened just
// before: enough to tell a test artifact from a real member's stale session. Nothing personal printed.
const fkey = await query(`
  with ev as (
    select created_at, coalesce(platform, '?') as platform from public.analytics_events
    where name = 'SERVER_ERROR' and props->>'code' = 'profiles_id_fkey' and created_at > now() - interval '7 days'
  )
  select to_char(ev.created_at, 'YYYY-MM-DD HH24:MI') as at, ev.platform,
    (select count(*)::int from auth.audit_log_entries a where a.payload->>'action' = 'user_deleted'
       and a.created_at between ev.created_at - interval '15 minutes' and ev.created_at + interval '1 minute') as deletions_near,
    (select count(*)::int from auth.audit_log_entries a where a.payload->>'action' = 'user_deleted'
       and coalesce(a.payload->'traits'->>'user_email', '') like 'e2e-%@irly.test'
       and a.created_at between ev.created_at - interval '15 minutes' and ev.created_at + interval '1 minute') as e2e_deletions_near
  from ev order by ev.created_at`).catch((e) => (console.log(`• profiles_id_fkey timeline unavailable: ${e.message.slice(0, 120)}`), []));
for (const r of fkey) console.log(`  · profiles_id_fkey at ${r.at} UTC on ${r.platform}: ${r.deletions_near} account deletion(s) in the 15 min before (${r.e2e_deletions_near} E2E)`);
