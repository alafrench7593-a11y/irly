import { useRouter } from 'expo-router';
import { useStore } from '@/state/store';
import { t as tx } from '@/i18n';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useMove } from '@/features/bali/data';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const SECTIONS = ['visa', 'housing', 'banking', 'sim', 'internet', 'transport', 'healthcare', 'insurance', 'schools', 'childcare', 'work', 'coworking', 'business', 'accounting', 'tax', 'legal', 'real_estate', 'moving', 'pets', 'services'];
const label = (s: string) => tx(s === 'sim' ? 'SIM / eSIM' : s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()));

/**
 * MY BALI MOVE: relocation, separate from tourism. A checklist saved on the
 * server (tick what's done), and every topic's guide with its sources.
 */
export default function BaliMove() {
  const t = useTheme();
  const router = useRouter();
  // Search and Communities follow the current city: show Bali's.
  const setCity = useStore((st) => st.setCity);
  const { data: steps, toggle, signedIn } = useMove('bali');
  const done = steps.filter((s) => s.done).length;

  const tick = (s: (typeof steps)[number]) => {
    toggle(s)
      .then(() => haptic(s.done ? 'select' : 'success'))
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live'));
  };

  return (
    <Page overline="Relocation" title="My Bali move" subtitle={steps.length ? tx('{done} of {total} done', { done, total: steps.length }) : undefined}>
      <View style={styles.body}>
        {steps.length ? (
          <View style={[styles.progress, { backgroundColor: t.c.overlay }]}>
            <View style={{ width: `${(done / steps.length) * 100}%`, height: '100%', backgroundColor: t.c.positive, borderRadius: 3 }} />
          </View>
        ) : null}
        {!signedIn ? (
          <View style={[styles.note, { backgroundColor: t.c.surface }]}>
            <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
              Sign in to save your progress across devices.
            </Text>
            <Button label="Sign in" size="sm" onPress={() => router.push('/account')} />
          </View>
        ) : null}
        <View style={[styles.list, { backgroundColor: t.c.surface }]}>
          {steps.map((s, i) => (
            <View key={s.id} style={[styles.step, i ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.c.line } : null]}>
              <PressableScale onPress={() => tick(s)} haptic={false} scaleTo={0.9} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: s.done }} accessibilityLabel={s.label}>
                <View style={[styles.box, { borderColor: s.done ? t.c.positive : t.c.lineStrong, backgroundColor: s.done ? t.c.positive : 'transparent' }]}>
                  {s.done ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                </View>
              </PressableScale>
              <Text variant="titleS" style={{ flex: 1, textDecorationLine: s.done ? 'line-through' : 'none' }} tone={s.done ? 'tertiary' : undefined}>
                {tx(s.label)}
              </Text>
              {s.section ? (
                <PressableScale onPress={() => router.push(`/bali/guide/${s.section}`)} haptic="select" hitSlop={8} accessibilityLabel={`${s.label} guide`}>
                  <Text variant="label" tone="secondary">
                    Guide
                  </Text>
                </PressableScale>
              ) : (
                <PressableScale onPress={() => {
                  setCity('bali');
                  router.push(s.id === 'community' ? '/communities' : '/discover');
                }} haptic="select" hitSlop={8} accessibilityLabel={s.label}>
                  <Text variant="label" tone="secondary">
                    Find
                  </Text>
                </PressableScale>
              )}
            </View>
          ))}
        </View>

        <Text variant="titleM" style={{ marginTop: space[4] }}>
          Every topic
        </Text>
        <View style={styles.wrap}>
          {SECTIONS.map((s) => (
            <Chip key={s} size="sm" label={label(s)} onPress={() => router.push(`/bali/guide/${s}`)} />
          ))}
        </View>
        <Button label="Where should I live?" icon="compass" variant="secondary" full onPress={() => router.push('/bali/quiz')} />
        <Button label="Girls moving to Bali" icon="heartHandshake" variant="secondary" full onPress={() => router.push('/girl/moving')} />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: 12 },
  progress: { height: 6, borderRadius: 3, overflow: 'hidden' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg },
  list: { borderRadius: radius.xl, overflow: 'hidden' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 56 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
