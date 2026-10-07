import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { useAreaProfiles } from '@/features/bali/data';
import { useBaliStore } from '@/features/bali/baliStore';
import { QUIZ, rankAreas, type QuizAnswers } from '@/features/bali/fit';
import { track } from '@/lib/analytics';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * WHERE SHOULD I LIVE IN BALI? One question at a time, then the top 3
 * areas with a score and the reasons for it, computed from the IRLY Guide
 * area ratings. No prices and no promises: just a fit, explained.
 */
export default function BaliQuiz() {
  const t = useTheme();
  const router = useRouter();
  const saved = useBaliStore((s) => s.answers);
  const setSaved = useBaliStore((s) => s.setAnswers);
  const profiles = useAreaProfiles('bali');
  // Until the member starts answering, show what is saved. Saved answers
  // load from storage after the first render, so they are read, not copied.
  const [local, setLocal] = useState<{ answers: QuizAnswers; step: number } | null>(null);
  const savedDone = Object.keys(saved).length >= QUIZ.length;
  const answers = local?.answers ?? saved;
  const step = local?.step ?? (savedDone ? QUIZ.length : 0);
  const setStep = (n: number) => setLocal((l) => ({ answers: l?.answers ?? answers, step: n }));
  const done = step >= QUIZ.length;
  const ranked = useMemo(() => (done ? rankAreas(profiles.data, answers) : []), [done, profiles.data, answers]);
  const q = QUIZ[step];

  const answer = (value: string) => {
    const next = { ...answers, [q.id]: value } as QuizAnswers;
    setLocal({ answers: next, step: step + 1 });
    haptic('select');
    if (step + 1 >= QUIZ.length) {
      setSaved(next);
      track('BALI_QUIZ_DONE', { questions: QUIZ.length });
    }
  };

  if (!done) {
    return (
      <Page overline={tx('Question {n} of {total}', { n: step + 1, total: QUIZ.length })} title="Where should I live in Bali?">
        <Animated.View key={step} entering={FadeInDown.springify(380).dampingRatio(0.85)} style={styles.body}>
          <View style={[styles.progress, { backgroundColor: t.c.overlay }]}>
            <View style={{ width: `${(step / QUIZ.length) * 100}%`, height: '100%', backgroundColor: t.c.text, borderRadius: 2 }} />
          </View>
          <Text variant="displayM">{tx(q.label)}</Text>
          <View style={{ gap: 10 }}>
            {q.options.map((o) => (
              <PressableScale key={o.value} onPress={() => answer(o.value)} haptic={false} scaleTo={0.98} style={[styles.option, { backgroundColor: t.c.surface, borderColor: answers[q.id] === o.value ? t.c.text : t.c.line }]} accessibilityLabel={o.label}>
                <Text variant="titleS">{tx(o.label)}</Text>
              </PressableScale>
            ))}
          </View>
          {step > 0 ? <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
        </Animated.View>
      </Page>
    );
  }

  return (
    <Page overline="Your top 3" title="Where you'd fit best" subtitle="Based on your answers and the IRLY Guide area ratings. Visit before you decide.">
      <Animated.View entering={FadeIn.duration(260)} style={styles.body}>
        {profiles.loading ? <Text variant="body" tone="secondary">Loading areas…</Text> : null}
        {ranked.slice(0, 3).map((f, i) => (
          <PressableScale key={f.area.areaId} onPress={() => router.push(`/bali/area/${f.area.areaId}`)} haptic="select" scaleTo={0.98} style={[styles.result, { backgroundColor: i === 0 ? t.c.brand : t.c.surface }]} accessibilityLabel={`${f.area.name} ${f.score}%`}>
            <View style={styles.resultHead}>
              <Text variant="titleL" color={i === 0 ? t.c.onBrand : undefined}>
                {f.area.name}
              </Text>
              <Text variant="displayM" color={i === 0 ? t.c.onBrand : undefined}>
                {f.score}%
              </Text>
            </View>
            <Text variant="bodyS" color={i === 0 ? t.c.onBrand : undefined} tone={i === 0 ? undefined : 'secondary'}>
              {f.area.tagline}
            </Text>
            <View style={styles.wrap}>
              {f.why.map((w) => (
                <Chip key={w} size="sm" icon="check" label={reason(w)} selected={i !== 0} />
              ))}
              {f.watch.map((w) => (
                <Chip key={w} size="sm" icon="minus" label={reason(w)} />
              ))}
            </View>
          </PressableScale>
        ))}
        <Button label="Test these areas before moving" icon="plane" full onPress={() => router.push('/bali/test')} />
        <Button label="Start my Bali move" icon="package" variant="secondary" full onPress={() => router.push('/bali/move')} />
        <Button
          label="Retake the quiz"
          variant="ghost"
          onPress={() => {
            setLocal({ answers: {}, step: 0 });
          }}
        />
        <Text variant="caption" tone="tertiary">
          The score compares what you asked for with our editorial ratings of each area. It is a starting point, not advice.
        </Text>
      </Animated.View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[5] },
  progress: { height: 4, borderRadius: 2, overflow: 'hidden' },
  option: { padding: 18, borderRadius: radius.lg, borderWidth: 1.5 },
  result: { padding: 18, borderRadius: radius.xl, gap: 10 },
  resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

/** "Strong for surf" → "Idéal pour le surf": the sentence and the trait are translated separately. */
function reason(w: string): string {
  const m = w.match(/^(Strong|Weaker) for (.+)$/);
  return m ? tx(`${m[1]} for {what}`, { what: tx(m[2]) }) : tx(w);
}
