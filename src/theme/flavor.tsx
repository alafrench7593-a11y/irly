import { createContext, useContext, type ReactNode } from 'react';

/**
 * The two experiences of IRLY share one interface: the same components,
 * the same glass, the same motion. A flavor only changes the identity:
 * - mixte: IRLY Noir (or Clair), white for the main action, steel light
 * - girl: IRLY Girl, rose-white ground, rose for the main action, plum ink
 * The root layout wraps the whole app in <Flavor value={app space}>
 * (state/appSpace): in IRLY Girl every tab and page is the same screen in
 * the Girl flavor. Every shared component reads the flavor through
 * useTheme(), so nothing is built twice.
 */
export type FlavorId = 'mixte' | 'girl';

const FlavorContext = createContext<FlavorId>('mixte');

export function Flavor({ value, children }: { value: FlavorId; children: ReactNode }) {
  return <FlavorContext.Provider value={value}>{children}</FlavorContext.Provider>;
}

export function useFlavor(): FlavorId {
  return useContext(FlavorContext);
}

/**
 * IRLY Network pages: in IRLY Girl they turn violet (grey in Mixte, which
 * is already its identity). Only the Network screens are wrapped in it, so
 * the violet never reaches the rest of IRLY Girl.
 */
const NetworkContext = createContext(false);

export function NetworkScope({ children }: { children: ReactNode }) {
  return <NetworkContext.Provider value>{children}</NetworkContext.Provider>;
}

export function useNetworkScope(): boolean {
  return useContext(NetworkContext);
}
