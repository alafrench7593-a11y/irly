import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { friendlyError, supabase } from '@/lib/supabase';

/** The quick reactions offered on a long press. */
export const QUICK_REACTIONS = ['❤️', '😂', '👍', '🔥', '😮', '🙏'] as const;

/** One emoji under a bubble: how many, and whether one of them is mine. */
export type ReactionChip = { emoji: string; count: number; mine: boolean };
export type ReactionsByMessage = Record<string, ReactionChip[]>;

type Row = { message_id: string; user_id: string; emoji: string };

/** Ids per request: a page of the chat is two requests at most, never one per message. */
const CHUNK = 100;
const NO_CHIPS: ReactionsByMessage = {};

/** Rows to chips: blocked people's reactions are left out, as their messages are. */
function summarise(rows: Row[], uid: string | undefined, blocked: Set<string>): ReactionsByMessage {
  const out: Record<string, Map<string, ReactionChip>> = {};
  for (const r of rows) {
    if (blocked.has(r.user_id)) continue;
    const per = (out[r.message_id] ??= new Map());
    const chip = per.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    chip.count += 1;
    if (r.user_id === uid) chip.mine = true;
    per.set(r.emoji, chip);
  }
  return Object.fromEntries(Object.entries(out).map(([id, m]) => [id, [...m.values()]]));
}

/**
 * Reactions of the messages on screen, from message_reactions (members of the
 * chat read them, its policy says who may write). message_reactions is not on
 * the realtime feed: read again when messages arrive (once for a burst), when
 * the chat comes back into view and when the app returns. My own taps show at
 * once and are confirmed by the server.
 */
export function useReactions(conversationId: string, messageIds: string[], uid: string | undefined, blocked: Set<string>) {
  const [rows, setRows] = useState<Row[]>([]);
  const ids = useMemo(() => [...new Set(messageIds)].sort(), [messageIds]);
  const key = ids.join(',');
  const idsRef = useRef(ids);
  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);
  const gen = useRef(0);

  const read = useCallback(async () => {
    if (!supabase || !uid) return;
    const want = idsRef.current;
    if (!want.length) return setRows([]);
    const mine = ++gen.current;
    const chunks: string[][] = [];
    for (let i = 0; i < want.length; i += CHUNK) chunks.push(want.slice(i, i + CHUNK));
    const sb = supabase;
    const answers = await Promise.all(chunks.map((c) => sb.from('message_reactions').select('message_id, user_id, emoji').in('message_id', c)));
    // A later read (more messages, a tap) wins over this one.
    if (mine !== gen.current || answers.some((a) => a.error)) return;
    setRows(answers.flatMap((a) => (a.data as Row[] | null) ?? []));
  }, [uid]);

  // New messages on screen: one read for the whole burst.
  useEffect(() => {
    if (!uid || !supabase) return;
    const h = setTimeout(() => void read().catch(() => undefined), 400);
    return () => clearTimeout(h);
  }, [key, uid, read, conversationId]);
  useFocusEffect(
    useCallback(() => {
      void read().catch(() => undefined);
    }, [read]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && void read().catch(() => undefined));
    return () => sub.remove();
  }, [read]);

  const toggle = useCallback(
    async (messageId: string, emoji: string) => {
      if (!supabase || !uid) throw new Error('Sign in to react');
      const had = rows.some((r) => r.message_id === messageId && r.user_id === uid && r.emoji === emoji);
      // Shown at once; any read sent before this tap is ignored when it comes back.
      gen.current += 1;
      setRows((list) => (had ? list.filter((r) => !(r.message_id === messageId && r.user_id === uid && r.emoji === emoji)) : [...list, { message_id: messageId, user_id: uid, emoji }]));
      const q = had
        ? supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', uid).eq('emoji', emoji)
        : supabase.from('message_reactions').insert({ message_id: messageId, user_id: uid, emoji });
      const { error } = await q;
      // Already there (another tap, another phone): that is what was wanted.
      if (error && error.code !== '23505') {
        void read().catch(() => undefined);
        throw new Error(/row-level|policy/i.test(error.message) ? 'You can’t react in this chat' : friendlyError(error.message));
      }
    },
    [rows, uid, read],
  );

  const byMessage = useMemo(() => (rows.length ? summarise(rows, uid, blocked) : NO_CHIPS), [rows, uid, blocked]);
  return { byMessage, toggle, refresh: read };
}

/** A quoted message, as the bubble that answers it shows it. */
export type Quoted = { id: string; senderId: string | null; text: string; photo: boolean; gone?: boolean };

/**
 * Quoted messages that are not in what the phone holds (older than the
 * loaded page): read in one request for all of them, once each. A quote the
 * member may not read (deleted, from someone blocked) reads as unavailable.
 */
export function useQuotedOutside(conversationId: string, missing: string[]): Record<string, Quoted> {
  const [found, setFound] = useState<Record<string, Quoted>>({});
  const asked = useRef(new Set<string>());
  // Answers are kept even when more quotes are asked for meanwhile (each id is asked once).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const key = [...new Set(missing)].sort().join(',');
  useEffect(() => {
    if (!supabase || !key) return;
    const want = key.split(',').filter((id) => !asked.current.has(id)).slice(0, CHUNK);
    if (!want.length) return;
    want.forEach((id) => asked.current.add(id));
    void Promise.resolve(
      supabase.from('messages').select('id, sender_id, kind, body').eq('conversation_id', conversationId).is('deleted_at', null).in('id', want),
    ).then(
      ({ data, error }) => {
        if (!mounted.current) return;
        if (error) {
          want.forEach((id) => asked.current.delete(id));
          return;
        }
        const rows = (data as { id: string; sender_id: string | null; kind: string; body: string }[] | null) ?? [];
        const next: Record<string, Quoted> = {};
        for (const id of want) next[id] = { id, senderId: null, text: '', photo: false, gone: true };
        for (const r of rows) next[r.id] = { id: r.id, senderId: r.sender_id, text: r.body, photo: r.kind === 'photo' };
        setFound((old) => ({ ...old, ...next }));
      },
      () => {
        want.forEach((id) => asked.current.delete(id));
      },
    );
  }, [conversationId, key]);
  return found;
}
