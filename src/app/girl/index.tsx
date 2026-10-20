import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { GirlClosed, GirlLoading, useGirlAccess } from '@/features/girl/access';
import { toast } from '@/components/ui/Toast';
import { resetAppSpace, setAppSpace, useSpaceStore } from '@/state/appSpace';
import { Flavor } from '@/theme/flavor';

/**
 * The door into IRLY Girl (every « IRLY Girl » and « IRLY Moms » entry,
 * and links to /girl). IRLY Girl is not another app: it is the same IRLY
 * (same tabs, same pages, same flows) in the Girl look, with Girl content.
 * This page only asks the server whether IRLY Girl is open for this
 * account (features/girl/access), then:
 * - open: the app switches to IRLY Girl (state/appSpace) and lands on the
 *   same Home, which now shows Girl content;
 * - refused (not a woman's account, paused, signed out): the app stays in
 *   IRLY and this page says why, with a way forward.
 * Switching never grants anything: every Girl row is guarded by RLS.
 */
export default function GirlEntry() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { access, retry } = useGirlAccess();

  useEffect(() => {
    if (access === 'open') {
      const entering = useSpaceStore.getState().space !== 'girl';
      setAppSpace('girl');
      if (entering) toast('Welcome to IRLY Girl', 'sparkles', 'brand');
      // Back to the Home under this page (or a fresh one after a link), on the Moms side if asked.
      router.dismissTo(mode === 'moms' ? '/(tabs)?girl=moms' : '/(tabs)');
    } else if (access !== 'checking' && access !== 'error') {
      resetAppSpace();
    }
  }, [access, mode, router]);

  return (
    <Flavor value="girl">
      {access === 'checking' || access === 'open' ? <GirlLoading /> : <GirlClosed reason={access} onRetry={retry} moms={mode === 'moms'} />}
    </Flavor>
  );
}
