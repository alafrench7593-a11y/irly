import { Redirect, useLocalSearchParams } from 'expo-router';
import { SoonPage, soonIdOf } from '@/features/soon/SoonPage';
import { FEATURES } from '@/lib/features';

/**
 * /soon/[id]: the teaser page of a service IRLY is preparing. An unknown id
 * shows IRLY PRO, as before. Once Match IRLY is switched on, its teaser
 * hands over to the real screen so old links keep working.
 */
export default function SoonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const soonId = soonIdOf(id) ?? 'pro';
  if (soonId === 'match' && FEATURES.matchIrly) return <Redirect href="/match" />;
  return <SoonPage id={soonId} />;
}
