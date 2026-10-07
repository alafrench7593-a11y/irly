import { useRouter } from 'expo-router';
import { flyFrom } from '@/features/flight/avatarFlight';
import { t as tx } from '@/i18n';
import { memo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ACTIVITIES, USER_TYPES } from '@/data/catalog';
import { areaName, CITIES } from '@/data/destinations';
import { findEvent, findSession, goingCount, peopleByIds } from '@/data/repo';
import type { FeedPlan, Person } from '@/data/types';
import { openHero } from '@/features/hero/heroStore';
import type { Match } from '@/features/matching/match';
import { relativeDay, timeAgo, whenLabel } from '@/lib/time';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Avatar, AvatarStack } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { LiveDot } from '../ui/Controls';
import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';
import { toast } from '../ui/Toast';

/* ───────── Connect button with its three states ───────── */

export function ConnectButton({ person, size = 'md', full }: { person: Person; size?: 'md' | 'sm' | 'lg'; full?: boolean }) {
  const state = useStore((s) => s.connections[person.id]);
  const connect = useStore((s) => s.connect);
  const router = useRouter();
  if (state === 'connected') {
    return (
      <Button
        label="Message"
        icon="message"
        variant="done"
        size={size}
        full={full}
        onPress={() => router.push('/messages')}
      />
    );
  }
  return (
    <Button
      label={state === 'pending' ? 'Requested' : 'Connect'}
      icon={state === 'pending' ? 'clock' : 'plus'}
      variant={state === 'pending' ? 'secondary' : 'primary'}
      size={size}
      full={full}
      haptic={false}
      onPress={() => {
        if (state) return;
        connect(person.id);
        haptic('success');
        toast(tx('Request sent to {name}', { name: person.name }), 'send', 'brand');
      }}
    />
  );
}

/* ───────── Person card (matching results) ───────── */

export const PersonCard = memo(function PersonCard({ match, width }: { match: Match; width?: number }) {
  const t = useTheme();
  const router = useRouter();
  const p = match.person;
  const city = CITIES[p.cityId];
  const face = useRef<View>(null);
  return (
    <PressableScale
      onPress={() => flyFrom(face.current, p, () => router.push(`/person/${p.id}`))}
      style={[styles.person, { width, backgroundColor: t.c.surface, borderColor: t.c.line }]}
      accessibilityLabel={`${p.name}, ${p.headline}`}
    >
      <View style={styles.personTop}>
        <View ref={face} collapsable={false}>
          <Avatar name={p.name} hue={p.hue} size={56} online={p.online} verified={p.verified} photo={p.photo} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.row}>
            <Text variant="titleM" raw>{p.name}</Text>
            <Text variant="body" tone="tertiary">
              {p.age}
            </Text>
          </View>
          <Text variant="bodyS" tone="secondary" numberOfLines={1}>
            {p.headline}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {[...p.types.map((x) => tx(USER_TYPES[x].label)), areaName(city, p.areaId)].join(' · ')}
          </Text>
        </View>
      </View>
      <View style={[styles.strength, { backgroundColor: t.c.brandSoft }]}>
        <Icon name="sparkles" size={13} color={t.c.brand} />
        <Text variant="caption" tone="brand">
          {match.strength}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {match.reasons.map((r) => (
          <View key={r} style={styles.row}>
            <View style={[styles.reasonDot, { backgroundColor: t.accent }]} />
            <Text variant="bodyS" style={{ flex: 1 }} numberOfLines={1}>
              {r}
            </Text>
          </View>
        ))}
      </View>
      <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
        {p.activities.slice(0, 3).map((k) => (
          <View key={k} style={[styles.tag, { backgroundColor: t.c.overlay }]}>
            <Icon name={ACTIVITIES[k].icon} size={12} color={t.c.textSecondary} />
            <Text variant="caption" tone="secondary">
              {ACTIVITIES[k].label}
            </Text>
          </View>
        ))}
      </View>
      <ConnectButton person={p} size="md" full />
    </PressableScale>
  );
});

/* ───────── Real-life plan (Social feed) ───────── */

export function planHeadline(plan: FeedPlan): { headline: string; going: number; when: string } | null {
  if (plan.ref.type === 'session') {
    const s = findSession(plan.ref.id);
    if (!s) return null;
    const city = CITIES[s.cityId];
    const going = goingCount(s, false);
    return {
      headline: tx(going === 1 ? '{n} person is {verb} {day}.' : '{n} people are {verb} {day}.', { n: going, verb: tx(ACTIVITIES[s.kind].verb), day: relativeDay(s.when, city) }),
      going,
      when: `${whenLabel(s.when, city)} · ${areaName(city, s.areaId)}`,
    };
  }
  const e = findEvent(plan.ref.id);
  if (!e) return null;
  const city = CITIES[e.cityId];
  return {
    headline: tx('{title} {day}.', { title: tx(plan.label ?? e.title), day: relativeDay(e.when, city) }),
    going: goingCount(e, false),
    when: `${tx(e.title)} · ${whenLabel(e.when, city)}`,
  };
}

export const PlanCard = memo(function PlanCard({ plan }: { plan: FeedPlan }) {
  const t = useTheme();
  const joined = useStore((s) => Boolean(s.joined[plan.ref.id]));
  const toggleJoin = useStore((s) => s.toggleJoin);
  const info = planHeadline(plan);
  if (!info) return null;
  const ref = plan.ref.type === 'session' ? findSession(plan.ref.id) : findEvent(plan.ref.id);
  const people = ref ? peopleByIds(ref.goingIds) : [];
  const soon = ref ? ref.when.dayOffset === 0 : false;
  return (
    <PressableScale
      onPress={() => openHero({ kind: plan.ref.type, id: plan.ref.id })}
      style={[styles.plan, { backgroundColor: t.c.surface, borderColor: t.c.line }]}
    >
      <View style={styles.row}>
        <View style={[styles.planIcon, { backgroundColor: t.light.accentSoft }]}>
          <Icon name={plan.icon} size={18} color={t.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            {soon ? <LiveDot size={6} /> : null}
            <Text variant="caption" tone={soon ? 'live' : 'tertiary'}>
              {tx(soon ? 'Today · posted {ago} ago' : 'Coming up · posted {ago} ago', { ago: timeAgo(plan.postedMinAgo) })}
            </Text>
          </View>
        </View>
      </View>
      <Text variant="displayM" style={{ marginTop: space[3] }}>
        {info.headline}
      </Text>
      <Text variant="bodyS" tone="secondary" style={{ marginTop: 4 }} numberOfLines={1}>
        {info.when}
      </Text>
      {plan.note ? (
        <Text variant="bodyS" tone="accent" style={{ marginTop: 2 }} numberOfLines={1}>
          {plan.note}
        </Text>
      ) : null}
      <View style={[styles.row, { justifyContent: 'space-between', marginTop: space[5] }]}>
        <AvatarStack people={people} size={30} max={4} extra={ref ? ref.extraGoing + (joined ? 1 : 0) : 0} />
        <Button
          label={joined ? "I'm in" : 'Count me in'}
          variant={joined ? 'done' : 'primary'}
          icon={joined ? 'check' : undefined}
          size="sm"
          haptic={false}
          onPress={() => {
            const on = toggleJoin(plan.ref.id);
            haptic(on ? 'success' : 'tap');
            if (on) toast("You're in. The group chat is open", 'check');
          }}
        />
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  person: { padding: 16, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, gap: 14 },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  strength: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, height: 24, borderRadius: 12 },
  reasonDot: { width: 6, height: 6, borderRadius: 3 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 26, borderRadius: 13 },
  plan: { padding: 18, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  planIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
