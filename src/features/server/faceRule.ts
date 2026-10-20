/**
 * Which photo a person shows, as plain rules (no React, no network), shared
 * by every avatar and photo card and checked by scripts/test-faces.mts.
 *
 * - A real account (a uuid) shows its own current profile photo, the same in
 *   IRLY and IRLY Girl. While that is still unknown, a photo the screen
 *   already holds for that same account may stand in; once the server says
 *   she has no photo, a neutral placeholder (her initials), never a photo
 *   from somewhere else.
 * - Example people (demo build ids like "g-maya") show the one illustrative
 *   portrait of their own record.
 */
export type FaceLike = { uri: string } | null | undefined;

const AVATAR = /^irly-avatar:/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A real account id (a uuid): only these are looked up on the server. */
export const isAccountId = (id?: string | null): id is string => Boolean(id && UUID.test(id));

/** The small avatar: the account's own face, or `given` only while that is unknown (and for example people). */
export function shownPhoto(userId: string | null | undefined, face: FaceLike, given: string | undefined): string | undefined {
  if (!isAccountId(userId)) return given;
  if (face) return face.uri;
  return face === null ? undefined : given;
}

/**
 * A big photo card: her profile photo first (a real photo beats an IRLY
 * avatar drawing), then her own other photos, else nothing (placeholder).
 */
export function cardPhoto(face: FaceLike, ownPhotos: string[] | undefined): string | undefined {
  const profile = face?.uri;
  const own = ownPhotos?.find((p) => !AVATAR.test(p));
  if (profile && !AVATAR.test(profile)) return profile;
  return own ?? profile ?? ownPhotos?.[0];
}
