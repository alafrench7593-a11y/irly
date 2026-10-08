import { useLocalSearchParams, useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/destinations';
import { CommunityIntro } from '@/features/community/CommunityIntro';
import { CommunityThumb } from '@/features/community/CommunityThumb';
import { joinCommunities, profileTags, useRecommendedCommunities, type OfficialCommunity } from '@/features/community/official';
import { track } from '@/lib/analytics';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const WHY = ['Meet people quickly', 'Ask for advice', 'Find sport partners and plans', 'Feel at home faster'];

/**
 * After signing up: the IRLY Community intro (once), then the communities
 * that match the member's own answers. Join all, choose, or skip: nothing
 * is joined without a tap.
 */
export default function CommunitiesWelcome() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const profile = useStore((s) => s.profile);
  const introSeen = useStore((s) => s.communityIntroSeen);
  const markIntro = useStore((s) => s.markCommunityIntroSeen);
  const tags = useMemo(() => profileTags(profile), [profile]);
  const { list, loading, error, signedIn } = useRecommendedCommunities(cityId, tags, 6);
  const fresh = useMemo(() => (list ?? []).filter((c) => !c.isMember), [list]);
  const [choosing, setChoosing] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const home = () => router.replace('/(tabs)');
  const params = useLocalSearchParams<{ scene?: string; hold?: string }>();

  if (!introSeen) return <CommunityIntro onDone={markIntro} scene={Number(params.scene ?? 0)} hold={params.hold === '1'} />;

  const join = async (ids: string[], how: 'all' | 'chosen') => {
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      const n = await joinCommunities(ids);
      haptic('success');
      track('COMMUNITY_JOIN', { via: `onboarding_${how}`, count: n });
      toast(n === 1 ? tx('You joined 1 community') : tx('You joined {n} communities', { n }), 'users', 'brand');
      home();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    haptic('select');
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space[6], paddingBottom: insets.bottom + 200, paddingHorizontal: space.gutter, gap: space[5] }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={reduced ? undefined : FadeInDown.springify(560).dampingRatio(0.85)} style={{ gap: 8 }}>
          <Text variant="overline" tone="accent">
            {tx('IRLY Community · {city}', { city: city.name })}
          </Text>
          <Text variant="displayM">Your communities</Text>
          <Text variant="body" tone="secondary">
            Based on your profile, we found a few communities you might like.
          </Text>
        </Animated.View>

        {!signedIn ? (
          <View style={[styles.note, { backgroundColor: t.c.surface }]}>
            <Text variant="body">Create your account to join communities and their chats.</Text>
            <Button label="Create my account" icon="arrowRight" full onPress={() => router.replace('/account?from=onboarding')} />
          </View>
        ) : loading ? (
          <ActivityIndicator color={t.c.text} style={{ marginVertical: space[8] }} />
        ) : error ? (
          <Text variant="body" tone="secondary">
            Can’t reach IRLY right now. You can find communities later in Discover.
          </Text>
        ) : !fresh.length ? (
          <View style={[styles.note, { backgroundColor: t.c.surface }]}>
            <Text variant="body">No community matches your answers yet. Explore them all and join the ones you like.</Text>
            <Button label="Explore communities" icon="compass" variant="secondary" full onPress={() => router.replace('/communities')} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {fresh.map((c, i) => (
              <CommunityRow key={c.id} c={c} index={i} reduced={reduced} choosing={choosing} picked={picked.has(c.id)} onToggle={() => toggle(c.id)} />
            ))}
          </View>
        )}

        <View style={[styles.why, { borderColor: t.c.line }]}>
          <Text variant="overline" tone="secondary">
            Why communities?
          </Text>
          {WHY.map((w) => (
            <View key={w} style={styles.whyRow}>
              <Icon name="check" size={14} color={t.c.positive} />
              <Text variant="bodyS" tone="secondary">
                {w}
              </Text>
            </View>
          ))}
          <Text variant="caption" tone="tertiary">
            Communities are optional. Join or leave any time.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 14, backgroundColor: t.c.bg, borderTopColor: t.c.line }]}>
        {signedIn && fresh.length ? (
          choosing ? (
            <Button
              label={picked.size ? tx('Join {n}', { n: picked.size }) : 'Pick your communities'}
              icon="check"
              full
              loading={busy}
              disabled={!picked.size}
              onPress={() => join([...picked], 'chosen')}
            />
          ) : (
            <>
              <Button label="Join all" icon="users" full loading={busy} onPress={() => join(fresh.map((c) => c.id), 'all')} />
              <Button label="Choose my communities" variant="secondary" full onPress={() => setChoosing(true)} />
            </>
          )
        ) : null}
        <Button label="Skip for now" variant="ghost" onPress={home} />
      </View>
    </View>
  );
}

function CommunityRow({ c, index, reduced, choosing, picked, onToggle }: { c: OfficialCommunity; index: number; reduced: boolean; choosing: boolean; picked: boolean; onToggle: () => void }) {
  const t = useTheme();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.springify(520).dampingRatio(0.84).delay(80 + index * 70)} layout={reduced ? undefined : LinearTransition.springify(420)}>
      <PressableScale
        haptic={false}
        scaleTo={choosing ? 0.98 : 1}
        onPress={choosing ? onToggle : undefined}
        style={[styles.card, { backgroundColor: t.c.surface, borderColor: choosing && picked ? t.c.text : 'transparent' }]}
        accessibilityRole={choosing ? 'checkbox' : undefined}
        accessibilityState={choosing ? { checked: picked } : undefined}
        accessibilityLabel={c.name}
      >
        <CommunityThumb topic={c.topic} emoji={c.emoji} light={CITIES[c.cityId as keyof typeof CITIES]?.light ?? 'dubai'} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleS" numberOfLines={1}>
            {c.name}
          </Text>
          <Text variant="bodyS" tone="secondary" numberOfLines={2}>
            {c.tagline}
          </Text>
          {/* Real numbers only: nothing when nobody has joined yet. */}
          {c.members > 0 ? (
            <Text variant="caption" tone="tertiary">
              {tx('{n} members', { n: c.members })}
            </Text>
          ) : null}
        </View>
        {choosing ? (
          <View style={[styles.check, { borderColor: picked ? t.c.text : t.c.lineStrong, backgroundColor: picked ? t.c.text : 'transparent' }]}>
            {picked ? <Icon name="check" size={14} color={t.c.bg} strokeWidth={3} /> : null}
          </View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.xl, borderWidth: 1.5 },
  emoji: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  note: { padding: 16, borderRadius: radius.xl, gap: 12 },
  why: { padding: 16, borderRadius: radius.xl, borderWidth: 1, gap: 8 },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: space.gutter, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
