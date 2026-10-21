import { memo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import type { ActivityCard, ActivityCardState } from '@/features/server/activityCards';
import { formatNumber, t as tx } from '@/i18n';
import { cityWhen } from '@/lib/time';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * An activity wherever it is referenced: in a community's feed, shared in a
 * chat, at the top of its own chat. One record, read live (see
 * features/server/activityCards): these components only draw it.
 */

// The destination's light behind a photo while it loads.
const lightOf = (cityId: string) => (CITIES[cityId as CityId] ?? CITIES.dubai).light;

const STATE_LABEL: Record<ActivityCardState, string> = { open: 'Open to join', full: 'Full', ongoing: 'Happening now', ended: 'Ended', cancelled: 'Cancelled' };

/** « Sat 1 Nov, 18:00 – 20:00 », in the activity's own city time. */
export function cardWhen(c: Pick<ActivityCard, 'startsAt' | 'endsAt' | 'cityId'>): string {
  const start = cityWhen(c.startsAt, c.cityId);
  return c.endsAt ? `${start} – ${cityWhen(c.endsAt, c.cityId, { hour: '2-digit', minute: '2-digit' })}` : start;
}

export function cardPlace(c: Pick<ActivityCard, 'placeName' | 'areaId' | 'cityId'>): string {
  const city = CITIES[c.cityId as CityId];
  const area = city ? areaName(city, c.areaId) : c.areaId;
  return c.placeName && c.placeName !== area ? `${c.placeName} · ${area}` : area;
}

export const cardPrice = (c: Pick<ActivityCard, 'priceMinor' | 'currency'>) => (c.priceMinor ? `${c.currency} ${formatNumber(c.priceMinor / 100)}` : tx('Free'));

export const cardGoing = (c: Pick<ActivityCard, 'going' | 'capacity'>) =>
  c.capacity ? tx('{n}/{max} going', { n: c.going, max: c.capacity }) : `${c.going} ${tx('going')}`;

/** The state as a small pill: green open, the rest quiet, cancelled in red. */
export function StatePill({ state, onPhoto }: { state: ActivityCardState; onPhoto?: boolean }) {
  const t = useTheme();
  const color = state === 'cancelled' ? t.c.critical : state === 'open' || state === 'ongoing' ? t.c.positive : t.c.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: onPhoto ? 'rgba(0,0,0,0.55)' : t.c.surface }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="caption" color={onPhoto ? '#FFFFFF' : t.c.text}>
        {STATE_LABEL[state]}
      </Text>
    </View>
  );
}

function Line({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <View style={styles.line}>
      <Icon name={icon} size={14} color={t.c.textSecondary} />
      <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }} raw>
        {text}
      </Text>
    </View>
  );
}

/** « + Propose an activity »: in every community, opens the Create form attached to it. */
export const ProposeActivityButton = memo(function ProposeActivityButton({ onPress, communityName }: { onPress: () => void; communityName: string }) {
  const t = useTheme();
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} style={styles.propose} accessibilityRole="button" accessibilityLabel="Propose an activity">
      <GlassLayer radius={radius.xl} />
      <View style={[styles.proposeIcon, { backgroundColor: t.c.brand }]}>
        <Icon name="plus" size={20} color={t.c.onBrand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="titleS">Propose an activity</Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {tx('Shown in {name} and in Activities', { name: communityName })}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={t.c.textSecondary} />
    </PressableScale>
  );
});

/**
 * An activity in a community's feed: photo, title, date and time, place,
 * price, organiser, how many are going, its real state, « See the activity »
 * and « Join ».
 */
export const ActivityFeedCard = memo(function ActivityFeedCard({
  card,
  onOpen,
  onJoin,
  joining,
}: {
  card: ActivityCard;
  onOpen: () => void;
  onJoin: () => void;
  joining?: boolean;
}) {
  const going = card.myStatus === 'going';
  return (
    <PressableScale haptic="select" scaleTo={0.99} onPress={onOpen} style={styles.feed} accessibilityLabel={card.title}>
      <GlassLayer radius={radius.xl} />
      <View style={styles.feedPhoto}>
        <Photo visual={{ photo: card.photo, uri: card.coverUrl ?? undefined }} light={lightOf(card.cityId)} scrim="soft" width={700} style={StyleSheet.absoluteFill} recyclingKey={`card-${card.id}`} />
        <View style={styles.feedBadges}>
          <View style={[styles.pill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
            <Icon name="calendar" size={12} color="#FFFFFF" />
            <Text variant="caption" color="#FFFFFF">
              {card.pinned ? 'Pinned activity' : 'Activity'}
            </Text>
          </View>
          <StatePill state={card.state} onPhoto />
        </View>
      </View>
      <View style={styles.feedBody}>
        <Text variant="titleM" numberOfLines={2} raw style={card.state === 'cancelled' ? { textDecorationLine: 'line-through' } : undefined}>
          {card.title}
        </Text>
        <Line icon="clock" text={cardWhen(card)} />
        <Line icon="pin" text={cardPlace(card)} />
        <View style={styles.meta}>
          <Line icon="banknote" text={cardPrice(card)} />
          <Line icon="users" text={cardGoing(card)} />
        </View>
        {card.creatorName ? <Line icon="user" text={tx('Hosted by {name}', { name: card.creatorName })} /> : null}
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button label="See the activity" size="sm" variant="secondary" full onPress={onOpen} />
          </View>
          <View style={{ flex: 1 }}>
            {going ? (
              <Button label="You're going" icon="check" size="sm" variant="done" full haptic={false} onPress={onOpen} />
            ) : card.state === 'open' || card.state === 'ongoing' ? (
              <Button label="Join" icon="plus" size="sm" full loading={joining} onPress={onJoin} />
            ) : (
              <Button label={STATE_LABEL[card.state]} size="sm" variant="ghost" full disabled onPress={() => undefined} />
            )}
          </View>
        </View>
      </View>
    </PressableScale>
  );
});

/**
 * An activity shared in a chat: read live from the activity. Not available
 * to this reader (private, IRLY Girl, deleted): says so, opens nothing,
 * shows nothing of it.
 */
export const ActivityShareCard = memo(function ActivityShareCard({ card, onOpen, onLongPress }: { card: ActivityCard | null | undefined; onOpen: () => void; onLongPress?: () => void }) {
  const t = useTheme();
  if (card === undefined) {
    return (
      <View style={[styles.share, styles.shareEmpty]}>
        <GlassLayer radius={radius.lg} />
        <ActivityIndicator color={t.c.textSecondary} />
      </View>
    );
  }
  if (card === null) {
    return (
      <PressableScale haptic={false} scaleTo={1} onLongPress={onLongPress} delayLongPress={350} style={[styles.share, styles.shareEmpty]} accessibilityLabel={tx('Activity not available')}>
        <GlassLayer radius={radius.lg} />
        <Icon name="lock" size={18} color={t.c.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text variant="label">Activity not available</Text>
          <Text variant="caption" tone="tertiary">
            It is private, was removed, or is not open to you.
          </Text>
        </View>
      </PressableScale>
    );
  }
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onOpen} onLongPress={onLongPress} delayLongPress={350} style={styles.share} accessibilityLabel={tx('Open {title}', { title: card.title })}>
      <GlassLayer radius={radius.lg} />
      <View style={styles.sharePhoto}>
        <Photo visual={{ photo: card.photo, uri: card.coverUrl ?? undefined }} light={lightOf(card.cityId)} width={360} style={StyleSheet.absoluteFill} recyclingKey={`share-${card.id}`} />
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <View style={styles.line}>
          <Text variant="overline" tone="secondary" style={{ flex: 1 }}>
            {card.girlOnly ? 'IRLY Girl activity' : 'Activity'}
          </Text>
          <StatePill state={card.state} />
        </View>
        <Text variant="titleS" numberOfLines={2} raw>
          {card.title}
        </Text>
        <Line icon="clock" text={cardWhen(card)} />
        <Line icon="pin" text={cardPlace(card)} />
        <Line icon="users" text={`${cardGoing(card)} · ${cardPrice(card)}`} />
        <View style={[styles.line, { marginTop: 4 }]}>
          <Text variant="label" tone="brand">
            See the activity
          </Text>
          <Icon name="chevronRight" size={14} color={t.c.brand} />
        </View>
      </View>
    </PressableScale>
  );
});

/** The top of an activity's own chat: the activity itself, live, one tap away. */
export const ActivityChatBanner = memo(function ActivityChatBanner({ card, onOpen }: { card: ActivityCard | null | undefined; onOpen: () => void }) {
  const t = useTheme();
  if (!card) return null;
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onOpen} style={styles.banner} accessibilityLabel={tx('Open {title}', { title: card.title })}>
      <GlassLayer radius={radius.lg} level="thin" />
      <View style={styles.bannerPhoto}>
        <Photo visual={{ photo: card.photo, uri: card.coverUrl ?? undefined }} light={lightOf(card.cityId)} width={120} style={StyleSheet.absoluteFill} recyclingKey={`banner-${card.id}`} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="caption" tone="secondary" numberOfLines={1} raw>
          {`${cardWhen(card)} · ${cardPlace(card)}`}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {`${cardGoing(card)} · ${tx('See the activity')}`}
        </Text>
      </View>
      <StatePill state={card.state} />
      <Icon name="chevronRight" size={16} color={t.c.textSecondary} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 22, borderRadius: 11 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  propose: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.xl, overflow: 'hidden' },
  proposeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  feed: { borderRadius: radius.xl, overflow: 'hidden' },
  feedPhoto: { height: 150, overflow: 'hidden' },
  feedBadges: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' },
  feedBody: { padding: 14, gap: 6 },
  meta: { flexDirection: 'row', gap: space[4] },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  share: { width: 260, maxWidth: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  shareEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 64 },
  sharePhoto: { height: 110, overflow: 'hidden' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radius.lg, overflow: 'hidden' },
  bannerPhoto: { width: 36, height: 36, borderRadius: 10, overflow: 'hidden' },
});
