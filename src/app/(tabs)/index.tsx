import { useLocalSearchParams, useRouter } from 'expo-router';
import { YourCommunities } from '@/features/community/YourCommunities';
import { useAccount } from '@/features/auth/account';
import { t as tx } from '@/i18n';
import { planDayLabel, upcomingPlans } from '@/features/plans/when';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyMark } from '@/brand/IrlyMark';
import { Rail } from '@/components/cards/Blocks';
import { EventCard } from '@/components/cards/EventCards';
import { ActivityTile, Carousel, fromEvent, fromSession, HighlightCard, IdeaCard, PersonBubble, type Happening } from '@/components/cards/HomeCards';
import { CommunityCard, PlaceCard } from '@/components/cards/ThingCards';
import { useFrame } from '@/components/layout/AppFrame';
import { HomeHeader } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Chip, SectionHeader } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CATEGORIES, CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
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
import { HomeBackdrop } from '@/features/home/HomeBackdrop';
import { GirlPortals } from '@/features/home/Portals';
import { ExploreDoors } from '@/features/home/Explore';
import { ActivitiesByCategory, DiscoverCategories } from '@/features/home/ActivitiesByCategory';
import { RecapDoor, TodayStrip } from '@/features/engage/EngageUI';
import { LiveStrip } from '@/features/live/LiveStrip';
import { useLives } from '@/features/live/liveStore';
import { isHappeningNow } from '@/lib/time';
import { FEATURES } from '@/lib/features';
import { useNow } from '@/lib/useNow';
import { useIntro } from '@/features/intro/introStore';
import { ScrollReveal } from '@/motion/ScrollReveal';
import { enter } from '@/motion/enter';
import { spring } from '@/motion/tokens';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { useAppSpace } from '@/state/appSpace';
import { GirlCommunities, useGirlPeople } from '@/features/girl/GirlSections';
import { GirlIntro } from '@/features/girl/GirlIntro';
import { HOME_SECTIONS, type HomeSection } from '@/features/home/sections';

/**
 * Home answers one question: "I just arrived. What can I do, and who can I
 * do it with?" It opens on the city itself (an immersive photo and the
 * question), then who is live, the one thing happening now, people, and a
 * rhythm of compositions (a big card, faces, rails, a grid of doors) so the
 * page never reads as a list of identical rows. What fits this moment of
 * the day leads; every category stays one tap away at the end.
 */
type Idea = { key: string; title: string; place?: string; subId: string; activityId?: string };

/**
 * In IRLY Girl (state/appSpace) this is the same Home: the same sections
 * (features/home/sections, HOME_SECTIONS), in the same order, with the same
 * components, in the Girl look. Only the data differs: women instead of
 * everyone, IRLY Girl communities, the events open to everyone (the guide's
 * sessions do not say who they are for; the girls' plans arrive through
 * « Planned by members », scoped by the server). Its own corners sit in
 * IRLY's slots: the IRLY Girl doors become the way back to IRLY and IRLY
 * Moms (Discover › People), the Bali card opens « Girls moving to Bali »,
 * IRLY Match is « See all » on the women near you and Discover's « Find
 * someone ».
 */

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
  // Plans the server has are listed from the server (one copy, live); these are the phone-only ones.
  const myPlans = useStore((s) => s.myPlans).filter((p) => p.cityId === cityId && !p.serverId);
  const upcoming = upcomingPlans(myPlans);
  const lives = useLives();
  const [sheet, setSheet] = useState(false);
  const now = useNow();
  const scrollY = useSharedValue(0);
  // Signed in and never shown IRLY Community: once, whatever the way in (Google, email, later).
  const account = useAccount();
  const communityIntroSeen = useStore((s) => s.communityIntroSeen);
  useEffect(() => {
    if (account && !communityIntroSeen) router.push('/onboarding/communities');
  }, [account, communityIntroSeen, router]);
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
  // IRLY Girl: the events (open to everyone); the guide's sessions are not scoped to women.
  const inGirl = useAppSpace() === 'girl';
  const happenings = useMemo<Happening[]>(() => {
    const list = [...(inGirl ? [] : content.sessions.map(fromSession)), ...content.events.map(fromEvent)];
    return list.sort(
      (a, b) => a.item.when.dayOffset - b.item.when.dayOffset || a.item.when.time.localeCompare(b.item.when.time),
    );
  }, [content, inGirl]);
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
  // Three rails for this moment (every category stays one tap away in « Activities by category »).
  const forYou = sections.slice(0, 3);
  const doorW = (frame.width - space.gutter * 2 - 12) / 2;

  // The grid of plans near you, filtered by the category chips.
  const [filter, setFilter] = useState<CategoryKey | null>(null);
  const nearby = useMemo(() => happenings.filter((h) => h.id !== featured?.id), [happenings, featured]);
  const groups = useMemo(() => [...new Set(nearby.map((h) => h.group))].filter((id) => CATEGORY_BY_ID[id]), [nearby]);
  const grid = useMemo(() => nearby.filter((h) => !filter || h.group === filter).slice(0, 8), [nearby, filter]);

  // People near you: everyone in IRLY, women in IRLY Girl.
  const women = useGirlPeople(cityId);
  const people = useMemo(
    () => [...(inGirl ? women : content.people)].sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online))).slice(0, 12),
    [content.people, inGirl, women],
  );
  const eat = useMemo(() => content.places.filter((pl) => EAT_KINDS.has(pl.kind)), [content.places]);
  const girl = profile.gender === 'woman';
  const seeAllPeople = inGirl ? FEATURES.girlMatch : FEATURES.matchIrly;
  // « IRLY Moms » (an entry of IRLY, /girl?mode=moms) lands here: IRLY Moms lives in Discover › People.
  const { girl: girlParam } = useLocalSearchParams<{ girl?: string }>();
  useEffect(() => {
    if (girlParam !== 'moms') return;
    router.setParams({ girl: undefined });
    router.push('/discover?tab=people&moms=1');
  }, [girlParam, router]);

  const section = (id: HomeSection): ReactNode => {
    switch (id) {
      case 'search':
        return (
          <Animated.View style={[styles.firstSection, arriveStyle]}>
            <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push('/search')} accessibilityRole="search" accessibilityLabel={tx('Search everything')} style={styles.searchWrap}>
              <Glass level="thick" lifted style={styles.search}>
                <Icon name="search" size={18} color={t.c.textSecondary} />
                <Text variant="body" tone="secondary" numberOfLines={1} raw style={{ flex: 1 }}>
                  {tx('Search {city}: padel, rooftop, visa…', { city: city.name })}
                </Text>
                <Icon name="sliders" size={16} color={t.c.textSecondary} />
              </Glass>
            </PressableScale>
            <LiveStrip />
          </Animated.View>
        );
      case 'categories':
        // Every kind of plan, on its photo, right under the header (girls' plans counted in IRLY Girl).
        return (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <DiscoverCategories cityId={cityId} />
          </ScrollReveal>
        );
      case 'featured':
        return featured ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader overline={featuredLive ? 'Live' : undefined} live={featuredLive} title={featuredLive ? 'Happening now' : 'Next up'} />
            <View style={styles.rows}>
              <HighlightCard h={featured} height={Math.round(Math.min(460, frame.width * 1.12))} />
            </View>
          </ScrollReveal>
        ) : null;
      case 'create':
        return (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <CreateMenu />
          </ScrollReveal>
        );
      case 'bali':
        // IRLY: Live Bali. IRLY Girl, in the same card: the girls moving to Bali.
        return cityId === 'bali' ? (
          <ScrollReveal scrollY={scrollY} style={[styles.section, { paddingHorizontal: space.gutter }]}>
            <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push(inGirl ? '/girl/moving' : '/bali')} accessibilityLabel={inGirl ? 'Girls moving to Bali' : 'Live Bali'}>
              <Photo visual={{ photo: 'bali' }} light="bali" scrim="strong" style={{ height: 150, borderRadius: radius.xl, overflow: 'hidden' }} width={900}>
                <View style={{ flex: 1, padding: 16, justifyContent: 'flex-end', gap: 4 }}>
                  <Text variant="overline" color="#FFFFFF">
                    {inGirl ? 'IRLY Girl Bali' : 'IRLY Bali'}
                  </Text>
                  <Text variant="titleL" color="#FFFFFF">
                    {inGirl ? 'Girls moving to Bali.' : 'Live Bali. Don\'t just visit.'}
                  </Text>
                  <Text variant="caption" color="rgba(255,255,255,0.85)">
                    {inGirl ? 'Meet women before you arrive' : 'Where to live · My move · Test Bali · Where to eat'}
                  </Text>
                </View>
              </Photo>
            </PressableScale>
          </ScrollReveal>
        ) : null;
      case 'sessions':
        return upcoming.length ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader title="Your sessions" action="All" onAction={() => router.push('/social')} />
            <View style={styles.rows}>
              {upcoming.slice(0, 3).map((p) => {
                const d = planDisplay(p);
                return (
                  <View key={p.id} style={[styles.mine, { backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent' }]}>
                    <GlassLayer radius={radius.xl} />
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
        ) : null;
      case 'people':
        return people.length ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            {/* "See all" is Match IRLY (IRLY Match in IRLY Girl): only once it is open (src/lib/features.ts). */}
            <SectionHeader
              title={inGirl ? 'Women near you' : 'People near you'}
              action={seeAllPeople ? 'See all' : undefined}
              onAction={seeAllPeople ? () => router.push(inGirl ? '/girl/match' : '/match?intent=friends') : undefined}
            />
            <Carousel data={people} itemWidth={76} gap={10} keyOf={(p) => p.id} render={(p) => <PersonBubble person={p} city={city} />} />
          </ScrollReveal>
        ) : null;
      case 'today':
        return account ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader overline="Real plans, today" title="Today on IRLY" />
            <TodayStrip cityId={cityId} />
            <RecapDoor />
          </ScrollReveal>
        ) : null;
      case 'explore':
        return (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader overline="Help, news and spaces" title="Explore IRLY" />
            <ExploreDoors />
          </ScrollReveal>
        );
      case 'portals':
        // IRLY: the doors into IRLY Girl and IRLY Moms (women). IRLY Girl, same doors: back to IRLY, and IRLY Moms.
        return inGirl || girl ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader overline="Women only · Not dating" title="Find your people" />
            <GirlPortals light={city.light} />
          </ScrollReveal>
        ) : null;
      case 'members':
        return (
          <ScrollReveal scrollY={scrollY}>
            <MemberActivities cityId={cityId} />
          </ScrollReveal>
        );
      case 'nearby':
        return nearby.length ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader title="Activities near you" action="All" onAction={() => router.push('/social')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip size="sm" label="All" selected={!filter} onPress={() => setFilter(null)} />
              {groups.map((id) => (
                <Chip key={id} size="sm" label={CATEGORY_BY_ID[id].label} icon={CATEGORY_BY_ID[id].icon} selected={filter === id} onPress={() => setFilter(filter === id ? null : id)} />
              ))}
            </ScrollView>
            <View style={styles.grid}>
              {grid.map((h, i) => (
                <Animated.View key={`${filter ?? 'all'}-${h.id}`} entering={reduced ? undefined : enter.rise(Math.min(i, 6))}>
                  <ActivityTile h={h} width={doorW} />
                </Animated.View>
              ))}
            </View>
          </ScrollReveal>
        ) : null;
      case 'eat':
        return eat.length ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader overline="Restaurants & cafés" title="Find someone to eat with" action="All" onAction={() => router.push('/eat')} />
            <Rail itemWidth={220}>
              {eat.map((pl) => (
                <PlaceCard key={pl.id} place={pl} width={220} />
              ))}
            </Rail>
          </ScrollReveal>
        ) : null;
      case 'events':
        return (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader title="Events this week" action="See all" onAction={() => router.push('/events')} />
            <Rail itemWidth={236}>
              {content.events.slice(0, 8).map((e) => (
                <EventCard key={`ev-${e.id}`} event={e} width={236} height={320} />
              ))}
            </Rail>
          </ScrollReveal>
        );
      case 'yourCommunities':
        return (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <YourCommunities cityId={cityId} />
          </ScrollReveal>
        );
      case 'communities':
        // IRLY: the guide's communities. IRLY Girl, same place: the IRLY Girl communities (women only, with their own chat).
        return inGirl ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader title="Communities near you" action="All" onAction={() => router.push('/communities')} />
            <GirlCommunities cityId={cityId} />
          </ScrollReveal>
        ) : content.communities.length ? (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <SectionHeader title="Communities near you" action="All" onAction={() => router.push('/communities')} />
            <Rail itemWidth={250}>
              {content.communities.map((c) => (
                <CommunityCard key={c.id} community={c} />
              ))}
            </Rail>
          </ScrollReveal>
        ) : null;
      case 'forYou':
        return forYou.map((sec, i) => (
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
        ));
      case 'byCategory':
        // The activities of the destination, grouped by category (girls' plans only in IRLY Girl).
        return (
          <ScrollReveal scrollY={scrollY} style={styles.section}>
            <ActivitiesByCategory cityId={cityId} />
          </ScrollReveal>
        );
      case 'footer':
        return (
          <PressableScale haptic="select" scaleTo={0.98} onPress={() => setSheet(true)} style={styles.footer}>
            <IrlyMark size={30} state="static" ringColor={t.c.textTertiary} lensColor={t.c.text} glow={false} />
            <Text variant="bodyS" tone="tertiary" align="center">
              {tx('You are in {dest} · {city}.', { dest: tx(dest.name), city: city.name })}
              {'\n'}
              {tx('Tap to switch destination.')}
            </Text>
          </PressableScale>
        );
    }
  };


  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <HomeBackdrop city={city} now={now} scrollY={scrollY} heroH={heroH + insets.top} />
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

        {/* The same sections, in the same order, in IRLY and in IRLY Girl. */}
        {HOME_SECTIONS.map((id) => (
          <Fragment key={id}>{section(id)}</Fragment>
        ))}
      </Animated.ScrollView>

      <HomeHeader scrollY={scrollY} solidAt={heroH - layout.headerHeight} />
      <DestinationSheet visible={sheet} onClose={() => setSheet(false)} />
      {/* Crossing into IRLY Girl: the Girl mark opens over the page, once per session. */}
      {inGirl ? <GirlIntro /> : null}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: space.gutter },
  chips: { paddingHorizontal: space.gutter, gap: 8, paddingBottom: 12 },
  searchWrap: { marginHorizontal: space.gutter, marginBottom: space[5] },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: 26 },
  footer: { alignItems: 'center', gap: 12, paddingVertical: space[8] },
});
