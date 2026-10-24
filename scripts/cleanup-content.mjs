// Clean-up of test content, approved by the owner on 2026-10-24 (scope shown
// to them from the census of run 40130230706 and confirmed): production keeps
// its official communities and the accounts that are not automatic tests
// (appreview, Irly Admin and the owner's own accounts). It removes:
// - the automatic test accounts (…@irly.test), through the app's own
//   delete_my_account() (« Delete account » in Settings), with what they own;
// - every private and group chat, and every match and activity chat;
// - every message of the official community chats (the chats themselves stay);
// - every post, comment and Live, every activity, and member-made
//   communities left by a deleted account;
// - every notification (they point at the content above).
// Without APPLY=1 it only counts. Files go with the Storage purge job.
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').match(/sbp_[^\s"'`]+/)?.[0];
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
const apply = process.env.APPLY === '1';
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is missing');

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

const KEEP = 'appreview@getirly.com';
const TEST = `email like '%@irly.test'`;

const count = async () =>
  (
    await sql(`select
  (select count(*) from auth.users)::int as accounts,
  (select count(*) from auth.users where ${TEST})::int as test_accounts,
  (select count(*) from public.conversations where kind in ('direct', 'group', 'match'))::int as private_chats,
  (select count(*) from public.messages m join public.conversations v on v.id = m.conversation_id where v.kind = 'community')::int as community_messages,
  (select count(*) from public.messages)::int as messages,
  (select count(*) from public.community_posts)::int as posts,
  (select count(*) from public.comments)::int as comments,
  (select count(*) from public.irl_posts)::int as lives,
  (select count(*) from public.activities)::int as activities,
  (select count(*) from public.communities where not official)::int as member_communities,
  (select count(*) from public.communities where official)::int as official_communities,
  (select count(*) from public.notifications)::int as notifications`)
  )[0];

console.log('before:', JSON.stringify(await count()));
const tests = await sql(`select id, email from auth.users where ${TEST} order by created_at`);
if (tests.some((u) => u.email === KEEP)) throw new Error('the App Review account matches the test pattern: stopping');
console.log(`test accounts: ${tests.map((u) => u.email).join(', ') || 'none'}`);

if (!apply) {
  console.log('\nDry run: nothing deleted. Set APPLY=1 to delete.');
  process.exit(0);
}

for (const u of tests) {
  await sql(`do $$ begin
    perform set_config('request.jwt.claim.sub', '${u.id}', false);
    perform set_config('request.jwt.claims', json_build_object('sub', '${u.id}', 'role', 'authenticated')::text, false);
    perform public.delete_my_account();
    perform set_config('request.jwt.claim.sub', '', false);
    perform set_config('request.jwt.claims', '', false);
  end $$`);
  console.log(`deleted account ${u.email}`);
}

const [done] = await sql(`with
  l as (delete from public.irl_posts returning 1),
  c as (delete from public.comments returning 1),
  p as (delete from public.community_posts returning 1),
  a as (delete from public.activities returning 1),
  v as (delete from public.conversations where kind in ('direct', 'group', 'match', 'activity') returning 1),
  m as (delete from public.messages where conversation_id in (select id from public.conversations where kind = 'community') returning 1),
  k as (delete from public.communities x where not x.official
        and not exists (select 1 from auth.users u where u.id = x.created_by and not (u.${TEST})) returning 1),
  n as (delete from public.notifications returning 1)
  select (select count(*) from l)::int as lives, (select count(*) from c)::int as comments, (select count(*) from p)::int as posts,
    (select count(*) from a)::int as activities, (select count(*) from v)::int as chats, (select count(*) from m)::int as community_messages,
    (select count(*) from k)::int as member_communities, (select count(*) from n)::int as notifications`);
console.log('\ndeleted:', JSON.stringify(done));
console.log('after:', JSON.stringify(await count()));
