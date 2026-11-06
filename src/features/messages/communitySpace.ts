import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO } from '@/config/app';
import { findPerson } from '@/data/repo';
import { isMissingFunction } from '@/features/live/livePublish';
import { communityMembersList, type CommunityMemberRow } from '@/features/messages/communityChat';
import { friendlyError, supabase } from '@/lib/supabase';

/**
 * The calls of the community space wave 2 the app makes for chat pins,
 * mentions and comment moderation, in one typed place
 * (docs/COMMUNITY-SPACE-CONTRACT.md, « App agent H »): pin_message,
 * chat_pins, community_members_list (search), community_posts.mentions and
 * comments.mentions. The server checks every right; the app only hides what
 * the member may not do. A function or column not deployed yet is « not
 * supported »: nothing breaks and no new control appears. The demo build has
 * no server: reads are empty.
 */

/* ───────── Chat pins ───────── */

/** One row of chat_pins(p_conversation). */
export type ChatPin = {
  messageId: string;
  body: string;
  senderId: string | null;
  senderName: string | null;
  kind: string | null;
  pinnedAt: number;
  expiresAt: number | null;
};

type ChatPinRow = { message_id: string; body: string | null; sender_id: string | null; sender_name: string | null; kind: string | null; pinned_at: string; expires_at: string | null };

/** A pin's length chosen in the menu: a day, a week, or until unpinned. */
export type PinLength = '24h' | '7d' | 'none';
export const pinUntil = (length: PinLength, now = Date.now()): string | null =>
  length === '24h' ? new Date(now + 24 * 3600_000).toISOString() : length === '7d' ? new Date(now + 7 * 24 * 3600_000).toISOString() : null;

/** The pins of a chat, newest first; `supported` false while the server has no chat_pins. */
export async function chatPins(conversationId: string): Promise<{ pins: ChatPin[]; supported: boolean }> {
  if (!supabase || DEMO) return { pins: [], supported: false };
  const { data, error } = await supabase.rpc('chat_pins', { p_conversation: conversationId });
  if (error) {
    if (isMissingFunction(error)) return { pins: [], supported: false };
    throw new Error(friendlyError(error.message));
  }
  const now = Date.now();
  return {
    supported: true,
    pins: ((data as ChatPinRow[] | null) ?? [])
      .filter((r) => r && typeof r.message_id === 'string')
      .map((r) => ({
        messageId: r.message_id,
        body: r.body ?? '',
        senderId: r.sender_id,
        senderName: r.sender_name,
        kind: r.kind,
        pinnedAt: Date.parse(r.pinned_at),
        expiresAt: r.expires_at ? Date.parse(r.expires_at) : null,
      }))
      .filter((p) => p.expiresAt === null || p.expiresAt > now)
      .sort((a, b) => b.pinnedAt - a.pinnedAt),
  };
}

/** A moderator pins (until a date, or with no end) or unpins a message of a community chat. */
export async function pinMessage(messageId: string, on: boolean, until: string | null = null): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { error } = await supabase.rpc('pin_message', { p_message: messageId, p_on: on, p_until: on ? until : null });
  if (error) throw new Error(isMissingFunction(error) ? 'Pinning is not available yet' : friendlyError(error.message));
}

/**
 * A chat's pins: read once when it opens (never per message), then again
 * after a pin or unpin made here. Outside community chats nothing is read.
 */
export function useChatPins(conversationId: string, enabled: boolean) {
  const [state, setState] = useState<{ key: string; pins: ChatPin[]; supported: boolean }>({ key: '', pins: [], supported: false });
  const key = enabled ? conversationId : '';
  const seq = useRef(0);
  const read = useCallback(() => {
    if (!key) return;
    const n = ++seq.current;
    chatPins(key).then(
      (r) => n === seq.current && setState({ key, ...r }),
      () => undefined,
    );
  }, [key]);
  useEffect(() => {
    read();
    return () => {
      seq.current += 1;
    };
  }, [read]);
  const live = state.key === key && Boolean(key);
  return { pins: live ? state.pins : NO_PINS, supported: live && state.supported, refresh: read };
}
const NO_PINS: ChatPin[] = [];

/* ───────── Mentions ───────── */

/** Someone who can be mentioned (a member of the community). */
export type Mentionable = { id: string; name: string };

/** The server keeps 10 mentions at most per post or comment. */
export const MAX_MENTIONS = 10;

/** Names learnt from members lists and threads (lowercased name → user id): a tapped @Name opens without asking the server. */
const directory = new Map<string, string>();
export function rememberPeople(people: readonly Mentionable[]): void {
  for (const p of people) if (p.id && p.name) directory.set(p.name.trim().toLowerCase(), p.id);
}
export const knownMention = (name: string): string | undefined => directory.get(name.trim().toLowerCase());

/** Members whose name starts like `query`, from community_members_list (one call per pause in typing, kept a minute). */
const searches = new Map<string, { at: number; rows: Mentionable[] }>();
export async function searchMentionable(communityId: string, query: string, limit = 8): Promise<Mentionable[]> {
  const q = query.trim();
  const k = `${communityId}|${q.toLowerCase()}`;
  const hit = searches.get(k);
  if (hit && Date.now() - hit.at < 60_000) return hit.rows;
  let rows: CommunityMemberRow[];
  try {
    rows = await communityMembersList(communityId, { search: q || null, limit });
  } catch {
    return [];
  }
  const out = rows.map((r) => ({ id: r.user_id, name: r.name })).filter((p) => p.name);
  rememberPeople(out);
  searches.set(k, { at: Date.now(), rows: out });
  return out;
}

/** Of what was picked in the suggestions, those still written in the text (`@Name`), at most 10, each once. */
export function mentionsIn(text: string, picked: readonly Mentionable[]): string[] {
  const low = text.toLowerCase();
  const ids: string[] = [];
  for (const p of picked) {
    if (ids.length >= MAX_MENTIONS) break;
    if (!ids.includes(p.id) && low.includes(`@${p.name.toLowerCase()}`)) ids.push(p.id);
  }
  return ids;
}

/**
 * The profile behind a tapped @Name: from the names already known, else one
 * search in the community's members (on the tap only; the community of a
 * post is read then if needed), else none. The demo knows its thread people.
 */
export async function resolveMention(name: string, communityId: string | null | undefined, postId?: string | null): Promise<string | null> {
  const known = knownMention(name);
  if (known) return known;
  if (DEMO || !supabase) return null;
  const community = communityId ?? (postId ? await readPostCommunity(postId) : null);
  if (!community) return null;
  const rows = await searchMentionable(community, name, 5);
  return rows.find((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase())?.id ?? null;
}

/** The demo's example people by id, for its suggestions (no server). */
export const demoMentionable = (ids: readonly string[]): Mentionable[] =>
  ids.flatMap((id) => {
    const p = findPerson(id);
    return p ? [{ id, name: p.name }] : [];
  });

/* ───────── Comments on a community post ───────── */

/** The community of a post (comments: suggestions and moderation rights), read once per comments screen. */
const postCommunity = new Map<string, string | null>();
async function readPostCommunity(postId: string): Promise<string | null> {
  if (postCommunity.has(postId)) return postCommunity.get(postId) ?? null;
  if (!supabase) return null;
  const { data, error } = await supabase.from('community_posts').select('community_id').eq('id', postId).maybeSingle();
  if (error) throw new Error(friendlyError(error.message));
  const community = (data as { community_id: string | null } | null)?.community_id ?? null;
  postCommunity.set(postId, community);
  return community;
}
export function usePostCommunity(postId: string | null): string | null {
  const [state, setState] = useState<{ id: string | null; community: string | null }>(() => ({ id: postId, community: postId ? (postCommunity.get(postId) ?? null) : null }));
  useEffect(() => {
    if (!postId || !supabase || DEMO || postCommunity.has(postId)) return;
    let alive = true;
    readPostCommunity(postId).then(
      (community) => alive && setState({ id: postId, community }),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [postId]);
  if (!postId) return null;
  return state.id === postId ? state.community : (postCommunity.get(postId) ?? null);
}

/**
 * A column the server does not have yet (community_posts.mentions before its
 * migration): the row is written again without it, so posting never breaks.
 */
export const missingColumn = (error: { code?: string | null; message?: string | null } | null | undefined, column: string): boolean =>
  Boolean(error && (error.code === 'PGRST204' || error.code === '42703') && (error.message ?? '').includes(column));
