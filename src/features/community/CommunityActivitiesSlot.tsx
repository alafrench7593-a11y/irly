import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { ActivityFeedCard, ProposeActivityButton } from '@/components/cards/ActivityCards';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { openCreate } from '@/features/create/createStore';
import { joinServerActivity } from '@/features/server/activities';
import { useCommunityActivityCards } from '@/features/server/activityCards';
import { t as tx } from '@/i18n';
import { track } from '@/lib/analytics';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { space } from '@/theme/tokens';

/**
 * A community's activities, in its own page: « + Propose an activity » (the
 * real Create form, attached to this community) and its activities as cards
 * in the feed. Each card is the one central activity (never a copy): the
 * same record as in Activities, the map and its chat, live.
 */

type Community = { id: string; name: string; official: boolean; cityId: string; girlOnly: boolean; isMember: boolean };

/** Opens the Create form attached to the community; a visitor joins it first (one tap). */
export function ProposeActivity({ c, join }: { c: Community; join: () => Promise<boolean> }) {
  const name = c.official ? tx(c.name) : c.name;
  const propose = async () => {
    if (!c.isMember && !(await join())) return;
    track('ACTIVITY_PROPOSE', { via: 'community' });
    openCreate(null, { communityId: c.id, communityName: name, cityId: c.cityId, girlOnly: c.girlOnly || undefined });
  };
  return (
    <View style={styles.pad}>
      <ProposeActivityButton communityName={name} onPress={() => void propose()} />
    </View>
  );
}

/** Its activities in the feed (coming up first, ended and cancelled ones say so), « See all » opens the Activities tab. */
export function CommunityActivityFeed({ communityId, onSeeAll }: { communityId: string; onSeeAll: () => void }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { cards } = useCommunityActivityCards(communityId, 3);
  const [joining, setJoining] = useState<string | null>(null);
  if (!cards.length) return null;
  const join = async (id: string) => {
    if (joining) return;
    setJoining(id);
    try {
      const res = await joinServerActivity(id);
      if (res === 'full') toast('Just filled up', 'x', 'live');
      else {
        haptic('success');
        track('ACTIVITY_JOIN', { via: 'community_feed' });
        toast("You're in. It's in your calendar and the chat is open", 'check', 'positive');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live');
    } finally {
      setJoining(null);
    }
  };
  return (
    <View style={[styles.pad, { gap: 10 }]}>
      <View style={styles.head}>
        <Text variant="titleS" style={{ flex: 1 }}>
          Activities
        </Text>
        <PressableScale haptic="select" onPress={onSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel="See all">
          <Text variant="label" tone="brand">
            See all
          </Text>
        </PressableScale>
      </View>
      {cards.map((card, i) => (
        <Animated.View key={card.id} entering={reduced ? undefined : enter.rise(Math.min(i, 4))}>
          <ActivityFeedCard card={card} joining={joining === card.id} onOpen={() => router.push(`/a/${card.id}`)} onJoin={() => void join(card.id)} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
