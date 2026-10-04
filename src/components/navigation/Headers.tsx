import { useRouter } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyWordmark } from '@/brand/IrlyLogo';
import { useLiveCount } from '@/features/live/liveStore';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { IconButton, LiveDot } from '@/components/ui/Controls';
import { CITIES, DESTINATIONS } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function useUnread(): number {
  const cityId = useCityId();
  const read = useStore((s) => s.read);
  return getCityContent(cityId).conversations.reduce((n, c) => n + (read[c.id] ? 0 : c.unread), 0);
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
      <PressableScale onPress={onPress} haptic="select" scaleTo={0.95} accessibilityLabel={`Destination: ${city.name}. Change destination`}>
        <Glass dark={onDark} style={styles.pill} intensity={40}>
          {content(onDark ? '#FFFFFF' : t.c.text)}
        </Glass>
      </PressableScale>
    );
  }
  return (
    <PressableScale onPress={onPress} haptic="select" scaleTo={0.95} accessibilityLabel={`Destination: ${city.name}. Change destination`}>
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
 * Home header: IRLY on the left, IRL (everything posted live, right now)
 * in the centre, Discover (search) and notifications on the right. It sits
 * on the page and turns into glass as content scrolls under it.
 */
export function HomeHeader({ scrollY, solidAt = 24 }: HomeHeaderProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lives = useLiveCount();
  const bg = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [solidAt - 24, solidAt], [0, 1], Extrapolation.CLAMP) }));
  return (
    <View style={[styles.header, { paddingTop: insets.top, height: insets.top + layout.headerHeight + 8 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, bg]} pointerEvents="none">
        <Glass style={StyleSheet.absoluteFill} border={false} intensity={60} />
        <View style={[styles.hairline, { backgroundColor: t.c.line }]} />
      </Animated.View>
      <View style={styles.row}>
        <IrlyWordmark size={24} />
        <View style={styles.irlWrap} pointerEvents="box-none">
        <PressableScale
          onPress={() => router.push('/live')}
          haptic="select"
          scaleTo={0.94}
          accessibilityLabel={`IRL: ${lives} posted live around you`}
        >
          <View style={[styles.irl, { backgroundColor: t.c.brand }]}>
            <LiveDot size={7} color={t.c.live} />
            <Text variant="label" color={t.c.onBrand} style={{ letterSpacing: 1 }}>
              IRL
            </Text>
            {lives ? (
              <Text variant="caption" color="rgba(255,255,255,0.7)">
                {lives}
              </Text>
            ) : null}
          </View>
        </PressableScale>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton icon="search" label="Discover" onPress={() => router.push('/discover')} />
          <IconButton icon="bell" label="Notifications" badge={2} onPress={() => router.push('/notifications')} />
        </View>
      </View>
    </View>
  );
}

type PageHeaderProps = {
  title: string;
  scrollY?: SharedValue<number>;
  right?: ReactNode;
  /** Header sits on a photo: white controls until the page scrolls. */
  overImage?: boolean;
  /** Tab roots have no back button. */
  back?: boolean;
};

/** Stack page header: back button, title that appears once the large title scrolls away. */
export function PageHeader({ title, scrollY, right, back = true }: PageHeaderProps) {
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
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        ) : (
          <View style={{ width: 40 }} />
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
  headerButton: { width: 40, height: 40, borderRadius: 20 },
  headerButtonBg: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth * 2 },
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
  irlWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  irl: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: radius.pill },
});
