import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { CARD_ORDER, CARDS, DUBAI_ORDER } from '@/features/games/werewolf/cards';
import { SCENES } from '@/features/games/werewolf/dubai/art';
import { LivingScene } from '@/features/games/werewolf/dubai/Motion';
import { DX, FACTION_COLOR, factionLabel, FactionGlyph, factionOf, factionText, serif, useDubaiFonts, type Faction } from '@/features/games/werewolf/dubai/theme';
import { t as tx } from '@/i18n';

type Section = { key: string; title: string; lines: string[] };

/** A mode's rules, as the server plays them (docs/LOUP-GAROU.md, docs/LOUP-GAROU-DUBAI.md). ?mode=classic|dubai|chaos. */
export default function RulesScreen() {
  const { mode: m } = useLocalSearchParams<{ mode?: string }>();
  const mode = m === 'classic' || m === 'chaos' ? m : 'dubai';
  const dubai = mode === 'dubai';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fonts = useDubaiFonts();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<string>('goal');
  const dubaiSections: Section[] = [
    {
      key: 'goal',
      title: tx('Goal of the game'),
      lines: [
        tx('The Expats win when every Escroc is eliminated.'),
        tx('The Escrocs win when they are at least as many as the other living players.'),
        tx('The Independents play for themselves: a personal victory, kept for good once won.'),
        tx('The Double Game wins with the Expats and can win a personal victory too.'),
      ],
    },
    {
      key: 'flow',
      title: tx('How a game goes'),
      lines: [
        tx('1. Your card is dealt in secret: only you see it.'),
        tx('2. Night: the Escrocs choose a victim together; the powers act in secret.'),
        tx('3. Day: the night’s events are announced, everyone debates.'),
        tx('4. Vote: the most voted player is eliminated; a tie gives a second round between the tied, a second tie: nobody.'),
        tx('5. The game goes on until a faction wins.'),
      ],
    },
    {
      key: 'vote',
      title: tx('The vote, step by step'),
      lines: [
        tx('Cancelled votes first (the Broker), then double votes (the CEO, the Influencer): a vote is worth two at most.'),
        tx('The Newcomer who used Fresh Start cannot be voted out that day.'),
        tx('Votes are public; who cancelled a vote stays secret.'),
      ],
    },
    {
      key: 'secret',
      title: tx('Secrets'),
      lines: [
        tx('Nobody sees another player’s card during the game, and the results of a power go only to its player.'),
        tx('All the cards are revealed at the end.'),
        tx('The server decides everything: the deal, the powers, the votes, the victories.'),
      ],
    },
  ];
  const village: Section[] = [
    {
      key: 'goal',
      title: tx('Goal of the game'),
      lines: [
        tx('The village wins when every werewolf is eliminated.'),
        tx('The werewolves win when they are at least as many as the other living players.'),
        tx('Two lovers from different camps win together if they are the last two standing.'),
      ],
    },
    {
      key: 'flow',
      title: tx('How a game goes'),
      lines: [
        tx('1. Your card is dealt in secret: only you see it.'),
        tx('2. Night: the werewolves choose a victim together; the powers act in secret.'),
        tx('3. Day: the night’s events are announced, everyone debates.'),
        tx('4. Vote: the most voted player is eliminated; a tie gives a second round between the tied, a second tie: nobody.'),
        tx('5. The game goes on until a camp wins.'),
      ],
    },
    ...(mode === 'chaos'
      ? [
          {
            key: 'chaos',
            title: tx('Chaos mode'),
            lines: [
              tx('The server draws the deck at random for each game: one werewolf more or less than usual, one to seven special cards.'),
              tx('Nobody knows which powers are in play, not even the host: you find out by playing.'),
              tx('The whole deck is revealed at the end.'),
            ],
          },
        ]
      : []),
    {
      key: 'secret',
      title: tx('Secrets'),
      lines: [
        tx('Nobody sees another player’s card during the game, and the results of a power go only to its player.'),
        tx('All the cards are revealed at the end.'),
        tx('The server decides everything: the deal, the powers, the votes, the victories.'),
      ],
    },
  ];
  const sections = dubai ? dubaiSections : village;
  const deck = dubai ? DUBAI_ORDER : CARD_ORDER;
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LivingScene source={SCENES[mode].night} />
      <LinearGradient colors={['rgba(11,9,7,0.4)', 'rgba(11,9,7,0.85)', DX.black]} locations={[0, 0.35, 0.7]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, alignItems: 'center' }}>
        <View style={[styles.head, { width: Math.min(width, 640) }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={tx('Back')} style={styles.round}>
            <Icon name="arrowLeft" size={20} color={DX.goldLight} />
          </Pressable>
          <Text style={[styles.title, serif(fonts, '900')]} accessibilityRole="header">
            {`${tx('Rules of the game')} · ${tx(dubai ? 'Dubai' : mode === 'chaos' ? 'Chaos' : 'Classic')}`.toUpperCase()}
          </Text>
        </View>
        <View style={{ width: Math.min(width, 640), paddingHorizontal: 16, gap: 10 }}>
          {sections.map((s) => (
            <View key={s.key} style={styles.section}>
              <Pressable onPress={() => setOpen(open === s.key ? '' : s.key)} accessibilityRole="button" accessibilityState={{ expanded: open === s.key }} style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, serif(fonts, '700')]}>{s.title}</Text>
                <Icon name={open === s.key ? 'chevronUp' : 'chevronDown'} size={18} color={DX.gold} />
              </Pressable>
              {open === s.key ? (
                <Animated.View entering={reduced ? undefined : FadeIn.duration(300)} style={styles.sectionBody}>
                  {s.lines.map((l, i) => (
                    <Text key={i} style={styles.line}>
                      {l}
                    </Text>
                  ))}
                </Animated.View>
              ) : null}
            </View>
          ))}
          <Text style={[styles.cardsTitle, serif(fonts, '700')]}>{dubai ? tx('The 20 characters') : tx('The 10 cards')}</Text>
          {deck.map((id) => {
            const f: Faction = factionOf(id);
            return (
              <View key={id} style={styles.card}>
                <View style={[styles.medal, { borderColor: FACTION_COLOR[f] }]}>
                  <FactionGlyph faction={f} size={18} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.cardName, serif(fonts, '700')]}>{tx(CARDS[id].name)}</Text>
                  <Text style={[styles.cardCamp, { color: factionText(f) }]}>{factionLabel(f, tx)}</Text>
                  <Text style={styles.line}>{tx(CARDS[id].power)}</Text>
                  <Text style={[styles.line, { color: DX.muted }]}>{tx(CARDS[id].goal)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DX.black },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, marginBottom: 16 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: DX.gold, backgroundColor: 'rgba(11,9,7,0.6)', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: DX.goldLight, fontSize: 22, letterSpacing: 1 },
  section: { borderWidth: 1.5, borderColor: DX.goldDark, borderRadius: 14, backgroundColor: DX.panel, overflow: 'hidden' },
  sectionHead: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  sectionTitle: { flex: 1, color: DX.goldLight, fontSize: 16 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  line: { color: DX.ivory, fontSize: 14, lineHeight: 20 },
  cardsTitle: { color: DX.goldLight, fontSize: 18, marginTop: 14, marginBottom: 2 },
  card: { flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: DX.goldDark, borderRadius: 12, padding: 12, backgroundColor: DX.panel },
  medal: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: DX.black },
  cardName: { color: DX.goldLight, fontSize: 15 },
  cardCamp: { fontSize: 12, fontWeight: '700' },
});
