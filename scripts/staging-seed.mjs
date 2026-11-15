/**
 * Fills the STAGING branch (never production: every call goes through scripts/staging-lib.mjs's guard)
 * with fictitious members and what they would have done: communities, chats, messages, posts, comments,
 * likes, activities, follows, friendships, blocks, notifications and Loup-Garou tables.
 *
 * Everything is obviously fictitious: emails load-<n>@irly.test, invented first names, no photo, ids in
 * 10ad7e57-…. No push token is ever created, so nothing can reach a phone.
 *
 * Sent as many small SQL requests (each one a transaction). Run again, it adds nothing twice: ids are
 * fixed and every insert skips what is already there.
 *
 * Triggers: the real ones run (as the database owner there is no signed-in member, so the guards that
 * protect members from each other let the rows through, and the ones that keep data consistent do
 * their work: chats of communities and activities, member counts, friends following each other, one
 * notification per comment, like and private message). Three are switched off, inside the transaction
 * that needs it and back on before it ends, because they would write one notification per member of a
 * community for every row: messages_created (community chats only), community_posts_created and
 * activities_community_fanout.
 *
 * Env: SUPABASE_ACCESS_TOKEN. Usage: node scripts/staging-seed.mjs --size small|medium|large [--dry-run]
 * Prints step timings, then counts. No member data, no key.
 */
import { pathToFileURL } from 'node:url';
import { accessToken, createStaging, loadPassword, outsideReach } from './staging-lib.mjs';
import { DIRECT_SETS, ID_PREFIX, plan } from './load/plan.mjs';

// Rows per request, sized from local timings so that one request stays far below a minute.
const PER = { members: 2500, memberships: 5000, pairs: 600, communityMessages: 10000, posts: 500, hot: 1500, activities: 120, follows: 5000, games: 25 };

const U = (kind) => (expr) => `('${ID_PREFIX}-${kind}-4000-8000-' || lpad(to_hex((${expr})::bigint), 12, '0'))::uuid`;
const M = U('0001');
const C = U('0002');
const D = U('0003');
const A = U('0004');
const P = U('0005');
const MSG_COMMUNITY = U('0061');
const MSG_DIRECT = U('0062');
const MSG_ACTIVITY = U('0063');
const COMMENT = U('0007');
const CHAT = U('0009');
const MAIL = (expr) => `'load-' || (${expr}) || '@irly.test'`;
const FIRST_NAMES = ['Zorvi', 'Kelna', 'Tamsu', 'Brixa', 'Ondry', 'Pelka', 'Mirzo', 'Quenn', 'Javra', 'Luthe', 'Sarvo', 'Enkia', 'Dravo', 'Fenli', 'Hoska', 'Ilvra', 'Nebri', 'Orsha', 'Rulka', 'Sibra', 'Tovik', 'Ulmer', 'Vaska', 'Yendi'];
const AREAS = ['marina', 'jlt', 'jbr', 'jvc', 'palm', 'downtown', 'difc', 'businessbay'];
const CATEGORIES = ['sport', 'food', 'networking', 'wellness', 'beach'];
const list = (a) => `array[${a.map((x) => `'${x}'`).join(', ')}]`;
const tx = (...statements) => `begin;\n${statements.join(';\n')};\ncommit;`;
const ranges = (from, to, step) => {
  const out = [];
  for (let a = from; a <= to; a += step) out.push([a, Math.min(to, a + step - 1)]);
  return out;
};

/** The reference rows the fictitious data points at (the branch copies the schema, not its rows). Real ids and names. */
const referenceSql = () =>
  tx(
    `insert into public.countries (id, name, sort) values ('ae', 'United Arab Emirates', 0) on conflict do nothing`,
    `insert into public.regions (id, country_id, name, sort) values ('dubai', 'ae', 'Dubai', 0) on conflict do nothing`,
    `insert into public.cities (id, region_id, name, timezone, live, sort) values ('dubai', 'dubai', 'Dubai', 'Asia/Dubai', true, 0) on conflict do nothing`,
    `insert into public.areas (id, city_id, name) values ('marina', 'dubai', 'Dubai Marina'), ('jlt', 'dubai', 'JLT'), ('jbr', 'dubai', 'JBR'), ('jvc', 'dubai', 'JVC'), ('palm', 'dubai', 'Palm Jumeirah'), ('downtown', 'dubai', 'Downtown'), ('difc', 'dubai', 'DIFC'), ('businessbay', 'dubai', 'Business Bay') on conflict do nothing`,
    `insert into public.categories (id, label) values ('sport', 'Sport'), ('food', 'Food'), ('networking', 'Networking'), ('wellness', 'Wellness'), ('beach', 'Beach') on conflict do nothing`,
  );

const membersSql = (a, b, hash) =>
  tx(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', ${M('i')}, 'authenticated', 'authenticated', ${MAIL('i')}, '${hash}', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"load_test":true}'::jsonb, now(), now(), '', '', '', ''
from generate_series(${a}, ${b}) i
on conflict (id) do update set encrypted_password = excluded.encrypted_password where auth.users.encrypted_password is distinct from excluded.encrypted_password`,
    `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select ${M('i')}::text, ${M('i')}, jsonb_build_object('sub', ${M('i')}::text, 'email', ${MAIL('i')}, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now()
from generate_series(${a}, ${b}) i
on conflict (provider_id, provider) do nothing`,
    `insert into public.profiles (id, first_name, birthdate, gender, city_id, country, languages, bio, area_id, interests, sports, intentions, onboarded_at, username, verified_at, created_at, member_types)
select ${M('i')}, (${list(FIRST_NAMES)})[1 + i % ${FIRST_NAMES.length}], date '1980-01-01' + ((i * 13) % 8700), case when i % 50 = 49 then 'other' when i % 2 = 0 then 'woman' else 'man' end, 'dubai', 'FR',
  array['en', 'fr'], 'Fictitious load-test member ' || i, (${list(AREAS)})[1 + i % ${AREAS.length}], array['food', 'beach', 'tech'], array['padel', 'running'], array['friends'],
  now() - (i % 300) * interval '1 day', 'load' || i, case when i % 3 = 0 then now() - interval '10 days' end, now() - ((i % 300) + 1) * interval '1 day', array['expat']
from generate_series(${a}, ${b}) i
on conflict (id) do nothing`,
    `insert into public.safety_settings (user_id, profile_visibility, who_can_message, map_visible, show_active)
select ${M('i')}, 'everyone', (array['everyone', 'friends', 'matches'])[1 + i % 3], i % 5 = 0, i % 4 = 0 from generate_series(${a}, ${b}) i
on conflict do nothing`,
    `insert into public.irly_match_profiles (user_id, visible, bio, interests, sports, goals, languages, areas, last_active_at)
select ${M('i')}, i % 10 <> 0, 'Fictitious load-test member ' || i, array['food', 'beach'], array['padel'], array['friends'], array['en'], array['marina'], now() - (i % 60) * interval '1 hour'
from generate_series(${a}, ${b}) i where i % 5 <> 0
on conflict do nothing`,
  );

const communitiesSql = (p) =>
  tx(
    `insert into public.communities (id, city_id, name, tagline, description, category_id, girl_only, created_by, created_at)
select ${C('k')}, 'dubai', 'Load Club ' || k, 'Fictitious load-test community', 'A community that exists only on the staging copy.', (${list(CATEGORIES)})[1 + k % ${CATEGORIES.length}], k % 10 = 0, ${M('2 * k')}, now() - interval '200 days'
from generate_series(1, ${p.communities.length}) k
on conflict (id) do nothing`,
    `insert into public.conversations (id, kind, title, community_id, created_at)
select ${CHAT('k')}, 'community', 'Load Club ' || k, ${C('k')}, now() - interval '200 days' from generate_series(1, ${p.communities.length}) k
on conflict do nothing`,
    `insert into public.community_members (community_id, user_id, role, joined_at)
select ${C('k')}, ${M('2 * k')}, 'owner', now() - interval '200 days' from generate_series(1, ${p.communities.length}) k
on conflict do nothing`,
  );

/** Requests of about `rows` rows each: [{ list: [community…], a, b }] (a..b: the member range read). */
function membershipChunks(p) {
  const chunks = [];
  let group = [];
  let sum = 0;
  for (const c of p.communities) {
    if (c.size > PER.memberships) {
      const parts = Math.ceil(c.size / PER.memberships);
      for (const [a, b] of ranges(1, p.members, Math.ceil(p.members / parts))) chunks.push({ list: [c], a, b });
      continue;
    }
    if (sum + c.size > PER.memberships && group.length) {
      chunks.push({ list: group, a: 1, b: p.members });
      group = [];
      sum = 0;
    }
    group.push(c);
    sum += c.size;
  }
  if (group.length) chunks.push({ list: group, a: 1, b: p.members });
  return chunks;
}
const membershipsSql = (p, { list: cs, a, b }) =>
  tx(
    `insert into public.community_members (community_id, user_id, role, joined_at)
select ${C('s.k')}, ${M('i')}, 'member', now() - ((i * 37 + s.k) % 180) * interval '1 day'
from (values ${cs.map((c) => `(${c.k}, ${c.size}, ${c.girl})`).join(', ')}) s(k, sz, girl), generate_series(${a}, ${b}) i
where ((i::bigint * 7919 + s.k * 104729) % ${p.members}) < case when s.girl then s.sz * 2 else s.sz end
  and (not s.girl or (i % 2 = 0 and i % 50 <> 49)) and i <> 2 * s.k
on conflict do nothing`,
  );

/** Private chats between friends (a member only writes to who accepts her messages), and their messages. */
const directsSql = (p, a, b) => {
  const st = [];
  DIRECT_SETS.forEach((s, set) => {
    const rows = `generate_series(${a}, ${b}) i where i % ${s.every} = ${s.at} and i + ${s.offset} <= ${p.members}`;
    const conv = D(`${set} * 1000000 + i`);
    st.push(
      `insert into public.friendships (user_a, user_b, requested_by, status, accepted_at)
select ${M('i')}, ${M(`i + ${s.offset}`)}, ${M('i')}, 'accepted', now() - interval '5 days' from ${rows}
on conflict do nothing`,
      `insert into public.conversations (id, kind, created_at) select ${conv}, 'direct', now() - interval '150 days' from ${rows} on conflict (id) do nothing`,
      `insert into public.conversation_members (conversation_id, user_id, role, joined_at, last_read_at)
select ${conv}, ${M('i')}, 'member', now() - interval '150 days', now() - interval '2 days' from ${rows}
on conflict do nothing`,
      `insert into public.conversation_members (conversation_id, user_id, role, joined_at, last_read_at)
select ${conv}, ${M(`i + ${s.offset}`)}, 'member', now() - interval '150 days', now() - interval '2 days' from ${rows}
on conflict do nothing`,
      `insert into public.messages (id, conversation_id, sender_id, kind, body, created_at)
select ${MSG_DIRECT(`${set}::bigint * 1000000000 + i * 100 + g`)}, ${conv}, case when g % 2 = 0 then ${M('i')} else ${M(`i + ${s.offset}`)} end, 'text', 'Load-test message ' || g || ' between two fictitious members',
  now() - (${p.directMessages} - g) * interval '9 hours' - interval '1 hour'
from generate_series(${a}, ${b}) i, generate_series(1, ${p.directMessages}) g where i % ${s.every} = ${s.at} and i + ${s.offset} <= ${p.members}
on conflict (id) do nothing`,
    );
  });
  return tx(...st);
};

/** [{ k, g0, g1, total }] grouped so that one request writes about `rows` rows of `field`. */
function seriesChunks(p, field, rows) {
  const chunks = [];
  let group = [];
  let sum = 0;
  for (const c of p.communities) {
    for (const [g0, g1] of ranges(1, c[field], rows)) {
      const n = g1 - g0 + 1;
      if (sum + n > rows && group.length) {
        chunks.push(group);
        group = [];
        sum = 0;
      }
      group.push({ k: c.k, g0, g1, total: c[field] });
      sum += n;
    }
  }
  if (group.length) chunks.push(group);
  return chunks;
}
const numbered = (chunk) => `with m as (
  select cm.community_id, cm.user_id, row_number() over (partition by cm.community_id order by cm.user_id) rn, count(*) over (partition by cm.community_id) n
  from public.community_members cm where cm.community_id in (${[...new Set(chunk.map((c) => c.k))].map((k) => C(k)).join(', ')})
), p(k, g0, g1, total) as (values ${chunk.map((c) => `(${c.k}, ${c.g0}, ${c.g1}, ${c.total})`).join(', ')})`;

const communityMessagesSql = (chunk) =>
  tx(
    `alter table public.messages disable trigger messages_created`,
    `${numbered(chunk)}
insert into public.messages (id, conversation_id, sender_id, kind, body, created_at)
select ${MSG_COMMUNITY('p.k::bigint * 10000000 + g')}, ${CHAT('p.k')}, m.user_id, 'text', 'Load-test message ' || g || ' in a fictitious community chat', now() - (p.total - g) * (interval '60 days' / p.total) - interval '10 minutes'
from p cross join lateral generate_series(p.g0, p.g1) g
join m on m.community_id = ${C('p.k')} and m.rn = 1 + (g::bigint * 7919 + p.k) % m.n
on conflict (id) do nothing`,
    `alter table public.messages enable trigger messages_created`,
  );

const postsSql = (chunk) =>
  tx(
    `alter table public.community_posts disable trigger community_posts_created`,
    `${numbered(chunk)}
insert into public.community_posts (id, community_id, author_id, body, created_at, kind)
select ${P('p.k::bigint * 1000000 + g')}, ${C('p.k')}, m.user_id, 'Load-test post ' || g || ': a fictitious member writes to a fictitious community.', now() - (p.total - g) * (interval '90 days' / p.total) - interval '1 hour',
  (array['post', 'post', 'post', 'question', 'recommendation'])[1 + g % 5]
from p cross join lateral generate_series(p.g0, p.g1) g
join m on m.community_id = ${C('p.k')} and m.rn = 1 + (g::bigint * 104729 + p.k) % m.n
on conflict (id) do nothing`,
    `alter table public.community_posts enable trigger community_posts_created`,
    `${numbered(chunk)}
insert into public.comments (id, target_type, target_id, author_id, body, created_at)
select ${COMMENT('1000000000 + (p.k::bigint * 1000000 + g) * 10 + c')}, 'community_post', ${P('p.k::bigint * 1000000 + g')}::text, m.user_id, 'Load-test comment ' || c, now() - c * interval '20 minutes'
from p cross join lateral generate_series(p.g0, p.g1) g cross join lateral generate_series(1, (g % 4)::int) c
join m on m.community_id = ${C('p.k')} and m.rn = 1 + (g::bigint * 31 + c * 17 + p.k) % m.n
on conflict (id) do nothing`,
    `${numbered(chunk)}
insert into public.likes (user_id, target_type, target_id, created_at)
select m.user_id, 'community_post', ${P('p.k::bigint * 1000000 + g')}::text, now() - l * interval '15 minutes'
from p cross join lateral generate_series(p.g0, p.g1) g cross join lateral generate_series(1, (2 + g % 7)::int) l
join m on m.community_id = ${C('p.k')} and m.rn = 1 + (g::bigint * 13 + l * 101 + p.k) % m.n
on conflict do nothing`,
  );

/** One post everybody reacted to: the newest of the biggest community. */
const hotPostSql = (p, a, b) => {
  const c = p.communities[0];
  const post = P(`${c.k * 1000000 + c.posts}`);
  const members = `(select user_id, row_number() over (order by user_id) rn from public.community_members where community_id = ${C(c.k)}) m`;
  return tx(
    `insert into public.comments (id, target_type, target_id, author_id, body, created_at)
select ${COMMENT('m.rn')}, 'community_post', ${post}::text, m.user_id, 'Load-test comment on the busy post', now() - (m.rn % 600) * interval '1 minute'
from ${members} where m.rn between ${a} and ${b} and m.rn <= ${p.hotPostComments}
on conflict (id) do nothing`,
    `insert into public.likes (user_id, target_type, target_id, created_at)
select m.user_id, 'community_post', ${post}::text, now() - (m.rn % 600) * interval '1 minute'
from ${members} where m.rn between ${a} and ${b} and m.rn <= ${p.hotPostLikes}
on conflict do nothing`,
  );
};

/** Upcoming activities only (the branch's own job removes ended ones), their participants and chat. */
const activitiesSql = (p, a, b) => {
  const count = p.communities.length;
  return tx(
    `alter table public.activities disable trigger activities_community_fanout`,
    `insert into public.activities (id, creator_id, format, title, description, category_id, city_id, area_id, place_name, starts_at, ends_at, capacity, privacy, community_id, created_at)
select ${A('n')}, case when k is null then ${M(`1 + (n * 7) % ${p.members}`)} else ${M('2 * k')} end, 'meetup', 'Load activity ' || n, 'A fictitious load-test activity.', (${list(CATEGORIES)})[1 + n % ${CATEGORIES.length}], 'dubai',
  (${list(AREAS)})[1 + n % ${AREAS.length}], 'Load place ' || n, t, t + interval '2 hours', case when n = 1 then 1000 when n = 2 then 20 when n % 3 = 0 then null else 20 + n % 40 end, 'public',
  case when k is not null then ${C('k')} end, now() - interval '3 days'
from (select n, now() + interval '3 hours' + ((n::bigint * 7919) % 43200) * interval '1 minute' as t,
        case when n % 2 = 0 and (1 + (n / 2) % ${count}) % 10 <> 0 then 1 + (n / 2) % ${count} end as k
      from generate_series(${a}, ${b}) n) s
on conflict (id) do nothing`,
    `alter table public.activities enable trigger activities_community_fanout`,
    `insert into public.activity_participants (activity_id, user_id, status, joined_at)
select ${A('n')}, ${M(`1 + (n::bigint * 613 + s * 7001) % ${p.members}`)}, 'going', now() - interval '1 day'
from generate_series(${a}, ${b}) n, generate_series(1, 14) s where s <= case when n = 2 then 10 else 2 + n % 13 end
on conflict do nothing`,
    ...(a === 1
      ? [
          `insert into public.activity_participants (activity_id, user_id, status, joined_at)
select ${A('1')}, ${M('i')}, 'going', now() - interval '1 day' from generate_series(1, ${Math.round(p.members / 50)}) i
on conflict do nothing`,
        ]
      : []),
    `insert into public.messages (id, conversation_id, sender_id, kind, body, created_at)
select ${MSG_ACTIVITY('n::bigint * 100 + g')}, c.id, x.creator_id, 'text', 'Load-test message ' || g || ' in a fictitious activity chat', now() - g * interval '3 hours'
from generate_series(${a}, ${b}) n join public.activities x on x.id = ${A('n')} join public.conversations c on c.activity_id = x.id, generate_series(1, ${p.activityMessages}) g
on conflict (id) do nothing`,
  );
};

const socialSql = (p, a, b) =>
  tx(
    `insert into public.follows (follower_id, followee_id, created_at)
select ${M('i')}, ${M(`1 + (i::bigint * 31 + s * 977) % ${p.members}`)}, now() - ((i + s) % 90) * interval '1 day'
from generate_series(${a}, ${b}) i, generate_series(1, ${p.follows}) s where 1 + (i::bigint * 31 + s * 977) % ${p.members} <> i
on conflict do nothing`,
    // Never between two members who share a private chat: the load writes there.
    `insert into public.blocks (blocker_id, blocked_id)
select ${M('i')}, ${M('x.b')}
from generate_series(${a}, ${b}) i cross join lateral (select 1 + (i::bigint * 53 + 17) % ${p.members} as b) x
where i % 50 = 7 and x.b <> i and abs(x.b - i) not in (${DIRECT_SETS.map((s) => s.offset).join(', ')})
on conflict do nothing`,
  );

/**
 * Loup-Garou tables t0..t1 through the real functions (ww_create, game_join, game_start), each call as
 * the member who makes it. A table already running is kept; one that ended is replaced. Every running
 * table is then put at the day vote with two hours on the clock, so a load stage finds it as it left it.
 * Also used by the load orchestrator before each stage (tables end by themselves after 20 idle minutes).
 */
export const gamesSql = (p, kind, t0, t1) => {
  const g = p.games;
  const me = (expr) => `perform set_config('request.jwt.claim.sub', (${expr})::text, true); perform set_config('request.jwt.claims', json_build_object('sub', (${expr})::text, 'role', 'authenticated')::text, true);`;
  const seats = kind === 'running' ? g.table : g.lobby;
  const from = kind === 'running' ? g.runningFrom : g.waitingFrom;
  const title = kind === 'running' ? 'Load night ' : 'Load lobby ';
  return `do $$
declare t int; s int; rid uuid; host uuid; made jsonb;
begin
  for t in ${t0}..${t1} loop
    host := ${M(`${from} + (t - 1) * ${seats} + 1`)};
    select r.id into rid from public.game_rooms r where r.title = '${title}' || t and r.status = '${kind === 'running' ? 'playing' : 'waiting'}' and r.game = 'werewolf'
      and exists (select 1 from public.game_participants gp where gp.room_id = r.id and gp.user_id = host and gp.left_at is null) limit 1;
    if rid is null then
      -- What is left of this table's earlier games no longer counts against « three games at once ».
      update public.game_rooms r set status = 'abandoned', finished_at = now(), turn_deadline = null, updated_at = now()
        where r.title = '${title}' || t and r.status in ('waiting', 'playing');
      ${me('host')}
      made := public.ww_create('mixte', 'public', ${g.table}, 'online', null, '${title}' || t, 'en');
      rid := (made ->> 'id')::uuid;
      for s in 2..${seats} loop
        ${me(M(`${from} + (t - 1) * ${seats} + s`))}
        perform public.game_join(rid);
      end loop;
      ${
        kind === 'running'
          ? `${me('host')}
      perform public.game_start(rid);`
          : ''
      }
    end if;
    ${
      kind === 'running'
        ? `if (select w.phase from private.ww_games w where w.room_id = rid) <> 'vote' then perform private.ww_enter(rid, 'vote'); end if;
    delete from private.ww_actions where room_id = rid and phase = 'vote';
    update private.ww_games set deadline = now() + interval '2 hours', last_human_at = now() where room_id = rid;
    update public.game_rooms set updated_at = now() where id = rid;`
        : `update public.game_rooms set updated_at = now() where id = rid;
    insert into public.game_presence (user_id, space, room_id, seen_at) values (host, 'irly', rid, now())
      on conflict (user_id) do update set room_id = excluded.room_id, seen_at = excluded.seen_at;`
    }
  end loop;
  perform set_config('request.jwt.claim.sub', '', true); perform set_config('request.jwt.claims', '', true);
end $$;`;
};

const clocksSql = (p) =>
  tx(
    `update public.conversations c set last_message_at = x.at
from (select c2.id, (select m.created_at from public.messages m where m.conversation_id = c2.id order by m.created_at desc limit 1) as at
      from public.conversations c2 where c2.id in (select ${CHAT('k')} from generate_series(1, ${p.communities.length}) k)) x
where c.id = x.id and x.at is not null and c.last_message_at is distinct from x.at`,
  );
const ANALYZE = 'analyze public.profiles, public.communities, public.community_members, public.conversations, public.conversation_members, public.messages, public.community_posts, public.comments, public.likes, public.activities, public.activity_participants, public.follows, public.friendships, public.blocks, public.notifications, public.game_rooms, public.game_participants';

/** Every request of the seed, in order: [{ step, sql }]. */
export function seedSteps(p, hash) {
  const steps = [];
  const add = (step, sql) => steps.push({ step, sql });
  add('reference', referenceSql());
  for (const [a, b] of ranges(1, p.members, PER.members)) add('members', membersSql(a, b, hash));
  add('communities', communitiesSql(p));
  for (const chunk of membershipChunks(p)) add('memberships', membershipsSql(p, chunk));
  for (const [a, b] of ranges(1, p.members, PER.pairs)) add('friends, private chats', directsSql(p, a, b));
  for (const chunk of seriesChunks(p, 'messages', PER.communityMessages)) add('community messages', communityMessagesSql(chunk));
  for (const chunk of seriesChunks(p, 'posts', PER.posts)) add('posts, comments, likes', postsSql(chunk));
  for (const [a, b] of ranges(1, Math.max(p.hotPostComments, p.hotPostLikes), PER.hot)) add('busy post', hotPostSql(p, a, b));
  for (const [a, b] of ranges(1, p.activities, PER.activities)) add('activities', activitiesSql(p, a, b));
  for (const [a, b] of ranges(1, p.members, PER.follows)) add('follows, blocks', socialSql(p, a, b));
  for (const [a, b] of ranges(1, p.games.waiting, PER.games)) add('waiting tables', gamesSql(p, 'waiting', a, b));
  for (const [a, b] of ranges(1, p.games.running, PER.games)) add('running tables', gamesSql(p, 'running', a, b));
  add('chat clocks', clocksSql(p));
  add('statistics', ANALYZE);
  return steps;
}

const like = `'${ID_PREFIX}-%'`;
export const COUNTS_SQL = `select
  (select count(*) from auth.users where id::text like ${like})::int as members,
  (select count(*) from auth.users where id::text not like ${like})::int as other_accounts,
  (select count(*) from public.profiles where id::text like ${like})::int as profiles,
  (select count(*) from public.profiles where id::text like ${like} and gender = 'woman')::int as women,
  (select count(*) from public.communities where id::text like ${like})::int as communities,
  (select count(*) from public.communities where id::text like ${like} and girl_only)::int as girl_communities,
  (select count(*) from public.community_members where community_id::text like ${like})::int as memberships,
  (select max(members_count) from public.communities where id::text like ${like})::int as largest_community,
  (select count(*) from public.conversations)::int as conversations,
  (select count(*) from public.conversations where kind = 'direct')::int as direct_chats,
  (select count(*) from public.conversations where kind = 'community')::int as community_chats,
  (select count(*) from public.conversations where kind = 'activity')::int as activity_chats,
  (select count(*) from public.conversation_members)::int as chat_members,
  (select count(*) from public.messages)::int as messages,
  (select count(*) from public.messages where conversation_id = ${CHAT('1')})::int as busiest_chat_messages,
  (select count(*) from public.community_posts)::int as posts,
  (select count(*) from public.comments)::int as comments,
  (select count(*) from public.likes)::int as likes,
  (select count(*) from public.activities)::int as activities,
  (select count(*) from public.activity_participants)::int as participants,
  (select count(*) from public.follows)::int as follows,
  (select count(*) from public.friendships)::int as friendships,
  (select count(*) from public.blocks)::int as blocks,
  (select count(*) from public.notifications)::int as notifications,
  (select count(*) from public.game_rooms where status = 'waiting')::int as waiting_tables,
  (select count(*) from public.game_rooms where status = 'playing')::int as running_tables,
  (select count(*) from public.push_tokens)::int as push_tokens,
  (select count(*) from public.push_outbox)::int as push_outbox,
  (select pg_size_pretty(pg_database_size(current_database()))) as database_size`;

/** The three triggers the seed switches off must be the seed's to switch: checked before anything is written. */
const PREFLIGHT_SQL = `select
  (select count(*) from auth.users where id::text not like ${like})::int as other_accounts,
  (select count(*) from pg_trigger t where not t.tgisinternal and t.tgenabled <> 'D' and (t.tgrelid, t.tgname) in (('public.messages'::regclass, 'messages_created'), ('public.community_posts'::regclass, 'community_posts_created'), ('public.activities'::regclass, 'activities_community_fanout')))::int as triggers_on,
  (select count(*) from pg_class c where c.oid in ('public.messages'::regclass, 'public.community_posts'::regclass, 'public.activities'::regclass) and pg_has_role(current_user, c.relowner, 'USAGE'))::int as tables_owned,
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto') as pgcrypto,
  current_setting('server_version') as version`;

export async function seed(api, { size, token, log = console.log, allowOthers = false }) {
  const p = plan(size);
  const reach = await outsideReach(api);
  if (reach.push_tokens > 0) throw new Error(`the staging branch holds ${reach.push_tokens} push token(s): a message could reach a phone. Nothing written.`);
  const [pre] = await api.sql(PREFLIGHT_SQL, { readOnly: true });
  if (pre.other_accounts > 0 && !allowOthers) throw new Error(`the staging branch holds ${pre.other_accounts} account(s) that are not load-test ones. Nothing written (pass --allow-others if they are expected).`);
  if (pre.triggers_on !== 3) throw new Error(`expected the 3 fan-out triggers to exist and be on, found ${pre.triggers_on}: an earlier run may have been cut off, or the schema changed. Nothing written.`);
  if (pre.tables_owned !== 3) throw new Error('the role the Management API runs as does not own the tables whose fan-out triggers must be switched off. Nothing written.');
  if (!pre.pgcrypto) throw new Error('pgcrypto is not installed: no password can be set. Nothing written.');
  // The members' password: kept if the one already there is still right (so a second run changes nothing).
  const password = loadPassword(token).replace(/'/g, "''");
  const [h] = await api.sql(
    `select coalesce((select u.encrypted_password from auth.users u where u.id = ${M('1')} and u.encrypted_password = ${pre.pgcrypto}.crypt('${password}', u.encrypted_password)), ${pre.pgcrypto}.crypt('${password}', ${pre.pgcrypto}.gen_salt('bf', 10))) as hash`,
    { readOnly: true },
  );
  const steps = seedSteps(p, h.hash);
  log(`size ${size}: ${p.members} members, ${steps.length} requests (PostgreSQL ${pre.version})`);
  const timing = new Map();
  for (const { step, sql } of steps) {
    const t0 = Date.now();
    await api.sql(sql);
    const s = (Date.now() - t0) / 1000;
    const t = timing.get(step) ?? { requests: 0, total: 0, slowest: 0 };
    timing.set(step, { requests: t.requests + 1, total: t.total + s, slowest: Math.max(t.slowest, s) });
  }
  for (const [step, t] of timing) log(`${step}: ${t.requests} request(s), ${t.total.toFixed(1)} s, slowest ${t.slowest.toFixed(1)} s`);
  const [counts] = await api.sql(COUNTS_SQL, { readOnly: true });
  const after = await outsideReach(api);
  return { plan: p, requests: steps.length, counts, reach: after };
}

function reachLines(reach) {
  const can = [];
  if (reach.push_tokens) can.push(`${reach.push_tokens} push token(s): irly-push-housekeeping and every notification would call exp.host`);
  if (reach.geocoders_on) can.push('the geocoder is on with a key: irly-geo-dispatch would call maps.googleapis.com');
  if (reach.news_feeds_on) can.push(`${reach.news_feeds_on} news feed(s) on: irly-news-fetch would call their publishers`);
  return [`scheduled jobs: ${reach.jobs.map((j) => `${j.jobname}${j.active === false ? ' (off)' : ''}`).join(', ') || 'none'}`, `outside calls possible now: ${can.join('; ') || 'none (no push token, no geocoder key, no news feed switched on)'}`];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const size = args.includes('--size') ? args[args.indexOf('--size') + 1] : 'small';
  try {
    if (args.includes('--dry-run')) {
      const p = plan(size);
      const steps = seedSteps(p, '(hash)');
      const by = new Map();
      for (const s of steps) by.set(s.step, (by.get(s.step) ?? 0) + 1);
      console.log(`dry run, nothing sent. size ${size}: ${p.members} members, ${steps.length} requests`);
      for (const [step, n] of by) console.log(`${step}: ${n} request(s)`);
    } else {
      const token = accessToken();
      const api = createStaging({ token });
      const out = await seed(api, { size, token, allowOthers: args.includes('--allow-others') });
      console.log('\n## Counts on the staging branch');
      for (const [k, v] of Object.entries(out.counts)) console.log(`${k}: ${v}`);
      console.log(`management api calls: ${api.calls()}`);
      for (const line of reachLines(out.reach)) console.log(line);
    }
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(1);
  }
}
