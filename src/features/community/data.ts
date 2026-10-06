import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CityId } from '@/data/types';
import { useCityFilter } from '@/features/server/scope';
import { NONE } from '@/lib/none';
import { useAccount } from '@/features/auth/account';
import { track } from '@/lib/analytics';
import { supabase, topic } from '@/lib/supabase';

/**
 * A community on the IRLY server: detail, live feed (posts, polls, likes,
 * comments), membership, its activities and the weekly digest. Everything
 * goes through row level security: members post and vote, anyone who can
 * see the community reads.
 */

function sb() {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
}

export type CommunityDetail = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  categoryId: string | null;
  cityId: string;
  girlOnly: boolean;
  members: number;
  isMember: boolean;
  myRole: string | null;
  conversationId: string | null;
};

export type CommunityPost = {
  id: string;
  authorId: string;
  firstName: string;
  body: string;
  activityId: string | null;
  activityTitle: string | null;
  activityStartsAt: number | null;
  poll: { options: string[] } | null;
  pollCounts: number[];
  myVote: number | null;
  likes: number;
  comments: number;
  liked: boolean;
  createdAt: number;
  mine: boolean;
  pending?: boolean;
};

export type CommunitySummary = { id: string; name: string; tagline: string | null; categoryId: string | null; girlOnly: boolean; members: number; isMember: boolean; postsWeek: number; cityId: string | null };

export type Digest = { postsWeek: number; newMembersWeek: number; members: number; upcoming: number; nextTitle: string | null; nextStartsAt: number | null; topPostBody: string | null; topPostLikes: number };

type Row = Record<string, unknown>;

export function useCommunity(id: string) {
  const account = useAccount();
  const uid = account?.userId;
  const [detail, setDetail] = useState<CommunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<CommunityDetail | null> => {
    if (!uid) return null;
    const { data, error: e } = await sb().rpc('community_detail', { p_id: id });
    if (e) throw new Error(e.message);
    const r = ((data as Row[]) ?? [])[0];
    if (!r) return null;
    return {
      id: r.id as string,
      name: r.name as string,
      tagline: (r.tagline as string) ?? null,
      description: (r.description as string) ?? null,
      categoryId: (r.category_id as string) ?? null,
      cityId: r.city_id as string,
      girlOnly: Boolean(r.girl_only),
      members: Number(r.members ?? 0),
      isMember: Boolean(r.is_member),
      myRole: (r.my_role as string) ?? null,
      conversationId: (r.conversation_id as string) ?? null,
    };
  }, [id, uid]);

  const refresh = useCallback(() => {
    load()
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'offline'))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    load()
      .then((d) => alive && (setDetail(d), setError(null)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'offline'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [uid, load]);

  return { detail: uid ? detail : null, loading: uid ? loading : false, error, refresh, signedIn: Boolean(uid) };
}

function toPost(r: Row, uid: string | undefined): CommunityPost {
  return {
    id: r.id as string,
    authorId: r.author_id as string,
    firstName: (r.first_name as string) ?? 'Member',
    body: r.body as string,
    activityId: (r.activity_id as string) ?? null,
    activityTitle: (r.activity_title as string) ?? null,
    activityStartsAt: r.activity_starts_at ? Date.parse(r.activity_starts_at as string) : null,
    poll: (r.poll as { options: string[] }) ?? null,
    pollCounts: (r.poll_counts as number[]) ?? [],
    myVote: r.my_vote == null ? null : Number(r.my_vote),
    likes: Number(r.likes ?? 0),
    comments: Number(r.comments ?? 0),
    liked: Boolean(r.liked),
    createdAt: Date.parse(r.created_at as string),
    mine: r.author_id === uid,
  };
}

/** The feed, live: new posts, votes, likes and comments from anyone appear without refreshing. */
export function useCommunityFeed(communityId: string) {
  const account = useAccount();
  const uid = account?.userId;
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<CommunityPost[]> => {
    if (!uid) return [];
    const { data, error: e } = await sb().rpc('community_feed', { p_community: communityId, p_limit: 50 });
    if (e) throw new Error(e.message);
    return ((data as Row[]) ?? []).map((r) => toPost(r, uid));
  }, [communityId, uid]);

  const refresh = useCallback(() => {
    load()
      .then((p) => {
        setPosts(p);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'offline'));
  }, [load]);

  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    const reload = () =>
      load()
        .then((p) => alive && (setPosts(p), setError(null)))
        .catch((e) => alive && setError(e instanceof Error ? e.message : 'offline'))
        .finally(() => alive && setLoading(false));
    reload();
    const channel = supabase
      .channel(topic(`community-${communityId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts', filter: `community_id=eq.${communityId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_poll_votes' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: 'target_type=eq.community_post' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: 'target_type=eq.community_post' }, reload)
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [communityId, uid, load]);

  /** Optimistic: the post shows at once, then the server version replaces it. */
  const post = useCallback(
    async (input: { body: string; poll?: string[] | null; activityId?: string | null }) => {
      if (!uid) throw new Error('Sign in to post');
      const body = input.body.trim();
      if (!body) return;
      const poll = input.poll && input.poll.filter((o) => o.trim()).length >= 2 ? { options: input.poll.filter((o) => o.trim()).map((o) => o.trim().slice(0, 60)) } : null;
      const temp: CommunityPost = {
        id: `tmp-${Date.now()}`, authorId: uid, firstName: 'You', body, activityId: input.activityId ?? null, activityTitle: null, activityStartsAt: null,
        poll, pollCounts: poll ? poll.options.map(() => 0) : [], myVote: null, likes: 0, comments: 0, liked: false, createdAt: Date.now(), mine: true, pending: true,
      };
      setPosts((p) => [temp, ...p]);
      const { error: e } = await sb().from('community_posts').insert({ community_id: communityId, author_id: uid, body, poll, activity_id: input.activityId ?? null });
      if (e) {
        setPosts((p) => p.filter((x) => x.id !== temp.id));
        throw new Error(/row-level|policy/i.test(e.message) ? 'Join the community to post' : /slow down/i.test(e.message) ? 'Slow down a little' : e.message);
      }
      track('COMMUNITY_POST', { poll: Boolean(poll), activity: Boolean(input.activityId) });
      refresh();
    },
    [communityId, uid, refresh],
  );

  const vote = useCallback(
    async (p: CommunityPost, option: number) => {
      if (!uid) throw new Error('Sign in to vote');
      setPosts((list) =>
        list.map((x) => {
          if (x.id !== p.id) return x;
          const counts = [...x.pollCounts];
          if (x.myVote != null) counts[x.myVote] = Math.max(0, (counts[x.myVote] ?? 0) - 1);
          counts[option] = (counts[option] ?? 0) + 1;
          return { ...x, pollCounts: counts, myVote: option };
        }),
      );
      const { error: e } = await sb().from('community_poll_votes').upsert({ post_id: p.id, user_id: uid, option });
      if (e) {
        // Back to the server's truth (a snapshot would drop posts that arrived meanwhile).
        refresh();
        throw new Error(/row-level|policy/i.test(e.message) ? 'Join the community to vote' : e.message);
      }
    },
    [uid, refresh],
  );

  const remove = useCallback(
    async (p: CommunityPost) => {
      setPosts((list) => list.filter((x) => x.id !== p.id));
      const { error: e } = await sb().from('community_posts').update({ deleted_at: new Date().toISOString() }).eq('id', p.id);
      if (e) {
        refresh();
        throw new Error(e.message);
      }
    },
    [refresh],
  );

  return { posts: uid ? posts : NONE, loading: uid ? loading : false, error, refresh, post, vote, remove };
}

export function useCommunityList(cityId: string) {
  const account = useAccount();
  const uid = account?.userId;
  const [list, setList] = useState<CommunitySummary[]>([]);
  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    supabase.rpc('community_list', { p_city: cityId }).then(({ data, error }) => {
      // A failed load keeps the list already on screen.
      if (!alive || error) return;
      setList(
        ((data as Row[]) ?? []).map((r) => ({
          id: r.id as string,
          name: r.name as string,
          tagline: (r.tagline as string) ?? null,
          categoryId: (r.category_id as string) ?? null,
          girlOnly: Boolean(r.girl_only),
          members: Number(r.members ?? 0),
          isMember: Boolean(r.is_member),
          postsWeek: Number(r.posts_week ?? 0),
          cityId: (r.city_id as string) ?? null,
        })),
      );
    });
    return () => {
      alive = false;
    };
  }, [cityId, uid]);
  const { keep } = useCityFilter(cityId as CityId);
  const shown = useMemo(() => list.filter((c) => keep(c.cityId)), [list, keep]);
  return uid ? shown : NONE;
}

export async function fetchDigest(communityId: string): Promise<Digest> {
  const { data, error } = await sb().rpc('community_digest', { p_community: communityId });
  if (error) throw new Error(error.message);
  const r = ((data as Row[]) ?? [])[0] ?? {};
  return {
    postsWeek: Number(r.posts_week ?? 0),
    newMembersWeek: Number(r.new_members_week ?? 0),
    members: Number(r.members ?? 0),
    upcoming: Number(r.upcoming ?? 0),
    nextTitle: (r.next_title as string) ?? null,
    nextStartsAt: r.next_starts_at ? Date.parse(r.next_starts_at as string) : null,
    topPostBody: (r.top_post_body as string) ?? null,
    topPostLikes: Number(r.top_post_likes ?? 0),
  };
}

export type CommunityActivity = { id: string; title: string; startsAt: number; areaId: string; going: number };

export function useCommunityActivities(communityId: string) {
  const account = useAccount();
  const uid = account?.userId;
  const [list, setList] = useState<CommunityActivity[]>([]);
  const load = useCallback(async () => {
    if (!uid || !supabase) return [];
    const { data, error } = await supabase
      .from('activities')
      .select('id, title, starts_at, area_id, going')
      .eq('community_id', communityId)
      .is('cancelled_at', null)
      .gte('starts_at', new Date(Date.now() - 2 * 3600_000).toISOString())
      .order('starts_at')
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []).map((a) => ({
      id: a.id as string,
      title: a.title as string,
      startsAt: Date.parse(a.starts_at as string),
      areaId: a.area_id as string,
      going: (a.going as number | null) ?? 0,
    }));
  }, [communityId, uid]);
  useEffect(() => {
    let alive = true;
    load().then((l) => alive && setList(l)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [load]);
  const refresh = useCallback(() => {
    load().then(setList).catch(() => undefined);
  }, [load]);
  return { activities: uid ? list : NONE, refresh };
}

export async function joinCommunity(id: string): Promise<string> {
  const { data, error } = await sb().rpc('join_community', { p_community: id });
  if (error) throw new Error(error.message);
  track('COMMUNITY_JOIN', {});
  return data as string;
}

export async function leaveCommunity(id: string): Promise<void> {
  const { error } = await sb().rpc('leave_community', { p_community: id });
  if (error) throw new Error(error.message);
}
