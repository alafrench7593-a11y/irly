import { useRouter } from 'expo-router';
import { planDayLabel, upcomingPlans } from '@/features/plans/when';
import { t as tx } from '@/i18n';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Rail } from '@/components/cards/Blocks';
import { PersonCard, PlanCard } from '@/components/cards/PeopleCards';
import { useFrame } from '@/components/layout/AppFrame';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip, SectionHeader } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ACTIVITIES, INTENTS } from '@/data/catalog';
import { areaName, CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import type { ActivityKind, Intent } from '@/data/types';
import { rankMatches } from '@/features/matching/match';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { planDisplay } from '@/data/catalog/mapping';
import { useCityId, useStore, type MyPlan } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const INTENT_ORDER: Intent[] = ['similar', 'friends', 'sports', 'business', 'activities', 'explore'];

/**
 * Social is not a feed of posts: every card is a plan happening in real
 * life, with real people, that you can join in one tap.
 */
export default function Social() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const bottom = useTabBarSpace();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const profile = useStore((s) => s.profile);
  const lastIntent = useStore((s) => s.lastIntent);
  const setIntent = useStore((s) => s.setIntent);
  const myPlans = upcomingPlans(useStore((s) => s.myPlans).filter((p) => p.cityId === cityId));
  const [composer, setComposer] = useState(false);
  const intent: Intent = lastIntent ?? 'friends';

  const matches = useMemo(
    () => rankMatches(profile, content.people, intent, (id) => areaName(city, id)).slice(0, 6),
    [profile, content.people, intent, city],
  );

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + space[6], paddingBottom: bottom + 70 }}
      >
        <View style={styles.head}>
          <Text variant="overline" tone="accent">
            {city.name} · real life first
          </Text>
          <Text variant="displayL">Social</Text>
        </View>

        <Animated.View entering={enter.rise(0)} style={{ marginBottom: space[8] }}>
          <Text variant="titleM" style={{ paddingHorizontal: space.gutter, marginBottom: space[4] }}>
            Who would you like to meet?
          </Text>
          <Rail gap={8}>
            {INTENT_ORDER.map((i) => (
              <Chip
                key={i}
                label={INTENTS[i].label}
                icon={INTENTS[i].icon}
                selected={i === intent}
                onPress={() => setIntent(i)}
              />
            ))}
          </Rail>
        </Animated.View>

        <Animated.View entering={enter.rise(1)} style={{ marginBottom: space[9] }}>
          <SectionHeader
            overline={INTENTS[intent].blurb}
            title="Suggested for you"
            action="See all"
            onAction={() => router.push(`/match?intent=${intent}`)}
          />
          <Rail itemWidth={Math.min(300, frame.width * 0.78)}>
            {matches.map((m) => (
              <PersonCard key={m.person.id} match={m} width={Math.min(300, frame.width * 0.78)} />
            ))}
          </Rail>
        </Animated.View>

        <SectionHeader overline="Join in one tap" live title="Real-life plans" />
        <View style={{ gap: 12, paddingHorizontal: space.gutter }}>
          {myPlans.map((p) => (
            <Animated.View key={p.id} entering={enter.pop(0)} layout={LinearTransition.springify(420)}>
              <MyPlanCard plan={p} />
            </Animated.View>
          ))}
          {content.feed.map((plan, i) => (
            <Animated.View key={plan.id} entering={enter.rise(i + 2)} layout={LinearTransition.springify(420)}>
              <PlanCard plan={plan} />
            </Animated.View>
          ))}
        </View>
      </Animated.ScrollView>

      <View style={[styles.fab, { bottom: bottom - 12 }]}>
        <Button label="Start a plan" icon="plus" onPress={() => setComposer(true)} haptic="press" />
      </View>
      <PlanComposer visible={composer} onClose={() => setComposer(false)} />
    </View>
  );
}

function MyPlanCard({ plan }: { plan: MyPlan }) {
  const t = useTheme();
  const city = CITIES[plan.cityId];
  const name = useStore((s) => s.profile.name) || 'You';
  const a = planDisplay(plan);
  return (
    <View style={[styles.mine, { backgroundColor: t.c.brandSoft, borderColor: t.c.brand }]}>
      <View style={styles.row}>
        <Avatar name={name} hue={262} size={34} />
        <View style={{ flex: 1 }}>
          <Text variant="label">Your plan · live</Text>
          <Text variant="caption" tone="secondary">
            Visible to people who match you in {city.name}
          </Text>
        </View>
        <Icon name={a.icon} size={20} color={a.color} />
      </View>
      <Text variant="displayM" style={{ marginTop: space[4] }}>
        {a.title} · {tx(planDayLabel(plan)).toLowerCase()} · {plan.time}.
      </Text>
      <Text variant="bodyS" tone="secondary" style={{ marginTop: 4 }}>
        {plan.place ?? areaName(city, plan.areaId)} · {plan.spots ? tx('{n} spots', { n: plan.spots }) : tx('Unlimited')} · {tx('we will notify you when people join')}
      </Text>
    </View>
  );
}

const DAYS = ['Today', 'Tomorrow', 'This weekend'];
const TIMES = ['07:00', '12:30', '18:00', '19:30', '21:00'];

function PlanComposer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const postPlan = useStore((s) => s.postPlan);
  const [kind, setKind] = useState<ActivityKind>(city.activityKinds[0]);
  const [day, setDay] = useState(DAYS[1]);
  const [time, setTime] = useState(TIMES[3]);
  const [area, setArea] = useState(city.areas[0].id);
  const [spots, setSpots] = useState(6);

  return (
    <Sheet visible={visible} onClose={onClose} title="Start a plan" subtitle="Real life, in three taps. IRLY shows it to the people most likely to join.">
      <View style={{ gap: space[6], paddingBottom: space[2] }}>
        <View style={styles.block}>
          <Text variant="overline" tone="tertiary">
            Activity
          </Text>
          <View style={styles.wrap}>
            {city.activityKinds.slice(0, 8).map((k) => (
              <Chip key={k} size="sm" label={ACTIVITIES[k].label} icon={ACTIVITIES[k].icon} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
        </View>
        <View style={styles.block}>
          <Text variant="overline" tone="tertiary">
            When
          </Text>
          <View style={styles.wrap}>
            {DAYS.map((d) => (
              <Chip key={d} size="sm" label={d} selected={day === d} onPress={() => setDay(d)} />
            ))}
          </View>
          <View style={styles.wrap}>
            {TIMES.map((x) => (
              <Chip key={x} size="sm" label={x} selected={time === x} onPress={() => setTime(x)} />
            ))}
          </View>
        </View>
        <View style={styles.block}>
          <Text variant="overline" tone="tertiary">
            Where
          </Text>
          <View style={styles.wrap}>
            {city.areas.slice(0, 6).map((a) => (
              <Chip key={a.id} size="sm" label={a.name} icon="pin" selected={area === a.id} onPress={() => setArea(a.id)} tone="accent" />
            ))}
          </View>
        </View>
        <View style={[styles.block, styles.row, { justifyContent: 'space-between' }]}>
          <Text variant="titleS">Spots</Text>
          <View style={[styles.stepper, { borderColor: t.c.line }]}>
            <PressableScale haptic="select" scaleTo={0.85} onPress={() => setSpots((n) => Math.max(2, n - 1))} style={styles.stepBtn} accessibilityLabel="Fewer spots">
              <Text variant="titleM">−</Text>
            </PressableScale>
            <Text variant="titleM" style={{ minWidth: 28 }} align="center">
              {spots}
            </Text>
            <PressableScale haptic="select" scaleTo={0.85} onPress={() => setSpots((n) => Math.min(30, n + 1))} style={styles.stepBtn} accessibilityLabel="More spots">
              <Text variant="titleM">+</Text>
            </PressableScale>
          </View>
        </View>
        <View style={styles.block}>
          <Button
            label="Post plan"
            icon="send"
            full
            haptic={false}
            onPress={() => {
              postPlan({ cityId, kind, day, time, spots, areaId: area });
              haptic('success');
              toast('Plan posted. We will let you know who joins', 'send', 'brand');
              onClose();
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: space.gutter, marginBottom: space[6], gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fab: { position: 'absolute', alignSelf: 'center' },
  mine: { padding: 18, borderRadius: radius.xl, borderWidth: 1.5 },
  block: { paddingHorizontal: space.gutter, gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.pill, paddingHorizontal: 4 },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
