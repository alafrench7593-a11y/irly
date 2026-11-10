import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { joinByCode, joinRoom, useGamesOverview, useGamesPresence, useOpenRooms, useRecentGames, type RoomCard } from '@/features/games/api';
import { t as tx, useLang } from '@/i18n';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useAppSpace } from '@/state/appSpace';
import { wwCreate, wwQuickplay, wwTraining } from '../api';
import { cardOf, deckOf, MODES, type CardId, type WwMode } from '../cards';
import { PORTRAIT, SCENES } from '../dubai/art';
import { Breathe, GoldDust, LivingScene, useEntrance } from '../dubai/Motion';
import { DX, serif, useDubaiFonts } from '../dubai/theme';

const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');

type ModeInfo = { name: string; tagline: string; line: string; cast: CardId[] };
const MODE_INFO: Record<WwMode, ModeInfo> = {
  classic: {
    name: 'Classic',
    tagline: 'The village against the werewolves.',
    line: 'The rules everyone knows: 10 cards, from 6 to 20 players.',
    cast: ['werewolf', 'seer', 'witch', 'hunter', 'cupid', 'villager'],
  },
  chaos: {
    name: 'Chaos',
    tagline: 'Cards change hands. Nothing is sure.',
    line: 'The Classic cards and 10 Chaos cards: Scammer, Mirror, Saboteur, Clown, Ninja…',
    cast: ['scammer', 'mirror', 'clown', 'saboteur', 'ninja', 'chameleon'],
  },
  nightmare: {
    name: 'Nightmare',
    tagline: 'The dead come back. The living turn.',
    line: 'The Classic cards and 10 Nightmare cards: Vampire, Revenant, Cursed, Reaper…',
    cast: ['vampire', 'revenant', 'cursed', 'reaper', 'exorcist', 'dark_oracle'],
  },
  manipulation: {
    name: 'Manipulation',
    tagline: 'The vote is a weapon.',
    line: 'The Classic cards and 9 Manipulation cards: Lawyer, Dictator, Double Agent, Spy…',
    cast: ['manipulator', 'double_agent', 'lawyer', 'dictator', 'hacker', 'spy'],
  },
  nightmare_chaos: {
    name: 'Nightmare Chaos',
    tagline: 'Curses and swaps, the same night.',
    line: 'Nightmare and Chaos cards together, with the hybrids of the Village.',
    cast: ['reaper', 'scammer', 'vampire', 'mirror', 'guardian', 'cursed'],
  },
  manipulation_chaos: {
    name: 'Manipulation Chaos',
    tagline: 'Lies by day, swaps by night.',
    line: 'Manipulation and Chaos cards together, with the hybrids of the Village.',
    cast: ['dictator', 'scammer', 'usurper', 'clown', 'detective', 'gambler'],
  },
  nightmare_manipulation: {
    name: 'Nightmare Manipulation',
    tagline: 'They vote. Something else decides.',
    line: 'Nightmare and Manipulation cards together, with the hybrids of the Village.',
    cast: ['possessed', 'lawyer', 'vampire', 'double_agent', 'prophet', 'spider'],
  },
  apocalypse: {
    name: 'Apocalypse',
    tagline: 'Every card. Every power.',
    line: 'The 44 cards of the four families and the Classic, drawn anew each game.',
    cast: ['anomaly', 'vampire', 'dictator', 'bounty_hunter', 'scammer', 'reaper'],
  },
  dubai: {
    name: 'Dubai',
    tagline: 'In Dubai, everyone has something to hide.',
    line: 'Expats against Escrocs, with Independents: 20 characters.',
    cast: ['expat', 'influencer', 'emirati', 'escroc', 'golden_visa', 'concierge'],
  },
  powers: {
    name: 'All powers',
    tagline: 'Everyone has a power.',
    line: 'A special card for every seat while there are some: the mode to try them all.',
    cast: ['seer', 'witch', 'hunter', 'cupid', 'salvateur', 'little_girl'],
  },
};

/**
 * IRLY Games, today Loup-Garou only (Ludo is put aside for now): the scene of
 * the chosen mode, the three modes to pick from, and every way into a game
 * (play online, train against AI players, a table online or in person, a
 * code), the open tables and the people of the last games. Every number is
 * the server's; every button does what it says.
 */
export function WerewolfHome({ initialMode = 'classic' }: { initialMode?: WwMode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fonts = useDubaiFonts();
  const appSpace = useAppSpace();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<WwMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [training, setTraining] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data } = useGamesOverview();
  const { rooms } = useOpenRooms('werewolf');
  const recent = useRecentGames();
  const now = useNow();
  useGamesPresence();
  const wolves = data?.games.find((g) => g.game === 'werewolf');
  const info = MODE_INFO[mode];
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
  const title = useEntrance(150, 900);
  const menu = useEntrance(600, 700);
  const titleStyle = useAnimatedStyle(() => ({ opacity: title.get(), transform: [{ scale: 0.92 + title.get() * 0.08 }] }));
  const menuStyle = useAnimatedStyle(() => ({ opacity: menu.get(), transform: [{ translateY: (1 - menu.get()) * 24 }] }));
  const pageW = Math.min(width, 560);
  const tileW = Math.floor((pageW - 32 - 2 * 10) / 3);
  const tileH = Math.round(tileW * 0.82);
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Re-mounted per mode: the scene cross-fades in. */}
      <Animated.View key={mode} entering={reduced ? undefined : FadeIn.duration(700)} style={StyleSheet.absoluteFill}>
        <LivingScene source={SCENES[mode].home} />
      </Animated.View>
      <LinearGradient colors={['rgba(11,9,7,0.35)', 'rgba(11,9,7,0.05)', 'rgba(11,9,7,0.6)', 'rgba(11,9,7,0.96)']} locations={[0, 0.25, 0.5, 0.8]} style={StyleSheet.absoluteFill} />
      <GoldDust count={14} height={height} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24, alignItems: 'center' }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.top, { width: pageW }]}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel={tx('Back')} style={styles.round}>
            <Icon name="arrowLeft" size={20} color={DX.goldLight} />
          </Pressable>
          <Text style={[styles.brand, serif(fonts, '700')]}>IRLY GAMES</Text>
          {data && data.online > 0 ? (
            <View style={styles.online}>
              <View style={styles.dot} />
              <Text style={styles.onlineText}>{tx('{n} online', { n: data.online })}</Text>
            </View>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        <Animated.View style={[styles.titleBox, titleStyle]}>
          <Text style={[styles.title, serif(fonts, '900')]} accessibilityRole="header">
            LOUP-GAROU
          </Text>
          <Svg width={96} height={34} viewBox="0 0 96 34" style={styles.claws} pointerEvents="none">
            <Path d="M14 30 L36 4 M34 32 L58 3 M56 31 L80 5" stroke={DX.redLight} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
          </Svg>
          <View style={styles.modeBand}>
            <View style={styles.rule} />
            <Animated.Text key={mode} entering={reduced ? undefined : FadeInDown.duration(400)} style={[styles.modeName, serif(fonts, '900')]}>
              {tx(info.name).toUpperCase()}
            </Animated.Text>
            <View style={styles.rule} />
          </View>
          <Animated.Text key={`t-${mode}`} entering={reduced ? undefined : FadeIn.duration(500)} style={[styles.tagline, serif(fonts, '600')]}>
            {tx(info.tagline)}
          </Animated.Text>
        </Animated.View>

        {/* The three modes. */}
        <View style={[styles.modes, { width: pageW - 32 }]} accessibilityRole="radiogroup">
          {MODES.map((m) => {
            const on = m === mode;
            return (
              <PressableScale
                key={m}
                onPress={() => {
                  haptic('select');
                  setMode(m);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={tx(MODE_INFO[m].name)}
              >
                <View style={[styles.modeTile, { width: tileW, height: tileH }, on && styles.modeTileOn]}>
                  <Image source={PORTRAIT[MODE_INFO[m].cast[0]]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
                  <LinearGradient colors={['transparent', 'rgba(11,9,7,0.95)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />
                  <Text style={[styles.modeTileText, serif(fonts, '900'), { fontSize: Math.max(8, Math.min(14, Math.floor((tileW - 12) / (Math.max(...tx(MODE_INFO[m].name).split(' ').map((w) => w.length)) * 0.98)))) }, on && { color: DX.goldLight }]} numberOfLines={2}>{tx(MODE_INFO[m].name).toUpperCase()}</Text>
                  {m !== 'classic' && m !== 'dubai' && m !== 'powers' ? (
                    <View style={styles.newBadge}>
                      <Text style={styles.newText}>{tx('New mode')}</Text>
                    </View>
                  ) : null}
                </View>
              </PressableScale>
            );
          })}
        </View>
        <Animated.View key={`c-${mode}`} entering={reduced ? undefined : FadeInDown.duration(450)} style={styles.castRow}>
          {info.cast.map((id, i) => (
            <View key={id} style={[styles.face, { marginLeft: i ? -12 : 0, zIndex: info.cast.length - i }]}>
              <Image source={PORTRAIT[id]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
            </View>
          ))}
        </Animated.View>
        <Text style={styles.modeLine}>{tx(info.line)}</Text>

        <Animated.View style={[styles.menu, { width: pageW - 32 }, menuStyle]}>
          <MenuButton icon="userPlus" label={tx('Create a table (online or in person)')} onPress={() => setCreating(true)} fonts={fonts} />
          <MenuButton icon="key" label={tx('Join with a code')} onPress={() => setJoining((v) => !v)} fonts={fonts} />
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
          <View style={styles.pair}>
            <SmallButton icon="drama" label={tx('The cards')} onPress={() => router.push(`/games/cards?mode=${mode}`)} fonts={fonts} />
            <SmallButton icon="book" label={tx('Rules')} onPress={() => router.push(`/games/dubai-rules?mode=${mode}`)} fonts={fonts} />
          </View>
          {wolves ? (
            <Text style={styles.count}>
              {[wolves.waiting ? tx('{n} games to join', { n: wolves.waiting }) : null, wolves.in_game ? tx('{n} playing now', { n: wolves.in_game }) : null].filter(Boolean).join(' · ') ||
                tx('No table yet: start one, or train while others arrive')}
            </Text>
          ) : null}
        </Animated.View>

        {rooms && rooms.length > 0 ? (
          <View style={[styles.section, { width: pageW - 32 }]}>
            <Text style={[styles.sectionTitle, serif(fonts, '700')]}>{tx('Loup-Garou tables')}</Text>
            {rooms.map((r) => (
              <RoomRow key={r.id} room={r} onOpen={() => run(() => (r.mine ? Promise.resolve(r.id) : joinRoom(r.id)))} />
            ))}
          </View>
        ) : null}

        {recent && recent.some((g) => (g.people ?? []).length > 0) ? (
          <View style={[styles.section, { width: pageW - 32 }]}>
            <Text style={[styles.sectionTitle, serif(fonts, '700')]}>{tx('Played recently')}</Text>
            {recent.filter((g) => (g.people ?? []).length > 0).map((g) => (
              <View key={g.id} style={styles.recent}>
                <Text style={styles.small}>{timeAgo((now - Date.parse(g.finished_at)) / 60_000)}</Text>
                <View style={styles.people}>
                  {(g.people ?? []).map((p) => (
                    <PressableScale key={p.id} onPress={() => router.push(`/person/${p.id}`)} accessibilityRole="button" accessibilityLabel={p.name ?? tx('A member')} style={styles.person}>
                      <Avatar name={p.name ?? '?'} hue={0} userId={p.id} size={40} />
                      <Text style={styles.personName} numberOfLines={1}>
                        {p.name ?? tx('A member')}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      {/* The two ways to play stay at the bottom of the screen, whatever the mode: never a scroll away. */}
      <View style={[styles.dock, { paddingBottom: insets.bottom + 10 }]} testID="ww-home-dock">
        <View style={[styles.dockRow, { width: pageW - 32 }]}>
          <View style={{ flex: 1.15 }}>
            <Breathe>
              <PressableScale onPress={() => run(() => wwQuickplay(appSpace, mode))} accessibilityRole="button" accessibilityLabel={tx('Play online')} disabled={busy}>
                <LinearGradient colors={['#B3262F', DX.red, '#5E0F15']} style={styles.play}>
                  {pageW < 360 ? null : <Icon name="play" size={18} color={DX.goldLight} />}
                  <Text style={[styles.playText, serif(fonts, '900'), pageW < 360 && { fontSize: 13 }]} numberOfLines={1}>
                    {tx('Play online')}
                  </Text>
                </LinearGradient>
              </PressableScale>
            </Breathe>
          </View>
          <View style={{ flex: 1 }}>
            <PressableScale onPress={() => setTraining(true)} accessibilityRole="button" accessibilityLabel={tx('Train against AI players')}>
              <View style={styles.train}>
                {pageW < 360 ? null : <Icon name="sparkles" size={18} color={DX.gold} />}
                <Text style={[styles.trainText, serif(fonts, '700'), pageW < 360 && { fontSize: 13 }]} numberOfLines={1}>
                  {tx('Against the AI')}
                </Text>
              </View>
            </PressableScale>
          </View>
        </View>
        <Text style={styles.dockMode}>{`${tx('Mode')} : ${tx(info.name)}`}</Text>
      </View>
      <TrainingSheet visible={training} mode={mode} onClose={() => setTraining(false)} onCreated={go} />
      <TableSheet visible={creating} mode={mode} onClose={() => setCreating(false)} onCreated={go} />
    </View>
  );
}

function MenuButton({ icon, label, onPress, fonts }: { icon: IconName; label: string; onPress: () => void; fonts: boolean }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <LinearGradient colors={['rgba(30,22,16,0.94)', 'rgba(11,9,7,0.94)']} style={styles.item}>
        <Icon name={icon} size={20} color={DX.gold} />
        <Text style={[styles.itemText, serif(fonts, '700')]}>{label}</Text>
        <Icon name="chevronRight" size={16} color={DX.goldDark} />
      </LinearGradient>
    </PressableScale>
  );
}

function SmallButton({ icon, label, onPress, fonts }: { icon: IconName; label: string; onPress: () => void; fonts: boolean }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1 }}>
      <View style={styles.small2}>
        <Icon name={icon} size={18} color={DX.gold} />
        <Text style={[styles.itemText, serif(fonts, '700')]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

function RoomRow({ room, onOpen }: { room: RoomCard; onOpen: () => void }) {
  const full = room.players >= room.max;
  const label = room.mine ? tx('Open') : room.status === 'playing' ? tx('Playing') : full ? tx('Full') : tx('Join');
  const disabled = !room.mine && (full || room.status !== 'waiting');
  return (
    <View style={styles.room}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.roomTitle} numberOfLines={1}>
          {room.title ?? tx("{name}'s table", { name: room.host ?? tx('A member') })}
        </Text>
        <Text style={styles.small}>
          {[tx('{n}/{max} players', { n: room.players, max: room.max }), room.lang === 'fr' ? 'Français' : 'English', room.visibility === 'private' ? tx('Private') : tx('Public'), room.status === 'playing' ? tx('In progress') : tx('Waiting')].join(' · ')}
        </Text>
      </View>
      <PressableScale onPress={onOpen} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
        <View style={[styles.roomBtn, room.mine && { backgroundColor: DX.red }, disabled && { opacity: 0.45 }]}>
          <Text style={styles.roomBtnText}>{label}</Text>
        </View>
      </PressableScale>
    </View>
  );
}

function Choice<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.choices} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label} style={{ flexGrow: 1 }}>
            <View style={[styles.choice, on && styles.choiceOn]}>
              <Text style={[styles.choiceText, on && { color: DX.goldLight }]}>{o.label}</Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

function SheetBody({ children }: { children: React.ReactNode }) {
  return <View style={styles.sheet}>{children}</View>;
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function StartButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  const fonts = useDubaiFonts();
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <LinearGradient colors={['#B3262F', DX.red, '#5E0F15']} style={[styles.play, disabled && { opacity: 0.5 }]}>
        <Icon name="play" size={18} color={DX.goldLight} />
        <Text style={[styles.playText, serif(fonts, '900')]}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

/** Training against AI players: size, the role she plays, the difficulty. Never ranked. */
function TrainingSheet({ visible, mode, onClose, onCreated }: { visible: boolean; mode: WwMode; onClose: () => void; onCreated: (id: string) => void }) {
  const appSpace = useAppSpace();
  const [size, setSize] = useState<'6' | '8' | '10' | '12'>('8');
  const [role, setRole] = useState<string>('random');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'expert'>('intermediate');
  const [busy, setBusy] = useState(false);
  const roles: CardId[] = deckOf(mode);
  const start = () => {
    setBusy(true);
    wwTraining(appSpace, Number(size), role === 'random' || !roles.includes(role as CardId) ? null : role, difficulty, mode)
      .then((id) => {
        onClose();
        onCreated(id);
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  return (
    <Sheet visible={visible} onClose={onClose} scroll title={tx('Train against AI players')} subtitle={`${tx(MODE_INFO[mode].name)} · ${tx('Training · unranked: never counted in the ranking.')}`}>
      <SheetBody>
        {/* First, so it is on screen whatever the length of the role list (21 choices in Dubaï). */}
        <StartButton label={tx('Start')} disabled={busy} onPress={start} />
        <Label>{tx('Players')}</Label>
        <Choice
          options={[
            { value: '6', label: '6' },
            { value: '8', label: '8' },
            { value: '10', label: '10' },
            { value: '12', label: '12' },
          ]}
          value={size}
          onChange={setSize}
        />
        <Label>{tx('Difficulty')}</Label>
        <Choice
          options={[
            { value: 'beginner', label: tx('Beginner') },
            { value: 'intermediate', label: tx('Intermediate') },
            { value: 'expert', label: tx('Expert') },
          ]}
          value={difficulty}
          onChange={setDifficulty}
        />
        <Label>{tx('Your role')}</Label>
        <View style={styles.roles}>
          {(['random', ...roles] as string[]).map((id) => {
            const on = role === id;
            return (
              <PressableScale key={id} onPress={() => setRole(id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={id === 'random' ? tx('Random') : tx(cardOf(id).name)}>
                <View style={[styles.roleChip, on && styles.choiceOn]}>
                  {id === 'random' ? <Icon name="shuffle" size={16} color={DX.gold} /> : <Image source={PORTRAIT[id as CardId]} style={styles.roleFace} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />}
                  <Text style={[styles.choiceText, on && { color: DX.goldLight }]}>{id === 'random' ? tx('Random') : tx(cardOf(id).name)}</Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
        <StartButton label={tx('Start')} disabled={busy} onPress={start} />
      </SheetBody>
    </Sheet>
  );
}

/** A table: online (public or with a code) or in person (QR code, no game master). */
function TableSheet({ visible, mode, onClose, onCreated }: { visible: boolean; mode: WwMode; onClose: () => void; onCreated: (id: string) => void }) {
  const lang = useLang();
  const appSpace = useAppSpace();
  const [kind, setKind] = useState<'online' | 'irl'>('online');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [size, setSize] = useState<'8' | '10' | '12' | '20'>('10');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const create = () => {
    setBusy(true);
    wwCreate(appSpace, { kind, visibility, size: Number(size), title, lang: lang === 'fr' ? 'fr' : 'en', mode })
      .then((r) => {
        onClose();
        onCreated(r.id);
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  return (
    <Sheet visible={visible} onClose={onClose} scroll title={tx('New Loup-Garou table')} subtitle={tx(MODE_INFO[mode].name)}>
      <SheetBody>
        <TextInput
          value={title}
          onChangeText={(v) => setTitle(v.slice(0, 60))}
          placeholder={tx('Name (optional)')}
          placeholderTextColor={DX.muted}
          maxLength={60}
          style={styles.field}
          accessibilityLabel={tx('Name (optional)')}
        />
        <Choice
          options={[
            { value: 'online', label: tx('Online') },
            { value: 'irl', label: tx('In person (QR code)') },
          ]}
          value={kind}
          onChange={setKind}
        />
        {kind === 'online' ? (
          <Choice
            options={[
              { value: 'public', label: tx('Public') },
              { value: 'private', label: tx('Private, with a code') },
            ]}
            value={visibility}
            onChange={setVisibility}
          />
        ) : (
          <Text style={styles.small}>{tx('In person: everyone scans the QR code, gets a secret card on their phone and votes there. No game master needed.')}</Text>
        )}
        <Label>{tx('Up to')}</Label>
        <Choice
          options={[
            { value: '8', label: '8' },
            { value: '10', label: '10' },
            { value: '12', label: '12' },
            { value: '20', label: '20' },
          ]}
          value={size}
          onChange={setSize}
        />
        <Text style={styles.small}>{tx('The game starts from 6 players. Unranked.')}</Text>
        <StartButton label={tx('Create the table')} disabled={busy} onPress={create} />
      </SheetBody>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DX.black },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: DX.gold, backgroundColor: 'rgba(11,9,7,0.6)', alignItems: 'center', justifyContent: 'center' },
  brand: { color: DX.gold, fontSize: 14, letterSpacing: 4 },
  online: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: DX.goldDark, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(11,9,7,0.6)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3FBF6F' },
  onlineText: { color: DX.ivory, fontSize: 12, fontWeight: '700' },
  titleBox: { alignItems: 'center', marginTop: 28 },
  title: { color: DX.goldLight, fontSize: 40, lineHeight: 46, letterSpacing: 1, textShadowColor: '#000', textShadowRadius: 14 },
  claws: { marginTop: -26, marginBottom: -8 },
  modeBand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  rule: { width: 42, height: 1.5, backgroundColor: DX.gold },
  modeName: { color: DX.gold, fontSize: 30, letterSpacing: 4, textShadowColor: '#000', textShadowRadius: 12 },
  tagline: { color: DX.ivory, fontSize: 15, marginTop: 10, textAlign: 'center', paddingHorizontal: 24, textShadowColor: '#000', textShadowRadius: 8 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 22 },
  modeTile: { borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: DX.goldDark, justifyContent: 'flex-end', padding: 6, backgroundColor: DX.black, opacity: 0.8 },
  modeTileOn: { borderColor: DX.goldLight, borderWidth: 2.5, opacity: 1, shadowColor: DX.gold, shadowOpacity: 0.7, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  modeTileText: { color: DX.ivory, letterSpacing: 0.5, textAlign: 'center' },
  newBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: DX.red, borderRadius: 8, borderWidth: 1, borderColor: DX.gold, paddingHorizontal: 6, paddingVertical: 1 },
  newText: { color: DX.goldLight, fontSize: 10, fontWeight: '800' },
  castRow: { flexDirection: 'row', marginTop: 16 },
  face: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: DX.gold, backgroundColor: DX.black },
  modeLine: { color: DX.muted, fontSize: 13, textAlign: 'center', marginTop: 10, paddingHorizontal: 28 },
  menu: { marginTop: 20, gap: 10 },
  play: { height: 56, borderRadius: 16, borderWidth: 2, borderColor: DX.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  playText: { color: DX.goldLight, fontSize: 15, letterSpacing: 0.3, flexShrink: 1 },
  dock: { alignItems: 'center', gap: 6, paddingTop: 10, borderTopWidth: 1.5, borderColor: DX.gold, backgroundColor: '#15100C' },
  dockRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dockMode: { color: DX.muted, fontSize: 12 },
  train: { height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: DX.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10, backgroundColor: 'rgba(11,9,7,0.9)' },
  trainText: { color: DX.goldLight, fontSize: 14, flexShrink: 1 },
  item: { minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: DX.goldDark, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  itemText: { flex: 1, color: DX.ivory, fontSize: 15, letterSpacing: 0.3 },
  pair: { flexDirection: 'row', gap: 10 },
  small2: { minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: DX.goldDark, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, backgroundColor: 'rgba(11,9,7,0.85)' },
  count: { color: DX.muted, fontSize: 12.5, textAlign: 'center', marginTop: 4 },
  codeRow: { flexDirection: 'row', gap: 8 },
  codeInput: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: DX.gold, color: DX.ivory, paddingHorizontal: 14, fontSize: 18, letterSpacing: 4, backgroundColor: 'rgba(11,9,7,0.85)' },
  codeGo: { minHeight: 48, borderRadius: 12, backgroundColor: DX.red, borderWidth: 1.5, borderColor: DX.gold, paddingHorizontal: 18, justifyContent: 'center' },
  codeGoText: { color: DX.goldLight, fontWeight: '700', fontSize: 15 },
  section: { marginTop: 24, gap: 10 },
  sectionTitle: { color: DX.goldLight, fontSize: 17 },
  room: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.2, borderColor: DX.goldDark, borderRadius: 14, padding: 12, backgroundColor: 'rgba(21,16,12,0.95)' },
  roomTitle: { color: DX.ivory, fontSize: 15, fontWeight: '800' },
  roomBtn: { minHeight: 38, borderRadius: 12, borderWidth: 1.2, borderColor: DX.gold, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: 'rgba(11,9,7,0.7)' },
  roomBtnText: { color: DX.goldLight, fontWeight: '800', fontSize: 13 },
  recent: { gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: DX.goldDark, paddingBottom: 10 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  person: { alignItems: 'center', gap: 4, width: 64 },
  personName: { color: DX.ivory, fontSize: 12 },
  small: { color: DX.muted, fontSize: 12.5 },
  sheet: { gap: 14, paddingBottom: 24, paddingHorizontal: 20 },
  label: { color: DX.gold, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 42, borderRadius: 12, borderWidth: 1.2, borderColor: DX.goldDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: DX.black },
  choiceOn: { borderColor: DX.gold, backgroundColor: DX.red },
  choiceText: { color: DX.ivory, fontSize: 14, fontWeight: '700' },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1.2, borderColor: DX.goldDark, paddingRight: 10, paddingLeft: 4, minHeight: 36, backgroundColor: DX.black },
  roleFace: { width: 28, height: 28, borderRadius: 14 },
  field: { minHeight: 46, borderRadius: 12, borderWidth: 1.2, borderColor: DX.goldDark, color: DX.ivory, paddingHorizontal: 14, fontSize: 16, backgroundColor: DX.black },
});
