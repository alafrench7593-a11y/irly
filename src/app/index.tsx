import { Redirect } from 'expo-router';
import { useStore } from '@/state/store';

/** Entry gate: first launch goes through the destination onboarding. */
export default function Index() {
  const onboarded = useStore((s) => s.onboarded);
  const cityId = useStore((s) => s.cityId);
  return <Redirect href={onboarded && cityId ? '/(tabs)' : '/welcome'} />;
}
