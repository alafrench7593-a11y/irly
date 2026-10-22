// Read-only census, before the App Store submission: every member-made
// community, group chat, direct chat and activity still in production, with
// who made it (first name only, plus whether that account is IRLY staff), so
// the owner can point at what their own tests left. Then the numbers that
// say whether the database is the cause of slowness (size, busiest queries,
// connections, compute size). Deletes nothing.
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').match(/sbp_[^\s"'`]+/)?.[0];
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is missing');

async function api(path, init = {}) {
  const res = await fetch(`https://api.supabase.com/v1${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}
const sql = (query) => api(`/projects/${ref}/database/query`, { method: 'POST', body: JSON.stringify({ query }) });
const who = (alias) => `coalesce((select p.first_name from public.profiles p where p.id = ${alias}), '(deleted)')
  || case when exists (select 1 from public.staff_roles s where s.user_id = ${alias}) then ' [staff]' else '' end`;

const communities = await sql(`
  select c.id, c.name, c.city_id, c.girl_only, to_char(c.created_at, 'YYYY-MM-DD') as created, ${who('c.created_by')} as creator,
    (select count(*) from public.community_members m where m.community_id = c.id)::int as members,
    (select count(*) from public.community_posts x where x.community_id = c.id)::int as posts
  from public.communities c
  where not c.official and c.deleted_at is null
  order by c.created_at`);
console.log(`member-made communities: ${communities.length}`);
console.log('id | created | city | girl only | creator | members | posts | name');
for (const c of communities) console.log([c.id, c.created, c.city_id, c.girl_only ? 'yes' : 'no', c.creator, c.members, c.posts, c.name.slice(0, 60)].join(' | '));

const chats = await sql(`
  select v.id, v.kind, coalesce(v.title, '') as title, to_char(v.created_at, 'YYYY-MM-DD') as created,
    (select string_agg(coalesce(p.first_name, '?'), ', ' order by p.first_name) from public.conversation_members cm
      left join public.profiles p on p.id = cm.user_id where cm.conversation_id = v.id) as members,
    (select count(*) from public.messages m where m.conversation_id = v.id)::int as messages
  from public.conversations v
  where v.kind in ('direct', 'group')
  order by v.kind, v.created_at`);
console.log(`\ndirect and group chats: ${chats.length}`);
console.log('id | kind | created | members | messages | title');
for (const v of chats) console.log([v.id, v.kind, v.created, v.members ?? '(none)', v.messages, v.title.slice(0, 40)].join(' | '));

const acts = await sql(`
  select a.id, a.title, a.city_id, to_char(a.created_at, 'YYYY-MM-DD') as created, to_char(a.starts_at, 'YYYY-MM-DD') as starts, ${who('a.creator_id')} as creator,
    (select count(*) from public.activity_participants x where x.activity_id = a.id)::int as people
  from public.activities a
  order by a.created_at`);
console.log(`\nactivities: ${acts.length}`);
console.log('id | created | starts | city | creator | people | title');
for (const a of acts) console.log([a.id, a.created, a.starts, a.city_id, a.creator, a.people, (a.title || '').slice(0, 60)].join(' | '));

const lives = await sql(`
  select count(*)::int as total, count(*) filter (where p.expires_at > now())::int as live_now from public.irl_posts p`).catch((e) => [{ error: e.message }]);
console.log('\nLives:', JSON.stringify(lives[0]));

// Is the database the slow part?
console.log('\n--- database load ---');
const [size] = await sql(`select pg_size_pretty(pg_database_size(current_database())) as db, (select count(*) from pg_stat_activity)::int as connections,
  (select setting from pg_settings where name = 'max_connections') as max_connections`);
console.log('size and connections:', JSON.stringify(size));
const tables = await sql(`select relname as table, n_live_tup::bigint as rows, pg_size_pretty(pg_total_relation_size(relid)) as size
  from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 10`);
for (const t of tables) console.log(`table ${t.table}: ${t.rows} rows, ${t.size}`);
const [cache] = await sql(`select round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) as cache_hit_pct from pg_statio_user_tables`);
console.log('cache hit %:', cache.cache_hit_pct);
const slow = await sql(`select calls, round(mean_exec_time::numeric, 1) as mean_ms, round(max_exec_time::numeric, 0) as max_ms, round(total_exec_time::numeric / 1000, 1) as total_s,
    regexp_replace(left(query, 110), '\\s+', ' ', 'g') as query
  from pg_stat_statements where query not ilike '%pg_stat%' and calls > 20 order by mean_exec_time desc limit 15`).catch((e) => [{ query: `pg_stat_statements unavailable: ${e.message.slice(0, 80)}` }]);
console.log('\nslowest queries on average (called more than 20 times):');
for (const q of slow) console.log([q.calls, `${q.mean_ms} ms avg`, `${q.max_ms} ms max`, `${q.total_s} s total`, q.query].join(' | '));
const project = await api(`/projects/${ref}`).catch((e) => ({ error: e.message }));
console.log('\nproject:', JSON.stringify({ region: project.region, status: project.status, database: project.database?.version, error: project.error }));
const addons = await api(`/projects/${ref}/billing/addons`).catch((e) => ({ error: e.message.slice(0, 120) }));
console.log('compute and add-ons:', JSON.stringify(addons.selected_addons ?? addons));
