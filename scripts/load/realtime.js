/**
 * Realtime: one websocket per virtual user, joining what the app joins once Home is open
 * (src/features/server/sync.ts: one channel per watched table; src/features/server/chat.ts: the inbox's
 * three channels, filtered on the member's chats), with the same postgres_changes bindings, the member's
 * access token and heartbeats. Phoenix protocol, JSON frames (vsn 1.0.0; the app's client speaks 2.0.0,
 * the same messages as arrays).
 *
 * Measured: connections, channel joins answered ok / refused / unanswered, subscriptions confirmed by the
 * server, and how long a message written by ANOTHER virtual user (the friend this member shares a
 * private chat with) takes to arrive: the sender writes its clock in the message, the receiver compares.
 */
import ws from 'k6/ws';
import http from 'k6/http';
import { sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { ANON, PLAN, REST, RT_USERS, USERS, WS, between, get, headers, json, member, one, ordinal, record, uuid } from './lib.js';
import { directsOf } from './plan.mjs';

const connected = new Rate('rt_connected');
const joinsOk = new Counter('rt_joins_ok');
const joinsRefused = new Counter('rt_joins_refused');
const joinsUnanswered = new Counter('rt_joins_unanswered');
const joinTime = new Trend('rt_join_time', true);
const subscribed = new Counter('rt_subscriptions_ok');
const subscriptionErrors = new Counter('rt_subscription_errors');
const events = new Counter('rt_events');
const delivery = new Trend('rt_delivery', true);
const echo = new Trend('rt_own_echo', true);
const sent = new Counter('rt_messages_sent');
const closedEarly = new Counter('rt_closed_by_server');

const IN_FILTER_MAX = 100;
const INBOX_FILTERS = 3;
/** src/features/server/live-filters.ts: filters naming every id, or null when they cannot be named. */
function inFilters(column, list) {
  const unique = Array.from(new Set(list)).sort();
  if (unique.length > IN_FILTER_MAX * INBOX_FILTERS) return null;
  const out = [];
  for (let i = 0; i < unique.length; i += IN_FILTER_MAX) out.push(`${column}=in.(${unique.slice(i, i + IN_FILTER_MAX).join(',')})`);
  return out;
}

/** The channels of one member: [{ name, bindings: [{ event, table, filter? }] }]. */
function channelsOf(uid, chats) {
  const mineOnly = `user_id=eq.${uid}`;
  const watched = [
    ['activities', '*', [undefined]],
    ['activity_participants', 'INSERT', [mineOnly]],
    ['activity_participants', 'UPDATE', [mineOnly]],
    ['communities', '*', [undefined]],
    ['community_members', 'INSERT', [mineOnly]],
    ['community_members', 'UPDATE', [mineOnly]],
    ['community_activity_pins', '*', [undefined]],
    ['community_channels', '*', [undefined]],
    ['community_pins', '*', [undefined]],
    ['conversation_members', 'INSERT', [mineOnly]],
    ['conversation_members', 'UPDATE', [mineOnly]],
    ['profiles', 'UPDATE', [undefined]],
    ['saves', 'INSERT', [mineOnly]],
    ['notifications', '*', [mineOnly]],
    ['follows', 'INSERT', [`follower_id=eq.${uid}`, `followee_id=eq.${uid}`]],
    ['friendships', 'INSERT', [`user_a=eq.${uid}`, `user_b=eq.${uid}`]],
    ['friendships', 'UPDATE', [`user_a=eq.${uid}`, `user_b=eq.${uid}`]],
  ];
  const out = watched.map(([table, event, filters]) => ({ name: `sync:${table}:${event}:${uid}`, bindings: filters.map((filter) => ({ event, table, filter })) }));
  out.push({ name: `sync:signals:${uid}`, bindings: [{ event: 'INSERT', table: 'sync_signals', filter: mineOnly }] });
  const byChat = inFilters('conversation_id', chats);
  if (!byChat || byChat.length) {
    out.push({ name: `inbox-${uid}`, bindings: (byChat || [undefined]).map((filter) => ({ event: 'INSERT', table: 'messages', filter })) });
    out.push({ name: `inbox-removals-${uid}`, bindings: (byChat || [undefined]).map((filter) => ({ event: 'INSERT', table: 'message_removals', filter })) });
    out.push({ name: `inbox-chats-${uid}`, bindings: (byChat ? inFilters('id', chats) : [undefined]).map((filter) => ({ event: 'UPDATE', table: 'conversations', filter })) });
  }
  return out;
}

let logged = 0;
const say = (what, text) => {
  if (logged >= 6) return;
  logged += 1;
  console.error(`LOADERR|realtime|${what}|-|${String(text || '').replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>').replace(/\d+/g, 'N').slice(0, 140)}`);
};

/** The realtime members come right after the app's: USERS + 1 … USERS + RT_USERS, so friends (n, n + 1) are both connected. */
export function realtime() {
  const u = member(USERS + 1 + (ordinal() % RT_USERS));
  for (;;) session(u);
}

function session(u) {
  // The chats the inbox channel names (the app reads them the same way before it listens).
  const rows = json(one(get('realtime', 'conversation_members', u.token, `select=conversation_id&user_id=eq.${u.id}&limit=301`))) || [];
  const chats = rows.map((r) => r.conversation_id);
  const channels = channelsOf(u.id, chats);
  const friends = directsOf(u.n, PLAN.members);
  const chat = friends.length ? friends[0].id : null;
  const session = between(150, 240) * 1000;
  const pending = {};
  let ref = 0;
  let seq = 0;
  let closing = false;
  let opened = false;

  const res = ws.connect(`${WS}?apikey=${encodeURIComponent(ANON)}&vsn=1.0.0`, { tags: { group: 'realtime', name: 'websocket' } }, (socket) => {
    const push = (topic, event, payload) => {
      ref += 1;
      socket.send(JSON.stringify({ topic, event, payload, ref: String(ref), join_ref: event === 'phx_join' ? String(ref) : undefined }));
      return String(ref);
    };
    socket.on('open', () => {
      opened = true;
      connected.add(true);
      for (const c of channels) {
        seq += 1;
        const r = push(`realtime:${c.name}#${seq}`, 'phx_join', {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            postgres_changes: c.bindings.map((b) => Object.assign({ event: b.event, schema: 'public', table: b.table }, b.filter ? { filter: b.filter } : {})),
            private: false,
            postgres_changes_options: { wait: true },
          },
          access_token: u.token,
        });
        pending[r] = Date.now();
      }
      socket.setInterval(() => push('phoenix', 'heartbeat', {}), 25000);
      if (chat) {
        // A message to the friend now and then: what the friend's socket is timed on.
        socket.setInterval(() => {
          const out = http.post(
            `${REST}/messages`,
            JSON.stringify({ id: uuid(), conversation_id: chat, sender_id: u.id, body: `lt:${Date.now()}: load-test delivery probe` }),
            { headers: headers(u.token, { Prefer: 'return=minimal' }), tags: { group: 'realtime', name: 'messages:insert' }, timeout: '30s' },
          );
          if (record('realtime', 'messages:insert', out)) sent.add(1);
        }, between(20, 40) * 1000);
      }
      socket.setTimeout(() => {
        closing = true;
        socket.close();
      }, session);
    });
    socket.on('message', (raw) => {
      let m;
      try {
        m = JSON.parse(raw);
      } catch {
        return;
      }
      if (m.event === 'phx_reply' && pending[m.ref] !== undefined) {
        if (m.payload && m.payload.status === 'ok') {
          joinsOk.add(1);
          joinTime.add(Date.now() - pending[m.ref]);
        } else {
          joinsRefused.add(1);
          say('join', JSON.stringify((m.payload && m.payload.response) || m.payload));
        }
        delete pending[m.ref];
      } else if (m.event === 'system' && m.payload && m.payload.extension === 'postgres_changes') {
        if (m.payload.status === 'ok') subscribed.add(1);
        else {
          subscriptionErrors.add(1);
          say('subscription', m.payload.message);
        }
      } else if (m.event === 'postgres_changes') {
        events.add(1);
        const d = m.payload && m.payload.data;
        if (d && d.table === 'messages' && d.type === 'INSERT' && d.record && typeof d.record.body === 'string') {
          const at = /^lt:(\d+):/.exec(d.record.body);
          if (at) (d.record.sender_id === u.id ? echo : delivery).add(Date.now() - Number(at[1]));
        }
      } else if (m.event === 'phx_error' || (m.event === 'system' && m.payload && m.payload.status === 'error')) {
        subscriptionErrors.add(1);
        say('channel', JSON.stringify(m.payload));
      }
    });
    socket.on('error', (e) => say('socket', e && e.error ? e.error() : 'error'));
    socket.on('close', () => {
      if (!closing) closedEarly.add(1);
      joinsUnanswered.add(Object.keys(pending).length);
    });
  });
  if (!opened) {
    connected.add(false);
    say('connect', res ? `status ${res.status}` : 'no answer');
    sleep(between(5, 15));
  }
}
