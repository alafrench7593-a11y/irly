import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Icon, type IconName } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import type { Room } from '../../api';
import type { WwView } from '../api';
import { CARDS, type CardId, type WwMode } from '../cards';
import { PORTRAIT, SCENES } from './art';
import { GoldConfetti, LivingScene, useEntrance } from './Motion';
import { Avatar } from '@/components/ui/Avatar';
import { DX, FACTION_COLOR, factionLabel, FactionGlyph, factionOf, factionText, serif, useDubaiFonts, type Faction } from './theme';
import { wwTraining } from '../api';

type Revealed = { seat: number; name: string; bot: boolean; card: CardId; alive: boolean; won: boolean };

const MODE_LABEL: Record<WwMode, string> = { classic: 'Classic mode', dubai: 'Dubai mode', chaos: 'Chaos mode' };
const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');

/**
 * The end of a game, in every mode (official Dubaï mockup 2): the winners'
 * banner over the mode's scene in fireworks, the survivors and the eliminated with every card
 * revealed, the factions, and the game's own ranking (winners first).
 * No points, coins or rewards: the app has none to give.
 */
export const DubaiResult = memo(function DubaiResult({ view, me, room }: { view: WwView; me: string; room: Room }) {
  const fonts = useDubaiFonts();
  const router = useRouter();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const r = view.result;
  const cards = ((view.log ?? []).find((e) => e.kind === 'game_over')?.data.cards ?? []) as Revealed[];
  const mySeat = view.me?.seat ?? -1;
  const iWon = r?.seats.includes(mySeat);
  const solo = r?.solo ?? [];
  const double = r?.double ?? [];
  const winner = r?.winner;
  const mode: WwMode = view.mode === 'dubai' || view.mode === 'chaos' ? view.mode : 'classic';
  const dubai = mode === 'dubai';
  const banner =
    winner === 'village'
      ? tx(dubai ? 'The Expats win' : 'The village wins')
      : winner === 'wolves'
        ? tx(dubai ? 'The Escrocs win' : 'The werewolves win')
        : winner === 'lovers'
          ? tx('The lovers win')
          : tx('Draw');
  const line =
    winner === 'village'
      ? tx(dubai ? 'The Expats unmasked and eliminated every Escroc!' : 'The village unmasked and eliminated every werewolf!')
      : winner === 'wolves'
        ? tx(dubai ? 'The Escrocs took control of the city!' : 'The werewolves devoured the village!')
        : winner === 'lovers'
          ? tx('The lovers are the last two standing.')
          : tx('Nobody survived.');
  const emblem: Faction = winner === 'wolves' ? (dubai ? 'escrocs' : 'wolves') : dubai ? 'expats' : 'village';
  const humans = room.people.filter((p) => p.id !== me && !p.blocked);
  const survivors = cards.filter((c) => c.alive);
  const out = cards.filter((c) => !c.alive);
  const minutes = room.started_at && room.finished_at ? Math.max(1, Math.round((Date.parse(room.finished_at) - Date.parse(room.started_at)) / 60000)) : null;
  const byFaction = (['village', 'wolves', 'expats', 'escrocs', 'independents', 'double'] as Faction[]).map((f) => ({ f, n: cards.filter((c) => factionOf(c.card) === f).length })).filter((x) => x.n > 0);
  const ranking = [...cards].sort((a, b) => Number(b.won) - Number(a.won) || Number(b.alive) - Number(a.alive) || a.seat - b.seat);
  const enter = useEntrance(200, 900);
  const bannerStyle = useAnimatedStyle(() => ({ opacity: enter.get(), transform: [{ scale: 0.85 + enter.get() * 0.15 }] }));
  const w = Math.min(width - 32, 560);
  const thumb = Math.floor((w - 32 - 3 * 8) / 4);
  const again = () =>
    wwTraining(room.space === 'irly_girl' ? 'girl' : 'mixte', view.size, null, (view.difficulty as 'beginner' | 'intermediate' | 'expert') ?? 'intermediate', mode)
      .then((id) => router.replace(`/games/${id}`))
      .catch(fail);
  const share = () => {
    void Share.share({ message: `${banner} · IRLY Loup-Garou ${tx(MODE_LABEL[mode])}\nhttps://getirly.com` }).catch(() => undefined);
  };
  return (
    <View style={[styles.root, { width: w }]}>
      <View style={styles.hero}>
        <LivingScene source={SCENES[mode].victory} />
        <LinearGradient colors={['rgba(11,9,7,0)', 'rgba(11,9,7,0.35)', 'rgba(11,9,7,0.92)']} style={StyleSheet.absoluteFill} />
        {winner === 'draw' ? null : <GoldConfetti count={24} height={300} />}
        <Animated.View style={[styles.bannerWrap, bannerStyle]}>
          <View style={styles.emblem}>
            <FactionGlyph faction={emblem} size={30} color={DX.goldLight} />
          </View>
          <View style={styles.bannerRow}>
            <Laurel />
            <View style={styles.banner}>
              <Text style={[styles.bannerText, serif(fonts, '900'), banner.length > 17 && { fontSize: 17 }]} accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit>
                {banner.toUpperCase()}
              </Text>
            </View>
            <Laurel flip />
          </View>
          <Text style={styles.bannerLine}>{line}</Text>
        </Animated.View>
      </View>

      <View style={styles.stats}>
        <Stat icon="users" label={tx('{n} players', { n: cards.length })} />
        {minutes ? <Stat icon="timer" label={tx('{n} min', { n: minutes })} /> : null}
        <Stat icon={dubai ? 'building' : 'moon'} label={tx(MODE_LABEL[mode])} />
      </View>

      <Animated.View entering={reduced ? undefined : FadeInDown.delay(500).duration(500)} style={styles.panel}>
        <Text style={[styles.panelTitle, serif(fonts, '700')]}>{iWon ? tx('You won this game') : tx('You lost this game')}</Text>
        {solo.includes(mySeat) ? <Text style={styles.note}>{tx('Your personal goal is reached: a victory for good.')}</Text> : null}
        {double.includes(mySeat) ? <Text style={styles.note}>{tx('Double victory: your faction and your personal goal.')}</Text> : null}
        <Text style={styles.small}>{view.kind === 'training' ? tx('Training against AI players: never counted in the ranking.') : tx('Unranked game')}</Text>
      </Animated.View>

      <View style={styles.split}>
        <Group title={tx('Survivors ({n})', { n: survivors.length })} tone="#1E6B3D" people={survivors} thumb={thumb} fonts={fonts} reduced={reduced} />
        <Group title={tx('Eliminated ({n})', { n: out.length })} tone={DX.red} people={out} thumb={thumb} fonts={fonts} reduced={reduced} />
      </View>

      <View style={styles.panel}>
        <Text style={[styles.panelTitle, serif(fonts, '700')]}>{tx('Roles revealed')}</Text>
        <View style={styles.factions}>
          {byFaction.map(({ f, n }) => (
            <View key={f} style={[styles.faction, { borderColor: FACTION_COLOR[f] }]}>
              <FactionGlyph faction={f} size={18} color={factionText(f)} />
              <Text style={styles.factionText}>{`${factionLabel(f, tx)} (${n})`}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={[styles.panelTitle, serif(fonts, '700')]}>{tx('Ranking of the game')}</Text>
        {ranking.map((c, i) => (
          <Animated.View key={c.seat} entering={reduced ? undefined : FadeInDown.delay(700 + i * 50).duration(350)} style={styles.rank}>
            <View style={[styles.place, i < 3 && c.won && { backgroundColor: i === 0 ? DX.gold : i === 1 ? '#B9C2CC' : '#B07A4B' }]}>
              <Text style={[styles.placeText, { color: i < 3 && c.won ? DX.black : DX.ivory }]}>{i + 1}</Text>
            </View>
            <Image source={PORTRAIT[c.card]} style={styles.rankFace} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
            <View style={{ flex: 1 }}>
              <Text style={styles.rankName} numberOfLines={1}>
                {c.name + (c.seat === mySeat ? ` (${tx('you')})` : '')}
              </Text>
              <Text style={styles.rankCard} numberOfLines={1}>
                {tx(CARDS[c.card]?.name ?? c.card)}
              </Text>
            </View>
            <Text style={[styles.rankWon, { color: c.won ? '#7BE0A0' : DX.muted }]}>
              {solo.includes(c.seat) ? tx('Personal victory') : double.includes(c.seat) ? tx('Double victory') : c.won ? tx('Won') : tx('Lost')}
            </Text>
          </Animated.View>
        ))}
      </View>

      {humans.length ? (
        <View style={styles.panel}>
          <Text style={[styles.panelTitle, serif(fonts, '700')]}>{tx('Want to stay in touch?')}</Text>
          {humans.map((p) => (
            <PressableScale key={p.id} onPress={() => router.push(`/person/${p.id}`)} accessibilityRole="button" accessibilityLabel={tx('See profile')} style={styles.rank}>
              <Avatar name={p.name ?? '?'} hue={0} userId={p.id} size={38} />
              <Text style={[styles.rankName, { flex: 1 }]} numberOfLines={1}>
                {p.name ?? tx('A member')}
              </Text>
              <Text style={[styles.rankWon, { color: DX.gold }]}>{tx('See profile')}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {view.kind === 'training' ? <Action icon="repeat" label={tx('Play again')} primary onPress={again} fonts={fonts} /> : null}
        <Action icon="home" label={tx('IRLY Games')} onPress={() => router.replace(`/games?mode=${mode}`)} fonts={fonts} />
        <Action icon="drama" label={tx('See the cards')} onPress={() => router.push(`/games/cards?mode=${mode}`)} fonts={fonts} />
        <Action icon="share" label={tx('Share')} onPress={share} fonts={fonts} />
      </View>
    </View>
  );
});

function Group({ title, tone, people, thumb, fonts, reduced }: { title: string; tone: string; people: Revealed[]; thumb: number; fonts: boolean; reduced: boolean }) {
  return (
    <View style={[styles.group, { borderColor: tone }]}>
      <LinearGradient colors={[`${tone}55`, 'rgba(11,9,7,0.9)']} style={StyleSheet.absoluteFill} />
      <Text style={[styles.groupTitle, serif(fonts, '700')]}>{title}</Text>
      <View style={styles.thumbs}>
        {people.map((c, i) => (
          <Animated.View key={c.seat} entering={reduced ? undefined : ZoomIn.delay(400 + i * 60).duration(320)} style={{ width: thumb, alignItems: 'center' }}>
            <View style={[styles.thumb, { width: thumb, height: thumb * 1.15, borderColor: c.alive ? '#3FBF6F' : DX.redLight }]}>
              <Image source={PORTRAIT[c.card]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
            </View>
            <Text style={styles.thumbName} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={styles.thumbCard} numberOfLines={1}>
              {tx(CARDS[c.card]?.name ?? c.card)}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function Stat({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={16} color={DX.gold} />
      <Text style={styles.statText}>{label}</Text>
    </View>
  );
}

function Action({ icon, label, onPress, primary, fonts }: { icon: IconName; label: string; onPress: () => void; primary?: boolean; fonts: boolean }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flexBasis: '47%', flexGrow: 1 }}>
      <LinearGradient colors={primary ? ['#B3262F', DX.red] : ['rgba(30,22,16,0.95)', 'rgba(11,9,7,0.95)']} style={[styles.action, { borderColor: primary ? DX.gold : DX.goldDark }]}>
        <Icon name={icon} size={18} color={DX.goldLight} />
        <Text style={[styles.actionText, serif(fonts, '700')]}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

function Laurel({ flip }: { flip?: boolean }) {
  return (
    <Svg width={30} height={44} viewBox="0 0 30 44" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path d="M24 42C10 36 5 24 8 8" stroke={DX.gold} strokeWidth={2} fill="none" strokeLinecap="round" />
      {[10, 17, 24, 31].map((y, i) => (
        <Path key={i} d={`M${9 + i * 1.5} ${y}c-6-1-8-5-7-8 4 0 7 3 7 8z`} fill={DX.gold} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center', gap: 12 },
  hero: { height: 300, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: DX.gold, justifyContent: 'flex-end' },
  bannerWrap: { alignItems: 'center', padding: 14, gap: 6 },
  emblem: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: DX.gold, backgroundColor: DX.red, alignItems: 'center', justifyContent: 'center' },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', paddingHorizontal: 4 },
  banner: { flexShrink: 1, borderWidth: 2, borderColor: DX.gold, borderRadius: 12, backgroundColor: 'rgba(94,15,21,0.92)', paddingHorizontal: 14, paddingVertical: 6 },
  bannerText: { color: DX.goldLight, fontSize: 22, letterSpacing: 1, textAlign: 'center' },
  bannerLine: { color: DX.ivory, fontSize: 13, textAlign: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: DX.goldDark, borderRadius: 12, backgroundColor: DX.panel, paddingHorizontal: 12, paddingVertical: 7 },
  statText: { color: DX.ivory, fontSize: 13, fontWeight: '700' },
  panel: { borderWidth: 1.5, borderColor: DX.goldDark, borderRadius: 16, backgroundColor: DX.panel, padding: 14, gap: 8 },
  panelTitle: { color: DX.goldLight, fontSize: 17 },
  note: { color: '#7BE0A0', fontSize: 13 },
  small: { color: DX.muted, fontSize: 12 },
  split: { gap: 10 },
  group: { borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 10, overflow: 'hidden' },
  groupTitle: { color: DX.ivory, fontSize: 15 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { borderRadius: 10, overflow: 'hidden', borderWidth: 2 },
  thumbName: { color: DX.ivory, fontSize: 11, fontWeight: '700', marginTop: 3 },
  thumbCard: { color: DX.muted, fontSize: 10 },
  factions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  faction: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: DX.black },
  factionText: { color: DX.ivory, fontSize: 13, fontWeight: '700' },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(226,182,83,0.25)', borderRadius: 12, padding: 8, backgroundColor: 'rgba(11,9,7,0.6)' },
  place: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: DX.gold, alignItems: 'center', justifyContent: 'center' },
  placeText: { fontWeight: '900', fontSize: 13 },
  rankFace: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: DX.gold },
  rankName: { color: DX.ivory, fontSize: 14, fontWeight: '700' },
  rankCard: { color: DX.muted, fontSize: 12 },
  rankWon: { fontSize: 12, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { minHeight: 52, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  actionText: { color: DX.goldLight, fontSize: 14 },
});
