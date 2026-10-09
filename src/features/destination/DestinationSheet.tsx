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
import { useAccount } from '@/features/auth/account';
import { supabase } from '@/lib/supabase';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { switchCity } from './DestinationTransition';

type Props = { visible: boolean; onClose: () => void };

export function DestinationSheet({ visible, onClose }: Props) {
  const t = useTheme();
  const cityId = useStore((s) => s.cityId);
  const destinationId = useStore((s) => s.destinationId);
  // The last city used in each country, so coming back lands where you were.
  const lastCity = useLastCity(cityId);
  const waitlist = useStore((s) => s.waitlist);
  const signedIn = Boolean(useAccount());
  const joinWaitlist = useStore((s) => s.joinWaitlist);

  const pick = (id: CityId) => {
    onClose();
    if (id !== cityId) setTimeout(() => switchCity(id), 260);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Where are you?" subtitle="Changed country? Just tell IRLY where you are: the app follows you.">
      <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ paddingBottom: space[4] }} showsVerticalScrollIndicator={false}>
        {/* The quick switch: one tap per country, then the city below. */}
        <View style={styles.quick}>
          {LIVE_DESTINATIONS.map((destId) => {
            const dest = DESTINATIONS[destId];
            const here = destinationId === destId;
            return (
              <PressableScale
                key={destId}
                haptic="select"
                scaleTo={0.96}
                onPress={() => {
                  if (here) return;
                  const last = lastCity[destId];
                  pick(last && dest.cities.includes(last) ? last : (dest.defaultCity as CityId));
                }}
                style={[styles.quickTile, { backgroundColor: here ? t.c.text : t.c.surface, borderColor: here ? t.c.text : t.c.lineStrong }]}
                accessibilityRole="button"
                accessibilityState={{ selected: here }}
                accessibilityLabel={tx(dest.shortName)}
              >
                <Text style={{ fontSize: 26 }}>{destId === 'bali' ? '🌴' : dest.flag}</Text>
                <Text variant="titleS" color={here ? t.c.bg : t.c.text}>
                  {tx(dest.shortName)}
                </Text>
                <Text variant="caption" color={here ? t.c.bg : t.c.textSecondary}>
                  {here ? tx('You are here') : tx('I am here now')}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        {LIVE_DESTINATIONS.map((destId) => {
          const dest = DESTINATIONS[destId];
          return (
            <View key={destId} style={{ marginBottom: space[5] }}>
              <View style={styles.groupHeader}>
                <Text variant="titleS">
                  {destId === 'bali' ? '🌴' : dest.flag}  {tx(dest.shortName)}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {dest.cities.length > 1 ? tx('{n} emirates', { n: dest.cities.length }) : tx(dest.country)}
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
                onPress={async () => {
                  if (joined) return;
                  // Kept on the account, so IRLY can actually tell them when it opens.
                  if (!supabase || !signedIn) {
                    toast('Sign in so we can tell you when it opens', 'user', 'brand');
                    return;
                  }
                  const { error } = await supabase.rpc('set_service_interest', { p_service: `dest_${destId}`, p_on: true });
                  if (error) {
                    toast(/fetch|network/i.test(error.message) ? 'No connection: try again' : error.message, 'x', 'live');
                    return;
                  }
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

const LAST: Partial<Record<string, CityId>> = {};
function useLastCity(cityId: CityId | null) {
  if (cityId) {
    const dest = (Object.keys(DESTINATIONS) as (keyof typeof DESTINATIONS)[]).find((d) => DESTINATIONS[d].cities.includes(cityId));
    if (dest) LAST[dest] = cityId;
  }
  return LAST;
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', gap: 10, paddingHorizontal: space.gutter, marginBottom: space[5] },
  quickTile: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 16, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
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
