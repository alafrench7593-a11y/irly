// Clean-up before the App Store submission, approved by the owner on
// 2026-10-22: production keeps no member account except the App Review demo
// account (appreview@getirly.com, docs/APP_REVIEW_NOTES.md). Every other
// account is deleted through the app's own delete_my_account(), the same
// path as « Delete account » in Settings, so this also proves that deleting
// an account removes everything it owns. Then the three member-made
// communities the owner named and the chats nobody belongs to any more go.
// Ends with a check of what is left. Without APPLY=1 it only prints.
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
// The accounts listed by the census of 2026-10-22 (run 39816280175), by id: an account made since is left alone.
const ACCOUNTS = (process.env.ACCOUNT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const COMMUNITIES = ['009a752c-e426-40e6-9373-5cbbfa514d3e', '5062ec63-2ae4-42b3-8a09-ec9e7f0794c3', 'f8de6b44-7125-41af-ac4b-8d624d209335'];
const CHATS = ['c0232457-43c5-4954-987c-17befef26cb8', '6651ddf4-1208-4ca9-81c9-b465b38f8594', '6f9b2348-775e-4e4a-af91-e3d4cd64abd5',
  'fe927de6-ed0e-4569-ae9e-d2751066740f', 'feb0afae-9b06-4fa9-a5e3-4970bcda234e'];
const ids = (list) => list.map((id) => `'${id.replace(/[^0-9a-f-]/gi, '')}'`).join(', ');
const mask = (e) => (e ? `${e[0]}***@${e.split('@')[1] || '?'}` : '(no email)');

const users = await sql(`select u.id, u.email, to_char(u.created_at, 'YYYY-MM-DD') as created, coalesce(p.first_name, '') as name
  from auth.users u left join public.profiles p on p.id = u.id order by u.created_at`);
console.log(`accounts now: ${users.length}`);
for (const u of users) console.log([u.id, u.email === KEEP ? u.email : mask(u.email), u.created, u.name ? `${u.name[0]}.` : '', u.email === KEEP ? 'KEEP' : ACCOUNTS.includes(u.id) ? 'delete' : 'not listed: left alone'].join(' | '));
const targets = users.filter((u) => u.email !== KEEP && ACCOUNTS.includes(u.id));
const comms = await sql(`select id, name, official from public.communities where id in (${ids(COMMUNITIES)})`);
console.log(`\ncommunities to delete: ${comms.filter((c) => !c.official).map((c) => c.name).join(', ')}`);
const chats = await sql(`select v.id, v.kind from public.conversations v where v.id in (${ids(CHATS)})
  and v.kind in ('direct', 'group') and not exists (select 1 from public.conversation_members cm where cm.conversation_id = v.id)`);
console.log(`empty chats to delete: ${chats.length}`);
if (users.some((u) => u.email === KEEP && ACCOUNTS.includes(u.id))) throw new Error('the App Review account is in the list: stopping');

if (!apply) {
  console.log(`\nDry run: nothing deleted (${targets.length} accounts would be). Set APPLY=1 and ACCOUNT_IDS to delete.`);
  process.exit(0);
}

for (const u of targets) {
  await sql(`do $$ begin
    perform set_config('request.jwt.claim.sub', '${u.id}', false);
    perform set_config('request.jwt.claims', json_build_object('sub', '${u.id}', 'role', 'authenticated')::text, false);
    perform public.delete_my_account();
    perform set_config('request.jwt.claim.sub', '', false);
    perform set_config('request.jwt.claims', '', false);
  end $$`);
  console.log(`deleted account ${u.id}`);
}
const [done] = await sql(`with
  c as (delete from public.communities where id in (${ids(COMMUNITIES)}) and not official returning 1),
  v as (delete from public.conversations x where x.kind in ('direct', 'group')
    and not exists (select 1 from public.conversation_members cm where cm.conversation_id = x.id) returning 1)
  select (select count(*) from c)::int as communities, (select count(*) from v)::int as empty_chats`);
console.log('\ndeleted:', JSON.stringify(done));

// What is left of the deleted accounts: everything should be 0.
const gone = ids(targets.map((u) => u.id));
const [left] = await sql(`select
  (select count(*) from auth.users where id in (${gone}))::int as accounts,
  (select count(*) from public.profiles where id in (${gone}))::int as profiles,
  (select count(*) from public.activities where creator_id in (${gone}))::int as activities,
  (select count(*) from public.activity_participants where user_id in (${gone}))::int as joins,
  (select count(*) from public.community_members where user_id in (${gone}))::int as memberships,
  (select count(*) from public.conversation_members where user_id in (${gone}))::int as chat_memberships,
  (select count(*) from public.irl_posts where author_id in (${gone}))::int as lives,
  (select count(*) from public.community_posts where author_id in (${gone}))::int as posts,
  (select count(*) from public.comments where author_id in (${gone}))::int as comments,
  (select count(*) from public.notifications where user_id in (${gone}))::int as notifications,
  (select count(*) from public.push_tokens where user_id in (${gone}))::int as push_tokens,
  (select count(*) from public.messages where sender_id in (${gone}))::int as messages_signed,
  (select count(*) from public.conversations x where x.kind in ('direct', 'group')
    and not exists (select 1 from public.conversation_members cm where cm.conversation_id = x.id))::int as empty_chats,
  (select count(*) from private.storage_cleanup where user_id in (${gone}) and done_at is null)::int as files_waiting_purge`);
console.log('left of the deleted accounts (expected 0, files are purged by the Storage purge job):', JSON.stringify(left));
const [all] = await sql(`select (select count(*) from auth.users)::int as accounts, (select count(*) from public.activities)::int as activities,
  (select count(*) from public.irl_posts)::int as lives, (select count(*) from public.communities where not official and deleted_at is null)::int as member_communities`);
console.log('production now:', JSON.stringify(all));
