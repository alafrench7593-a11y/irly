import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { DEMO } from '@/config/app';
import { DEMO_COMMUNITIES, DEMO_NOTIFICATIONS, DEMO_PLANS, DEMO_POSTS, ME, type DemoCommunity, type DemoPlan, type DemoPost } from '@/data/content/girlDemo';
import type { PhotoKey } from '@/data/photos';
import { findPerson, getCityContent } from '@/data/repo';
import type { CityId, Conversation } from '@/data/types';
import type { ServerActivity } from '@/features/server/activities';
import type { Comment, Engagement, Target, TargetType } from '@/features/server/engage';
import type { GirlPost } from './world';

/**
 * IRLY Girl in the demonstration build: the same screens, fed with the
 * example content of `data/content/girlDemo.ts` instead of the server.
 *
 * Every hook here mirrors a real one (same shape) and is only ever picked
 * when DEMO is true, at module level (`const useX = DEMO ? useDemoX : useX`).
 * Likes, saves, comments, joins and RSVPs stay in this tab's memory: nothing
 * is written anywhere, and the demo says so on every screen.
 */

const MIN = 60_000;
const HOUR = 3_600_000;
// One clock for the whole demo session: times never drift while browsing.
const T0 = Date.now();

export const isDemoId = (id: string | undefined | null): boolean => DEMO && Boolean(id && /^(gc|gp|ga|gcv)-/.test(id));

/**
 * The illustrative portrait of a demo person (g-*, w-*, p-*), demo build
 * only: the one photo of that person's record, never a guess. Real accounts
 * (uuids) and unknown ids get nothing (their own photo, or initials).
 */
export const demoPhoto = (id?: string | null): string | undefined => (DEMO && id && /^(g|w|p)-[a-z]+$/.test(id) ? findPerson(id)?.photo : undefined);

export const demoName = (id: string) => (id === ME ? 'You' : (findPerson(id)?.name ?? ''));

type DemoState = {
  liked: Record<string, boolean>;
  saved: Record<string, boolean>;
  joined: Record<string, boolean>;
  going: Record<string, boolean>;
  added: Record<string, Comment[]>;
  toggle: (k: 'liked' | 'saved' | 'joined' | 'going', id: string) => void;
  comment: (target: string, c: Comment) => void;
  uncomment: (target: string, id: string) => void;
};

export const useDemoGirl = create<DemoState>((set) => ({
  liked: {},
  saved: {},
  joined: Object.fromEntries(DEMO_COMMUNITIES.filter((c) => c.member).map((c) => [c.id, true])),
  going: Object.fromEntries(DEMO_PLANS.filter((p) => p.joined).map((p) => [p.id, true])),
  added: {},
  toggle: (k, id) => set((s) => ({ [k]: { ...s[k], [id]: !s[k][id] } })),
  comment: (target, c) => set((s) => ({ added: { ...s.added, [target]: [...(s.added[target] ?? []), c] } })),
  uncomment: (target, id) => set((s) => ({ added: { ...s.added, [target]: (s.added[target] ?? []).filter((c) => c.id !== id) } })),
}));

/* ───────── Communities ───────── */

export const findDemoCommunity = (id: string) => DEMO_COMMUNITIES.find((c) => c.id === id);

export type DemoCommunityRow = { id: string; name: string; tagline: string | null; member: boolean; members: number; cityId: string; coverPath: string | null; photo: PhotoKey };

const toRow = (c: DemoCommunity, joined: Record<string, boolean>): DemoCommunityRow => ({
  id: c.id,
  name: c.name,
  tagline: c.tagline,
  member: Boolean(joined[c.id]),
  members: c.members + (joined[c.id] && !c.member ? 1 : 0) - (!joined[c.id] && c.member ? 1 : 0),
  cityId: 'dubai',
  coverPath: null,
  photo: c.cover,
});

/** Same shape as useCommunitiesLike. */
export function useDemoCommunitiesLike(_cityId: string, like: string, _girlOnly = false, _membersOnly = false) {
  const joined = useDemoGirl((s) => s.joined);
  const data = useMemo(
    () =>
      DEMO_COMMUNITIES.filter((c) => (like ? c.name.toLowerCase().includes(like.toLowerCase()) : !c.moms))
        .map((c) => toRow(c, joined))
        // Yours first, then the busiest.
        .sort((a, b) => Number(b.member) - Number(a.member) || b.members - a.members),
    [like, joined],
  );
  return { data, loading: false, error: null as string | null, reload: () => {} };
}

/* ───────── Plans ───────── */

export const findDemoPlan = (id: string) => DEMO_PLANS.find((p) => p.id === id);

const CATEGORY: Record<string, string> = { padel: 'sport', yoga: 'wellness', brunch: 'food', coffee: 'food', shopping: 'shopping', walk: 'culture', beach: 'outdoor', playdate: 'family' };

/** When a demo plan starts (from the demo's one clock). */
export function planStartsAt(p: DemoPlan): number {
  // Dubai is UTC+4 all year: its midnight today, then the day and the time.
  const DAY = 24 * HOUR;
  const midnight = Math.floor((T0 + 4 * HOUR) / DAY) * DAY - 4 * HOUR;
  const [h, m] = p.at.split(':').map(Number);
  return midnight + p.day * DAY + h * HOUR + m * MIN;
}

export const planGoing = (p: DemoPlan, going: Record<string, boolean>) => p.going.length + (going[p.id] && !p.joined ? 1 : 0) - (!going[p.id] && p.joined ? 1 : 0);

const toActivity = (p: DemoPlan, going: Record<string, boolean>): ServerActivity => ({
  id: p.id,
  title: p.title,
  categoryId: CATEGORY[p.kind] ?? 'social',
  subId: null,
  areaId: p.area,
  placeName: p.place,
  startsAt: planStartsAt(p),
  capacity: p.capacity,
  going: planGoing(p, going),
  priceMinor: 0,
  currency: 'AED',
  creatorId: p.by,
  joined: Boolean(going[p.id]),
  coverUrl: null,
  cityId: 'dubai',
  girlOnly: true,
  audience: p.moms ? 'moms' : 'girls',
});

/** Same shape as useServerActivities. */
export function useDemoActivities(_cityId: CityId, _only: { categoryId?: string; girlOnly?: boolean } = {}) {
  const going = useDemoGirl((s) => s.going);
  const activities = useMemo(
    // Every example plan is an IRLY Girl one (girls and moms).
    () => DEMO_PLANS.map((p) => toActivity(p, going)).sort((a, b) => a.startsAt - b.startsAt),
    [going],
  );
  return { activities, refresh: () => {}, loading: false, error: null as string | null };
}

/* ───────── Feed ───────── */

const toPost = (p: DemoPost): GirlPost => {
  const c = findDemoCommunity(p.community);
  const a = p.activity ? findDemoPlan(p.activity) : undefined;
  return {
    id: p.id,
    communityId: p.community,
    communityName: c?.name ?? '',
    authorId: p.by,
    firstName: demoName(p.by),
    body: p.text,
    activityId: a?.id ?? null,
    activityTitle: a?.title ?? null,
    activityStartsAt: a ? planStartsAt(a) : null,
    createdAt: T0 - p.ago * MIN,
    mine: false,
    isMember: true,
    photo: p.photo,
  };
};

export const demoPostsOf = (communityId: string) => DEMO_POSTS.filter((p) => p.community === communityId).sort((a, b) => a.ago - b.ago).map(toPost);

/** Same shape as useGirlFeed. */
export function useDemoGirlFeed(_cityId: string, moms: boolean) {
  const posts = useMemo(
    () =>
      DEMO_POSTS.filter((p) => Boolean(findDemoCommunity(p.community)?.moms) === moms)
        .sort((a, b) => a.ago - b.ago)
        .map(toPost),
    [moms],
  );
  return { posts, state: 'ready' as const, reload: () => {} };
}

/* ───────── Likes, saves, comments ───────── */

const commentCount = (p: DemoPost) => p.comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

/** Same shape as useEngagement: counts from the examples, your taps on top. */
export function useDemoEngagement(_type: TargetType, _ids: string[]) {
  const liked = useDemoGirl((s) => s.liked);
  const saved = useDemoGirl((s) => s.saved);
  const added = useDemoGirl((s) => s.added);
  const toggle = useDemoGirl((s) => s.toggle);
  const get = useCallback(
    (id: string): Engagement => {
      const p = DEMO_POSTS.find((x) => x.id === id);
      return {
        likes: (p?.likes ?? 0) + (liked[id] ? 1 : 0),
        comments: (p ? commentCount(p) : 0) + (added[id]?.length ?? 0),
        saves: (p?.saves ?? 0) + (saved[id] ? 1 : 0),
        liked: Boolean(liked[id]),
        saved: Boolean(saved[id]),
      };
    },
    [liked, saved, added],
  );
  const like = useCallback(async (id: string) => toggle('liked', id), [toggle]);
  const save = useCallback(async (id: string) => toggle('saved', id), [toggle]);
  return useMemo(() => ({ get, like, save, signedIn: true }), [get, like, save]);
}

/** The thread of a demo post (comments, then their replies), as the comments screen reads it. */
export function demoThread(targetId: string, liked: Record<string, boolean>): Comment[] {
  const p = DEMO_POSTS.find((x) => x.id === targetId);
  if (!p) return [];
  const out: Comment[] = [];
  for (const c of p.comments) {
    const id = `${p.id}-${c.id}`;
    out.push({ id, parentId: null, authorId: c.by, firstName: demoName(c.by), body: c.text, createdAt: T0 - c.ago * MIN, deleted: false, likes: (c.likes ?? 0) + (liked[id] ? 1 : 0), liked: Boolean(liked[id]), mine: false });
    (c.replies ?? []).forEach((r, i) => {
      const rid = `${id}-r${i}`;
      out.push({ id: rid, parentId: id, authorId: r.by, firstName: demoName(r.by), body: r.text, createdAt: T0 - r.ago * MIN, deleted: false, likes: (r.likes ?? 0) + (liked[rid] ? 1 : 0), liked: Boolean(liked[rid]), mine: false });
    });
  }
  return out;
}

/** Same shape as useComments: the example thread plus what you wrote in this tab. */
export function useDemoComments(t: Target) {
  const liked = useDemoGirl((s) => s.liked);
  const mine = useDemoGirl((s) => s.added[t.id]);
  const comment = useDemoGirl((s) => s.comment);
  const uncomment = useDemoGirl((s) => s.uncomment);
  const comments = useMemo(() => [...demoThread(t.id, liked), ...(mine ?? [])], [t.id, liked, mine]);
  const add = useCallback(
    async (body: string, parentId: string | null) => {
      const text = body.trim();
      if (!text) return;
      comment(t.id, { id: `local-${Date.now()}`, parentId, authorId: ME, firstName: 'You', body: text, createdAt: Date.now(), deleted: false, likes: 0, liked: false, mine: true });
    },
    [comment, t.id],
  );
  const remove = useCallback(async (id: string) => uncomment(t.id, id), [uncomment, t.id]);
  return { comments, loading: false, failed: false, add, remove, refresh: () => {}, signedIn: true };
}

/** Like or unlike a comment (comments screen). */
export const demoToggleLike = async (t: { type: TargetType; id: string }) => useDemoGirl.getState().toggle('liked', t.id);

/* ───────── Messages & notifications ───────── */

/** Same shape as useServerInbox, from the demo's IRLY Girl chats. */
export function useDemoGirlInbox(): { conversations: Conversation[]; refresh: () => void; loading: boolean; error: string | null } {
  const conversations = useMemo(() => getCityContent('dubai').conversations.filter((c) => c.id.startsWith('gcv-')), []);
  return { conversations, refresh: () => {}, loading: false, error: null };
}

export const demoNotifications = () => DEMO_NOTIFICATIONS.map((n) => ({ ...n, name: demoName(n.by) }));
