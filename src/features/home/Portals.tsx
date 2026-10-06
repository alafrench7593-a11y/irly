import { useRouter } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFrame } from '@/components/layout/AppFrame';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { PhotoKey } from '@/data/photos';
import type { LightId } from '@/theme/lights';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';

type Portal = { title: string; line: string; photo: PhotoKey; icon: IconName; route: string };

const PORTALS: Portal[] = [
  { title: 'IRLY Girl', line: 'Meet girls who get you.', photo: 'brunch', icon: 'sparkles', route: '/girl' },
  { title: 'IRLY Moms', line: 'With kids or without.', photo: 'beachSunset', icon: 'heart', route: '/girl?mode=moms' },
];

/**
 * Two doors into the women-only worlds, side by side on their photos.
 * Not dating: friends, plans, and moms finding moms.
 */
export const GirlPortals = memo(function GirlPortals({ light }: { light: LightId }) {
  const router = useRouter();
  const frame = useFrame();
  const w = (frame.width - space.gutter * 2 - 12) / 2;
  return (
    <View style={styles.row}>
      {PORTALS.map((p) => (
        <PressableScale key={p.title} haptic="select" scaleTo={0.97} onPress={() => router.push(p.route as never)} accessibilityLabel={`${p.title}. ${p.line}`}>
          <Photo visual={{ photo: p.photo }} light={light} scrim="strong" style={[styles.card, { width: w }]} width={600} recyclingKey={`portal-${p.title}`}>
            <View style={styles.top}>
              <Glass dark level="thin" style={styles.icon}>
                <Icon name={p.icon} size={16} color="#FFFFFF" />
              </Glass>
            </View>
            <View style={styles.bottom}>
              <Text variant="overline" color="rgba(255,255,255,0.75)">
                Women only
              </Text>
              <Text variant="titleL" tone="onDark" numberOfLines={1}>
                {p.title}
              </Text>
              <Text variant="bodyS" color="rgba(255,255,255,0.82)" numberOfLines={2}>
                {p.line}
              </Text>
            </View>
          </Photo>
        </PressableScale>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: space.gutter },
  card: { height: 236, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'space-between' },
  top: { padding: 12, flexDirection: 'row' },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  bottom: { padding: 14, gap: 3 },
});
