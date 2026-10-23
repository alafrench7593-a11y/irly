// Read-only: is the App Store review account still there and usable, and
// which accounts hold a back-office role. Emails are masked except the
// review account's. Changes nothing.
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').match(/sbp_[^\s"'`]+/)?.[0];
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is missing');
const sql = (query) =>
  fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  }).then(async (r) => {
    const t = await r.text();
    if (!r.ok) throw new Error(`${r.status}: ${t.slice(0, 300)}`);
    return JSON.parse(t);
  });
const mask = `case when u.email = 'appreview@getirly.com' then u.email else left(u.email, 1) || '***@' || split_part(u.email, '@', 2) end`;
const cols = `${mask} as email, u.id, coalesce(u.raw_app_meta_data->>'provider', '?') as provider,
  (u.email_confirmed_at is not null) as confirmed, (u.banned_until is not null and u.banned_until > now()) as banned,
  (u.deleted_at is not null) as deleted, (u.encrypted_password is not null and u.encrypted_password <> '') as has_password,
  to_char(u.created_at, 'YYYY-MM-DD') as created, to_char(u.last_sign_in_at, 'YYYY-MM-DD HH24:MI') as last_sign_in,
  p.id is not null as has_profile, p.first_name, s.role as staff_role`;
const from = `from auth.users u left join public.profiles p on p.id = u.id left join public.staff_roles s on s.user_id = u.id`;

console.log('--- App Store review account ---');
const review = await sql(`select ${cols} ${from} where u.email = 'appreview@getirly.com'`);
console.log(review.length ? review : 'MISSING');

console.log('\n--- back-office roles ---');
console.log(await sql(`select ${cols} ${from} where s.user_id is not null order by s.granted_at`));

console.log('\n--- every account ---');
console.log(await sql(`select ${cols} ${from} order by u.created_at`));

console.log('\n--- global admin (migration 20261029700000) ---');
console.log(await sql(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('staff_badges', 'staff_transfer_owner', 'i_am_last_owner', 'admin_official_topics',
    'admin_official_reorder', 'admin_official_texts', 'admin_item_spaces', 'admin_space_overview', 'admin_overview_more') order by 1`));
console.log('last-owner trigger:', await sql(`select tgname from pg_trigger where tgname = 'staff_roles_keep_an_owner'`));
console.log('owners:', await sql(`select count(*)::int as n from public.staff_roles s join public.profiles p on p.id = s.user_id and p.deleted_at is null where s.role = 'owner'`));
console.log('official order:', await sql(`select topic, sort, girl_only from public.community_topics where active order by girl_only, sort`));
console.log('space overview (as the server):', await sql(`select private.community_space(c.id) as space, count(*)::int from public.communities c
  where c.deleted_at is null and c.parent_id is null and c.retired_at is null group by 1 order by 1`));
