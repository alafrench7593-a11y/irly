import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { CARD_ORDER, DUBAI_ORDER, MODE_LABEL, toMode, type CardId } from '@/features/games/werewolf/cards';
import { SCENES } from '@/features/games/werewolf/dubai/art';
import { DubaiCard } from '@/features/games/werewolf/dubai/DubaiCard';
import { DX, factionLabel, factionOf, serif, useDubaiFonts, type Faction } from '@/features/games/werewolf/dubai/theme';
import { t as tx } from '@/i18n';

type Filter = 'all' | Faction;

/** A mode's collection (official mockup): every card, filtered by faction. ?mode= (every mode but Dubaï plays the Classic cards). */
export default function CardsScreen() {
  const { mode: m } = useLocalSearchParams<{ mode?: string }>();
  const mode = toMode(m);
  const deck: CardId[] = mode === 'dubai' ? DUBAI_ORDER : CARD_ORDER;
  const factions: Faction[] = mode === 'dubai' ? ['expats', 'escrocs', 'independents', 'double'] : ['village', 'wolves'];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fonts = useDubaiFonts();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const cards = useMemo(() => deck.filter((id) => filter === 'all' || factionOf(id) === filter), [filter, deck]);
  const count = (f: Faction) => deck.filter((id) => factionOf(id) === f).length;
  const pageW = Math.min(width, 720);
  const cols = pageW >= 600 ? 3 : 2;
  const cardW = Math.floor((pageW - 16 * 2 - 12 * (cols - 1)) / cols);
  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `${tx('All')} (${deck.length})` },
    ...factions.map((f) => ({ key: f, label: `${factionLabel(f, tx)} (${count(f)})` })),
  ];
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { width, paddingTop: insets.top + 8 }]}>
          <Image source={SCENES[mode].home} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
          <LinearGradient colors={['rgba(11,9,7,0.25)', 'rgba(11,9,7,0.35)', DX.black]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroRow, { width: pageW }]}>
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={tx('Back')} style={styles.round}>
              <Icon name="arrowLeft" size={20} color={DX.goldLight} />
            </Pressable>
          </View>
          <Text style={[styles.title, serif(fonts, '900')]} accessibilityRole="header">
            {'IRLY\nLOUP-GAROU'}
          </Text>
          <View style={styles.modeBadge}>
            <Text style={[styles.modeText, serif(fonts, '700')]}>{tx(MODE_LABEL[mode]).toUpperCase()}</Text>
          </View>
          <Text style={[styles.sub, serif(fonts, '600')]}>{tx(mode === 'dubai' ? 'Dubai collection' : 'The village collection')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filters}>
          {filters.map((f) => {
            const on = f.key === filter;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && { color: DX.ivory }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={[styles.grid, { width: pageW }]}>
          {cards.map((id: CardId, i) => (
            <Animated.View key={id} entering={reduced ? undefined : FadeInDown.delay(Math.min(i, 8) * 45).duration(380)}>
              <DubaiCard id={id} width={cardW} details />
            </Animated.View>
          ))}
        </View>
        <Text style={styles.note}>{tx('Illustrations made for IRLY. Every character is fictional.')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DX.black },
  hero: { height: 300, alignItems: 'center', overflow: 'hidden' },
  heroRow: { flexDirection: 'row', paddingHorizontal: 16 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: DX.gold,
    backgroundColor: 'rgba(11,9,7,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: DX.goldLight, fontSize: 34, lineHeight: 38, textAlign: 'center', marginTop: 6, textShadowColor: '#000', textShadowRadius: 10 },
  modeBadge: { marginTop: 8, borderWidth: 1.5, borderColor: DX.gold, backgroundColor: 'rgba(11,9,7,0.75)', paddingHorizontal: 18, paddingVertical: 5, borderRadius: 8 },
  modeText: { color: DX.gold, fontSize: 18, letterSpacing: 1 },
  sub: { color: DX.ivory, fontSize: 17, marginTop: 14 },
  filterBar: { alignSelf: 'stretch', flexGrow: 0 },
  filters: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  chip: { borderWidth: 1.5, borderColor: DX.goldDark, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: DX.panelSolid, minHeight: 40 },
  chipOn: { borderColor: DX.gold, backgroundColor: DX.red },
  chipText: { color: DX.muted, fontWeight: '700', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  note: { color: DX.muted, fontSize: 11, marginTop: 20, textAlign: 'center', paddingHorizontal: 24 },
});
