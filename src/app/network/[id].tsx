import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotFound } from '@/components/layout/NotFound';
import { PageHeader } from '@/components/navigation/Headers';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useMyPro, usePro } from '@/features/network/api';
import { reasonText, roundDistance, scorePro } from '@/features/network/match';
import { INDUSTRY, INTENT, ROLE_LABEL } from '@/features/network/taxonomy';
import { ConnectAction, hueOf, MatchPill, placeOf } from '@/features/network/ui';
import { useT } from '@/i18n';
import { enter } from '@/motion/enter';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** A professional's profile: who they are, what they build, why you fit. */
export default function ProProfileScreen() {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pro, photo, state, setConnection } = usePro(id);
  const me = useMyPro();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  if (state === 'loading') return <View style={[styles.root, { backgroundColor: t.c.bg }]} />;
  if (state === 'error') return <NotFound title="Can’t reach IRLY right now" />;
  if (!pro) return <NotFound title="This professional profile is not available" />;

  const mine = me.pro?.userId === pro.userId;
  const match = me.pro && !mine ? scorePro(me.pro, pro) : null;

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: insets.bottom + 140 }}>
        <View style={styles.identity}>
          <Animated.View entering={enter.pop(0)}>
            <Avatar name={pro.firstName} hue={hueOf(pro.userId)} size={112} photo={photo ?? undefined} />
          </Animated.View>
          <Animated.View entering={enter.rise(1)} style={{ alignItems: 'center', gap: 4 }}>
            <Text variant="displayL" raw>
              {pro.firstName}
            </Text>
            <Text variant="bodyL" align="center" raw>
              {pro.company ? `${pro.jobTitle} · ${pro.company}` : pro.jobTitle}
            </Text>
            <View style={styles.row}>
              <View style={[styles.role, { borderColor: t.c.text }]}>
                <Text variant="caption">{ROLE_LABEL[pro.role]}</Text>
              </View>
              <Icon name="pin" size={13} color={t.c.textTertiary} />
              <Text variant="caption" tone="tertiary" raw>
                {[placeOf(pro), match?.distanceKm != null ? roundDistance(match.distanceKm) : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </Animated.View>
        </View>

        {match ? (
          <Animated.View entering={enter.rise(2)} style={[styles.card, { backgroundColor: t.c.text }]}>
            <View style={styles.row}>
              <MatchPill percent={match.percent} inverted />
              <Text variant="label" color={t.c.bg}>
                Why you should meet
              </Text>
            </View>
            {match.reasons.length ? (
              match.reasons.slice(0, 4).map((r) => {
                const s = reasonText(r, tr);
                return (
                  <View key={r.kind + s} style={styles.reason}>
                    <View style={[styles.dot, { backgroundColor: t.c.bg }]} />
                    <Text variant="body" color={t.c.bg} style={{ flex: 1 }} raw>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text variant="body" color={t.c.bg}>
                Different worlds: sometimes the best intros.
              </Text>
            )}
          </Animated.View>
        ) : !me.pro && !mine ? (
          <Animated.View entering={enter.rise(2)} style={{ paddingHorizontal: space.gutter }}>
            <Button label="Create my profile to see our match" variant="secondary" icon="sparkles" full onPress={() => router.push('/network/profile')} />
          </Animated.View>
        ) : null}

        <Block title="Current project" body={pro.project} delay={3} />
        <Block title="Looking for" body={pro.lookingFor} delay={4} />
        <Block title="Can offer" body={pro.canOffer} delay={5} />

        <Animated.View entering={enter.rise(6)} style={styles.section}>
          <Text variant="overline" tone="tertiary">
            Industry
          </Text>
          <View style={styles.wrap}>
            {pro.industries.map((i) => (
              <View key={i} style={[styles.tag, { borderColor: t.c.line, backgroundColor: t.c.surface }]}>
                <Text variant="label" raw>{`${INDUSTRY[i].emoji} ${tr(INDUSTRY[i].label)}`}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {pro.skills.length ? (
          <Animated.View entering={enter.rise(7)} style={styles.section}>
            <Text variant="overline" tone="tertiary">
              Skills
            </Text>
            <View style={styles.wrap}>
              {pro.skills.map((s) => {
                const shared = me.pro?.skills.some((x) => x.toLowerCase() === s.toLowerCase());
                return (
                  <View key={s} style={[styles.tag, { borderColor: shared ? t.c.text : t.c.line, backgroundColor: shared ? t.c.text : t.c.surface }]}>
                    <Text variant="label" color={shared ? t.c.bg : undefined} raw>
                      {s}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        {pro.intents.length ? (
          <Animated.View entering={enter.rise(8)} style={styles.section}>
            <Text variant="overline" tone="tertiary">
              Here to
            </Text>
            <View style={styles.wrap}>
              {pro.intents.map((i) => {
                const shared = me.pro?.intents.includes(i);
                return (
                  <View key={i} style={[styles.tag, { borderColor: shared ? t.c.text : t.c.line, backgroundColor: t.c.surface }]}>
                    <Text variant="label" raw>{`${INTENT[i].emoji} ${tr(INTENT[i].label)}`}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : null}
      </Animated.ScrollView>

      <PageHeader title={pro.firstName} scrollY={scrollY} />
      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Glass style={styles.ctaGlass} intensity={60}>
          {mine ? (
            <Button label="Edit my professional profile" icon="briefcase" size="lg" full onPress={() => router.push('/network/profile')} />
          ) : (
            <ConnectAction pro={pro} onChange={setConnection} size="lg" full />
          )}
        </Glass>
      </View>
    </View>
  );
}

function Block({ title, body, delay }: { title: string; body: string | null; delay: number }) {
  if (!body) return null;
  return (
    <Animated.View entering={enter.rise(delay)} style={styles.section}>
      <Text variant="overline" tone="tertiary">
        {title}
      </Text>
      <Text variant="bodyL" tone="secondary" raw>
        {body}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  identity: { alignItems: 'center', gap: 14, paddingHorizontal: space.gutter, marginBottom: space[6] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  role: { height: 24, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  card: { marginHorizontal: space.gutter, padding: 18, gap: 12, borderRadius: radius.xl },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  section: { paddingHorizontal: space.gutter, marginTop: space[6], gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { height: 34, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, justifyContent: 'center' },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  ctaGlass: { padding: 10, borderRadius: radius.xl },
});
