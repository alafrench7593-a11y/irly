import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, interpolate, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from '@/components/navigation/Headers';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { DEMO_CHATS, DEMO_PLANS } from '@/data/content/girlDemo';
import { findPerson } from '@/data/repo';
import { t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { cityWhen } from '@/lib/time';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { demoPhoto, demoPostsOf, findDemoCommunity, findDemoPlan, planGoing, planStartsAt, useDemoEngagement, useDemoGirl } from './demo';
import { girl, GIRL_TINT, girlType } from './theme';
import { GButton } from './ui';
import { GirlPostCard } from './world';

/**
 * The IRLY Girl community and plan pages of the demonstration build. They
 * show the example content of `data/content/girlDemo.ts` with the same
 * layout and actions as the real pages (join, posts, likes, comments, chat,
 * going), and every tap stays in this tab: nothing is saved, and the demo
 * badge says so. Real builds never route here (`isDemoId` is false).
 */

const HERO = 300;
const people = (ids: string[]) =>
  ids.map((id) => {
    const p = findPerson(id);
    return { id, name: p?.name ?? '', hue: p?.hue ?? hueOf(id), photo: demoPhoto(id) };
  });

function useHero() {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  // The cover drifts slower than the page (a light depth), and grows when pulled down.
  const photo = useAnimatedStyle(() =>
    reduced
      ? {}
      : { transform: [{ translateY: interpolate(y.value, [-120, 0, HERO], [-60, 0, HERO * 0.35], Extrapolation.CLAMP) }, { scale: interpolate(y.value, [-120, 0], [1.25, 1], Extrapolation.CLAMP) }] },
  );
  return { y, onScroll, photo };
}

export function DemoCommunityScreen({ id }: { id: string }) {
  const c = findDemoCommunity(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const joined = useDemoGirl((s) => Boolean(s.joined[id]));
  const toggle = useDemoGirl((s) => s.toggle);
  const [tab, setTab] = useState<'posts' | 'plans' | 'about'>('posts');
  const posts = useMemo(() => demoPostsOf(id), [id]);
  const eng = useDemoEngagement('community_post', posts.map((p) => p.id));
  const plans = useMemo(() => DEMO_PLANS.filter((p) => p.community === id), [id]);
  const chat = DEMO_CHATS.find((x) => x.kind === 'group' && x.title === c?.name);
  const { y, onScroll, photo } = useHero();
  if (!c) return <Missing />;
  const members = c.members + (joined && !c.member ? 1 : 0) - (!joined && c.member ? 1 : 0);

  const join = () => {
    haptic(joined ? 'select' : 'success');
    toggle('joined', id);
    toast(joined ? tx('You left {name}', { name: c.name }) : tx('Welcome to {name}', { name: c.name }), joined ? 'check' : 'sparkles', 'brand');
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Animated.View style={[StyleSheet.absoluteFill, photo]}>
            <Photo tint={GIRL_TINT} visual={{ photo: c.cover }} light="dubai" scrim="strong" width={900} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <View style={[styles.heroText, { paddingTop: insets.top + 64 }]}>
            <Animated.View entering={reduced ? undefined : enter.fade(0)}>
              <Text variant="caption" color="rgba(255,255,255,0.9)" style={styles.kicker}>
                IRLY GIRL · {tx('Women only')}
              </Text>
            </Animated.View>
            <Animated.View entering={reduced ? undefined : enter.rise(1)}>
              <Text variant="titleL" color="#FFFFFF" raw style={[girlType.display, { fontSize: 38, lineHeight: 40 }]}>
                {c.name}
              </Text>
            </Animated.View>
            <Animated.View entering={reduced ? undefined : enter.rise(2)}>
              <Text variant="body" color="rgba(255,255,255,0.92)" raw>
                {c.tagline}
              </Text>
            </Animated.View>
          </View>
        </View>

        <Animated.View entering={reduced ? undefined : enter.rise(3)} style={styles.card}>
          <View style={styles.row}>
            <AvatarStack people={people(c.faces)} size={30} max={5} />
            <Text variant="label" color={girl.ink} style={{ flex: 1 }}>
              {tx('{n} members', { n: members })}
            </Text>
          </View>
          <View style={styles.row}>
            <GButton label={joined ? 'Joined' : 'Join'} icon={joined ? 'check' : 'plus'} variant={joined ? 'secondary' : 'primary'} onPress={join} style={{ flex: 1 }} />
            <GButton
              label="Chat"
              icon="message"
              variant="secondary"
              onPress={() => (joined && chat ? router.push(`/messages/${chat.id}`) : toast(joined ? tx('The group chat opens here') : tx('Join to chat with the group'), 'message', 'brand'))}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>

        <View style={styles.tabs}>
          {(['posts', 'plans', 'about'] as const).map((k) => (
            <Tab key={k} label={k === 'posts' ? tx('Posts') : k === 'plans' ? tx('Plans') : tx('About')} on={tab === k} onPress={() => setTab(k)} />
          ))}
        </View>

        <Animated.View layout={reduced ? undefined : LinearTransition.springify(420).dampingRatio(0.9)} style={{ gap: 12, paddingHorizontal: space.gutter }}>
          {tab === 'posts'
            ? posts.map((p, i) => (
                <Animated.View key={p.id} entering={reduced ? undefined : enter.rise(Math.min(i, 4))}>
                  <GirlPostCard p={p} eng={eng} cityId="dubai" />
                </Animated.View>
              ))
            : null}
          {tab === 'posts' && !posts.length ? <Empty icon="message" text="No posts yet. Say hello to the group." /> : null}
          {tab === 'plans' ? plans.map((p, i) => <PlanCard key={p.id} id={p.id} i={i} />) : null}
          {tab === 'plans' && !plans.length ? <Empty icon="calendar" text="No plans yet. Propose the first one." /> : null}
          {tab === 'about' ? (
            <Animated.View entering={reduced ? undefined : FadeIn} style={[styles.post, { gap: 10 }]}>
              <Text variant="body" color={girl.ink} raw>
                {c.about}
              </Text>
              <Fact icon="shield" text={tx('Women only: every member is checked by IRLY Girl.')} />
              <Fact icon="message" text={tx('Members are in the group chat as soon as they join.')} />
              <Fact icon="flag" text={tx('Anything off? Report a post or a person in one tap.')} />
            </Animated.View>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>
      <PageHeader title={c.name} scrollY={y} />
    </View>
  );
}

function PlanCard({ id, i }: { id: string; i: number }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const p = findDemoPlan(id);
  const going = useDemoGirl((s) => s.going);
  if (!p) return null;
  const n = planGoing(p, going);
  return (
    <Animated.View entering={reduced ? undefined : enter.rise(Math.min(i, 4))}>
      <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push(`/a/${p.id}`)} style={styles.plan} accessibilityLabel={p.title}>
        <View style={styles.planPhoto}>
          <Photo tint={GIRL_TINT} visual={{ photo: p.cover }} light="dubai" width={400} style={StyleSheet.absoluteFill} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="caption" color={girl.rose}>
            {cityWhen(planStartsAt(p), 'dubai')}
          </Text>
          <Text variant="titleS" color={girl.ink} numberOfLines={2} raw>
            {p.title}
          </Text>
          <Text variant="caption" color={girl.inkSoft}>
            {tx('{n}/{max} going', { n, max: p.capacity })}
          </Text>
        </View>
        {going[p.id] ? <Icon name="check" size={18} color={girl.rose} /> : <Icon name="chevronRight" size={18} color={girl.inkFaint} />}
      </PressableScale>
    </Animated.View>
  );
}

export function DemoPlanScreen({ id }: { id: string }) {
  const p = findDemoPlan(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const goingMap = useDemoGirl((s) => s.going);
  const toggle = useDemoGirl((s) => s.toggle);
  const { y, onScroll, photo } = useHero();
  if (!p) return <Missing />;
  const going = Boolean(goingMap[id]);
  const n = planGoing(p, goingMap);
  const full = n >= p.capacity && !going;
  const host = findPerson(p.by);
  const community = p.community ? findDemoCommunity(p.community) : undefined;
  const who = people(p.going);

  const rsvp = () => {
    if (full) return;
    haptic(going ? 'select' : 'success');
    toggle('going', id);
    toast(going ? tx('You left the plan') : tx('You’re going! The group chat is in Messages'), going ? 'check' : 'sparkles', 'brand');
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Animated.View style={[StyleSheet.absoluteFill, photo]}>
            <Photo tint={GIRL_TINT} visual={{ photo: p.cover }} light="dubai" scrim="strong" width={900} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <View style={[styles.heroText, { paddingTop: insets.top + 64 }]}>
            <Animated.View entering={reduced ? undefined : enter.fade(0)}>
              <Text variant="caption" color="rgba(255,255,255,0.9)" style={styles.kicker}>
                {cityWhen(planStartsAt(p), 'dubai')}
              </Text>
            </Animated.View>
            <Animated.View entering={reduced ? undefined : enter.rise(1)}>
              <Text variant="titleL" color="#FFFFFF" raw style={[girlType.display, { fontSize: 36, lineHeight: 38 }]}>
                {p.title}
              </Text>
            </Animated.View>
          </View>
        </View>

        <Animated.View entering={reduced ? undefined : enter.rise(2)} style={styles.card}>
          <Fact icon="pin" text={p.place} />
          <Fact icon="users" text={tx('{n}/{max} going', { n, max: p.capacity })} />
          <Fact icon="ticket" text={tx('Free')} />
          {community ? (
            <PressableScale haptic="select" onPress={() => router.push(`/c/${community.id}`)} style={styles.row} accessibilityLabel={tx('Open {title}', { title: community.name })}>
              <Icon name="heart" size={18} color={girl.rose} />
              <Text variant="label" color={girl.rose} style={{ flex: 1 }} raw>
                {community.name}
              </Text>
              <Icon name="chevronRight" size={16} color={girl.inkFaint} />
            </PressableScale>
          ) : null}
        </Animated.View>

        <Animated.View entering={reduced ? undefined : enter.rise(3)} style={[styles.card, { marginTop: 12 }]}>
          <Text variant="titleM" color={girl.ink} style={girlType.card}>
            {tx('Who’s going')}
          </Text>
          {host ? (
            <PressableScale haptic="select" onPress={() => router.push(`/person/${host.id}`)} style={styles.row} accessibilityLabel={host.name}>
              <Avatar name={host.name} hue={host.hue} size={40} photo={demoPhoto(host.id)} />
              <View style={{ flex: 1 }}>
                <Text variant="titleS" color={girl.ink} raw>
                  {host.name}
                </Text>
                <Text variant="caption" color={girl.inkSoft}>
                  {tx('Organiser')}
                </Text>
              </View>
            </PressableScale>
          ) : null}
          <View style={styles.row}>
            <AvatarStack people={who} size={32} max={6} extra={going ? 1 : 0} />
            {going ? (
              <Animated.View entering={reduced ? undefined : enter.pop(0)}>
                <Text variant="label" color={girl.rose}>
                  {tx('+ you')}
                </Text>
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>
      </Animated.ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <GButton label={going ? 'Going' : full ? 'Full' : 'Join the plan'} icon={going ? 'check' : 'plus'} variant={going ? 'secondary' : 'primary'} disabled={full} onPress={rsvp} style={{ flex: 1 }} />
      </View>
      <PageHeader title={p.title} scrollY={y} />
    </View>
  );
}

function Tab({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <PressableScale haptic="select" scaleTo={0.95} onPress={onPress} style={[styles.tab, on && { backgroundColor: girl.rose }]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}>
      <Text variant="label" color={on ? '#FFFFFF' : girl.ink}>
        {label}
      </Text>
    </PressableScale>
  );
}

function Fact({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={18} color={girl.rose} />
      <Text variant="bodyS" color={girl.ink} style={{ flex: 1 }} raw>
        {text}
      </Text>
    </View>
  );
}

function Empty({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={[styles.post, { alignItems: 'center', gap: 10 }]}>
      <Icon name={icon} size={20} color={girl.rose} />
      <Text variant="bodyS" color={girl.inkSoft} align="center">
        {text}
      </Text>
    </View>
  );
}

function Missing() {
  const router = useRouter();
  return (
    <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', gap: 12, padding: space.gutter }]}>
      <Text variant="titleM" color={girl.ink} align="center">
        This page does not exist in the demo
      </Text>
      <GButton label="Back to IRLY Girl" onPress={() => router.replace('/girl')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: girl.bg },
  hero: { height: HERO, overflow: 'hidden', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, backgroundColor: girl.blush },
  heroText: { flex: 1, justifyContent: 'flex-end', gap: 6, padding: space.gutter, paddingBottom: 28 },
  kicker: { letterSpacing: 1.6, fontWeight: '700' },
  card: { marginHorizontal: space.gutter, marginTop: -22, padding: 16, gap: 12, borderRadius: radius.xl, backgroundColor: girl.surface, boxShadow: girl.shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: space.gutter, marginTop: space[6], marginBottom: space[4] },
  tab: { height: 38, paddingHorizontal: 16, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  post: { padding: 16, borderRadius: radius.xl, backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.xl, backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  planPhoto: { width: 76, height: 76, borderRadius: radius.lg, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', paddingHorizontal: space.gutter, paddingTop: 12, backgroundColor: girl.glass },
});
