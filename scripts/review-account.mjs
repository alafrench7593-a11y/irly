/**
 * The App Store review account, made or refreshed on the real backend.
 * - Email: appreview@getirly.com (no inbox needed: email accounts are
 *   confirmed right away). Password: the REVIEW_ACCOUNT_PASSWORD secret,
 *   never in the code; at least 14 characters.
 * - Hidden from members (profile visibility "nobody"), so nobody mistakes it
 *   for a real person; its bio says what it is.
 * - Answers filled in (Dubai, a few interests) so the reviewer sees real
 *   recommendations and Match IRLY; it joins nothing and posts nothing.
 * Run: Actions → Review account → Run workflow. Safe to run again.
 */
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').match(/sbp_[^\s"'`]+/)?.[0];
const password = (process.env.REVIEW_ACCOUNT_PASSWORD || '').trim();
const EMAIL = 'appreview@getirly.com';
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN missing');
if (password.length < 14) throw new Error('REVIEW_ACCOUNT_PASSWORD missing or shorter than 14 characters');

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}
// Dollar-quoted so any character of the password is safe.
const pw = `$irlypw$${password}$irlypw$`;
if (password.includes('$irlypw$')) throw new Error('Choose another password');

const existing = await sql(`select id from auth.users where email = '${EMAIL}'`);
let id;
if (existing.length) {
  id = existing[0].id;
  await sql(`update auth.users set encrypted_password = extensions.crypt(${pw}, extensions.gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = '${id}'`);
  console.log('review account: password refreshed');
} else {
  [{ user_id: id }] = await sql(`
    with u as (
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${EMAIL}',
        extensions.crypt(${pw}, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
      returning id
    )
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), u.id, u.id::text, 'email', jsonb_build_object('sub', u.id::text, 'email', '${EMAIL}', 'email_verified', true), now(), now(), now()
    from u returning user_id`);
  console.log('review account: created');
}
await sql(`
  insert into public.profiles (id, first_name, birthdate, gender, city_id, languages, bio, interests, activity_prefs, intentions)
  values ('${id}', 'App Review', '1990-01-01', 'other', 'dubai', '{en}', 'IRLY test account for the App Store review. Not a real member.',
    '{sports,food,travel,startups}', '{running,padel}', '{friends,activities}')
  on conflict (id) do update set first_name = excluded.first_name, bio = excluded.bio, deleted_at = null;
  insert into public.safety_settings (user_id, profile_visibility, who_can_message) values ('${id}', 'nobody', 'friends')
  on conflict (user_id) do update set profile_visibility = 'nobody';`);
console.log('review account ready (hidden from members)');
