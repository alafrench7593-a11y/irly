import { useRouter } from 'expo-router';
import { useStore } from '@/state/store';
import { t as tx } from '@/i18n';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useAreaProfiles } from '@/features/bali/data';
import { useBaliStore } from '@/features/bali/baliStore';
import { buildTestPlan, rankAreas, type PlanLength, type PlanTheme } from '@/features/bali/fit';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const ICON: Record<PlanTheme, IconName> = {
  arrive: 'plane', explore: 'footprints', cowork: 'laptop', community: 'users', wellness: 'leaf', food: 'utensils',
  family: 'baby', housing: 'home', healthcare: 'shield', social: 'sparkles', nature: 'mountain', decide: 'check',
};

/**
 * TEST BALI BEFORE YOU MOVE: a day-by-day plan across your best-fit areas
 * (from the quiz), mixing exploring, working, meeting people and the
 * practical checks (housing, healthcare). Each day opens real IRLY results.
 */
export default function BaliTest() {
  const t = useTheme();
  const router = useRouter();
  // Search and Communities follow the current city: show Bali's.
  const setCity = useStore((st) => st.setCity);
  const answers = useBaliStore((s) => s.answers);
  const profiles = useAreaProfiles('bali');
  const [length, setLength] = useState<PlanLength>(14);
  const hasQuiz = Object.keys(answers).length > 0;
  const plan = useMemo(() => buildTestPlan(rankAreas(profiles.data, hasQuiz ? answers : { social: 'some', beach: 'some' }), length, answers), [profiles.data, answers, hasQuiz, length]);

  return (
    <Page overline="Test Bali" title="Live it before you move" subtitle={hasQuiz ? 'Built from your quiz answers.' : 'Take the quiz for a plan made for you.'}>
      <View style={styles.body}>
        <Segmented
          options={[
            { value: '7', label: tx('7 days') },
            { value: '14', label: tx('14 days') },
            { value: '30', label: tx('30 days') },
            { value: '60', label: tx('60 days') },
          ]}
          value={String(length)}
          onChange={(v) => setLength(Number(v) as PlanLength)}
        />
        {!hasQuiz ? <Button label="Take the quiz first" icon="compass" variant="secondary" full onPress={() => router.push('/bali/quiz')} /> : null}
        {plan.map((d) => (
          <PressableScale
            key={d.day}
            onPress={() => (d.theme === 'housing' || d.theme === 'healthcare' ? router.push(`/bali/guide/${d.theme}`) : (setCity('bali'), router.push(`/search?q=${encodeURIComponent(d.search)}`)))}
            haptic="select"
            scaleTo={0.98}
            style={[styles.day, { backgroundColor: t.c.surface }]}
            accessibilityLabel={`Day ${d.day}: ${d.title}`}
          >
            <View style={[styles.num, { backgroundColor: t.c.bg }]}>
              <Text variant="label">{d.day}</Text>
            </View>
            <Icon name={ICON[d.theme]} size={18} color={t.c.text} />
            <Text variant="bodyS" style={{ flex: 1 }}>
              {d.title.replace(/: (.+)$/, (_, task: string) => `: ${tx(task)}`)}
            </Text>
            <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
          </PressableScale>
        ))}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: 10 },
  day: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
