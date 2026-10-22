import { useLocalSearchParams, useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { memo, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';
import { Rail } from '@/components/cards/Blocks';
import { EventCard, EventRow } from '@/components/cards/EventCards';
import { PersonCard } from '@/components/cards/PeopleCards';
import { CommunityCard, PlaceCard, SessionCard } from '@/components/cards/ThingCards';
import { useFrame } from '@/components/layout/AppFrame';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { ACTIVITIES, INTENTS, SERVICE_CATEGORIES } from '@/data/catalog';
import { CATEGORIES } from '@/data/catalog/categories';
import { areasForDisplay } from '@/data/areas';
import { areaName, CITIES } from '@/data/destinations';
import type { PhotoKey } from '@/data/photos';
import { getCityContent } from '@/data/repo';
import type { CityId, Intent } from '@/data/types';
import type { LightId } from '@/theme/lights';
import { GirlPortals } from '@/features/home/Portals';
import { GirlCommunities, GirlPlanRows, useGirlPeople, useGirlPlans } from '@/features/girl/GirlSections';
import { MomsView } from '@/features/girl/MomsView';
import { useAppSpace } from '@/state/appSpace';
import { rankMatches } from '@/features/matching/match';
import { isWeekend } from '@/lib/time';
import { SoonPill } from '@/features/soon/SoonPill';
import { SoonRail } from '@/features/soon/SoonRail';
import { FEATURES } from '@/lib/features';
import { PressableScale } from '@/motion/PressableScale';
import { ScrollReveal } from '@/motion/ScrollReveal';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';

export type PageProps = {
  cityId: CityId;
  scrollY: SharedValue<number>;
  /** Space under the floating header. */
  top: number;
  /** Space above the floating tab bar. */
  bottom: number;
};

/** One vertical page of Discover, with its own scroll position. */
function PageScroll({ scrollY, top, bottom, children }: { scrollY: SharedValue<number>; top: number; bottom: number; children: ReactNode }) {
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  return (
    <Animated.ScrollView keyboardShouldPersistTaps="handled"
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}
    >
      {children}
    </Animated.ScrollView>
  );
}

type Door = { label: string; caption: string; icon: IconName; photo: PhotoKey; href: string };

/** A door on its photo: a category, a hub, a part of the city guide. */
export const DoorTile = memo(function DoorTile({ door, width, height = 150, light }: { door: Door; width: number; height?: number; light: LightId }) {
  const router = useRouter();
  return (
    <PressableScale onPress={() => router.push(door.href as never)} style={{ width }} accessibilityLabel={`${door.label}. ${door.caption}`}>
      <Photo visual={{ photo: door.photo }} light={light} scrim="strong" style={[styles.door, { height }]} width={500} recyclingKey={`door-${door.label}`}>
        <View style={styles.doorInner}>
          <Glass dark level="thin" style={styles.doorIcon}>
            <Icon name={door.icon} size={17} color="#FFFFFF" />
          </Glass>
          <View>
            <Text variant="titleM" tone="onDark" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {door.label}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.74)" numberOfLines={1}>
              {door.caption}
            </Text>
          </View>
        </View>
      </Photo>
    </PressableScale>
  );
});

/* ───────── PEOPLE ───────── */

const INTENT_ORDER: Intent[] = ['friends', 'activities', 'sports', 'business', 'similar', 'explore'];

/**
 * In IRLY Girl the same page, section for section: « Find someone » and the
 * intents open IRLY Match, the people are women, the IRLY Girl doors become
 * the way back to IRLY and IRLY Moms (opened here, under the doors), and the
 * communities are IRLY Girl's.
 */
export function PeoplePage({ cityId, scrollY, top, bottom }: PageProps) {
  const t = useTheme();
  const router = useRouter();
  const frame = useFrame();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const profile = useStore((s) => s.profile);
  const inGirl = useAppSpace() === 'girl';
  const women = useGirlPeople(cityId);
  const people = inGirl ? women : content.people;
  const matches = useMemo(() => rankMatches(profile, inGirl ? women : content.people, 'friends', (id) => areaName(city, id)).slice(0, 8), [profile, inGirl, women, content.people, city]);
  const tileW = (frame.width - space.gutter * 2 - 10) / 2;
  // Match IRLY, or IRLY Match in IRLY Girl (each says « coming soon » itself while closed).
  const matchOpen = inGirl ? FEATURES.girlMatch : FEATURES.matchIrly;
  const matchHref = (intent: Intent) => (inGirl ? '/girl/match' : `/match?intent=${intent}`);
  // IRLY Moms opens in place; « IRLY Moms » from the Home arrives with ?moms=1.
  const { moms: momsParam } = useLocalSearchParams<{ moms?: string }>();
  const [moms, setMoms] = useState(momsParam === '1');
  const [seenMoms, setSeenMoms] = useState(momsParam);
  if (momsParam !== seenMoms) {
    setSeenMoms(momsParam);
    if (momsParam === '1') setMoms(true);
  }
  return (
    <PageScroll scrollY={scrollY} top={top} bottom={bottom}>
      <ScrollReveal scrollY={scrollY} style={styles.first}>
        <View style={{ paddingHorizontal: space.gutter }}>
          <PressableScale
            haptic="select"
            scaleTo={0.98}
            onPress={() => router.push(matchHref('friends') as never)}
            style={[styles.cta, { backgroundColor: t.c.brand, boxShadow: t.shadow.glow }]}
            accessibilityLabel={matchOpen ? 'Find someone' : `${tx('Find someone')}. ${tx(inGirl ? 'IRLY Match is coming soon' : 'Match IRLY is coming soon')}`}
          >
            <View style={[styles.ctaIcon, { backgroundColor: t.mode === 'night' ? 'rgba(5,5,6,0.07)' : 'rgba(255,255,255,0.14)' }]}>
              <Icon name="users" size={20} color={t.c.onBrand} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              {matchOpen ? null : <SoonPill onLight={t.mode === 'night'} />}
              <Text variant="titleM" color={t.c.onBrand}>
                Find someone
              </Text>
              <Text variant="bodyS" color={t.c.onBrand} style={{ opacity: 0.7 }} numberOfLines={2}>
                {matchOpen
                  ? tx(inGirl ? '{n} women in {city} matched on interests, languages, plans' : '{n} people in {city} matched on interests, languages, plans', { n: people.length, city: city.name })
                  : tx(inGirl ? 'IRLY Match is coming soon' : 'Match IRLY is coming soon')}
              </Text>
            </View>
            <Icon name="arrowUpRight" size={20} color={t.c.onBrand} />
          </PressableScale>
        </View>
      </ScrollReveal>

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        <SectionHeader overline={matchOpen ? 'Who do you want to meet?' : inGirl ? 'IRLY Match · Coming soon' : 'Match IRLY · Coming soon'} title="Find your people" />
        <View style={styles.grid}>
          {INTENT_ORDER.map((id) => {
            const it = INTENTS[id];
            return (
              <PressableScale
                key={id}
                haptic="select"
                scaleTo={0.96}
                onPress={() => router.push(matchHref(id) as never)}
                style={[styles.intent, { width: tileW, backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent' }]}
                accessibilityLabel={`${tx(it.label)}. ${tx(it.blurb)}`}
              >
                <GlassLayer radius={radius.lg} />
                <Icon name={it.icon} size={20} color={t.c.text} />
                {/* Two tiles a row on a 375 pt phone: « Des gens comme moi » shrinks a little instead of losing its end. */}
                <Text variant="titleS" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {it.label}
                </Text>
                <Text variant="caption" tone="tertiary" numberOfLines={2}>
                  {it.blurb}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </ScrollReveal>

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        {/* "See all" is Match IRLY (IRLY Match in IRLY Girl): only once it is open (src/lib/features.ts). */}
        <SectionHeader
          overline="Best matches"
          title={inGirl ? 'Women for you' : 'People for you'}
          action={matchOpen ? 'See all' : undefined}
          onAction={matchOpen ? () => router.push(matchHref('friends') as never) : undefined}
        />
        <Rail itemWidth={290}>
          {matches.map((m) => (
            <PersonCard key={m.person.id} match={m} width={290} />
          ))}
        </Rail>
      </ScrollReveal>

      {inGirl || profile.gender === 'woman' ? (
        <ScrollReveal scrollY={scrollY} style={styles.section}>
          <SectionHeader overline="Women only · Not dating" title={inGirl ? 'Your spaces' : 'IRLY Girl'} />
          <GirlPortals light={city.light} onMoms={() => setMoms((m) => !m)} />
          {inGirl && moms ? <MomsView cityId={cityId} /> : null}
        </ScrollReveal>
      ) : null}

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        <SectionHeader overline={inGirl ? 'Women only · with their own chat' : 'Groups that meet IRL'} title="Communities" action="All" onAction={() => router.push('/communities')} />
        {inGirl ? (
          <GirlCommunities cityId={cityId} />
        ) : (
          <Rail itemWidth={250}>
            {content.communities.map((c) => (
              <CommunityCard key={c.id} community={c} />
            ))}
          </Rail>
        )}
      </ScrollReveal>
    </PageScroll>
  );
}

/* ───────── ACTIVITIES ───────── */

/** In IRLY Girl the same page: « Happening soon » lists the girls' plans (women only, from the server). */
export function ActivitiesPage({ cityId, scrollY, top, bottom }: PageProps) {
  const router = useRouter();
  const frame = useFrame();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const doorW = (frame.width - space.gutter * 2 - 12) / 2;
  const inGirl = useAppSpace() === 'girl';
  // Shown in IRLY Girl only: not asked for in IRLY.
  const girlPlans = useGirlPlans(cityId, { girlOnly: true, skip: !inGirl });
  const soon = useMemo(
    () => (inGirl ? [] : [...content.sessions].sort((a, b) => a.when.dayOffset - b.when.dayOffset || a.when.time.localeCompare(b.when.time)).slice(0, 4)),
    [content.sessions, inGirl],
  );
  const hasSoon = inGirl ? girlPlans.activities.length > 0 || girlPlans.loading : soon.length > 0;
  const doors: Door[] = CATEGORIES.map((c) => ({ label: c.label, caption: c.tagline, icon: c.icon, photo: c.photo, href: `/category/${c.id}` }));
  return (
    <PageScroll scrollY={scrollY} top={top} bottom={bottom}>
      {hasSoon ? (
        <ScrollReveal scrollY={scrollY} style={styles.first}>
          <SectionHeader overline="Join in" title="Happening soon" action="Plans" onAction={() => router.push('/social')} />
          <View style={styles.rows}>
            {inGirl ? <GirlPlanRows plans={girlPlans} limit={4} /> : soon.map((s) => <SessionCard key={s.id} session={s} />)}
          </View>
        </ScrollReveal>
      ) : null}

      <ScrollReveal scrollY={scrollY} style={hasSoon ? styles.section : styles.first}>
        <SectionHeader overline="Every kind of plan" title="Browse by category" />
        <View style={styles.doors}>
          {doors.map((d) => (
            <DoorTile key={d.label} door={d} width={doorW} light={city.light} />
          ))}
        </View>
      </ScrollReveal>

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        <View style={styles.rows}>
          <DoorTile
            door={{
              label: 'Sports & activities',
              caption: tx('{n} sports & more', { n: city.activityKinds.length }),
              icon: 'activity',
              photo: ACTIVITIES[city.activityKinds[0]].photo ?? 'running',
              href: '/activities',
            }}
            width={frame.width - space.gutter * 2}
            height={168}
            light={city.light}
          />
        </View>
      </ScrollReveal>
    </PageScroll>
  );
}

/* ───────── PLACES ───────── */

export function PlacesPage({ cityId, scrollY, top, bottom }: PageProps) {
  const t = useTheme();
  const router = useRouter();
  const frame = useFrame();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const full = frame.width - space.gutter * 2;
  const doorW = (full - 12) / 2;
  const picks = content.places.filter((p) => p.irlyPick);
  const guide: Door[] = [
    ...(cityId === 'bali' ? [{ label: 'Live Bali', caption: 'Areas, moving, test stays', icon: 'palm' as IconName, photo: 'bali' as PhotoKey, href: '/bali' }] : []),
    { label: 'Map', caption: 'Everything around you', icon: 'map', photo: city.photo, href: '/map' },
    { label: 'Services', caption: 'Coming soon', icon: 'shield', photo: SERVICE_CATEGORIES[city.serviceCategories[0]].photo ?? 'apartment', href: '/services' },
    { label: 'Business', caption: 'Setup, visa, people', icon: 'briefcase', photo: 'meeting', href: '/business' },
  ];
  return (
    <PageScroll scrollY={scrollY} top={top} bottom={bottom}>
      <ScrollReveal scrollY={scrollY} style={styles.first}>
        <View style={styles.rows}>
          <DoorTile door={{ label: 'Where to eat', caption: 'Ranked restaurants, then company', icon: 'utensils', photo: 'dinner', href: '/eat' }} width={full} height={200} light={city.light} />
        </View>
      </ScrollReveal>

      {picks.length ? (
        <ScrollReveal scrollY={scrollY} style={styles.section}>
          <SectionHeader overline="Members love" title="IRLY picks" />
          <Rail itemWidth={210}>
            {picks.map((p) => (
              <PlaceCard key={p.id} place={p} width={210} />
            ))}
          </Rail>
        </ScrollReveal>
      ) : null}

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        <SectionHeader overline="Neighbourhoods" title={tx('Around {city}', { city: city.name })} action="Map" onAction={() => router.push('/map')} />
        <View style={styles.areas}>
          {areasForDisplay(city, city.areas).map((a) => {
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
                style={[styles.area, { backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent' }]}
              >
                <GlassLayer radius={radius.pill} />
                <Icon name="pin" size={14} color={t.accent} />
                <Text variant="label">{a.name}</Text>
                <Text variant="caption" tone="tertiary">
                  {n}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </ScrollReveal>

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        <SectionHeader overline="Every place" title="Places to meet" />
        <View style={styles.doors}>
          {content.places.map((p) => (
            <PlaceCard key={p.id} place={p} width={doorW} />
          ))}
        </View>
      </ScrollReveal>

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        <SectionHeader overline="City guide" title="Settle in" />
        <View style={styles.doors}>
          {guide.map((d) => (
            <DoorTile key={d.label} door={d} width={doorW} light={city.light} />
          ))}
        </View>
      </ScrollReveal>

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        <SectionHeader overline="Coming soon" title="Coming to IRLY" />
        <SoonRail light={city.light} />
      </ScrollReveal>
    </PageScroll>
  );
}

/* ───────── EVENTS ───────── */

export function EventsPage({ cityId, scrollY, top, bottom }: PageProps) {
  const router = useRouter();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const tonight = content.events.filter((e) => e.when.dayOffset === 0);
  const weekend = content.events.filter((e) => isWeekend(e.when, city));
  const upcoming = [...content.events].sort((a, b) => a.when.dayOffset - b.when.dayOffset || a.when.time.localeCompare(b.when.time));
  return (
    <PageScroll scrollY={scrollY} top={top} bottom={bottom}>
      <ScrollReveal scrollY={scrollY} style={styles.first}>
        <SectionHeader overline={tonight.length ? 'Today' : 'Coming up'} live={tonight.length > 0} title={tonight.length ? 'Tonight' : 'Next events'} />
        <Rail itemWidth={270}>
          {(tonight.length ? tonight : upcoming.slice(0, 6)).map((e) => (
            <EventCard key={e.id} event={e} width={270} height={340} />
          ))}
        </Rail>
      </ScrollReveal>

      {weekend.length ? (
        <ScrollReveal scrollY={scrollY} style={styles.section}>
          <SectionHeader overline="Plan ahead" title="This weekend" />
          <View style={styles.rows}>
            {weekend.slice(0, 4).map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </View>
        </ScrollReveal>
      ) : null}

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        <SectionHeader overline={tx('{n} this week', { n: content.events.length })} title="All events" />
        <View style={styles.rows}>
          {upcoming.slice(0, 10).map((e) => (
            <EventRow key={`all-${e.id}`} event={e} />
          ))}
          <Button label="See all events" variant="secondary" full iconRight="arrowRight" onPress={() => router.push('/events')} style={{ marginTop: 6 }} />
        </View>
      </ScrollReveal>
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: space[5] },
  section: { marginTop: space[9] },
  rows: { paddingHorizontal: space.gutter, gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: space.gutter },
  doors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: space.gutter },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.xxl },
  ctaIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  intent: { padding: 14, gap: 6, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, minHeight: 112 },
  door: { borderRadius: radius.lg, overflow: 'hidden' },
  doorInner: { flex: 1, padding: 14, justifyContent: 'space-between' },
  doorIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
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
