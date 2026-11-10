import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { Icon, type IconName } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { joinByCode } from '@/features/games/api';
import { wwCreate, wwTraining } from '@/features/games/werewolf/api';
import { BACKGROUND, PORTRAIT } from '@/features/games/werewolf/dubai/art';
import { Breathe, GoldDust, LivingScene, useEntrance } from '@/features/games/werewolf/dubai/Motion';
import { DX, serif, useDubaiFonts } from '@/features/games/werewolf/dubai/theme';
import { t as tx, useLang } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useAppSpace } from '@/state/appSpace';

const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');
const CAST = ['expat', 'influencer', 'emirati', 'escroc', 'golden_visa', 'concierge'] as const;

/**
 * IRLY Loup-Garou · Dubaï, its home (official mockup 1): the night scene with
 * the wolf before the moon, the title, the cast, and every way into a game.
 * Every button does what it says; nothing is shown that the app does not have.
 */
export default function DubaiHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fonts = useDubaiFonts();
  const lang = useLang();
  const appSpace = useAppSpace();
  const { width, height } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const go = (id: string) => router.push(`/games/${id}`);
  const run = (fn: () => Promise<string>) => {
    if (busy) return;
    haptic('press');
    setBusy(true);
    fn()
      .then(go)
      .catch(fail)
      .finally(() => setBusy(false));
  };
  const table = (visibility: 'public' | 'private') => () =>
    wwCreate(appSpace, { kind: 'online', visibility, size: 12, lang: lang === 'fr' ? 'fr' : 'en', mode: 'dubai' }).then((r) => r.id);
  const title = useEntrance(150, 900);
  const cast = useEntrance(500, 700);
  const menu = useEntrance(800, 700);
  const titleStyle = useAnimatedStyle(() => ({ opacity: title.get(), transform: [{ scale: 0.92 + title.get() * 0.08 }] }));
  const castStyle = useAnimatedStyle(() => ({ opacity: cast.get(), transform: [{ translateY: (1 - cast.get()) * 16 }] }));
  const menuStyle = useAnimatedStyle(() => ({ opacity: menu.get(), transform: [{ translateY: (1 - menu.get()) * 24 }] }));
  const pageW = Math.min(width, 520);
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LivingScene source={BACKGROUND.home} />
      <LinearGradient colors={['rgba(11,9,7,0.35)', 'rgba(11,9,7,0.05)', 'rgba(11,9,7,0.55)', 'rgba(11,9,7,0.92)']} locations={[0, 0.3, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <GoldDust count={16} height={height} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={[styles.top, { width: pageW }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={tx('Back')} style={styles.round}>
            <Icon name="arrowLeft" size={20} color={DX.goldLight} />
          </Pressable>
        </View>

        <Animated.View style={[styles.titleBox, titleStyle]}>
          <Text style={[styles.irly, serif(fonts, '900')]}>IRLY</Text>
          <Text style={[styles.title, serif(fonts, '900')]} accessibilityRole="header">
            LOUP-GAROU
          </Text>
          <Svg width={96} height={34} viewBox="0 0 96 34" style={styles.claws} pointerEvents="none">
            <Path d="M14 30 L36 4 M34 32 L58 3 M56 31 L80 5" stroke={DX.redLight} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
          </Svg>
          <View style={styles.dubaiBand}>
            <View style={styles.rule} />
            <Text style={[styles.dubai, serif(fonts, '900')]}>DUBAÏ</Text>
            <View style={styles.rule} />
          </View>
          <Text style={[styles.tagline, serif(fonts, '600')]}>{tx('In Dubai, everyone has something to hide.')}</Text>
        </Animated.View>

        <Animated.View style={[styles.cast, castStyle]}>
          {CAST.map((id, i) => (
            <View key={id} style={[styles.face, { marginLeft: i ? -12 : 0, zIndex: CAST.length - i }]}>
              <Image source={PORTRAIT[id]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
            </View>
          ))}
        </Animated.View>

        <Animated.View style={[styles.menu, { width: pageW - 40 }, menuStyle]}>
          <Breathe>
            <PressableScale onPress={() => run(table('public'))} accessibilityRole="button" accessibilityLabel={tx('Play')} disabled={busy}>
              <LinearGradient colors={['#B3262F', DX.red, '#5E0F15']} style={styles.play}>
                <Icon name="play" size={22} color={DX.goldLight} />
                <Text style={[styles.playText, serif(fonts, '900')]}>{tx('Play')}</Text>
              </LinearGradient>
            </PressableScale>
          </Breathe>
          <MenuButton icon="sparkles" label={tx('Train against AI players')} onPress={() => run(() => wwTraining(appSpace, 8, null, 'intermediate', 'dubai'))} fonts={fonts} />
          <MenuButton icon="userPlus" label={tx('Create a room')} onPress={() => run(table('private'))} fonts={fonts} />
          <MenuButton icon="key" label={tx('Join a game')} onPress={() => setJoining((v) => !v)} fonts={fonts} />
          {joining ? (
            <View style={styles.codeRow}>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder={tx('Game code')}
                placeholderTextColor={DX.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.codeInput}
                accessibilityLabel={tx('Game code')}
              />
              <PressableScale onPress={() => run(() => joinByCode(code))} disabled={code.length !== 6 || busy} accessibilityRole="button" accessibilityLabel={tx('Join')}>
                <View style={[styles.codeGo, code.length !== 6 && { opacity: 0.5 }]}>
                  <Text style={styles.codeGoText}>{tx('Join')}</Text>
                </View>
              </PressableScale>
            </View>
          ) : null}
          <MenuButton icon="drama" label={tx('Discover the characters')} onPress={() => router.push('/games/cards')} fonts={fonts} />
          <MenuButton icon="book" label={tx('Rules')} onPress={() => router.push('/games/dubai-rules')} fonts={fonts} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function MenuButton({ icon, label, onPress, fonts }: { icon: IconName; label: string; onPress: () => void; fonts: boolean }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <LinearGradient colors={['rgba(30,22,16,0.92)', 'rgba(11,9,7,0.92)']} style={styles.item}>
        <Icon name={icon} size={20} color={DX.gold} />
        <Text style={[styles.itemText, serif(fonts, '700')]}>{label}</Text>
        <Icon name="chevronRight" size={16} color={DX.goldDark} />
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DX.black },
  top: { flexDirection: 'row', paddingHorizontal: 16 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: DX.gold, backgroundColor: 'rgba(11,9,7,0.6)', alignItems: 'center', justifyContent: 'center' },
  titleBox: { alignItems: 'center', marginTop: 120 },
  irly: { color: DX.goldLight, fontSize: 30, letterSpacing: 4, textShadowColor: '#000', textShadowRadius: 12 },
  title: { color: DX.goldLight, fontSize: 40, lineHeight: 46, letterSpacing: 1, textShadowColor: '#000', textShadowRadius: 14 },
  claws: { marginTop: -26, marginBottom: -8 },
  dubaiBand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  rule: { width: 42, height: 1.5, backgroundColor: DX.gold },
  dubai: { color: DX.gold, fontSize: 34, letterSpacing: 4, textShadowColor: '#000', textShadowRadius: 12 },
  tagline: { color: DX.ivory, fontSize: 15, marginTop: 10, textAlign: 'center', paddingHorizontal: 24, textShadowColor: '#000', textShadowRadius: 8 },
  cast: { flexDirection: 'row', marginTop: 22 },
  face: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', borderWidth: 2, borderColor: DX.gold, backgroundColor: DX.black },
  menu: { marginTop: 26, gap: 10 },
  play: { height: 62, borderRadius: 18, borderWidth: 2, borderColor: DX.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  playText: { color: DX.goldLight, fontSize: 26, letterSpacing: 1 },
  item: { minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: DX.goldDark, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  itemText: { flex: 1, color: DX.ivory, fontSize: 16, letterSpacing: 0.4 },
  codeRow: { flexDirection: 'row', gap: 8 },
  codeInput: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: DX.gold, color: DX.ivory, paddingHorizontal: 14, fontSize: 18, letterSpacing: 4, backgroundColor: 'rgba(11,9,7,0.85)' },
  codeGo: { minHeight: 48, borderRadius: 12, backgroundColor: DX.red, borderWidth: 1.5, borderColor: DX.gold, paddingHorizontal: 18, justifyContent: 'center' },
  codeGoText: { color: DX.goldLight, fontWeight: '700', fontSize: 15 },
});
