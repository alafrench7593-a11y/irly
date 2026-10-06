import { useLocalSearchParams, useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Rail } from '@/components/cards/Blocks';
import { Carousel, fromEvent, fromSession, HappeningRow, PersonBubble } from '@/components/cards/HomeCards';
import { CommunityCard } from '@/components/cards/ThingCards';
import { Button } from '@/components/ui/Button';
import { Chip, IconButton, SectionHeader } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { CATEGORY_BY_ID, GIRL_CATEGORY, ideaPhoto, type CatalogSub, type CategoryKey } from '@/data/catalog/categories';
import { INTEREST_CATEGORY, planDisplay, SESSION_CATEGORY } from '@/data/catalog/mapping';
import { areaName, CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import { openCreate } from '@/features/create/createStore';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { useCityId, useStore } from '@/state/store';
import { useServerActivities } from '@/features/server/activities';
import { useAccount } from '@/features/auth/account';
import { useCommunityList } from '@/features/community/data';
import { cityWhen } from '@/lib/time';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const HERO = 320;

/**
 * A category, answered as "who can I do this with?": its subcategories,
 * the things to do (real places), the sessions already planned, the people
 * into it and the communities around it. Anything here becomes a session in
 * one tap.
 */
export default function CategoryScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const gender = useStore((s) => s.profile.gender);
  const myPlans = useStore((s) => s.myPlans);
  const isGirl = id === 'girl';
  const uid = useAccount()?.userId;
  const category = isGirl ? GIRL_CATEGORY : CATEGORY_BY_ID[id as CategoryKey];
  const [sub, setSub] = useState<CatalogSub | null>(null);

  const sessions = useMemo(() => {
    if (!category || isGirl) return [];
    const list = [
      ...content.sessions.filter((s) => SESSION_CATEGORY[s.kind] === category.id && (!sub || sub.id === s.kind)).map(fromSession),
      ...content.events.map(fromEvent).filter((h) => h.group === category.id && !sub),
    ];
    return list.sort((a, b) => a.item.when.dayOffset - b.item.when.dayOffset);
  }, [category, content, sub, isGirl]);

  // Activities members created on the server (yours included), in this category.
  const { activities: serverAll } = useServerActivities(cityId);
  const server = useMemo(
    () => (category && !isGirl ? serverAll.filter((a) => a.categoryId === category.id && (!sub || a.subId === sub.id)) : []),
    [serverAll, category, sub, isGirl],
  );
  // Plans on this phone, minus those already listed from the server.
  const mine = myPlans.filter(
    (p) => p.cityId === cityId && planDisplay(p).categoryId === category?.id && (!sub || p.subId === sub.id) && !(p.serverId && server.some((a) => a.id === p.serverId)),
  );
  const serverCommunities = useCommunityList(cityId);
  const myCommunities = useMemo(() => (category && !isGirl ? serverCommunities.filter((c) => c.categoryId === category.id) : []), [serverCommunities, category, isGirl]);

  const people = useMemo(() => {
    if (!category) return [];
    return content.people.filter((p) =>
      isGirl
        ? true
        : sub
          ? p.activities.some((k) => k === sub.id)
          : p.activities.some((k) => SESSION_CATEGORY[k] === category.id) || p.interests.some((i) => INTEREST_CATEGORY[i] === category.id),
    );
  }, [category, content, sub, isGirl]);

  const communities = useMemo(
    () => (category ? content.communities.filter((c) => c.interests.some((i) => INTEREST_CATEGORY[i] === category.id)) : []),
    [category, content],
  );

  // Unknown id (old link): say so, with a way back, instead of a blank screen.
  if (!category) {
    return (
      <View style={[styles.root, styles.gate, { paddingTop: insets.top + 40 }]}>
        <Text variant="titleM">This category no longer exists</Text>
        <Button label="Back" icon="chevronLeft" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    );
  }

  if (isGirl && gender !== 'woman') {
    return (
      <View style={[styles.root, styles.gate, { backgroundColor: '#FBF6F1', paddingTop: insets.top + 40 }]}>
        <Icon name="lock" size={28} color="#3A2A2A" />
        <Text variant="displayM" align="center" color="#3A2A2A">
          IRLY Girl is reserved for women
        </Text>
        <Text variant="body" align="center" color="#8A7470">
          A space where women meet other women: brunches, padel, travel, wellness.
        </Text>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const create = (subId?: string, activityId?: string) => {
    if (isGirl) openCreate();
    else openCreate(null, { categoryId: category.id as CategoryKey, subId, activityId });
  };

  const bg = isGirl ? '#FBF6F1' : t.c.bg;
  const ink = isGirl ? '#3A2A2A' : t.c.text;

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <Photo visual={{ photo: category.photo }} light={city.light} scrim="strong" style={[styles.hero, { height: HERO + insets.top }]} width={1000}>
          <Animated.View entering={enter.rise(0, 60)} style={styles.heroText}>
            <View style={[styles.bar, { backgroundColor: category.color }]} />
            <Text variant="displayXL" tone="onDark">
              {category.label}
            </Text>
            <Text variant="bodyL" color="rgba(255,255,255,0.85)">
              {category.tagline}
            </Text>
          </Animated.View>
        </Photo>

        <Animated.View entering={enter.rise(1, 60)} style={styles.chips}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
            <Chip size="sm" label="All" selected={!sub} onPress={() => setSub(null)} />
            {category.subs.map((x) => (
              <Chip key={x.id} size="sm" label={x.label} dot={category.color} selected={sub?.id === x.id} onPress={() => setSub(x)} />
            ))}
          </ScrollView>
        </Animated.View>

        {sub?.activities?.length ? (
          <Animated.View key={sub.id} entering={FadeIn.duration(260)} style={styles.section}>
            <SectionHeader overline={sub.label} title="Things to do" />
            <View style={styles.rows}>
              {sub.activities.map((act) => (
                <View key={act.id} style={[styles.activity, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]}>
                  <Photo visual={{ photo: ideaPhoto(category.id as CategoryKey, act.label, act.place) }} light={city.light} style={styles.thumb} width={200} recyclingKey={`act-${act.id}`} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="titleS" color={ink}>
                      {act.label}
                    </Text>
                    {act.place ? (
                      <Text variant="bodyS" tone="secondary">
                        {act.place}
                      </Text>
                    ) : null}
                    {act.note ? (
                      <Text variant="caption" tone="tertiary" numberOfLines={2}>
                        {act.note}
                      </Text>
                    ) : null}
                  </View>
                  <Button label="Create" icon="plus" size="sm" onPress={() => create(sub.id, act.id)} />
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={enter.rise(2, 60)} style={styles.section}>
          <SectionHeader title={sub ? tx('{what} sessions', { what: tx(sub.label) }) : tx('Sessions')} action={sessions.length + mine.length + server.length ? `${sessions.length + mine.length + server.length}` : undefined} />
          <View style={styles.rows}>
            {mine.map((p) => (
              <View key={p.id} style={[styles.activity, { backgroundColor: t.c.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="overline" tone="secondary">
                    Your session
                  </Text>
                  <Text variant="titleS">{planDisplay(p).title}</Text>
                  <Text variant="bodyS" tone="secondary">
                    {p.day} · {p.time} · {p.place ?? areaName(city, p.areaId)}
                  </Text>
                </View>
              </View>
            ))}
            {server.map((a) => (
              <PressableScale key={a.id} haptic="select" scaleTo={0.98} onPress={() => router.push(`/a/${a.id}`)} style={[styles.activity, { backgroundColor: t.c.surface }]} accessibilityLabel={a.title}>
                <View style={{ flex: 1 }}>
                  <Text variant="overline" tone="secondary">
                    {a.creatorId === uid ? 'Your session' : 'Planned by a member'}
                  </Text>
                  <Text variant="titleS" raw>
                    {a.title}
                  </Text>
                  <Text variant="bodyS" tone="secondary">
                    {[cityWhen(a.startsAt, cityId), a.placeName ?? areaName(city, a.areaId), tx('{n} going', { n: a.going })].join(' · ')}
                  </Text>
                </View>
                <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
              </PressableScale>
            ))}
            {sessions.map((h, i) => (
              <Animated.View key={h.id} entering={enter.rise(i)} layout={LinearTransition.springify(spring.medium.duration)}>
                <HappeningRow h={h} />
              </Animated.View>
            ))}
            {sessions.length + mine.length + server.length === 0 ? (
              <PressableScale
                haptic="select"
                scaleTo={0.98}
                onPress={() => create(sub?.id)}
                style={[styles.empty, { borderColor: t.c.lineStrong, backgroundColor: t.c.surface }]}
                accessibilityLabel="Create the first session"
              >
                <Icon name="plus" size={20} color={ink} />
                <View style={{ flex: 1 }}>
                  <Text variant="titleS" color={ink}>
                    {tx('No {what} activity yet', { what: tx(sub ? sub.label : category.label).toLowerCase() })}
                  </Text>
                  <Text variant="bodyS" tone="secondary">
                    Create the first one. People into it nearby will see it.
                  </Text>
                </View>
              </PressableScale>
            ) : null}
          </View>
        </Animated.View>

        {people.length ? (
          <Animated.View entering={enter.rise(3, 60)} style={styles.section}>
            <SectionHeader title={tx('{n} people into {what}', { n: people.length, what: tx(sub ? sub.label : category.label).toLowerCase() })} action="See all" onAction={() => router.push('/match?intent=activities')} />
            <Carousel data={people} itemWidth={76} gap={10} keyOf={(p) => p.id} render={(p) => <PersonBubble person={p} city={city} />} />
          </Animated.View>
        ) : null}

        <Animated.View entering={enter.rise(4, 60)} style={styles.section}>
          <SectionHeader title="Communities" />
          {communities.length ? (
            <Rail itemWidth={250}>
              {communities.map((c) => (
                <CommunityCard key={c.id} community={c} />
              ))}
            </Rail>
          ) : null}
          {myCommunities.length ? (
            <View style={[styles.rows, { marginTop: communities.length ? space[4] : 0 }]}>
              {myCommunities.map((c) => (
                <PressableScale key={c.id} haptic="select" scaleTo={0.98} onPress={() => router.push(`/c/${c.id}`)} style={[styles.activity, { backgroundColor: t.c.surface }]} accessibilityLabel={c.name}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleS" raw>
                      {c.name}
                    </Text>
                    <Text variant="bodyS" tone="secondary">
                      {[c.tagline, tx('{n} members', { n: c.members }), c.isMember ? tx('Member') : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
                </PressableScale>
              ))}
            </View>
          ) : null}
          <View style={[styles.rows, { marginTop: communities.length || myCommunities.length ? space[4] : 0 }]}>
            <PressableScale
              haptic="select"
              scaleTo={0.98}
              onPress={() => router.push('/community/new')}
              style={[styles.empty, { borderColor: t.c.lineStrong, backgroundColor: t.c.surface }]}
              accessibilityLabel="Create a community"
            >
              <Icon name="users" size={20} color={ink} />
              <View style={{ flex: 1 }}>
                <Text variant="titleS" color={ink}>
                  {tx('Create a {what} community', { what: tx(sub ? sub.label : category.label).toLowerCase() })}
                </Text>
                <Text variant="bodyS" tone="secondary">
                  {tx('{city} · {what}: activities, chat, members.', { city: city.name, what: tx(sub ? sub.label : category.label) })}
                </Text>
              </View>
            </PressableScale>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton icon="chevronLeft" label="Back" variant="glass" onPress={() => router.back()} />
      </View>
      <View style={[styles.cta, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <Button label={sub ? tx('Create a {what} session', { what: tx(sub.label) }) : tx('Create session')} icon="plus" haptic="press" onPress={() => create(sub?.id)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gate: { alignItems: 'center', gap: 16, paddingHorizontal: space.gutter + 8 },
  hero: { justifyContent: 'flex-end', borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl },
  heroText: { padding: space.gutter, paddingBottom: space[7], gap: 6 },
  bar: { width: 32, height: 4, borderRadius: 2, marginBottom: 6 },
  chips: { marginTop: space[6] },
  section: { marginTop: space[8] },
  rows: { paddingHorizontal: space.gutter, gap: 10 },
  thumb: { width: 64, height: 64, borderRadius: radius.lg, overflow: 'hidden' },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.xl },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.xl, borderWidth: 1, borderStyle: 'dashed' },
  topBar: { position: 'absolute', left: space.gutter },
  cta: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
