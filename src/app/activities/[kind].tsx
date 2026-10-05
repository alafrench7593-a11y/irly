import { useLocalSearchParams } from 'expo-router';
import { t as tx } from '@/i18n';
import { openCreate } from '@/features/create/createStore';
import { SESSION_CATEGORY } from '@/data/catalog/mapping';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Rail } from '@/components/cards/Blocks';
import { PersonCard } from '@/components/cards/PeopleCards';
import { CommunityCard, SessionCard } from '@/components/cards/ThingCards';
import { PageHeader } from '@/components/navigation/Headers';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { ACTIVITIES } from '@/data/catalog';
import { areaName, CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import type { ActivityKind } from '@/data/types';
import { rankMatches } from '@/features/matching/match';
import { enter } from '@/motion/enter';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const HERO = 300;

export default function ActivityKindScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { kind } = useLocalSearchParams<{ kind: ActivityKind }>();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const profile = useStore((s) => s.profile);
  const a = ACTIVITIES[kind] ?? ACTIVITIES.running;
  const sessions = content.sessions.filter((s) => s.kind === kind);
  const players = rankMatches(
    { ...profile, activities: [...profile.activities, kind] },
    content.people.filter((p) => p.activities.includes(kind)),
    'sports',
    (id) => areaName(city, id),
  );
  const communities = content.communities.filter((c) => c.kind === 'sport' || c.interests.includes('sports')).slice(0, 4);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: scrollY.value > 0 ? scrollY.value * 0.45 : scrollY.value / 2 },
      { scale: scrollY.value < 0 ? 1 + -scrollY.value / HERO : 1 },
    ],
    opacity: interpolate(scrollY.value, [0, HERO], [1, 0.4], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <Animated.View style={[{ height: HERO + insets.top }, heroStyle]}>
          <Photo visual={{ photo: a.photo }} light={city.light} scrim="strong" width={1200} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(0,0,0,0)', t.c.bg]} locations={[0.6, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={[styles.head, { marginTop: -110 }]}>
          <View style={[styles.icon, { backgroundColor: t.c.brand }]}>
            <Icon name={a.icon} size={22} color={t.c.onBrand} />
          </View>
          <Text variant="displayXL">{a.label}</Text>
          <Text variant="body" tone="secondary">
            {sessions.length ? tx('{n} sessions this week in {city}', { n: sessions.length, city: city.name }) : tx('Be the first to start a {what} plan in {city}.', { what: tx(a.label).toLowerCase(), city: city.name })}
          </Text>
        </View>

        <View style={{ paddingHorizontal: space.gutter, gap: 10, marginBottom: space[9] }}>
          {sessions.map((s, i) => (
            <Animated.View key={s.id} entering={enter.rise(i, 80)}>
              <SessionCard session={s} />
            </Animated.View>
          ))}
        </View>

        {players.length ? (
          <View style={{ marginBottom: space[9] }}>
            <SectionHeader overline="Smart matching" title={tx('Play {what} with', { what: tx(a.label).toLowerCase() })} />
            <Rail itemWidth={290}>
              {players.map((m) => (
                <PersonCard key={m.person.id} match={m} width={290} />
              ))}
            </Rail>
          </View>
        ) : null}

        {communities.length ? (
          <View>
            <SectionHeader title="Communities" />
            <Rail itemWidth={250}>
              {communities.map((c) => (
                <CommunityCard key={c.id} community={c} />
              ))}
            </Rail>
          </View>
        ) : null}
      </Animated.ScrollView>

      <PageHeader title={a.label} scrollY={scrollY} />
      <View style={[styles.cta, { bottom: insets.bottom + 16 }]}>
        <Button
          label={tx('Start a {what} plan', { what: tx(a.label).toLowerCase() })}
          icon="plus"
          onPress={() => openCreate(null, { categoryId: SESSION_CATEGORY[kind] ?? 'sport', activityId: ACTIVITIES[kind] ? kind : undefined })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: space.gutter, gap: 6, marginBottom: space[7] },
  icon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  cta: { position: 'absolute', alignSelf: 'center' },
});
