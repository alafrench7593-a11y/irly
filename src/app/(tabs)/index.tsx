import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { planDayLabel, upcomingPlans } from '@/features/plans/when';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyMark } from '@/brand/IrlyMark';
import { Rail } from '@/components/cards/Blocks';
import { EventCard } from '@/components/cards/EventCards';
import { Carousel, CategoryCard, fromEvent, fromSession, HighlightCard, IdeaCard, PersonBubble, type Happening } from '@/components/cards/HomeCards';
import { CommunityCard, PlaceCard } from '@/components/cards/ThingCards';
import { useFrame } from '@/components/layout/AppFrame';
import { HomeHeader } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { SectionHeader } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CATEGORIES, CATEGORY_BY_ID, ideaPhoto } from '@/data/catalog/categories';
import { openCreate } from '@/features/create/createStore';
import { CreateMenu } from '@/features/create/CreateMenu';
import { Photo } from '@/components/visual/Photo';
import { MemberActivities } from '@/features/server/MemberActivities';
import { planDisplay } from '@/data/catalog/mapping';
import { areaName, CITIES, DESTINATIONS } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import { DestinationSheet } from '@/features/destination/DestinationSheet';
import { momentFor } from '@/features/home/moment';
import { HomeHero } from '@/features/home/HomeHero';
import { GirlPortals } from '@/features/home/Portals';
import { LiveStrip } from '@/features/live/LiveStrip';
import { useLives } from '@/features/live/liveStore';
import { isHappeningNow } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { useIntro } from '@/features/intro/introStore';
import { ScrollReveal } from '@/motion/ScrollReveal';
import { spring } from '@/motion/tokens';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Home answers one question: "I just arrived. What can I do, and who can I
 * do it with?" It opens on the city itself (an immersive photo and the
 * question), then who is live, the one thing happening now, people, and a
 * rhythm of compositions (a big card, faces, rails, a grid of doors) so the
 * page never reads as a list of identical rows. What fits this moment of
 * the day leads; every category stays one tap away at the end.
 */
type Idea = { key: string; title: string; place?: string; subId: string; activityId?: string };

/** Food places for « Find someone to eat with ». */
const EAT_KINDS = new Set(['restaurant', 'cafe', 'rooftop', 'beachclub']);

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const bottom = useTabBarSpace();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const dest = DESTINATIONS[city.destinationId];
  const content = getCityContent(cityId);
  const profile = useStore((s) => s.profile);
  const myPlans = useStore((s) => s.myPlans).filter((p) => p.cityId === cityId);
  const upcoming = upcomingPlans(myPlans);
  const lives = useLives();
  const [sheet, setSheet] = useState(false);
  const now = useNow();
  const scrollY = useSharedValue(0);
  const heroH = Math.round(Math.min(560, Math.max(440, frame.height * 0.6)));

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  // What sits under the hero arrives just after the question, as the
  // curtain of the app lifts; everything further down rises on scroll.
  const introDone = useIntro((s) => s.done);
  const reduced = useReducedMotion();
  const arrive = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (introDone && !reduced) arrive.set(withDelay(520, withSpring(1, spring.soft)));
  }, [introDone, reduced, arrive]);
  const arriveStyle = useAnimatedStyle(() => ({ opacity: arrive.value, transform: [{ translateY: (1 - arrive.value) * 36 }] }));

  // Everything happening in the next days, soonest first.
  const happenings = useMemo<Happening[]>(() => {
    const list = [...content.sessions.map(fromSession), ...content.events.map(fromEvent)];
    return list.sort(
      (a, b) => a.item.when.dayOffset - b.item.when.dayOffset || a.item.when.time.localeCompare(b.item.when.time),
    );
  }, [content]);
  // The one big card: what is live right now, otherwise what comes next.
  const featured = useMemo(() => happenings.find((h) => isHappeningNow(h.item.when, city, now)) ?? happenings[0], [happenings, city, now]);
  const featuredLive = featured ? isHappeningNow(featured.item.when, city, now) : false;

  const moment = useMemo(() => momentFor(city, now, profile.interests), [city, now, profile.interests]);
  // Every category, in the order that fits this moment of the day for you.
  const sections = useMemo(() => {
    const order = [...moment.categories, ...CATEGORIES.map((c) => c.id).filter((id) => !moment.categories.includes(id))].filter((id) => CATEGORY_BY_ID[id]);
    return order.map((id) => {
      const category = CATEGORY_BY_ID[id];
      const items = happenings.filter((h) => h.group === id).slice(0, 6);
      const ideas = category.subs
        .flatMap<Idea>((sub) =>
          sub.activities?.length
            ? sub.activities.map((act) => ({ key: act.id, title: act.label, place: act.place, subId: sub.id, activityId: act.id }))
            : [{ key: sub.id, title: sub.label, place: undefined, subId: sub.id, activityId: undefined }],
        )
        .slice(0, items.length ? 3 : 6);
      return { category, items, ideas };
    });
  }, [happenings, moment]);
  // Three rails for this moment, then every other category as a door.
  const forYou = sections.slice(0, 3);
  const doors = sections.slice(3);
  const doorW = (frame.width - space.gutter * 2 - 12) / 2;

  const people = useMemo(
    () => [...content.people].sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online))).slice(0, 12),
    [content.people],
  );
  const eat = useMemo(() => content.places.filter((pl) => EAT_KINDS.has(pl.kind)), [content.places]);
  const girl = profile.gender === 'woman';

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Animated.ScrollView
        key={cityId}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom }}
      >
        <HomeHero
          city={city}
          now={now}
          height={heroH + insets.top}
          scrollY={scrollY}
          live={lives.length}
          onDestination={() => setSheet(true)}
          onLive={() => router.push('/live')}
        />

        <Animated.View style={[styles.firstSection, arriveStyle]}>
          <LiveStrip />
        </Animated.View>

        {featured ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader overline={featuredLive ? 'Live' : undefined} live={featuredLive} title={featuredLive ? 'Happening now' : 'Next up'} />
            <View style={styles.rows}>
              <HighlightCard h={featured} height={Math.round(Math.min(460, frame.width * 1.12))} />
            </View>
          </ScrollReveal>
        ) : null}

        <ScrollReveal scrollY={scrollY} style={styles.section}>
          <CreateMenu />
        </ScrollReveal>

        {cityId === 'bali' ? (
          <ScrollReveal scrollY={scrollY} style={[styles.section, { paddingHorizontal: space.gutter }]}>
            <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push('/bali')} accessibilityLabel="Live Bali">
              <Photo visual={{ photo: 'bali' }} light="bali" scrim="strong" style={{ height: 150, borderRadius: radius.xl, overflow: 'hidden' }} width={900}>
                <View style={{ flex: 1, padding: 16, justifyContent: 'flex-end', gap: 4 }}>
                  <Text variant="overline" color="#FFFFFF">
                    IRLY Bali
                  </Text>
                  <Text variant="titleL" color="#FFFFFF">
                    Live Bali. Don&apos;t just visit.
                  </Text>
                  <Text variant="caption" color="rgba(255,255,255,0.85)">
                    Where to live · My move · Test Bali · Where to eat
                  </Text>
                </View>
              </Photo>
            </PressableScale>
          </ScrollReveal>
        ) : null}

        {upcoming.length ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader title="Your sessions" action="All" onAction={() => router.push('/social')} />
            <View style={styles.rows}>
              {upcoming.slice(0, 3).map((p) => {
                const d = planDisplay(p);
                return (
                  <View key={p.id} style={[styles.mine, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
                    <View style={[styles.mineIcon, { backgroundColor: `${d.color}1F` }]}>
                      <Icon name={d.icon} size={18} color={d.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleS" numberOfLines={1}>
                        {d.title}
                      </Text>
                      <Text variant="bodyS" tone="secondary" numberOfLines={1}>
                        {tx(planDayLabel(p))} · {p.time} · {p.place ?? areaName(city, p.areaId)} · {p.spots ? tx('{n} spots', { n: p.spots }) : tx('Unlimited')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollReveal>
        ) : null}

        <ScrollReveal scrollY={scrollY} style={styles.section}>
          <SectionHeader title="People near you" action="See all" onAction={() => router.push('/match?intent=friends')} />
          <Carousel data={people} itemWidth={76} gap={10} keyOf={(p) => p.id} render={(p) => <PersonBubble person={p} city={city} />} />
        </ScrollReveal>

        {girl ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader overline="Women only · Not dating" title="Find your people" />
            <GirlPortals light={city.light} />
          </ScrollReveal>
        ) : null}

        <ScrollReveal scrollY={scrollY}>
          <MemberActivities cityId={cityId} />
        </ScrollReveal>

        <ScrollReveal scrollY={scrollY} style={styles.section}>
          <SectionHeader title="Activities near you" action="All" onAction={() => router.push('/social')} />
          <Rail itemWidth={260}>
            {happenings
              .filter((h) => h.id !== featured?.id)
              .slice(0, 8)
              .map((h) => (
                <View key={h.id} style={{ width: 260 }}>
                  <HighlightCard h={h} height={320} compact />
                </View>
              ))}
          </Rail>
        </ScrollReveal>

        {eat.length ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader overline="Restaurants & cafés" title="Find someone to eat with" action="All" onAction={() => router.push('/eat')} />
            <Rail itemWidth={220}>
              {eat.map((pl) => (
                <PlaceCard key={pl.id} place={pl} width={220} />
              ))}
            </Rail>
          </ScrollReveal>
        ) : null}

        <ScrollReveal scrollY={scrollY} style={styles.section}>
          <SectionHeader title="Events this week" action="See all" onAction={() => router.push('/events')} />
          <Rail itemWidth={236}>
            {content.events.slice(0, 8).map((e) => (
              <EventCard key={`ev-${e.id}`} event={e} width={236} height={320} />
            ))}
          </Rail>
        </ScrollReveal>

        <ScrollReveal scrollY={scrollY} style={styles.section}>
          <SectionHeader title="Communities near you" action="All" onAction={() => router.push('/communities')} />
          <Rail itemWidth={250}>
            {content.communities.map((c) => (
              <CommunityCard key={c.id} community={c} />
            ))}
          </Rail>
        </ScrollReveal>

        {forYou.map((sec, i) => (
          <ScrollReveal key={sec.category.id} scrollY={scrollY} style={styles.section}>
            <SectionHeader
              overline={i === 0 ? tx('For you · {when}', { when: moment.title }) : sec.category.tagline}
              title={sec.category.label}
              action="All"
              onAction={() => router.push(`/category/${sec.category.id}` as never)}
            />
            <Rail itemWidth={210}>
              {sec.items.map((h) => (
                <View key={h.id} style={{ width: 210 }}>
                  <HighlightCard h={h} height={260} compact />
                </View>
              ))}
              {sec.ideas.map((idea) => (
                <IdeaCard
                  key={idea.key}
                  title={idea.title}
                  place={idea.place}
                  color={sec.category.color}
                  icon={sec.category.icon}
                  photo={ideaPhoto(sec.category.id, idea.title, idea.place)}
                  onPress={() => openCreate(null, { categoryId: sec.category.id, subId: idea.subId, activityId: idea.activityId })}
                />
              ))}
            </Rail>
          </ScrollReveal>
        ))}

        {doors.length ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader overline="Everything to do" title="Find something to do" />
            <View style={styles.doors}>
              {doors.map((sec) => (
                <CategoryCard
                  key={sec.category.id}
                  label={sec.category.label}
                  tagline={sec.category.tagline}
                  icon={sec.category.icon}
                  color={sec.category.color}
                  photo={sec.category.photo}
                  count={sec.items.length || undefined}
                  width={doorW}
                  height={196}
                  onPress={() => router.push(`/category/${sec.category.id}` as never)}
                />
              ))}
            </View>
          </ScrollReveal>
        ) : null}

        <PressableScale haptic="select" scaleTo={0.98} onPress={() => setSheet(true)} style={styles.footer}>
          <IrlyMark size={30} state="static" ringColor={t.c.textTertiary} lensColor={t.c.text} glow={false} />
          <Text variant="bodyS" tone="tertiary" align="center">
            {tx('You are in {dest} · {city}.', { dest: tx(dest.name), city: city.name })}
            {'\n'}
            {tx('Tap to switch destination.')}
          </Text>
        </PressableScale>
      </Animated.ScrollView>

      <HomeHeader scrollY={scrollY} solidAt={heroH - layout.headerHeight} />
      <DestinationSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  firstSection: { marginTop: space[3] },
  section: { marginTop: space[9] },
  rows: { paddingHorizontal: space.gutter, gap: 10 },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  mineIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  doors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: space.gutter },
  footer: { alignItems: 'center', gap: 12, paddingVertical: space[8] },
});
