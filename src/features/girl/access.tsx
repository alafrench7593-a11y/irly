import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useAccount } from '@/features/auth/account';
import { useRefreshOn } from '@/features/server/sync';
import { t as tx } from '@/i18n';
import { hasSession, supabase } from '@/lib/supabase';
import { DEMO } from '@/config/app';
import { useStore } from '@/state/store';
import { space } from '@/theme/tokens';
import { girl, girlType } from './theme';
import { GButton } from './ui';

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
export const ACCESS_LIMIT = 25_000;

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

/**
 * The member's access, checked when the screen opens, each time it comes
 * back into focus, when the account changes, and when the app returns from
 * the background. A refused re-check closes the screen right away (an
 * access withdrawn mid-session); a failed re-check keeps what already works.
 */
export function useGirlAccess(): { access: GirlAccess; retry: () => void } {
  const uid = useAccount()?.userId ?? null;
  const gender = useStore((s) => s.profile.gender);
  const [access, setAccess] = useState<GirlAccess>('checking');
  const known = useRef<{ uid: string | null; ok: boolean }>({ uid, ok: false });
  const seq = useRef(0);

  const check = useCallback(() => {
    // Another account (or signed out meanwhile): nothing known about it yet.
    if (known.current.uid !== uid) known.current = { uid, ok: false };
    if (!known.current.ok) setAccess('checking');
    const n = ++seq.current;
    withLimit(readGirlAccess(), ACCESS_LIMIT)
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

  const retry = useCallback(() => {
    known.current.ok = false;
    check();
  }, [check]);
  return { access, retry };
}

/** The IRLY Girl waiting screen: words with the spinner, never a bare one. */
export function GirlLoading({ label = 'Opening your space…' }: { label?: string }) {
  return (
    <View style={[styles.root, styles.center, { gap: 14, padding: space.gutter }]} accessibilityLabel={tx('Loading')}>
      <ActivityIndicator color={girl.rose} />
      <Text variant="titleM" color={girl.ink} align="center" style={girlType.section}>
        IRLY Girl
      </Text>
      <Text variant="body" color={girl.inkSoft} align="center">
        {label}
      </Text>
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
      <View style={styles.badge}>
        <Icon name={c.icon} size={26} color={girl.rose} />
      </View>
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
