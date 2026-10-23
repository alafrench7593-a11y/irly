// Read-only inventory before the owner-requested clean-up of communities and
// of IRLY Girl / IRLY Maman member content. Lists every community with its
// space, then the member content of IRLY Girl and IRLY Maman. Deletes nothing.
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

console.log('--- communities (not deleted) ---');
const rows = await sql(`
  select c.id, private.community_space(c.id) as space, c.official, coalesce(c.topic, '') as topic, c.city_id,
    c.parent_id is not null as is_group, c.retired_at is not null as retired, c.members_count,
    (select count(*) from public.community_posts p where p.community_id = c.id and p.deleted_at is null)::int as posts,
    (select count(*) from public.activities a where a.community_id = c.id)::int as activities,
    coalesce((select first_name from public.profiles where id = c.created_by), case when c.created_by is null then '(IRLY)' else '(deleted)' end) as creator,
    left(c.name, 50) as name
  from public.communities c where c.deleted_at is null
  order by 2, c.official desc, c.parent_id nulls first, c.name`);
for (const r of rows) console.log([r.space, r.official ? 'OFFICIAL' : 'member', r.topic, r.city_id, r.is_group ? 'group' : 'main', r.retired ? 'retired' : '', r.members_count, r.posts, r.activities, r.creator, r.name, r.id].join(' | '));
const sum = {};
for (const r of rows) {
  const k = `${r.space}/${r.official ? 'official' : 'member'}${r.is_group ? '/group' : ''}${r.retired ? '/retired' : ''}`;
  sum[k] = (sum[k] ?? 0) + 1;
}
console.log('totals:', sum);

console.log('\n--- IRLY Girl and IRLY Maman member content ---');
console.log(await sql(`
  with posts as (
    select p.id, private.community_space(p.community_id) as sp from public.community_posts p where p.deleted_at is null)
  select sp as space, count(*)::int as community_posts from posts where sp in ('girl', 'mom') group by 1 order by 1`));
console.log(await sql(`
  select private.item_space('comment', c.id::text) as space, count(*)::int as comments
  from public.comments c where c.deleted_at is null group by 1 order by 1`));
console.log(await sql(`
  select private.item_space('irl_post', p.id::text) as space, count(*)::int as lives from public.irl_posts p group by 1 order by 1`));
console.log(await sql(`
  select private.item_space('activity', a.id::text) as space, count(*)::int as activities from public.activities a group by 1 order by 1`));
console.log('help questions etc. (other girl tables):', await sql(`
  select table_name from information_schema.tables where table_schema = 'public' and (table_name like 'girl%' or table_name like '%help%' or table_name like 'mom%') order by 1`));
