import { memo } from 'react';
import { t as tx } from '@/i18n';
import { StyleSheet, View } from 'react-native';
import { ACTIVITIES, LEVELS, PLACE_KINDS, SERVICE_CATEGORIES } from '@/data/catalog';
import { areaName, CITIES } from '@/data/destinations';
import { goingCount, peopleByIds } from '@/data/repo';
import type { ActivityKind, ActivitySession, City, Community, Editorial, Place, ServiceProvider } from '@/data/types';
import { useHeroCard } from '@/features/hero/useHeroCard';
import { formatCount, formatPrice, priceLevel } from '@/lib/format';
import { whenLabel } from '@/lib/time';
import { PressableScale } from '@/motion/PressableScale';
import { useStore } from '@/state/store';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AvatarStack } from '../ui/Avatar';
import { Badge } from '../ui/Controls';
import { Glass } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';
import { Photo } from '../visual/Photo';

/* ───────── Activity tile (a kind of activity) ───────── */

export const ActivityTile = memo(function ActivityTile({
  kind,
  city,
  count,
  onPress,
  size = 132,
}: {
  kind: ActivityKind;
  city: City;
  count: number;
  onPress: () => void;
  size?: number;
}) {
  const a = ACTIVITIES[kind];
  return (
    <PressableScale onPress={onPress} style={{ width: size }} accessibilityLabel={`${tx(a.label)}, ${tx('{n} activities', { n: count })}`}>
      <Photo visual={{ photo: a.photo }} light={city.light} scrim="strong" style={[styles.tile, { height: size * 1.18 }]} width={400}>
        <View style={styles.tileInner}>
          <Glass dark style={styles.tileIcon}>
            <Icon name={a.icon} size={16} color="#FFFFFF" />
          </Glass>
          <View>
            <Text variant="titleS" tone="onDark">
              {a.label}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.75)">
              {count ? tx(count === 1 ? '{n} plan this week' : '{n} plans this week', { n: count }) : tx('Start the first plan')}
            </Text>
          </View>
        </View>
      </Photo>
    </PressableScale>
  );
});

/* ───────── Session card ───────── */

export const SessionCard = memo(function SessionCard({ session, width }: { session: ActivitySession; width?: number }) {
  const t = useTheme();
  const city = CITIES[session.cityId];
  const a = ACTIVITIES[session.kind];
  const { ref, onPress, hidden } = useHeroCard('session', session.id);
  const joined = useStore((s) => Boolean(s.joined[session.id]));
  const going = goingCount(session, joined);
  const left = Math.max(0, session.spots - going);
  return (
    <PressableScale
      ref={ref}
      onPress={onPress}
      style={[styles.session, { width, backgroundColor: t.c.surface, borderColor: t.c.line, opacity: hidden ? 0 : 1 }]}
    >
      <View style={styles.sessionTop}>
        <View style={[styles.kindIcon, { backgroundColor: t.light.accentSoft }]}>
          <Icon name={a.icon} size={20} color={t.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="overline" tone="tertiary" style={{ fontSize: 10 }}>
            {a.label} · {LEVELS[session.level]}
          </Text>
          <Text variant="titleS" numberOfLines={1}>
            {session.title}
          </Text>
        </View>
        {joined ? <Badge kind="positive" label="Joined" /> : null}
      </View>
      <View style={styles.metaRow}>
        <Icon name="clock" size={14} color={t.c.textTertiary} />
        <Text variant="bodyS" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
          {whenLabel(session.when, city)}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Icon name="pin" size={14} color={t.c.textTertiary} />
        <Text variant="bodyS" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
          {session.venue} · {areaName(city, session.areaId)}
        </Text>
      </View>
      <View style={[styles.metaRow, { justifyContent: 'space-between', marginTop: 4 }]}>
        <View style={styles.metaRow}>
          <AvatarStack people={peopleByIds(session.goingIds)} size={24} max={3} extra={session.extraGoing} />
        </View>
        <Text variant="label" tone={left <= 2 ? 'live' : 'secondary'}>
          {left === 0 ? tx('Full') : tx(left === 1 ? '{n} spot left' : '{n} spots left', { n: left })}
        </Text>
      </View>
    </PressableScale>
  );
});

/* ───────── Place card ───────── */

export const PlaceCard = memo(function PlaceCard({ place, width = 220 }: { place: Place; width?: number }) {
  const t = useTheme();
  const city = CITIES[place.cityId];
  const { ref, onPress, hidden } = useHeroCard('place', place.id);
  const saved = useStore((s) => Boolean(s.saved[place.id]));
  return (
    <PressableScale ref={ref} onPress={onPress} style={{ width, opacity: hidden ? 0 : 1 }}>
      <Photo visual={place.visual} light={city.light} scrim="soft" style={[styles.placePhoto, { boxShadow: t.shadow.card }]} recyclingKey={place.id} width={500}>
        <View style={styles.placeBadges}>
          {place.irlyPick ? <Badge kind="pick" onDark /> : <View />}
          {saved ? (
            <Glass dark style={styles.savedDot}>
              <Icon name="bookmark" size={13} color="#FFFFFF" fill="#FFFFFF" />
            </Glass>
          ) : null}
        </View>
      </Photo>
      <View style={{ paddingTop: 10, gap: 2 }}>
        <Text variant="titleS" numberOfLines={1}>
          {place.name}
        </Text>
        <Text variant="bodyS" tone="secondary" numberOfLines={1}>
          {PLACE_KINDS[place.kind].label} · {areaName(city, place.areaId)} · {priceLevel(place.priceLevel)}
        </Text>
        <View style={styles.metaRow}>
          <Icon name="star" size={12} color={t.accent} fill={t.accent} />
          <Text variant="caption" tone="secondary">
            {place.rating.toFixed(1)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
});

/* ───────── Community card ───────── */

export const CommunityCard = memo(function CommunityCard({ community, width = 250 }: { community: Community; width?: number }) {
  const t = useTheme();
  const city = CITIES[community.cityId];
  const { ref, onPress, hidden } = useHeroCard('community', community.id);
  const member = useStore((s) => Boolean(s.memberOf[community.id]));
  return (
    <PressableScale
      ref={ref}
      onPress={onPress}
      style={[styles.community, { width, backgroundColor: t.c.surface, borderColor: t.c.line, opacity: hidden ? 0 : 1 }]}
    >
      <Photo visual={community.visual} light={city.light} scrim="soft" style={styles.communityPhoto} recyclingKey={community.id} width={500}>
        <View style={{ padding: 10, flexDirection: 'row', gap: 6 }}>
          {community.verified ? <Badge kind="verified" onDark /> : null}
          {member ? <Badge kind="positive" label="Member" /> : null}
        </View>
      </Photo>
      <View style={{ padding: 14, gap: 4 }}>
        <Text variant="titleS" numberOfLines={1}>
          {community.name}
        </Text>
        <Text variant="bodyS" tone="secondary" numberOfLines={1}>
          {community.rhythm}
        </Text>
        <View style={[styles.metaRow, { marginTop: 8 }]}>
          <AvatarStack people={peopleByIds(community.memberIds)} size={22} max={3} />
          <Text variant="caption" tone="secondary">
            {tx('{n} members', { n: formatCount(community.members) })}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
});

/* ───────── Service card ───────── */

export const ServiceCard = memo(function ServiceCard({ service, compact }: { service: ServiceProvider; compact?: boolean }) {
  const t = useTheme();
  const city = CITIES[service.cityId];
  const cat = SERVICE_CATEGORIES[service.category];
  const { ref, onPress, hidden } = useHeroCard('service', service.id);
  return (
    <PressableScale
      ref={ref}
      onPress={onPress}
      style={[styles.service, { backgroundColor: t.c.surface, borderColor: t.c.line, opacity: hidden ? 0 : 1 }]}
    >
      <View style={[styles.kindIcon, { backgroundColor: t.c.brandSoft, width: 48, height: 48 }]}>
        <Icon name={cat.icon} size={22} color={t.c.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.metaRow}>
          <Text variant="titleS" numberOfLines={1} style={{ flexShrink: 1 }}>
            {service.name}
          </Text>
          <Icon name="badgeCheck" size={15} color={t.c.brand} />
        </View>
        <Text variant="bodyS" tone="secondary" numberOfLines={1}>
          {service.tagline}
        </Text>
        {!compact ? (
          <View style={[styles.metaRow, { marginTop: 4 }]}>
            <Icon name="star" size={12} color={t.accent} fill={t.accent} />
            <Text variant="caption" tone="secondary">
              {[service.rating.toFixed(1), tx('{n} reviews', { n: formatCount(service.reviews) }), tx('Replies in {time}', { time: tx(service.responseTime.replace('Replies in ', '')) })].join(' · ')}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="label">{formatPrice(service.priceFrom, city.currency)}</Text>
        <Text variant="caption" tone="tertiary">
          {service.unit}
        </Text>
      </View>
    </PressableScale>
  );
});

/* ───────── Editorial card ───────── */

export const EditorialCard = memo(function EditorialCard({ editorial, width = 300 }: { editorial: Editorial; width?: number }) {
  const city = CITIES[editorial.cityId];
  const { ref, onPress, hidden } = useHeroCard('editorial', editorial.id);
  return (
    <PressableScale ref={ref} onPress={onPress} style={{ width, opacity: hidden ? 0 : 1 }}>
      <Photo visual={editorial.visual} light={city.light} scrim="strong" style={styles.editorial} recyclingKey={editorial.id} width={700}>
        <View style={{ padding: 18, gap: 6 }}>
          <Text variant="overline" color="rgba(255,255,255,0.8)">
            {editorial.kicker}
          </Text>
          <Text variant="displayM" tone="onDark" numberOfLines={3}>
            {editorial.title}
          </Text>
        </View>
      </Photo>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  tile: { borderRadius: radius.lg, justifyContent: 'flex-end' },
  tileInner: { flex: 1, padding: 12, justifyContent: 'space-between' },
  tileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  session: { padding: 16, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, gap: 8 },
  sessionTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  kindIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  placePhoto: { height: 150, borderRadius: radius.lg },
  placeBadges: { flexDirection: 'row', justifyContent: 'space-between', padding: 10 },
  savedDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  community: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  communityPhoto: { height: 116 },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  editorial: { height: 220, borderRadius: radius.lg, justifyContent: 'flex-end' },
});
