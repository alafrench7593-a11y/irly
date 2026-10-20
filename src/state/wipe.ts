import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageName } from '@/config/app';
import { useBaliStore } from '@/features/bali/baliStore';
import { useCreateStore } from '@/features/create/createStore';
import { useGirlStore } from '@/features/girl/girlStore';
import { useHeroStore } from '@/features/hero/heroStore';
import { useLiveStore } from '@/features/live/liveStore';
import { pendingJournal } from '@/features/live/pendingLive';
import { useReportStore } from '@/features/moderation/reportStore';
import { usePhotoViewer } from '@/features/photo/photoViewer';
import { clearFaces } from '@/features/server/faces';
import { useDrafts } from '@/features/posts/posts';
import { resetAppSpace } from './appSpace';
import { useStore } from './store';

/** When this phone last opened the recap (features/engage): the next person starts without it. */
const RECAP_SEEN = storageName('irly-recap-seen');

/**
 * Everything this device remembers about the person: plans, bookings,
 * on-device chats, IRLY Girl matches and decisions, Bali quiz answers, lives,
 * unsent drafts, unread and bell counters. Used by Log out, Sign out, Delete
 * account and a session ended elsewhere: the next person to use the phone
 * must start from nothing. Synchronous and never throws: each part is wiped
 * even if another one fails.
 *
 * Every persisted store with personal data must be listed here:
 * scripts/test-auth.mts checks it (and fails when a new one is not).
 */
export function wipeLocal(): void {
  const parts: (() => void)[] = [
    () => useStore.getState().deleteAccount(),
    () => useStore.setState({ waitlist: {} }),
    clearFaces,
    () => useGirlStore.getState().reset(),
    // The next person on this phone opens IRLY in its Mixte form.
    resetAppSpace,
    () => useBaliStore.getState().setAnswers({}),
    () => useLiveStore.setState({ mine: [] }),
    // Unsent posts and Lives: never offered to the next person on this phone.
    () => useDrafts.setState({ byKey: {} }),
    // Lives whose publish had no answer yet (their text and file paths): the account that left settles them no more.
    () => pendingJournal.clear(),
    // Overlays opened by the account that left (a photo, a card, a report sheet, the composer with its
    // community) never stay over the next screen.
    () => usePhotoViewer.setState({ photo: null, shown: null, origin: null }),
    () => useHeroStore.setState({ item: null, active: null, origin: null }),
    () => useReportStore.getState().close(),
    () => useCreateStore.setState({ open: false, origin: null, preset: null }),
    () => void AsyncStorage.removeItem(RECAP_SEEN).catch(() => undefined),
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
  import('@/features/girl/api').then((m) => m.clearMatchLinks()).catch(() => undefined);
  import('@/features/network/api').then((m) => m.clearNetworkLinks()).catch(() => undefined);
}
