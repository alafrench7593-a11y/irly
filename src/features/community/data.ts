import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CityId } from '@/data/types';
import { useCityFilter } from '@/features/server/scope';
import { NONE } from '@/lib/none';
import { uuid } from '@/lib/uuid';
import { together } from '@/lib/together';
import { useAccount, withProfile } from '@/features/auth/account';
import { track } from '@/lib/analytics';
import { friendlyError, liveChannel, supabase, whenListening } from '@/lib/supabase';
import { t as tx } from '@/i18n';
import { changed, echoGate, syncNow, useRefreshOn, useSyncVersion } from '@/features/server/sync';
import { askPushInContext } from '@/features/push/push';
import { toast } from '@/components/ui/Toast';
import { realtimeIdsFilter } from '@/features/server/engage';
import { useAppSpace } from '@/state/appSpace';
import { displayCommunityName } from './name';
import { FEED_PAGE, fetchFeedFallback, fetchPostsPage, popularScore, type FeedSort } from './space';

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
      // Never an id or a test code as its title (name.ts).
      name: displayCommunityName({ name: r.name as string | null, topic: (cover?.topic as string | null) ?? null, category_id: r.category_id as string | null, city_id: r.city_id as string | null }),
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

  // Loads can overlap (a sync bump while the first one is on its way): only the
  // newest one started lands, and none after the screen is gone.
  const seq = useRef(0);
  const refresh = useCallback(() => {
    const n = ++seq.current;
    load()
      .then((d) => {
        if (n !== seq.current) return;
        setDetail(d);
        setError(null);
      })
      .catch((e) => n === seq.current && setError(e instanceof Error ? e.message : 'offline'))
      .finally(() => n === seq.current && setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!uid) return;
    refresh();
    return () => {
      seq.current += 1;
    };
  }, [uid, refresh]);
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
export function useCommunityFeed(communityId: string, space?: string | null, opts: { sort?: FeedSort } = {}) {
  const account = useAccount();
  const uid = account?.userId;
  const sort: FeedSort = opts.sort ?? 'recent';
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Pages (community_posts_page): whether the server has them, whether more are left, how many
  // posts were added below the first page (a reload keeps them under the fresh first page).
  const paged = useRef(false);
  const pageFull = useRef(false);
  const extra = useRef(0);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Reading further down: new posts from others wait above (« New posts ») instead of pushing the list.
  const hold = useRef(false);
  const [incoming, setIncoming] = useState<CommunityPost[]>([]);
  const postsRef = useRef<CommunityPost[]>([]);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // Loads can finish out of order (a realtime burst); only the newest one lands.
  const seq = useRef(0);
  // Votes cast on a post that is still being sent, keyed by its temporary id.
  const queued = useRef(new Map<string, number>());
  // Temporary id → real id, for a tap that lands just as the post arrives.
  const sent = useRef(new Map<string, string>());
  // The id given to a post that got no answer: sending the same post again reuses it, so it lands once.
  const unsent = useRef<{ key: string; id: string } | null>(null);

  // When the last feed read was sent: realtime events committed before it are in it.
  const sentAt = useRef(-Infinity);
  const load = useCallback(async (): Promise<CommunityPost[]> => {
    if (!uid) return [];
    sentAt.current = syncNow();
    const byScore = (list: CommunityPost[]) => (sort === 'popular' ? [...list].sort((a, b) => popularScore(b) - popularScore(a)) : list);
    if (space !== undefined) {
      const { data, error: e } = await sb().rpc('community_space_feed', { p_community: communityId, p_category: space, p_limit: 50 });
      if (e) throw new Error(e.message);
      paged.current = false;
      return byScore(((data as Row[]) ?? []).map((r) => toPost(r, uid)));
    }
    // The first page, sorted by the server; a server without pages: the latest 50, as before.
    const page = await fetchPostsPage(communityId, sort, { limit: FEED_PAGE });
    paged.current = page !== null;
    pageFull.current = page !== null && page.length >= FEED_PAGE;
    const rows = page ?? (await fetchFeedFallback(communityId, 50));
    const list = rows.map((r) => toPost(r, uid));
    return page ? list : byScore(list);
  }, [communityId, uid, space, sort]);

  /**
   * The server list, plus our posts still on their way (they are not in it yet), plus the pages
   * loaded below the first one. While the member reads further down, posts new from others wait
   * in `incoming` (the « New posts » pill) instead of moving what she reads.
   */
  const land = useCallback(
    (server: CommunityPost[]) => {
      const prev = postsRef.current;
      const known = new Set(prev.map((x) => x.id));
      const shown = prev.filter((x) => !x.pending);
      const newest = shown.reduce((m, x) => Math.max(m, x.createdAt), 0);
      const fresh = hold.current && shown.length && sort === 'recent' ? server.filter((x) => !known.has(x.id) && !x.mine && x.createdAt > newest) : [];
      const freshIds = new Set(fresh.map((x) => x.id));
      const head = fresh.length ? server.filter((x) => !freshIds.has(x.id)) : server;
      const ids = new Set(server.map((x) => x.id));
      let tail: CommunityPost[] = [];
      if (extra.current > 0) {
        const dated = head.filter((x) => !x.pinnedAt);
        const oldest = dated.length ? Math.min(...dated.map((x) => x.createdAt)) : Infinity;
        tail = shown.filter((x) => !ids.has(x.id) && (sort === 'popular' || x.createdAt < oldest));
      }
      const next = [...prev.filter((x) => x.pending), ...head, ...tail];
      postsRef.current = next;
      setPosts(next);
      if (fresh.length) setIncoming((was) => [...fresh, ...was.filter((x) => !freshIds.has(x.id))]);
      setMore(paged.current && (extra.current > 0 ? true : pageFull.current));
    },
    [sort],
  );

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
    // Another sort, space or community: a new list from its first page.
    extra.current = 0;
    hold.current = false;
    postsRef.current = postsRef.current.filter((x) => x.pending);
    setPosts(postsRef.current);
    setIncoming([]);
    setMore(false);
    setLoading(true);
    const reload = () => {
      const n = ++seq.current;
      load()
        .then((p) => alive && n === seq.current && (land(p), setError(null)))
        .catch((e) => alive && n === seq.current && setError(e instanceof Error ? e.message : 'offline'))
        .finally(() => alive && setLoading(false));
    };
    reload();
    // New and edited posts: a burst is one reload, and none for your own post (its
    // refresh, sent after it was saved, has it already).
    const posts = echoGate(reload, 250, () => sentAt.current);
    // Pins are rare: any pin or unpin reloads (an unpin carries no community to filter on).
    const pins = echoGate(reload, 800, () => sentAt.current);
    const channel = liveChannel(`community-${communityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts', filter: `community_id=eq.${communityId}` }, posts.heard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_pins' }, pins.heard)
      // Listening: a post made before then is in no event (one coalesced reload).
      .subscribe(whenListening(() => posts.heard()));
    return () => {
      alive = false;
      posts.cancel();
      pins.cancel();
      supabase?.removeChannel(channel);
    };
  }, [communityId, uid, load, land]);

  // Likes, comments and votes: only those on the posts on screen (every
  // community's used to reload this feed), re-subscribed when that set changes.
  const postKey = useMemo(
    () =>
      posts
        .filter((x) => !x.pending)
        .map((x) => x.id)
        .join(','),
    [posts],
  );
  useEffect(() => {
    if (!uid || !supabase || !postKey) return;
    const ids = postKey.split(',');
    // Likes, comments and votes on the posts shown: a burst is one reload (none when a newer read has them).
    const gate = echoGate(refresh, 800, () => sentAt.current);
    const later = gate.heard;
    const channel = liveChannel(`community-eng-${communityId}`)
      // Votes and likes: new and changed ones only. Their deletes carry no key
      // (Realtime cannot check them against RLS, so the server strips it):
      // a withdrawn vote or like shows on the next load.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_poll_votes', filter: realtimeIdsFilter(ids, 'post_id') ?? undefined }, later)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_poll_votes', filter: realtimeIdsFilter(ids, 'post_id') ?? undefined }, later)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes', filter: realtimeIdsFilter(ids) ?? 'target_type=eq.community_post' }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: realtimeIdsFilter(ids) ?? 'target_type=eq.community_post' }, later)
      .subscribe(whenListening(() => later()));
    return () => {
      gate.cancel();
      supabase?.removeChannel(channel);
    };
  }, [communityId, uid, postKey, refresh]);

  const sendVote = useCallback(
    async (postId: string, option: number) => {
      const { error: e } = await sb().from('community_poll_votes').upsert({ post_id: postId, user_id: uid, option });
      if (e) {
        // Back to the server's truth (a snapshot would drop posts that arrived meanwhile).
        refresh();
        throw new Error(/row-level|policy/i.test(e.message) ? 'Join the community to vote' : friendlyError(e.message));
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
      // The id is made here: a retry after a lost answer is the same post, not a second one.
      const key = JSON.stringify([communityId, body, poll, input.activityId ?? null, input.category ?? null]);
      const postId = unsent.current?.key === key ? unsent.current.id : uuid();
      unsent.current = { key, id: postId };
      const { data, error: e } = await sb()
        .from('community_posts')
        .insert({ id: postId, community_id: communityId, author_id: uid, body, poll, activity_id: input.activityId ?? null, ...(input.category ? { category: input.category } : {}) })
        .select('id')
        .single();
      const vote = queued.current.get(temp.id);
      queued.current.delete(temp.id);
      // Already there (a retry after a lost answer): that is a success.
      const landed = e?.code === '23505';
      // Refused for good (not a lost answer): the next attempt is a new post.
      if (e?.code && !landed) unsent.current = null;
      if (!landed && (e || !data)) {
        setPosts((p) => p.filter((x) => x.id !== temp.id));
        // No answer (network, timeout): it may have been saved. The feed shows what the server has,
        // so a post that landed is not written and sent a second time.
        if (e && !e.code) refresh();
        const msg = e?.message ?? 'Could not post';
        throw new Error(/row-level|policy/i.test(msg) ? 'Join the community to post' : /slow down/i.test(msg) ? 'Slow down a little' : friendlyError(msg));
      }
      const id = landed ? postId : (data as { id: string }).id;
      unsent.current = null;
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
      // .select: row level security can match no row without any error, and
      // that must not read as removed (same check as posts.ts removePost).
      const { data: gone, error: e } = await sb().from('community_posts').update({ deleted_at: new Date().toISOString() }).eq('id', p.id).select('id');
      if (e || !gone?.length) {
        refresh();
        throw new Error(e ? friendlyError(e.message) : 'This post can no longer be removed');
      }
    },
    [refresh],
  );

  /** The next page, when the list nears its end: a cursor for Recent, an offset for Popular. */
  const loadingMoreRef = useRef(false);
  const loadMore = useCallback(async () => {
    if (!uid || space !== undefined || !paged.current || !more || loadingMoreRef.current) return;
    const list = postsRef.current.filter((x) => !x.pending);
    if (!list.length) return;
    const dated = list.filter((x) => !x.pinnedAt);
    const before = (dated.length ? dated : list).reduce((m, x) => Math.min(m, x.createdAt), Infinity);
    const n = seq.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const rows = await fetchPostsPage(communityId, sort, sort === 'recent' ? { before } : { offset: list.length });
      if (n !== seq.current || !rows) return;
      const seen = new Set(postsRef.current.map((x) => x.id));
      const added = rows.map((r) => toPost(r, uid)).filter((x) => !seen.has(x.id));
      extra.current += added.length;
      postsRef.current = [...postsRef.current, ...added];
      setPosts(postsRef.current);
      setMore(rows.length >= FEED_PAGE && added.length > 0);
    } catch {
      // Offline for a moment: the next scroll to the end asks again.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [uid, space, more, communityId, sort]);

  /** Reading further down (true) or back at the top (false). */
  const setHold = useCallback((on: boolean) => {
    hold.current = on;
  }, []);
  /** « New posts » tapped: they join the list (from the server, in order). */
  const showIncoming = useCallback(() => {
    hold.current = false;
    setIncoming([]);
    refresh();
  }, [refresh]);

  return { posts: uid ? posts : NONE, loading: uid ? loading : false, error, refresh, post, vote, remove, more: Boolean(uid) && more, loadingMore, loadMore, incoming: uid ? incoming : NONE, setHold, showIncoming };
}

const GIRL_OFFICIAL = new Set(['girl_trip', 'girl_newcomers', 'girl_activity', 'girl_sport']);
/** One of IRLY Girl's four official communities (official.ts, GIRL_OFFICIAL_TOPICS). */
const isGirlOfficial = (topic: string | null) => Boolean(topic && GIRL_OFFICIAL.has(topic));

export function useCommunityList(cityId: string) {
  // Each space lists its own: IRLY Girl, its communities (of IRLY's official ones, only its four); IRLY, none of them.
  // IRLY Network's own community (and Girl CEO) live in the IRLY Network section, never as a second tile here.
  const girlSpace = useAppSpace() === 'girl';
  const list = useCommunityRows(cityId);
  return useMemo(
    () => list.filter((c) => (girlSpace ? c.girlOnly && (!c.official || isGirlOfficial(c.topic)) : !c.girlOnly && !(c.official && c.topic === 'network'))),
    [list, girlSpace],
  );
}

/**
 * The communities this member is in, whichever space they belong to: « Your
 * communities » is about the member, so IRLY Girl also shows the IRLY ones
 * they joined (and IRLY the IRLY Girl ones). The server only returns rows
 * this account may see.
 */
export function useMyCommunities(cityId: string) {
  const list = useCommunityRows(cityId);
  return useMemo(() => list.filter((c) => c.isMember && !(c.official && c.topic === 'network')), [list]);
}

/** Every community the server lists for this city (kept by the city filter), both spaces. */
function useCommunityRows(cityId: string) {
  const account = useAccount();
  const uid = account?.userId;
  // IRLY Girl communities come back to eligible women only.
  const [list, setList] = useState<CommunitySummary[]>([]);
  const version = useCommunitiesVersion();
  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    const sb = supabase;
    // Home, Profile and Communities list the same communities (tabs stay mounted, a sync bump reaches them all): one read.
    together(`community_list:${uid}:${cityId}`, () => sb.rpc('community_list', { p_city: cityId })).then(({ data, error }) => {
      // A failed load keeps the list already on screen.
      if (!alive || error) return;
      setList(
        ((data as Row[]) ?? []).map((r) => ({
          id: r.id as string,
          name: displayCommunityName(r as { name: string | null; topic: string | null; category_id: string | null; city_id: string | null }),
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
        groupName: a.community_id !== communityId && a.community_name ? displayCommunityName({ name: a.community_name as string }) : null,
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
  // Only the newest load started lands (a sync bump during the first one), never after unmount.
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    load()
      .then((l) => {
        if (n !== seq.current) return;
        setList(l);
        setError(null);
      })
      .catch((e: unknown) => n === seq.current && setError(e instanceof Error ? e.message : 'offline'))
      .finally(() => n === seq.current && setLoadedKey(key));
    return () => {
      seq.current += 1;
    };
  }, [load, key]);
  const refresh = useCallback(() => {
    const n = ++seq.current;
    load()
      .then((l) => {
        if (n !== seq.current) return;
        setList(l);
        setError(null);
      })
      .catch((e: unknown) => n === seq.current && setError(e instanceof Error ? e.message : 'offline'))
      // It may have replaced the first load: never a spinner left behind.
      .finally(() => n === seq.current && setLoadedKey(key));
  }, [load, key]);
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
    if (error) throw new Error(friendlyError(error.message));
    return conv;
  });
  track('COMMUNITY_JOIN', {});
  communitiesChanged();
  void askPushInContext();
  return data as string;
}

export async function leaveCommunity(id: string): Promise<void> {
  const { error } = await sb().rpc('leave_community', { p_community: id });
  // The owner cannot just leave (22023 « hand it over or delete it first »): said in the app's words, never lost.
  if (error?.code === '22023' && /hand it over|delete it first/i.test(error.message)) throw new Error(tx('You own this community. Hand it over to another member or delete it first.'));
  if (error) throw new Error(friendlyError(error.message));
  communitiesChanged();
}

/** The owner edits the community: name, tagline, description (its chat is renamed with it). */
export async function updateCommunity(id: string, patch: { name?: string; tagline?: string | null; description?: string | null }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.tagline !== undefined) row.tagline = patch.tagline;
  if (patch.description !== undefined) row.description = patch.description;
  // .select: row level security can match no row without any error (not a host any more), and that is not saved.
  const { data, error } = await sb().from('communities').update(row).eq('id', id).select('id');
  if (error) throw new Error(friendlyError(error.message));
  if (!data?.length) throw new Error('Only the community’s hosts can edit it');
  communitiesChanged();
}

/** The owner deletes the community: out of every list, search and inbox. */
export async function deleteCommunity(id: string): Promise<void> {
  const { error } = await sb().rpc('delete_community', { p_community: id });
  if (error) throw new Error(friendlyError(error.message));
  communitiesChanged();
}
