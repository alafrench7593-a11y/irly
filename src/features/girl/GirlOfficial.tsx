import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { DEMO } from '@/config/app';
import type { PhotoKey } from '@/data/photos';
import { joinCommunity, leaveCommunity } from '@/features/community/data';
import { useGirlOfficialCommunities, type GirlOfficialCommunity, type GirlOfficialTopic } from '@/features/community/official';
import { usePhotoLink } from '@/features/server/covers';
import { t as tx } from '@/i18n';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { girl, GIRL_TINT, girlType } from './theme';
import { GButton, GIconWell } from './ui';

/** Each official community's photo (until its hosts set one): IRLY's own photos taken in Dubai. */
const PHOTO: Record<GirlOfficialTopic, PhotoKey> = {
  girl_newcomers: 'newcomerGirl',
  girl_network: 'networkingGirl',
  girl_francophone: 'brunchGirl',
  girl_trip: 'girlTrip',
  girl_activity: 'padelGirl',
};

/** The demo build has no server: the same five, with no members and nothing to join. */
const DEMO_FIVE: GirlOfficialCommunity[] = [
  { id: 'demo-girl_newcomers', topic: 'girl_newcomers', name: 'IRLY Nouvelle Arrivante', tagline: 'Just arrived in Dubai? Ask anything, get tips and meet other newcomers.', emoji: '👋', members: 0, isMember: false, coverPath: null },
  { id: 'demo-girl_network', topic: 'girl_network', name: 'IRLY Girl Networking', tagline: 'Women in business: entrepreneurship, opportunities, collaborations and your network.', emoji: '💼', members: 0, isMember: false, coverPath: null },
  { id: 'demo-girl_francophone', topic: 'girl_francophone', name: 'IRLY Francophone', tagline: 'French-speaking girls in Dubai: chats, meetups and activities in French.', emoji: '🥐', members: 0, isMember: false, coverPath: null },
  { id: 'demo-girl_trip', topic: 'girl_trip', name: 'IRLY Girl Trip', tagline: 'Trips, excursions, getaways and road trips between girls.', emoji: '✈️', members: 0, isMember: false, coverPath: null },
  { id: 'demo-girl_activity', topic: 'girl_activity', name: 'IRLY Activité', tagline: 'Sport, outings, restaurants, beach clubs, shopping, wellness and everything to do together.', emoji: '✨', members: 0, isMember: false, coverPath: null },
];

/**
 * IRLY Girl's five official communities, as cards: photo, name, what it is
 * for, its real member count and a Join button that answers at once (the
 * count follows the server). Joining twice or leaving twice is never sent:
 * a card waits for its answer.
 */
export function GirlOfficialCommunities() {
  const router = useRouter();
  const server = useGirlOfficialCommunities();
  const list = DEMO ? DEMO_FIVE : server.list;
  if (!DEMO && server.loading) {
    return (
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={128} radius={radius.xl} />
        ))}
      </View>
    );
  }
  if (!DEMO && server.error && !list?.length) {
    return (
      <View style={[styles.list, styles.error]}>
        <GIconWell icon="globe" tone="error" size={36} />
        <Text variant="bodyS" color={girl.inkSoft}>
          Communities could not load.
        </Text>
        <GButton label="Try again" variant="secondary" onPress={server.refresh} />
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {(list ?? []).map((c, i) => (
        <OfficialCard key={c.id} c={c} index={i} onOpen={() => (DEMO ? toast(tx('Sign in to join IRLY Girl communities'), 'users') : router.push(`/c/${c.id}`))} />
      ))}
    </View>
  );
}

function OfficialCard({ c, index, onOpen }: { c: GirlOfficialCommunity; index: number; onOpen: () => void }) {
  const reduced = useReducedMotion();
  const uri = usePhotoLink(c.coverPath);
  // The answer shown at once; the server's list (refreshed by the join) takes over.
  const [mine, setMine] = useState<{ member: boolean; members: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const member = mine?.member ?? c.isMember;
  const members = mine && mine.member !== c.isMember ? mine.members : c.members;

  const toggle = async () => {
    if (DEMO) return onOpen();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    const next = !member;
    setMine({ member: next, members: Math.max(0, members + (next ? 1 : -1)) });
    try {
      if (next) {
        await joinCommunity(c.id);
        toast(tx('Welcome to {name} 👋', { name: c.name }), 'users', 'brand');
      } else {
        await leaveCommunity(c.id);
        toast(tx('You left {name}', { name: c.name }), 'users');
      }
    } catch (e) {
      setMine(null);
      toast(e instanceof Error ? e.message : 'Something went wrong', 'x', 'live');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <Animated.View entering={reduced ? undefined : enter.rise(index)} layout={reduced ? undefined : LinearTransition.springify().damping(18)}>
      <PressableScale haptic="select" scaleTo={0.98} onPress={onOpen} style={styles.card} accessibilityRole="link" accessibilityLabel={tx('{name}, {n} members', { name: c.name, n: members })}>
        <Photo pinned tint={GIRL_TINT} visual={{ photo: PHOTO[c.topic] ?? 'girlsOut', uri: uri ?? undefined }} light="dubai" scrim="strong" style={StyleSheet.absoluteFill} width={700} recyclingKey={`gof-${c.id}-${c.coverPath ?? 'app'}`} />
        <View style={styles.inner}>
          <View style={styles.top}>
            <View style={styles.badge}>
              <Text style={{ fontSize: 16 }} raw>
                {c.emoji || '✨'}
              </Text>
            </View>
            <Text variant="caption" color="rgba(255,255,255,0.86)">
              {members ? tx(members === 1 ? '{n} member' : '{n} members', { n: members }) : tx('Be one of the first')}
            </Text>
          </View>
          <View style={styles.bottom}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="titleM" color="#FFFFFF" numberOfLines={1} raw style={girlType.card}>
                {c.name}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.88)" numberOfLines={2}>
                {c.tagline}
              </Text>
            </View>
            <PressableScale
              haptic={member ? 'select' : 'success'}
              scaleTo={0.92}
              onPress={toggle}
              disabled={busy}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ selected: member, busy }}
              accessibilityLabel={member ? tx('Leave {name}', { name: c.name }) : tx('Join {name}', { name: c.name })}
              style={[styles.join, member ? styles.joined : null, busy ? { opacity: 0.7 } : null]}
            >
              <Text variant="label" color={member ? '#FFFFFF' : girl.ink}>
                {member ? 'Joined' : 'Join'}
              </Text>
            </PressableScale>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.gutter, gap: 12 },
  error: { alignItems: 'flex-start', gap: 8 },
  card: { height: 148, borderRadius: radius.xl, overflow: 'hidden', boxShadow: girl.shadowSoft },
  inner: { flex: 1, padding: 14, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,250,246,0.92)', alignItems: 'center', justifyContent: 'center' },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  join: { minWidth: 84, height: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,250,246,0.95)' },
  joined: { backgroundColor: 'rgba(185,43,105,0.92)' },
});
