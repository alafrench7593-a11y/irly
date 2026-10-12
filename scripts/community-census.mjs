// Read-only census of communities (no member identities): how they are
// organised today, before any change to the hierarchy. Prints a table.
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

const rows = await sql(`
  select c.city_id, c.official, coalesce(p.name, '') as parent, c.name, c.topic, c.subtopic,
    (select count(*) from public.community_members m where m.community_id = c.id)::int as members,
    to_char(c.created_at, 'YYYY-MM-DD') as created
  from public.communities c
  left join public.communities p on p.id = c.parent_id
  where c.deleted_at is null
  order by c.city_id, coalesce(p.name, c.name), c.parent_id nulls first, c.name`);
const tops = rows.filter((r) => !r.parent);
const subs = rows.filter((r) => r.parent);
console.log(`communities: ${rows.length} (${tops.length} main, ${subs.length} sub-communities)`);
console.log(`official: ${rows.filter((r) => r.official).length}, created by members: ${rows.filter((r) => !r.official).length}`);
console.log(`with no member: ${rows.filter((r) => r.members === 0).length}`);
console.log('\ncity | official | main community | sub-community | members | created');
for (const r of rows) console.log([r.city_id, r.official ? 'yes' : 'no', r.parent || r.name, r.parent ? r.name : '', r.members, r.created].join(' | '));
