import { useLocalSearchParams } from 'expo-router';
import { t as tx } from '@/i18n';
import { NotFound } from '@/components/layout/NotFound';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Rail } from '@/components/cards/Blocks';
import { ConnectButton } from '@/components/cards/PeopleCards';
import { CommunityCard, SessionCard } from '@/components/cards/ThingCards';
import { EventRow } from '@/components/cards/EventCards';
import { PageHeader } from '@/components/navigation/Headers';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Cover } from '@/components/visual/Cover';
import { ACTIVITIES, AVAILABILITY, INTERESTS, USER_TYPES } from '@/data/catalog';
import { areaName, CITIES, DESTINATIONS } from '@/data/destinations';
import { findPerson, getCityContent } from '@/data/repo';
import { scoreMatch } from '@/features/matching/match';
import { enter } from '@/motion/enter';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function PersonProfile() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const person = findPerson(id);
  const profile = useStore((s) => s.profile);
  const lastIntent = useStore((s) => s.lastIntent);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  if (!person) return <NotFound title="This person is no longer on IRLY" />;

  const city = CITIES[person.cityId];
  const dest = DESTINATIONS[city.destinationId];
  const content = getCityContent(person.cityId);
  const match = scoreMatch(profile, person, lastIntent ?? 'friends', (a) => areaName(city, a));
  const sessions = content.sessions.filter((s) => s.goingIds.includes(person.id) || s.hostId === person.id);
  const events = content.events.filter((e) => e.goingIds.includes(person.id));
  const communities = content.communities.filter((c) => c.memberIds.includes(person.id));

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {/* Their cover is the thing they do most, in a real photo */}
        <Cover
          visual={{ photo: person.activities[0] ? ACTIVITIES[person.activities[0]].photo : city.photo }}
          light={city.light}
          height={insets.top + 210}
          scrollY={scrollY}
          scrim="top"
        />
        <View style={[styles.identity, { marginTop: -56 }]}>
          <Animated.View entering={enter.pop(0)} style={[styles.ring, { borderColor: t.c.bg, boxShadow: t.shadow.float }]}>
            <Avatar name={person.name} hue={person.hue} size={104} online={person.online} />
          </Animated.View>
          <Animated.View entering={enter.rise(1)} style={{ alignItems: 'center', gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text variant="displayL" raw>{person.name}</Text>
              <Text variant="titleM" tone="tertiary">
                {person.age}
              </Text>
            </View>
            <Text variant="body" tone="secondary">
              {areaName(city, person.areaId)} · {city.name} {city.destinationId === 'bali' ? '🌴' : dest.flag}
            </Text>
          </Animated.View>
          <Animated.View entering={enter.rise(2)} style={styles.badges}>
            {person.verified ? <Badge kind="verified" /> : null}
            {person.types.map((x) => (
              <Badge key={x} kind="accent" label={USER_TYPES[x].label} />
            ))}
          </Animated.View>
          <Animated.View entering={enter.rise(3)}>
            <Text variant="titleS" align="center">
              {person.headline}
            </Text>
            <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: 2 }}>
              From {person.origin} · {person.since}
            </Text>
          </Animated.View>
        </View>

        <Animated.View entering={enter.rise(4)} style={[styles.card, { backgroundColor: t.c.brandSoft, borderColor: t.c.brand }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="sparkles" size={16} color={t.c.brand} />
            <Text variant="label" tone="brand">
              {match.strength} · why you would get along
            </Text>
          </View>
          {match.reasons.map((r) => (
            <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.dot, { backgroundColor: t.c.brand }]} />
              <Text variant="body">{r}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={enter.rise(5)} style={styles.section}>
          <Text variant="overline" tone="tertiary">
            About
          </Text>
          <Text variant="bodyL" tone="secondary">
            {person.bio}
          </Text>
        </Animated.View>

        <Animated.View entering={enter.rise(6)} style={styles.section}>
          <Text variant="overline" tone="tertiary">
            Into
          </Text>
          <View style={styles.wrap}>
            {person.interests.map((i) => (
              <View key={i} style={[styles.tag, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
                <Icon name={INTERESTS[i].icon} size={14} color={t.c.textSecondary} />
                <Text variant="label">{INTERESTS[i].label}</Text>
              </View>
            ))}
            {person.activities.map((a) => (
              <View key={a} style={[styles.tag, { backgroundColor: t.light.accentSoft, borderColor: 'transparent' }]}>
                <Icon name={ACTIVITIES[a].icon} size={14} color={t.accent} />
                <Text variant="label" tone="accent">
                  {ACTIVITIES[a].label}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={enter.rise(7)} style={[styles.section, styles.facts]}>
          <Fact icon="clock" label={tx('Usually free')} value={person.availability.map((a) => tx(AVAILABILITY[a])).join(', ')} />
          <Fact icon="languages" label="Speaks" value={person.languages.map((l) => tx(l)).join(', ')} />
        </Animated.View>

        {sessions.length || events.length ? (
          <Animated.View entering={enter.rise(8)} style={styles.section}>
            <Text variant="overline" tone="tertiary">
              {person.name} is going to
            </Text>
            <View style={{ gap: 10 }}>
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
              {events.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </View>
          </Animated.View>
        ) : null}

        {communities.length ? (
          <View style={{ marginTop: space[6] }}>
            <Text variant="overline" tone="tertiary" style={{ paddingHorizontal: space.gutter, marginBottom: space[4] }}>
              Communities
            </Text>
            <Rail itemWidth={250}>
              {communities.map((c) => (
                <CommunityCard key={c.id} community={c} />
              ))}
            </Rail>
          </View>
        ) : null}
      </Animated.ScrollView>

      <PageHeader title={person.name} scrollY={scrollY} />
      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Glass style={styles.ctaGlass} intensity={60}>
          <ConnectButton person={person} size="lg" full />
        </Glass>
      </View>
    </View>
  );
}

function Fact({ icon, label, value }: { icon: 'clock' | 'languages'; label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.fact, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <Icon name={icon} size={18} color={t.c.textSecondary} />
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
      <Text variant="label">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  identity: { alignItems: 'center', gap: 12, paddingHorizontal: space.gutter, marginBottom: space[7] },
  ring: { borderRadius: 60, borderWidth: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  card: { marginHorizontal: space.gutter, padding: 16, gap: 10, borderRadius: radius.lg, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  section: { paddingHorizontal: space.gutter, marginTop: space[7], gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  facts: { flexDirection: 'row', gap: 10 },
  fact: { flex: 1, padding: 14, gap: 4, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  ctaGlass: { padding: 10, borderRadius: radius.xl },
});
