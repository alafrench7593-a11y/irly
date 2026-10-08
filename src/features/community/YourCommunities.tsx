import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Rail } from '@/components/cards/Blocks';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAccount } from '@/features/auth/account';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CITIES } from '@/data/destinations';
import { CommunityThumb } from './CommunityThumb';
import { useCommunityList } from './data';

/**
 * Home: the communities you are in (3 to 5, real member counts only), and
 * an always-visible way to discover IRLY Communities.
 */
export function YourCommunities({ cityId }: { cityId: string }) {
  const t = useTheme();
  const router = useRouter();
  const reduced = useReducedMotion();
  const signedIn = Boolean(useAccount());
  const mine = useCommunityList(cityId)
    .filter((c) => c.isMember)
    .sort((a, b) => Number(b.official) - Number(a.official) || b.postsWeek - a.postsWeek)
    .slice(0, 5);

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.head}>
        <Text variant="titleM">{mine.length ? 'Your communities' : 'Discover IRLY Communities'}</Text>
        {mine.length ? (
          <PressableScale haptic="select" onPress={() => router.push('/communities')} accessibilityRole="link" accessibilityLabel="All communities">
            <Text variant="label" tone="secondary">
              All
            </Text>
          </PressableScale>
        ) : null}
      </View>
      {mine.length ? (
        <Rail itemWidth={200}>
          {mine.map((c, i) => (
            <Animated.View key={c.id} entering={reduced ? undefined : FadeInDown.springify(520).dampingRatio(0.85).delay(i * 60)}>
              <PressableScale haptic="select" scaleTo={0.97} onPress={() => router.push(`/c/${c.id}`)} style={[styles.card, { backgroundColor: t.c.surface }]} accessibilityLabel={c.name}>
                <CommunityThumb topic={c.topic} categoryId={c.categoryId} emoji={c.emoji} light={CITIES[cityId as keyof typeof CITIES]?.light ?? 'dubai'} size={44} member />
                <Text variant="titleS" numberOfLines={1}>
                  {c.name}
                </Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {[c.members > 0 ? tx('{n} members', { n: c.members }) : null, c.postsWeek ? tx('{n} posts this week', { n: c.postsWeek }) : null].filter(Boolean).join(' · ') || ' '}
                </Text>
              </PressableScale>
            </Animated.View>
          ))}
        </Rail>
      ) : (
        <View style={[styles.cta, { backgroundColor: t.c.surface, marginHorizontal: space.gutter }]}>
          <Text variant="body" tone="secondary">
            You can join communities anytime to meet people who share your interests.
          </Text>
          <Button label="Explore communities" icon="compass" variant={signedIn ? 'primary' : 'secondary'} full onPress={() => router.push('/communities')} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter },
  card: { width: 200, padding: 14, borderRadius: radius.xl, gap: 8 },
  cta: { padding: 16, borderRadius: radius.xl, gap: 12 },
});
