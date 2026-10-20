import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { t as tx, a11y } from '@/i18n';
import { cityWhen } from '@/lib/time';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CommunityThumb } from './CommunityThumb';
import { buildSpots, clusterSpots, useCommunityMeetups, type MapCommunity, type MapSpan, type Spot } from './mapSpots';
import { displayCommunityName } from './name';

/** Compact: the list under it stays on screen. */
export const MAP_HEIGHT = 260;

export type CommunityMapProps = {
  cityId: CityId;
  /** The communities shown below the map (same tab, search and theme). */
  communities: MapCommunity[];
  /** `signedOut`: no server data for this visitor; the page says how to sign in. */
  status: 'loading' | 'error' | 'ready' | 'signedOut';
  onRetry?: () => void;
  /** Said when the list itself is empty (a filter, a new city). */
  emptyText?: string;
};

/** Markers and selection, shared by the web and phone maps. */
export function useCommunityMapModel({ cityId, communities, status }: CommunityMapProps, view: MapSpan | null) {
  const meetups = useCommunityMeetups(cityId);
  const { spots } = useMemo(() => buildSpots(status === 'ready' ? communities : [], meetups), [communities, meetups, status]);
  // Refit when the set of places changes, not on every list reload.
  const fitKey = spots.map((s) => s.id).sort().join('|');
  // A selection belongs to the markers it was made on: another tab, search or theme closes it.
  const [pick, setPick] = useState<{ id: string; key: string } | null>(null);
  const selected = pick && pick.key === fitKey ? (spots.find((s) => s.id === pick.id) ?? null) : null;
  const select = (id: string | null) => setPick(id ? { id, key: fitKey } : null);
  // What is drawn: nearby places merged at this zoom (a selection of a merged marker closes on zoom).
  const shown = useMemo(() => clusterSpots(spots, view), [spots, view]);
  const selectedShown = selected ?? (pick && pick.key === fitKey ? (shown.find((s) => s.id === pick.id) ?? null) : null);
  return { spots, shown, selected: selectedShown, select, fitKey };
}

/** The card the map sits in: rounded, thin border, like the app's glass cards. */
export function MapFrame({ children, label }: { children: ReactNode; label: string }) {
  const t = useTheme();
  return (
    <Animated.View entering={enter.fade(0)} style={[styles.frame, { borderColor: t.c.line, backgroundColor: t.c.surface }]} accessibilityLabel={label}>
      {children}
    </Animated.View>
  );
}

export function MapSkeleton() {
  return (
    <View accessibilityLabel={tx('Loading the map')} style={{ height: MAP_HEIGHT }}>
      <Skeleton height={MAP_HEIGHT} radius={radius.xl} />
    </View>
  );
}

/** Error card in place of the map, with a retry. */
export function MapError({ onRetry }: { onRetry: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.frame, styles.center, { borderColor: t.c.line, gap: 6, padding: 22 }]}>
      <GlassLayer radius={radius.xl} />
      <Icon name="map" size={22} color={t.c.text} />
      <Text variant="titleS" align="center">
        Can’t load the map right now
      </Text>
      <Text variant="bodyS" tone="secondary" align="center">
        Check your connection, then try again.
      </Text>
      <Button label="Try again" size="sm" icon="repeat" onPress={onRetry} style={{ marginTop: 6 }} />
    </View>
  );
}

/** Message over the map when it has nothing to place (or the visitor is signed out). */
export function MapNotice({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      <Animated.View entering={enter.rise(0)} style={styles.notice}>
        <GlassLayer radius={radius.pill} />
        <Icon name={icon} size={15} color={t.c.text} />
        <Text variant="label" numberOfLines={2} style={{ flexShrink: 1 }}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

/** What the map says when it shows no marker (null: it has markers). */
export function noticeFor(p: CommunityMapProps, spots: Spot[]): { icon: IconName; text: string } | null {
  if (p.status === 'signedOut') return { icon: 'lock', text: tx('Sign in to see where communities meet') };
  if (p.status !== 'ready' || spots.length) return null;
  if (!p.communities.length) return { icon: 'search', text: p.emptyText ?? tx('No community to show here') };
  return { icon: 'pin', text: tx('These communities have no place on the map yet') };
}

/** A marker: how many communities meet there. Meetups are filled, a city's own list is outlined. */
export function SpotPin({ spot, selected }: { spot: Spot; selected: boolean }) {
  const t = useTheme();
  const n = spot.communities.length;
  const meetup = spot.kind === 'meetup';
  return (
    <View
      style={[
        styles.pin,
        {
          backgroundColor: meetup ? t.c.brand : t.c.raised,
          borderColor: selected ? t.c.text : meetup ? t.c.brand : t.c.lineStrong,
          transform: [{ scale: selected ? 1.12 : 1 }],
        },
      ]}
    >
      <Icon name={meetup ? 'users' : 'building'} size={13} color={meetup ? t.c.onBrand : t.c.text} strokeWidth={2.2} />
      <Text variant="label" style={{ color: meetup ? t.c.onBrand : t.c.text }} raw>
        {String(n)}
      </Text>
    </View>
  );
}

/** A marker's place: its name, or how many places a merged marker holds. */
export const spotTitle = (s: Spot) => (s.places ? tx('{n} places', { n: s.places }) : s.label);

export const pinLabel = (s: Spot) => {
  const n = s.communities.length;
  const label =
    s.kind === 'meetup'
      ? n === 1
        ? tx('{place}: 1 community meets here', { place: spotTitle(s) })
        : tx('{place}: {n} communities meet here', { place: spotTitle(s), n })
      : n === 1
        ? tx('{city}: 1 community', { city: spotTitle(s) })
        : tx('{city}: {n} communities', { city: spotTitle(s), n });
  return a11y(label) ?? label;
};

/** The communities of the tapped marker, over the bottom of the map. Each opens its page. */
export function SpotSheet({ spot, cityId, onClose }: { spot: Spot; cityId: CityId; onClose: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const light = CITIES[cityId].light;
  const n = spot.communities.length;
  return (
    <Animated.View entering={enter.rise(0)} style={styles.sheet}>
      <GlassLayer radius={radius.lg} level="thick" />
      <View style={styles.sheetHead}>
        <Icon name={spot.kind === 'meetup' ? 'pin' : 'building'} size={14} color={t.c.textSecondary} />
        <Text variant="label" numberOfLines={1} style={{ flex: 1 }} raw>
          {spotTitle(spot)}
        </Text>
        <Text variant="caption" tone="tertiary">
          {n === 1 ? tx('1 community') : tx('{n} communities', { n })}
        </Text>
        <PressableScale onPress={onClose} haptic="select" hitSlop={10} accessibilityLabel={tx('Close')} style={styles.close}>
          <Icon name="x" size={14} color={t.c.textSecondary} />
        </PressableScale>
      </View>
      <ScrollView style={{ maxHeight: 118 }} contentContainerStyle={{ gap: 2 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {spot.communities.map(({ c, next }) => {
          const name = displayCommunityName({ name: c.name, topic: c.topic, categoryId: c.categoryId, cityId: c.cityId });
          const line = next
            ? tx('Next meetup · {when}', { when: cityWhen(next.startsAt, c.cityId ?? cityId) })
            : [c.cityId ? tx('Based in {city}', { city: CITIES[c.cityId as CityId]?.name ?? '' }) : null, c.members > 0 ? tx('{n} members', { n: c.members }) : null].filter(Boolean).join(' · ');
          return (
            <PressableScale key={c.id} onPress={() => router.push(`/c/${c.id}`)} haptic="select" scaleTo={0.98} style={styles.sheetRow} accessibilityLabel={name}>
              <CommunityThumb id={c.id} name={name} topic={c.topic} categoryId={c.categoryId} light={light} size={32} member={c.isMember} />
              <View style={{ flex: 1 }}>
                <Text variant="label" numberOfLines={1} raw>
                  {name}
                </Text>
                {line ? (
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {line}
                  </Text>
                ) : null}
              </View>
              <Icon name="chevronRight" size={14} color={t.c.textTertiary} />
            </PressableScale>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { height: MAP_HEIGHT, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, overflow: 'hidden', maxWidth: '86%' },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, minWidth: 30, paddingHorizontal: 9, borderRadius: radius.pill, borderWidth: 1.5 },
  sheet: { position: 'absolute', left: space[3], right: space[3], bottom: space[3], borderRadius: radius.lg, overflow: 'hidden', padding: space[3], gap: 4, zIndex: 30 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2, paddingBottom: 2 },
  close: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5, paddingHorizontal: 2 },
});
