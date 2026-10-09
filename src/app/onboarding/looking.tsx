import { a11y , t as tx } from '@/i18n';
import { useRouter } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Chip } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { StepShell } from '@/features/onboarding/StepShell';
import { enter } from '@/motion/enter';
import { CITIES } from '@/data/destinations';
import { useCityId, useStore, type LookingFor, type Profile } from '@/state/store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const LOOKING: { id: LookingFor; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'sport', label: 'Sport' },
  { id: 'networking', label: 'Networking' },
  { id: 'activities', label: 'Activities' },
  { id: 'travel', label: 'Travel' },
  { id: 'food', label: 'Food' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'communities', label: 'Communities' },
  { id: 'dogwalk', label: 'Dog walk' },
  { id: 'events', label: 'Events' },
];

const SINCE: { id: NonNullable<Profile['since']>; label: string }[] = [
  { id: 'new', label: 'Just arrived' },
  { id: 'year', label: 'Less than a year' },
  { id: 'years', label: 'A few years' },
  { id: 'local', label: 'I’m from here' },
];
const DAY = 86_400_000;
// "New in Dubai · 12 days" only for people who said they just arrived.
const ARRIVED: Record<NonNullable<Profile['since']>, number | undefined> = { new: 0, year: 120 * DAY, years: 730 * DAY, local: undefined };

const FAITHS = ['Prefer not to say', 'Islam', 'Christianity', 'Hinduism', 'Judaism', 'Buddhism', 'Sikhism', 'Spiritual', 'None', 'Other'];

/**
 * What are you looking for? Several answers. Women also see IRLY Girl.
 * Faith is optional and private: hidden by default, never used to rank or
 * filter anyone.
 */
export default function LookingStep() {
  const t = useTheme();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const update = useStore((s) => s.updateProfile);
  const city = CITIES[useCityId()];
  const looking = profile.lookingFor ?? [];
  const options = profile.gender === 'woman' ? [...LOOKING, { id: 'irlygirl' as const, label: 'IRLY Girl' }] : LOOKING;
  const toggle = (id: LookingFor) => update({ lookingFor: looking.includes(id) ? looking.filter((x) => x !== id) : [...looking, id] });

  return (
    <StepShell
      step={3}
      total={4}
      overline="Almost there"
      title="What are you looking for?"
      subtitle="Pick as many as you like. IRLY uses them to suggest people, sessions and communities."
      cta="Continue"
      canContinue={looking.length > 0}
      onContinue={() => {
        if (!profile.arrivedAt && profile.since !== 'local') update({ arrivedAt: Date.now() - (ARRIVED[profile.since ?? 'new'] ?? 0) });
        router.push('/onboarding/ready');
      }}
    >
      <Animated.View entering={enter.rise(1, 80)} style={styles.block}>
        <View style={styles.wrap}>
          {options.map((o) => (
            <Chip key={o.id} label={o.label} selected={looking.includes(o.id)} onPress={() => toggle(o.id)} />
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={enter.rise(2, 80)} style={styles.block}>
        <Text variant="overline" tone="secondary">
          {tx('How long have you been in {city}?', { city: city.name })}
        </Text>
        <View style={styles.wrap}>
          {SINCE.map((o) => (
            <Chip
              key={o.id}
              size="sm"
              label={o.label}
              selected={profile.since === o.id}
              onPress={() =>
                update({
                  since: profile.since === o.id ? undefined : o.id,
                  arrivedAt: profile.since === o.id || o.id === 'local' ? undefined : Date.now() - (ARRIVED[o.id] ?? 0),
                })
              }
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={enter.rise(3, 80)} style={[styles.block, { marginBottom: space[8] }]}>
        <Text variant="overline" tone="secondary">
          Faith · optional · private
        </Text>
        <View style={styles.wrap}>
          {FAITHS.map((f) => (
            <Chip key={f} size="sm" label={f} selected={profile.faith === f} onPress={() => update({ faith: profile.faith === f ? undefined : f })} />
          ))}
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text variant="label">Show on my profile</Text>
            <Text variant="caption" tone="tertiary">
              Only you see it, on your own profile screen. Never shown to other members, never used to rank or filter people.
            </Text>
          </View>
          <Switch
            value={Boolean(profile.faithVisible)}
            onValueChange={(v) => update({ faithVisible: v })}
            trackColor={{ true: t.c.brand, false: t.c.overlay }}
            thumbColor="#FFFFFF"
            accessibilityLabel={a11y('Show my faith on my profile')}
          />
        </View>
      </Animated.View>
    </StepShell>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: space.gutter, gap: 12, marginBottom: space[6] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
