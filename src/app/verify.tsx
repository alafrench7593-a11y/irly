import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { FEATURES } from '@/lib/features';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
import { isAvatar } from '@/features/avatar/avatar';
import { useSignedLinks } from '@/features/server/media';
import { addProfilePhotos, GESTURES, MAX_PHOTOS, MIN_PHOTOS, removeProfilePhoto, startVerification, submitSelfie, takeSelfie, useMyVerification, type Gesture } from '@/features/verify/verify';
import { a11y, t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Verify my profile (needed for Match): 3 photos of me, then a selfie
 * doing the gesture the server asks for. A person at IRLY compares it with
 * the photos; the selfie is deleted after the decision.
 */
export default function VerifyScreen() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { v, paths, loading, failed, reload } = useMyVerification();
  const links = useSignedLinks('profile-photos', paths);
  const [busy, setBusy] = useState<'photos' | 'selfie' | null>(null);
  const [challenge, setChallenge] = useState<{ requestId: string; gesture: Gesture } | null>(null);
  const real = paths.filter((p) => !isAvatar(p));
  const enough = real.length >= MIN_PHOTOS;

  const add = async () => {
    setBusy('photos');
    try {
      await addProfilePhotos(paths);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add photos', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };
  const begin = async () => {
    setBusy('selfie');
    try {
      setChallenge(await startVerification());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };
  const shoot = async () => {
    if (!challenge) return;
    setBusy('selfie');
    try {
      const uri = await takeSelfie();
      if (!uri) return;
      await submitSelfie(challenge.requestId, uri);
      haptic('success');
      toast('Selfie sent: a person at IRLY will review it', 'check', 'brand');
      setChallenge(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The selfie could not be sent. Try again.', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };

  const status = v?.verifiedAt ? 'verified' : v?.status === 'pending' ? 'pending' : v?.status === 'rejected' ? 'rejected' : null;
  const g = challenge ? GESTURES[challenge.gesture] : null;

  return (
    <Page title="Verify my profile" subtitle="Needed for Match. A person at IRLY compares a selfie with your photos: no automatic face recognition.">
      <View style={styles.body}>
        {!account ? (
          <Button label="Sign in" onPress={() => router.push('/account')} />
        ) : failed ? (
          <View style={{ gap: 12 }}>
            <Text variant="bodyS" tone="secondary">
              Could not load your photos. Try again.
            </Text>
            <Button label="Try again" variant="secondary" onPress={reload} />
          </View>
        ) : loading ? (
          <ActivityIndicator color={t.c.text} />
        ) : (
          <>
            {status ? (
              <View style={[styles.card, { backgroundColor: t.c.surface }]}>
                <Icon name={status === 'verified' ? 'shield' : status === 'pending' ? 'clock' : 'x'} size={20} color={t.c.text} />
                <Text variant="titleS">{status === 'verified' ? tx('Your profile is verified ✓') : status === 'pending' ? tx('Your selfie is being reviewed') : tx('Verification declined')}</Text>
                <Text variant="bodyS" tone="secondary">
                  {status === 'verified'
                    ? FEATURES.matchIrly
                      ? tx('The badge shows on your profile and Match is open. Adding a new photo asks for a new check.')
                      : tx('The badge shows on your profile. Adding a new photo asks for a new check.')
                    : status === 'pending'
                      ? tx('Usually within a day. You will get a notification.')
                      : v?.reason
                        ? tx('Reason: {reason}. You can try again.', { reason: v.reason })
                        : tx('You can try again.')}
                </Text>
                {v?.ready && FEATURES.matchIrly ? <Button label="Open Match" icon="sparkles" onPress={() => router.replace('/match')} /> : null}
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              <Text variant="overline" tone="secondary">
                {tx('1 · Photos of you ({n}/{min})', { n: real.length, min: MIN_PHOTOS })}
              </Text>
              <View style={styles.grid}>
                {paths.map((p, i) => (
                  <View key={p} style={[styles.photo, { backgroundColor: t.c.overlay }]}>
                    {links[p] && !isAvatar(p) ? <Image source={{ uri: links[p], cacheKey: p }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="user" size={22} color={t.c.textTertiary} />}
                    {i > 0 ? (
                      <PressableScale
                        haptic="select"
                        hitSlop={8}
                        style={styles.remove}
                        onPress={() =>
                          removeProfilePhoto(paths, p)
                            .then(reload)
                            .catch((e) => toast(e instanceof Error ? e.message : 'Could not remove', 'x', 'live'))
                        }
                        accessibilityLabel={a11y('Remove this photo')}
                      >
                        <Icon name="x" size={12} color="#fff" />
                      </PressableScale>
                    ) : (
                      <View style={styles.main}>
                        <Text variant="caption" style={{ color: '#fff' }}>
                          {tx('Main')}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
                {paths.length < MAX_PHOTOS ? (
                  <PressableScale haptic="select" onPress={add} disabled={busy !== null} style={[styles.photo, styles.add, { borderColor: t.c.lineStrong }]} accessibilityLabel={a11y('Add photos')}>
                    {busy === 'photos' ? <ActivityIndicator color={t.c.text} /> : <Icon name="plus" size={22} color={t.c.text} />}
                  </PressableScale>
                ) : null}
              </View>
              <Text variant="caption" tone="tertiary">
                Clear photos of your face, only you. IRLY avatars do not count.
              </Text>
            </View>

            {status !== 'verified' && status !== 'pending' ? (
              <View style={{ gap: 8 }}>
                <Text variant="overline" tone="secondary">
                  2 · A selfie with a gesture
                </Text>
                {!g ? (
                  <>
                    <Text variant="bodyS" tone="secondary">
                      IRLY picks a gesture at random; take the selfie with the front camera, now. It is only seen by the IRLY team and deleted after the review.
                    </Text>
                    <Button label="Get my gesture" icon="scanFace" full disabled={!enough} loading={busy === 'selfie'} onPress={begin} />
                    {!enough ? (
                      <Text variant="caption" tone="tertiary">
                        {tx('Add {n} more photo(s) first.', { n: MIN_PHOTOS - real.length })}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <View style={[styles.card, { backgroundColor: t.c.surface, alignItems: 'center' }]}>
                    <Text style={{ fontSize: 56 }} raw>
                      {g.emoji}
                    </Text>
                    <Text variant="titleM" align="center">
                      {tx(g.text)}
                    </Text>
                    <Button label="Take the selfie" icon="camera" full loading={busy === 'selfie'} onPress={shoot} />
                  </View>
                )}
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: t.c.surface }]}>
              <Text variant="titleS">Your privacy</Text>
              <Text variant="bodyS" tone="secondary">
                The selfie is stored privately, seen only by the IRLY team member who reviews it, and deleted after the decision. No face data is extracted or kept. You can delete your photos at any time.
              </Text>
            </View>
          </>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[5] },
  card: { padding: 16, gap: 10, borderRadius: radius.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 100, height: 124, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 1, borderStyle: 'dashed' },
  remove: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  main: { position: 'absolute', bottom: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)' },
});
