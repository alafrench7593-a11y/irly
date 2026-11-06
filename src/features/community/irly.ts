import { changed } from '@/features/server/sync';
import { isMissingFunction } from '@/features/live/livePublish';
import { friendlyError, supabase } from '@/lib/supabase';

/**
 * IRLY speaking in its own communities (migration 20261109100000_irly_admin_publish).
 *
 * Official communities have no owner: the content team publishes there
 * signed « IRLY » (a post, an announcement, a chat message, pins). The
 * server decides who may (community_my_rights → can_irly; in IRLY Girl and
 * Mom only a team member with IRLY Girl access of her own) and checks again
 * on every call; what is written carries as_irly and shows as IRLY, never as
 * the person.
 */

function sb() {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
}

function fail(error: { code?: string | null; message: string }): never {
  if (isMissingFunction(error)) throw new Error('This needs the latest version of IRLY’s server. Try again later.');
  throw new Error(friendlyError(error.message));
}

/* ───────── Publishing as IRLY ───────── */

/** A post signed IRLY (files already stored in the caller's own folder of post-media). */
export async function irlyPost(input: {
  id: string;
  communityId: string;
  body: string;
  mediaPaths: string[];
  mediaKind: 'photo' | 'video' | null;
  thumbPath: string | null;
  mediaSeconds: number | null;
  category?: string | null;
}): Promise<{ error: { code?: string | null; message: string } | null }> {
  const { error } = await sb().rpc('irly_post', {
    p_community: input.communityId,
    p_body: input.body,
    p_id: input.id,
    p_media_paths: input.mediaPaths,
    p_media_kind: input.mediaKind,
    p_thumb_path: input.thumbPath,
    p_media_seconds: input.mediaSeconds,
    p_category: input.category ?? null,
  });
  return { error: error ?? null };
}

/** An announcement signed IRLY (the community's quota applies); how many members were notified. */
export async function irlyAnnounce(communityId: string, body: string, kind: 'announcement' | 'event' | 'info', pin: boolean): Promise<number> {
  const { data, error } = await sb().rpc('irly_announce', { p_community: communityId, p_body: body, p_kind: kind, p_pin: pin });
  if (error) fail(error);
  changed('communities');
  return Number(data ?? 0);
}

/** A message signed IRLY in the community chat. */
export async function irlyChatMessage(communityId: string, body: string): Promise<void> {
  const { error } = await sb().rpc('irly_chat_message', { p_community: communityId, p_body: body });
  if (error) fail(error);
  changed('communities', 'inbox');
}

export async function irlyPinPost(postId: string, on: boolean, until: number | null = null): Promise<void> {
  const { error } = await sb().rpc('irly_pin_post', { p_post: postId, p_on: on, p_until: until == null ? null : new Date(until).toISOString() });
  if (error) fail(error);
  changed('communities');
}

export async function irlyPinMessage(messageId: string, on: boolean): Promise<void> {
  const { error } = await sb().rpc('irly_pin_message', { p_message: messageId, p_on: on, p_until: null });
  if (error) fail(error);
  changed('communities', 'inbox');
}

/**
 * The posts of a community signed IRLY (their ids), read with the feed:
 * those cards show « IRLY », not the person who wrote them. A server
 * without the column yet: none.
 */
const IRLY_POSTS = new Set<string>();
export async function loadIrlyPostIds(communityId: string): Promise<void> {
  if (!supabase || !communityId) return;
  const { data, error } = await supabase.from('community_posts').select('id').eq('community_id', communityId).eq('as_irly', true).is('deleted_at', null).order('created_at', { ascending: false }).limit(500);
  if (error) return;
  for (const r of (data as { id: string }[] | null) ?? []) IRLY_POSTS.add(r.id);
}
export const isIrlyPost = (id: string) => IRLY_POSTS.has(id);
/** A post just published as IRLY: shown as IRLY at once. */
export const markIrlyPost = (id: string) => void IRLY_POSTS.add(id);
