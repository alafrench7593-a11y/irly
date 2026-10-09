import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Rail } from '@/components/cards/Blocks';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { PressableScale } from '@/motion/PressableScale';
import type { LightId } from '@/theme/lights';
import { radius } from '@/theme/tokens';
import { SOON, SOON_ORDER } from './services';
import { SoonPill } from './SoonPill';

const W = 236;

/** The four services IRLY is preparing, each a door to its teaser page. */
export function SoonRail({ light }: { light: LightId }) {
  const router = useRouter();
  return (
    <Rail itemWidth={W}>
      {SOON_ORDER.map((id) => {
        const s = SOON[id];
        return (
          <PressableScale key={id} onPress={() => router.push(`/soon/${id}`)} scaleTo={0.97} style={{ width: W }} accessibilityLabel={`${s.name}. ${s.tagline} Coming soon`}>
            <Photo visual={{ photo: s.photo }} light={light} scrim="full" style={styles.card} width={500} recyclingKey={`soon-${id}`}>
              <View style={styles.inner}>
                <SoonPill />
                <View style={{ gap: 6 }}>
                  <View style={styles.name}>
                    <Icon name={s.icon} size={16} color="#FFFFFF" />
                    <Text variant="label" color="#FFFFFF" raw>
                      {s.name}
                    </Text>
                  </View>
                  <Text variant="titleM" color="#FFFFFF">
                    {s.tagline}
                  </Text>
                </View>
              </View>
            </Photo>
          </PressableScale>
        );
      })}
    </Rail>
  );
}

const styles = StyleSheet.create({
  card: { height: 300, borderRadius: radius.lg, overflow: 'hidden' },
  inner: { flex: 1, padding: 16, justifyContent: 'space-between' },
  name: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
