import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { t as tx } from '@/i18n';
import { useAccount } from '@/features/auth/account';
import { MemberProfileView } from '@/features/profile/MemberProfileView';
import { useCalendar } from '@/features/server/activities';
import { useCommunityList } from '@/features/community/data';
import { cityWhen , whenLabel } from '@/lib/time';
import type { CityId } from '@/data/types';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyMark } from '@/brand/IrlyMark';
import { Rail } from '@/components/cards/Blocks';
import { CommunityCard } from '@/components/cards/ThingCards';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, IconButton, SectionHeader } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Cover } from '@/components/visual/Cover';
import { ACTIVITIES, INTERESTS, SERVICE_CATEGORIES, USER_TYPES } from '@/data/catalog';
import { CITIES, DESTINATIONS } from '@/data/destinations';
import { findCommunity, findEvent, findService, findSession } from '@/data/repo';
import { openHero } from '@/features/hero/heroStore';
import { useNow } from '@/lib/useNow';
import { CountUp } from '@/motion/CountUp';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Your profile. Signed in: the same profile other members see (identity,
 * followers, friends, Posts / Lives / Activities / Communities), with Edit
 * profile and the gear for Settings. Signed out: what is on this phone.
 */
export default function Profile() {
  const account = useAccount();
  if (account?.userId) return <MemberProfileView userId={account.userId} own />;
  return <LocalProfile />;
}

function LocalProfile() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const dest = DESTINATIONS[city.destinationId];
  const profile = useStore((s) => s.profile);
  const joined = useStore((s) => s.joined);
  const memberOf = useStore((s) => s.memberOf);
  const bookings = useStore((s) => s.bookings);
  const now = useNow();
  const days = profile.arrivedAt ? Math.max(1, Math.round((now - profile.arrivedAt) / 86_400_000)) : 0;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const coverH = insets.top + 250;

  const name = profile.name || 'You';
  const plans = Object.keys(joined)
    .map((id) => {
      const e = findEvent(id);
      if (e) return { id, kind: 'event' as const, title: e.title, when: whenLabel(e.when, CITIES[e.cityId]), icon: 'ticket' as IconName };
      const s = findSession(id);
      if (s) return { id, kind: 'session' as const, title: s.title, when: whenLabel(s.when, CITIES[s.cityId]), icon: ACTIVITIES[s.kind].icon };
      return null;
    })
    .filter(Boolean) as { id: string; kind: 'event' | 'session'; title: string; when: string; icon: IconName }[];
  const communities = Object.keys(memberOf)
    .map((id) => findCommunity(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  // Signed in, the server is the only source: what you host and join, and the
  // communities you are in, live (same objects as every other screen).
  const calendar = useCalendar();
  const serverPlans = calendar.items
    .filter((i) => (i.endsAt ?? i.startsAt + 2 * 3600_000) >= now)
    .map((i) => ({ id: i.id, title: i.title, when: cityWhen(i.startsAt, (i.cityId as CityId) ?? cityId), hosting: i.hosting }));
  const myServerCommunities = useCommunityList(cityId).filter((c) => c.isMember);
  const live = Boolean(account);
  const planCount = live ? serverPlans.length : plans.length;

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom }}>
        {/* The city you live in, full bleed, melting into the page. */}
        <Cover visual={{ photo: city.photo }} light={city.light} height={coverH} scrollY={scrollY} scrim="top" radius={0}>
          <LinearGradient
            colors={[`rgba(${t.mode === 'night' ? '5,5,6' : '246,246,244'},0)`, t.c.bg]}
            style={styles.coverFade}
            pointerEvents="none"
          />
        </Cover>
        <View style={[styles.identity, { marginTop: -52 }]}>
          <Animated.View entering={enter.pop(0)}>
            <View style={[styles.avatarRing, { borderColor: t.c.bg, boxShadow: t.shadow.float }]}>
              <Avatar name={name} hue={262} size={96} photo={profile.photoUri} />
            </View>
          </Animated.View>
          <Animated.View entering={enter.rise(1)} style={{ alignItems: 'center', gap: 4 }}>
            <Text variant="displayL">{name}</Text>
            <Text variant="body" tone="secondary">
              {[profile.age, profile.country, tx(city.name)].filter(Boolean).join(' · ')} {city.destinationId === 'bali' ? '🌴' : dest.flag}
            </Text>
            {profile.arrivedAt ? (
              <View style={[styles.newHere, { backgroundColor: t.c.brand }]}>
                <Text variant="overline" color={t.c.onBrand}>
                  {tx(days === 1 ? 'New in {city} · {n} day' : 'New in {city} · {n} days', { city: city.name, n: days })}
                </Text>
              </View>
            ) : null}
            {profile.bio ? (
              <Text variant="body" align="center" style={{ marginTop: 8, paddingHorizontal: 12 }}>
                {profile.bio}
              </Text>
            ) : null}
            {profile.languages?.length ? (
              <Text variant="caption" tone="secondary">
                {tx('Speaks {langs}', { langs: profile.languages.map((l) => tx(l)).join(', ') })}
              </Text>
            ) : null}
            {profile.faith && profile.faithVisible && profile.faith !== 'Prefer not to say' ? (
              <Text variant="caption" tone="tertiary">
                {profile.faith}
              </Text>
            ) : null}
          </Animated.View>
          <Animated.View entering={enter.rise(2)} style={styles.badges}>
            {profile.types.map((x) => (
              <Badge key={x} kind="accent" label={USER_TYPES[x].label} />
            ))}

          </Animated.View>
          <Animated.View entering={enter.rise(3)} style={[styles.stats, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
            {/* Same counters as a signed-in profile; without an account nobody can follow you yet. */}
            <Stat value={0} label="Followers" onPress={() => router.push('/account')} />
            <View style={[styles.vr, { backgroundColor: t.c.line }]} />
            <Stat value={0} label="Following" onPress={() => router.push('/account')} />
            <View style={[styles.vr, { backgroundColor: t.c.line }]} />
            <Stat value={0} label="Friends" onPress={() => router.push('/account')} />
          </Animated.View>
        </View>

        <Animated.View entering={enter.rise(4)} style={styles.section}>
          <SectionHeader title="Interests" />
          <View style={styles.wrap}>
            {profile.interests.length === 0 && profile.activities.length === 0 ? (
              <Text variant="bodyS" tone="tertiary">
                Add interests to get better introductions.
              </Text>
            ) : null}
            {profile.interests.map((i) => (
              <View key={i} style={[styles.tag, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
                <Icon name={INTERESTS[i].icon} size={14} color={t.c.textSecondary} />
                <Text variant="label">{INTERESTS[i].label}</Text>
              </View>
            ))}
            {profile.activities.map((a) => (
              <View key={a} style={[styles.tag, { backgroundColor: t.light.accentSoft, borderColor: 'transparent' }]}>
                <Icon name={ACTIVITIES[a].icon} size={14} color={t.accent} />
                <Text variant="label" tone="accent">
                  {ACTIVITIES[a].label}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={enter.rise(5)} style={styles.section}>
          <SectionHeader title="Upcoming" overline="In real life" />
          <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
            {planCount === 0 ? (
              <EmptyRow icon="calendar" text="Nothing planned yet. Join a plan and it lands here." onPress={() => router.push('/social')} />
            ) : live ? (
              serverPlans.map((p) => (
                <Row key={p.id} icon={p.hosting ? 'star' : 'calendar'} title={p.title} meta={p.hosting ? `${tx('You organise it')} · ${p.when}` : p.when} onPress={() => router.push(`/a/${p.id}`)} />
              ))
            ) : (
              plans.map((p) => (
                <Row key={p.id} icon={p.icon} title={p.title} meta={p.when} onPress={() => openHero({ kind: p.kind, id: p.id })} />
              ))
            )}
            {bookings.map((b) => {
              const s = findService(b.serviceId);
              return s ? (
                <Row
                  key={b.id}
                  icon={SERVICE_CATEGORIES[s.category].icon}
                  title={tx('Call with {name}', { name: s.name })}
                  meta={`${b.dateLabel} · ${b.slot}`}
                  onPress={() => openHero({ kind: 'service', id: s.id })}
                />
              ) : null;
            })}
          </View>
        </Animated.View>

        {live && myServerCommunities.length ? (
          <Animated.View entering={enter.rise(6)} style={styles.section}>
            <SectionHeader title="Your communities" />
            <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
              {myServerCommunities.map((c) => (
                <Row key={c.id} icon="users" title={c.name} meta={[c.official ? 'IRLY' : null, c.members > 0 ? tx('{n} members', { n: c.members }) : null].filter(Boolean).join(' · ')} onPress={() => router.push(`/c/${c.id}`)} />
              ))}
            </View>
          </Animated.View>
        ) : !live && communities.length ? (
          <Animated.View entering={enter.rise(6)} style={styles.section}>
            <SectionHeader title="Your communities" />
            <Rail itemWidth={250}>
              {communities.map((c) => (
                <CommunityCard key={c.id} community={c} />
              ))}
            </Rail>
          </Animated.View>
        ) : null}

        <Animated.View entering={enter.rise(7)} style={[styles.signin, { backgroundColor: t.c.surface }]}>
          <Text variant="titleS">Your profile is on this phone only</Text>
          <Text variant="bodyS" tone="secondary">
            Sign in to share it with other members: followers, friends, posts, lives, activities and communities.
          </Text>
          <Button label="Sign in" icon="user" onPress={() => router.push('/account')} />
        </Animated.View>

        <View style={styles.about}>
          <IrlyMark size={40} state="idle" ringColor={t.c.textTertiary} lensColor={t.c.brand} glow={false} />
          <Text variant="caption" tone="tertiary" align="center">
            IRLY · Find someone to do something with.
          </Text>
        </View>
      </Animated.ScrollView>
      <View style={[styles.gear, { top: insets.top + 10 }]}>
        <IconButton icon="settings" label={tx('Settings')} variant="glass" onPress={() => router.push('/preferences')} />
      </View>
    </View>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <PressableScale haptic="select" onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={`${value} ${tx(label)}`} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <CountUp value={value} />
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
    </PressableScale>
  );
}

function Row({ icon, title, meta, onPress }: { icon: IconName; title: string; meta: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} style={[styles.row, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <View style={[styles.rowIcon, { backgroundColor: t.light.accentSoft }]}>
        <Icon name={icon} size={18} color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="titleS" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodyS" tone="secondary">
          {meta}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
    </PressableScale>
  );
}

function EmptyRow({ icon, text, onPress }: { icon: IconName; text: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} style={[styles.row, styles.empty, { borderColor: t.c.lineStrong }]}>
      <Icon name={icon} size={18} color={t.c.textTertiary} />
      <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
        {text}
      </Text>
    </PressableScale>
  );
}


const styles = StyleSheet.create({
  signin: { marginHorizontal: space.gutter, marginBottom: space[8], padding: 16, gap: 8, borderRadius: radius.lg },
  gear: { position: 'absolute', right: space.gutter },
  coverFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 },
  newHere: { marginTop: 8, height: 26, paddingHorizontal: 12, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1 },
  identity: { alignItems: 'center', gap: 14, paddingHorizontal: space.gutter, marginBottom: space[8] },
  avatarRing: { borderRadius: 60, borderWidth: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: 16,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginTop: 6,
  },
  vr: { width: StyleSheet.hairlineWidth * 2, height: 34 },
  section: { marginBottom: space[8] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: space.gutter },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  empty: { borderStyle: 'dashed', paddingVertical: 16 },
  group: { marginHorizontal: space.gutter, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  settingBlock: { padding: 16, gap: 10 },
  settingHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 56 },
  about: { alignItems: 'center', gap: 10, paddingVertical: space[6] },
});
