import { useEffect, type ReactNode } from 'react';
import { GirlGate } from './access';
import { setAppSpace, useAppSpace } from '@/state/appSpace';

/**
 * A demo IRLY Girl page (gc-…, ga-…) opened from a link while in IRLY Mixte:
 * it opens in IRLY Girl, behind its gate, like a real one (the server path
 * switches space too), so Girl content never shows inside Mixte.
 */
export function DemoGirlPage({ children }: { children: ReactNode }) {
  const space = useAppSpace();
  useEffect(() => {
    if (space !== 'girl') setAppSpace('girl');
  }, [space]);
  if (space !== 'girl') return null;
  return <GirlGate>{children}</GirlGate>;
}
