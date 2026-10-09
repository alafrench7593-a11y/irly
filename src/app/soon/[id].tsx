import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import { useServiceInterest } from '@/features/soon/interest';
import { SOON, type SoonId } from '@/features/soon/services';
import { SoonPill } from '@/features/soon/SoonPill';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * A service IRLY is preparing. The page says what is coming, what already
 * works today (if anything) and, plainly, what does not exist yet. The
 * only action is real: be told when it opens.
 */
export default function SoonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = SOON[(id as SoonId) in SOON ? (id as SoonId) : 'pro'];
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const city = CITIES[useCityId()];
  const interest = useServiceInterest(s.id);

  const notify = () => {
    if (!interest.signedIn) {
      toast('Sign in to be told when it opens', 'user', 'brand');
      router.push('/account');
      return;
    }
    interest
      .toggle()
      .then(() => haptic('success'))
      .catch((e) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live'));
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>
        <Photo visual={{ photo: s.photo }} light={city.light} scrim="full" style={[styles.hero, { paddingTop: insets.top + 64 }]} width={1200} drift>
          <Animated.View entering={enter.fade(0)}>
            <SoonPill />
          </Animated.View>
          <Animated.View entering={enter.rise(1)} style={styles.brand}>
            <View style={styles.brandIcon}>
              <Icon name={s.icon} size={20} color="#FFFFFF" />
            </View>
            <Text variant="titleS" color="#FFFFFF" raw>
              {s.name}
            </Text>
          </Animated.View>
          <Animated.View entering={enter.rise(2)}>
            <Text variant="displayL" color="#FFFFFF">
              {s.tagline}
            </Text>
          </Animated.View>
          <Animated.View entering={enter.rise(3)}>
            <Text variant="body" color="rgba(255,255,255,0.82)">
              {s.pitch}
            </Text>
          </Animated.View>
        </Photo>

        <View style={styles.body}>
          <Animated.View entering={enter.rise(4)} style={[styles.notice, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
            <Icon name="clock" size={18} color={t.c.textSecondary} />
            <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
              {s.notice}
            </Text>
          </Animated.View>

          <Text variant="overline" tone="secondary" style={styles.overline}>
            What we’re preparing
          </Text>
          {s.preparing.map((p, i) => (
            <Animated.View key={p.title} entering={enter.rise(i, 260)} style={[styles.row, { borderColor: t.c.line }]}>
              <View style={[styles.rowIcon, { backgroundColor: t.c.overlay }]}>
                <Icon name={p.icon} size={18} color={t.c.text} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="titleS">{p.title}</Text>
                <Text variant="bodyS" tone="secondary">
                  {p.body}
                </Text>
              </View>
            </Animated.View>
          ))}

          {s.liveNow ? (
            <>
              <Text variant="overline" tone="secondary" style={styles.overline}>
                Already on IRLY
              </Text>
              <Animated.View entering={enter.rise(0, 420)}>
                <PressableScale onPress={() => router.push(s.liveNow!.href as never)} scaleTo={0.98} accessibilityLabel={`${s.liveNow.label}. ${s.liveNow.caption}`} style={[styles.live, { backgroundColor: t.c.text }]}>
                  <Icon name={s.liveNow.icon} size={20} color={t.c.bg} />
                  <View style={{ flex: 1 }}>
                    <Text variant="titleS" color={t.c.bg}>
                      {s.liveNow.label}
                    </Text>
                    <Text variant="caption" color={t.c.bg} style={{ opacity: 0.7 }}>
                      {s.liveNow.caption}
                    </Text>
                  </View>
                  <Icon name="arrowRight" size={18} color={t.c.bg} />
                </PressableScale>
              </Animated.View>
            </>
          ) : null}

          <Animated.View entering={FadeIn.delay(480)} style={styles.cta}>
            <Button
              label={interest.on ? 'We’ll tell you when it opens' : 'Tell me when it opens'}
              icon={interest.on ? 'check' : 'bell'}
              variant={interest.on ? 'secondary' : 'primary'}
              loading={interest.busy}
              onPress={notify}
            />
            {interest.on ? (
              <Text variant="caption" tone="tertiary" align="center">
                Tap again to stop. We’ll let you know in IRLY when it opens.
              </Text>
            ) : null}
          </Animated.View>
        </View>
      </ScrollView>
      <View style={[styles.back, { top: insets.top + 10 }]}>
        <IconButton icon="arrowLeft" label="Back" variant="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/discover'))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { minHeight: 460, justifyContent: 'flex-end', paddingHorizontal: space.gutter, paddingBottom: space[7], gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  body: { paddingHorizontal: space.gutter, paddingTop: space[6], gap: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  overline: { marginTop: space[5] },
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg },
  cta: { marginTop: space[6], gap: 10 },
  back: { position: 'absolute', left: space.gutter },
});
