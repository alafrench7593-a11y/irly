import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { PhotoKey } from '@/data/photos';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
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

/** A real photo for each interest: picks are made on pictures, never on emoji or symbols. */
const INTEREST_PHOTO: Record<Interest, PhotoKey> = {
  sports: 'football',
  wellness: 'yoga',
  food: 'brunch',
  nightlife: 'rooftopNeon',
  startups: 'founders',
  business: 'meeting',
  art: 'gallery',
  music: 'concert',
  outdoors: 'hikeDesert',
  fashion: 'fashion',
  tech: 'developer',
  travel: 'roadtrip',
  languages: 'education',
  family: 'family',
};

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
            <PhotoTile key={i} photo={INTEREST_PHOTO[i]} label={INTERESTS[i].label} selected={profile.interests.includes(i)} onPress={() => toggleInterest(i)} />
          ))}
        </View>
      </Animated.View>
      <Animated.View entering={enter.rise(2, 60)} style={styles.block}>
        <Text variant="overline" color="rgba(255,255,255,0.55)">
          Popular in {city.name}
        </Text>
        <View style={styles.wrap}>
          {city.activityKinds.map((a) => (
            <PhotoTile key={a} photo={ACTIVITIES[a].photo} label={ACTIVITIES[a].label} selected={profile.activities.includes(a)} onPress={() => toggleActivity(a)} />
          ))}
        </View>
      </Animated.View>
    </StepShell>
  );
}

/** A photo you tap to pick: the name on the picture, a white ring and a check once chosen. */
function PhotoTile({ photo, label, selected, onPress }: { photo: PhotoKey; label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={() => {
        haptic('select');
        onPress();
      }}
      haptic={false}
      scaleTo={0.95}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={tx(label)}
      style={[styles.tile, { borderColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.12)' }]}
    >
      <Photo visual={{ photo }} light="dubai" scrim="strong" width={360} style={StyleSheet.absoluteFill} />
      {selected ? <View style={styles.tint} /> : null}
      {selected ? (
        <View style={styles.check}>
          <Icon name="check" size={13} color="#0A0A0A" strokeWidth={2.6} />
        </View>
      ) : null}
      <Text variant="label" color="#FFFFFF" numberOfLines={2} style={styles.tileLabel}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: space.gutter, gap: 12, marginBottom: space[7] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.6%', aspectRatio: 0.82, borderRadius: 16, overflow: 'hidden', borderWidth: 2, justifyContent: 'flex-end', backgroundColor: '#1A1A1C' },
  tint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.08)' },
  check: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  tileLabel: { padding: 10, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
});
