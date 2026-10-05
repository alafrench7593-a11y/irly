import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Chip } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { ACTIVITIES, INTERESTS } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import type { ActivityKind, Interest } from '@/data/types';
import { StepShell } from '@/features/onboarding/StepShell';
import { enter } from '@/motion/enter';
import { useCityId, useStore } from '@/state/store';
import { space } from '@/theme/tokens';

const INTEREST_ORDER: Interest[] = [
  'sports',
  'wellness',
  'food',
  'nightlife',
  'startups',
  'business',
  'art',
  'music',
  'outdoors',
  'fashion',
  'tech',
  'travel',
  'languages',
  'family',
];

export default function Interests() {
  const router = useRouter();
  const city = CITIES[useCityId()];
  const profile = useStore((s) => s.profile);
  const updateProfile = useStore((s) => s.updateProfile);

  const toggleInterest = (i: Interest) =>
    updateProfile({
      interests: profile.interests.includes(i) ? profile.interests.filter((x) => x !== i) : [...profile.interests, i],
    });
  const toggleActivity = (a: ActivityKind) =>
    updateProfile({
      activities: profile.activities.includes(a) ? profile.activities.filter((x) => x !== a) : [...profile.activities, a],
    });

  const count = profile.interests.length + profile.activities.length;

  return (
    <StepShell
      step={1}
      total={4}
      overline={`IRLY ${city.name}`}
      title="What do you love?"
      subtitle="Three or more picks and IRLY can start introducing you to people and plans."
      cta={count >= 3 ? tx('Build my {city}', { city: city.name }) : tx('Pick {n} more', { n: 3 - count })}
      canContinue={count >= 3}
      onContinue={() => router.push('/onboarding/profile')}
    >
      <Animated.View entering={enter.rise(1, 60)} style={styles.block}>
        <Text variant="overline" color="rgba(255,255,255,0.55)">
          Interests
        </Text>
        <View style={styles.wrap}>
          {INTEREST_ORDER.map((i) => (
            <Chip key={i} label={INTERESTS[i].label} icon={INTERESTS[i].icon} selected={profile.interests.includes(i)} onPress={() => toggleInterest(i)} onDark />
          ))}
        </View>
      </Animated.View>
      <Animated.View entering={enter.rise(2, 60)} style={styles.block}>
        <Text variant="overline" color="rgba(255,255,255,0.55)">
          Popular in {city.name}
        </Text>
        <View style={styles.wrap}>
          {city.activityKinds.map((a) => (
            <Chip
              key={a}
              label={ACTIVITIES[a].label}
              icon={ACTIVITIES[a].icon}
              selected={profile.activities.includes(a)}
              onPress={() => toggleActivity(a)}
              tone="accent"
              onDark
            />
          ))}
        </View>
      </Animated.View>
    </StepShell>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: space.gutter, gap: 12, marginBottom: space[7] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
