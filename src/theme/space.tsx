import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { useAppSpace } from '@/state/appSpace';
import { Flavor, type FlavorId } from './flavor';

/**
 * Which experience the app is showing: IRLY (Mixte) or IRLY Girl. One app,
 * the same tabs and pages; the space only changes the look (and which
 * content the lists ask the server for). It is the member's app space
 * (state/appSpace), set when IRLY Girl opens for her (features/girl/access)
 * and reset when she goes back to IRLY, logs out or loses access.
 *
 * Purely cosmetic here: it picks a palette, never grants anything. IRLY
 * Girl access is decided by the server, and every Girl row by RLS.
 *
 * `?flavor=girl` on a route still asks for the Girl look (older links).
 */
export function useSpace(): FlavorId {
  const { flavor } = useLocalSearchParams<{ flavor?: string }>();
  const space = useAppSpace();
  return flavor === 'girl' ? 'girl' : space;
}

/**
 * Wraps a screen so every component inside (Glass, Button, Sheet, Page,
 * Ambient...) reads the palette of the current space. The root layout
 * already provides it; this keeps the `?flavor=girl` links working.
 */
export function SpaceFlavor({ children }: { children: ReactNode }) {
  return <Flavor value={useSpace()}>{children}</Flavor>;
}
