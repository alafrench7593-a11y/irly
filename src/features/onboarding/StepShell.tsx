import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import { enter } from '@/motion/enter';
import { spring } from '@/motion/tokens';
import { useCityId } from '@/state/store';
import { space } from '@/theme/tokens';

type Props = {
  step: number;
  total: number;
  overline: string;
  title: string;
  subtitle: string;
  cta: string;
  canContinue: boolean;
  onContinue: () => void;
  children: ReactNode;
};

function Dot({ active, done }: { active: boolean; done: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withSpring(active ? 26 : 8, spring.snappy),
    backgroundColor: active || done ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** Shared frame for onboarding steps: the city's light at the top, progress, a single clear action. */
export function StepShell({ step, total, overline, title, subtitle, cta, canContinue, onContinue, children }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const city = CITIES[useCityId()];
  return (
    <View style={styles.root}>
      <View style={styles.sky}>
        <Photo visual={{ photo: city.photo }} light={city.light} width={1200} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.8)', '#000000']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <IconButton icon="chevronLeft" label="Back" variant="glass" onPress={() => router.back()} />
          <View style={styles.dots}>
            {Array.from({ length: total }, (_, i) => (
              <Dot key={i} active={i === step} done={i < step} />
            ))}
          </View>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter.rise(0, 60)} style={styles.head}>
            <Text variant="overline" color="rgba(255,255,255,0.7)">
              {overline}
            </Text>
            <Text variant="displayL" tone="onDark">
              {title}
            </Text>
            <Text variant="body" color="rgba(255,255,255,0.62)">
              {subtitle}
            </Text>
          </Animated.View>
          {children}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + space[4] }]}>
          <LinearGradient colors={['rgba(0,0,0,0)', '#000000']} locations={[0, 0.45]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Button label={cta} onPress={onContinue} disabled={!canContinue} full iconRight="arrowRight" haptic="press" />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: 340 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  head: { paddingHorizontal: space.gutter, paddingTop: space[9], gap: 8, marginBottom: space[7] },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space[8] },
});
