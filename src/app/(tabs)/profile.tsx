import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LANGS, t as tx, useLangStore } from '@/i18n';
import { wipeLocal } from '@/state/wipe';
import { deleteServerAccount, signOut, useAccount } from '@/features/auth/account';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyMark } from '@/brand/IrlyMark';
import { Rail } from '@/components/cards/Blocks';
import { CommunityCard } from '@/components/cards/ThingCards';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { Badge, Divider, SectionHeader } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Cover } from '@/components/visual/Cover';
import { ACTIVITIES, INTERESTS, SERVICE_CATEGORIES, USER_TYPES } from '@/data/catalog';
import { CITIES, DESTINATIONS } from '@/data/destinations';
import { findCommunity, findEvent, findService, findSession } from '@/data/repo';
import { DestinationSheet } from '@/features/destination/DestinationSheet';
import { openHero } from '@/features/hero/heroStore';
import { whenLabel } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { CountUp } from '@/motion/CountUp';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function Profile() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const langSetting = useLangStore((s) => s.setting);
  const setLang = useLangStore((s) => s.set);
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const dest = DESTINATIONS[city.destinationId];
  const profile = useStore((s) => s.profile);
  const joined = useStore((s) => s.joined);
  const memberOf = useStore((s) => s.memberOf);
  const connections = useStore((s) => s.connections);
  const bookings = useStore((s) => s.bookings);
  const hapticsOn = useStore((s) => s.hapticsOn);
  const setHaptics = useStore((s) => s.setHaptics);
  const setAppearance = useStore((s) => s.setAppearance);
  const now = useNow();
  const days = profile.arrivedAt ? Math.max(1, Math.round((now - profile.arrivedAt) / 86_400_000)) : 0;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [destSheet, setDestSheet] = useState(false);
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
  const connected = Object.values(connections).filter((s) => s === 'connected').length;

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
              {[profile.age, profile.country, city.name].filter(Boolean).join(' · ')} {city.destinationId === 'bali' ? '🌴' : dest.flag}
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
            <Stat value={connected} label="Connections" />
            <View style={[styles.vr, { backgroundColor: t.c.line }]} />
            <Stat value={plans.length} label="Plans" />
            <View style={[styles.vr, { backgroundColor: t.c.line }]} />
            <Stat value={communities.length} label="Communities" />
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
            {plans.length === 0 ? (
              <EmptyRow icon="calendar" text="Nothing planned yet. Join a plan and it lands here." onPress={() => router.push('/social')} />
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

        {communities.length ? (
          <Animated.View entering={enter.rise(6)} style={styles.section}>
            <SectionHeader title="Your communities" />
            <Rail itemWidth={250}>
              {communities.map((c) => (
                <CommunityCard key={c.id} community={c} />
              ))}
            </Rail>
          </Animated.View>
        ) : null}

        <Animated.View entering={enter.rise(7)} style={styles.section}>
          <SectionHeader title="Your IRLY" />
          <View style={[styles.group, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
            <SettingLink icon="calendar" label="Calendar" value="Everything you're going to" onPress={() => router.push('/calendar')} />
            <Divider inset={16} />
            <SettingLink icon="bookmark" label="Saved" value="Plans, places, people" onPress={() => router.push('/saved')} />
            <Divider inset={16} />
            <SettingLink icon="sparkles" label="Assistant" value="Ask or speak" onPress={() => router.push('/assistant')} />
            <Divider inset={16} />
            <SettingLink icon="shield" label="Privacy & notifications" value="Visibility, alerts" onPress={() => router.push('/settings')} />
          </View>
        </Animated.View>

        <Animated.View entering={enter.rise(8)} style={styles.section}>
          <SectionHeader title="Settings" />
          <View style={[styles.group, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
            <View style={[styles.settingRow]}>
              <Icon name="zap" size={18} color={t.c.text} />
              <Text variant="titleS" style={{ flex: 1 }}>
                Haptic feedback
              </Text>
              <Switch
                value={hapticsOn}
                onValueChange={setHaptics}
                trackColor={{ true: t.c.brand, false: t.c.overlay }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Haptic feedback"
              />
            </View>
            <Divider inset={16} />
            <SettingLink
              icon="languages"
              label="Language"
              value={LANGS.find((l) => l.id === langSetting)?.label}
              onPress={() => setLang(langSetting === 'auto' ? 'fr' : langSetting === 'fr' ? 'en' : 'auto')}
            />
            <Divider inset={16} />
            <SettingLink
              icon={t.mode === 'night' ? 'moon' : 'sun'}
              label="Appearance"
              value={t.mode === 'night' ? 'Dark' : 'Light'}
              onPress={() => setAppearance(t.mode === 'night' ? 'day' : 'night')}
            />
            <Divider inset={16} />
            <SettingLink icon="user" label="IRLY account" value={account ? 'Signed in' : 'Sign in to sync'} onPress={() => router.push('/account')} />
            <Divider inset={16} />
            <SettingLink icon="globe" label="Destination" value={`${tx(dest.shortName)} · ${city.name}`} onPress={() => setDestSheet(true)} />
            <Divider inset={16} />
            <SettingLink icon="palette" label="IRLY Design System" value="Tokens & components" onPress={() => router.push('/design-system')} />
            <Divider inset={16} />
            <SettingLink
              icon="arrowLeft"
              label="Log out"
              onPress={() => {
                signOut().catch(() => undefined);
                wipeLocal();
                router.replace('/welcome');
              }}
            />
            <Divider inset={16} />
            <SettingLink icon="x" label="Delete account" danger onPress={() => setConfirmDelete(true)} />
          </View>
        </Animated.View>

        <View style={styles.about}>
          <IrlyMark size={40} state="idle" ringColor={t.c.textTertiary} lensColor={t.c.brand} glow={false} />
          <Text variant="caption" tone="tertiary" align="center">
            IRLY · Find someone to do something with.
          </Text>
        </View>
      </Animated.ScrollView>
      <DestinationSheet visible={destSheet} onClose={() => setDestSheet(false)} />
      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your IRLY account?"
        subtitle="This permanently removes your profile, connections and content. It cannot be undone."
      >
        <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
          <Button
            label="DELETE ACCOUNT"
            full
            haptic="warning"
            variant="danger"
            onPress={async () => {
              try {
                // Server first: if it fails, nothing is wiped and the member can retry.
                await deleteServerAccount();
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Could not delete your account. Try again.', 'x', 'live');
                return;
              }
              wipeLocal();
              setConfirmDelete(false);
              toast('Your account has been deleted', 'check', 'live');
              router.replace('/welcome');
            }}
          />
          <Button label="Cancel" variant="ghost" full onPress={() => setConfirmDelete(false)} />
        </View>
      </Sheet>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <CountUp value={value} />
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
    </View>
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

function SettingLink({ icon, label, value, onPress, danger }: { icon: IconName; label: string; value?: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.98}
      onPress={onPress}
      style={styles.settingRow}
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <Icon name={icon} size={18} color={danger ? t.c.critical : t.c.text} />
      <Text variant="titleS" color={danger ? t.c.critical : undefined} style={{ flex: 1 }}>
        {label}
      </Text>
      {value ? (
        <Text variant="bodyS" tone="tertiary">
          {value}
        </Text>
      ) : null}
      <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
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
