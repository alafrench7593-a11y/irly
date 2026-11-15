/**
 * Times the statements the load test found slowest, one at a time and at rest, on the STAGING branch,
 * as a fictitious member (role authenticated, her id in the request claims): execution time and the plan
 * nodes that cost the most. Read only in effect: each statement runs inside a transaction that is rolled
 * back. Goes through the staging guard (scripts/staging-lib.mjs): it cannot run against production.
 * Env: SUPABASE_ACCESS_TOKEN. Usage: node scripts/staging-explain.mjs
 */
import { accessToken, createStaging, memberId } from './staging-lib.mjs';

const api = createStaging({ token: accessToken() });
const MEMBERS = [1, 500];

const STATEMENTS = [
  ['my_calendar()', `select * from public.my_calendar()`],
  ['my_calendar, its body', `select a.id, a.title, a.creator_id = auth.uid(), (select c.id from public.conversations c where c.activity_id = a.id)
     from (select x.activity_id from public.activity_participants x where x.user_id = auth.uid() and x.status = 'going' offset 0) x
     join public.activities a on a.id = x.activity_id
     where a.cancelled_at is null and a.starts_at between now() - interval '1 day' and now() + interval '60 days' order by a.starts_at`],
  ['my participations only', `select x.activity_id from public.activity_participants x where x.user_id = auth.uid() and x.status = 'going'`],
  ['engagement(20 posts)', `select * from public.engagement('community_post', (select array_agg(id::text) from (select id from public.community_posts where deleted_at is null order by created_at desc limit 20) s))`],
  ['notifications, latest 50', `select id, kind, payload, read_at, created_at from public.notifications where kind not in ('MESSAGE_CREATED', 'GROUP_ADDED') order by created_at desc limit 50`],
  ['activities list', `select id, title, starts_at from public.activities where city_id in ('dubai') and cancelled_at is null and starts_at >= now() - interval '2 hours' and girl_only = false order by starts_at limit 60`],
  ['messages, latest 50 of one chat', `select id, sender_id, body, created_at from public.messages where conversation_id = (select conversation_id from public.conversation_members where user_id = auth.uid() order by conversation_id limit 1) and deleted_at is null order by created_at desc, id desc limit 50`],
  ['my_conversations()', `select * from public.my_conversations()`],
  ['home_feed()', `select * from public.home_feed('mixte')`],
  ['live_feed()', `select * from public.live_feed('dubai', 'irly')`],
  ['games_overview()', `select * from public.games_overview('mixte')`],
  ['my_profile()', `select * from public.my_profile()`],
  ['my memberships', `select conversation_id from public.conversation_members where user_id = auth.uid() limit 301`],
];

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function costly(plan, out = []) {
  const kids = plan.Plans ?? [];
  const total = (plan['Actual Total Time'] ?? 0) * (plan['Actual Loops'] ?? 1);
  const own = total - kids.reduce((s, k) => s + (k['Actual Total Time'] ?? 0) * (k['Actual Loops'] ?? 1), 0);
  out.push({ own, what: `${plan['Node Type']}${plan['Relation Name'] ? ` on ${plan['Relation Name']}` : ''}${plan['Index Name'] ? ` (${plan['Index Name']})` : ''}${plan['Function Name'] ? ` ${plan['Function Name']}` : ''}`, rows: plan['Actual Rows'], loops: plan['Actual Loops'], removed: plan['Rows Removed by Filter'] });
  for (const k of kids) costly(k, out);
  return out;
}

async function explain(member, statement) {
  const id = memberId(member);
  const rows = await api.sql(
    `begin;
create temp table _plan (j json) on commit drop;
do $do$
declare v json;
begin
  perform set_config('request.jwt.claim.sub', ${lit(id)}, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: id, role: 'authenticated', aud: 'authenticated' }))}, true);
  set local role authenticated;
  execute ${lit(`explain (analyze, buffers, format json) ${statement}`)} into v;
  reset role;
  insert into _plan values (v);
end
$do$;
select j from _plan;
rollback;`,
    { readOnly: false, tries: 1 },
  );
  const j = rows?.[0]?.j;
  return Array.isArray(j) ? j[0] : j;
}

const server = await api.sql(`select current_setting('server_version') as version, current_setting('shared_buffers') as shared_buffers, current_setting('effective_cache_size') as cache, current_setting('work_mem') as work_mem, current_setting('jit') as jit, (select count(*) from pg_stat_activity where state = 'active')::int as active_now`, { readOnly: true });
console.log('## Staging at rest');
console.log(JSON.stringify(server[0]));

for (const [label, statement] of STATEMENTS) {
  console.log(`\n## ${label}`);
  for (const member of MEMBERS) {
    try {
      const runs = [];
      let last = null;
      for (let i = 0; i < 3; i += 1) {
        last = await explain(member, statement);
        runs.push(last['Execution Time']);
      }
      runs.sort((a, b) => a - b);
      const top = costly(last.Plan).sort((a, b) => b.own - a.own).slice(0, 4);
      console.log(`member ${member}: median ${runs[1].toFixed(1)} ms (runs ${runs.map((r) => r.toFixed(1)).join(', ')}), planning ${last['Planning Time'].toFixed(1)} ms, rows ${last.Plan['Actual Rows']}`);
      for (const t of top) console.log(`   ${t.own.toFixed(1)} ms  ${t.what}  rows ${t.rows} x ${t.loops}${t.removed ? `, ${t.removed} removed by filter` : ''}`);
    } catch (e) {
      console.log(`member ${member}: could not run: ${String(e.message).slice(0, 300)}`);
    }
  }
}
