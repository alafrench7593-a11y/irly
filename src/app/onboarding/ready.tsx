import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { IrlyMark, type MarkState } from '@/brand/IrlyMark';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import { haptic } from '@/motion/haptics';
import { easing } from '@/motion/tokens';
import { useCityId, useStore } from '@/state/store';
import { palettes, space } from '@/theme/tokens';

/**
 * "Building your city": the loading state is honest about what is
 * happening (matching people, curating plans) and ends on the mark's
 * success state, then its lens opens into the home screen.
 */
export default function Ready() {
  const router = useRouter();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const name = useStore((s) => s.profile.name);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [mark, setMark] = useState<MarkState>('loading');
  const [step, setStep] = useState(0);
  const light = useSharedValue(0);

  const lines = [
    tx('Finding people who share your interests'),
    tx('Gathering plans in {city}', { city: city.name }),
    tx('Getting local services ready'),
    tx('Lighting up the map of {city}', { city: city.name }),
  ];

  useEffect(() => {
    light.set(withTiming(1, { duration: 1800, easing: easing.standard }));
    const timers = lines.map((_, i) =>
      setTimeout(() => {
        setStep(i + 1);
        haptic('select');
      }, 450 + i * 520),
    );
    const s = setTimeout(() => {
      setMark('success');
      haptic('success');
    }, 450 + lines.length * 520);
    const tr = setTimeout(() => setMark('transition'), 450 + lines.length * 520 + 900);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(s);
      clearTimeout(tr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skyStyle = useAnimatedStyle(() => ({ opacity: light.value }));

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, skyStyle]}>
        <Photo visual={{ photo: city.photo }} light={city.light} width={1400} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.68)' }]} />
      </Animated.View>
      <View style={styles.center}>
        <IrlyMark
          size={110}
          state={mark}
          lensColor={palettes.night.brand}
          onDone={
            mark === 'transition'
              ? () => {
                  completeOnboarding();
                  router.replace('/(tabs)');
                }
              : undefined
          }
        />
        <Animated.View entering={FadeIn.delay(150).duration(500)} style={{ alignItems: 'center', marginTop: 34, gap: 6 }}>
          <Text variant="overline" color="rgba(255,255,255,0.65)">
            {name ? tx('Welcome, {name}', { name }) : tx('Welcome')}
          </Text>
          <Text variant="displayL" tone="onDark" align="center">
            Building your <Text variant="displayL" tone="onDark" italic>{city.name}</Text>
          </Text>
        </Animated.View>
        <View style={styles.lines}>
          {lines.slice(0, step).map((l) => (
            <Animated.View key={l} entering={FadeInDown.springify(420).dampingRatio(0.9)} style={styles.line}>
              <View style={styles.check}>
                <Icon name="check" size={12} color="#000000" strokeWidth={3} />
              </View>
              <Text variant="body" color="rgba(255,255,255,0.82)">
                {l}
              </Text>
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.gutter },
  lines: { marginTop: space[8], gap: 12, minHeight: 150, alignSelf: 'stretch', paddingHorizontal: space[6] },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
