import { useBaliStore } from '@/features/bali/baliStore';
import { useGirlStore } from '@/features/girl/girlStore';
import { useLiveStore } from '@/features/live/liveStore';
import { clearFaces } from '@/features/server/faces';
import { useDrafts } from '@/features/posts/posts';
import { useStore } from './store';

/**
 * Everything this device remembers about the person: plans, bookings,
 * on-device chats, IRLY Girl matches and decisions, Bali quiz answers, lives,
 * unsent drafts, unread and bell counters. Used by Log out, Sign out, Delete
 * account and a session ended elsewhere: the next person to use the phone
 * must start from nothing. Synchronous and never throws: each part is wiped
 * even if another one fails.
 */
export function wipeLocal(): void {
  const parts: (() => void)[] = [
    () => useStore.getState().deleteAccount(),
    () => useStore.setState({ waitlist: {} }),
    clearFaces,
    () => useGirlStore.getState().reset(),
    () => useBaliStore.getState().setAnswers({}),
    () => useLiveStore.setState({ mine: [] }),
    // Unsent posts and Lives: never offered to the next person on this phone.
    () => useDrafts.setState({ byKey: {} }),
  ];
  for (const wipe of parts) {
    try {
      wipe();
    } catch {
      // The other parts are still wiped.
    }
  }
  // Server data cached in memory for the account that left (its chats, Lives, plans, signed
  // photo links) and its badges. Loaded lazily: these modules import the account module.
  import('@/features/server/chat')
    .then((m) => {
      m.clearChatCache();
      m.useServerUnread.setState({ n: 0 });
    })
    .catch(() => undefined);
  import('@/features/server/social')
    .then((m) => {
      m.clearSocialCache();
      m.useServerBell.setState({ n: 0 });
    })
    .catch(() => undefined);
  import('@/features/server/activities').then((m) => m.clearActivityCache()).catch(() => undefined);
  import('@/features/server/media').then((m) => m.clearLinkCache()).catch(() => undefined);
  import('@/features/live/liveMedia').then((m) => m.clearLiveCache()).catch(() => undefined);
}
