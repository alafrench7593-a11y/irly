import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { changed, useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';
import { cacheKey, load as loadCached, peek } from './cache';
import { displayCommunityName } from './name';

/**
 * Communities v2 on the client: a community's groups (Padel inside IRLY
 * Sport), what the signed-in member may do there (moderate, announce, name
 * moderators), pinned posts, announcements to every member, and each
 * member's notification choice per community. Rules are the server's.
 */
const sb = () => {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
};
const friendly = (m: string) => (/fetch|network/i.test(m) ? 'Can’t reach IRLY right now' : m);

export type Subgroup = { id: string; name: string; tagline: string | null; emoji: string | null; members: number; isMember: boolean; postsWeek: number };
export type Rights = { isAdmin: boolean; canModerate: boolean; isOwner: boolean; announcementsToday: number; nextAnnouncementAt: number | null };
export type Parent = { id: string; name: string } | null;
export type CommunityPrefs = { posts: boolean; announcements: boolean; activities: boolean };
export type Person = { userId: string; firstName: string; photo: string | null; role: 'owner' | 'moderator' | 'member' };

const NO_RIGHTS: Rights = { isAdmin: false, canModerate: false, isOwner: false, announcementsToday: 0, nextAnnouncementAt: null };

type Extras = { groups: Subgroup[]; rights: Rights; parent: Parent; prefs: CommunityPrefs };

/** Groups, rights, parent and my notification choice for one community, kept fresh. */
export function useCommunityExtras(id: string) {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string } & Extras>({
    for: '',
    groups: [],
    rights: NO_RIGHTS,
    parent: null,
    prefs: { posts: true, announcements: true, activities: true },
  });
  const seq = useRef(0);
  // The last known extras show at once (the page's tools and groups do not pop in later).
  const ck = uid && id ? cacheKey(uid, 'extras', id) : '';
  const load = useCallback(
    (join = false) => {
      if (!uid || !supabase || !id) return;
      const n = ++seq.current;
      loadCached(ck, () => fetchExtras(uid, id), join)
        .then((x) => n === seq.current && setState({ for: `${uid}|${id}`, ...x }))
        .catch(() => undefined);
    },
    [uid, id, ck],
  );
  const reload = useCallback(() => load(false), [load]);
  useEffect(() => load(true), [load]);
  useRefreshOn(['communities'], reload);
  const ready = state.for === `${uid}|${id}`;
  const known = ready ? state : peek<Extras>(ck);
  return { groups: known?.groups ?? NO_GROUPS, rights: known?.rights ?? NO_RIGHTS, parent: known?.parent ?? null, prefs: known?.prefs ?? state.prefs, reload };
}

const NO_GROUPS: Subgroup[] = [];

/** Groups, my rights, the parent and my notification choice: four reads side by side. */
export async function fetchExtras(uid: string, id: string): Promise<Extras> {
  return Promise.all([
    sb().rpc('community_subgroups', { p_parent: id }),
    sb().rpc('community_rights', { p_community: id }),
    // The parent in the same round trip (no second, sequential read).
    sb().from('communities').select('parent_id, parent:parent_id(id, name)').eq('id', id).maybeSingle(),
    sb().from('community_notification_prefs').select('*').eq('community_id', id).eq('user_id', uid).maybeSingle(),
  ])
    .then(([g, r, me, pr]): Extras => {
      const row = me.data as { parent_id: string | null; parent: Parent | Parent[] | null } | null;
      const embedded = Array.isArray(row?.parent) ? (row?.parent[0] ?? null) : (row?.parent ?? null);
      const parent = row?.parent_id && embedded ? { ...embedded, name: displayCommunityName(embedded) } : null;
      const rr = ((r.data as Record<string, unknown>[] | null) ?? [])[0];
      return {
        groups: ((g.data as Record<string, unknown>[] | null) ?? []).map((x) => ({
          id: x.id as string,
          name: displayCommunityName({ name: x.name as string | null }),
          tagline: (x.tagline as string | null) ?? null,
          emoji: (x.emoji as string | null) ?? null,
          members: Number(x.members ?? 0),
          isMember: Boolean(x.is_member),
          postsWeek: Number(x.posts_week ?? 0),
        })),
        rights: rr
          ? {
              isAdmin: Boolean(rr.is_admin),
              canModerate: Boolean(rr.can_moderate),
              isOwner: Boolean(rr.is_owner),
              announcementsToday: Number(rr.announcements_today ?? 0),
              nextAnnouncementAt: rr.next_announcement_at ? Date.parse(rr.next_announcement_at as string) : null,
            }
          : NO_RIGHTS,
        parent,
        prefs: { posts: true, announcements: true, activities: true, ...((pr.data as Partial<CommunityPrefs> | null) ?? {}) },
      };
    });
}

export async function pinPost(postId: string, on: boolean): Promise<void> {
  const { error } = await sb().rpc('pin_post', { p_post: postId, p_on: on });
  if (error) throw new Error(friendly(error.message));
  changed('communities');
}

/** Notifies every member (their preferences apply); returns how many were notified. */
export async function announce(communityId: string, body: string, kind: 'announcement' | 'event' | 'info', pin: boolean): Promise<number> {
  const { data, error } = await sb().rpc('announce', { p_community: communityId, p_body: body, p_kind: kind, p_pin: pin });
  if (error) throw new Error(friendly(error.message));
  changed('communities');
  return Number(data ?? 0);
}

export async function setCommunityPrefs(communityId: string, prefs: CommunityPrefs): Promise<void> {
  const { data: auth } = await sb().auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) throw new Error('Sign in first');
  const { error } = await sb()
    .from('community_notification_prefs')
    .upsert({ user_id: uid, community_id: communityId, posts: prefs.posts, announcements: prefs.announcements, activities: prefs.activities });
  if (error) throw new Error(friendly(error.message));
}

export async function createSubgroup(parentId: string, name: string, tagline: string): Promise<string> {
  const { data, error } = await sb().rpc('create_subgroup', { p_parent: parentId, p_name: name, p_tagline: tagline || null });
  if (error) throw new Error(friendly(error.message));
  changed('communities');
  return data as string;
}

export async function communityPeople(communityId: string, query?: string): Promise<Person[]> {
  const { data, error } = await sb().rpc('community_people', { p_community: communityId, p_query: query || null });
  if (error) throw new Error(friendly(error.message));
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    userId: r.user_id as string,
    firstName: r.first_name as string,
    photo: (r.photo_path as string | null) ?? null,
    role: r.role as Person['role'],
  }));
}

export async function setRole(communityId: string, userId: string, role: 'moderator' | 'member'): Promise<void> {
  const { error } = await sb().rpc('set_community_role', { p_community: communityId, p_user: userId, p_role: role });
  if (error) throw new Error(friendly(error.message));
  changed('communities');
}

/* ───────── Discussion categories (inside a community, no members of their own) ───────── */

export type Channel = { id: string; slug: string; name: string };

/** A community's categories, in their order; empty when it has none (or the server is not updated yet). */
export function useChannels(communityId: string | undefined) {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; list: Channel[] }>({ for: '', list: [] });
  const seq = useRef(0);
  const key = `${uid}|${communityId}`;
  // The last known categories show at once: the feed then asks for the right space first
  // (General) instead of every post, then General once the categories arrive.
  const ck = uid && communityId ? cacheKey(uid, 'channels', communityId) : '';
  const load = useCallback(
    (join = false) => {
      if (!uid || !supabase || !communityId) return;
      const n = ++seq.current;
      loadCached(ck, () => fetchChannels(communityId), join).then(
        (list) => n === seq.current && setState({ for: key, list }),
        () => n === seq.current && setState({ for: key, list: [] }),
      );
    },
    [uid, communityId, key, ck],
  );
  const reload = useCallback(() => load(false), [load]);
  useEffect(() => load(true), [load]);
  useRefreshOn(['communities'], reload);
  return { channels: state.for === key ? state.list : (peek<Channel[]>(ck) ?? NO_CHANNELS), reload };
}

const NO_CHANNELS: Channel[] = [];

/** A community's categories, in their order. */
export async function fetchChannels(communityId: string): Promise<Channel[]> {
  const { data, error } = await sb().from('community_channels').select('id, slug, name').eq('community_id', communityId).order('sort').order('created_at');
  if (error) throw new Error(friendly(error.message));
  return ((data as Channel[] | null) ?? []).map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
}

/** "Good deals" → "good_deals" (the category's stable id inside its community). */
const slugOf = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([^a-z])/, 'c_$1')
    .slice(0, 30);

export async function addChannel(communityId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (clean.length < 2) throw new Error('Give it a name (2 letters or more)');
  const base = slugOf(clean);
  const slug = base === 'general' ? 'general_2' : base.length < 2 ? `c_${base || 'x'}` : base;
  const { error } = await sb().from('community_channels').insert({ community_id: communityId, slug, name: clean });
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'This category already exists' : /row-level|policy/i.test(error.message) ? 'Only the hosts can add categories' : friendly(error.message));
  changed('communities');
}

export async function renameChannel(id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (clean.length < 2) throw new Error('Give it a name (2 letters or more)');
  const { error } = await sb().from('community_channels').update({ name: clean }).eq('id', id);
  if (error) throw new Error(friendly(error.message));
  changed('communities');
}

/** Its posts move back to General; nothing is deleted. */
export async function deleteChannel(id: string): Promise<void> {
  const { error } = await sb().from('community_channels').delete().eq('id', id);
  if (error) throw new Error(friendly(error.message));
  changed('communities');
}
