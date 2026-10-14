import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { create } from 'zustand';
import { NONE } from '@/lib/none';
import type { Conversation, Message } from '@/data/types';
import { useAccount } from '@/features/auth/account';
import { supabase, topic } from '@/lib/supabase';
import { changed, useRefreshOn, useSyncVersion } from './sync';
import { uuid } from '@/lib/uuid';
import { uploadChatPhoto } from './media';
import { primeFaces } from './faces';
import { askPushInContext } from '@/features/push/push';
import { useBlocked } from '@/features/moderation/moderation';

/**
 * Server chats (signed in): the inbox from `my_conversations()` and live
 * threads over Supabase Realtime. Conversation ids are UUIDs, which is how
 * the thread screen tells them apart from on-device chats.
 */

export const isServerId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

type InboxRow = {
  conversation_id: string;
  kind: 'direct' | 'match' | 'activity' | 'community' | 'group';
  title: string;
  other_user_id: string | null;
  other_name: string | null;
  last_body: string | null;
  last_sender: string | null;
  last_at: string;
  unread: number;
  ref_id: string | null;
  other_photo: string | null;
  photo_path: string | null;
  members: number | null;
  last_kind: string | null;
  last_sender_name: string | null;
  archived?: boolean;
};

const KIND: Record<InboxRow['kind'], Conversation['kind']> = {
  direct: 'direct',
  match: 'direct',
  // Activity chats are their own category (event), apart from groups people make.
  activity: 'event',
  community: 'community',
  group: 'group',
};

/** Unread messages across your server chats (the badge on Messages), fed by <UnreadSync />. */
export const useServerUnread = create<{ n: number }>(() => ({ n: 0 }));

/** Mounted once at the root: keeps the unread count live for every header. */
export function UnreadSync() {
  const { conversations } = useServerInbox();
  // Archived chats keep their own unread count but stay out of the badge.
  const n = conversations.reduce((sum, c) => sum + (c.archived ? 0 : (c.unread ?? 0)), 0);
  useEffect(() => {
    useServerUnread.setState({ n });
  }, [n]);
  return null;
}

let inboxCache: { uid: string; rows: InboxRow[] } = { uid: '', rows: [] };

/** The signed-in member's conversations, in the app's Conversation shape. */
export function useServerInbox(): { conversations: Conversation[]; refresh: () => void; loading: boolean; error: string | null } {
  const account = useAccount();
  const uid = account?.userId;
  // The last inbox seen (this launch) shows at once while it refreshes.
  const [rows, setRowsState] = useState<InboxRow[]>(() => (uid && inboxCache.uid === uid ? inboxCache.rows : []));
  const [state, setState] = useState<{ for: string; error: string | null }>(() => ({ for: uid && inboxCache.uid === uid ? uid : '', error: null }));
  const setRows = useCallback(
    (next: InboxRow[]) => {
      if (uid) inboxCache = { uid, rows: next };
      setRowsState(next);
    },
    [uid],
  );
  const currentUid = useRef(uid);
  useEffect(() => {
    currentUid.current = uid;
  }, [uid]);

  const refresh = useCallback(() => {
    if (!supabase || !uid) return;
    const asked = uid;
    supabase.rpc('my_conversations').then(({ data, error }) => {
      // Keep the inbox on a failed refresh; drop a late answer for a previous account.
      if (currentUid.current !== asked) return;
      if (error) {
        setState({ for: asked, error: /fetch|network/i.test(error.message) ? 'Can’t reach IRLY right now' : error.message });
        return;
      }
      setRows((data as InboxRow[]) ?? []);
      setState({ for: asked, error: null });
    });
  }, [uid, setRows]);

  useEffect(() => {
    if (!supabase || !uid) return;
    refresh();
    let burst: ReturnType<typeof setTimeout> | null = null;
    // New messages anywhere you are a member refresh the inbox; joins, leaves,
    // renames and deletions arrive through the app's sync channel.
    const channel = supabase
      .channel(topic(`inbox-${uid}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        // A burst of messages (busy group chat) is one inbox read, not one per message.
        if (burst) return;
        burst = setTimeout(() => {
          burst = null;
          refresh();
        }, 800);
      })
      .subscribe();
    return () => {
      if (burst) clearTimeout(burst);
      supabase?.removeChannel(channel);
    };
  }, [uid, refresh]);
  useRefreshOn(['inbox', 'people'], refresh);

  // Memoised: a list rebuilt every render breaks any effect that depends on it.
  const conversations = useMemo(
    () =>
      (uid ? rows : NONE).map(
        (r): Conversation => ({
      id: r.conversation_id,
      cityId: 'dubai',
      kind: KIND[r.kind],
      title: r.other_name ?? r.title,
      personIds: [],
      unread: r.unread,
      refId: r.ref_id ?? undefined,
      otherId: r.other_user_id ?? undefined,
      otherPhoto: r.other_photo ?? undefined,
      photoPath: r.photo_path ?? undefined,
      members: r.members ?? undefined,
      lastIsPhoto: r.last_kind === 'photo',
      lastSenderName: r.last_sender_name ?? undefined,
      archived: Boolean(r.archived),
      messages: r.last_body
        ? [{ id: `${r.conversation_id}-last`, from: r.last_sender === uid ? 'me' : r.last_sender ? 'member' : 'irly', text: r.last_body, minAgo: 0, at: Date.parse(r.last_at) }]
        : [],
        }),
      ),
    [rows, uid],
  );
  return { conversations, refresh, loading: Boolean(uid) && state.for !== uid, error: state.for === uid ? state.error : null };
}

type MemberRow = { user_id: string; first_name: string; photo_path: string | null; role: string };
type ThreadSnapshot = {
  rows: MessageRow[];
  names: Record<string, string>;
  people: Record<string, { name: string; photo: string | null; admin: boolean }>;
  refs: { community: string | null; activity: string | null };
  title: string;
  kind: InboxRow['kind'] | null;
  hasEarlier: boolean;
  archived: boolean;
};
/** Chats opened since launch (memory only, the 30 most recent), to reopen them instantly. */
const threadCache = new Map<string, ThreadSnapshot>();

type MessageRow = { id: string; sender_id: string | null; kind: string; body: string; created_at: string; ref_type?: string | null; ref_id?: string | null; media_path?: string | null };

const PAGE = 50;
const COLS = 'id, sender_id, kind, body, created_at, ref_type, ref_id, media_path';
// Oldest first; equal times keep a stable order.
const byTime = (a: MessageRow, b: MessageRow) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
/** Adds rows (new or refetched) without duplicates, in time order. */
function merge(list: MessageRow[], more: MessageRow[]): MessageRow[] {
  if (!more.length) return list;
  const seen = new Map(list.map((m) => [m.id, m]));
  for (const m of more) seen.set(m.id, m);
  return [...seen.values()].sort(byTime);
}

type Channel = ReturnType<NonNullable<typeof supabase>['channel']>;
/**
 * "Typing…" channels, one per conversation and shared by every open copy of
 * that chat: the client hands back the same channel for the same topic, so
 * it is removed only when the last screen using it goes.
 */
const typingChannels = new Map<string, { channel: Channel; listeners: Set<(who: string) => void> }>();
function joinTyping(typingTopic: string, onTyping: (who: string) => void): { channel: Channel; leave: () => void } {
  const sb = supabase!;
  let entry = typingChannels.get(typingTopic);
  if (!entry) {
    // A channel left behind (a reload during development) is replaced, not reused half set up.
    sb.getChannels()
      .filter((c) => c.topic === `realtime:${typingTopic}`)
      .forEach((c) => sb.removeChannel(c));
    const listeners = new Set<(who: string) => void>();
    const channel = sb
      .channel(typingTopic, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const who = (payload as { uid?: string })?.uid;
        if (who) listeners.forEach((l) => l(who));
      })
      .subscribe();
    entry = { channel, listeners };
    typingChannels.set(typingTopic, entry);
  }
  const mine = entry;
  mine.listeners.add(onTyping);
  return {
    channel: mine.channel,
    leave: () => {
      mine.listeners.delete(onTyping);
      if (mine.listeners.size || typingChannels.get(typingTopic) !== mine) return;
      typingChannels.delete(typingTopic);
      void sb.removeChannel(mine.channel);
    },
  };
}

export type ServerMessage = Message & {
  at: number;
  name?: string;
  senderId: string | null;
  share?: { type: string; id: string | null };
  /** A photo message: its stored path in "chat-media", or a local file while it uploads. */
  media?: { path: string | null; local: string | null };
  /** Your own message on its way, or not delivered (offline, refused): never shown as sent when it is not. */
  status?: 'sending' | 'failed';
};

export type ServerThread = {
  loading: boolean;
  error: string | null;
  title: string;
  kind: InboxRow['kind'] | null;
  /** The other member of a private chat (to report or block them). */
  otherId: string | null;
  /** Members by id: name, profile photo path, admin (from chat_members, kept live). */
  members: Record<string, { name: string; photo: string | null; admin: boolean }>;
  /** What the chat belongs to: its community or activity page. */
  communityId: string | null;
  activityId: string | null;
  /** Sends photos (each one message), shown at once and marked failed if the upload or send fails. */
  sendPhotos: (uris: string[]) => Promise<void>;
  messages: ServerMessage[];
  /** True while older messages may exist above the first one shown. */
  hasEarlier: boolean;
  loadEarlier: () => Promise<void>;
  send: (text: string) => Promise<void>;
  /** Sends a message that failed again (same id: it can never arrive twice). */
  retry: (messageId: string) => Promise<void>;
  /** Deletes my message for everyone (author only). */
  remove: (messageId: string) => Promise<void>;
  /** Removes a message from my view only; the others keep it. */
  hideForMe: (messageId: string) => Promise<void>;
  /** This chat is archived in my list. */
  archived: boolean;
  /** Names of the members typing right now. */
  typing: string[];
  /** Call while the member types (sent at most every 2 seconds). */
  setTyping: () => void;
};

/**
 * One conversation, live: the latest messages, older ones on demand, new
 * ones as they arrive (and the ones missed while the app was in the
 * background or offline, fetched again on return), deletions, and who is
 * typing.
 */
export function useServerThread(conversationId: string): ServerThread {
  const account = useAccount();
  const uid = account?.userId;
  // A chat opened before (this launch) shows at once, then catches up with the server.
  const seen = uid ? threadCache.get(`${uid}|${conversationId}`) : undefined;
  // Opened from the inbox (or a chat listed there): its header (name, photo, kind) is known already.
  const [listed] = useState(() => (seen || !uid || inboxCache.uid !== uid ? undefined : inboxCache.rows.find((r) => r.conversation_id === conversationId)));
  const [rows, setRows] = useState<MessageRow[]>(seen?.rows ?? []);
  const [names, setNames] = useState<Record<string, string>>(() => seen?.names ?? (listed?.other_user_id && listed.other_name ? { [listed.other_user_id]: listed.other_name } : {}));
  const [people, setPeople] = useState<Record<string, { name: string; photo: string | null; admin: boolean }>>(
    () => seen?.people ?? (listed?.other_user_id && listed.other_name ? { [listed.other_user_id]: { name: listed.other_name, photo: listed.other_photo, admin: false } } : {}),
  );
  const [refs, setRefs] = useState<{ community: string | null; activity: string | null }>(
    () => seen?.refs ?? { community: listed?.kind === 'community' ? listed.ref_id : null, activity: listed?.kind === 'activity' ? listed.ref_id : null },
  );
  const [title, setTitle] = useState(seen?.title ?? listed?.title ?? '');
  const [kind, setKind] = useState<InboxRow['kind'] | null>(seen?.kind ?? listed?.kind ?? null);
  const [loading, setLoading] = useState(!seen);
  const [error, setError] = useState<string | null>(null);
  const [hasEarlier, setHasEarlier] = useState(seen?.hasEarlier ?? false);
  const [archived, setArchived] = useState(seen?.archived ?? Boolean(listed?.archived));
  // Your messages not confirmed by the server yet: shown at once, marked "sending" or "failed".
  const [pending, setPending] = useState<Record<string, { body: string; at: string; failed: boolean; local?: string; media?: string | null }>>({});
  const [typing, setTypingNames] = useState<Record<string, number>>({});
  const channelRef = useRef<Channel | null>(null);
  const lastTyping = useRef(0);
  // What is on screen, for the catch-up to see a gap without a stale closure.
  const rowsRef = useRef(rows);
  // Messages heard live or sent from here while the first page loads: the page never drops them.
  const arrivedRef = useRef(new Set<string>());
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Read only while this chat is actually seen: focused (no screen pushed on
  // top) and the app in front. A read skipped meanwhile is owed for the return.
  const focused = useRef(false);
  const owedRead = useRef(false);
  const markRead = useCallback(() => {
    if (!supabase) return;
    if (!focused.current || AppState.currentState !== 'active') {
      owedRead.current = true;
      return;
    }
    owedRead.current = false;
    supabase.rpc('mark_conversation_read', { p_conversation: conversationId }).then(() => undefined);
  }, [conversationId]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (owedRead.current) markRead();
      return () => {
        focused.current = false;
      };
    }, [markRead]),
  );

  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    // The newest page, merged into what is on screen (first load, and after a gap).
    const latest = async () => {
      const { data, error: e } = await supabase!
        .from('messages')
        .select(COLS)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (e) throw new Error(e.message);
      return (data as MessageRow[]) ?? [];
    };
    // All at once: the chat, its newest messages, my own state and its members.
    // The messages show as soon as the chat and its newest page are in; the
    // member list (hundreds in a community) fills names and photos when it comes.
    const conversation = supabase.from('conversations').select('id, kind, title, community_id, activity_id').eq('id', conversationId).maybeSingle();
    const page = latest();
    const mineQ = supabase.from('conversation_members').select('archived_at').eq('conversation_id', conversationId).eq('user_id', uid).maybeSingle();
    const membersQ = supabase.rpc('chat_members', { p_conversation: conversationId });
    // The title: the chat's own, else (a private chat) the other member's name, once both answers are in.
    let otherName: string | undefined;
    let membersIn = false;
    let titled = false;
    let convTitle: string | null = null;
    const applyTitle = () => {
      if (!alive || !titled) return;
      if (convTitle) setTitle(convTitle);
      else if (otherName) setTitle(otherName);
      else if (membersIn) setTitle((t) => t || 'IRLY');
    };
    // Messages heard live (or sent) before the first page is in (the channel may join first).
    const arrived = arrivedRef.current;
    arrived.clear();
    membersQ.then(
      ({ data: members }) => {
        if (!alive) return;
        membersIn = true;
        if (!members) return applyTitle();
        const map: Record<string, string> = {};
        const full: Record<string, { name: string; photo: string | null; admin: boolean }> = {};
        (members as MemberRow[]).forEach((m) => {
          map[m.user_id] = m.first_name;
          full[m.user_id] = { name: m.first_name, photo: m.photo_path, admin: m.role === 'admin' };
        });
        primeFaces(Object.entries(full).map(([id, m]) => ({ id, path: m.photo })));
        setNames((old) => ({ ...old, ...map }));
        setPeople(full);
        otherName = Object.entries(map).find(([id]) => id !== uid)?.[1];
        applyTitle();
      },
      () => {
        membersIn = true;
        applyTitle();
      },
    );
    mineQ.then(
      ({ data: mine }) => {
        if (alive && mine) setArchived(Boolean((mine as { archived_at: string | null }).archived_at));
      },
      () => undefined,
    );
    (async () => {
      try {
        const [{ data: conv, error: e1 }, msgs] = await Promise.all([conversation, page]);
        if (!alive) return;
        if (e1 || !conv) {
          setError(e1?.message ?? 'This conversation is not available');
          setLoading(false);
          return;
        }
        titled = true;
        convTitle = (conv.title as string | null) ?? null;
        applyTitle();
        setKind(conv.kind);
        setRefs({ community: (conv.community_id as string | null) ?? null, activity: (conv.activity_id as string | null) ?? null });
        // The newest page replaces what was shown (deleted ones go), except messages that arrived live meanwhile.
        setRows((list) => merge(list.filter((x) => arrived.has(x.id)), msgs));
        setHasEarlier(msgs.length === PAGE);
        setLoading(false);
        markRead();
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Can’t reach IRLY right now');
        setLoading(false);
      }
    })();

    // Back from the background or a reconnection: fetch what was missed.
    const catchUp = () =>
      latest()
        .then((msgs) => {
          if (!alive) return;
          const newest = rowsRef.current[rowsRef.current.length - 1]?.created_at ?? '';
          if (msgs.length === PAGE && msgs[msgs.length - 1].created_at > newest) {
            // More than a page missed: merging would leave a hole between the two.
            // The newest page is the chat now; older ones load on demand.
            setRows((list) => merge(list.filter((x) => x.created_at > msgs[0].created_at), msgs));
            setHasEarlier(true);
          } else {
            // The newest page replaces its own time span: messages deleted meanwhile go too.
            const from = msgs.length === PAGE ? msgs[msgs.length - 1].created_at : '';
            setRows((list) => merge(list.filter((x) => x.created_at < from), msgs));
          }
          markRead();
        })
        .catch(() => undefined);

    let joinedOnce = false;
    // "Typing…" needs every member on the same topic (data changes do not):
    // one shared topic per conversation.
    const typingChannel = joinTyping(`typing:${conversationId}`, (who) => {
      if (who === uid) return;
      setTypingNames((t) => ({ ...t, [who]: Date.now() }));
    });
    channelRef.current = typingChannel.channel;
    const channel = supabase
      .channel(topic(`thread-${conversationId}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as MessageRow;
        arrived.add(m.id);
        setRows((list) => merge(list, [m]));
        if (m.sender_id) setTypingNames((t) => (m.sender_id! in t ? Object.fromEntries(Object.entries(t).filter(([k]) => k !== m.sender_id)) : t));
        markRead();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as MessageRow & { deleted_at?: string | null };
        setRows((list) => (m.deleted_at ? list.filter((x) => x.id !== m.id) : merge(list, [m])));
      })
      .subscribe((status) => {
        // A rejoin after a dropped connection: the gap is filled from the server.
        if (status === 'SUBSCRIBED') {
          if (joinedOnce) catchUp();
          joinedOnce = true;
        }
      });
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active') catchUp();
    });
    return () => {
      alive = false;
      app.remove();
      channelRef.current = null;
      supabase?.removeChannel(channel);
      typingChannel.leave();
    };
  }, [conversationId, uid, markRead]);

  // "Typing…" fades 4 seconds after the last signal.
  const typingCount = Object.keys(typing).length;
  useEffect(() => {
    if (!typingCount) return;
    const h = setInterval(() => {
      const now = Date.now();
      setTypingNames((t) => {
        const keep = Object.entries(t).filter(([, at]) => now - at < 4000);
        return keep.length === Object.keys(t).length ? t : Object.fromEntries(keep);
      });
    }, 1000);
    return () => clearInterval(h);
  }, [typingCount]);

  const loadEarlier = useCallback(async () => {
    if (!supabase || !rows.length) return;
    const { data, error: e } = await supabase
      .from('messages')
      .select(COLS)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .lt('created_at', rows[0].created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE);
    if (e) throw new Error(e.message);
    const older = (data as MessageRow[]) ?? [];
    setRows((list) => merge(list, older));
    setHasEarlier(older.length === PAGE);
  }, [conversationId, rows]);

  // The id is made here, so the realtime echo, the insert's answer and a retry are one message.
  const deliver = useCallback(
    async (id: string, text: string, media?: string) => {
      if (!supabase || !uid) {
        // Not left "sending" forever: the bubble shows Retry.
        setPending((p) => (p[id] ? { ...p, [id]: { ...p[id], failed: true } } : p));
        throw new Error('Sign in to send messages');
      }
      const row: Record<string, string> = { id, conversation_id: conversationId, sender_id: uid, body: text };
      if (media) Object.assign(row, { kind: 'photo', media_path: media });
      const { data, error: e } = await supabase.from('messages').insert(row).select(COLS).single();
      // Already there (a retry after a lost answer): that is a success.
      if (e && e.code !== '23505') {
        setPending((p) => (p[id] ? { ...p, [id]: { ...p[id], failed: true } } : p));
        throw new Error(
          /row-level|policy|blocked|not accept/i.test(e.message)
            ? // Refused in a group, activity or community chat: you are no longer in it (not "this member").
              kind && kind !== 'direct' && kind !== 'match'
              ? 'You are no longer in this chat'
              : 'This member does not accept messages from you'
            : /fetch|network/i.test(e.message)
              ? 'No connection: message not sent'
              : e.message,
        );
      }
      if (data) {
        arrivedRef.current.add((data as MessageRow).id);
        setRows((list) => merge(list, [data as MessageRow]));
      }
      // First message written: replies are worth a notification.
      void askPushInContext();
      setPending((p) => {
        const { [id]: _done, ...rest } = p;
        return rest;
      });
    },
    [conversationId, uid, kind],
  );
  const send = useCallback(
    async (text: string) => {
      const id = uuid();
      setPending((p) => ({ ...p, [id]: { body: text, at: new Date().toISOString(), failed: false } }));
      await deliver(id, text);
    },
    [deliver],
  );
  // A photo: uploaded under the message's own id (a retry re-uses the same file), then sent.
  const deliverPhoto = useCallback(
    async (id: string, local: string) => {
      let path: string;
      try {
        path = await uploadChatPhoto(local, id);
      } catch (e) {
        setPending((p) => (p[id] ? { ...p, [id]: { ...p[id], failed: true } } : p));
        throw e;
      }
      setPending((p) => (p[id] ? { ...p, [id]: { ...p[id], media: path } } : p));
      await deliver(id, 'Photo', path);
    },
    [deliver],
  );
  const sendPhotos = useCallback(
    async (uris: string[]) => {
      const now = Date.now();
      const items = uris.map((local, i) => ({ id: uuid(), local, at: new Date(now + i).toISOString() }));
      setPending((p) => ({ ...p, ...Object.fromEntries(items.map((x) => [x.id, { body: 'Photo', at: x.at, failed: false, local: x.local, media: null }])) }));
      const results = await Promise.allSettled(items.map((x) => deliverPhoto(x.id, x.local)));
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed) throw failed.reason instanceof Error ? failed.reason : new Error('Photo not sent');
    },
    [deliverPhoto],
  );
  const retry = useCallback(
    async (id: string) => {
      const m = pending[id];
      if (!m) return;
      setPending((p) => ({ ...p, [id]: { ...m, failed: false } }));
      if (m.local && !m.media) await deliverPhoto(id, m.local);
      else await deliver(id, m.body, m.media ?? undefined);
    },
    [deliver, deliverPhoto, pending],
  );

  // A message that never reached the server (failed, shows Retry) is only on this phone: it goes from here.
  const discardUnsent = useCallback(
    (messageId: string) => {
      if (!pending[messageId]?.failed || rows.some((r) => r.id === messageId)) return false;
      setPending((p) => {
        const { [messageId]: _gone, ...rest } = p;
        return rest;
      });
      return true;
    },
    [pending, rows],
  );
  const remove = useCallback(async (messageId: string) => {
    if (!supabase || discardUnsent(messageId)) return;
    const { error: e } = await supabase.rpc('delete_my_message', { p_message: messageId });
    if (e) throw new Error(e.message);
    setRows((list) => list.filter((x) => x.id !== messageId));
    changed('inbox');
  }, [discardUnsent]);
  const hideForMe = useCallback(async (messageId: string) => {
    if (!supabase || discardUnsent(messageId)) return;
    const { error: e } = await supabase.rpc('hide_message_for_me', { p_message: messageId });
    if (e) throw new Error(/fetch|network/i.test(e.message) ? 'No connection: try again' : e.message);
    setRows((list) => list.filter((x) => x.id !== messageId));
    changed('inbox');
  }, [discardUnsent]);

  const setTyping = useCallback(() => {
    const now = Date.now();
    if (!uid || now - lastTyping.current < 2000) return;
    lastTyping.current = now;
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { uid } }).catch(() => undefined);
  }, [uid]);

  // People you blocked stay out of shared chats too (the inbox already hides them in private ones).
  const blocked = useBlocked();
  useRefreshOn(['people'], blocked.refresh);
  const blockedIds = useMemo(() => new Set(blocked.list.map((b) => b.userId)), [blocked.list]);
  const messages = useMemo(
    () =>
      [
        ...rows.filter((r) => !r.sender_id || !blockedIds.has(r.sender_id)),
        // Pending ones, until the server confirms them (then they are in rows with the same id).
        ...Object.entries(pending)
          .filter(([id]) => !rows.some((r) => r.id === id))
          .map(([id, p]): MessageRow & { local?: string } => ({ id, sender_id: uid ?? null, kind: p.local ? 'photo' : 'text', body: p.body, created_at: p.at, media_path: p.media ?? null, local: p.local })),
      ].map(
        (r: MessageRow & { local?: string }): ServerMessage => ({
          id: r.id,
          from: r.sender_id === uid ? 'me' : r.sender_id ? r.sender_id : 'irly',
          senderId: r.sender_id,
          name: r.sender_id ? names[r.sender_id] : undefined,
          text: r.body,
          minAgo: 0,
          at: Date.parse(r.created_at),
          share: r.kind === 'share' && r.ref_type ? { type: r.ref_type, id: r.ref_id ?? null } : undefined,
          media: r.kind === 'photo' && (r.media_path || r.local) ? { path: r.media_path ?? null, local: r.local ?? (r.id in pending ? (pending[r.id].local ?? null) : null) } : undefined,
          status: pending[r.id] ? (pending[r.id].failed ? 'failed' : 'sending') : undefined,
        }),
      ),
    [rows, names, uid, pending, blockedIds],
  );
  const otherId = kind === 'direct' || kind === 'match' ? (Object.keys(names).find((id) => id !== uid) ?? null) : null;
  const typingNames = useMemo(() => Object.keys(typing).map((id) => names[id] ?? 'Someone'), [typing, names]);
  // Names and the chat's title follow the server: someone who joins later, a new
  // first name, a renamed activity or community.
  const unknown = useMemo(() => [...new Set(rows.map((r) => r.sender_id).filter((id): id is string => Boolean(id) && !(id! in names)))].sort().join(','), [rows, names]);
  const peopleV = useSyncVersion('people');
  const inboxV = useSyncVersion('inbox');
  const membersAsked = useRef('');
  const membersAt = useRef(0);
  useEffect(() => {
    if (!supabase || !uid || loading) return;
    // The first load brought the members already; asked again when someone new writes or a profile changes.
    const ask = `${conversationId}|${unknown}|${peopleV}|${inboxV}`;
    const first = !membersAsked.current;
    const same = membersAsked.current === ask;
    const onlyInbox = membersAsked.current.slice(0, membersAsked.current.lastIndexOf('|')) === ask.slice(0, ask.lastIndexOf('|'));
    membersAsked.current = ask;
    if (first) membersAt.current = Date.now();
    if (first || same) return;
    let alive = true;
    const sb = supabase;
    // Every message bumps the inbox: then the member list (hundreds in a community) is read at most every 15 s, never skipped.
    const wait = onlyInbox ? Math.max(0, membersAt.current + 15_000 - Date.now()) : 0;
    const timer = setTimeout(() => {
    membersAt.current = Date.now();
    Promise.all([
      sb.from('conversations').select('title').eq('id', conversationId).maybeSingle(),
      sb.rpc('chat_members', { p_conversation: conversationId }),
    ]).then(([{ data: conv }, { data: members }]) => {
      if (!alive) return;
      const map: Record<string, string> = {};
      const full: Record<string, { name: string; photo: string | null; admin: boolean }> = {};
      ((members as MemberRow[] | null) ?? []).forEach((m) => {
        map[m.user_id] = m.first_name;
        full[m.user_id] = { name: m.first_name, photo: m.photo_path, admin: m.role === 'admin' };
      });
      primeFaces(Object.entries(full).map(([id, m]) => ({ id, path: m.photo })));
      setNames((old) => ({ ...old, ...map }));
      setPeople(full);
      if (conv?.title) setTitle(conv.title);
    });
    }, wait);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [conversationId, uid, loading, unknown, peopleV, inboxV]);
  // Kept for the next opening of this chat.
  useEffect(() => {
    if (!uid || loading || error) return;
    const k = `${uid}|${conversationId}`;
    threadCache.delete(k);
    threadCache.set(k, { rows: rows.slice(-PAGE), names, people, refs, title, kind, hasEarlier: hasEarlier || rows.length > PAGE, archived });
    if (threadCache.size > 30) threadCache.delete(threadCache.keys().next().value!);
  }, [uid, conversationId, loading, error, rows, names, people, refs, title, kind, hasEarlier, archived]);
  return {
    loading: uid ? loading : false,
    error,
    title,
    kind,
    otherId,
    members: people,
    communityId: refs.community,
    activityId: refs.activity,
    messages,
    hasEarlier,
    loadEarlier,
    send,
    sendPhotos,
    retry,
    remove,
    hideForMe,
    archived,
    typing: typingNames,
    setTyping,
  };
}

/** Archives (or brings back) a conversation in MY list only; the others are not affected. */
export async function setConversationArchived(conversationId: string, archived: boolean): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { error } = await supabase.rpc('set_conversation_archived', { p_conversation: conversationId, p_archived: archived });
  if (error) throw new Error(/fetch|network/i.test(error.message) ? 'No connection: try again' : error.message);
  changed('inbox');
}

/**
 * Removes a conversation and its history from MY list only. The others keep
 * everything; if someone writes again, it comes back with the new messages.
 */
export async function removeConversationForMe(conversationId: string): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { error } = await supabase.rpc('remove_conversation_for_me', { p_conversation: conversationId });
  if (error) throw new Error(/fetch|network/i.test(error.message) ? 'No connection: try again' : error.message);
  changed('inbox');
}
