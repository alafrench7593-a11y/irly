import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CityId } from '@/data/types';
import { useCityFilter } from '@/features/server/scope';
import { NONE } from '@/lib/none';
import { useAccount, withProfile } from '@/features/auth/account';
import { track } from '@/lib/analytics';
import { supabase, topic } from '@/lib/supabase';
import { changed, useRefreshOn, useSyncVersion } from '@/features/server/sync';
import { askPushInContext } from '@/features/push/push';
import { toast } from '@/components/ui/Toast';

/** Communities changed (created, joined, left, edited, deleted): every screen showing them reloads. */
export const communitiesChanged = () => changed('communities', 'inbox');
export const useCommunitiesVersion = () => useSyncVersion('communities');

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
  /** Its own photo (a storage path); null: the app's photo for the category. */
  coverPath: string | null;
  /** Run by IRLY, with its topic (IRLY Gym → gym). */
  official: boolean;
  topic: string | null;
  emoji: string | null;
  /** Introductions strongly suggested (IRLY Newcomers). */
  introFirst: boolean;
  /** My chat notifications are off. */
  muted: boolean;
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
  /** Photos (several) or one video, from the post-media bucket. */
  mediaPaths?: string[];
  mediaKind?: 'photo' | 'video' | null;
  thumbPath?: string | null;
  mediaSeconds?: number | null;
  edited?: boolean;
  /** post, question, recommendation or announcement (hosts only). */
  kind?: 'post' | 'question' | 'recommendation' | 'announcement';
  category?: string | null;
  pinnedAt?: number | null;
};

export type CommunitySummary = {
  id: string;
  name: string;
  tagline: string | null;
  categoryId: string | null;
  girlOnly: boolean;
  members: number;
  isMember: boolean;
  postsWeek: number;
  cityId: string | null;
  /** Run by IRLY (IRLY Gym, IRLY Newcomers…). */
  official: boolean;
  topic: string | null;
  emoji: string | null;
  createdAt: number | null;
};

export type Digest = { postsWeek: number; newMembersWeek: number; members: number; upcoming: number; nextTitle: string | null; nextStartsAt: number | null; topPostBody: string | null; topPostLikes: number };

type Row = Record<string, unknown>;

type TopicRow = { emoji: string | null; intro_first: boolean };
const topicOf = (row: unknown): TopicRow | null => {
  const t = (row as { community_topics?: TopicRow | TopicRow[] | null } | null)?.community_topics;
  return Array.isArray(t) ? (t[0] ?? null) : (t ?? null);
};

/** Community chat notifications on or off (the chat itself stays). */
export async function setCommunityMuted(conversationId: string, muted: boolean): Promise<void> {
  const { data: session } = await sb().auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error('Sign in first');
  const { data, error } = await sb().from('conversation_members').update({ muted }).eq('conversation_id', conversationId).eq('user_id', uid).select('user_id');
  if (error) throw new Error(error.message);
  // Not in this chat (yet): nothing changed, so not a success.
  if (!data?.length) throw new Error('Could not change this chat. Try again.');
}

export function useCommunity(id: string) {
  const account = useAccount();
  const uid = account?.userId;
  const [detail, setDetail] = useState<CommunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<CommunityDetail | null> => {
    if (!uid) return null;
    // One round trip: detail, cover and my mute setting for its chat, side by side.
    const [{ data, error: e }, { data: cover }, { data: mine }] = await Promise.all([
      sb().rpc('community_detail', { p_id: id }),
      sb().from('communities').select('cover_path, official, topic, community_topics(emoji, intro_first)').eq('id', id).maybeSingle(),
      sb().from('conversation_members').select('muted, conversations!inner(community_id)').eq('user_id', uid).eq('conversations.community_id', id).limit(1),
    ]);
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
      coverPath: (cover?.cover_path as string | null) ?? null,
      official: Boolean(cover?.official),
      topic: (cover?.topic as string | null) ?? null,
      emoji: topicOf(cover)?.emoji ?? null,
      introFirst: Boolean(topicOf(cover)?.intro_first),
      muted: Boolean(r.conversation_id && (mine as { muted: boolean }[] | null)?.[0]?.muted),
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
  // Members, name, photo and status change from anywhere: same detail everywhere.
  useRefreshOn(['communities'], refresh);

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
    mediaPaths: (r.media_paths as string[] | null) ?? [],
    mediaKind: (r.media_kind as 'photo' | 'video' | null) ?? null,
    thumbPath: (r.thumb_path as string | null) ?? null,
    mediaSeconds: (r.media_seconds as number | null) ?? null,
    edited: Boolean(r.edited_at),
    kind: ((r.kind as string) ?? 'post') as CommunityPost['kind'],
    category: (r.category as string | null) ?? null,
    pinnedAt: r.pinned_at ? Date.parse(r.pinned_at as string) : null,
  };
}

/** The feed, live: new posts, votes, likes and comments from anyone appear without refreshing. */
/**
 * A community's posts. `space` undefined: every post (communities without
 * categories); null: General (posts without a category); a slug: that category.
 */
export function useCommunityFeed(communityId: string, space?: string | null) {
  const account = useAccount();
  const uid = account?.userId;
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Loads can finish out of order (a realtime burst); only the newest one lands.
  const seq = useRef(0);
  // Votes cast on a post that is still being sent, keyed by its temporary id.
  const queued = useRef(new Map<string, number>());
  // Temporary id → real id, for a tap that lands just as the post arrives.
  const sent = useRef(new Map<string, string>());

  const load = useCallback(async (): Promise<CommunityPost[]> => {
    if (!uid) return [];
    const { data, error: e } =
      space === undefined
        ? await sb().rpc('community_feed', { p_community: communityId, p_limit: 50 })
        : await sb().rpc('community_space_feed', { p_community: communityId, p_category: space, p_limit: 50 });
    if (e) throw new Error(e.message);
    return ((data as Row[]) ?? []).map((r) => toPost(r, uid));
  }, [communityId, uid, space]);

  /** The server list, plus our posts still on their way (they are not in it yet). */
  const land = useCallback((server: CommunityPost[]) => setPosts((prev) => [...prev.filter((x) => x.pending), ...server]), []);

  const refresh = useCallback(() => {
    const n = ++seq.current;
    load()
      .then((p) => {
        if (n !== seq.current) return;
        land(p);
        setError(null);
      })
      .catch((e) => n === seq.current && setError(e instanceof Error ? e.message : 'offline'));
  }, [load, land]);

  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    const reload = () => {
      const n = ++seq.current;
      load()
        .then((p) => alive && n === seq.current && (land(p), setError(null)))
        .catch((e) => alive && n === seq.current && setError(e instanceof Error ? e.message : 'offline'))
        .finally(() => alive && setLoading(false));
    };
    reload();
    // Likes, comments and votes arrive from every community: gather a burst
    // into one reload instead of one full feed per event.
    let soon: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      if (soon) return;
      soon = setTimeout(() => {
        soon = null;
        reload();
      }, 800);
    };
    const channel = supabase
      .channel(topic(`community-${communityId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts', filter: `community_id=eq.${communityId}` }, reload)
      // Pins are rare: any pin or unpin reloads (an unpin carries no community to filter on).
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_pins' }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_poll_votes' }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: 'target_type=eq.community_post' }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: 'target_type=eq.community_post' }, later)
      .subscribe();
    return () => {
      alive = false;
      if (soon) clearTimeout(soon);
      supabase?.removeChannel(channel);
    };
  }, [communityId, uid, load, land]);

  const sendVote = useCallback(
    async (postId: string, option: number) => {
      const { error: e } = await sb().from('community_poll_votes').upsert({ post_id: postId, user_id: uid, option });
      if (e) {
        // Back to the server's truth (a snapshot would drop posts that arrived meanwhile).
        refresh();
        throw new Error(/row-level|policy/i.test(e.message) ? 'Join the community to vote' : e.message);
      }
    },
    [uid, refresh],
  );

  /** Optimistic: the post shows at once, then takes its real id; a vote cast meanwhile follows it. */
  const post = useCallback(
    async (input: { body: string; poll?: string[] | null; activityId?: string | null; category?: string | null }) => {
      if (!uid) throw new Error('Sign in to post');
      const body = input.body.trim();
      if (!body) return;
      const poll = input.poll && input.poll.filter((o) => o.trim()).length >= 2 ? { options: input.poll.filter((o) => o.trim()).map((o) => o.trim().slice(0, 60)) } : null;
      const temp: CommunityPost = {
        id: `tmp-${Date.now()}`, authorId: uid, firstName: 'You', body, activityId: input.activityId ?? null, activityTitle: null, activityStartsAt: null,
        poll, pollCounts: poll ? poll.options.map(() => 0) : [], myVote: null, likes: 0, comments: 0, liked: false, createdAt: Date.now(), mine: true, pending: true,
      };
      setPosts((p) => [temp, ...p]);
      const { data, error: e } = await sb()
        .from('community_posts')
        .insert({ community_id: communityId, author_id: uid, body, poll, activity_id: input.activityId ?? null, ...(input.category ? { category: input.category } : {}) })
        .select('id')
        .single();
      const vote = queued.current.get(temp.id);
      queued.current.delete(temp.id);
      if (e || !data) {
        setPosts((p) => p.filter((x) => x.id !== temp.id));
        const msg = e?.message ?? 'Could not post';
        throw new Error(/row-level|policy/i.test(msg) ? 'Join the community to post' : /slow down/i.test(msg) ? 'Slow down a little' : msg);
      }
      const id = (data as { id: string }).id;
      sent.current.set(temp.id, id);
      // Same card, real id: the server copy will replace it, not sit beside it.
      setPosts((p) => p.filter((x) => x.id !== id).map((x) => (x.id === temp.id ? { ...x, id, pending: false } : x)));
      track('COMMUNITY_POST', { poll: Boolean(poll), activity: Boolean(input.activityId) });
      // The post is out; a vote that did not follow is said (the refresh below shows the server's count).
      if (vote != null) await sendVote(id, vote).catch(() => toast('Your vote was not saved. Vote again.', 'x', 'live'));
      refresh();
      changed('communities');
    },
    [communityId, uid, refresh, sendVote],
  );

  const vote = useCallback(
    async (p: CommunityPost, option: number) => {
      if (!uid) throw new Error('Sign in to vote');
      const target = sent.current.get(p.id) ?? p.id;
      setPosts((list) =>
        list.map((x) => {
          if (x.id !== p.id && x.id !== target) return x;
          const counts = [...x.pollCounts];
          if (x.myVote != null) counts[x.myVote] = Math.max(0, (counts[x.myVote] ?? 0) - 1);
          counts[option] = (counts[option] ?? 0) + 1;
          return { ...x, pollCounts: counts, myVote: option };
        }),
      );
      // Still being sent: the vote goes out as soon as the post has its id.
      if (target.startsWith('tmp-')) {
        queued.current.set(target, option);
        return;
      }
      await sendVote(target, option);
    },
    [uid, sendVote],
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
  const version = useCommunitiesVersion();
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
          official: Boolean(r.official),
          topic: (r.topic as string) ?? null,
          emoji: (r.emoji as string) ?? null,
          createdAt: r.created_at ? Date.parse(r.created_at as string) : null,
        })),
      );
    });
    return () => {
      alive = false;
    };
  }, [cityId, uid, version]);
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

export type ActivityStatus = 'upcoming' | 'ongoing' | 'finished' | 'cancelled';
export type CommunityActivity = {
  id: string;
  title: string;
  startsAt: number;
  areaId: string;
  going: number;
  status: ActivityStatus;
  /** Set when it belongs to one of this community's groups (same activity, shown here too). */
  groupName: string | null;
  pinnedAt: number | null;
  onMap: boolean;
};

/**
 * A community's Activities space: its own and its groups' activities (one
 * record each, never copied), pinned first. `past` lists recent finished ones.
 */
export function useCommunityActivities(communityId: string, past = false) {
  const account = useAccount();
  const uid = account?.userId;
  const [list, setList] = useState<CommunityActivity[]>([]);
  // Loading and unreachable are not "nothing planned".
  // Which list has loaded: another community (or past/upcoming) shows Loading again.
  const key = `${communityId}:${past}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== key;
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (): Promise<CommunityActivity[]> => {
    if (!uid || !supabase) return [];
    const { data, error } = await supabase.rpc('community_activities', { p_community: communityId, p_past: past, p_limit: 40 });
    if (!error) {
      return ((data as Row[]) ?? []).map((a) => ({
        id: a.id as string,
        title: a.title as string,
        startsAt: Date.parse(a.starts_at as string),
        areaId: a.area_id as string,
        going: Number(a.going ?? 0),
        status: a.status as ActivityStatus,
        groupName: a.community_id !== communityId ? ((a.community_name as string | null) ?? null) : null,
        pinnedAt: a.pinned_at ? Date.parse(a.pinned_at as string) : null,
        onMap: Boolean(a.has_location),
      }));
    }
    if (past) return [];
    // Server not updated yet: this community's upcoming activities, as before.
    const old = await supabase
      .from('activities')
      .select('id, title, starts_at, area_id, going')
      .eq('community_id', communityId)
      .is('cancelled_at', null)
      .gte('starts_at', new Date(Date.now() - 2 * 3600_000).toISOString())
      .order('starts_at')
      .limit(30);
    if (old.error) throw new Error(old.error.message);
    return (old.data ?? []).map((a) => ({
      id: a.id as string,
      title: a.title as string,
      startsAt: Date.parse(a.starts_at as string),
      areaId: a.area_id as string,
      going: (a.going as number | null) ?? 0,
      status: 'upcoming' as const,
      groupName: null,
      pinnedAt: null,
      onMap: false,
    }));
  }, [communityId, uid, past]);
  useEffect(() => {
    let alive = true;
    load()
      .then((l) => {
        if (!alive) return;
        setList(l);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'offline'))
      .finally(() => alive && setLoadedKey(key));
    return () => {
      alive = false;
    };
  }, [load, key]);
  const refresh = useCallback(() => {
    load()
      .then((l) => {
        setList(l);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'offline'));
  }, [load]);
  useRefreshOn(['activities'], refresh);
  return { activities: uid ? list : NONE, loading: Boolean(uid) && loading && !list.length, error, refresh };
}

/** Hosts pin (or unpin) an activity of their community or of one of its groups. */
export async function pinActivity(communityId: string, activityId: string, pin: boolean): Promise<void> {
  const { error } = await sb().rpc('pin_activity', { p_community: communityId, p_activity: activityId, p_pin: pin });
  if (error) throw new Error(error.message);
  changed('activities');
}

export async function joinCommunity(id: string): Promise<string> {
  const data = await withProfile(async () => {
    const { data: conv, error } = await sb().rpc('join_community', { p_community: id });
    if (error) throw new Error(error.message);
    return conv;
  });
  track('COMMUNITY_JOIN', {});
  communitiesChanged();
  void askPushInContext();
  return data as string;
}

export async function leaveCommunity(id: string): Promise<void> {
  const { error } = await sb().rpc('leave_community', { p_community: id });
  if (error) throw new Error(error.message);
  communitiesChanged();
}

/** The owner edits the community: name, tagline, description (its chat is renamed with it). */
export async function updateCommunity(id: string, patch: { name?: string; tagline?: string | null; description?: string | null }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.tagline !== undefined) row.tagline = patch.tagline;
  if (patch.description !== undefined) row.description = patch.description;
  const { error } = await sb().from('communities').update(row).eq('id', id);
  if (error) throw new Error(error.message);
  communitiesChanged();
}

/** The owner deletes the community: out of every list, search and inbox. */
export async function deleteCommunity(id: string): Promise<void> {
  const { error } = await sb().rpc('delete_community', { p_community: id });
  if (error) throw new Error(error.message);
  communitiesChanged();
}
