import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { IconButton } from '@/components/ui/Controls';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { blockUser } from '@/features/moderation/moderation';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { confirm } from '@/lib/confirm';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { NotFound } from '@/components/layout/NotFound';
import { PageHeader } from '@/components/navigation/Headers';
import { Button } from '@/components/ui/Button';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Ambient } from '@/components/visual/Ambient';
import { seenPro, useMyPro, usePro } from '@/features/network/api';
import { reasonText, roundDistance, scorePro } from '@/features/network/match';
import { blockIn, LightDrift } from '@/features/network/motion';
import { agreeOf, INDUSTRY, INTENT, ROLE_LABEL, skillLabel } from '@/features/network/taxonomy';
import { ConnectAction, MatchPill, NetworkState, placeOf, Portrait, Shimmer, useGlint } from '@/features/network/ui';
import { ProLinkButtons } from '@/features/network/sections';
import { useT, useTg } from '@/i18n';
import { useAppSpace } from '@/state/appSpace';
import { ease, spring } from '@/motion/tokens';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useBusy } from '@/lib/useBusy';
import { AccentFill, layered, NetworkPane, useNetworkTone, NetworkScreen } from '@/features/network/tone';

/** A professional's profile: who they are, what they build, why you fit. */
/** Network pages are violet in IRLY Girl, silver in IRLY (see NetworkScope). */
export default function ProProfileScreen() {
  return (
    <NetworkScreen>
      <ProProfileScreenPage />
    </NetworkScreen>
  );
}

function ProProfileScreenPage() {
  const t = useTheme();
  const tone = useNetworkTone();
  const tr = useT();
  const tg = useTg();
  const girl = useAppSpace() === 'girl';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pro: fresh, photo, links, state, retrying, setConnection, retry } = usePro(id);
  // Opened from a card: the page starts on what the card showed (its data, its small photo) while its own read arrives.
  const handoff = useMemo(() => seenPro(id), [id]);
  const pro = fresh ?? (state === 'loading' ? (handoff?.pro ?? null) : null);
  const ready = state === 'ready';
  const me = useMyPro();
  const [safety, setSafety] = useState(false);
  // Block waits for the server: a second tap asked again, then went back twice.
  const blocking = useBusy<'block'>();
  const [reporting, setReporting] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const heroW = Math.max(0, Math.min(frame.width, 560) - space.gutter * 2);
  const heroH = Math.round(Math.min(heroW * 1.16, 460));

  if (!me.signedIn) return <NotFound title="Sign in to see professional profiles" />;
  if (state === 'loading' && !pro) return <ProfileSkeleton heroH={heroH} />;
  if (state === 'error' && !pro)
    return (
      <View style={[styles.root, { backgroundColor: t.c.bg }]}>
        <Ambient />
        <View style={[styles.center, { paddingTop: insets.top + 80 }]}>
          <NetworkState icon="satellite" error title="Can’t reach IRLY right now" body="Check your connection and try again.">
            <Button label="Try again" icon="repeat" variant="secondary" size="md" loading={retrying} onPress={retry} />
          </NetworkState>
        </View>
        <PageHeader title="" />
      </View>
    );
  if (!pro) return <NotFound title="This professional profile is not available" />;

  const mine = me.pro?.userId === pro.userId;
  // French words about her or him agree (« Fondatrice »), never what she or he typed.
  const who = agreeOf(pro, girl);
  const match = me.pro && !mine ? scorePro(me.pro, pro) : null;
  const where = [placeOf(pro), match?.distanceKm != null ? roundDistance(match.distanceKm) : null].filter(Boolean).join(' · ');
  const blocks: { icon: IconName; title: string; body: string | null }[] = [
    { icon: 'rocket', title: 'Current project', body: pro.project },
    { icon: 'target', title: 'Looking for', body: pro.lookingFor },
    { icon: 'sparkles', title: 'Can offer', body: pro.canOffer },
  ];
  const filled = blocks.filter((b) => b.body);

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient />
      <LightDrift scrollY={scrollY} height={heroH + 200} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 140 }}>
        <Hero pro={pro} photo={photo ?? null} small={handoff?.photo ?? null} width={heroW} height={heroH} scrollY={scrollY} where={where} matchPercent={match?.percent ?? null} />

        {match ? (
          <Animated.View entering={blockIn(0, 260)} style={[styles.card, layered, { overflow: 'hidden', boxShadow: tone.surface.shadowHero }]}>
            <AccentFill colors={tone.panel} />
            <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} locations={[0, 0.5]} style={[StyleSheet.absoluteFill, styles.under]} />
            <View style={styles.row}>
              <MatchPill percent={match.percent} inverted />
              <Text variant="titleS" color={tone.onPanel}>
                Why you should meet
              </Text>
            </View>
            {match.reasons.length ? (
              match.reasons.slice(0, 4).map((r) => {
                const s = reasonText(r, tr, tg);
                return (
                  <View key={r.kind + s} style={styles.reason}>
                    <View style={[styles.dot, { backgroundColor: tone.isGirl ? '#C9B6FF' : tone.onPanel }]} />
                    <Text variant="body" color={tone.onPanel} style={{ flex: 1 }} raw>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text variant="body" color={tone.onPanel}>
                Different worlds: sometimes the best intros.
              </Text>
            )}
          </Animated.View>
        ) : !me.pro && !mine ? (
          <Animated.View entering={blockIn(0, 260)} style={{ paddingHorizontal: space.gutter, marginTop: space[2] }}>
            <Button label="Create my profile to see our match" variant="secondary" icon="sparkles" full onPress={() => router.push('/network/profile')} />
          </Animated.View>
        ) : null}

        {filled.length ? (
          <Animated.View entering={blockIn(1, 260)} style={[styles.pane, { boxShadow: tone.surface.shadow }]}>
            <NetworkPane radius={radius.xl} />
            {filled.map((b, i) => (
              <View key={b.title} style={[styles.block, i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line } : null]}>
                <View style={styles.blockHead}>
                  <View style={[styles.well, { backgroundColor: tone.soft, borderColor: tone.softLine }]}>
                    <Icon name={b.icon} size={13} color={tone.accent} />
                  </View>
                  <Text variant="overline" tone="tertiary">
                    {b.title}
                  </Text>
                </View>
                <Text variant="bodyL" raw style={{ color: t.c.text }}>
                  {b.body}
                </Text>
              </View>
            ))}
          </Animated.View>
        ) : null}

        <ProLinkButtons links={links} index={4} />

        <Animated.View entering={blockIn(2, 260)} style={styles.section}>
          <Text variant="overline" tone="tertiary">
            Industry
          </Text>
          <View style={styles.wrap}>
            {pro.industries.map((i) => (
              <View key={i} style={[styles.tag, { borderColor: tone.surface.chipLine, backgroundColor: tone.surface.chip }]}>
                <Text variant="label" raw>{`${INDUSTRY[i].emoji} ${tr(INDUSTRY[i].label)}`}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {pro.skills.length ? (
          <Animated.View entering={blockIn(3, 260)} style={styles.section}>
            <Text variant="overline" tone="tertiary">
              Skills
            </Text>
            <View style={styles.wrap}>
              {pro.skills.map((s) => {
                const shared = me.pro?.skills.some((x) => x.toLowerCase() === s.toLowerCase());
                return (
                  <View key={s} style={[styles.tag, { borderColor: shared ? tone.accent : tone.surface.chipLine, backgroundColor: shared ? tone.accent : tone.surface.chip }]}>
                    {shared ? <Icon name="check" size={12} color={tone.onAccent} strokeWidth={2.6} /> : null}
                    <Text variant="label" color={shared ? tone.onAccent : undefined} raw>
                      {skillLabel(s, tr)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        {pro.intents.length ? (
          <Animated.View entering={blockIn(4, 260)} style={styles.section}>
            <Text variant="overline" tone="tertiary">
              Here to
            </Text>
            <View style={styles.wrap}>
              {pro.intents.map((i) => {
                const shared = me.pro?.intents.includes(i);
                return (
                  <View key={i} style={[styles.tag, { borderColor: shared ? tone.accent : tone.surface.chipLine, backgroundColor: shared ? tone.soft : tone.surface.chip }]}>
                    <Text variant="label" raw>{`${INTENT[i].emoji} ${tr(INTENT[i].label)}`}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : null}
      </Animated.ScrollView>

      <PageHeader
        title={pro.firstName}
        scrollY={scrollY}
        right={mine ? undefined : <IconButton icon="shield" label={tr('Safety: report or block')} onPress={() => setSafety(true)} />}
      />
      {mine ? null : (
        <Sheet visible={safety} onClose={() => setSafety(false)} title={pro.firstName} subtitle={tr('Report or block this member')}>
          <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
            <Button
              label="Report"
              icon="flag"
              variant="secondary"
              full
              onPress={() => {
                setSafety(false);
                setReporting(true);
              }}
            />
            <Button
              label="Block"
              icon="shield"
              variant="danger"
              full
              loading={blocking.busy === 'block'}
              onPress={() =>
                blocking.isRunning() ||
                confirm(
                  tr('Block {name}? You will no longer see each other, and any connection or request ends.', { name: pro.firstName }),
                  () =>
                    void blocking.run('block', () =>
                      blockUser(pro.userId)
                        .then(() => {
                          setSafety(false);
                          toast(tg('{name} is blocked', who, { name: pro.firstName }), 'shield', 'brand');
                          if (router.canGoBack()) router.back();
                          else router.replace('/network');
                        })
                        .catch((e) => toast(e instanceof Error ? e.message : tr('Could not block'), 'x', 'live')),
                    ),
                  'Block',
                )
              }
            />
          </View>
        </Sheet>
      )}
      <ReportSheet
        target={reporting ? { kind: 'profile', userId: pro.userId } : null}
        name={pro.firstName}
        onClose={() => setReporting(false)}
        onBlocked={() => (router.canGoBack() ? router.back() : router.replace('/network'))}
      />
      <Animated.View entering={FadeInDown.springify(spring.medium.duration).dampingRatio(0.9).delay(320)} style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Glass style={styles.ctaGlass} intensity={60}>
          {mine ? (
            <Button label="Edit my professional profile" icon="briefcase" size="lg" full onPress={() => router.push('/network/profile')} />
          ) : ready ? (
            <ConnectAction pro={pro} onChange={setConnection} size="lg" full />
          ) : (
            // The card's data is on screen; the buttons wait for the profile's own answer (its live connection state).
            <Button label="Connect" icon="plus" size="lg" full loading />
          )}
        </Glass>
      </Animated.View>
    </View>
  );
}

/**
 * The portrait of the profile, as large as the page allows: her photo (the
 * small copy the card showed at once, the full photo dissolving over it),
 * else her IRLY avatar or her initials on the Network gradient. Her name,
 * job and place sit on a scrim at the bottom. It grows in from the card's
 * scale when the page opens, lags the scroll a little and stretches on
 * pull-down.
 */
function Hero({
  pro,
  photo,
  small,
  width,
  height,
  scrollY,
  where,
  matchPercent,
}: {
  pro: NonNullable<ReturnType<typeof usePro>['pro']>;
  photo: string | null;
  small: string | null;
  width: number;
  height: number;
  scrollY: ReturnType<typeof useSharedValue<number>>;
  where: string;
  matchPercent: number | null;
}) {
  const tone = useNetworkTone();
  const tg = useTg();
  const who = agreeOf(pro, useAppSpace() === 'girl');
  const reduced = useReducedMotion();
  const open = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) open.set(withSpring(1, spring.soft));
  }, [open, reduced]);
  const card = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 0.4, 1], [0, 0.9, 1]),
    transform: [{ translateY: (1 - open.value) * 26 }, { scale: 0.92 + 0.08 * open.value }],
  }));
  const photoStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      transform: y < 0 ? [{ translateY: y / 2 }, { scale: 1 + -y / height }] : [{ translateY: y * 0.32 }, { scale: 1 + Math.min(y, height) / (height * 6) }],
    };
  });
  const shown = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) shown.set(withTiming(1, { duration: 520, easing: ease.enter }));
  }, [shown, reduced]);
  const textStyle = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (1 - shown.value) * 14 }] }));
  return (
    <Animated.View style={[styles.hero, { width, height, boxShadow: tone.surface.shadowHero }, card]}>
      <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
        <Portrait name={pro.firstName} uri={photo ?? small} placeholder={small} width={width} height={height} radius={0} lift={height * 0.16} />
      </Animated.View>
      <LinearGradient pointerEvents="none" colors={tone.surface.scrim} locations={[0.38, 1]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.heroRim]} />
      {matchPercent != null ? (
        <Animated.View entering={FadeIn.duration(360).delay(380)} style={styles.heroMatch}>
          <MatchPill percent={matchPercent} />
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.heroText, textStyle]}>
        <View style={styles.roleChip}>
          <Text variant="overline" color="#FFFFFF" raw>
            {tg(ROLE_LABEL[pro.role], who)}
          </Text>
        </View>
        <Text variant="displayL" color="#FFFFFF" raw numberOfLines={2}>
          {pro.firstName}
        </Text>
        <Text variant="bodyL" color="rgba(255,255,255,0.92)" raw numberOfLines={2}>
          {pro.company ? `${pro.jobTitle} · ${pro.company}` : pro.jobTitle}
        </Text>
        <View style={styles.heroWhere}>
          <Icon name="pin" size={13} color="rgba(255,255,255,0.78)" />
          <Text variant="caption" color="rgba(255,255,255,0.78)" raw numberOfLines={1} style={{ flexShrink: 1 }}>
            {where}
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** The profile while it loads (opened from a link, not from a card): its shape, nothing invented. */
function ProfileSkeleton({ heroH }: { heroH: number }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const glint = useGlint();
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]} accessibilityLabel="Loading">
      <Ambient />
      <View style={{ paddingTop: insets.top + 64, paddingHorizontal: space.gutter, gap: 16 }}>
        <Shimmer glint={glint} height={heroH} radius={radius.xxl} />
        <Shimmer glint={glint} height={120} radius={radius.xl} />
        <Shimmer glint={glint} width="40%" height={10} radius={5} />
        <View style={styles.wrap}>
          {[96, 120, 84].map((w) => (
            <Shimmer key={w} glint={glint} width={w} height={34} radius={17} />
          ))}
        </View>
      </View>
      <PageHeader title="" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { paddingHorizontal: space.gutter },
  under: { zIndex: -1 },
  hero: { alignSelf: 'center', borderRadius: radius.xxl, overflow: 'hidden', marginBottom: space[5] },
  heroRim: { borderRadius: radius.xxl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  heroMatch: { position: 'absolute', top: 14, right: 14 },
  heroText: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: 4 },
  heroWhere: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  roleChip: { alignSelf: 'flex-start', height: 24, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.28)', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  card: { marginHorizontal: space.gutter, padding: 20, gap: 12, borderRadius: radius.xl },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  pane: { marginHorizontal: space.gutter, marginTop: space[5], paddingHorizontal: 18, borderRadius: radius.xl, overflow: 'hidden' },
  block: { paddingVertical: 16, gap: 8 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  well: { width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  section: { paddingHorizontal: space.gutter, marginTop: space[7], gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  ctaGlass: { padding: 10, borderRadius: radius.xl },
});
