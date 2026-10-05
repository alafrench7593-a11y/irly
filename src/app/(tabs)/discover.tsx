import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Rail } from '@/components/cards/Blocks';
import { EventCard, EventRow } from '@/components/cards/EventCards';
import { PersonCard } from '@/components/cards/PeopleCards';
import { CommunityCard, PlaceCard, ServiceCard, SessionCard } from '@/components/cards/ThingCards';
import { useFrame } from '@/components/layout/AppFrame';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Field, SectionHeader } from '@/components/ui/Controls';
import { InboxButtons } from '@/components/navigation/Headers';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { ACTIVITIES, SERVICE_CATEGORIES } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import type { PhotoKey } from '@/data/photos';
import { getCityContent } from '@/data/repo';
import { scoreMatch } from '@/features/matching/match';
import { ServerResults } from '@/features/search/ServerResults';
import { isWeekend } from '@/lib/time';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CATEGORIES } from '@/data/catalog/categories';

type Door = { label: string; caption: string; icon: IconName; photo: PhotoKey; href: string };

export default function Discover() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const bottom = useTabBarSpace();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const profile = useStore((s) => s.profile);
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? '');
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  // Every catalog category is a door, then the hubs.
  const doors: Door[] = [
    ...CATEGORIES.map((c) => ({ label: c.label, caption: c.tagline, icon: c.icon, photo: c.photo, href: `/category/${c.id}` })),
    { label: 'Events', caption: `${content.events.length} this week`, icon: 'ticket', photo: content.events[0]?.visual.photo ?? 'dinner', href: '/events' },
    { label: 'Activities', caption: `${city.activityKinds.length} sports & more`, icon: 'activity', photo: ACTIVITIES[city.activityKinds[0]].photo ?? 'running', href: '/activities' },
    { label: 'Communities', caption: `${city.stats.communities} groups`, icon: 'users', photo: 'founders', href: '/communities' },
    { label: 'Services', caption: 'Curated & verified', icon: 'shield', photo: SERVICE_CATEGORIES[city.serviceCategories[0]].photo ?? 'apartment', href: '/services' },
    { label: 'Business', caption: 'Setup, visa, people', icon: 'briefcase', photo: 'meeting', href: '/business' },
    { label: 'Map', caption: 'Everything around you', icon: 'map', photo: city.photo, href: '/map' },
  ];
  const doorW = (frame.width - space.gutter * 2 - 12) / 2;

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return null;
    const has = (...fields: string[]) => fields.some((f) => f.toLowerCase().includes(term));
    return {
      events: content.events.filter((e) => has(e.title, e.venue, e.description, e.category)),
      sessions: content.sessions.filter((s) => has(s.title, s.venue, ACTIVITIES[s.kind].label)),
      places: content.places.filter((p) => has(p.name, p.blurb, ...p.tags)),
      communities: content.communities.filter((c) => has(c.name, c.tagline, c.description)),
      services: content.services.filter((s) => has(s.name, s.tagline, SERVICE_CATEGORIES[s.category].label)),
      people: content.people.filter((p) => has(p.name, p.headline, p.bio)),
    };
  }, [q, content]);

  const tonight = content.events.filter((e) => e.when.dayOffset === 0);
  const weekend = content.events.filter((e) => isWeekend(e.when, city));
  const total = results ? Object.values(results).reduce((n, list) => n + list.length, 0) : 0;

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + space[6], paddingBottom: bottom }}
      >
        <View style={[styles.head, styles.headRow]}>
          <View style={{ flex: 1 }}>
            <Text variant="overline" tone="accent">
              {city.name}
            </Text>
            <Text variant="displayL">Discover</Text>
          </View>
          <InboxButtons />
        </View>
        <View style={{ paddingHorizontal: space.gutter, marginBottom: space[7] }}>
          <Field
            icon="search"
            placeholder={`Search ${city.name}: padel, rooftop, visa…`}
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search"
            trailing={
              q ? (
                <PressableScale onPress={() => setQ('')} haptic="select" accessibilityLabel="Clear search">
                  <Icon name="x" size={18} color={t.c.textTertiary} />
                </PressableScale>
              ) : null
            }
          />
        </View>

        {!results ? (
          <View style={{ paddingHorizontal: space.gutter, marginBottom: space[7] }}>
            <PressableScale
              haptic="select"
              scaleTo={0.98}
              onPress={() => router.push('/match?intent=friends')}
              style={[styles.people, { backgroundColor: t.c.brand, boxShadow: t.shadow.card }]}
              accessibilityLabel="People: find who to do things with"
            >
              <View style={[styles.peopleIcon, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                <Icon name="users" size={20} color={t.c.onBrand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="titleS" color={t.c.onBrand}>
                  People
                </Text>
                <Text variant="bodyS" color={t.c.onBrand} style={{ opacity: 0.7 }}>
                  {content.people.length} people in {city.name} matched on interests, languages, plans
                </Text>
              </View>
              <Icon name="chevronRight" size={18} color={t.c.onBrand} />
            </PressableScale>
          </View>
        ) : null}

        {results ? (
          <View style={{ gap: space[7] }}>
            <ServerResults q={q} cityId={cityId} />
            <Text variant="bodyS" tone="secondary" style={{ paddingHorizontal: space.gutter }}>
              {total ? `${total} results for “${q.trim()}” in the city guide` : `Nothing in the city guide for “${q.trim()}”. Try “run”, “dinner” or “visa”.`}
            </Text>
            {results.events.length ? (
              <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
                <Text variant="overline" tone="tertiary">
                  Events
                </Text>
                {results.events.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </View>
            ) : null}
            {results.sessions.length ? (
              <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
                <Text variant="overline" tone="tertiary">
                  Activities
                </Text>
                {results.sessions.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </View>
            ) : null}
            {results.people.length ? (
              <View style={{ gap: 10 }}>
                <Text variant="overline" tone="tertiary" style={{ paddingHorizontal: space.gutter }}>
                  People
                </Text>
                <Rail itemWidth={290}>
                  {results.people.map((p) => (
                    <PersonCard key={p.id} width={290} match={scoreMatch(profile, p, 'friends', (id) => city.areas.find((a) => a.id === id)?.name ?? city.name)} />
                  ))}
                </Rail>
              </View>
            ) : null}
            {results.places.length ? (
              <View style={{ gap: 10 }}>
                <Text variant="overline" tone="tertiary" style={{ paddingHorizontal: space.gutter }}>
                  Places
                </Text>
                <Rail itemWidth={200}>
                  {results.places.map((p) => (
                    <PlaceCard key={p.id} place={p} width={200} />
                  ))}
                </Rail>
              </View>
            ) : null}
            {results.communities.length ? (
              <View style={{ gap: 10 }}>
                <Text variant="overline" tone="tertiary" style={{ paddingHorizontal: space.gutter }}>
                  Communities
                </Text>
                <Rail itemWidth={250}>
                  {results.communities.map((c) => (
                    <CommunityCard key={c.id} community={c} />
                  ))}
                </Rail>
              </View>
            ) : null}
            {results.services.length ? (
              <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
                <Text variant="overline" tone="tertiary">
                  Services
                </Text>
                {results.services.map((s) => (
                  <ServiceCard key={s.id} service={s} />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.doors}>
              {doors.map((d, i) => (
                <Animated.View key={d.label} entering={enter.rise(i, 40)}>
                  <PressableScale onPress={() => router.push(d.href as never)} style={{ width: doorW }} accessibilityLabel={d.label}>
                    <Photo visual={{ photo: d.photo }} light={city.light} scrim="strong" style={styles.door} width={500}>
                      <View style={styles.doorInner}>
                        <View style={[styles.doorIcon, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
                          <Icon name={d.icon} size={18} color="#FFFFFF" />
                        </View>
                        <View>
                          <Text variant="titleM" tone="onDark">
                            {d.label}
                          </Text>
                          <Text variant="caption" color="rgba(255,255,255,0.72)">
                            {d.caption}
                          </Text>
                        </View>
                      </View>
                    </Photo>
                  </PressableScale>
                </Animated.View>
              ))}
            </View>

            {tonight.length ? (
              <Animated.View entering={enter.rise(6)} style={styles.section}>
                <SectionHeader overline="Today" live title="Tonight" action="Events" onAction={() => router.push('/events')} />
                <Rail itemWidth={260}>
                  {tonight.map((e) => (
                    <EventCard key={e.id} event={e} width={260} height={320} />
                  ))}
                </Rail>
              </Animated.View>
            ) : null}

            {weekend.length ? (
              <Animated.View entering={enter.rise(7)} style={styles.section}>
                <SectionHeader overline="Plan ahead" title="This weekend" />
                <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
                  {weekend.slice(0, 3).map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </View>
              </Animated.View>
            ) : null}

            <Animated.View entering={enter.rise(8)} style={styles.section}>
              <SectionHeader overline="Neighbourhoods" title={`Around ${city.name}`} action="Map" onAction={() => router.push('/map')} />
              <View style={styles.areas}>
                {city.areas.map((a) => {
                  const n =
                    content.events.filter((e) => e.areaId === a.id).length +
                    content.sessions.filter((s) => s.areaId === a.id).length +
                    content.places.filter((p) => p.areaId === a.id).length;
                  return (
                    <PressableScale
                      key={a.id}
                      haptic="select"
                      scaleTo={0.95}
                      onPress={() => router.push(`/map?area=${a.id}`)}
                      style={[styles.area, { backgroundColor: t.c.surface, borderColor: t.c.line }]}
                    >
                      <Icon name="pin" size={14} color={t.accent} />
                      <Text variant="label">{a.name}</Text>
                      <Text variant="caption" tone="tertiary">
                        {n}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </Animated.View>

            <Animated.View entering={enter.rise(9)} style={styles.section}>
              <SectionHeader overline="Members love" title="IRLY picks" />
              <Rail itemWidth={210}>
                {content.places
                  .filter((p) => p.irlyPick)
                  .map((p) => (
                    <PlaceCard key={p.id} place={p} width={210} />
                  ))}
              </Rail>
            </Animated.View>
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  people: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24 },
  peopleIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1 },
  head: { paddingHorizontal: space.gutter, marginBottom: space[5], gap: 2 },
  doors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: space.gutter, marginBottom: space[9] },
  door: { height: 150, borderRadius: radius.lg },
  doorInner: { flex: 1, padding: 14, justifyContent: 'space-between' },
  doorIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: space[9] },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: space.gutter },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
