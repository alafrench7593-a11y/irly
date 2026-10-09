import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/Controls';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { INTERESTS } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import { useSignedLinks } from '@/features/server/media';
import { openReport } from '@/features/moderation/reportStore';
import { t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openDirect, setFollow, useMemberProfile } from './member';

/**
 * A real member's profile (server): only what they let you see. Followers
 * and following come from the follows table; Follow is shown as done only
 * once the server has it; Message opens the private chat when their
 * settings allow it, and says why when they do not.
 */
export function MemberProfileView({ userId }: { userId: string }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { profile: p, communities, loading, error, reload, signedIn } = useMemberProfile(userId);
  const faces = useSignedLinks('profile-photos', [p?.photo]);
  const covers = useSignedLinks('activity-photos', communities.map((c) => c.cover));
  const [busy, setBusy] = useState<'follow' | 'message' | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/messages'));

  const follow = async () => {
    if (!p || busy) return;
    setBusy('follow');
    try {
      await setFollow(p.id, !p.iFollow);
      haptic(p.iFollow ? 'select' : 'success');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };
  const message = async () => {
    if (!p || busy) return;
    if (p.directId) {
      router.push(`/messages/${p.directId}`);
      return;
    }
    setBusy('message');
    try {
      const id = await openDirect(p.id);
      router.push(`/messages/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };

  if (!signedIn)
    return (
      <Centered onBack={back}>
        <Text variant="titleM" align="center">
          Sign in to see this profile
        </Text>
        <Button label="Sign in" onPress={() => router.push('/account')} />
      </Centered>
    );
  if (loading)
    return (
      <Centered onBack={back}>
        <ActivityIndicator color={t.c.text} />
      </Centered>
    );
  if (error)
    return (
      <Centered onBack={back}>
        <Text variant="body" tone="secondary" align="center">
          {error}
        </Text>
        <Button label="Try again" variant="secondary" onPress={reload} />
      </Centered>
    );
  if (!p)
    return (
      <Centered onBack={back}>
        <Text variant="titleM" align="center">
          This person is no longer on IRLY
        </Text>
      </Centered>
    );

  const city = p.cityId ? CITIES[p.cityId as keyof typeof CITIES] : undefined;
  const photo = p.photo ? faces[p.photo] : undefined;
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.cover, { height: insets.top + 170 }]}>
          <Photo visual={{ photo: city?.photo ?? 'dubai' }} light={city?.light ?? 'dubai'} scrim="full" width={1000} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.identity}>
          <Animated.View entering={reduced ? undefined : enter.pop(0)} style={[styles.ring, { borderColor: t.c.bg, boxShadow: t.shadow.float }]}>
            <Avatar name={p.firstName} hue={hueOf(p.id)} size={104} photo={photo} />
          </Animated.View>
          <Animated.View entering={reduced ? undefined : enter.rise(1)} style={{ alignItems: 'center', gap: 2 }}>
            <Text variant="displayL" raw>
              {p.firstName}
            </Text>
            {city ? (
              <Text variant="body" tone="secondary">
                {city.name}
              </Text>
            ) : null}
            {p.followsMe && !p.isMe ? (
              <Text variant="caption" tone="tertiary">
                Follows you
              </Text>
            ) : null}
          </Animated.View>

          <Animated.View entering={reduced ? undefined : enter.rise(2)} style={styles.counts}>
            <Count n={p.followers} label="Followers" onPress={p.visible ? () => router.push(`/follows/${p.id}?which=followers`) : undefined} />
            <View style={[styles.sep, { backgroundColor: t.c.line }]} />
            <Count n={p.following} label="Following" onPress={p.visible ? () => router.push(`/follows/${p.id}?which=following`) : undefined} />
          </Animated.View>

          {p.isMe ? (
            <Button label="Edit my profile" icon="user" variant="secondary" onPress={() => router.push('/edit-profile')} />
          ) : (
            <Animated.View entering={reduced ? undefined : enter.rise(3)} style={styles.buttons}>
              <View style={{ flex: 1 }}>
                <Button
                  label={p.iFollow ? 'Following' : p.followsMe ? 'Follow back' : 'Follow'}
                  icon={p.iFollow ? 'userCheck' : 'userPlus'}
                  variant={p.iFollow ? 'secondary' : 'primary'}
                  loading={busy === 'follow'}
                  full
                  onPress={follow}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Message" icon="message" variant="secondary" loading={busy === 'message'} full disabled={!p.canMessage} onPress={message} />
              </View>
            </Animated.View>
          )}
          {!p.isMe && !p.canMessage ? (
            <Text variant="caption" tone="tertiary" align="center" style={{ paddingHorizontal: space.gutter }}>
              {tx('{name} only accepts messages from friends or people met on IRLY. Following does not open a chat.', { name: p.firstName })}
            </Text>
          ) : null}
        </View>

        {!p.visible ? (
          <Animated.View entering={FadeIn} style={[styles.card, { backgroundColor: t.c.surface }]}>
            <Icon name="lock" size={18} color={t.c.textSecondary} />
            <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
              {tx('{name} keeps their profile private. You see their name and photo only.', { name: p.firstName })}
            </Text>
          </Animated.View>
        ) : (
          <>
            {p.bio ? (
              <Animated.View entering={reduced ? undefined : enter.rise(4)} style={styles.section}>
                <Text variant="overline" tone="tertiary">
                  About
                </Text>
                <Text variant="bodyL" tone="secondary" raw>
                  {p.bio}
                </Text>
              </Animated.View>
            ) : null}
            {p.interests.length ? (
              <Animated.View entering={reduced ? undefined : enter.rise(5)} style={styles.section}>
                <Text variant="overline" tone="tertiary">
                  Into
                </Text>
                <View style={styles.wrap}>
                  {p.interests.map((i) => {
                    const it = INTERESTS[i as keyof typeof INTERESTS];
                    return (
                      <View key={i} style={[styles.tag, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
                        {it ? <Icon name={it.icon} size={14} color={t.c.textSecondary} /> : null}
                        <Text variant="label">{it?.label ?? i}</Text>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            ) : null}
            {communities.length ? (
              <Animated.View entering={reduced ? undefined : enter.rise(6)} style={styles.section}>
                <Text variant="overline" tone="tertiary">
                  Communities
                </Text>
                {communities.map((c) => (
                  <PressableScale key={c.id} haptic="select" scaleTo={0.98} onPress={() => router.push(`/c/${c.id}`)} style={styles.community} accessibilityLabel={c.name}>
                    <View style={[styles.communityPhoto, { backgroundColor: t.c.overlay }]}>
                      {c.cover && covers[c.cover] ? (
                        <Photo visual={{ photo: 'meeting', uri: covers[c.cover] }} light="dubai" width={120} style={StyleSheet.absoluteFill} />
                      ) : (
                        <Icon name="heartHandshake" size={18} color={t.c.textSecondary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleS" raw>
                        {c.name}
                      </Text>
                      <Text variant="caption" tone="tertiary">
                        {tx('{n} members', { n: c.members })}
                      </Text>
                    </View>
                    <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
                  </PressableScale>
                ))}
              </Animated.View>
            ) : null}
          </>
        )}

        {!p.isMe ? (
          <PressableScale onPress={() => openReport({ kind: 'profile', userId: p.id }, p.firstName)} style={styles.report} accessibilityRole="button" accessibilityLabel={tx('Report or block {name}', { name: p.firstName })}>
            <Icon name="flag" size={14} color={t.c.textTertiary} />
            <Text variant="caption" tone="tertiary">
              Report or block
            </Text>
          </PressableScale>
        ) : null}
      </ScrollView>
      <View style={[styles.back, { top: insets.top + 10 }]}>
        <IconButton icon="arrowLeft" label="Back" variant="glass" onPress={back} />
      </View>
    </View>
  );
}

function Count({ n, label, onPress }: { n: number; label: string; onPress?: () => void }) {
  return (
    <PressableScale haptic={onPress ? 'select' : false} disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : 'text'} accessibilityLabel={`${n} ${tx(label)}`} style={styles.count}>
      {/* A new count fades in: the number on screen is always the server's. */}
      <Animated.View key={n} entering={FadeIn.duration(220)}>
        <Text variant="titleL" align="center">
          {n}
        </Text>
      </Animated.View>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </PressableScale>
  );
}

function Centered({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, styles.centered, { backgroundColor: t.c.bg }]}>
      {children}
      <View style={[styles.back, { top: insets.top + 10 }]}>
        <IconButton icon="arrowLeft" label="Back" onPress={onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: space.gutter },
  cover: { overflow: 'hidden' },
  identity: { alignItems: 'center', gap: 12, marginTop: -56, paddingHorizontal: space.gutter },
  ring: { borderWidth: 4, borderRadius: 60 },
  counts: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  count: { alignItems: 'center', minWidth: 90, paddingVertical: 4 },
  sep: { width: StyleSheet.hairlineWidth * 2, height: 30 },
  buttons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  card: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: space.gutter, marginTop: space[6], padding: 14, borderRadius: radius.lg },
  section: { paddingHorizontal: space.gutter, marginTop: space[6], gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth * 2 },
  community: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  communityPhoto: { width: 48, height: 48, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  report: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: space[7], padding: 10 },
  back: { position: 'absolute', left: space.gutter },
});
