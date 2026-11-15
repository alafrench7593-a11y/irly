/**
 * What a member does with the app, as the app itself asks the server (the same functions, tables,
 * columns and filters as src/features/server/*.ts and src/features/community/data.ts).
 * A virtual user is one member (the app's members are 1..USERS) for the whole stage: one thing she does,
 * chosen by weight, then a pause, again and again until k6 stops her.
 */
import { sleep } from 'k6';
import { PLAN, USERS, between, get, json, member, one, ordinal, pick, req, rpc, skipped, together, uuid } from './lib.js';
import { directsOf, ids, inCommunity } from './plan.mjs';

const MESSAGE_COLS = 'id,sender_id,kind,body,created_at,ref_type,ref_id,media_path,reply_to';
const NOTIFICATION_COLS = 'id,kind,payload,read_at,created_at,notification_universe,notification_women_only';
const ACTIVITY_COLS = 'id,title,category_id,sub_id,area_id,city_id,girl_only,audience,place_name,starts_at,capacity,price_minor,currency,creator_id,going,cover_path,activity_participants(user_id,status)';
const CONVERSATION_COLS = 'id,kind,title,community_id,activity_id,photo_path,activities(category_id,title,sub_id,place_name,cover_path),communities(name,category_id,topic,cover_path)';
const enc = encodeURIComponent;

// Per virtual user: what the last answers said (the inbox, the communities this member is in).
let inbox = null;
let mine = null;
const myCommunities = (u) => {
  if (!mine) mine = PLAN.communities.filter((c) => inCommunity(u.n, c, PLAN.members));
  return mine;
};

const activitiesList = (group, u) =>
  get(group, 'activities', u.token, `select=${enc(ACTIVITY_COLS)}&city_id=in.(dubai)&activity_participants.user_id=eq.${u.id}&cancelled_at=is.null&starts_at=gte.${enc(new Date(Date.now() - 2 * 3600000).toISOString())}&girl_only=eq.false&order=starts_at&limit=60`);

/** Opening the app: the profile, the inbox, the bell, Home's feeds, the lists Home shows. */
function openApp(u) {
  const g = 'open_app';
  const out = together([
    rpc(g, u.token, 'my_profile'),
    rpc(g, u.token, 'my_conversations', {}),
    get(g, 'notifications', u.token, `select=${enc(NOTIFICATION_COLS)}&kind=not.in.(MESSAGE_CREATED,GROUP_ADDED)&order=created_at.desc&limit=50`),
    rpc(g, u.token, 'home_feed', { p_space: 'mixte' }),
    get(g, 'conversation_members', u.token, `select=conversation_id&user_id=eq.${u.id}&limit=301`),
    activitiesList(g, u),
    rpc(g, u.token, 'my_calendar', {}),
    rpc(g, u.token, 'live_feed', { p_city: 'dubai', p_space: 'irly' }),
    rpc(g, u.token, 'games_overview', { p_space: 'mixte' }),
  ]);
  const rows = json(out[1]);
  if (rows) inbox = rows.map((r) => r.conversation_id);
}

/** Opening a chat from the inbox: its row, my membership, the newest page, its members; then « read ». */
function openChat(u) {
  const g = 'open_chat';
  if (!inbox) {
    const rows = json(one(rpc(g, u.token, 'my_conversations', {})));
    inbox = rows ? rows.map((r) => r.conversation_id) : [];
  }
  if (!inbox.length) {
    skipped.add(1);
    return;
  }
  const conv = pick(inbox);
  together([
    get(g, 'conversations', u.token, `select=${enc(CONVERSATION_COLS)}&id=eq.${conv}`),
    get(g, 'conversation_members', u.token, `select=archived_at,role&conversation_id=eq.${conv}&user_id=eq.${u.id}`),
    get(g, 'messages', u.token, `select=${enc(MESSAGE_COLS)}&conversation_id=eq.${conv}&deleted_at=is.null&order=created_at.desc,id.desc&limit=50`),
    rpc(g, u.token, 'chat_members', { p_conversation: conv }),
  ]);
  sleep(between(2, 6));
  one(rpc(g, u.token, 'mark_conversation_read', { p_conversation: conv }));
}

function send(g, u, conversation, text) {
  return one(req(g, 'messages:insert', u.token, 'POST', `messages?select=${enc(MESSAGE_COLS)}`, { id: uuid(), conversation_id: conversation, sender_id: u.id, body: text }, { headers: { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' } }));
}

/** A message to a friend, in a private chat. */
function sendDirect(u) {
  const chats = directsOf(u.n, PLAN.members);
  if (!chats.length) {
    skipped.add(1);
    return;
  }
  send('send_direct', u, pick(chats).id, 'Load-test message from a fictitious member');
}

/** A message in a community chat of a few hundred members at most. */
function sendCommunity(u) {
  const mid = myCommunities(u).filter((c) => PLAN.midCommunities.indexOf(c.k) !== -1);
  if (!mid.length) {
    skipped.add(1);
    return;
  }
  send('send_community', u, ids.communityChat(pick(mid).k), 'Load-test message in a fictitious community chat');
}

/** A community's page and feed; sometimes a like, sometimes a comment. */
function community(u) {
  const g = 'community';
  const list = myCommunities(u);
  if (!list.length) {
    skipped.add(1);
    return;
  }
  const id = ids.community(pick(list).k);
  const out = together([
    rpc(g, u.token, 'community_detail', { p_id: id }),
    rpc(g, u.token, 'community_header', { p_community: id }),
    rpc(g, u.token, 'community_posts_page', { p_community: id, p_sort: 'recent', p_before: null, p_offset: 0, p_limit: 20 }),
  ]);
  const posts = (json(out[2]) || []).map((p) => p.id);
  if (!posts.length) return;
  one(rpc(g, u.token, 'engagement', { p_type: 'community_post', p_ids: posts }));
  sleep(between(3, 8));
  const post = pick(posts);
  const dice = Math.random();
  if (dice < 0.5) one(rpc(g, u.token, 'set_like', { p_type: 'community_post', p_id: post, p_liked: Math.random() < 0.8 }));
  else if (dice < 0.7) {
    one(rpc(g, u.token, 'comment_thread', { p_type: 'community_post', p_id: post }));
    sleep(between(3, 8));
    one(req(g, 'comments:insert', u.token, 'POST', 'comments?select=id,created_at', { id: uuid(), target_type: 'community_post', target_id: post, author_id: u.id, body: 'Load-test comment', parent_id: null }, { headers: { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' } }));
  }
}

/** The list of activities, one opened; sometimes joined, then left. */
function activities(u) {
  const g = 'activities';
  const rows = json(one(activitiesList(g, u))) || [];
  if (!rows.length) return;
  const a = pick(rows);
  sleep(between(2, 5));
  one(rpc(g, u.token, 'activity_detail', { p_id: a.id }));
  if (a.creator_id === u.id || Math.random() < 0.5) return;
  sleep(between(2, 5));
  one(rpc(g, u.token, 'join_activity', { p_activity: a.id, p_status: 'going' }));
  sleep(between(4, 10));
  one(rpc(g, u.token, 'leave_activity', { p_activity: a.id }));
}

// Weights: what a session is made of (out of 100). The people page is left out: it is only shown to members
// with a verified profile and three real photos, and the fictitious members have no photo.
const JOURNEYS = [
  [30, openApp],
  [25, openChat],
  [12, sendDirect],
  [5, sendCommunity],
  [18, community],
  [10, activities],
];
const TOTAL = JOURNEYS.reduce((s, j) => s + j[0], 0);

export function app() {
  const u = member(1 + (ordinal() % USERS));
  for (;;) {
    if (!inbox) openApp(u);
    else {
      let r = Math.random() * TOTAL;
      for (const [w, fn] of JOURNEYS) {
        r -= w;
        if (r <= 0) {
          fn(u);
          break;
        }
      }
    }
    // Between two things a member does.
    sleep(between(5, 15));
  }
}
