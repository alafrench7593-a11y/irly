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
const token = raw.match(/sbp_[A-Za-z0-9_]+/)?.[0] ?? raw.replace(/^["']|["']$/g, '');
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

// Sign-in email with the 6-digit code the app asks for.
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
console.log(auth.ok ? '✓ sign-in email configured (6-digit code)' : `! sign-in email not configured (${auth.status}): ${(await auth.text()).slice(0, 300)}`);

const [check] = await query("select count(*)::int as n from information_schema.tables where table_schema = 'public'");
console.log(`✓ database ready: ${check.n} tables in public`);
