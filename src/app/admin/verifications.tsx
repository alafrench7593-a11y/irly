import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useSignedLinks } from '@/features/server/media';
import { decide, GESTURES, loadQueue, type PendingVerification } from '@/features/verify/verify';
import { a11y, t as tx } from '@/i18n';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * IRLY admins: selfies waiting for review. Compare the selfie (and its
 * gesture) with the profile photos, then approve or refuse with a reason.
 * The selfie is deleted right after the decision.
 */
export default function VerificationQueue() {
  const t = useTheme();
  const [items, setItems] = useState<PendingVerification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    loadQueue()
      .then((q) => {
        setItems(q);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, []);
  useEffect(load, [load]);
  return (
    <Page title="Verifications" subtitle="Compare each selfie and its gesture with the profile photos. The selfie is deleted after your decision.">
      <View style={styles.body}>
        {error ? (
          <Text variant="body" tone="secondary">
            {tx(error)}
          </Text>
        ) : items === null ? (
          <ActivityIndicator color={t.c.text} />
        ) : !items.length ? (
          <Text variant="body" tone="secondary">
            Nothing to review.
          </Text>
        ) : (
          items.map((v) => <Review key={v.requestId} v={v} onDone={() => setItems((list) => (list ?? []).filter((x) => x.requestId !== v.requestId))} />)
        )}
      </View>
    </Page>
  );
}

function Review({ v, onDone }: { v: PendingVerification; onDone: () => void }) {
  const t = useTheme();
  const now = useNow();
  const photos = useSignedLinks('profile-photos', v.photos);
  const selfie = useSignedLinks('verifications', [v.selfie]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const act = async (approve: boolean) => {
    if (!approve && !reason.trim()) {
      toast('Write the reason the member will read', 'x', 'live');
      return;
    }
    setBusy(approve ? 'yes' : 'no');
    try {
      await decide(v.requestId, approve, approve ? undefined : reason.trim());
      toast(approve ? tx('{name} is verified', { name: v.firstName }) : tx('Declined'), 'check', 'brand');
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };
  const g = GESTURES[v.gesture];
  return (
    <View style={[styles.card, { backgroundColor: t.c.surface }]}>
      <Text variant="titleS" raw>
        {v.firstName} · {timeAgo(Math.max(0, Math.round((now - v.submittedAt) / 60000)))}
      </Text>
      <Text variant="bodyS" tone="secondary">
        {tx('Asked gesture: {emoji} {text}', { emoji: g.emoji, text: tx(g.text) })}
      </Text>
      <View style={styles.row}>
        <View style={{ gap: 4 }}>
          <Text variant="caption" tone="tertiary">
            Selfie
          </Text>
          <View style={[styles.selfie, { backgroundColor: t.c.overlay }]}>{v.selfie && selfie[v.selfie] ? <Image source={{ uri: selfie[v.selfie] }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 18 }}>
          {v.photos.map((p) => (
            <View key={p} style={[styles.photo, { backgroundColor: t.c.overlay }]}>
              {photos[p] ? <Image source={{ uri: photos[p] }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
          ))}
        </ScrollView>
      </View>
      <TextInput value={reason} onChangeText={(x) => setReason(x.slice(0, 200))} placeholder={tx('Reason if you decline (the member reads it)')} placeholderTextColor={t.c.textTertiary} style={[styles.input, { color: t.c.text, backgroundColor: t.c.overlay }]} accessibilityLabel={a11y('Reason')} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button label="Approve" icon="check" full loading={busy === 'yes'} disabled={busy !== null} onPress={() => act(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Decline" icon="x" variant="secondary" full loading={busy === 'no'} disabled={busy !== null} onPress={() => act(false)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[4] },
  card: { padding: 14, gap: 10, borderRadius: radius.xl },
  row: { flexDirection: 'row', gap: 10 },
  selfie: { width: 120, height: 160, borderRadius: radius.md, overflow: 'hidden' },
  photo: { width: 90, height: 120, borderRadius: radius.md, overflow: 'hidden' },
  input: { height: 44, borderRadius: radius.lg, paddingHorizontal: 12, fontFamily: font.medium, fontSize: 15 },
});
