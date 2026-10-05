import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Chip } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { PhotoKey } from '@/data/photos';
import { useAreaProfiles, useDestAreas } from '@/features/bali/data';
import { PressableScale } from '@/motion/PressableScale';
import { useFrame } from '@/components/layout/AppFrame';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Door = { label: string; caption: string; icon: IconName; photo: PhotoKey; href: string };

const DOORS: Door[] = [
  { label: 'Where should I live?', caption: 'Your top 3 areas, explained', icon: 'compass', photo: 'bali', href: '/bali/quiz' },
  { label: 'My Bali move', caption: 'Visa, housing, SIM… step by step', icon: 'package', photo: 'apartment', href: '/bali/move' },
  { label: 'Test Bali first', caption: '7, 14, 30 or 60 days', icon: 'plane', photo: 'beachSunset', href: '/bali/test' },
  { label: 'Visa & stay', caption: 'Official sources first', icon: 'stamp', photo: 'baliTemple', href: '/bali/guide/visa' },
  { label: 'Where to eat', caption: 'Ranked, then find someone to eat with', icon: 'utensils', photo: 'dinner', href: '/eat?city=bali' },
  { label: 'Girls moving to Bali', caption: 'Meet women before you arrive', icon: 'heartHandshake', photo: 'brunch', href: '/girl/moving' },
];

/**
 * LIVE BALI. DON'T JUST VISIT. The Bali hub: pick an area and it becomes a
 * small IRLY of its own, or start from what you need (where to live, your
 * move, a test stay, food, women to meet). Everything stays in IRLY's
 * social system: activities, communities, chats.
 */
export default function BaliHub() {
  const t = useTheme();
  const router = useRouter();
  const frame = useFrame();
  const areas = useDestAreas('bali');
  const profiles = useAreaProfiles('bali');
  const profiled = new Set(profiles.data.map((p) => p.areaId));
  const main = areas.data.filter((a) => a.kind !== 'neighborhood');
  const w = (frame.width - space.gutter * 2 - 12) / 2;

  return (
    <Page overline="IRLY Bali" title="Live Bali. Don't just visit." subtitle="For travellers, nomads, families, women and everyone moving to the island.">
      <View style={{ gap: space[7] }}>
        <View style={{ gap: 10 }}>
          <Text variant="label" tone="secondary" style={styles.pad}>
            Where are you?
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
            {(main.length ? main : [{ id: 'canggu', name: 'Canggu' }, { id: 'ubud', name: 'Ubud' }, { id: 'seminyak', name: 'Seminyak' }, { id: 'uluwatu', name: 'Uluwatu' }, { id: 'sanur', name: 'Sanur' }]).map((a) => (
              <Chip key={a.id} size="sm" label={a.name} icon={profiled.has(a.id) ? 'sparkles' : 'pin'} onPress={() => router.push(`/bali/area/${a.id}`)} />
            ))}
          </ScrollView>
        </View>

        <View style={[styles.grid, styles.pad]}>
          {DOORS.map((d) => (
            <PressableScale key={d.href} onPress={() => router.push(d.href as never)} haptic="select" scaleTo={0.97} style={{ width: w }} accessibilityLabel={d.label}>
              <Photo visual={{ photo: d.photo }} light="bali" scrim="strong" style={[styles.door, { borderRadius: radius.xl }]} width={500}>
                <View style={styles.doorInner}>
                  <View style={styles.doorIcon}>
                    <Icon name={d.icon} size={18} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text variant="titleS" color="#FFFFFF">
                      {d.label}
                    </Text>
                    <Text variant="caption" color="rgba(255,255,255,0.8)" numberOfLines={2}>
                      {d.caption}
                    </Text>
                  </View>
                </View>
              </Photo>
            </PressableScale>
          ))}
        </View>

        <View style={[styles.pad, { gap: 10 }]}>
          <Text variant="titleM">Areas, explained</Text>
          {profiles.data.map((p) => (
            <PressableScale key={p.areaId} onPress={() => router.push(`/bali/area/${p.areaId}`)} haptic="select" scaleTo={0.98} style={[styles.row, { backgroundColor: t.c.surface }]} accessibilityLabel={p.name}>
              <View style={{ flex: 1 }}>
                <Text variant="titleS">{p.name}</Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {p.tagline}
                </Text>
              </View>
              <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
            </PressableScale>
          ))}
          {profiles.error ? (
            <Text variant="bodyS" tone="secondary">
              Could not load the area guide. Check your connection.
            </Text>
          ) : null}
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  door: { height: 168, overflow: 'hidden' },
  doorInner: { flex: 1, padding: 14, justifyContent: 'space-between' },
  doorIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg },
});
