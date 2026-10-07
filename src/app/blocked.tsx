import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
import { unblockUser, useBlocked } from '@/features/moderation/moderation';
import { useT } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const hueOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** The members you blocked, to unblock them (Settings → Blocked members). */
export default function BlockedMembers() {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const account = useAccount();
  const { list, loading, error, refresh } = useBlocked();
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <Page overline="Settings" title="Blocked members" subtitle="People you blocked cannot see you, contact you or appear in your suggestions.">
      <View style={styles.body}>
        {!account ? (
          <Button label="Sign in" icon="user" onPress={() => router.push('/account')} />
        ) : error ? (
          <View style={{ gap: 10 }}>
            <Text variant="body" tone="secondary">
              Can’t reach IRLY right now. Check your connection.
            </Text>
            <Button label="Try again" variant="secondary" onPress={refresh} />
          </View>
        ) : loading ? null : !list.length ? (
          <Text variant="body" tone="secondary">
            You have not blocked anyone.
          </Text>
        ) : (
          list.map((b) => (
            <View key={b.userId} style={[styles.row, { backgroundColor: t.c.surface }]}>
              <Avatar name={b.firstName} hue={hueOf(b.userId)} size={44} />
              <Text variant="titleS" style={{ flex: 1 }} raw>
                {b.firstName}
              </Text>
              <Button
                label="Unblock"
                size="sm"
                variant="secondary"
                loading={busy === b.userId}
                onPress={() =>
                  confirm(
                    tr('Unblock {name}? You may see each other again.', { name: b.firstName }),
                    () => {
                      setBusy(b.userId);
                      unblockUser(b.userId)
                        .then(() => {
                          toast(tr('{name} is unblocked', { name: b.firstName }), 'check', 'brand');
                          refresh();
                        })
                        .catch(() => toast(tr('Could not unblock. Try again.'), 'x', 'live'))
                        .finally(() => setBusy(null));
                    },
                    'Unblock',
                  )
                }
              />
            </View>
          ))
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
});
