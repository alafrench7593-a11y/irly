import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { Rail } from '@/components/cards/Blocks';
import { CommunityCard } from '@/components/cards/ThingCards';
import { useFrame } from '@/components/layout/AppFrame';
import { Page } from '@/components/layout/Page';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import type { Community } from '@/data/types';
import { enter } from '@/motion/enter';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const KINDS: { id: Community['kind'] | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'interest', label: 'Interests' },
  { id: 'sport', label: 'Sport' },
  { id: 'professional', label: 'Professional' },
  { id: 'neighbourhood', label: 'Neighbourhood' },
];

export default function Communities() {
  const t = useTheme();
  const frame = useFrame();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('all');
  const list = content.communities.filter((c) => kind === 'all' || c.kind === kind);

  return (
    <Page overline={city.name} title="Communities" subtitle="Optional, by interest or neighbourhood. Meet the same faces again, that is how trust grows.">
      <View style={{ marginBottom: space[6] }}>
        <Rail gap={8}>
          {KINDS.map((k) => (
            <Chip key={k.id} size="sm" label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />
          ))}
        </Rail>
      </View>
      <View style={{ paddingHorizontal: space.gutter, gap: 14 }}>
        {list.map((c, i) => (
          <Animated.View key={c.id} entering={enter.rise(i, 60)} exiting={FadeOut.duration(140)} layout={LinearTransition.springify(420)}>
            <CommunityCard community={c} width={frame.width - space.gutter * 2} />
          </Animated.View>
        ))}
        <View style={[styles.create, { borderColor: t.c.lineStrong }]}>
          <Icon name="sprout" size={22} color={t.accent} />
          <Text variant="titleS" align="center">
            Missing your people?
          </Text>
          <Text variant="bodyS" tone="secondary" align="center">
            Start a community with five members and IRLY helps you host the first meetup.
          </Text>
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  create: { alignItems: 'center', gap: 6, padding: 22, borderRadius: radius.xl, borderWidth: 1.5, borderStyle: 'dashed' },
});
