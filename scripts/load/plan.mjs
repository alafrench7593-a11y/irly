/**
 * The shape of the fictitious data, shared by the seed (scripts/staging-seed.mjs, Node) and the load
 * scripts (k6): how many of each thing, who is in which community and private chat, and the ids.
 * Pure JavaScript with no import, so both can load it. The seed's SQL mirrors these formulas: change
 * one, change the other.
 */
export const SIZES = { small: 1000, medium: 10000, large: 50000 };
export const ID_PREFIX = '10ad7e57';
/** Private chats: member i with member i + offset, for the i matching `every` / `at`. */
export const DIRECT_SETS = [
  { offset: 1, every: 2, at: 1 },
  { offset: 13, every: 5, at: 0 },
  { offset: 101, every: 10, at: 3 },
];
export const MEMBER_MAIL = (n) => `load-${n}@irly.test`;

const hex12 = (n) => {
  let s = Math.floor(n).toString(16);
  while (s.length < 12) s = '0' + s;
  return s;
};
const id = (kind) => (n) => `${ID_PREFIX}-${kind}-4000-8000-${hex12(n)}`;
/** Ids: members, communities, private chats, activities, posts, community chats. */
export const ids = {
  member: id('0001'),
  community: id('0002'),
  direct: (set, i) => id('0003')(set * 1000000 + i),
  activity: id('0004'),
  post: (k, g) => id('0005')(k * 1000000 + g),
  communityChat: id('0009'),
};

/** How many members community k holds (before the women-only rule), for n members in all. */
export function communitySize(k, n) {
  const share = k === 1 ? 0.24 : k === 2 ? 0.16 : k === 3 ? 0.12 : k === 4 ? 0.1 : k === 5 ? 0.08 : k <= 20 ? 0.02 + (20 - k) * 0.0026 : k <= 60 ? 0.006 + ((k * 37) % 500) / 50000 : 0.0004 + ((k * 53) % 181) / 50000;
  return Math.max(8, Math.round(share * n));
}

export function plan(size) {
  const members = SIZES[size];
  if (!members) throw new Error('size: small, medium or large');
  const count = { small: 30, medium: 120, large: 300 }[size];
  const communities = [];
  for (let k = 1; k <= count; k += 1) {
    const girl = k % 10 === 0;
    const sz = communitySize(k, members);
    // The busy chat, a few large ones, and the long tail.
    const messages = k === 1 ? sz * 20 : k <= 5 ? sz * 8 : sz * 3;
    const posts = Math.max(3, Math.min(3000, Math.round(sz / 2)));
    communities.push({ k, girl, size: sz, messages, posts, owner: 2 * k });
  }
  const running = { small: 20, medium: 100, large: 300 }[size];
  const waiting = { small: 20, medium: 100, large: 200 }[size];
  const gamesFrom = Math.floor(members / 2);
  return {
    size,
    members,
    communities,
    /** Community chats of a few hundred members at most: where the load writes. */
    midCommunities: communities.filter((c) => c.k > 20 && c.k <= 60 && !c.girl).map((c) => c.k),
    activities: Math.round(members / 10),
    directMessages: 8,
    activityMessages: 4,
    follows: 3,
    hotPostComments: Math.round(members / 10),
    hotPostLikes: Math.round(members / 6),
    games: { running, waiting, table: 8, lobby: 3, runningFrom: gamesFrom, waitingFrom: gamesFrom + running * 8 },
  };
}

export const isWoman = (i) => i % 2 === 0 && i % 50 !== 49;

/** Whether member i is in community c (the seed's SQL says the same). */
export function inCommunity(i, c, members) {
  if (i === c.owner) return true;
  if (c.girl && !isWoman(i)) return false;
  return (i * 7919 + c.k * 104729) % members < (c.girl ? c.size * 2 : c.size);
}

/** The private chats member i is in: [{ id, other }]. */
export function directsOf(i, members) {
  const out = [];
  DIRECT_SETS.forEach((s, set) => {
    if (i % s.every === s.at && i + s.offset <= members) out.push({ id: ids.direct(set, i), other: i + s.offset });
    const j = i - s.offset;
    if (j >= 1 && j % s.every === s.at) out.push({ id: ids.direct(set, j), other: j });
  });
  return out;
}

/** The members seated at running table t (1-based), and at waiting lobby t. */
export const tableMembers = (p, t) => Array.from({ length: p.games.table }, (_, s) => p.games.runningFrom + (t - 1) * p.games.table + s + 1);
export const lobbyMembers = (p, t) => Array.from({ length: p.games.lobby }, (_, s) => p.games.waitingFrom + (t - 1) * p.games.lobby + s + 1);
