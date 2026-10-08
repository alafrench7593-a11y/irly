import { Redirect } from 'expo-router';
import { STORY_VERSION } from '@/features/onboarding/IrlyStory';
import { useStore } from '@/state/store';

/** Entry gate: first launch goes through the destination onboarding. */
export default function Index() {
  const onboarded = useStore((s) => s.onboarded);
  const cityId = useStore((s) => s.cityId);
  const storySeen = useStore((s) => s.storySeen);
  if (!onboarded || !cityId) return <Redirect href="/welcome" />;
  // Members who joined before the current intro story see it once.
  return <Redirect href={storySeen < STORY_VERSION ? '/story' : '/(tabs)'} />;
}
