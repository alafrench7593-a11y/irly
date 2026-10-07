import { useBaliStore } from '@/features/bali/baliStore';
import { useGirlStore } from '@/features/girl/girlStore';
import { useLiveStore } from '@/features/live/liveStore';
import { useStore } from './store';

/**
 * Everything this device remembers about the person: plans, bookings,
 * on-device chats, IRLY Girl matches and decisions, Bali quiz answers, lives.
 * Used by Log out, Sign out and Delete account: the next person to use the
 * phone must start from nothing.
 */
export function wipeLocal(): void {
  useStore.getState().deleteAccount();
  useStore.setState({ waitlist: {} });
  useGirlStore.getState().reset();
  useBaliStore.getState().setAnswers({});
  useLiveStore.setState({ mine: [] });
}
