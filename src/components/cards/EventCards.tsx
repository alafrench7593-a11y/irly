import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { EVENT_CATEGORIES } from '@/data/catalog';
import { areaName, CITIES } from '@/data/destinations';
import { goingCount, peopleByIds } from '@/data/repo';
import type { IrlEvent } from '@/data/types';
import { useHeroCard } from '@/features/hero/useHeroCard';
import { formatPrice } from '@/lib/format';
import { dayChip, whenLabel } from '@/lib/time';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { toast } from '../ui/Toast';
import { AvatarStack } from '../ui/Avatar';
import { Badge, IconButton } from '../ui/Controls';
import { Glass } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';
import { Photo } from '../visual/Photo';

/** Large, photo-led event card for horizontal rails. */
export const EventCard = memo(function EventCard({ event, width = 286, height = 368 }: { event: IrlEvent; width?: number; height?: number }) {
  const t = useTheme();
  const city = CITIES[event.cityId];
  const { ref, onPress, hidden } = useHeroCard('event', event.id);
  const joined = useStore((s) => Boolean(s.joined[event.id]));
  const saved = useStore((s) => Boolean(s.saved[event.id]));
  const toggleSave = useStore((s) => s.toggleSave);
  const chip = dayChip(event.when, city);
  const people = peopleByIds(event.goingIds);
  const cat = EVENT_CATEGORIES[event.category];
  return (
    <PressableScale ref={ref} onPress={onPress} style={{ width, height, opacity: hidden ? 0 : 1 }} accessibilityLabel={`${event.title}, ${whenLabel(event.when, city)}`}>
      <Photo visual={event.visual} light={city.light} scrim="strong" style={[styles.fill, { borderRadius: radius.lg, boxShadow: t.shadow.card }]} recyclingKey={event.id} width={700}>
        <View style={styles.top}>
          <Glass dark style={styles.dateChip}>
            <Text variant="overline" tone="onDark" style={{ fontSize: 10, letterSpacing: 1 }}>
              {chip.weekday}
            </Text>
            <Text variant="titleM" tone="onDark" style={{ marginTop: -2 }}>
              {chip.day}
            </Text>
          </Glass>
          <IconButton
            icon="bookmark"
            label={saved ? 'Remove from saved' : 'Save'}
            variant="glass"
            size={38}
            active={saved}
            onPress={() => {
              const on = toggleSave(event.id);
              if (on) toast('Saved', 'bookmark', 'brand');
            }}
          />
        </View>
        <View style={styles.bottom}>
          <View style={styles.row}>
            <Icon name={cat.icon} size={13} color="#FFFFFF" />
            <Text variant="overline" tone="onDark">
              {cat.label}
            </Text>
            {event.featured ? <Badge kind="pick" onDark label="Featured" /> : null}
          </View>
          <Text variant="displayM" tone="onDark" numberOfLines={2}>
            {event.title}
          </Text>
          <Text variant="bodyS" color="rgba(255,255,255,0.78)" numberOfLines={1}>
            {whenLabel(event.when, city)} · {areaName(city, event.areaId)}
          </Text>
          <View style={[styles.row, { marginTop: 8, justifyContent: 'space-between' }]}>
            <View style={styles.row}>
              <AvatarStack people={people} size={24} max={3} />
              <Text variant="label" tone="onDark">
                {goingCount(event, joined)} going
              </Text>
            </View>
            <Glass dark style={styles.priceChip}>
              {joined ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={2.6} /> : null}
              <Text variant="label" tone="onDark">
                {joined ? "You're in" : formatPrice(event.price, city.currency)}
              </Text>
            </Glass>
          </View>
        </View>
      </Photo>
    </PressableScale>
  );
});

/** Compact row for event lists, with a one-tap join. */
export const EventRow = memo(function EventRow({ event }: { event: IrlEvent }) {
  const t = useTheme();
  const city = CITIES[event.cityId];
  const { ref, onPress, hidden } = useHeroCard('event', event.id);
  const joined = useStore((s) => Boolean(s.joined[event.id]));
  const toggleJoin = useStore((s) => s.toggleJoin);
  const people = peopleByIds(event.goingIds);
  const chip = dayChip(event.when, city);
  return (
    <PressableScale ref={ref} onPress={onPress} style={[styles.rowCard, { backgroundColor: t.c.surface, borderColor: t.c.line, opacity: hidden ? 0 : 1 }]}>
      <Photo visual={event.visual} light={city.light} scrim="soft" style={styles.thumb} recyclingKey={event.id} width={300}>
        <View style={styles.thumbDate}>
          <Text variant="overline" tone="onDark" style={{ fontSize: 9 }}>
            {chip.weekday}
          </Text>
          <Text variant="titleS" tone="onDark">
            {chip.day}
          </Text>
        </View>
      </Photo>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="overline" tone="accent" style={{ fontSize: 10 }}>
          {EVENT_CATEGORIES[event.category].label}
        </Text>
        <Text variant="titleS" numberOfLines={2}>
          {event.title}
        </Text>
        <Text variant="bodyS" tone="secondary" numberOfLines={1}>
          {whenLabel(event.when, city)} · {areaName(city, event.areaId)}
        </Text>
        <View style={[styles.row, { marginTop: 6, justifyContent: 'space-between' }]}>
          <View style={styles.row}>
            <AvatarStack people={people} size={22} max={3} />
            <Text variant="caption" tone="secondary">
              {goingCount(event, joined)} going · {formatPrice(event.price, city.currency)}
            </Text>
          </View>
          <PressableScale
            haptic={false}
            scaleTo={0.9}
            onPress={() => {
              const on = toggleJoin(event.id);
              haptic(on ? 'success' : 'tap');
              if (on) toast("You're in", 'check');
            }}
            style={[styles.joinMini, { backgroundColor: joined ? t.c.positiveSoft : t.c.brand }]}
            accessibilityLabel={joined ? 'Leave' : 'Join'}
          >
            <Icon name={joined ? 'check' : 'plus'} size={16} color={joined ? t.c.positive : t.c.onBrand} strokeWidth={2.6} />
          </PressableScale>
        </View>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 12 },
  dateChip: { width: 52, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bottom: { padding: 16, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: radius.pill },
  rowCard: {
    flexDirection: 'row',
    gap: 14,
    padding: 10,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
  },
  thumb: { width: 92, height: 108, borderRadius: radius.md, justifyContent: 'flex-end' },
  thumbDate: { padding: 8 },
  joinMini: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: space[2] },
});
