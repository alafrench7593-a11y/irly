import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { removeFriend } from '@/features/server/social';
import { proConnect } from './api';
import { openDirect } from '@/features/server/engage';
import { useT } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { matchSentence, roundDistance, type ProMatch, type ProProfile } from './match';
import { INDUSTRY, ROLE_LABEL } from './taxonomy';

export const hueOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** "Dubai Marina · Dubai", or the city alone when there is no neighbourhood. */
export function placeOf(p: Pick<ProProfile, 'cityId' | 'areaId'>): string {
  const city = CITIES[p.cityId as CityId];
  if (!city) return p.cityId;
  return p.areaId ? `${areaName(city, p.areaId)} · ${city.name}` : city.name;
}

/**
 * Connect → Requested → Connected (Message). An incoming request shows
 * Accept. Every state change is optimistic and rolls back on failure.
 */
export function ConnectAction({
  pro,
  onChange,
  size = 'sm',
  full,
}: {
  pro: Pick<ProProfile, 'userId' | 'firstName' | 'connection'>;
  onChange: (c: ProProfile['connection']) => void;
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
}) {
  const router = useRouter();
  const tr = useT();
  const [busy, setBusy] = useState(false);
  const run = async (next: ProProfile['connection'], work: () => Promise<unknown>, done: string) => {
    if (busy) return;
    const before = pro.connection;
    setBusy(true);
    onChange(next);
    try {
      const r = await work();
      // They had already asked you: Connect accepted their request.
      const accepted = r === 'accepted';
      if (accepted) onChange('connected');
      haptic('success');
      toast(tr(accepted ? 'You and {name} are connected' : done, { name: pro.firstName }), 'check', 'brand');
    } catch (e) {
      onChange(before);
      toast(e instanceof Error ? e.message : tr('Could not connect'), 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  if (pro.connection === 'connected') {
    return (
      <Button
        label="Message"
        icon="message"
        size={size}
        full={full}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            const conv = await openDirect(pro.userId);
            router.push(`/messages/${conv}`);
          } catch (e) {
            toast(e instanceof Error ? e.message : tr('Could not open the chat'), 'x', 'live');
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }
  if (pro.connection === 'incoming') {
    return (
      <View style={{ flexDirection: 'row', gap: 8, alignSelf: full ? 'stretch' : 'auto' }}>
        <View style={{ flex: 2 }}>
          <Button label="Accept" icon="check" size={size} full loading={busy} onPress={() => run('connected', () => proConnect(pro.userId), 'You and {name} are connected')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Decline" variant="secondary" size={size} full disabled={busy} onPress={() => run('none', () => removeFriend(pro.userId), 'Request from {name} declined')} />
        </View>
      </View>
    );
  }
  if (pro.connection === 'requested') {
    return (
      <Button
        label="Requested"
        icon="clock"
        variant="secondary"
        size={size}
        full={full}
        loading={busy}
        accessibilityHint={tr('Tap to withdraw the request')}
        onPress={() => run('none', () => removeFriend(pro.userId), 'Request to {name} withdrawn')}
      />
    );
  }
  return <Button label="Connect" icon="plus" size={size} full={full} loading={busy} onPress={() => run('requested', () => proConnect(pro.userId), 'Request sent to {name}')} />;
}

/** "92%" in a black pill, with the reason underneath on cards. */
export function MatchPill({ percent, inverted }: { percent: number; inverted?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: inverted ? t.c.bg : t.c.text }]}>
      <Icon name="sparkles" size={12} color={inverted ? t.c.text : t.c.bg} />
      <Text variant="label" color={inverted ? t.c.text : t.c.bg} raw>
        {`${percent}%`}
      </Text>
    </View>
  );
}

export function IndustryTags({ ids, max = 3 }: { ids: ProProfile['industries']; max?: number }) {
  const t = useTheme();
  const tr = useT();
  return (
    <View style={styles.tags}>
      {ids.slice(0, max).map((id) => (
        <View key={id} style={[styles.tag, { borderColor: t.c.line }]}>
          <Text variant="caption" raw>
            {`${INDUSTRY[id].emoji} ${tr(INDUSTRY[id].short)}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A professional in the Discover list. */
export function ProCard({
  pro,
  photo,
  match,
  onConnection,
}: {
  pro: ProProfile;
  photo?: string;
  match: ProMatch | null;
  onConnection: (c: ProProfile['connection']) => void;
}) {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const where = [placeOf(pro), match?.distanceKm != null ? roundDistance(match.distanceKm) : null].filter(Boolean).join(' · ');
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.985}
      onPress={() => router.push(`/network/${pro.userId}`)}
      accessibilityLabel={`${pro.firstName}, ${pro.jobTitle}`}
      style={[styles.card, { backgroundColor: t.c.surface, borderColor: t.c.line, boxShadow: t.shadow.card }]}
    >
      <View style={styles.head}>
        <Avatar name={pro.firstName} hue={hueOf(pro.userId)} size={56} photo={photo} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameRow}>
            <Text variant="titleM" numberOfLines={1} raw style={{ flexShrink: 1 }}>
              {pro.firstName}
            </Text>
            <Text variant="caption" tone="tertiary">
              {ROLE_LABEL[pro.role]}
            </Text>
          </View>
          <Text variant="bodyS" numberOfLines={1} raw>
            {pro.company ? `${pro.jobTitle} · ${pro.company}` : pro.jobTitle}
          </Text>
          <View style={styles.whereRow}>
            <Icon name="pin" size={12} color={t.c.textTertiary} />
            <Text variant="caption" tone="tertiary" numberOfLines={1} raw>
              {where}
            </Text>
          </View>
        </View>
        {match ? <MatchPill percent={match.percent} /> : null}
      </View>

      {pro.project ? (
        <Text variant="bodyS" tone="secondary" numberOfLines={2} raw>
          {pro.project}
        </Text>
      ) : null}
      <IndustryTags ids={pro.industries} />
      {match ? (
        <View style={[styles.why, { backgroundColor: t.c.bg }]}>
          <Text variant="caption" raw>
            <Text variant="caption" style={{ fontWeight: '700' }} raw>
              {tr('{n}% match', { n: match.percent })}
            </Text>
            {` — ${matchSentence(match, tr)}`}
          </Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <ConnectAction pro={pro} onChange={onConnection} full />
        </View>
        <Button label="Profile" variant="secondary" size="sm" iconRight="chevronRight" onPress={() => router.push(`/network/${pro.userId}`)} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 10, borderRadius: radius.pill },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { height: 26, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, justifyContent: 'center' },
  why: { padding: 12, borderRadius: radius.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space[1] },
});

/** The way into professional networking, from the Networking category, Business and your profile. */
export function NetworkDoor({ style }: { style?: object }) {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  return (
    <PressableScale
      haptic="tap"
      scaleTo={0.98}
      onPress={() => router.push('/network')}
      accessibilityRole="button"
      accessibilityLabel={tr('Professionals: meet founders, freelancers and investors')}
      style={[doorStyles.door, { backgroundColor: t.c.text }, style]}
    >
      <View style={[doorStyles.icon, { borderColor: t.c.bg }]}>
        <Icon name="network" size={20} color={t.c.bg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="overline" color={t.c.bg} style={{ opacity: 0.7 }}>
          Networking
        </Text>
        <Text variant="titleM" color={t.c.bg}>
          Professionals
        </Text>
        <Text variant="bodyS" color={t.c.bg} style={{ opacity: 0.75 }} numberOfLines={2}>
          Founders, freelancers, investors. See your match, connect, meet IRL.
        </Text>
      </View>
      <Icon name="arrowRight" size={20} color={t.c.bg} />
    </PressableScale>
  );
}

const doorStyles = StyleSheet.create({
  door: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.xl },
  icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
