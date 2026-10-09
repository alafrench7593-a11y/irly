import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { Rail } from '@/components/cards/Blocks';
import { ServiceCard } from '@/components/cards/ThingCards';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { SERVICE_CATEGORIES } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import type { ServiceCategoryId } from '@/data/types';
import { enter } from '@/motion/enter';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'idCard', title: 'Licence and identity checked', body: 'Each provider’s trade licence and the person behind it will be checked first.' },
  { icon: 'users', title: 'Tried by members', body: 'A member will try the service before it is listed.' },
  { icon: 'star', title: 'Reviews from real bookings', body: 'Only people who booked through IRLY will be able to review.' },
];

export default function Services() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: ServiceCategoryId }>();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const [cat, setCat] = useState<ServiceCategoryId | null>(
    params.category && city.serviceCategories.includes(params.category) ? params.category : null,
  );
  const list = content.services.filter((s) => !cat || s.category === cat);

  return (
    <Page overline={`${city.name} · City services`} title="City services" subtitle="Services for newcomers are coming with IRLY BON PLAN.">
      <View style={{ marginBottom: space[6] }}>
        <Rail gap={8}>
          <Chip size="sm" label="All" selected={!cat} onPress={() => setCat(null)} />
          {city.serviceCategories.map((id) => (
            <Chip key={id} size="sm" label={SERVICE_CATEGORIES[id].label} icon={SERVICE_CATEGORIES[id].icon} selected={cat === id} onPress={() => setCat(id)} />
          ))}
        </Rail>
      </View>

      {cat ? (
        <Animated.View key={cat} entering={enter.fade(0)} style={[styles.catHead, { backgroundColor: t.c.brandSoft }]}>
          <Icon name={SERVICE_CATEGORIES[cat].icon} size={20} color={t.c.brand} />
          <Text variant="bodyS" tone="brand" style={{ flex: 1 }}>
            {SERVICE_CATEGORIES[cat].blurb}
          </Text>
        </Animated.View>
      ) : null}

      <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
        {list.length === 0 ? (
          <View style={[styles.empty, { borderColor: t.c.lineStrong }]}>
            <Text variant="titleS" align="center">
              No services listed yet
            </Text>
            <Text variant="bodyS" tone="secondary" align="center">
              IRLY BON PLAN will bring offers and services for newcomers. Ask the community in the meantime.
            </Text>
            <Button label="See IRLY BON PLAN" size="sm" variant="secondary" onPress={() => router.push('/soon/bonplan')} />
          </View>
        ) : null}
        {list.map((s, i) => (
          <Animated.View key={s.id} entering={enter.rise(i, 60)} exiting={FadeOut.duration(140)} layout={LinearTransition.springify(420)}>
            <ServiceCard service={s} />
          </Animated.View>
        ))}
      </View>

      <View style={[styles.verify, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
        <Text variant="overline" tone="tertiary">
          How listing will work
        </Text>
        {STEPS.map((s) => (
          <View key={s.title} style={styles.step}>
            <View style={[styles.stepIcon, { backgroundColor: t.c.brandSoft }]}>
              <Icon name={s.icon} size={18} color={t.c.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleS">{s.title}</Text>
              <Text variant="bodyS" tone="secondary">
                {s.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  catHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: space.gutter,
    marginBottom: space[5],
    padding: 14,
    borderRadius: radius.lg,
  },
  empty: { padding: 24, gap: 6, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed' },
  verify: {
    margin: space.gutter,
    marginTop: space[8],
    padding: 18,
    gap: 16,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  step: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  stepIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
