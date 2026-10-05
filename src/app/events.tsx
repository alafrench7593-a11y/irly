import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { Rail } from '@/components/cards/Blocks';
import { EventCard, EventRow } from '@/components/cards/EventCards';
import { useFrame } from '@/components/layout/AppFrame';
import { Page } from '@/components/layout/Page';
import { Chip, Segmented } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { EVENT_CATEGORIES } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import type { EventCategory } from '@/data/types';
import { isWeekend } from '@/lib/time';
import { enter } from '@/motion/enter';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type When = 'today' | 'tomorrow' | 'week' | 'weekend';
const CATEGORIES: EventCategory[] = ['sports', 'networking', 'party', 'wellness', 'business', 'culture', 'food'];

export default function Events() {
  const t = useTheme();
  const frame = useFrame();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const [when, setWhen] = useState<When>('week');
  const [cats, setCats] = useState<EventCategory[]>([]);

  const list = content.events
    .filter((e) => {
      if (when === 'today') return e.when.dayOffset === 0;
      if (when === 'tomorrow') return e.when.dayOffset === 1;
      if (when === 'weekend') return isWeekend(e.when, city);
      return e.when.dayOffset < 7;
    })
    .filter((e) => cats.length === 0 || cats.includes(e.category))
    .sort((a, b) => a.when.dayOffset - b.when.dayOffset || a.when.time.localeCompare(b.when.time));

  const featured = list.filter((e) => e.featured);
  const rest = list.filter((e) => !e.featured);

  return (
    <Page overline={city.name} title="Events" subtitle="Curated by people who live here. Every host is checked by IRLY.">
      <View style={{ paddingHorizontal: space.gutter, marginBottom: space[4] }}>
        <Segmented<When>
          value={when}
          onChange={setWhen}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'tomorrow', label: 'Tomorrow' },
            { value: 'week', label: 'This week' },
            { value: 'weekend', label: 'Weekend' },
          ]}
        />
      </View>
      <View style={{ marginBottom: space[6] }}>
        <Rail gap={8}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              size="sm"
              label={EVENT_CATEGORIES[c].label}
              icon={EVENT_CATEGORIES[c].icon}
              selected={cats.includes(c)}
              onPress={() => setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))}
            />
          ))}
        </Rail>
      </View>

      {list.length === 0 ? (
        <Animated.View entering={enter.fade(0)} style={[styles.empty, { borderColor: t.c.lineStrong }]}>
          <Icon name="calendar" size={28} color={t.c.textTertiary} />
          <Text variant="titleS" align="center">
            Nothing matches, yet
          </Text>
          <Text variant="bodyS" tone="secondary" align="center">
            Try another day or category, or start your own plan from Social.
          </Text>
        </Animated.View>
      ) : null}

      {featured.length ? (
        <Animated.View entering={enter.rise(1)} style={{ marginBottom: space[6] }}>
          <Rail itemWidth={frame.width - space.gutter * 2 - 30}>
            {featured.map((e) => (
              <EventCard key={e.id} event={e} width={frame.width - space.gutter * 2 - 30} height={380} />
            ))}
          </Rail>
        </Animated.View>
      ) : null}

      <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
        {rest.map((e, i) => (
          <Animated.View key={e.id} entering={enter.rise(i, 80)} exiting={FadeOut.duration(150)} layout={LinearTransition.springify(420)}>
            <EventRow event={e} />
          </Animated.View>
        ))}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  empty: {
    marginHorizontal: space.gutter,
    padding: 28,
    gap: 8,
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
});
