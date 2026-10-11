/**
 * Security audit of the live IRLY Supabase project, READ ONLY: nothing is
 * written, nothing is printed that could be a secret (no keys, no rows, no
 * email addresses). Through the Management API (SUPABASE_ACCESS_TOKEN).
 *  - tables reachable through the API without row level security;
 *  - policies open to everyone (USING true) on tables with member data;
 *  - SECURITY DEFINER functions any visitor can call;
 *  - storage buckets: public or not, size limit, file types;
 *  - storage policies;
 *  - tables published to Realtime, and whether RLS protects them;
 *  - sign-in settings that matter for account takeover.
 * Exit 1 when a finding is critical.
 */
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is missing');
const api = `https://api.supabase.com/v1/projects/${ref}`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function sql(query) {
  const res = await fetch(`${api}/database/query`, { method: 'POST', headers, body: JSON.stringify({ query, read_only: true }) });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
let critical = 0;
const section = (t) => console.log(`\n== ${t}`);
const line = (level, msg) => {
  if (level === 'CRITICAL') critical++;
  console.log(`  [${level}] ${msg}`);
};

// Reference tables everyone may read on purpose (no member data in them).
const REFERENCE = new Set(['categories', 'cities', 'countries', 'regions', 'admin_areas', 'areas', 'area_profiles', 'guide_articles', 'relocation_steps', 'places', 'irly_match_config']);

section('Tables reachable through the API (public schema) without RLS');
const noRls = await sql(`select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity order by 1`);
noRls.length ? noRls.forEach((r) => line('CRITICAL', `${r.t}: RLS is off`)) : line('OK', 'every table has RLS on');

section('Policies open to everyone');
const open = await sql(`select tablename as t, policyname as p, cmd, array_to_string(roles, ',') as roles from pg_policies
  where schemaname = 'public' and (qual = 'true' or with_check = 'true') order by 1`);
for (const r of open) line(REFERENCE.has(r.t) && r.cmd === 'SELECT' ? 'OK' : 'HIGH', `${r.t}.${r.p} (${r.cmd} for ${r.roles}) is open to all${REFERENCE.has(r.t) ? ' (reference data)' : ''}`);
if (!open.length) line('OK', 'none');

section('Write access granted to visitors (anon) on tables');
const anonWrite = await sql(`select table_name as t, string_agg(privilege_type, ',') as p from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE') group by 1 order by 1`);
anonWrite.length ? anonWrite.forEach((r) => line('MEDIUM', `${r.t}: anon has ${r.p} (RLS still decides the rows)`)) : line('OK', 'visitors have no write grant');

section('SECURITY DEFINER functions a visitor (anon) can call');
const anonFn = await sql(`select p.proname as f, pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1`);
const ANON_OK = new Set(['join_waitlist', 'contact_support', 'place_save_count']);
for (const r of anonFn) line(ANON_OK.has(r.f) ? 'OK' : 'HIGH', `${r.f}(${r.args})${ANON_OK.has(r.f) ? ' (meant for visitors)' : ' callable without signing in'}`);

section('SECURITY DEFINER functions without a fixed search_path');
const noPath = await sql(`select n.nspname || '.' || p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') order by 1`);
noPath.length ? noPath.forEach((r) => line('MEDIUM', `${r.f}`)) : line('OK', 'all of them pin search_path');

section('Private schema exposed to the API?');
const exposed = await (await fetch(`${api}/postgrest`, { headers })).json().catch(() => ({}));
const schemas = String(exposed.db_schema ?? '?');
line(/\bprivate\b/.test(schemas) ? 'CRITICAL' : 'OK', `schemas served by the API: ${schemas}`);

section('Storage buckets');
const buckets = await sql(`select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id`);
for (const b of buckets) {
  const issues = [];
  if (b.public) issues.push('PUBLIC (anyone with the link reads every file)');
  if (!b.file_size_limit) issues.push('no size limit');
  if (!b.allowed_mime_types?.length) issues.push('any file type accepted');
  line(b.public ? 'HIGH' : issues.length ? 'MEDIUM' : 'OK', `${b.id}: ${issues.length ? issues.join('; ') : `private, ${Math.round(b.file_size_limit / 1048576)} MB max, ${b.allowed_mime_types.join(' ')}`}`);
}

section('Storage policies');
const sp = await sql(`select policyname as p, cmd, array_to_string(roles, ',') as roles, coalesce(qual, '') as q, coalesce(with_check, '') as c from pg_policies
  where schemaname = 'storage' and tablename = 'objects' order by cmd, policyname`);
for (const r of sp) {
  const rule = `${r.q} ${r.c}`;
  const ownFolder = /auth\.uid\(\)/.test(rule);
  const level = /anon|public/.test(r.roles) && r.cmd !== 'SELECT' ? 'HIGH' : r.cmd !== 'SELECT' && !ownFolder ? 'MEDIUM' : 'OK';
  line(level, `${r.cmd} ${r.p} (${r.roles})${level !== 'OK' ? ': does not check the owner' : ''}`);
}

section('Realtime: published tables');
const rt = await sql(`select t.tablename as t, c.relrowsecurity as rls from pg_publication_tables t join pg_class c on c.relname = t.tablename
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname where t.pubname = 'supabase_realtime' order by 1`);
rt.forEach((r) => line(r.rls ? 'OK' : 'CRITICAL', `${r.t}${r.rls ? ' (RLS decides who receives each change)' : ': no RLS, every change goes to every subscriber'}`));
if (!rt.length) line('OK', 'no table published');

section('Sign-in settings');
const c = await (await fetch(`${api}/config/auth`, { headers })).json();
const show = (level, k, v, why) => line(level, `${k}: ${v}${why ? ` (${why})` : ''}`);
show(c.mailer_autoconfirm ? 'MEDIUM' : 'OK', 'email confirmation required', !c.mailer_autoconfirm, c.mailer_autoconfirm ? 'anyone can sign up with an address they do not own' : '');
show((c.password_min_length ?? 6) < 8 ? 'MEDIUM' : 'OK', 'password minimum length', c.password_min_length ?? 6);
show(c.password_hibp_enabled ? 'OK' : 'LOW', 'leaked password check', !!c.password_hibp_enabled, c.password_hibp_enabled ? '' : 'Pro plan feature');
show(c.security_update_password_require_reauthentication ? 'OK' : 'LOW', 'reauthentication to change password', !!c.security_update_password_require_reauthentication);
show(c.refresh_token_rotation_enabled === false ? 'MEDIUM' : 'OK', 'refresh token rotation', c.refresh_token_rotation_enabled !== false);
show((c.jwt_exp ?? 3600) > 3600 ? 'LOW' : 'OK', 'access token lifetime (s)', c.jwt_exp ?? 3600);
show(c.security_captcha_enabled ? 'OK' : 'LOW', 'captcha on sign-up and sign-in', !!c.security_captcha_enabled);
show('INFO', 'sign-in attempts per 5 min per IP (token refresh)', c.rate_limit_token_refresh ?? '?');
show('INFO', 'emails sent per hour', c.rate_limit_email_sent ?? '?');
show('INFO', 'sign-ups and sign-ins per 5 min per IP', c.rate_limit_verify ?? '?');
show(c.external_phone_enabled ? 'INFO' : 'OK', 'phone sign-in', c.external_phone_enabled ? 'on' : 'off');
show('INFO', 'MFA (TOTP) available', !!c.mfa_totp_enroll_enabled);
show('INFO', 'redirect URLs allowed', (c.uri_allow_list ?? '').split(',').filter(Boolean).length);


// Push notifications, in figures only (no address, no token, no text):
// are phones registered, do pushes leave, what do Expo and Apple answer?
section('Push notifications (last 24 hours)');
const tokens = await sql(`select platform, count(*)::int as n, max(updated_at) as last from public.push_tokens group by platform order by 1`);
tokens.length ? tokens.forEach((t) => line('INFO', `${t.platform ?? '?'} phones registered: ${t.n} (last ${t.last})`)) : line('INFO', 'no phone registered for notifications yet');
const outbox = await sql(`select count(*)::int as total, count(*) filter (where handled_at is not null and error is null)::int as delivered_to_expo,
  count(*) filter (where error is not null)::int as errors, count(*) filter (where handled_at is null)::int as waiting
  from public.push_outbox where created_at > now() - interval '24 hours'`);
const o = outbox[0];
line('INFO', `pushes: ${o.total} · accepted by Expo: ${o.delivered_to_expo} · errors: ${o.errors} · waiting: ${o.waiting}`);
const errs = await sql(`select error, count(*)::int as n from public.push_outbox where error is not null and created_at > now() - interval '24 hours' group by 1 order by 2 desc limit 5`);
errs.forEach((e) => line('INFO', `error "${e.error}": ${e.n}`));
const cron = await sql(`select jobname, active from cron.job where jobname like 'irly-%' order by 1`).catch(() => []);
cron.length ? cron.forEach((j) => line(j.active ? 'OK' : 'MEDIUM', `scheduled job ${j.jobname}: ${j.active ? 'active' : 'inactive'}`)) : line('MEDIUM', 'no scheduled push job found');

console.log(critical ? `\n${critical} critical finding(s)` : '\nNo critical finding');
process.exit(critical ? 1 : 0);
