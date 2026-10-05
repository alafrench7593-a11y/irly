import { useRouter } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Chip } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { StepShell } from '@/features/onboarding/StepShell';
import { enter } from '@/motion/enter';
import { useStore, type LookingFor } from '@/state/store';
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
  const looking = profile.lookingFor ?? [];
  const options = profile.gender === 'woman' ? [...LOOKING, { id: 'irlygirl' as const, label: 'IRLY Girl' }] : LOOKING;
  const toggle = (id: LookingFor) => update({ lookingFor: looking.includes(id) ? looking.filter((x) => x !== id) : [...looking, id] });

  return (
    <StepShell
      step={3}
      total={4}
      overline="Almost there"
      title="What are you looking for?"
      subtitle="Pick as many as you like. IRLY uses it to suggest people, sessions and communities."
      cta="Continue"
      canContinue={looking.length > 0}
      onContinue={() => {
        if (!profile.arrivedAt) update({ arrivedAt: Date.now() });
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

      <Animated.View entering={enter.rise(2, 80)} style={[styles.block, { marginBottom: space[8] }]}>
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
              Off by default. Never used to rank or filter people.
            </Text>
          </View>
          <Switch
            value={Boolean(profile.faithVisible)}
            onValueChange={(v) => update({ faithVisible: v })}
            trackColor={{ true: t.c.brand, false: t.c.overlay }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Show my faith on my profile"
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
