import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AreaPicker } from '@/components/ui/AreaPicker';
import { t as tx } from '@/i18n';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import { DateTimePicker, WhenField } from '@/components/ui/DateTimePicker';
import { Button } from '@/components/ui/Button';
import { Chip, Field } from '@/components/ui/Controls';
import type { IconName } from '@/components/ui/Icon';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { addDays, cityParts, clockLabel, instants, problemOf, type When } from '@/features/create/when';
import { openCreate } from '@/features/create/createStore';
import { CATEGORY_BY_ID, searchCatalog, type CategoryKey } from '@/data/catalog/categories';
import { useAccount } from '@/features/auth/account';
import { girl } from '@/features/girl/theme';
import { GButton, GChip } from '@/features/girl/ui';
import { createServerActivity } from '@/features/server/activities';
import { track } from '@/lib/analytics';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { useFlavor } from '@/theme/flavor';

export type PlanType = { id: string; label: string; icon: IconName; audience: 'all' | 'girls' | 'moms' | 'families'; category: string; title: (where: string) => string };

/** Restaurant plans (any member; girls plans need IRLY Girl, checked server-side). */
export const FOOD_PLANS: PlanType[] = [
  { id: 'DINNER', label: 'Dinner', icon: 'utensils', audience: 'all', category: 'food', title: (w) => tx('Dinner at {w}', { w }) },
  { id: 'BRUNCH', label: 'Brunch', icon: 'coffee', audience: 'all', category: 'food', title: (w) => tx('Brunch at {w}', { w }) },
  { id: 'COFFEE', label: 'Coffee', icon: 'coffee', audience: 'all', category: 'food', title: (w) => tx('Coffee at {w}', { w }) },
  { id: 'RESTAURANT_MEETUP', label: 'Meetup', icon: 'users', audience: 'all', category: 'food', title: (w) => tx('Meetup at {w}', { w }) },
  { id: 'GIRLS_DINNER', label: 'Girls dinner', icon: 'heart', audience: 'girls', category: 'food', title: (w) => tx('Girls dinner at {w}', { w }) },
  { id: 'FAMILY_DINNER', label: 'Family dinner', icon: 'home', audience: 'families', category: 'family', title: (w) => tx('Family dinner at {w}', { w }) },
  { id: 'MOM_BRUNCH', label: 'Mom brunch', icon: 'baby', audience: 'moms', category: 'family', title: (w) => tx('Mom brunch at {w}', { w }) },
  { id: 'BRUNCH_WITH_KIDS', label: 'Kids + brunch', icon: 'baby', audience: 'moms', category: 'family', title: (w) => tx('Brunch with kids at {w}', { w }) },
];

/** IRLY Girl plans (girls only, checked server-side): what women organise together. */
const g = (id: string, label: string, icon: IconName, category: string): PlanType => ({ id, label, icon, audience: 'girls', category, title: (w) => `${tx(label)} · ${w}` });
export const GIRL_PLANS: PlanType[] = [
  g('BRUNCH', 'Girls brunch', 'coffee', 'food'),
  g('COFFEE', 'Coffee & matcha', 'coffee', 'food'),
  g('GIRLS_DINNER', 'Girls dinner', 'utensils', 'food'),
  g('NIGHT_OUT', 'Night out', 'sparkles', 'nightlife'),
  g('PILATES', 'Pilates', 'activity', 'wellness'),
  g('YOGA', 'Yoga', 'leaf', 'wellness'),
  g('GYM', 'Gym session', 'dumbbell', 'sport'),
  g('RUN', 'Run together', 'footprints', 'sport'),
  g('PADEL', 'Padel', 'trophy', 'sport'),
  g('TENNIS', 'Tennis', 'trophy', 'sport'),
  g('GOLF', 'Golf', 'flag', 'sport'),
  g('SURF', 'Surf morning', 'waves', 'sport'),
  g('BIKE', 'Bike ride', 'bike', 'sport'),
  g('BEACH_CLUB', 'Beach club', 'sun', 'outdoor'),
  g('SUNSET', 'Sunset', 'sunset', 'outdoor'),
  g('YACHT', 'Yacht day', 'sailboat', 'outdoor'),
  g('DESERT', 'Desert evening', 'tent', 'outdoor'),
  g('QUAD', 'Quad biking', 'mountain', 'outdoor'),
  g('WELLNESS', 'Spa & wellness', 'sparkles', 'wellness'),
  g('SHOPPING', 'Shopping', 'shoppingBag', 'shopping'),
  g('GLOBAL_VILLAGE', 'Global Village', 'globe', 'culture'),
  g('MUSEUM', 'Museum & culture', 'landmark', 'culture'),
  g('BOOK_CLUB', 'Book club', 'book', 'creative'),
  g('WORKSHOP', 'Creative workshop', 'palette', 'creative'),
  g('COWORKING', 'Coworking day', 'laptop', 'networking'),
  g('NETWORKING', 'Women entrepreneurs', 'briefcase', 'networking'),
  g('GIRL_TRIP', 'Girl trip', 'plane', 'travel'),
];

/** Girl trips: travel together to get to know each other. */
export const TRIP_PLACES = ['Oman', 'Abu Dhabi', 'Bali', 'Qatar', 'Desert', 'Safari', 'Malaysia', 'Thailand', 'Saudi Arabia'];

/** IRLY Mom Community: activities with children (always IRLY Girl plans). */
export const MOM_PLANS: PlanType[] = [
  { id: 'PLAYDATE', label: 'Playdate', icon: 'baby', audience: 'moms', category: 'family', title: (w) => `${tx('Playdate')} · ${w}` },
  { id: 'BEACH_WITH_KIDS', label: 'Beach with kids', icon: 'sun', audience: 'moms', category: 'family', title: (w) => `${tx('Beach with kids')} · ${w}` },
  { id: 'PARK_MEETUP', label: 'Park meetup', icon: 'leaf', audience: 'moms', category: 'family', title: (w) => `${tx('Park meetup')} · ${w}` },
  { id: 'MOM_COFFEE', label: 'Mom coffee', icon: 'coffee', audience: 'moms', category: 'family', title: (w) => `${tx('Mom coffee')} · ${w}` },
  { id: 'MOM_BABY_WALK', label: 'Mom & baby walk', icon: 'footprints', audience: 'moms', category: 'family', title: (w) => `${tx('Mom & baby walk')} · ${w}` },
  { id: 'BRUNCH_WITH_KIDS', label: 'Brunch with kids', icon: 'utensils', audience: 'moms', category: 'family', title: (w) => `${tx('Brunch with kids')} · ${w}` },
  { id: 'FAMILY_PICNIC', label: 'Family picnic', icon: 'sun', audience: 'moms', category: 'family', title: (w) => `${tx('Family picnic')} · ${w}` },
  { id: 'SWIMMING', label: 'Swimming', icon: 'waves', audience: 'moms', category: 'family', title: (w) => `${tx('Kids swimming')} · ${w}` },
  { id: 'KIDS_FOOTBALL', label: 'Kids football', icon: 'volleyball', audience: 'moms', category: 'family', title: (w) => `${tx('Kids football')} · ${w}` },
  { id: 'KIDS_PADEL', label: 'Kids padel', icon: 'trophy', audience: 'moms', category: 'family', title: (w) => `${tx('Kids padel')} · ${w}` },
  { id: 'KIDS_TENNIS', label: 'Kids tennis', icon: 'trophy', audience: 'moms', category: 'family', title: (w) => `${tx('Kids tennis')} · ${w}` },
  { id: 'CREATIVE_WORKSHOP', label: 'Creative workshop', icon: 'palette', audience: 'moms', category: 'family', title: (w) => `${tx('Creative workshop')} · ${w}` },
  { id: 'KIDS_ART', label: 'Kids art', icon: 'brush', audience: 'moms', category: 'family', title: (w) => `${tx('Kids art')} · ${w}` },
];

/** Plan types the server knows (activities.activity_type); the others are saved without one. */
const SERVER_TYPES = new Set(['PLAYDATE', 'BEACH_WITH_KIDS', 'PARK_MEETUP', 'KIDS_FOOTBALL', 'KIDS_PADEL', 'KIDS_TENNIS', 'SWIMMING', 'MOM_BABY_WALK', 'MOM_COFFEE', 'BRUNCH_WITH_KIDS', 'FAMILY_PICNIC', 'CREATIVE_WORKSHOP', 'KIDS_ART', 'DINNER', 'BRUNCH', 'COFFEE', 'GIRLS_DINNER', 'FAMILY_DINNER', 'MOM_BRUNCH', 'RESTAURANT_MEETUP', 'SURF', 'WELLNESS', 'SUNSET', 'COWORKING']);

/**
 * Plan something in three taps: what, when, where. Uses the one Activity
 * system: the plan gets its chat, lands in the calendar, on the map and in
 * notifications, and (from a restaurant) shows on the place as "who's going".
 */
export function QuickPlan({
  cityId,
  types,
  place,
  palette = 'app',
  onCreated,
}: {
  cityId: CityId;
  types: PlanType[];
  place?: { id: string; name: string; areaId: string | null };
  palette?: 'app' | 'girl';
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const account = useAccount();
  const city = CITIES[cityId];
  const [type, setType] = useState<PlanType>(types[0]);
  // Shown in the field from the start (tomorrow, 11:00 for a brunch or a coffee, else 19:30), changed in the picker.
  const [when, setWhen] = useState<When>(() => ({
    day: addDays(cityParts(Date.now(), city.utcOffset).day, 1),
    start: type.id.includes('BRUNCH') || type.id.includes('COFFEE') ? { h: 11, m: 0 } : { h: 19, m: 30 },
    end: null,
  }));
  const [picking, setPicking] = useState(false);
  const now = useNow();
  // The place's neighbourhood when it has one; otherwise the member picks it (never a silent first one).
  const [area, setArea] = useState<string | null>(place?.areaId ?? null);
  const [busy, setBusy] = useState(false);
  const [trip, setTrip] = useState(TRIP_PLACES[0]);
  const [ownTrip, setOwnTrip] = useState('');
  // Inside IRLY Girl the plan is always in its colours, even when a screen forgets to say so.
  const flavor = useFlavor();
  const G = palette === 'girl' || flavor === 'girl';
  const ink = G ? girl.ink : undefined;
  const isTrip = type.id === 'GIRL_TRIP';

  const where = isTrip ? (trip === 'other' ? ownTrip.trim() : tx(trip)) : (place?.name ?? city.areas.find((a) => a.id === area)?.name ?? city.name);

  // One plan per tap: a fast second tap (before the button re-renders as busy) is ignored.
  const creating = useRef(false);
  const create = async () => {
    if (creating.current) return;
    if (isTrip && !where) {
      toast('Where are you going?', 'plane', 'brand');
      return;
    }
    const problem = problemOf(when, city.utcOffset, Date.now());
    if (problem) {
      toast(problem === 'past' ? 'This time has passed: pick a later one' : 'The end must be after the start', 'calendar', 'brand');
      setPicking(true);
      return;
    }
    if (!area) {
      toast('Choose a neighbourhood', 'pin', 'brand');
      return;
    }
    if (!account) {
      toast('Sign in to plan with people', 'user', 'brand');
      router.push('/account');
      return;
    }
    creating.current = true;
    setBusy(true);
    try {
      const title = type.title(where).slice(0, 80);
      const plan = {
        cityId,
        categoryId: type.category as never,
        title,
        place: where,
        privacy: 'public' as const,
        day: 'Today',
        time: clockLabel(when.start),
        spots: 0,
        areaId: area,
        format: 'meetup' as const,
        price: 0,
        currency: city.currency,
      };
      const { startsAt, endsAt } = instants(when, city.utcOffset);
      // No photo here: the server call gives it one of the IRLY library for its type, at random
      // (never the one used last time), saved on the plan so it shows the same everywhere.
      const id = await createServerActivity(plan, startsAt, { endsAt, placeId: place?.id ?? null, activityType: SERVER_TYPES.has(type.id) ? type.id : null, audience: type.audience });
      // No id: the session ended or the server is unreachable. Never announce a plan nobody can see.
      if (!id) throw new Error('Your session has ended. Sign in again to post this plan');
      haptic('success');
      track('ACTIVITY_CREATE', { type: type.id, audience: type.audience, place: Boolean(place) });
      toast(tx('{title} is live. Chat created', { title }), 'send', 'brand');
      onCreated?.(id);
      router.push(`/a/${id}`);
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Could not create';
      toast(/girl|row-level|policy/i.test(m) ? 'This plan is for IRLY Girl members' : m, 'x', 'live');
    } finally {
      creating.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {G ? (
        // IRLY Girl: every plan at a glance, three per row.
        <View style={styles.grid}>
          {types.map((t) => (
            <PlanTile key={t.id} plan={t} on={type.id === t.id} onPress={() => setType(t)} />
          ))}
        </View>
      ) : (
        <Row>
          {types.map((t) => (
            <C girl={G} key={t.id} label={t.label} on={type.id === t.id} onPress={() => setType(t)} />
          ))}
        </Row>
      )}
      {isTrip ? (
        <Animated.View entering={FadeInDown.springify(520).dampingRatio(0.9)} exiting={FadeOut.duration(140)} style={{ gap: 8 }}>
          <Text variant="label" color={ink}>
            Where to?
          </Text>
          <View style={styles.grid}>
            {[...TRIP_PLACES, 'other'].map((p) => (
              <View key={p} style={styles.third}>
                <C girl={G} label={p === 'other' ? 'Somewhere else' : p} on={trip === p} onPress={() => setTrip(p)} />
              </View>
            ))}
          </View>
          {trip === 'other' ? <Field icon="pin" placeholder="Your destination" value={ownTrip} onChangeText={setOwnTrip} maxLength={40} accessibilityLabel="Your destination" /> : null}
        </Animated.View>
      ) : null}
      <WhenField value={when} utcOffset={city.utcOffset} onPress={() => setPicking(true)} invalid={Boolean(problemOf(when, city.utcOffset, now))} />
      <DateTimePicker visible={picking} onClose={() => setPicking(false)} value={when} onConfirm={setWhen} utcOffset={city.utcOffset} cityName={city.name} />
      {!place?.areaId ? (
        <AreaPicker cityId={city.id} value={area} onChange={setArea} label={isTrip ? 'Meeting point' : undefined} palette={G ? GIRL_PICKER : undefined} />
      ) : null}
      <Text variant="caption" color={ink} tone={G ? undefined : 'tertiary'}>
        {type.audience === 'moms' ? 'Visible to IRLY Mom Community and IRLY Girl members.' : type.audience === 'girls' ? 'Visible to IRLY Girl members only.' : 'Anyone on IRLY can join.'} {tx('It gets its own chat and lands in your calendar.')}
      </Text>
      {G ? (
        <GButton label={tx('Create: {title}', { title: type.title(where) })} icon="plus" loading={busy} onPress={create} />
      ) : (
        <Button label={tx('Create: {title}', { title: type.title(where) })} icon="plus" full loading={busy} onPress={create} />
      )}
      {/* The full form (name, description, photo, price, spots), the same as in IRLY Mixte; in IRLY Girl its plans are for women only. */}
      <Button label={tx('More options: description, photo, price')} icon="sliders" variant="ghost" size="sm" haptic="select" disabled={busy} onPress={() => openFull(type, cityId)} />
    </View>
  );
}

/** Opens the full activity form in this plan's city, starting from its category (and its catalog entry when there is one). */
function openFull(type: PlanType, cityId: CityId) {
  const categoryId = (type.category in CATEGORY_BY_ID ? type.category : 'food') as CategoryKey;
  const entry = searchCatalog(type.label.replace(/^(girls?|mom)\s+/i, ''), 3).find((e) => e.categoryId === categoryId);
  openCreate(null, { categoryId, subId: entry?.sub.id, activityId: entry?.activity?.id, format: 'activity', cityId });
}

/** An IRLY Girl plan: a glass tile plum glass fills with a spring when it is chosen (the selection language of Girl), its icon popping. */
function PlanTile({ plan, on, onPress }: { plan: PlanType; on: boolean; onPress: () => void }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.set(withSpring(on ? 1 : 0, spring.press));
  }, [on, p]);
  const fill = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.88 + p.value * 0.12 }] }));
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: 1 + p.value * 0.12 }] }));
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.95}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={tx(plan.label)}
      style={[styles.tile, { borderColor: on ? 'rgba(255,205,226,0.28)' : 'transparent', boxShadow: on ? girl.shadowPlum : undefined }]}
    >
      <GlassLayer radius={16} level="thin" />
      <Animated.View pointerEvents="none" style={[styles.tileFill, fill]}>
        <LinearGradient colors={girl.plumGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={icon}>
        <Icon name={plan.icon} size={18} color={on ? '#F4B3CF' : girl.rose} />
      </Animated.View>
      <Text variant="caption" color={on ? girl.pearl : girl.ink} align="center" numberOfLines={2}>
        {plan.label}
      </Text>
    </PressableScale>
  );
}

const GIRL_PICKER = { ink: girl.ink, soft: girl.inkSoft, surface: girl.surface, accent: girl.rose, line: girl.line };

function C({ label, on, onPress, girl: g }: { label: string; on: boolean; onPress: () => void; girl: boolean }) {
  return g ? <GChip small label={label} selected={on} onPress={onPress} /> : <Chip size="sm" label={label} selected={on} onPress={onPress} />;
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.5%', minHeight: 74, borderRadius: 16, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 10 },
  tileFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, overflow: 'hidden' },
  third: { width: '31.5%' },
  quarter: { width: '23%' },
});
