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
import { toast } from '@/components/ui/Toast';
import { PressableScale } from '@/motion/PressableScale';
import { setAppSpace, useAppSpace } from '@/state/appSpace';
import { GIRL_DOOR, MOM_DOOR, MOM_PAGE } from '@/features/girl/doors';
import { radius, space } from '@/theme/tokens';

type Portal = { title: string; line: string; overline: string; photo: PhotoKey; icon: IconName; route: string };

const PORTALS: Portal[] = [
  { title: 'IRLY Girl', line: 'Meet girls who get you.', overline: 'Women only', photo: 'brunch', icon: 'sparkles', route: GIRL_DOOR },
  { title: 'IRLY Maman', line: 'With kids or without.', overline: 'Women only', photo: 'strollerMom', icon: 'heart', route: MOM_DOOR },
];

/** The same two doors in IRLY Girl: back to IRLY (the space switch), and IRLY Maman (Discover › People). */
const GIRL_SPACE_PORTALS: Portal[] = [
  { title: 'IRLY Mixte', line: 'The same app, for everyone.', overline: 'Switch space', photo: 'dubaiMarina', icon: 'globe', route: 'mixte' },
  { title: 'IRLY Maman', line: 'With kids or without.', overline: 'Women only', photo: 'strollerMom', icon: 'heart', route: MOM_PAGE },
];

/**
 * Two doors side by side on their photos. In IRLY: into the women-only
 * worlds (not dating: friends, plans, and moms finding moms). In IRLY Girl,
 * at the same place: the way back to IRLY, and IRLY Maman (`onMoms` lets a
 * page open it in place).
 */
export const GirlPortals = memo(function GirlPortals({ light, onMoms }: { light: LightId; onMoms?: () => void }) {
  const router = useRouter();
  const frame = useFrame();
  const inGirl = useAppSpace() === 'girl';
  const w = (frame.width - space.gutter * 2 - 12) / 2;
  const open = (p: Portal) => {
    if (p.route === 'mixte') {
      setAppSpace('mixte');
      toast('Back to IRLY', 'globe', 'brand');
    } else if (inGirl && onMoms && p.route === MOM_PAGE) onMoms();
    else router.push(p.route as never);
  };
  return (
    <View style={styles.row}>
      {(inGirl ? GIRL_SPACE_PORTALS : PORTALS).map((p) => (
        <PressableScale key={p.title} haptic="select" scaleTo={0.97} onPress={() => open(p)} accessibilityLabel={`${p.title}. ${p.line}`}>
          <Photo visual={{ photo: p.photo }} light={light} scrim="strong" style={[styles.card, { width: w }]} width={600} recyclingKey={`portal-${p.title}`} pinned>
            <View style={styles.top}>
              <Glass dark level="thin" style={styles.icon}>
                <Icon name={p.icon} size={16} color="#FFFFFF" />
              </Glass>
            </View>
            <View style={styles.bottom}>
              <Text variant="overline" color="rgba(255,255,255,0.75)">
                {p.overline}
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
