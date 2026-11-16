/**
 * "Live now" shows people, not posts: a member who posted several Lives is
 * one face, with every Live of theirs behind it.
 *
 * Pure (no React Native): unit-tested from node (scripts/check-live.mts).
 */

/** One Live as "Live now" reads it: who posted it, when, and what the face shows. */
export type LiveEntry = {
  /** The Live's own id. */
  id: string;
  /** Who posted it: the same value for every Live of one member ('me' for the member's own, sent or not). */
  author: string;
  /** When it was posted (ms). */
  at: number;
  name: string;
  text: string;
  hue: number;
  photo?: string;
  userId?: string;
  friend: boolean;
};

/** One face of "Live now": a member, with their Lives (oldest first, as they were posted). */
export type LiveFace = {
  /** The member, never one of their posts: stable while they post more. */
  key: string;
  name: string;
  /** Their latest Live (what the face says). */
  text: string;
  hue: number;
  photo?: string;
  userId?: string;
  friend: boolean;
  /** Every Live of theirs still up, oldest first. */
  lives: { id: string; text: string; at: number }[];
};

/**
 * One face per member, in the order their first entry comes in `entries`
 * (the caller's order: the server's Lives newest first, then the phone's).
 * Nothing is dropped: every Live is in its member's `lives`; the same Live
 * given twice (the phone's copy and the server's) counts once.
 */
export function groupLiveFaces(entries: LiveEntry[]): LiveFace[] {
  const faces = new Map<string, LiveFace>();
  const latest = new Map<string, number>();
  for (const e of entries) {
    const face = faces.get(e.author);
    if (!face) {
      faces.set(e.author, { key: e.author, name: e.name, text: e.text, hue: e.hue, photo: e.photo, userId: e.userId, friend: e.friend, lives: [{ id: e.id, text: e.text, at: e.at }] });
      latest.set(e.author, e.at);
      continue;
    }
    if (face.lives.some((l) => l.id === e.id)) continue;
    face.lives.push({ id: e.id, text: e.text, at: e.at });
    face.friend = face.friend || e.friend;
    face.photo = face.photo ?? e.photo;
    face.userId = face.userId ?? e.userId;
    if (e.at > (latest.get(e.author) ?? 0)) {
      latest.set(e.author, e.at);
      face.text = e.text;
    }
  }
  const list = [...faces.values()];
  for (const f of list) f.lives.sort((a, b) => a.at - b.at);
  return list;
}

/** The longest text of a Live (irl_posts.body: 160 characters) and of a community post (community_posts.body: 2000). */
export const LIVE_TEXT_MAX = 160;
export const POST_TEXT_MAX = 2000;

/**
 * Where a text stands against its limit: `count` is shown once the member
 * gets near it (never from the first letter), `over` when it is past it (a
 * draft written for a community, then posted as a Live): it cannot be sent.
 */
export function textLimit(text: string, max: number): { length: number; count: boolean; over: boolean } {
  const length = text.length;
  return { length, count: length > max - Math.min(200, Math.round(max / 2)), over: length > max };
}
