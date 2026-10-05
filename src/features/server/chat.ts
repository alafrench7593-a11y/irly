import { useCallback, useEffect, useState } from 'react';
import type { Conversation, Message } from '@/data/types';
import { useAccount } from '@/features/auth/account';
import { supabase } from '@/lib/supabase';

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

/** The signed-in member's conversations, in the app's Conversation shape. */
export function useServerInbox(): { conversations: Conversation[]; refresh: () => void } {
  const account = useAccount();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const uid = account?.userId;

  const refresh = useCallback(() => {
    if (!supabase || !uid) return;
    supabase.rpc('my_conversations').then(({ data }) => setRows((data as InboxRow[]) ?? []));
  }, [uid]);

  useEffect(() => {
    if (!supabase || !uid) return;
    refresh();
    // New messages anywhere you are a member refresh the inbox.
    const channel = supabase
      .channel(`inbox-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${uid}` }, refresh)
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [uid, refresh]);

  const conversations = (uid ? rows : []).map(
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
  );
  return { conversations, refresh };
}

type MessageRow = { id: string; sender_id: string | null; kind: string; body: string; created_at: string; ref_type?: string | null; ref_id?: string | null };

export type ServerThread = {
  loading: boolean;
  error: string | null;
  title: string;
  kind: InboxRow['kind'] | null;
  messages: (Message & { name?: string; share?: { type: string; id: string | null } })[];
  send: (text: string) => Promise<void>;
};

/** One conversation, live: history, new messages as they arrive, sending. */
export function useServerThread(conversationId: string): ServerThread {
  const account = useAccount();
  const uid = account?.userId;
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<InboxRow['kind'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    (async () => {
      const [{ data: conv, error: e1 }, { data: msgs, error: e2 }, { data: members }] = await Promise.all([
        supabase!.from('conversations').select('id, kind, title').eq('id', conversationId).maybeSingle(),
        supabase!.from('messages').select('id, sender_id, kind, body, created_at, ref_type, ref_id').eq('conversation_id', conversationId).is('deleted_at', null).order('created_at').limit(200),
        supabase!.from('conversation_members').select('user_id, profiles(first_name)').eq('conversation_id', conversationId),
      ]);
      if (!alive) return;
      if (e1 || e2 || !conv) {
        setError(e1?.message ?? e2?.message ?? 'This conversation is not available');
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
      setRows((msgs as MessageRow[]) ?? []);
      setLoading(false);
      supabase!.rpc('mark_conversation_read', { p_conversation: conversationId });
    })();

    const channel = supabase
      .channel(`thread-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as MessageRow;
        setRows((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        supabase?.rpc('mark_conversation_read', { p_conversation: conversationId });
      })
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [conversationId, uid]);

  const send = useCallback(
    async (text: string) => {
      if (!supabase || !uid) throw new Error('Sign in to send messages');
      const { data, error: e } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: uid, body: text })
        .select('id, sender_id, kind, body, created_at, ref_type, ref_id')
        .single();
      if (e) throw new Error(e.message);
      setRows((list) => (list.some((x) => x.id === data.id) ? list : [...list, data as MessageRow]));
    },
    [conversationId, uid],
  );

  const messages = rows.map((r) => ({
    id: r.id,
    from: r.sender_id === uid ? 'me' : r.sender_id ? r.sender_id : 'irly',
    name: r.sender_id ? names[r.sender_id] : undefined,
    text: r.body,
    minAgo: 0,
    at: Date.parse(r.created_at),
    share: r.kind === 'share' && r.ref_type ? { type: r.ref_type, id: r.ref_id ?? null } : undefined,
  }));
  return { loading, error, title, kind, messages, send };
}
