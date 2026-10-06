import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useFrame } from '@/components/layout/AppFrame';
import { Field } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CITIES } from '@/data/destinations';
import { USER_TYPES } from '@/data/catalog';
import type { UserType } from '@/data/types';
import { StepShell } from '@/features/onboarding/StepShell';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const ORDER: UserType[] = ['expat', 'local', 'tourist', 'entrepreneur', 'professional', 'student', 'nomad'];

export default function WhoAreYou() {
  const router = useRouter();
  const t = useTheme();
  const frame = useFrame();
  const city = CITIES[useCityId()];
  const profile = useStore((s) => s.profile);
  const updateProfile = useStore((s) => s.updateProfile);
  const colW = (frame.width - space.gutter * 2 - 10) / 2;

  const toggle = (type: UserType) => {
    const has = profile.types.includes(type);
    const next = has ? profile.types.filter((x) => x !== type) : [...profile.types, type].slice(-3);
    updateProfile({ types: next });
  };

  return (
    <StepShell
      step={0}
      total={4}
      overline={`IRLY ${city.name}`}
      title={tx('Who are you in {city}?', { city: city.name })}
      subtitle="Pick up to three. IRLY uses this to introduce you to the right people, never to box you in."
      cta="Continue"
      canContinue={profile.types.length > 0}
      onContinue={() => router.push('/onboarding/interests')}
    >
      <Animated.View entering={enter.rise(1, 80)} style={{ paddingHorizontal: space.gutter, marginBottom: space[6] }}>
        <Field
          icon="user"
          placeholder={tx('Your first name')}
          value={profile.name}
          onChangeText={(name) => updateProfile({ name })}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={24}
          accessibilityLabel="First name"
        />
      </Animated.View>
      <View style={styles.grid}>
        {ORDER.map((type, i) => {
          const def = USER_TYPES[type];
          const selected = profile.types.includes(type);
          return (
            <Animated.View key={type} entering={enter.rise(i + 2, 80)}>
              <PressableScale
                haptic="select"
                onPress={() => toggle(type)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                style={[
                  styles.option,
                  {
                    width: colW,
                    backgroundColor: selected ? t.c.brandSoft : 'rgba(255,255,255,0.05)',
                    borderColor: selected ? t.c.brand : 'rgba(255,255,255,0.1)',
                  },
                ]}
              >
                <View style={styles.optionTop}>
                  <View style={[styles.optionIcon, { backgroundColor: selected ? t.c.brand : 'rgba(255,255,255,0.08)' }]}>
                    <Icon name={def.icon} size={18} color={selected ? t.c.onBrand : '#FFFFFF'} />
                  </View>
                  {selected ? (
                    <Animated.View entering={ZoomIn.springify().damping(11)} exiting={ZoomOut.duration(160)} style={[styles.tick, { backgroundColor: t.c.brand }]}>
                      <Icon name="check" size={12} color={t.c.onBrand} strokeWidth={3} />
                    </Animated.View>
                  ) : null}
                </View>
                <Text variant="titleS" tone="onDark">
                  {def.label}
                </Text>
                <Text variant="bodyS" color="rgba(255,255,255,0.55)" numberOfLines={2}>
                  {def.blurb}
                </Text>
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </StepShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: space.gutter },
  option: { padding: 14, gap: 6, borderRadius: radius.lg, borderWidth: 1.5, minHeight: 128 },
  optionTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  optionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
