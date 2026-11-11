import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAccount } from '@/features/auth/account';
import { WerewolfHome } from '@/features/games/werewolf/home/WerewolfHome';
import { hasBackend } from '@/lib/supabase';
import { space } from '@/theme/tokens';

/** IRLY Loup-Garou · Dubaï: the games' home, opened on the Dubaï mode (links already shared keep working). */
export default function DubaiHomeScreen() {
  const router = useRouter();
  const account = useAccount();
  // The same door as /games/werewolf: the game is played signed in.
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
  return <WerewolfHome initialMode="dubai" />;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter, gap: space[5] },
});
