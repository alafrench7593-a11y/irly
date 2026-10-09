import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { NONE } from '@/lib/none';
import type { Conversation, Message } from '@/data/types';
import { useAccount } from '@/features/auth/account';
import { supabase, topic } from '@/lib/supabase';
import { useRefreshOn, useSyncVersion } from './sync';
import { uuid } from '@/lib/uuid';
import { uploadChatPhoto } from './media';

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
  const n = conversations.reduce((sum, c) => sum + (c.unread ?? 0), 0);
  useEffect(() => {
    useServerUnread.setState({ n });
  }, [n]);
  return null;
}

/** The signed-in member's conversations, in the app's Conversation shape. */
export function useServerInbox(): { conversations: Conversation[]; refresh: () => void; loading: boolean; error: string | null } {
  const account = useAccount();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [state, setState] = useState<{ for: string; error: string | null }>({ for: '', error: null });
  const uid = account?.userId;
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
  }, [uid]);

  useEffect(() => {
    if (!supabase || !uid) return;
    refresh();
    // New messages anywhere you are a member refresh the inbox; joins, leaves,
    // renames and deletions arrive through the app's sync channel.
    const channel = supabase
      .channel(topic(`inbox-${uid}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .subscribe();
    return () => {
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
      messages: r.last_body
        ? [{ id: `${r.conversation_id}-last`, from: r.last_sender === uid ? 'me' : r.last_sender ? 'member' : 'irly', text: r.last_body, minAgo: 0, at: Date.parse(r.last_at) }]
        : [],
        }),
      ),
    [rows, uid],
  );
  return { conversations, refresh, loading: Boolean(uid) && state.for !== uid, error: state.for === uid ? state.error : null };
}

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
  remove: (messageId: string) => Promise<void>;
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
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<Record<string, { name: string; photo: string | null; admin: boolean }>>({});
  const [refs, setRefs] = useState<{ community: string | null; activity: string | null }>({ community: null, activity: null });
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<InboxRow['kind'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasEarlier, setHasEarlier] = useState(false);
  // Your messages not confirmed by the server yet: shown at once, marked "sending" or "failed".
  const [pending, setPending] = useState<Record<string, { body: string; at: string; failed: boolean; local?: string; media?: string | null }>>({});
  const [typing, setTypingNames] = useState<Record<string, number>>({});
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const lastTyping = useRef(0);

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
    (async () => {
      try {
        const [{ data: conv, error: e1 }, msgs, { data: members }] = await Promise.all([
          supabase!.from('conversations').select('id, kind, title, community_id, activity_id').eq('id', conversationId).maybeSingle(),
          latest(),
          supabase!.from('conversation_members').select('user_id, profiles(first_name)').eq('conversation_id', conversationId),
        ]);
        if (!alive) return;
        if (e1 || !conv) {
          setError(e1?.message ?? 'This conversation is not available');
          setLoading(false);
          return;
        }
        const map: Record<string, string> = {};
        (members ?? []).forEach((m: { user_id: string; profiles: { first_name: string } | { first_name: string }[] | null }) => {
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          if (p) map[m.user_id] = p.first_name;
        });
        setNames(map);
        const other = Object.entries(map).find(([id]) => id !== uid)?.[1];
        setTitle(conv.title ?? other ?? 'IRLY');
        setKind(conv.kind);
        setRefs({ community: (conv.community_id as string | null) ?? null, activity: (conv.activity_id as string | null) ?? null });
        setRows(msgs.slice().sort(byTime));
        setHasEarlier(msgs.length === PAGE);
        setLoading(false);
        supabase!.rpc('mark_conversation_read', { p_conversation: conversationId }).then(() => undefined);
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
          // The newest page replaces its own time span: messages deleted meanwhile go too.
          const from = msgs.length === PAGE ? msgs[msgs.length - 1].created_at : '';
          setRows((list) => merge(list.filter((x) => x.created_at < from), msgs));
          supabase?.rpc('mark_conversation_read', { p_conversation: conversationId }).then(() => undefined);
        })
        .catch(() => undefined);

    let joinedOnce = false;
    // "Typing…" needs every member on the same topic (data changes do not):
    // one shared topic per conversation, replaced if a previous screen left it behind.
    const typingTopic = `typing:${conversationId}`;
    supabase
      .getChannels()
      .filter((c) => c.topic === `realtime:${typingTopic}`)
      .forEach((c) => supabase?.removeChannel(c));
    const typingChannel = supabase
      .channel(typingTopic, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const who = (payload as { uid?: string })?.uid;
        if (!who || who === uid) return;
        setTypingNames((t) => ({ ...t, [who]: Date.now() }));
      })
      .subscribe();
    channelRef.current = typingChannel;
    const channel = supabase
      .channel(topic(`thread-${conversationId}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as MessageRow;
        setRows((list) => merge(list, [m]));
        if (m.sender_id) setTypingNames((t) => (m.sender_id! in t ? Object.fromEntries(Object.entries(t).filter(([k]) => k !== m.sender_id)) : t));
        supabase?.rpc('mark_conversation_read', { p_conversation: conversationId }).then(() => undefined);
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
      supabase?.removeChannel(typingChannel);
    };
  }, [conversationId, uid]);

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
      if (!supabase || !uid) throw new Error('Sign in to send messages');
      const row: Record<string, string> = { id, conversation_id: conversationId, sender_id: uid, body: text };
      if (media) Object.assign(row, { kind: 'photo', media_path: media });
      const { data, error: e } = await supabase.from('messages').insert(row).select(COLS).single();
      // Already there (a retry after a lost answer): that is a success.
      if (e && e.code !== '23505') {
        setPending((p) => (p[id] ? { ...p, [id]: { ...p[id], failed: true } } : p));
        throw new Error(
          /row-level|policy|blocked|not accept/i.test(e.message) ? 'This member does not accept messages from you' : /fetch|network/i.test(e.message) ? 'No connection: message not sent' : e.message,
        );
      }
      if (data) setRows((list) => merge(list, [data as MessageRow]));
      setPending((p) => {
        const { [id]: _done, ...rest } = p;
        return rest;
      });
    },
    [conversationId, uid],
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

  const remove = useCallback(async (messageId: string) => {
    if (!supabase) return;
    const { error: e } = await supabase.rpc('delete_my_message', { p_message: messageId });
    if (e) throw new Error(e.message);
    setRows((list) => list.filter((x) => x.id !== messageId));
  }, []);

  const setTyping = useCallback(() => {
    const now = Date.now();
    if (!uid || now - lastTyping.current < 2000) return;
    lastTyping.current = now;
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { uid } }).catch(() => undefined);
  }, [uid]);

  const messages = useMemo(
    () =>
      [
        ...rows,
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
    [rows, names, uid, pending],
  );
  const otherId = kind === 'direct' || kind === 'match' ? (Object.keys(names).find((id) => id !== uid) ?? null) : null;
  const typingNames = useMemo(() => Object.keys(typing).map((id) => names[id] ?? 'Someone'), [typing, names]);
  // Names and the chat's title follow the server: someone who joins later, a new
  // first name, a renamed activity or community.
  const unknown = useMemo(() => [...new Set(rows.map((r) => r.sender_id).filter((id): id is string => Boolean(id) && !(id! in names)))].sort().join(','), [rows, names]);
  const peopleV = useSyncVersion('people');
  const inboxV = useSyncVersion('inbox');
  useEffect(() => {
    if (!supabase || !uid || loading) return;
    let alive = true;
    Promise.all([
      supabase.from('conversations').select('title').eq('id', conversationId).maybeSingle(),
      supabase.rpc('chat_members', { p_conversation: conversationId }),
    ]).then(([{ data: conv }, { data: members }]) => {
      if (!alive) return;
      const map: Record<string, string> = {};
      const full: Record<string, { name: string; photo: string | null; admin: boolean }> = {};
      ((members as { user_id: string; first_name: string; photo_path: string | null; role: string }[] | null) ?? []).forEach((m) => {
        map[m.user_id] = m.first_name;
        full[m.user_id] = { name: m.first_name, photo: m.photo_path, admin: m.role === 'admin' };
      });
      setNames((old) => ({ ...old, ...map }));
      setPeople(full);
      if (conv?.title) setTitle(conv.title);
    });
    return () => {
      alive = false;
    };
  }, [conversationId, uid, loading, unknown, peopleV, inboxV]);
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
    typing: typingNames,
    setTyping,
  };
}
