// Read-only census of the accounts and their content before any clean-up:
// which accounts look like test or development accounts, what each one owns
// (activities, posts, messages, communities…), and what would be left.
// Deletes nothing. Emails of accounts that do not match a test pattern are
// masked (first letter + domain) so the log identifies them without
// exposing members.
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').match(/sbp_[^\s"'`]+/)?.[0];
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
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

// Patterns the test scripts and seeds use; anything else is shown masked.
const TEST = `(u.email like '%@irly.test' or u.email like 'e2e-%' or u.email like '%@example.com'
  or u.email like '%@example.org' or u.email like '%+test%' or u.email like 'test%@%' or u.email like '%@test.%')`;

const rows = await sql(`
  select u.id, u.email, ${TEST} as test_pattern,
    to_char(u.created_at, 'YYYY-MM-DD') as created, to_char(u.last_sign_in_at, 'YYYY-MM-DD') as last_sign_in,
    coalesce(u.raw_app_meta_data ->> 'provider', '') as provider,
    p.id is not null as has_profile, coalesce(p.first_name, '') as first_name,
    exists (select 1 from public.staff_roles s where s.user_id = u.id) as staff,
    (select count(*) from public.activities a where a.creator_id = u.id)::int as activities,
    (select count(*) from public.activity_participants x where x.user_id = u.id)::int as joins,
    (select count(*) from public.community_posts x where x.author_id = u.id)::int as posts,
    (select count(*) from public.comments x where x.author_id = u.id)::int as comments,
    (select count(*) from public.messages x where x.sender_id = u.id)::int as messages,
    (select count(*) from public.communities x where x.created_by = u.id and x.deleted_at is null)::int as communities,
    (select count(*) from public.community_members x where x.user_id = u.id)::int as memberships,
    (select count(*) from public.irl_posts x where x.author_id = u.id)::int as irl_posts,
    (select count(*) from public.notifications x where x.user_id = u.id)::int as notifications
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by ${TEST} desc, u.created_at`);

const mask = (e) => (e ? `${e[0]}***@${e.split('@')[1] || '?'}` : '(no email)');
console.log(`accounts: ${rows.length}, matching a test pattern: ${rows.filter((r) => r.test_pattern).length}, staff: ${rows.filter((r) => r.staff).length}`);
console.log('\nemail | test pattern | staff | provider | created | last sign-in | name | activities | joins | posts | comments | messages | communities | memberships | irl | notifs');
for (const r of rows) {
  const email = r.test_pattern || r.email === 'appreview@getirly.com' ? r.email : mask(r.email);
  const name = r.test_pattern ? r.first_name : (r.first_name ? `${r.first_name[0]}.` : '');
  console.log([email, r.test_pattern ? 'yes' : 'no', r.staff ? 'yes' : 'no', r.provider, r.created, r.last_sign_in || '-', name,
    r.activities, r.joins, r.posts, r.comments, r.messages, r.communities, r.memberships, r.irl_posts, r.notifications].join(' | '));
}

// Content without an owner any more, and activities that look like tests.
const [orph] = await sql(`select
  (select count(*) from public.activities a where not exists (select 1 from public.profiles p where p.id = a.creator_id))::int as activities_no_creator,
  (select count(*) from public.messages m where m.sender_id is null)::int as messages_no_sender,
  (select count(*) from public.communities c where c.created_by is null and not c.official and c.deleted_at is null)::int as member_communities_no_creator`);
console.log('\norphans:', JSON.stringify(orph));
const acts = await sql(`
  select a.title, to_char(a.created_at, 'YYYY-MM-DD') as created, ${TEST} as by_test_account
  from public.activities a join auth.users u on u.id = a.creator_id
  where a.title ~* '(\\[e2e\\]|e2e|test|demo|lorem|asdf|xxx)'
  order by a.created_at`);
console.log(`\nactivities whose title looks like a test: ${acts.length}`);
for (const a of acts) console.log([a.created, a.by_test_account ? 'test account' : 'other account', a.title.slice(0, 80)].join(' | '));
