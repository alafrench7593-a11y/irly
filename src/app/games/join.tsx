import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAccount } from '@/features/auth/account';
import { joinByCode } from '@/features/games/api';
import { t as tx } from '@/i18n';
import { space } from '@/theme/tokens';

/**
 * The link of a game's QR code (/games/join?code=…, in person): joins the
 * table with its code, then opens it. Signed out: sign in first.
 */
export default function JoinGameScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const account = useAccount();
  const [error, setError] = useState<string | null>(null);
  const clean = (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  useEffect(() => {
    if (!account || clean.length !== 6) return;
    joinByCode(clean)
      .then((id) => router.replace(`/games/${id}`))
      .catch((e: Error) => setError(e.message));
  }, [account, clean, router]);
  return (
    <Page title="Join a game">
      <View style={styles.pad}>
        {!account ? (
          <>
            <Text tone="secondary">Sign in to play with other IRLY members.</Text>
            <Button label="Sign in" onPress={() => router.push('/account')} />
          </>
        ) : clean.length !== 6 ? (
          <Text tone="secondary">This link has no game code.</Text>
        ) : error ? (
          <>
            <Text tone="secondary" raw>
              {tx(error)}
            </Text>
            <Button label="IRLY Games" onPress={() => router.replace('/games')} />
          </>
        ) : (
          <Text tone="tertiary">Joining…</Text>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({ pad: { paddingHorizontal: space.gutter, gap: space[5] } });
