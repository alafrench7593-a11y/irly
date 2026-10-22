// One-off clean-up of test data in production, approved by the owner on
// 2026-10-22 after the read-only census (scripts/test-data-census.mjs):
//   1. the test account test@gmail.com ("Ghost"), deleted through the app's
//      own delete_my_account() so its data goes the same way as any member's;
//   2. the communities the live E2E runs left behind (name + 8-character run
//      id, no member, no post);
//   3. the 23 empty communities seeded on 2026-10-05 with old names
//      ("Dubai Moms", "Bali Girls"…): only those with no member and no post;
//   4. direct and group conversations nobody belongs to any more.
// Every target is checked again by the query itself (no member, no post…),
// so a row that changed since the census is left alone. Without APPLY=1 it
// only prints what it would delete.
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

const SEEDED = ['Bali Brunch Girls', 'Bali Girls', 'Dubai New Moms', 'Girls Moving to Bali', 'Bali Women Entrepreneurs',
  'Bali French Girls', 'Bali Padel Girls', 'Bali Surf Girls', 'Ubud Moms', 'Uluwatu Girls', 'Dubai Hills Moms', 'Canggu Girls',
  'Bali Girls Who Travel', 'Bali Wellness Girls', 'Canggu Moms', 'Seminyak Girls', 'Ubud Girls', 'Bali Moms', 'Sanur Moms',
  'Bali Digital Nomad Girls', 'Bali Coworking Girls', 'Bali Newcomer Girls', 'Bali Beach Girls'];
const list = SEEDED.map((n) => `'${n.replaceAll("'", "''")}'`).join(', ');
const empty = `not exists (select 1 from public.community_members m where m.community_id = c.id)
  and not exists (select 1 from public.community_posts p where p.community_id = c.id)`;
const e2eCommunities = `c.created_by is null and not c.official and c.deleted_at is null
  and c.name ~ '^(Girls Padel|Book & Matcha|E2E Padel|E2E Girls Yoga) [a-z0-9]{8}$' and ${empty}`;
const seededCommunities = `c.created_by is null and not c.official and c.deleted_at is null
  and c.created_at < '2026-10-06' and c.name in (${list}) and ${empty}`;
const emptyConversations = `v.kind in ('direct', 'group')
  and not exists (select 1 from public.conversation_members cm where cm.conversation_id = v.id)`;

const [ghost] = await sql(`select u.id, coalesce(p.first_name, '') as name, to_char(u.created_at, 'YYYY-MM-DD') as created
  from auth.users u left join public.profiles p on p.id = u.id where u.email = 'test@gmail.com'`);
const [counts] = await sql(`select
  (select count(*) from public.communities c where ${e2eCommunities})::int as e2e_communities,
  (select count(*) from public.communities c where ${seededCommunities})::int as seeded_communities,
  (select count(*) from public.conversations v where ${emptyConversations})::int as empty_conversations`);
console.log(`test account test@gmail.com: ${ghost ? `found (${ghost.name}, created ${ghost.created})` : 'not found'}`);
console.log(`E2E communities: ${counts.e2e_communities} (expected 62)`);
console.log(`seeded empty communities: ${counts.seeded_communities} (expected 23)`);
console.log(`direct/group conversations with no member: ${counts.empty_conversations} (expected 284)`);

// Only the exact account the owner approved: created on 2026-10-11, named Ghost.
const ghostOk = ghost && ghost.name === 'Ghost' && ghost.created === '2026-10-11';
if (ghost && !ghostOk) console.log('test@gmail.com does not match the approved account (name/date): left alone');
if (!apply) {
  console.log('\nDry run: nothing deleted. Set APPLY=1 to delete.');
  process.exit(0);
}

if (ghostOk) {
  await sql(`do $$ begin
    perform set_config('request.jwt.claim.sub', '${ghost.id}', false);
    perform set_config('request.jwt.claims', json_build_object('sub', '${ghost.id}', 'role', 'authenticated')::text, false);
    perform public.delete_my_account();
    perform set_config('request.jwt.claim.sub', '', false);
    perform set_config('request.jwt.claims', '', false);
  end $$`);
}
const [done] = await sql(`with
  a as (delete from public.communities c where ${e2eCommunities} returning 1),
  b as (delete from public.communities c where ${seededCommunities} returning 1),
  d as (delete from public.conversations v where ${emptyConversations} returning 1)
  select (select count(*) from a)::int as e2e_communities, (select count(*) from b)::int as seeded_communities,
    (select count(*) from d)::int as empty_conversations,
    (select count(*) from auth.users where email = 'test@gmail.com')::int as test_account_left`);
console.log('\ndeleted:', JSON.stringify(done));
