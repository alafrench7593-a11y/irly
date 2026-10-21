import { StyleSheet, View } from 'react-native';
import { ActivityChatBanner, ActivityFeedCard, ActivityShareCard, ProposeActivityButton } from '@/components/cards/ActivityCards';
import { Button } from '@/components/ui/Button';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ideaPhoto } from '@/data/catalog/categories';
import { openCreate } from '@/features/create/createStore';
import type { ActivityCard } from '@/features/server/activityCards';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { t as tx } from '@/i18n';

/**
 * The activity cards of communities and chats, in every state, for the
 * team's component gallery (design-system, demo and development builds
 * only). Example content: nothing here is saved or shown to members.
 */

const HOUR = 3_600_000;
// One clock for the gallery: the times never drift while it is open.
const T0 = Math.floor(Date.now() / HOUR) * HOUR;

function example(over: Partial<ActivityCard> & Pick<ActivityCard, 'id' | 'title'>): ActivityCard {
  return {
    startsAt: T0 + 50 * HOUR,
    endsAt: T0 + 52 * HOUR,
    placeName: 'Marina Padel Club',
    areaId: 'marina',
    cityId: 'dubai',
    categoryId: 'sport',
    photo: ideaPhoto('sport', over.title),
    coverUrl: null,
    priceMinor: 0,
    currency: 'AED',
    capacity: 8,
    going: 5,
    state: 'open',
    girlOnly: false,
    communityId: 'example-community',
    communityName: 'Marina Padel Crew',
    creatorId: 'example-host',
    creatorName: 'Lina',
    myStatus: null,
    conversationId: null,
    canMessageHost: true,
    pinned: false,
    ...over,
  };
}

export function ActivityCardsGallery({ girl }: { girl: boolean }) {
  const t = useTheme();
  const community = girl ? 'Marina Girls Yoga' : 'Marina Padel Crew';
  const open = example({ id: 'ex-open', title: girl ? 'Sunrise yoga at Kite Beach' : 'Padel doubles, intermediate', priceMinor: 5000, pinned: true, girlOnly: girl, communityName: community, ...(girl ? { categoryId: 'wellness', photo: 'kiteBeach' as const, placeName: 'Kite Beach', areaId: 'kitebeach' } : {}) });
  const full = example({ id: 'ex-full', title: girl ? 'Girls brunch at La Mer' : 'Sunset run, 5 km', going: 6, capacity: 6, girlOnly: girl, placeName: girl ? 'La Mer' : 'Kite Beach', areaId: girl ? 'lamer' : 'kitebeach', startsAt: T0 + 26 * HOUR, endsAt: null });
  const going = example({ id: 'ex-going', title: 'Beach volley', myStatus: 'going', going: 4, capacity: 10, conversationId: 'example-chat', placeName: 'JBR Beach', areaId: 'jbr', girlOnly: girl });
  const cancelled = example({ id: 'ex-cancel', title: 'Desert sunrise hike', state: 'cancelled', going: 3, capacity: null, placeName: 'Al Qudra', areaId: 'alqudra', girlOnly: girl });
  const ended = example({ id: 'ex-ended', title: 'Friday coffee meetup', state: 'ended', startsAt: T0 - 20 * HOUR, endsAt: T0 - 18 * HOUR, going: 9, capacity: 12, placeName: 'Kulture House', areaId: 'jumeirah', girlOnly: girl });
  const say = (what: string) => () => toast(what, 'sparkles', 'brand');
  return (
    <View style={{ gap: 14 }}>
      <Text variant="overline" tone="secondary">
        {tx('Community · {name}', { name: community })}
      </Text>
      <ProposeActivityButton communityName={community} onPress={() => openCreate(null, { communityId: 'example-community', communityName: community, cityId: 'dubai', girlOnly: girl || undefined })} />
      <ActivityFeedCard card={open} onOpen={say('Opens the activity')} onJoin={say('Joined')} />
      <ActivityFeedCard card={full} onOpen={say('Opens the activity')} onJoin={say('Joined')} />
      <ActivityFeedCard card={going} onOpen={say('Opens the activity')} onJoin={say('Joined')} />
      <ActivityFeedCard card={cancelled} onOpen={say('Opens the activity')} onJoin={say('Joined')} />
      <ActivityFeedCard card={ended} onOpen={say('Opens the activity')} onJoin={say('Joined')} />

      <Text variant="overline" tone="secondary">
        Activity shared in a chat
      </Text>
      <View style={styles.chat}>
        <GlassLayer radius={radius.xl} level="thin" />
        <View style={[styles.bubble, { backgroundColor: t.c.brand }]}>
          <Text variant="body" color={t.c.onBrand}>
            Who is in for Saturday?
          </Text>
        </View>
        <View style={{ alignSelf: 'flex-end' }}>
          <ActivityShareCard card={open} onOpen={say('Opens the activity')} />
        </View>
        <ActivityShareCard card={cancelled} onOpen={say('Opens the activity')} />
        <ActivityShareCard card={null} onOpen={() => undefined} />
      </View>

      <Text variant="overline" tone="secondary">
        Activity chat header
      </Text>
      <View style={styles.chat}>
        <GlassLayer radius={radius.xl} level="thin" />
        <Text variant="titleS" align="center" raw>
          {going.title}
        </Text>
        <ActivityChatBanner card={going} onOpen={say('Opens the activity')} />
      </View>

      <Text variant="overline" tone="secondary">
        Activity page actions
      </Text>
      <View style={styles.row}>
        <Button label="Join the activity" icon="plus" size="sm" onPress={say('Joined')} />
        <Button label="Open chat" icon="message" size="sm" variant="secondary" onPress={say('Opens the chat')} />
        <Button label="Share in a chat" icon="send" size="sm" variant="secondary" onPress={say('Opens the share sheet')} />
        <Button label="Contact the organiser" icon="message" size="sm" variant="secondary" onPress={say('Opens the private chat')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chat: { padding: 12, gap: 10, borderRadius: radius.xl, overflow: 'hidden' },
  bubble: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
