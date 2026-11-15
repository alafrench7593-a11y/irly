/**
 * Times the statements the load test found slowest, one at a time and at rest, on the STAGING branch,
 * as a fictitious member (role authenticated, her id in the request claims): execution time and the plan
 * nodes that cost the most. Read only in effect: each statement runs inside a transaction that is rolled
 * back. Goes through the staging guard (scripts/staging-lib.mjs): it cannot run against production.
 * Env: SUPABASE_ACCESS_TOKEN. Usage: node scripts/staging-explain.mjs
 */
import { readFileSync } from 'node:fs';
import { accessToken, createStaging, memberId } from './staging-lib.mjs';

const api = createStaging({ token: accessToken() });
const MEMBERS = [1, 500];

const uid = (m) => `'${memberId(m)}'::uuid`;
/** What the app really sends: PostgREST puts the member's id in the request as a literal, not as auth.uid(). */
const STATEMENTS = [
  ['notifications, latest 50 (as the app asks)', () => `select id, kind, payload, read_at, created_at from public.notifications where kind not in ('MESSAGE_CREATED', 'GROUP_ADDED') order by created_at desc limit 50`],
  ['my_calendar()', () => `select * from public.my_calendar()`],
  ['my_calendar body, auth.uid() as written', () => `select a.id from (select x.activity_id from public.activity_participants x where x.user_id = auth.uid() and x.status = 'going' offset 0) x join public.activities a on a.id = x.activity_id where a.cancelled_at is null and a.starts_at between now() - interval '1 day' and now() + interval '60 days'`],
  ['my_calendar body, (select auth.uid())', () => `select a.id from (select x.activity_id from public.activity_participants x where x.user_id = (select auth.uid()) and x.status = 'going' offset 0) x join public.activities a on a.id = x.activity_id where a.cancelled_at is null and a.starts_at between now() - interval '1 day' and now() + interval '60 days'`],
  ['my memberships (literal id, as the app asks)', (m) => `select conversation_id from public.conversation_members where user_id = ${uid(m)} limit 301`],
  ['participants of my activities (literal id, as the app asks)', (m) => `select activity_id, status from public.activity_participants where user_id = ${uid(m)}`],
  ['engagement(20 posts)', () => `select * from public.engagement('community_post', (select array_agg(id::text) from (select id from public.community_posts where deleted_at is null order by created_at desc limit 20) s))`],
  ['messages, latest 50 of one chat', (m) => `select id, sender_id, body, created_at from public.messages where conversation_id = (select conversation_id from public.conversation_members where user_id = ${uid(m)} order by conversation_id limit 1) and deleted_at is null order by created_at desc, id desc limit 50`],
  ['my_conversations()', () => `select * from public.my_conversations()`],
  ['community_posts_page', () => `select * from public.community_posts_page((select id from public.communities order by members_count desc nulls last limit 1), 'recent', null, 0, 20)`],
];

const read = (f) => readFileSync(new URL(`../docs/perf/sql/${f}`, import.meta.url), 'utf8');
const SELF = `alter policy notifications_self on public.notifications using (user_id = (select auth.uid()));`;
/** Candidate changes, each applied inside the transaction that is rolled back: the branch is left as it was. */
const VARIANTS = [
  ['as it is', ''],
  ['notifications_self with (select auth.uid())', SELF],
  ['helper plans (02)', read('02-helper-plans.sql')],
  ['helper plans + policies (02 + 03)', `${read('02-helper-plans.sql')}\n${read('03-policies.sql')}`],
  ['02 + 03 + notifications_self', `${read('02-helper-plans.sql')}\n${read('03-policies.sql')}\n${SELF}`],
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

async function explain(member, statement, ddl) {
  const id = memberId(member);
  const rows = await api.sql(
    `begin;
${ddl}
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

for (const [label, make] of STATEMENTS) {
  console.log(`\n## ${label}`);
  for (const member of MEMBERS) {
    for (const [variant, ddl] of VARIANTS) {
      try {
        const runs = [];
        let last = null;
        for (let i = 0; i < 3; i += 1) {
          last = await explain(member, make(member), ddl);
          runs.push(last['Execution Time']);
        }
        runs.sort((a, b) => a - b);
        const top = costly(last.Plan).sort((a, b) => b.own - a.own)[0];
        console.log(`member ${member} · ${variant}: ${runs[1].toFixed(1)} ms, rows ${last.Plan['Actual Rows']} · ${top.what} rows ${top.rows} x ${top.loops}${top.removed ? `, ${top.removed} removed` : ''}`);
      } catch (e) {
        console.log(`member ${member} · ${variant}: could not run: ${String(e.message).slice(0, 260)}`);
      }
    }
  }
}
