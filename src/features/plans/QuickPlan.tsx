import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import type { IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { dateFor, planDay, type Day } from '@/features/ai/intent';
import { useAccount } from '@/features/auth/account';
import { girl } from '@/features/girl/theme';
import { GButton, GChip } from '@/features/girl/ui';
import { createServerActivity } from '@/features/server/activities';
import { track } from '@/lib/analytics';
import { haptic } from '@/motion/haptics';
import { useStore } from '@/state/store';

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

/** IRLY Girl plans (girls only, checked server-side). */
export const GIRL_PLANS: PlanType[] = [
  { id: 'SURF', label: 'Girls surf morning', icon: 'waves', audience: 'girls', category: 'sport', title: (w) => `${tx('Girls surf morning')} · ${w}` },
  { id: 'BRUNCH', label: 'Girls brunch', icon: 'coffee', audience: 'girls', category: 'food', title: (w) => `${tx('Girls brunch')} · ${w}` },
  { id: 'WELLNESS', label: 'Girls wellness', icon: 'leaf', audience: 'girls', category: 'wellness', title: (w) => `${tx('Girls wellness')} · ${w}` },
  { id: 'SUNSET', label: 'Girls sunset', icon: 'sunset', audience: 'girls', category: 'outdoor', title: (w) => `${tx('Girls sunset')} · ${w}` },
  { id: 'COWORKING', label: 'Coworking day', icon: 'laptop', audience: 'girls', category: 'networking', title: (w) => `${tx('Girls coworking day')} · ${w}` },
  { id: 'COFFEE', label: 'Women entrepreneurs coffee', icon: 'briefcase', audience: 'girls', category: 'networking', title: (w) => `${tx('Women entrepreneurs coffee')} · ${w}` },
  { id: 'GIRLS_DINNER', label: 'Girls dinner', icon: 'utensils', audience: 'girls', category: 'food', title: (w) => `${tx('Girls dinner')} · ${w}` },
];

/** IRLY Moms: activities with children (always IRLY Girl plans). */
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

const DAYS: Day[] = ['today', 'tomorrow', 'weekend', 'next_week'];
const TIMES = ['08:00', '09:30', '11:00', '13:00', '16:00', '18:00', '19:30', '21:00'];

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
  const postPlan = useStore((s) => s.postPlan);
  const city = CITIES[cityId];
  const [type, setType] = useState<PlanType>(types[0]);
  const [day, setDay] = useState<Day>('tomorrow');
  const [time, setTime] = useState(type.id.includes('BRUNCH') || type.id.includes('COFFEE') ? '11:00' : '19:30');
  const [area, setArea] = useState(place?.areaId ?? city.areas[0].id);
  const [busy, setBusy] = useState(false);
  const G = palette === 'girl';
  const ink = G ? girl.ink : undefined;

  const where = place?.name ?? city.areas.find((a) => a.id === area)?.name ?? city.name;

  const create = async () => {
    if (!account) {
      toast('Sign in to plan with people', 'user', 'brand');
      router.push('/account');
      return;
    }
    setBusy(true);
    try {
      const title = type.title(where).slice(0, 80);
      const plan = {
        cityId,
        categoryId: type.category as never,
        title,
        place: where,
        privacy: 'public' as const,
        day: planDay(day),
        time,
        spots: 0,
        areaId: place?.areaId ?? area,
        format: 'meetup' as const,
        price: 0,
        currency: city.currency,
      };
      const id = await createServerActivity(plan, dateFor(day, time, new Date(), city.utcOffset), { placeId: place?.id ?? null, activityType: type.id, audience: type.audience });
      postPlan(plan);
      haptic('success');
      track('ACTIVITY_CREATE', { type: type.id, audience: type.audience, place: Boolean(place) });
      toast(tx('{title} is live. Chat created', { title }), 'send', 'brand');
      if (id) {
        onCreated?.(id);
        router.push(`/a/${id}`);
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Could not create';
      toast(/girl|row-level|policy/i.test(m) ? 'This plan is for IRLY Girl members' : m, 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Row>
        {types.map((t) => (
          <C girl={G} key={t.id} label={t.label} on={type.id === t.id} onPress={() => setType(t)} />
        ))}
      </Row>
      <Row>
        {DAYS.map((d) => (
          <C girl={G} key={d} label={planDay(d)} on={day === d} onPress={() => setDay(d)} />
        ))}
      </Row>
      <Row>
        {TIMES.map((h) => (
          <C girl={G} key={h} label={h} on={time === h} onPress={() => setTime(h)} />
        ))}
      </Row>
      {!place ? (
        <Row>
          {city.areas.map((a) => (
            <C girl={G} key={a.id} label={a.name} on={area === a.id} onPress={() => setArea(a.id)} />
          ))}
        </Row>
      ) : null}
      <Text variant="caption" color={ink} tone={G ? undefined : 'tertiary'}>
        {type.audience === 'moms' ? 'Visible to IRLY Moms and IRLY Girl members.' : type.audience === 'girls' ? 'Visible to IRLY Girl members only.' : 'Anyone on IRLY can join.'} {tx('It gets its own chat and lands in your calendar.')}
      </Text>
      {G ? (
        <GButton label={tx('Create: {title}', { title: type.title(where) })} icon="plus" loading={busy} onPress={create} />
      ) : (
        <Button label={tx('Create: {title}', { title: type.title(where) })} icon="plus" full loading={busy} onPress={create} />
      )}
    </View>
  );
}

function C({ label, on, onPress, girl: g }: { label: string; on: boolean; onPress: () => void; girl: boolean }) {
  return g ? <GChip small label={label} selected={on} onPress={onPress} /> : <Chip size="sm" label={label} selected={on} onPress={onPress} />;
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 8 },
});
