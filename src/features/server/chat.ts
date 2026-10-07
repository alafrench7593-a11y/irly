import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { NONE } from '@/lib/none';
import type { Conversation, Message } from '@/data/types';
import { useAccount } from '@/features/auth/account';
import { supabase, topic } from '@/lib/supabase';

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
};

const KIND: Record<InboxRow['kind'], Conversation['kind']> = {
  direct: 'direct',
  match: 'direct',
  activity: 'group',
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
export function useServerInbox(): { conversations: Conversation[]; refresh: () => void } {
  const account = useAccount();
  const [rows, setRows] = useState<InboxRow[]>([]);
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
      if (error || currentUid.current !== asked) return;
      setRows((data as InboxRow[]) ?? []);
    });
  }, [uid]);

  useEffect(() => {
    if (!supabase || !uid) return;
    refresh();
    // New messages anywhere you are a member refresh the inbox.
    const channel = supabase
      .channel(topic(`inbox-${uid}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${uid}` }, refresh)
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [uid, refresh]);

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
      messages: r.last_body
        ? [{ id: `${r.conversation_id}-last`, from: r.last_sender === uid ? 'me' : r.last_sender ? 'member' : 'irly', text: r.last_body, minAgo: 0, at: Date.parse(r.last_at) }]
        : [],
        }),
      ),
    [rows, uid],
  );
  return { conversations, refresh };
}

type MessageRow = { id: string; sender_id: string | null; kind: string; body: string; created_at: string; ref_type?: string | null; ref_id?: string | null };

const PAGE = 50;
const COLS = 'id, sender_id, kind, body, created_at, ref_type, ref_id';
// Oldest first; equal times keep a stable order.
const byTime = (a: MessageRow, b: MessageRow) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
/** Adds rows (new or refetched) without duplicates, in time order. */
function merge(list: MessageRow[], more: MessageRow[]): MessageRow[] {
  if (!more.length) return list;
  const seen = new Map(list.map((m) => [m.id, m]));
  for (const m of more) seen.set(m.id, m);
  return [...seen.values()].sort(byTime);
}

export type ServerMessage = Message & { at: number; name?: string; senderId: string | null; share?: { type: string; id: string | null } };

export type ServerThread = {
  loading: boolean;
  error: string | null;
  title: string;
  kind: InboxRow['kind'] | null;
  /** The other member of a private chat (to report or block them). */
  otherId: string | null;
  messages: ServerMessage[];
  /** True while older messages may exist above the first one shown. */
  hasEarlier: boolean;
  loadEarlier: () => Promise<void>;
  send: (text: string) => Promise<void>;
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
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<InboxRow['kind'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasEarlier, setHasEarlier] = useState(false);
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
          supabase!.from('conversations').select('id, kind, title').eq('id', conversationId).maybeSingle(),
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

  const send = useCallback(
    async (text: string) => {
      if (!supabase || !uid) throw new Error('Sign in to send messages');
      const { data, error: e } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: uid, body: text }).select(COLS).single();
      if (e) {
        throw new Error(
          /row-level|policy|blocked|not accept/i.test(e.message) ? 'This member does not accept messages from you' : /fetch|network/i.test(e.message) ? 'No connection: message not sent' : e.message,
        );
      }
      setRows((list) => merge(list, [data as MessageRow]));
    },
    [conversationId, uid],
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
      rows.map(
        (r): ServerMessage => ({
          id: r.id,
          from: r.sender_id === uid ? 'me' : r.sender_id ? r.sender_id : 'irly',
          senderId: r.sender_id,
          name: r.sender_id ? names[r.sender_id] : undefined,
          text: r.body,
          minAgo: 0,
          at: Date.parse(r.created_at),
          share: r.kind === 'share' && r.ref_type ? { type: r.ref_type, id: r.ref_id ?? null } : undefined,
        }),
      ),
    [rows, names, uid],
  );
  const otherId = kind === 'direct' || kind === 'match' ? (Object.keys(names).find((id) => id !== uid) ?? null) : null;
  const typingNames = useMemo(() => Object.keys(typing).map((id) => names[id] ?? 'Someone'), [typing, names]);
  return { loading: uid ? loading : false, error, title, kind, otherId, messages, hasEarlier, loadEarlier, send, remove, typing: typingNames, setTyping };
}
