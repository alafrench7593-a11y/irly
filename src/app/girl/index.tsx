import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { GirlClosed, GirlLoading, useGirlAccess } from '@/features/girl/access';
import { gateTarget, GIRL_HOME } from '@/features/girl/doors';
import { toast } from '@/components/ui/Toast';
import { resetAppSpace, setAppSpace, useSpaceStore } from '@/state/appSpace';
import { Flavor } from '@/theme/flavor';

/** Still on the gate this long after leaving for IRLY Girl: go again, by replacing it (never a loader for good). */
const LEAVE_LIMIT = 4_000;

/**
 * The door into IRLY Girl (every « IRLY Girl » and « IRLY Mom Community » entry,
 * and links to /girl). IRLY Girl is not another app: it is the same IRLY
 * (same tabs, same pages, same flows) in the Girl look, with Girl content.
 * This page only asks the server whether IRLY Girl is open for this
 * account (features/girl/access), then:
 * - open: the app switches to IRLY Girl (state/appSpace) and lands on
 *   IRLY Girl's Home, or straight on IRLY Mom Community for the Mom door
 *   (features/girl/doors: one place decides, nothing relayed through Home);
 * - refused (not a woman's account, paused, signed out): the app stays in
 *   IRLY and this page says why, with a way forward.
 * Switching never grants anything: every Girl row is guarded by RLS.
 */
export default function GirlEntry() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { access, retry } = useGirlAccess();
  // Read from the params of this very visit, each render: the gate reused for another door follows it.
  const target = gateTarget(mode);
  const left = useRef<string | null>(null);

  useEffect(() => {
    if (access === 'open') {
      // Once: a re-check answering « open » again (focus, foreground) does not switch or navigate twice.
      if (left.current === target) return;
      left.current = target;
      const entering = useSpaceStore.getState().space !== 'girl';
      setAppSpace('girl');
      if (entering) toast('Welcome to IRLY Girl', 'sparkles', 'brand');
      // Back to the tabs under this page (or fresh ones after a link), on the page this door asked for.
      router.dismissTo(target);
    } else if (access !== 'checking' && access !== 'error') {
      resetAppSpace();
    }
  }, [access, router, target]);

  // The way out did not happen (navigation not ready, dropped): replace the gate rather than spin.
  useEffect(() => {
    if (access !== 'open') return;
    const timer = setTimeout(() => router.replace(target), LEAVE_LIMIT);
    return () => clearTimeout(timer);
  }, [access, router, target]);

  return (
    <Flavor value="girl">
      {access === 'checking' || access === 'open' ? <GirlLoading /> : <GirlClosed reason={access} onRetry={retry} moms={target !== GIRL_HOME} />}
    </Flavor>
  );
}
