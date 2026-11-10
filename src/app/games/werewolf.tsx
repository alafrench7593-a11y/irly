import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAccount } from '@/features/auth/account';
import { toMode } from '@/features/games/werewolf/cards';
import { WerewolfHome } from '@/features/games/werewolf/home/WerewolfHome';
import { hasBackend } from '@/lib/supabase';
import { space } from '@/theme/tokens';

/** Loup-Garou, a game of IRLY Games: its home (modes, play online, against AI, tables, characters, rules). ?mode= opens it on a mode. */
export default function WerewolfScreen() {
  const router = useRouter();
  const account = useAccount();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  if (!hasBackend || !account) {
    return (
      <Page title="Loup-Garou" subtitle="Play together, meet in real life">
        <View style={styles.pad}>
          <Text tone="secondary">Sign in to play with other IRLY members.</Text>
          <Button label="Sign in" onPress={() => router.push('/account')} />
        </View>
      </Page>
    );
  }
  return <WerewolfHome initialMode={toMode(mode)} />;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter, gap: space[5] },
});
