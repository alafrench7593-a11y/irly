import { ScrollView, StyleSheet, View } from 'react-native';
import { t as tx } from '@/i18n';
import { Badge, Divider } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { CITIES, DESTINATIONS, LIVE_DESTINATIONS, UPCOMING_DESTINATIONS } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { switchCity } from './DestinationTransition';

type Props = { visible: boolean; onClose: () => void };

export function DestinationSheet({ visible, onClose }: Props) {
  const t = useTheme();
  const cityId = useStore((s) => s.cityId);
  const waitlist = useStore((s) => s.waitlist);
  const joinWaitlist = useStore((s) => s.joinWaitlist);

  const pick = (id: CityId) => {
    onClose();
    if (id !== cityId) setTimeout(() => switchCity(id), 260);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Your IRLY destinations" subtitle="One app, a different city every time you land.">
      <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ paddingBottom: space[4] }} showsVerticalScrollIndicator={false}>
        {LIVE_DESTINATIONS.map((destId) => {
          const dest = DESTINATIONS[destId];
          return (
            <View key={destId} style={{ marginBottom: space[5] }}>
              <View style={styles.groupHeader}>
                <Text variant="titleS">
                  {destId === 'bali' ? '🌴' : dest.flag}  {dest.shortName}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {dest.cities.length > 1 ? tx('{n} emirates', { n: dest.cities.length }) : dest.country}
                </Text>
              </View>
              {dest.cities.map((id) => {
                const city = CITIES[id];
                const current = id === cityId;
                return (
                  <PressableScale
                    key={id}
                    haptic="select"
                    onPress={() => pick(id)}
                    style={[styles.row, current ? { backgroundColor: t.c.brandSoft } : null]}
                    accessibilityState={{ selected: current }}
                  >
                    <Photo visual={{ photo: city.photo }} light={city.light} width={200} style={styles.thumb} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text variant="titleS">{city.name}</Text>
                        {city.launch ? <Badge kind="accent" label="Launch city" /> : null}
                      </View>
                      <Text variant="bodyS" tone="secondary" numberOfLines={1}>
                        {city.tagline}
                      </Text>
                    </View>
                    {current ? (
                      <View style={[styles.check, { backgroundColor: t.c.brand }]}>
                        <Icon name="check" size={14} color={t.c.onBrand} strokeWidth={3} />
                      </View>
                    ) : (
                      <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
                    )}
                  </PressableScale>
                );
              })}
            </View>
          );
        })}

        <Divider />
        <View style={[styles.groupHeader, { marginTop: space[5] }]}>
          <Text variant="titleS">Explore another destination</Text>
        </View>
        {UPCOMING_DESTINATIONS.map((destId) => {
          const d = DESTINATIONS[destId];
          const joined = Boolean(waitlist[destId]);
          return (
            <View key={destId} style={styles.row}>
              <Photo visual={{ photo: d.photo }} light={d.light} width={200} style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <Text variant="titleS">
                  {d.flag}  {d.name}
                </Text>
                <Text variant="bodyS" tone="secondary" numberOfLines={1}>
                  {d.tagline}
                </Text>
              </View>
              <PressableScale
                haptic={false}
                scaleTo={0.92}
                onPress={() => {
                  if (joined) return;
                  joinWaitlist(destId);
                  haptic('success');
                  toast(tx('Noted: we will show {place} first when it opens', { place: d.shortName }), 'bell', 'brand');
                }}
                style={[
                  styles.waitlist,
                  { backgroundColor: joined ? t.c.positiveSoft : t.c.overlay },
                ]}
              >
                <Text variant="label" tone={joined ? 'positive' : 'primary'}>
                  {joined ? 'On the list' : 'Notify me'}
                </Text>
              </PressableScale>
            </View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter + 4,
    marginBottom: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: space[3],
    paddingHorizontal: space[4],
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  thumb: { width: 52, height: 52, borderRadius: 16 },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  waitlist: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
