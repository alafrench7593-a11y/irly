import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { changed, useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';

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
export type CommunityPrefs = { posts: boolean; announcements: boolean };
export type Person = { userId: string; firstName: string; photo: string | null; role: 'owner' | 'moderator' | 'member' };

const NO_RIGHTS: Rights = { isAdmin: false, canModerate: false, isOwner: false, announcementsToday: 0, nextAnnouncementAt: null };

/** Groups, rights, parent and my notification choice for one community, kept fresh. */
export function useCommunityExtras(id: string) {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; groups: Subgroup[]; rights: Rights; parent: Parent; prefs: CommunityPrefs }>({
    for: '',
    groups: [],
    rights: NO_RIGHTS,
    parent: null,
    prefs: { posts: true, announcements: true },
  });
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!uid || !supabase || !id) return;
    const n = ++seq.current;
    Promise.all([
      sb().rpc('community_subgroups', { p_parent: id }),
      sb().rpc('community_rights', { p_community: id }),
      sb().from('communities').select('parent_id').eq('id', id).maybeSingle(),
      sb().from('community_notification_prefs').select('posts, announcements').eq('community_id', id).eq('user_id', uid).maybeSingle(),
    ])
      .then(async ([g, r, me, pr]) => {
        const parentId = (me.data as { parent_id: string | null } | null)?.parent_id ?? null;
        const parent = parentId ? ((await sb().from('communities').select('id, name').eq('id', parentId).maybeSingle()).data as Parent) : null;
        if (n !== seq.current) return;
        const rr = ((r.data as Record<string, unknown>[] | null) ?? [])[0];
        setState({
          for: `${uid}|${id}`,
          groups: ((g.data as Record<string, unknown>[] | null) ?? []).map((x) => ({
            id: x.id as string,
            name: x.name as string,
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
          prefs: (pr.data as CommunityPrefs | null) ?? { posts: true, announcements: true },
        });
      })
      .catch(() => undefined);
  }, [uid, id]);
  useEffect(load, [load]);
  useRefreshOn(['communities'], load);
  const ready = state.for === `${uid}|${id}`;
  return { groups: ready ? state.groups : [], rights: ready ? state.rights : NO_RIGHTS, parent: ready ? state.parent : null, prefs: state.prefs, reload: load };
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
  const { error } = await sb().from('community_notification_prefs').upsert({ user_id: uid, community_id: communityId, ...prefs });
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
}
