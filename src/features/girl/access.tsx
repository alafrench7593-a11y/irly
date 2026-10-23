import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useAccount, useAuthStatus } from '@/features/auth/account';
import { changed, useRefreshOn } from '@/features/server/sync';
import { t as tx } from '@/i18n';
import { hasSession, supabase } from '@/lib/supabase';
import { together } from '@/lib/together';
import { DEMO } from '@/config/app';
import { resetAppSpace, useAppSpace, useSpaceStore } from '@/state/appSpace';
import { useStore } from '@/state/store';
import { space } from '@/theme/tokens';
import { girl, girlType } from './theme';
import { GButton } from './ui';
import { enter } from '@/motion/enter';
import Animated from 'react-native-reanimated';
import { Ambient } from '@/components/visual/Ambient';
import { GirlLoader } from './GirlMark';
import { useGirlStore } from './girlStore';

/**
 * Who may enter IRLY Girl (and IRLY Moms, which lives inside it), as seen
 * by the app. The server is the authority: every IRLY Girl read and write
 * is refused there for an account that is not a woman's, or whose IRLY Girl
 * access was withdrawn (private.is_girl_eligible). This only decides which
 * screen to show, so nobody lands on a half-empty page that the server
 * then refuses piece by piece.
 *
 * - With the IRLY server: `my_girl_status()` → open, suspended, not_eligible.
 *   Signed out → sign in first (no local stand-in for a real account).
 * - Without a server (development, demo build): the gender of the local
 *   profile, the same rule the on-device Match uses.
 */
export type GirlAccess = 'checking' | 'open' | 'signed_out' | 'not_eligible' | 'suspended' | 'error';
export type GirlClosedReason = Exclude<GirlAccess, 'checking' | 'open'>;

/** Past this, the screen offers Try again instead of a spinner. */
export const ACCESS_LIMIT = 15_000;

/** The promise, or a rejection once `ms` have passed without an answer. */
export function withLimit<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('IRLY did not answer in time')), ms);
    p.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

/** The server refused because IRLY Girl is closed for this account (not a network error). */
export function isGirlRefusal(e: unknown): boolean {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return /reserved for women/i.test(m);
}

/** Back, or somewhere sensible when the screen was opened from a link (no history). */
export function safeBack(router: ReturnType<typeof useRouter>, fallback: string = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

/** One read of the member's IRLY Girl access. */
export async function readGirlAccess(): Promise<Exclude<GirlAccess, 'checking' | 'error'>> {
  // The demonstration build shows IRLY Girl as a woman sees it (example content only).
  if (DEMO) return 'open';
  if (!supabase) return useStore.getState().profile.gender === 'woman' ? 'open' : 'not_eligible';
  if (!(await hasSession())) return 'signed_out';
  const { data, error } = await supabase.rpc('my_girl_status');
  if (error) throw new Error(error.message);
  return data === 'open' ? 'open' : data === 'suspended' ? 'suspended' : 'not_eligible';
}

type Answer = Exclude<GirlAccess, 'checking' | 'error'>;

/** The last answer of the server, per account: the checks every page makes stay cheap. */
let last: { uid: string | null; access: Answer; at: number } | null = null;

/** How long an answer is reused by the pages of IRLY Girl (the app coming back to the foreground always asks again). */
export const ACCESS_FRESH = 60_000;

/** The member's access, reusing an answer younger than `maxAge` for the same account (0: always ask). */
export async function girlAccessFor(uid: string | null, maxAge = 0): Promise<Answer> {
  if (maxAge && last && last.uid === uid && Date.now() - last.at < maxAge) return last.access;
  // Checks asked in the same moment (Home's two IRLY Girl doors, as it opens or comes back into focus) are one read.
  const access = await withLimit(together(`girl-access:${uid ?? ''}`, readGirlAccess), ACCESS_LIMIT);
  // Open a moment ago, closed now (suspended, gender corrected, signed out): what this phone kept of IRLY Girl goes.
  if (last && last.uid === uid && last.access === 'open' && access !== 'open') forgetGirlData();
  last = { uid, access, at: Date.now() };
  return access;
}

/**
 * IRLY Girl access ended for this account: everything of IRLY Girl that the
 * app kept in memory (chats and their messages, Lives, plans, signed photo
 * links, Network cards, the on-device Match) is forgotten, and the lists
 * read again from the server, which no longer returns any of it (RLS). The
 * account stays signed in and keeps the rest of IRLY. Never throws.
 */
export function forgetGirlData(): void {
  try {
    useGirlStore.getState().reset();
  } catch {
    // The caches below are still cleared.
  }
  // Loaded lazily, as in state/wipe: these modules import the account module.
  import('@/features/server/chat').then((m) => m.clearChatCache()).catch(() => undefined);
  import('@/features/server/social').then((m) => m.clearSocialCache()).catch(() => undefined);
  import('@/features/server/activities').then((m) => m.clearActivityCache()).catch(() => undefined);
  import('@/features/server/media').then((m) => m.clearLinkCache()).catch(() => undefined);
  import('@/features/server/covers').then((m) => m.clearCoverCache()).catch(() => undefined);
  import('@/features/live/liveMedia').then((m) => m.clearLiveCache()).catch(() => undefined);
  import('./api').then((m) => m.clearMatchLinks()).catch(() => undefined);
  import('@/features/network/api').then((m) => m.forgetGirlNetwork()).catch(() => undefined);
  changed('inbox', 'activities', 'communities', 'notifs', 'irl');
}

/** Log out, Delete account, another account on this phone: the next person never reuses this answer. */
export function clearGirlAccess(): void {
  last = null;
}

/** The cached answer for this account, if any (to open a page without a spinner). */
const cachedAccess = (uid: string | null): Answer | null => (last && last.uid === uid ? last.access : null);

/**
 * The member's access, checked when the screen opens, each time it comes
 * back into focus, when the account changes, and when the app returns from
 * the background. A refused re-check closes the screen right away (an
 * access withdrawn mid-session); a failed re-check keeps what already works.
 */
export function useGirlAccess(): { access: GirlAccess; retry: () => void } {
  const uid = useAccount()?.userId ?? null;
  const gender = useStore((s) => s.profile.gender);
  // Already answered for this account (another page of IRLY Girl): no spinner, the check runs behind.
  const [access, setAccess] = useState<GirlAccess>(() => cachedAccess(uid) ?? 'checking');
  const known = useRef<{ uid: string | null; ok: boolean }>({ uid, ok: cachedAccess(uid) != null });
  const seq = useRef(0);

  const check = useCallback(() => {
    // Another account (or signed out meanwhile): nothing known about it yet.
    if (known.current.uid !== uid) known.current = { uid, ok: false };
    if (!known.current.ok) setAccess('checking');
    const n = ++seq.current;
    girlAccessFor(uid)
      .then((a) => {
        if (n !== seq.current) return;
        known.current.ok = true;
        setAccess(a);
      })
      .catch(() => {
        if (n === seq.current && !known.current.ok) setAccess('error');
      });
    // `gender` only matters without a server (local profile edited).
  }, [uid, gender]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      check();
    }, [check]),
  );
  // Back to the app after a while, or the profile changed: ask again.
  useRefreshOn(['people'], check);

  // Never a spinner for good: still checking past the limit (an answer that never came, a check that
  // never started because the screen was not focused), the screen offers Try again.
  useEffect(() => {
    if (access !== 'checking') return;
    const timer = setTimeout(() => setAccess((a) => (a === 'checking' ? 'error' : a)), ACCESS_LIMIT + 1_000);
    return () => clearTimeout(timer);
  }, [access]);

  const retry = useCallback(() => {
    known.current.ok = false;
    check();
  }, [check]);
  return { access, retry };
}

/**
 * While the app is in IRLY Girl (state/appSpace), every page re-checks the
 * access as it opens (the answer of the last minute is reused, so it costs
 * nothing) and the server is asked again whenever the app comes back to the
 * foreground or the account changes. Refused (paused after reports, not a
 * woman's account, signed out): back to IRLY and the screen that says why.
 * A failed check (offline) changes nothing. The space never grants data:
 * every IRLY Girl row is guarded by the server (RLS).
 */
export function GirlSpaceGuard() {
  const space = useAppSpace();
  const uid = useAccount()?.userId ?? null;
  const auth = useAuthStatus();
  const pathname = usePathname();
  const router = useRouter();
  const check = useCallback(
    (maxAge: number) => {
      // The stored session is still being read: no answer about « signed out » yet.
      if (auth === 'unknown' || useSpaceStore.getState().space !== 'girl') return;
      girlAccessFor(uid, maxAge)
        .then((a) => {
          if (a === 'open' || useSpaceStore.getState().space !== 'girl') return;
          // The app was in IRLY Girl: what it kept of it is forgotten with the space.
          forgetGirlData();
          resetAppSpace();
          // The gate says why (and offers the way forward).
          router.push('/girl');
        })
        .catch(() => undefined);
    },
    [uid, auth, router],
  );
  useEffect(() => {
    if (space === 'girl' && pathname !== '/girl') check(ACCESS_FRESH);
  }, [space, pathname, check]);
  useRefreshOn(['people'], () => check(0));
  return null;
}

/** The IRLY Girl waiting screen: words with the spinner, never a bare one. */
export function GirlLoading({ label = 'Opening your space…' }: { label?: string }) {
  return (
    <View style={[styles.root, styles.center, { gap: 14, padding: space.gutter }]} accessibilityLabel={tx('Loading')}>
      <Ambient variant="hero" />
      <GirlLoader label={label} />
    </View>
  );
}

const CLOSED: Record<GirlClosedReason, { icon: IconName; title: string; body: string }> = {
  not_eligible: {
    icon: 'lock',
    title: 'IRLY Girl is reserved for women',
    body: 'A space where women meet other women: brunches, padel, travel, wellness. Access follows the gender on your IRLY account and is checked by our servers. The rest of IRLY is open to you.',
  },
  suspended: {
    icon: 'shield',
    title: 'IRLY Girl is paused for your account',
    body: 'After reports, our team paused your access to IRLY Girl. The rest of IRLY works as usual. If you think this is a mistake, write to us.',
  },
  signed_out: {
    icon: 'user',
    title: 'Sign in to open IRLY Girl',
    body: 'IRLY Girl is a space for women, opened by our servers for your account. Sign in to continue.',
  },
  error: {
    icon: 'globe',
    title: 'IRLY Girl could not load',
    body: 'Check your connection and try again.',
  },
};

/**
 * Why IRLY Girl is not shown, said plainly and respectfully, with a way
 * forward: try again, sign in, support, or back into IRLY (never a dead end,
 * even when the page was opened from a link).
 */
export function GirlClosed({ reason, onRetry, moms }: { reason: GirlClosedReason; onRetry?: () => void; moms?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = CLOSED[reason];
  return (
    <View style={[styles.root, styles.center, { padding: space.gutter + 8, gap: 16, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <Ambient variant="hero" />
      <Animated.View entering={enter.pop(0)} style={styles.badge}>
        <Icon name={c.icon} size={26} color={girl.rose} />
      </Animated.View>
      <Text variant="displayM" align="center" color={girl.ink} accessibilityRole="header" style={girlType.display}>
        {c.title}
      </Text>
      <Text variant="body" align="center" color={girl.inkSoft} style={{ maxWidth: 420 }}>
        {c.body}
      </Text>
      <View style={styles.actions}>
        {reason === 'error' && onRetry ? <GButton label="Try again" onPress={onRetry} /> : null}
        {reason === 'signed_out' ? <GButton label="Sign in" icon="user" onPress={() => router.push('/account')} /> : null}
        {reason === 'suspended' ? <GButton label="Contact support" onPress={() => router.push('/support')} /> : null}
        {/* IRLY Family is open to every parent: the way in for a dad who tapped « IRLY Moms ». */}
        {reason === 'not_eligible' && moms ? <GButton label="Explore IRLY Family" icon="home" variant="secondary" onPress={() => router.replace('/space/families')} /> : null}
        <GButton label="Back to IRLY" variant={reason === 'not_eligible' && !moms ? 'primary' : 'ghost'} onPress={() => safeBack(router, '/')} />
      </View>
    </View>
  );
}

/**
 * Wraps an IRLY Girl screen: its content mounts only once the server says
 * IRLY Girl is open for this account, so a link (/girl/…), the back button
 * or what a previous session left on the device cannot show it otherwise.
 */
export function GirlGate({ children, moms }: { children: ReactNode; moms?: boolean }) {
  const { access, retry } = useGirlAccess();
  if (access === 'checking') return <GirlLoading />;
  if (access !== 'open') return <GirlClosed reason={access} onRetry={retry} moms={moms} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: girl.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  badge: { width: 56, height: 56, borderRadius: 28, backgroundColor: girl.blush, alignItems: 'center', justifyContent: 'center' },
  actions: { alignSelf: 'center', gap: 10, maxWidth: 420, width: '100%' },
});
