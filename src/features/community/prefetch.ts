import { currentUserId } from '@/features/auth/account';
import { signedLinks, storedKey } from '@/features/server/media';
import { supabase } from '@/lib/supabase';
import { cacheKey, peek, warm, warmImages } from './cache';
import { feedKey, fetchCommunityDetail, fetchFeedFirst, type CommunityPost, type FirstPage } from './data';
import { fetchHeader, fetchMembers, fetchMyRights } from './governance';
import { fetchChannels, fetchExtras, type Channel } from './groups';

/**
 * Starts reading a community's page while the finger is still on its card or
 * link (press-in comes ~100 ms before the press, and the page's own reads
 * wait for its screen to mount): its detail, header numbers, my rights,
 * categories, tools and first page of posts, all side by side, and the
 * first photos of that page into the image cache. The page joins these reads
 * (community cache) instead of sending its own, so it opens filled.
 *
 * Nothing read less than half a minute ago is read again; nothing happens
 * signed out or in the demo (no server).
 */
export function prefetchCommunity(id: string | null | undefined): void {
  const uid = currentUserId();
  if (!supabase || !uid || !id) return;
  // Its header photo too: signed and fetched while the finger is down, so the page opens on it.
  void warm(cacheKey(uid, 'detail', id), () => fetchCommunityDetail(uid, id)).then((d) => warmCover(d?.coverPath));
  void warm(cacheKey(uid, 'header', id), () => fetchHeader(id));
  void warm(cacheKey(uid, 'rights', id), () => fetchMyRights(id));
  void warm(cacheKey(uid, 'extras', id), () => fetchExtras(uid, id));
  void warm(cacheKey(uid, 'channels', id), () => fetchChannels(id));
  // The page asks for General when the community has categories, every post otherwise:
  // what the last known categories say (most communities have none).
  const channels = peek<Channel[]>(cacheKey(uid, 'channels', id));
  const space = channels?.length ? null : undefined;
  void warm<FirstPage>(feedKey(uid, id, space, 'recent'), () => fetchFeedFirst(uid, id, space, 'recent')).then((page) => warmPostImages(page?.posts ?? []));
}

/** The Members tab's first page (everyone, no search), read ahead once the page has settled. */
export function prefetchMembers(id: string): void {
  const uid = currentUserId();
  if (!supabase || !uid || !id) return;
  // Same key as useMembersList with an empty search (governance.ts).
  void warm(cacheKey(uid, 'members', `${id}|`), () => fetchMembers(id, null));
}

/**
 * The first pictures of a feed: the files of its first posts with media are
 * signed in one request (the cards then find their links ready), and each
 * one's first photo is fetched into the image cache under the key the card
 * shows it with (its path).
 */
export function warmPostImages(posts: CommunityPost[], fetchFirst = 4): void {
  // A page of posts (20): their files are signed together; links already known cost nothing.
  const withMedia = posts.slice(0, 20).filter((p) => !p.pending && p.mediaPaths?.length);
  const files = withMedia.flatMap((p) => [...(p.mediaPaths ?? []), p.thumbPath]).filter((x): x is string => Boolean(x));
  const photos = withMedia
    .filter((p) => p.mediaKind === 'photo')
    .slice(0, fetchFirst)
    .map((p) => p.mediaPaths?.[0])
    .filter((x): x is string => Boolean(x));
  if (!files.length || !supabase) return;
  signedLinks('post-media', files)
    .then((links) => warmImages(photos.filter((p) => links[p]).map((p) => ({ uri: links[p], cacheKey: p })), fetchFirst))
    .catch(() => undefined);
}

/** A community's own header photo (its full size, as the page shows it) into the image cache. */
function warmCover(path: string | null | undefined): void {
  if (!path || !supabase) return;
  signedLinks('activity-photos', [path])
    .then((links) => {
      const uri = links[path];
      const key = storedKey(uri);
      if (uri && key) warmImages([{ uri, cacheKey: key }], 1);
    })
    .catch(() => undefined);
}
