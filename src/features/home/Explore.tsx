import { useRouter } from 'expo-router';
import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';
import Animated from 'react-native-reanimated';
import { enter } from '@/motion/enter';

type Door = { title: string; line: string; icon: IconName; route: string; women?: boolean };

const DOORS: Door[] = [
  { title: 'Help & Questions', line: 'Ask, answer, recommend', icon: 'question', route: '/help' },
  { title: 'Dubai News & Life', line: 'What’s happening, from the sources', icon: 'news', route: '/news' },
  { title: 'IRLY Family', line: 'Outings, schools, families nearby', icon: 'home', route: '/space/families' },
  { title: 'IRLY Mom', line: 'Mums meeting mums', icon: 'heart', route: '/space/moms', women: true },
  { title: 'IRLY Only Girls', line: 'Plans and a network between women', icon: 'sparkles', route: '/space/girls', women: true },
];

/**
 * Doors to IRLY's spaces: help between members, the city's news, and the
 * family, mum and women-only spaces (the last two shown to women only, as
 * the server only lets women in).
 */
export const ExploreDoors = memo(function ExploreDoors() {
  const t = useTheme();
  const router = useRouter();
  const woman = useStore((s) => s.profile.gender === 'woman');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {DOORS.filter((d) => !d.women || woman).map((d, i) => (
        <Animated.View key={d.route} entering={enter.slide(Math.min(i, 6))}>
        <PressableScale haptic="select" scaleTo={0.97} onPress={() => router.push(d.route as never)} style={[styles.door, { backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent' }]} accessibilityLabel={`${tx(d.title)}. ${tx(d.line)}`}>
          <GlassLayer radius={radius.xl} />
          <View style={[styles.icon, { backgroundColor: t.c.overlay }]}>
            <Icon name={d.icon} size={18} color={t.c.text} />
          </View>
          <Text variant="titleS" numberOfLines={1}>
            {d.title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {d.line}
          </Text>
        </PressableScale>
        </Animated.View>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.gutter, gap: 10 },
  door: { width: 156, padding: 14, gap: 6, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
