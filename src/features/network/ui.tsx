import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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
import { INDUSTRY, INTENT, ROLE_LABEL } from './taxonomy';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { AccentFill, layered, PaneLight, useNetworkTone } from './tone';

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
  // State lags a fast double tap; the ref does not, so each action (and each chat push) runs once.
  const inFlight = useRef(false);
  const run = async (next: ProProfile['connection'], work: () => Promise<unknown>, done: string) => {
    if (busy || inFlight.current) return;
    inFlight.current = true;
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
      inFlight.current = false;
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
          if (inFlight.current) return;
          inFlight.current = true;
          setBusy(true);
          try {
            const conv = await openDirect(pro.userId);
            router.push(`/messages/${conv}`);
          } catch (e) {
            toast(e instanceof Error ? e.message : tr('Could not open the chat'), 'x', 'live');
          } finally {
            setBusy(false);
            setTimeout(() => {
              inFlight.current = false;
            }, 700);
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

/**
 * "92%" in a pill of the accent (violet gradient in IRLY Girl, ink in IRLY),
 * with the reason underneath on cards. `inverted` sits on a contrast panel.
 */
export function MatchPill({ percent, inverted }: { percent: number; inverted?: boolean }) {
  const t = useTheme();
  const tone = useNetworkTone();
  if (inverted) {
    const bg = tone.isGirl ? '#FFFFFF' : t.c.bg;
    const fg = tone.isGirl ? tone.accent : t.c.text;
    return (
      <View style={[styles.pill, { backgroundColor: bg }]}>
        <Icon name="sparkles" size={12} color={fg} />
        <Text variant="label" color={fg} raw>
          {`${percent}%`}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, layered, { overflow: 'hidden', boxShadow: tone.isGirl ? tone.glow : undefined }]}>
      <AccentFill colors={tone.gradient} />
      <Icon name="sparkles" size={12} color={tone.onAccent} />
      <Text variant="label" color={tone.onAccent} raw>
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

/**
 * A professional in the Discover list: who (photo, name, job, company),
 * where (neighbourhood, rounded distance), two domains, three skills (the
 * ones you share first), the goals you share, then Connect and the profile.
 */
export function ProCard({
  pro,
  photo,
  match,
  mine,
  onConnection,
}: {
  pro: ProProfile;
  photo?: string;
  match: ProMatch | null;
  /** Your own professional profile, for what you share. */
  mine?: ProProfile | null;
  onConnection: (c: ProProfile['connection']) => void;
}) {
  const t = useTheme();
  const tone = useNetworkTone();
  const tr = useT();
  const router = useRouter();
  const where = [placeOf(pro), match?.distanceKm != null ? roundDistance(match.distanceKm) : null].filter(Boolean).join(' · ');
  const sharedSkill = (s: string) => Boolean(mine?.skills.some((x) => x.toLowerCase() === s.toLowerCase()));
  const skills = [...pro.skills].sort((a, b) => Number(sharedSkill(b)) - Number(sharedSkill(a))).slice(0, 3);
  const goals = mine ? pro.intents.filter((i) => i !== 'meet' && mine.intents.includes(i)).slice(0, 2) : [];
  const open = () => router.push(`/network/${pro.userId}`);
  const profile = <Button label="View profile" variant="secondary" size="sm" iconRight="chevronRight" onPress={open} />;
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.985}
      onPress={open}
      accessibilityLabel={[pro.firstName, pro.jobTitle, pro.company].filter(Boolean).join(', ')}
      style={[styles.card, { backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent', boxShadow: t.shadow.card }]}
    >
      <GlassLayer radius={radius.xl} />
      <PaneLight radius={radius.xl} />
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
            <Text variant="caption" tone="tertiary" numberOfLines={1} raw style={{ flexShrink: 1 }}>
              {where}
            </Text>
          </View>
        </View>
        {match ? <MatchPill percent={match.percent} /> : null}
      </View>

      {pro.project ? (
        <Text variant="bodyS" tone="secondary" numberOfLines={1} raw>
          {pro.project}
        </Text>
      ) : null}
      <View style={styles.tags}>
        {pro.industries.slice(0, 2).map((id) => (
          <View key={id} style={[styles.tag, { borderColor: t.c.line }]}>
            <Text variant="caption" numberOfLines={1} raw>
              {`${INDUSTRY[id].emoji} ${tr(INDUSTRY[id].short)}`}
            </Text>
          </View>
        ))}
        {skills.map((s) => {
          const shared = sharedSkill(s);
          return (
            <View key={s} style={[styles.tag, { maxWidth: '100%', borderColor: shared ? tone.accent : t.c.line, backgroundColor: shared ? tone.accent : 'transparent' }]}>
              <Text variant="caption" color={shared ? tone.onAccent : t.c.textSecondary} numberOfLines={1}>
                {s}
              </Text>
            </View>
          );
        })}
      </View>
      {goals.length ? (
        <View style={styles.whereRow}>
          <Icon name="target" size={12} color={tone.accent} />
          <Text variant="caption" tone="secondary" numberOfLines={1} raw style={{ flexShrink: 1 }}>
            {tr('You both: {what}', { what: goals.map((g) => `${INTENT[g].emoji} ${tr(INTENT[g].label)}`).join(', ') })}
          </Text>
        </View>
      ) : null}
      {match ? (
        <View style={[styles.why, { backgroundColor: tone.soft, borderColor: tone.softLine }]}>
          <Text variant="caption" numberOfLines={3} raw>
            <Text variant="caption" style={{ fontWeight: '700' }} raw>
              {tr('{n}% match', { n: match.percent })}
            </Text>
            {` — ${matchSentence(match, tr)}`}
          </Text>
        </View>
      ) : null}
      {pro.connection === 'incoming' ? (
        // Accept and Decline need the width: the profile goes underneath.
        <View style={{ gap: 8, marginTop: space[1] }}>
          <ConnectAction pro={pro} onChange={onConnection} full />
          {profile}
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <ConnectAction pro={pro} onChange={onConnection} full />
          </View>
          {profile}
        </View>
      )}
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
  why: { padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space[1] },
});

/** The way into professional networking, from the Networking category, Business and your profile. */
export function NetworkDoor({ style }: { style?: object }) {
  const tone = useNetworkTone();
  const tr = useT();
  const router = useRouter();
  // IRLY Girl: the deep violet panel; IRLY: the ink panel. Same door, own identity.
  const fg = tone.onPanel;
  return (
    <PressableScale
      haptic="tap"
      scaleTo={0.98}
      onPress={() => router.push('/network')}
      accessibilityRole="button"
      accessibilityLabel={tr('Professionals: meet founders, freelancers and investors')}
      style={[doorStyles.door, layered, { overflow: 'hidden', boxShadow: tone.isGirl ? tone.glow : undefined }, style]}
    >
      <AccentFill colors={tone.panel} />
      <View style={[doorStyles.icon, { borderColor: fg }]}>
        <Icon name="network" size={20} color={fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="overline" color={fg} style={{ opacity: 0.7 }}>
          Networking
        </Text>
        <Text variant="titleM" color={fg}>
          Professionals
        </Text>
        <Text variant="bodyS" color={fg} style={{ opacity: 0.75 }} numberOfLines={2}>
          Founders, freelancers, investors. See your match, connect, meet IRL.
        </Text>
      </View>
      <Icon name="arrowRight" size={20} color={fg} />
    </PressableScale>
  );
}

const doorStyles = StyleSheet.create({
  door: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.xl },
  icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
