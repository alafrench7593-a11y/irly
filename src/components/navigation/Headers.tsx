import { DEMO } from '@/config/app';
import { useServerUnread } from '@/features/server/chat';
import { usePathname, useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useAccount, useAuthStatus } from '@/features/auth/account';
import { useServerBell } from '@/features/server/social';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFrame } from '@/components/layout/AppFrame';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { IconButton } from '@/components/ui/Controls';
import { CITIES, DESTINATIONS } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { IrlyLogoCompact } from '@/brand/IrlyLogo';
import { GirlHeaderMark } from '@/features/girl/GirlMark';

export function useUnread(): number {
  const cityId = useCityId();
  const read = useStore((s) => s.read);
  const server = useServerUnread((s) => s.n);
  const account = useAccount();
  // Signed in: real unread messages; the on-device chats only exist in the demo build.
  const local = getCityContent(cityId).conversations.reduce((n, c) => n + (read[c.id] ? 0 : c.unread), 0);
  return (account ? server : 0) + local;
}

/**
 * Two looks for the same control, cross-faded by `solid` (0 = sitting on a
 * photo, white on dark glass; 1 = on the page, theme colours). One touch
 * target, so the press animation stays on what you see.
 */
function useCrossfade(solid?: SharedValue<number>) {
  const solidStyle = useAnimatedStyle(() => ({ opacity: solid ? solid.value : 1 }));
  const overStyle = useAnimatedStyle(() => ({ opacity: solid ? 1 - solid.value : 0 }));
  return { solidStyle, overStyle };
}

type PillProps = { onPress: () => void; onDark?: boolean; solid?: SharedValue<number> };

/** "Dubai ▾": the always-available door to another destination. */
export const DestinationPill = memo(function DestinationPill({ onPress, onDark, solid }: PillProps) {
  const t = useTheme();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const dest = DESTINATIONS[city.destinationId];
  const { solidStyle, overStyle } = useCrossfade(solid);
  const flag = city.destinationId === 'bali' ? '🌴' : dest.flag;
  const content = (fg: string) => (
    <>
      <Text style={{ fontSize: 14 }}>{flag}</Text>
      <Text variant="label" color={fg}>
        {city.name}
      </Text>
      <Icon name="chevronDown" size={15} color={fg} strokeWidth={2.4} />
    </>
  );
  if (!solid) {
    return (
      <PressableScale onPress={onPress} haptic="select" scaleTo={0.95} accessibilityLabel={tx('Destination: {city}. Change destination', { city: city.name })}>
        <Glass dark={onDark} style={styles.pill} intensity={40}>
          {content(onDark ? '#FFFFFF' : t.c.text)}
        </Glass>
      </PressableScale>
    );
  }
  return (
    <PressableScale onPress={onPress} haptic="select" scaleTo={0.95} accessibilityLabel={tx('Destination: {city}. Change destination', { city: city.name })}>
      <View style={styles.pillShell}>
        <Animated.View style={[StyleSheet.absoluteFill, solidStyle]}>
          <Glass style={[StyleSheet.absoluteFill, styles.round]} intensity={40} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, overStyle]}>
          <Glass dark style={[StyleSheet.absoluteFill, styles.round]} intensity={40} />
        </Animated.View>
        <Animated.View style={[styles.pill, solidStyle]}>{content(t.c.text)}</Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pill, overStyle]} pointerEvents="none">
          {content('#FFFFFF')}
        </Animated.View>
      </View>
    </PressableScale>
  );
});

type HomeHeaderProps = {
  scrollY: SharedValue<number>;
  /** Scroll offset where the header turns into glass. */
  solidAt?: number;
  /** Kept for older call sites. */
  onDestination?: () => void;
};

/**
 * Home header: your profile, the logo and Communities on the left; Messages, notifications and Settings on the right.
 * IRL lives in the centre of the tab bar. It sits
 * on the page and turns into glass as content scrolls under it.
 */
export function HomeHeader({ scrollY, solidAt = 24 }: HomeHeaderProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bg = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [solidAt - 24, solidAt], [0, 1], Extrapolation.CLAMP) }));
  return (
    <View style={[styles.header, { paddingTop: insets.top, height: insets.top + layout.headerHeight + 8 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, bg]} pointerEvents="none">
        <Glass style={StyleSheet.absoluteFill} border={false} intensity={60} />
        <View style={[styles.hairline, { backgroundColor: t.c.line }]} />
      </Animated.View>
      <View style={styles.row}>
        <View style={styles.lead}>
          <ProfileButton />
          <SpaceLogo />
          <CommunitiesButton />
        </View>
        <InboxButtons gap={4} />
      </View>
    </View>
  );
}

/**
 * Top left of every tab root, at the very edge: your profile (your face,
 * or your initials), lit while you are on it. The same door in both spaces.
 */
export function ProfileButton() {
  const t = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const name = useStore((s) => s.profile.name);
  const photo = useStore((s) => s.profile.photoUri);
  const account = useAccount();
  const narrow = useFrame().width < 420;
  const here = pathname === '/profile';
  const size = narrow ? 36 : 40;
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.92}
      hitSlop={6}
      onPress={() => {
        if (!here) router.push('/profile');
      }}
      accessibilityRole="button"
      accessibilityLabel={here ? tx('Profile, current section') : tx('Profile')}
      accessibilityState={here ? { selected: true } : undefined}
      style={[styles.profile, { width: size, height: size, borderRadius: size / 2, borderColor: here ? (t.flavor === 'girl' ? t.c.brand : t.c.text) : 'transparent' }]}
    >
      <Avatar name={name || tx('You')} hue={0} size={size - 6} photo={photo ?? undefined} userId={account?.userId} />
    </PressableScale>
  );
}

/**
 * Top left of Home: the logo of the space the app is in (IRLY, or IRLY
 * Girl), at the same place in both, right before the way into communities.
 */
export function SpaceLogo() {
  const t = useTheme();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={t.flavor === 'girl' ? 'IRLY Girl' : 'IRLY'} style={styles.logo}>
      {t.flavor === 'girl' ? <GirlHeaderMark size={14} /> : <IrlyLogoCompact size={15} color={t.c.text} />}
    </View>
  );
}

/** Top left of Home, next to the logo: the way into communities (the heart of IRLY). */
function CommunitiesButton() {
  const t = useTheme();
  const router = useRouter();
  // On phones up to 420 pt (profile and logo on the left, three doors on the right) the word keeps its room: the icon steps aside, never « Communi… ».
  // Below 360 pt there is no room for the word at all: a round door with the icon, like the others.
  const width = useFrame().width;
  const narrow = width < 420;
  // The IRLY Girl mark is wider than the IRLY one: at 375 pt in French the word lost its end (« Communa… »).
  const tiny = width < (t.flavor === 'girl' ? 400 : 360);
  if (tiny) {
    return (
      <PressableScale haptic="select" scaleTo={0.92} hitSlop={6} onPress={() => router.push('/communities')} accessibilityRole="button" accessibilityLabel={tx('Communities')} style={[styles.action, styles.actionNarrow]}>
        <GlassLayer radius={18} level="thin" />
        <Icon name="users" size={17} color={t.c.text} />
      </PressableScale>
    );
  }
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.95}
      onPress={() => router.push('/communities')}
      accessibilityRole="button"
      accessibilityLabel={tx('Communities')}
      style={[styles.communities, narrow ? styles.communitiesNarrow : null, { backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent' }]}
    >
      <GlassLayer radius={radius.pill} level="thin" />
      {narrow ? null : <Icon name="users" size={16} color={t.c.text} />}
      <Text variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1 }}>
        Communities
      </Text>
    </PressableScale>
  );
}

/** New notifications for the bell. Signed in: real notifications (the demo build shows its examples). */
export function useBell(): number {
  const account = useAccount();
  const auth = useAuthStatus();
  const serverBell = useServerBell((st) => st.n);
  return account ? serverBell : DEMO && auth === 'out' ? 2 : 0;
}

/** On Settings (/preferences, or its privacy page /settings). */
function onSettings(pathname: string): boolean {
  return pathname === '/settings' || pathname === '/preferences';
}

type HeaderActionProps = { icon: IconName; label: string; onPress: () => void; badge?: number; active?: boolean };

/**
 * One round door of the header group: a pane of thin glass with its light
 * edge (the Communities pill's glass), the icon in ink. Active: the pane
 * fills with ink (IRLY Girl: with her brand) and the icon turns to the page
 * colour, so you see where you are at a glance. Sinks under the finger,
 * stays still when the system asks to reduce motion.
 */
const HeaderAction = memo(function HeaderAction({ icon, label, onPress, badge, active }: HeaderActionProps) {
  const t = useTheme();
  const reduced = useReducedMotion();
  // On phones up to 420 pt: a little smaller, so the Communities pill keeps its word.
  const narrow = useFrame().width < 420;
  const girl = t.flavor === 'girl';
  const fill = girl ? t.c.brand : t.c.text;
  const onFill = girl ? t.c.onBrand : t.c.bg;
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      scaleTo={reduced ? 1 : 0.9}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active ? { selected: true } : undefined}
    >
      <View style={[styles.action, narrow ? styles.actionNarrow : null, active ? { backgroundColor: fill, borderColor: fill } : null]}>
        {active ? null : <GlassLayer radius={narrow ? 18 : 20} level="thin" />}
        <Icon name={icon} size={narrow ? 17 : 18} color={active ? onFill : t.c.text} strokeWidth={active ? 2.2 : 1.9} />
      </View>
      {badge ? (
        <View style={[styles.centered, styles.badge, { backgroundColor: t.c.live, borderColor: t.c.bg }]}>
          <Text variant="caption" color="#FFFFFF" style={{ fontSize: 10, lineHeight: 12 }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
});

/**
 * The doors every tab root keeps at the top right, in both spaces:
 * Messages (private chats, group chats, the community area), the bell and
 * Settings (the one Settings page, lit while you are in it). The assistant
 * is reached from Settings.
 */
export function InboxButtons({ gap = 8 }: { gap?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const unread = useUnread();
  const bell = useBell();
  const settings = onSettings(pathname);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      <HeaderAction icon="message" label={unread ? tx('Messages, {n} unread', { n: unread }) : tx('Messages')} badge={unread} onPress={() => router.push('/messages')} />
      <HeaderAction icon="bell" label={bell ? tx('Notifications, {n} new', { n: bell }) : tx('Notifications')} badge={bell} onPress={() => router.push('/notifications')} />
      <HeaderAction
        icon="settings"
        label={settings ? tx('Settings, current section') : tx('Settings')}
        active={settings}
        onPress={() => {
          if (pathname !== '/preferences') router.push('/preferences' as never);
        }}
      />
    </View>
  );
}

type PageHeaderProps = {
  title: string;
  scrollY?: SharedValue<number>;
  right?: ReactNode;
  /** Header sits on a photo: white controls until the page scrolls. */
  overImage?: boolean;
  /** Tab roots have no back button: your profile sits there instead. */
  back?: boolean;
  /** Replaces the default back (e.g. to ask before leaving a draft). */
  onBack?: () => void;
};

/** Stack page header: back button, title that appears once the large title scrolls away. */
export function PageHeader({ title, scrollY, right, back = true, onBack }: PageHeaderProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bg = useAnimatedStyle(() => ({
    opacity: scrollY ? interpolate(scrollY.value, [10, 70], [0, 1], Extrapolation.CLAMP) : 1,
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: scrollY ? interpolate(scrollY.value, [40, 90], [0, 1], Extrapolation.CLAMP) : 1,
    transform: [{ translateY: scrollY ? interpolate(scrollY.value, [40, 90], [8, 0], Extrapolation.CLAMP) : 0 }],
  }));
  return (
    <View style={[styles.header, { paddingTop: insets.top, height: insets.top + layout.headerHeight + 8 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, bg]} pointerEvents="none">
        <Glass style={StyleSheet.absoluteFill} border={false} intensity={60} />
        <View style={[styles.hairline, { backgroundColor: t.c.line }]} />
      </Animated.View>
      <View style={styles.row}>
        {back ? (
          <IconButton
            icon="chevronLeft"
            label="Back"
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
          />
        ) : (
          <ProfileButton />
        )}
        <Animated.View style={[styles.title, titleStyle]} pointerEvents="none">
          <Text variant="titleS" numberOfLines={1}>
            {title}
          </Text>
        </Animated.View>
        <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  communities: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, flexShrink: 1, minWidth: 0, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  communitiesNarrow: { paddingHorizontal: 9 },
  profile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, flexShrink: 0 },
  lead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0, marginRight: 4 },
  // The logo never shrinks: the Communities pill gives way first.
  logo: { height: 38, justifyContent: 'center', flexShrink: 0 },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  pillShell: { borderRadius: radius.pill },
  round: { borderRadius: radius.pill },
  action: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'transparent' },
  actionNarrow: { width: 36, height: 36, borderRadius: 18 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
  },
  title: { position: 'absolute', left: 80, right: 80, alignItems: 'center' },
});
