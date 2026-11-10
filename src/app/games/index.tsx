import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAccount } from '@/features/auth/account';
import { MODES, type WwMode } from '@/features/games/werewolf/cards';
import { WerewolfHome } from '@/features/games/werewolf/home/WerewolfHome';
import { hasBackend } from '@/lib/supabase';
import { space } from '@/theme/tokens';

/**
 * IRLY Games. For now one game, Loup-Garou, in three modes (Classic, Dubaï,
 * Chaos): Ludo is put aside (its tables still open from a link, nothing is
 * deleted). ?mode= opens the home on a mode.
 */
export default function GamesScreen() {
  const router = useRouter();
  const account = useAccount();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  if (!hasBackend || !account) {
    return (
      <Page title="IRLY Games" subtitle="Play together, meet in real life">
        <View style={styles.pad}>
          <Text tone="secondary">Sign in to play with other IRLY members.</Text>
          <Button label="Sign in" onPress={() => router.push('/account')} />
        </View>
      </Page>
    );
  }
  return <WerewolfHome initialMode={MODES.includes(mode as WwMode) ? (mode as WwMode) : 'classic'} />;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter, gap: space[5] },
});
