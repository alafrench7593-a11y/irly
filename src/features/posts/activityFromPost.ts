import { useEffect } from 'react';
import { create } from 'zustand';
import { openCreate, useCreateStore, type CreatePreset } from '@/features/create/createStore';
import { useSyncVersion } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';

/**
 * « Create an activity » from a post: the activity creation flow opens
 * prefilled from the post (its community preselected, a title suggested from
 * its words, the words as description), and the activity, once published,
 * remembers the post it came from (activities.source_post_id, written by the
 * activity flow). The post then shows a link to it.
 *
 * Adapter between the post cards and the activity flow (owned elsewhere):
 * the preset carries `sourcePostId`; the flow is expected to send it to the
 * server with the activity, which keeps one activity per post and member
 * (idempotent), and to keep the activity in the post's universe (community
 * locked to the post's, women-only when the post is IRLY Girl content).
 */
export type PostForActivity = {
  id: string;
  body: string;
  /** The post's community, when it has one: the activity is published there. */
  community: { id: string; name: string; cityId?: string | null; girlOnly: boolean } | null;
  /** The app space the post is shown in: an IRLY Girl post's activity is women-only. */
  girlSpace: boolean;
};

export type ActivityPreset = CreatePreset & { sourcePostId: string };

/** A short title from the post's words: its first sentence, without links or mentions, at most 60 characters. */
export function suggestTitle(body: string): string {
  const first = body.split(/[.!?…](?:\s|$)|\n/)[0] ?? '';
  const line = first
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/@\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?…:;,\s]+$/, '');
  if (line.length <= 60) return line;
  const cut = line.slice(0, 60);
  const space = cut.lastIndexOf(' ');
  return `${(space > 30 ? cut.slice(0, space) : cut).trim()}…`;
}

/** The creation flow's preset for a post (pure). */
export function activityPreset(p: PostForActivity): ActivityPreset {
  const title = suggestTitle(p.body);
  return {
    format: 'activity',
    ...(p.community ? { communityId: p.community.id, communityName: p.community.name, ...(p.community.cityId ? { cityId: p.community.cityId } : {}) } : {}),
    // Never published into another universe than the post's.
    girlOnly: (p.community ? p.community.girlOnly : p.girlSpace) || undefined,
    ...(title.length >= 3 ? { title } : {}),
    description: p.body.trim().slice(0, 500),
    sourcePostId: p.id,
  };
}

/**
 * Opens the creation flow for a post. A second tap while it is opening (or
 * open) does nothing: the flow is shown once.
 */
let opening = false;
export function createActivityFromPost(p: PostForActivity, origin?: { x: number; y: number } | null): void {
  if (opening || useCreateStore.getState().open) return;
  opening = true;
  openCreate(origin ?? null, activityPreset(p));
  setTimeout(() => {
    opening = false;
  }, 800);
}

export type LinkedActivity = { id: string; title: string; startsAt: number | null };

/** Whether the server has activities.source_post_id (an older server has none: never asked again in this run). */
let sourceColumn: boolean | null = null;

/** The activity created from each post asked for (null: none), and the sync version it was read at. */
const useLinked = create<{ byPost: Record<string, LinkedActivity | null>; readAt: Record<string, number> }>(() => ({ byPost: {}, readAt: {} }));
const queue = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Every card of a feed asks at once: one request for all of them. */
function request(postId: string, version: number): void {
  if (!supabase || sourceColumn === false) return;
  const at = useLinked.getState().readAt[postId];
  if (at !== undefined && at >= version) return;
  queue.set(postId, version);
  if (!timer) timer = setTimeout(() => void flush(), 60);
}

async function flush(): Promise<void> {
  timer = null;
  const asked = [...queue.entries()];
  queue.clear();
  if (!supabase || !asked.length) return;
  const { data, error } = await supabase
    .from('activities')
    .select('id, title, starts_at, source_post_id')
    .in('source_post_id', asked.map(([id]) => id))
    .is('cancelled_at', null);
  if (error) {
    if (/source_post_id/.test(error.message ?? '')) sourceColumn = false;
    return;
  }
  sourceColumn = true;
  const found: Record<string, LinkedActivity> = {};
  for (const r of (data ?? []) as { id: string; title: string; starts_at: string | null; source_post_id: string }[]) {
    if (!found[r.source_post_id]) found[r.source_post_id] = { id: r.id, title: r.title, startsAt: r.starts_at ? Date.parse(r.starts_at) : null };
  }
  useLinked.setState((s) => {
    const byPost = { ...s.byPost };
    const readAt = { ...s.readAt };
    for (const [id, v] of asked) {
      byPost[id] = found[id] ?? null;
      readAt[id] = v;
    }
    return { byPost, readAt };
  });
}

/**
 * The activity created from this post (as the member may see it), or null.
 * Read with every other card's in one request; read again when activities
 * change (one was just created from it). Nothing on a server without
 * activities.source_post_id.
 */
export function useActivityFromPost(postId: string | null | undefined): LinkedActivity | null {
  const version = useSyncVersion('activities');
  const value = useLinked((s) => (postId ? s.byPost[postId] : undefined));
  useEffect(() => {
    if (postId) request(postId, version);
  }, [postId, version]);
  return value ?? null;
}

/** Signed out or another account: nothing of the previous one is kept. */
export function clearActivitiesFromPosts(): void {
  useLinked.setState({ byPost: {}, readAt: {} });
}
