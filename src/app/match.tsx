import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { Rail } from '@/components/cards/Blocks';
import { PersonCard } from '@/components/cards/PeopleCards';
import { Page } from '@/components/layout/Page';
import { Chip } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { INTENTS } from '@/data/catalog';
import { areaName, CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import type { Intent } from '@/data/types';
import { rankMatches } from '@/features/matching/match';
import { enter } from '@/motion/enter';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const ORDER: Intent[] = ['similar', 'friends', 'sports', 'business', 'activities', 'explore'];

const SIGNALS: { icon: IconName; label: string }[] = [
  { icon: 'pin', label: 'Location' },
  { icon: 'heart', label: 'Interests' },
  { icon: 'clock', label: 'Availability' },
  { icon: 'activity', label: 'Activities' },
  { icon: 'target', label: 'Goals' },
  { icon: 'user', label: 'Profile type' },
];

export default function Match() {
  const t = useTheme();
  const params = useLocalSearchParams<{ intent?: Intent }>();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const profile = useStore((s) => s.profile);
  const setIntent = useStore((s) => s.setIntent);
  const [intent, setLocal] = useState<Intent>(params.intent && ORDER.includes(params.intent) ? params.intent : 'friends');
  const matches = useMemo(
    () => rankMatches(profile, content.people, intent, (id) => areaName(city, id)),
    [profile, content.people, intent, city],
  );

  return (
    <Page overline={`Smart matching · ${city.name}`} title="Who would you like to meet?" subtitle={INTENTS[intent].blurb}>
      <View style={{ marginBottom: space[6] }}>
        <Rail gap={8}>
          {ORDER.map((i) => (
            <Chip
              key={i}
              label={INTENTS[i].label}
              icon={INTENTS[i].icon}
              selected={i === intent}
              onPress={() => {
                setLocal(i);
                setIntent(i);
              }}
            />
          ))}
        </Rail>
      </View>

      <View style={{ paddingHorizontal: space.gutter, gap: 12 }}>
        {matches.map((m, i) => (
          <Animated.View key={`${intent}-${m.person.id}`} entering={enter.rise(i, 40)} exiting={FadeOut.duration(120)} layout={LinearTransition.springify(420)}>
            <PersonCard match={m} />
          </Animated.View>
        ))}
      </View>

      <View style={[styles.how, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
        <Text variant="overline" tone="tertiary">
          How IRLY matches
        </Text>
        <Text variant="bodyS" tone="secondary">
          No swiping, no score on people. We look at a few signals and always tell you why someone is suggested.
        </Text>
        <View style={styles.signals}>
          {SIGNALS.map((s) => (
            <View key={s.label} style={[styles.signal, { backgroundColor: t.c.overlay }]}>
              <Icon name={s.icon} size={14} color={t.c.text} />
              <Text variant="caption">{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  how: { margin: space.gutter, marginTop: space[8], padding: 18, gap: 10, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  signals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: radius.pill },
});
