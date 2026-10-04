import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SessionCard, ActivityTile } from '@/components/cards/ThingCards';
import { useFrame } from '@/components/layout/AppFrame';
import { Page } from '@/components/layout/Page';
import { SectionHeader } from '@/components/ui/Controls';
import { CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import { enter } from '@/motion/enter';
import { useCityId } from '@/state/store';
import { space } from '@/theme/tokens';

export default function Activities() {
  const router = useRouter();
  const frame = useFrame();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const tile = (frame.width - space.gutter * 2 - 24) / 3;
  const upcoming = [...content.sessions].sort((a, b) => a.when.dayOffset - b.when.dayOffset || a.when.time.localeCompare(b.when.time));

  return (
    <Page
      overline={city.name}
      title="Activities"
      subtitle={city.id === 'bali' ? 'Surf at dawn, yoga in the rice fields, padel at night.' : 'Find your people through the things you love doing.'}
    >
      <View style={styles.grid}>
        {city.activityKinds.map((kind, i) => (
          <Animated.View key={kind} entering={enter.pop(i, 40)}>
            <ActivityTile
              kind={kind}
              city={city}
              size={tile}
              count={content.sessions.filter((s) => s.kind === kind).length}
              onPress={() => router.push(`/activities/${kind}`)}
            />
          </Animated.View>
        ))}
      </View>
      <SectionHeader overline="Join a session" title="Coming up" style={{ marginTop: space[8] }} />
      <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
        {upcoming.map((s, i) => (
          <Animated.View key={s.id} entering={enter.rise(i, 120)}>
            <SessionCard session={s} />
          </Animated.View>
        ))}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: space.gutter },
});
