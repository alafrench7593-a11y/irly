import { Redirect, useLocalSearchParams } from 'expo-router';
import { GamesHome } from '@/features/games/GamesHome';

/**
 * IRLY Games: the platform's home, with the games that can be played
 * (features/games/catalog). Loup-Garou's own home is /games/werewolf; links
 * shared before with ?mode= still land on it.
 */
export default function GamesScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  if (mode) return <Redirect href={{ pathname: '/games/werewolf', params: { mode } }} />;
  return <GamesHome />;
}
