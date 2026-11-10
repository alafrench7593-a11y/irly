import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { toast } from '@/components/ui/Toast';
import { blockUser } from '@/features/moderation/moderation';
import { openReport } from '@/features/moderation/reportStore';
import { t as tx } from '@/i18n';
import { useNow } from '@/lib/useNow';
import { useKeyboardHeight } from '@/motion/keyboard';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { joinRoom, kickPlayer, startRoom, type GameMessage, type Room } from '../api';
import { InviteSheet } from '../InviteSheet';
import { MODE_INFO } from './home/WerewolfHome';
import { ACTION_TITLE, CARD_ORDER, cardOf, DAY_POWERS, deckOf, MODE_NAME, NO_TARGET, SPECIALS, toMode, TWO_TARGETS, wolvesFor, type CardId } from './cards';
import { botLine, logLine } from './lines';
import { PORTRAIT, SCENES } from './dubai/art';
import { DubaiResult } from './dubai/Result';
import { DubaiMyCard } from './dubai/RoomParts';
import { Stage } from './dubai/Stage';
import { DX, serif, useDubaiFonts } from './dubai/theme';
import { Qr } from './Qr';
import { CommChoice } from './voice/CommChoice';
import { useVoice, voiceConfigured, voiceSupported, wwSetComm, type Voice } from './voice/useVoice';
import { VoiceBar, VoiceMic } from './voice/VoiceBar';
import { useWwView, wwAct, wwSay, wwSetComposition, wwSkipDay, type WwOption, type WwPlayer, type WwView } from './api';

const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');
const JOIN_URL = 'https://getirly.com/app/games/join?code=';
const modeOf = toMode;

/**
 * A Loup-Garou table, in every mode (Classic, Dubaï, Chaos): the waiting room
 * (code and QR code, the deck), then the game as this player sees it (the
 * table with the scene of the moment, what she may do right under it, her
 * card, the log, the chat of her channel), then the result with every card
 * revealed. The server decides everything.
 */
export function WerewolfRoom({ room, me, messages, onBack, onLeave, children }: { room: Room; me: string; messages: GameMessage[]; onBack: () => void; onLeave: () => void; children?: ReactNode }) {
  const { view, failed, reload, skew } = useWwView(room.id, room);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const playing = Boolean(view && view.phase !== 'lobby' && view.phase !== 'ended');
  const lobby = view?.phase === 'lobby';
  // While the keyboard is up the dock steps aside: the field being typed in and its send button keep the room.
  const typing = useKeyboardHeight() > 0;
  // Voice games: my rights are read again when the table changes (lobby) or when the phase, the living or my camp do.
  const voiceSig = !view || view.phase === 'lobby' ? room : `${view.phase}|${view.night}|${view.day}|${(view.players ?? []).map((p) => (p.alive ? 1 : 0)).join('')}|${view.me?.camp}|${(view.me?.pack ?? []).join(',')}`;
  const voice = useVoice(room.id, voiceSig);
  const people = useMemo(() => room.people.map((p) => ({ id: p.id, name: p.name ?? tx('A member') })), [room.people]);
  // My card, the chat and the log open over the game, one at a time. The card opens by itself when the roles are dealt.
  const [panel, setPanel] = useState<GamePanel | null>(null);
  const [cardSeen, setCardSeen] = useState(false);
  const dealing = playing && view?.phase === 'night' && (view.night ?? 1) <= 1 && !cardSeen;
  const open: GamePanel | null = panel ?? (dealing ? 'card' : null);
  const closePanel = () => {
    setPanel(null);
    setCardSeen(true);
  };
  const { act, busy } = useAct(room.id, reload);
  const [inviting, setInviting] = useState(false);
  const present = room.people.filter((p) => !p.left);
  const seated = present.some((p) => p.id === me);
  const host = room.host_id === me;
  const missing = Math.max(0, 6 - present.length);
  return (
    <View style={styles.screen}>
      <TopBar room={room} view={view} skew={skew} seated={seated} onBack={onBack} onLeave={onLeave} />
      <ScrollView style={styles.screen} contentContainerStyle={[styles.scroll, { paddingBottom: playing || lobby ? 16 : insets.bottom + 16 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {!view ? (
          <Text style={styles.muted}>{failed ? tx(failed) : tx('Loading…')}</Text>
        ) : view.phase === 'lobby' ? (
          <Lobby room={room} me={me} view={view} onChanged={reload} voice={voice} people={people} onInvite={() => setInviting(true)} />
        ) : (
          <Game room={room} me={me} view={view} messages={messages} skew={skew} onChanged={reload} voice={voice} people={people} panel={open} onClosePanel={closePanel} act={act} busy={busy} />
        )}
        {children}
      </ScrollView>
      {/* The waiting room's one main action stays at the bottom, with the reason when it cannot be done yet. */}
      {lobby && !typing ? (
        <View style={[styles.dock, styles.dockInner, { paddingBottom: insets.bottom + 12 }]} testID="ww-lobby-dock">
          {!seated && room.status === 'waiting' ? (
            <GoldButton label={tx('Join the game')} icon="userPlus" onPress={() => joinRoom(room.id).then(reload).catch(fail)} />
          ) : host ? (
            <>
              {missing > 0 ? (
                <Text style={styles.reason} testID="ww-start-reason">
                  {missing === 1 ? tx('1 more player is needed to start.') : tx('{n} more players are needed to start.', { n: missing })}
                </Text>
              ) : null}
              <GoldButton label={tx('Start the game')} icon="play" disabled={missing > 0} onPress={() => startRoom(room.id).then(reload).catch(fail)} />
            </>
          ) : (
            <View style={styles.waiting} accessibilityRole="text" testID="ww-waiting-host">
              <Text style={styles.waitingText}>{tx('Waiting for the host')}</Text>
            </View>
          )}
        </View>
      ) : null}
      {/* In the game: what I may do now, and the three panels, stay at the bottom of the screen. */}
      {playing && view && !typing ? (
        <View style={[styles.dock, { paddingBottom: insets.bottom + 10, maxHeight: Math.round(height * 0.4) }]} testID="ww-dock">
          <View style={styles.tabs}>
            <Tab icon="drama" label={tx('My card')} on={open === 'card'} onPress={() => setPanel('card')} testID="ww-tab-card" />
            {room.kind !== 'irl' ? <Tab icon="message" label={tx('Chat')} on={open === 'chat'} onPress={() => setPanel('chat')} testID="ww-tab-chat" /> : null}
            <Tab icon="book" label={tx('Log')} on={open === 'log'} onPress={() => setPanel('log')} testID="ww-tab-log" />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dockInner}>
            <VoiceMic voice={voice} />
            <Actions view={view} name={(s) => (s === undefined ? tx('someone') : ((view.players ?? []).find((p) => p.seat === s)?.name ?? tx('someone')))} act={act} busy={busy} />
          </ScrollView>
        </View>
      ) : null}
      {host && lobby ? <InviteSheet room={room} visible={inviting} onClose={() => setInviting(false)} /> : null}
    </View>
  );
}

type GamePanel = 'card' | 'chat' | 'log';

/** What the server answers when the screen was a moment late: the phase moved on, nothing is wrong. */
const LATE = new Set(['you cannot do that now', 'nothing to do now', 'not a valid target', 'this game is not running']);
type Act = (kind: string, a?: number | null, b?: number | null) => void;

/**
 * One action at a time. While it is sent, and until the game is read again, nothing else can be sent: a second
 * tap never reaches the server from a screen that is out of date. If the phase had already moved on, the game is
 * simply read again and the player is told so, without an error.
 */
function useAct(roomId: string, reload: () => Promise<void>): { act: Act; busy: boolean } {
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const act: Act = (kind, a, b) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    wwAct(roomId, kind, a, b)
      .catch((e: unknown) => {
        if (e instanceof Error && LATE.has(e.message)) toast(tx('The game has moved on. Here is where it stands.'), 'clock');
        else fail(e);
      })
      .then(reload)
      .finally(() => {
        sending.current = false;
        setBusy(false);
      });
  };
  return { act, busy };
}

const PHASE_ICON = { night: '🌙', witch: '🌙', day: '☀️', vote: '🗳️', revote: '🗳️', ended: '🏁', lobby: '' } as const;

/** The game's own top bar: back, where we are (the waiting room, or the mode, the phase and its clock), leaving. */
function TopBar({ room, view, skew, seated, onBack, onLeave }: { room: Room; view: WwView | null; skew: number; seated: boolean; onBack: () => void; onLeave: () => void }) {
  const insets = useSafeAreaInsets();
  const fonts = useDubaiFonts();
  const lobby = !view || view.phase === 'lobby';
  const mode = modeOf(view?.mode);
  const phase = !view
    ? ''
    : view.phase === 'night' || view.phase === 'witch'
      ? tx('Night {n}', { n: view.night ?? 1 })
      : view.phase === 'day'
        ? tx('Day {n}', { n: view.day ?? 1 })
        : view.phase === 'vote'
          ? tx('Day {n} · vote', { n: view.day ?? 1 })
          : view.phase === 'revote'
            ? tx('Second round')
            : view.phase === 'ended'
              ? tx('Game over')
              : '';
  return (
    <View style={[styles.top, { paddingTop: insets.top + 6 }]} testID="ww-top">
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={tx('Back')} style={styles.topRound} hitSlop={6}>
        <Icon name="arrowLeft" size={20} color={DX.goldLight} />
      </Pressable>
      <View style={styles.topCopy}>
        <Text style={[styles.topTitle, serif(fonts, '900')]} numberOfLines={1} accessibilityRole="header">
          {lobby ? 'LOUP-GAROU' : tx(MODE_NAME[mode]).toUpperCase()}
        </Text>
        {lobby ? (
          <Text style={styles.topSub} numberOfLines={1}>
            {[tx('Waiting room'), room.title].filter(Boolean).join(' · ')}
          </Text>
        ) : (
          <View style={styles.topPhase}>
            <Text style={styles.topSub} numberOfLines={1}>
              {`${PHASE_ICON[view!.phase]} ${phase.toUpperCase()}`}
            </Text>
            {view!.phase !== 'ended' ? <Clock deadline={view!.deadline ?? null} skew={skew} /> : null}
          </View>
        )}
      </View>
      {seated && (room.status === 'waiting' || room.status === 'playing') ? (
        <Pressable onPress={onLeave} accessibilityRole="button" accessibilityLabel={tx('Leave')} style={styles.topLeave} hitSlop={6}>
          <Text style={styles.topLeaveText}>{tx('Leave')}</Text>
        </Pressable>
      ) : (
        <View style={styles.topSpacer} />
      )}
    </View>
  );
}

function Tab({ icon, label, on, onPress, testID }: { icon: IconName; label: string; on: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={() => {
        haptic('select');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={[styles.tab, on ? styles.tabOn : null]}
      testID={testID}
    >
      <Icon name={icon} size={17} color={on ? DX.goldLight : DX.gold} />
      <Text style={[styles.tabText, on ? styles.tabTextOn : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// ───────── Small parts in the game's style ─────────
function Panel({ children, title, accent }: { children: ReactNode; title?: string; accent?: boolean }) {
  const fonts = useDubaiFonts();
  return (
    <View style={[styles.panel, accent && styles.panelAccent]}>
      {title ? <Text style={[styles.panelTitle, serif(fonts, '700')]}>{title}</Text> : null}
      {children}
    </View>
  );
}

function GoldButton({ label, icon, onPress, disabled, ghost }: { label: string; icon?: IconName; onPress: () => void; disabled?: boolean; ghost?: boolean }) {
  const fonts = useDubaiFonts();
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }}>
      {ghost ? (
        <View style={[styles.ghost, disabled && styles.disabled]}>
          {icon ? <Icon name={icon} size={16} color={DX.goldLight} /> : null}
          <Text style={styles.ghostText}>{label}</Text>
        </View>
      ) : (
        <LinearGradient colors={['#B3262F', DX.red, '#5E0F15']} style={[styles.gold, disabled && styles.disabled]}>
          {icon ? <Icon name={icon} size={18} color={DX.goldLight} /> : null}
          <Text style={[styles.goldText, serif(fonts, '700')]}>{label}</Text>
        </LinearGradient>
      )}
    </PressableScale>
  );
}

// ───────── Waiting room ─────────
function Lobby({ room, me, view, onChanged, voice, people, onInvite }: { room: Room; me: string; view: WwView; onChanged: () => void; voice: Voice; people: { id: string; name: string }[]; onInvite: () => void }) {
  const fonts = useDubaiFonts();
  const { width } = useWindowDimensions();
  const host = room.host_id === me;
  const present = room.people.filter((p) => !p.left);
  const irl = room.kind === 'irl';
  const mode = modeOf(view.mode);
  const info = MODE_INFO[mode];
  const [cardsOpen, setCardsOpen] = useState(false);
  // The host may turn voice on where it really works (an audio server on the project, WebRTC on this device).
  const [voiceOk, setVoiceOk] = useState(false);
  useEffect(() => {
    if (host && !irl && voiceSupported()) voiceConfigured().then(setVoiceOk);
  }, [host, irl]);
  // Seats: four to a row on a phone, every seat of the table drawn, the free ones as quiet outlines.
  const cols = width >= 520 ? 5 : 4;
  const seatW = Math.floor((Math.min(width, 560) - 32 - 28 - 4 - (cols - 1) * 8) / cols);
  const free = Math.max(0, room.max - present.length);
  return (
    <View style={styles.block}>
      <View style={styles.lobbyHero} testID="ww-mode-card">
        <Image source={SCENES[mode].home} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
        <LinearGradient colors={['rgba(11,9,7,0.1)', 'rgba(11,9,7,0.92)']} style={StyleSheet.absoluteFill} />
        <Text style={[styles.lobbyMode, serif(fonts, '900')]}>{mode === 'dubai' ? 'DUBAÏ — EXPATS VS ESCROCS 🇦🇪' : tx(MODE_NAME[mode]).toUpperCase()}</Text>
        <Text style={[styles.lobbyTitle, serif(fonts, '700')]}>{tx(info.tagline)}</Text>
        <Text style={styles.lobbyLine}>{tx('From 6 to {max} players', { max: room.max })}</Text>
      </View>
      <View style={styles.chipsRow}>
        <Chip text={`🟢 ${tx('Waiting')}`} />
        <Chip text={irl ? tx('In person') : voice.isVoice ? tx('🎙️ Voice on') : tx('💬 Text game')} testID="ww-comm-chip" />
        <Chip text={room.visibility === 'private' ? tx('Private') : tx('Public')} />
        <Chip text={tx('Unranked game')} />
      </View>

      <Panel title={tx('Players — {n}/{max}', { n: present.length, max: room.max })}>
        <View style={styles.seats} testID="ww-seats">
          {present.map((p) => (
            <View key={p.id} style={[styles.seat, { width: seatW }]}>
              <View style={[styles.seatFace, p.id === room.host_id ? styles.seatHost : null, voice.joined && voice.speaking.includes(p.id) ? styles.seatSpeaking : null]}>
                <Avatar name={p.name ?? '?'} hue={0} userId={p.id} size={46} />
              </View>
              <Text style={styles.seatName} numberOfLines={1}>
                {p.id === me ? tx('You') : (p.name ?? tx('A member'))}
              </Text>
              <Text style={styles.seatRole} numberOfLines={1}>
                {p.id === room.host_id ? tx('Host') : voice.isVoice && voice.present.includes(p.id) ? tx('In voice') : ' '}
              </Text>
            </View>
          ))}
          {Array.from({ length: free }, (_, i) => (
            <View key={`free-${i}`} style={[styles.seat, { width: seatW }]} accessibilityLabel={tx('Free seat')}>
              <View style={styles.seatFree} />
            </View>
          ))}
        </View>
        {host ? <GoldButton label={tx('Invite players')} icon="userPlus" ghost onPress={onInvite} /> : null}
      </Panel>

      {irl && room.code ? (
        <Panel>
          <View style={styles.codeBox}>
            <Qr value={JOIN_URL + room.code} size={180} />
            <Text style={styles.muted}>{tx('Scan, or type the code in IRLY Games')}</Text>
            <Text style={[styles.codeText, serif(fonts, '900')]}>{room.code}</Text>
          </View>
        </Panel>
      ) : null}

      {host && !irl && (voiceOk || voice.isVoice) ? (
        <Panel title={tx('How the table talks')}>
          <CommChoice value={voice.isVoice ? 'voice' : 'text'} onChange={(c) => wwSetComm(room.id, c).then(onChanged).catch(fail)} />
        </Panel>
      ) : null}
      <VoiceBar voice={voice} phase="lobby" me={me} people={people} onKick={host ? (id) => kickPlayer(room.id, id).then(onChanged).catch(fail) : undefined} />

      <Pressable onPress={() => setCardsOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: cardsOpen }} style={styles.fold} testID="ww-cards-fold">
        <Text style={[styles.foldText, serif(fonts, '700')]}>{tx('The cards of this game')}</Text>
        <Icon name={cardsOpen ? 'chevronUp' : 'chevronDown'} size={18} color={DX.gold} />
      </Pressable>
      {cardsOpen ? <Deck view={view} editable={host} roomId={room.id} onChanged={onChanged} /> : null}
    </View>
  );
}

function Chip({ text, testID }: { text: string; testID?: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel} testID={testID}>
        {text}
      </Text>
    </View>
  );
}

function Deck({ view, editable, roomId, onChanged }: { view: WwView; editable: boolean; roomId: string; onChanged: () => void }) {
  const players = Math.max(view.present ?? 6, 6);
  const mode = modeOf(view.mode);
  if (!view.composition) {
    return (
      <Panel title={tx('The deck')}>
        <Text style={styles.body}>{tx('The server draws the deck of this mode when the game starts, for the players who are there. It is shown to all then.')}</Text>
      </Panel>
    );
  }
  const comp = view.composition;
  const save = (next: Record<string, number>) => {
    const specials = SPECIALS.reduce((n, id) => n + (next[id] ?? 0), 0);
    const wolves = next.werewolf ?? 1;
    const villagers = players + (next.thief ? 2 : 0) - specials - wolves;
    if (villagers < 0) return toast(tx('Not enough players for these cards'), 'x', 'live');
    void wwSetComposition(roomId, { ...next, villager: villagers }).then(onChanged).catch(fail);
  };
  return (
    <Panel title={tx('The deck for {n} players{custom}', { n: players, custom: view.custom ? ` · ${tx('set by the host')}` : '' })}>
      <View style={styles.chips}>
        {[...new Set([...deckOf(mode), ...CARD_ORDER])]
          .filter((id) => (comp[id] ?? 0) > 0)
          .map((id) => (
            <CardChip key={id} id={id} count={comp[id] ?? 0} />
          ))}
      </View>
      {editable && mode === 'classic' ? (
        <>
          <View style={styles.chips}>
            <GoldButton label={tx('− Werewolf')} ghost disabled={(comp.werewolf ?? 1) <= 1} onPress={() => save({ ...comp, werewolf: (comp.werewolf ?? 1) - 1 })} />
            <GoldButton label={tx('+ Werewolf')} ghost disabled={((comp.werewolf ?? 1) + 1) * 2 >= players} onPress={() => save({ ...comp, werewolf: (comp.werewolf ?? 1) + 1 })} />
          </View>
          <View style={styles.chips}>
            {SPECIALS.map((id) => {
              const on = (comp[id] ?? 0) > 0;
              return (
                <PressableScale key={id} onPress={() => save({ ...comp, [id]: on ? 0 : 1 })} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={tx(cardOf(id).name)}>
                  <View style={{ opacity: on ? 1 : 0.45 }}>
                    <CardChip id={id} count={1} />
                  </View>
                </PressableScale>
              );
            })}
          </View>
          <Text style={styles.small}>{tx('Default: {n} werewolf(s) for {p} players. Villagers fill the other seats.', { n: wolvesFor(players), p: players })}</Text>
        </>
      ) : null}
    </Panel>
  );
}

function CardChip({ id, count }: { id: CardId; count: number }) {
  return (
    <View style={styles.cardChip}>
      <Image source={PORTRAIT[id]} style={styles.chipFace} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
      <Text style={styles.chipText}>{`${tx(cardOf(id).name)}${count > 1 ? ` ×${count}` : ''}`}</Text>
    </View>
  );
}

// ───────── The game ─────────
function Game({ room, me, view, messages, skew, onChanged, voice, people, panel, onClosePanel, act, busy }: { room: Room; me: string; view: WwView; messages: GameMessage[]; skew: number; onChanged: () => void; voice: Voice; people: { id: string; name: string }[]; panel: GamePanel | null; onClosePanel: () => void; act: Act; busy: boolean }) {
  const night = view.phase === 'night' || view.phase === 'witch';
  const ended = view.phase === 'ended';
  const mode = modeOf(view.mode);
  const players = view.players ?? [];
  const alive = view.me?.alive ?? false;
  const name = (s: number | undefined) => (s === undefined ? tx('someone') : (players.find((p) => p.seat === s)?.name ?? tx('someone')));
  const options = view.options ?? [];
  const mine = view.mine ?? [];
  // The main choice of the moment is made on the table itself: the vote, the victim, a night power on someone.
  const stageOption = options.find((o) => o.kind === 'vote' || o.kind === 'wolf') ?? options.find((o) => o.targets.length > 0 && !TWO_TARGETS.has(o.kind) && o.kind !== 'steal' && !DAY_POWERS.has(o.kind) && !o.kind.startsWith('predict'));
  const stageChosen = stageOption ? (mine.find((m) => m.kind === stageOption.kind)?.target ?? null) : null;
  const stageMarks = useMemo(() => {
    const out: Record<number, string> = {};
    for (const e of view.log ?? []) {
      const s = typeof e.data.seat === 'number' ? (e.data.seat as number) : undefined;
      if (s === undefined || Number(e.data.day) !== view.day) continue;
      if (e.kind === 'vote_doubled') out[s] = tx('×2 vote');
      if (e.kind === 'immune') out[s] = tx('Immune');
    }
    if (view.pack_votes) for (const v of Object.values(view.pack_votes)) out[v] = `${out[v] ? `${out[v]} ` : ''}●`;
    return out;
  }, [view.log, view.day, view.pack_votes]);
  const pick = (seat: number) => {
    if (!stageOption) return;
    act(stageOption.kind, seat);
  };
  const menu = (p: WwPlayer) => {
    if (p.bot || !p.user_id || p.user_id === me) return;
    Alert.alert(p.name, undefined, [
      { text: tx('Report'), onPress: () => openReport({ kind: 'profile', userId: p.user_id! }, p.name) },
      { text: tx('Block'), style: 'destructive', onPress: () => blockUser(p.user_id!).then(() => toast(tx('{name} is blocked', { name: p.name }), 'check')).catch(fail) },
      { text: tx('Cancel'), style: 'cancel' },
    ]);
  };
  const hint = ended
    ? undefined
    : !alive
      ? tx('You are out: watch the end of the game')
      : stageOption
        ? stageChosen !== null
          ? tx('Chosen: {name}. Touch another player to change', { name: name(stageChosen) })
          : stageOption.kind === 'vote'
            ? tx('Touch a player to vote')
            : stageOption.kind === 'wolf'
              ? tx('Touch your victim')
              : tx('Touch a player to use your power')
        : night
          ? tx('You sleep. The night goes on…')
          : view.phase === 'day'
            ? tx('Debate, then get ready to vote')
            : tx('Wait for the others…');

  return (
    <View style={styles.block}>
      {ended ? null : (
        <Stage
          phase={night ? 'night' : 'day'}
          scene={SCENES[mode]}
          title={night ? tx('Night {n}', { n: view.night ?? 1 }) : view.phase === 'day' ? tx('Day {n}', { n: view.day ?? 1 }) : view.phase === 'revote' ? tx('Second round') : tx('Day {n} · vote', { n: view.day ?? 1 })}
          subtitle={night ? tx('Powers act in secret…') : view.phase === 'day' ? tx('Debate') : tx('Elimination vote')}
          clock={<Clock deadline={view.deadline ?? null} skew={skew} />}
          players={players}
          mySeat={view.me?.seat}
          targets={stageOption && alive && !busy ? stageOption.targets : []}
          chosen={stageChosen}
          marks={stageMarks}
          onPick={stageOption ? pick : undefined}
          onMenu={menu}
          hint={hint}
          speaking={voice.joined ? players.filter((p) => p.user_id && voice.speaking.includes(p.user_id)).map((p) => p.seat) : undefined}
        />
      )}
      <VoiceBar voice={voice} phase={view.phase} night={view.night} alive={view.me?.alive} dubai={mode === 'dubai'} me={me} people={people} />
      {ended ? (
        <>
          <DubaiResult view={view} me={me} room={room} />
          <Log view={view} name={name} />
          <Chat room={room} view={view} messages={messages} me={me} name={name} />
        </>
      ) : (
        <>
          {/* The last thing that happened stays under the table; the whole log, my card and the chat open over the game. */}
          <Log view={view} name={name} latest />
          <Sheet visible={panel === 'card'} onClose={onClosePanel} scroll title={tx('My card')} subtitle={tx('Only you see it. Touch the card to turn it.')}>
            <View style={styles.sheetBody} testID="ww-panel-card">
              {view.me ? (
                <DubaiMyCard id={view.me.card as CardId} startShown={false}>
                  <Knowledge view={view} name={name} />
                </DubaiMyCard>
              ) : null}
            </View>
          </Sheet>
          <Sheet visible={panel === 'log'} onClose={onClosePanel} scroll title={tx('What happened')}>
            <View style={styles.sheetBody} testID="ww-panel-log">
              <Log view={view} name={name} bare />
            </View>
          </Sheet>
          <Sheet visible={panel === 'chat'} onClose={onClosePanel} scroll title={tx('Chat')}>
            <View style={styles.sheetBody} testID="ww-panel-chat">
              <Chat room={room} view={view} messages={messages} me={me} name={name} bare />
            </View>
          </Sheet>
        </>
      )}
      {room.kind === 'irl' && view.phase === 'day' && room.host_id === me ? <GoldButton label={tx('Everyone has talked: vote')} icon="arrowRight" onPress={() => wwSkipDay(room.id).then(onChanged).catch(fail)} /> : null}
    </View>
  );
}

/** What my card has taught me so far (accomplices, lover, target, servants…; the investigations' results are in the log). */
function Knowledge({ view, name }: { view: WwView; name: (s?: number) => string }) {
  const me = view.me!;
  const mode = modeOf(view.mode);
  return (
    <>
      {me.borrowed ? <Text style={[styles.know, { color: DX.goldLight }]}>{tx('Tonight you play the power of {card}', { card: tx(cardOf(me.borrowed).name) })}</Text> : null}
      {me.seduced && me.seduced.length ? <Text style={styles.know}>{tx('Seduced: {names}', { names: me.seduced.map(name).join(', ') })}</Text> : null}
      {me.pack && me.pack.length > 1 ? <Text style={[styles.know, { color: DX.redLight }]}>{tx(mode === 'dubai' ? 'Your accomplices: {names}' : 'Your pack: {names}', { names: me.pack.filter((s) => s !== me.seat).map(name).join(', ') })}</Text> : null}
      {me.lover !== null && me.lover !== undefined ? <Text style={styles.know}>{tx('In love with {name}', { name: name(me.lover) })}</Text> : null}
      {me.prey !== null && me.prey !== undefined ? <Text style={[styles.know, { color: DX.goldLight }]}>{tx('Your target: {name}', { name: name(me.prey) })}</Text> : null}
      {me.servants && me.servants.length ? <Text style={styles.know}>{tx('Your servants: {names}', { names: me.servants.map(name).join(', ') })}</Text> : null}
      {me.master !== null && me.master !== undefined ? <Text style={[styles.know, { color: DX.redLight }]}>{tx('You serve the Vampire: {name}', { name: name(me.master) })}</Text> : null}
      {me.solo_won ? <Text style={[styles.know, { color: '#7BD89B' }]}>{tx('Your personal victory is won, for good')}</Text> : null}
      {me.silenced && me.alive ? <Text style={[styles.know, { color: DX.redLight }]}>{tx('You cannot vote today')}</Text> : null}
      {!me.alive ? <Text style={[styles.know, { color: DX.redLight }]}>{tx('You are dead: watch, and talk with the dead')}</Text> : null}
    </>
  );
}

function Clock({ deadline, skew }: { deadline: string | null; skew: number }) {
  const now = useNow(500);
  if (!deadline) return null;
  const left = Math.max(0, Math.ceil((Date.parse(deadline) - (now + skew)) / 1000));
  const m = Math.floor(left / 60);
  const s = left % 60;
  return <Text style={[styles.clock, left <= 10 && { color: DX.redLight }]}>{`${m}:${String(s).padStart(2, '0')}`}</Text>;
}

// ───────── What I may do now ─────────
function Actions({ view, name, act, busy }: { view: WwView; name: (s?: number) => string; act: Act; busy: boolean }) {
  const options = view.options ?? [];
  const mine = view.mine ?? [];
  const fonts = useDubaiFonts();
  if (!view.me?.alive) return <Text style={styles.waitText}>{tx('You are out: watch the end of the game')}</Text>;
  if (!options.length) {
    return <Text style={styles.waitText}>{view.phase === 'night' || view.phase === 'witch' ? tx('You sleep. The night goes on…') : tx('Wait for the others…')}</Text>;
  }
  const waiting = options.every((o) => mine.some((m) => m.kind === o.kind)) || mine.some((m) => m.kind === 'pass');
  return (
    <View style={styles.actions}>
      <Text style={[styles.panelTitle, serif(fonts, '700')]}>{waiting ? tx('Done. Waiting for the others…') : tx('Your turn')}</Text>
      {view.phase === 'witch' && view.victim !== null && view.victim !== undefined ? (
        <Text style={styles.alert}>{tx(view.mode === 'dubai' ? 'The Escrocs attacked {name}' : 'The werewolves attacked {name}', { name: name(view.victim) })}</Text>
      ) : null}
      {options.map((o) => (
        <Option key={o.kind} view={view} option={o} done={mine.filter((m) => m.kind === o.kind)} name={name} act={act} busy={busy} />
      ))}
      {view.phase !== 'day' && !mine.length ? <GoldButton label={tx(view.phase === 'vote' || view.phase === 'revote' ? 'Abstain' : 'Do nothing')} ghost disabled={busy} onPress={() => act('pass')} /> : null}
      {mine.some((m) => m.kind === 'pass') ? <Text style={styles.small}>{tx('You chose to do nothing')}</Text> : null}
    </View>
  );
}

function Option({ view, option, done, name, act, busy }: { view: WwView; option: WwOption; done: { target: number | null; target2: number | null }[]; name: (s?: number) => string; act: Act; busy: boolean }) {
  const [first, setFirst] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const send = (a?: number | null, b?: number | null) => {
    if (busy) return;
    haptic('press');
    act(option.kind, a, b);
  };
  const chosen = done[0];
  const label = (s: number) => name(s) + (view.pack_votes && option.kind === 'wolf' ? votesFor(view.pack_votes, s) : '');
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(300)} style={[styles.option, busy ? styles.sending : null]}>
      <Text style={styles.optionTitle}>{tx(ACTION_TITLE[option.kind] ?? option.kind)}</Text>
      {chosen ? (
        <Text style={styles.done}>
          {TWO_TARGETS.has(option.kind)
            ? tx('Chosen: {a} and {b}', { a: name(chosen.target ?? undefined), b: name(chosen.target2 ?? undefined) })
            : chosen.target !== null && option.kind !== 'steal'
              ? tx('Chosen: {name}', { name: name(chosen.target) })
              : tx('Done')}
        </Text>
      ) : null}
      {NO_TARGET.has(option.kind) ? (
        <GoldButton label={tx(option.kind === 'ready' ? 'Ready to vote' : option.kind === 'hint' ? 'Spy tonight' : 'Use my power')} disabled={Boolean(chosen) || busy} onPress={() => send()} />
      ) : option.kind === 'steal' ? (
        <View style={styles.chips}>
          {(option.cards ?? []).map((c, i) => (
            <PressableScale key={i} onPress={() => send(i)} accessibilityRole="button" accessibilityLabel={tx(cardOf(c).name)}>
              <CardChip id={c as CardId} count={1} />
            </PressableScale>
          ))}
          <GoldButton label={tx('Keep my card')} ghost onPress={() => send(-1)} />
        </View>
      ) : (
        <View style={styles.chips}>
          {option.targets.map((s) => {
            const on = chosen?.target === s || chosen?.target2 === s || first === s;
            return (
              <PressableScale
                key={s}
                onPress={() => {
                  if (!TWO_TARGETS.has(option.kind)) return send(s);
                  if (first === null) return setFirst(s);
                  if (first === s) return setFirst(null);
                  send(first, s);
                  setFirst(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={name(s)}
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.target, on && styles.targetOn]}>
                  <Text style={[styles.targetText, on && { color: DX.goldLight }]}>{label(s)}</Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

const votesFor = (votes: Record<string, number>, s: number) => {
  const n = Object.values(votes).filter((v) => v === s).length;
  return n ? ` · ●×${n}` : '';
};

// ───────── The log: the newest first, the last one highlighted ─────────
function Log({ view, name, latest, bare }: { view: WwView; name: (s?: number) => string; latest?: boolean; bare?: boolean }) {
  const reduced = useReducedMotion();
  const lines = useMemo(
    () =>
      (view.log ?? [])
        .map((e) => ({ id: e.id, text: logLine(e, name), private: e.audience !== 'all' }))
        .filter((l): l is { id: number; text: string; private: boolean } => Boolean(l.text))
        .slice(-14)
        .reverse(),
    [view.log, name],
  );
  if (!lines.length) return bare ? <Text style={styles.muted}>{tx('Nothing has happened yet.')}</Text> : null;
  if (latest) {
    return (
      <Animated.View key={lines[0].id} entering={reduced ? undefined : FadeIn.duration(400)} style={[styles.panel, styles.latestBox]} testID="ww-latest">
        <Text style={[styles.latestText, lines[0].private && { color: DX.goldLight }]}>{(lines[0].private ? '◆ ' : '') + lines[0].text}</Text>
      </Animated.View>
    );
  }
  if (bare) {
    return (
      <View style={styles.block}>
        {lines.map((l, i) => (
          <Text key={l.id} style={[styles.logLine, styles.logOnSheet, l.private && { color: DX.gold }, i === 0 && { fontWeight: '700' }]}>
            {(l.private ? '◆ ' : '• ') + l.text}
          </Text>
        ))}
        <Text style={styles.small}>{tx('◆ only you see these lines')}</Text>
      </View>
    );
  }
  return (
    <Panel title={tx('What happened')}>
      {lines.map((l, i) => (
        <Animated.View key={l.id} entering={reduced ? undefined : FadeIn.duration(400)} style={i === 0 ? styles.latest : undefined}>
          <Text style={[styles.logLine, l.private && { color: DX.goldLight }, i === 0 && styles.latestText]}>{(l.private ? '◆ ' : '• ') + l.text}</Text>
        </Animated.View>
      ))}
      <Text style={styles.small}>{tx('◆ only you see these lines')}</Text>
    </Panel>
  );
}

// ───────── Chat (the table by day, the pack at night, the dead) ─────────
function Chat({ room, view, messages, me, name, bare }: { room: Room; view: WwView; messages: GameMessage[]; me: string; name: (s?: number) => string; bare?: boolean }) {
  const [text, setText] = useState('');
  const alive = view.me?.alive ?? false;
  const night = view.phase === 'night' || view.phase === 'witch';
  const ended = view.phase === 'ended';
  const channel: 'all' | 'wolves' | 'dead' = ended ? 'all' : !alive ? 'dead' : night && view.me?.pack ? 'wolves' : 'all';
  const canWrite = ended || !alive || (night ? Boolean(view.me?.pack) : true);
  // What I just sent shows at once, until the server's copy arrives (the live feed can be a moment late).
  const [sent, setSent] = useState<GameMessage[]>([]);
  const arrived = (o: GameMessage) => messages.some((m) => m.user_id === me && m.body === o.body && Date.parse(m.created_at) >= Date.parse(o.created_at) - 5000);
  const shown = [...messages, ...sent.filter((o) => !arrived(o))].filter((m) => (m.channel ?? 'all') === channel).slice(-40);
  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    wwSay(room.id, body, channel)
      .then(() => setSent((list) => [...list.slice(-5), { id: -Date.now(), room_id: room.id, user_id: me, kind: 'chat', body, data: null, created_at: new Date().toISOString(), channel, seat: view.me?.seat ?? null }]))
      .catch((e) => {
        setText(body);
        fail(e);
      });
  };
  const nameOf = (m: GameMessage) => (m.seat !== null && m.seat !== undefined ? name(m.seat) : tx('A member'));
  const title =
    channel === 'wolves'
      ? view.mode === 'dubai'
        ? tx('Escrocs’ chat (only they read it)')
        : tx('Pack chat (only werewolves read it)')
      : channel === 'dead'
        ? tx('Chat of the dead')
        : tx('Village chat');
  const rows = (
    <>
      {shown.length === 0 ? <Text style={styles.small}>{tx('No message yet.')}</Text> : null}
      {shown.map((m) => (
        <View key={m.id} style={styles.msgRow}>
          {m.user_id ? (
            <Avatar name={nameOf(m)} hue={0} userId={m.user_id} size={28} />
          ) : (
            <View style={styles.msgBot}>
              <Text style={styles.msgBotText}>{nameOf(m).slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.msg}>
            <Text style={styles.msgName}>
              {(m.kind === 'bot' ? `${tx('AI')} · ` : '') + nameOf(m) + (m.user_id === me ? ` (${tx('you')})` : '')}
              <Text style={styles.msgTime}>{`  ${clockOf(m.created_at)}`}</Text>
            </Text>
            <Text style={styles.body}>{m.kind === 'bot' ? botLine(m.body, m.id, m.data, name) : m.body}</Text>
          </View>
        </View>
      ))}
      {canWrite ? (
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.slice(0, 300))}
            placeholder={tx(channel === 'wolves' ? 'Whisper to the pack' : 'Talk to the village')}
            placeholderTextColor={DX.muted}
            style={styles.input}
            onSubmitEditing={send}
            // Sending keeps the keyboard up: the next message can be typed at once.
            submitBehavior="submit"
            returnKeyType="send"
            maxLength={300}
            accessibilityLabel={tx(channel === 'wolves' ? 'Whisper to the pack' : 'Talk to the village')}
            testID="ww-chat-input"
          />
          <PressableScale onPress={send} accessibilityRole="button" accessibilityLabel={tx('Send')} style={styles.sendBtn} testID="ww-chat-send">
            <Icon name="send" size={18} color={DX.goldLight} />
          </PressableScale>
        </View>
      ) : (
        <Text style={styles.small}>{tx('The village sleeps: no talking at night')}</Text>
      )}
    </>
  );
  if (bare) {
    return (
      <View style={styles.chatSheet}>
        <Text style={styles.msgName}>{title}</Text>
        {rows}
      </View>
    );
  }
  return <Panel title={title}>{rows}</Panel>;
}

/** 21:04, in the phone's own clock. */
const clockOf = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderColor: 'rgba(226,182,83,0.35)', backgroundColor: '#0B0907' },
  topRound: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(226,182,83,0.5)' },
  topCopy: { flex: 1, alignItems: 'center', gap: 1 },
  topTitle: { color: DX.goldLight, fontSize: 16, letterSpacing: 2 },
  topSub: { color: DX.ivory, fontSize: 13, fontWeight: '700' },
  topPhase: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topLeave: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  topLeaveText: { color: DX.redLight, fontSize: 14, fontWeight: '700' },
  topSpacer: { width: 44 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  tab: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(226,182,83,0.35)', backgroundColor: 'rgba(11,9,7,0.6)', paddingHorizontal: 6 },
  tabOn: { borderColor: DX.gold, backgroundColor: 'rgba(142,27,34,0.6)' },
  tabText: { color: DX.gold, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  tabTextOn: { color: DX.goldLight },
  reason: { color: DX.goldLight, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  waiting: { minHeight: 50, borderRadius: 14, borderWidth: 1.2, borderColor: DX.goldDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(11,9,7,0.6)' },
  waitingText: { color: DX.muted, fontSize: 15, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(226,182,83,0.4)', backgroundColor: 'rgba(21,16,12,0.9)' },
  chipLabel: { color: DX.ivory, fontSize: 12.5, fontWeight: '700' },
  seats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seat: { alignItems: 'center', gap: 2 },
  seatFace: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: DX.goldDark },
  seatHost: { borderColor: DX.goldLight },
  seatSpeaking: { borderColor: '#BFE3FF', borderWidth: 3 },
  seatFree: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.2, borderStyle: 'dashed', borderColor: 'rgba(226,182,83,0.3)' },
  seatName: { color: DX.ivory, fontSize: 12, fontWeight: '700', maxWidth: '100%' },
  seatRole: { color: DX.gold, fontSize: 10.5, maxWidth: '100%' },
  fold: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.2, borderColor: DX.goldDark, backgroundColor: 'rgba(21,16,12,0.96)' },
  foldText: { color: DX.goldLight, fontSize: 15 },
  // Panels keep the game's dark ground whatever the app's theme: the game's light text stays readable.
  sheetBody: { marginHorizontal: 16, marginBottom: 20, padding: 14, gap: 12, borderRadius: 16, backgroundColor: '#15100C', borderWidth: 1, borderColor: DX.goldDark },
  latestBox: { borderColor: DX.gold, paddingVertical: 10 },
  logOnSheet: { fontSize: 14, lineHeight: 21 },
  chatSheet: { gap: 10 },
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  msgBot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A1F14', borderWidth: 1, borderColor: DX.goldDark },
  msgBotText: { color: DX.goldLight, fontSize: 12, fontWeight: '800' },
  msgTime: { color: DX.muted, fontSize: 11, fontWeight: '400' },
  scroll: { padding: 16, gap: 14 },
  dock: { borderTopWidth: 1.5, borderColor: DX.gold, backgroundColor: '#15100C', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } },
  dockInner: { paddingHorizontal: 16, paddingTop: 12 },
  actions: { gap: 10 },
  block: { gap: 14 },
  panel: { borderWidth: 1.5, borderColor: DX.goldDark, borderRadius: 16, backgroundColor: 'rgba(21,16,12,0.96)', padding: 14, gap: 10 },
  panelAccent: { borderColor: DX.gold, shadowColor: DX.gold, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  panelTitle: { color: DX.goldLight, fontSize: 16, letterSpacing: 0.5 },
  body: { color: DX.ivory, fontSize: 14, lineHeight: 20 },
  muted: { color: DX.muted, fontSize: 14 },
  small: { color: DX.muted, fontSize: 12 },
  waitText: { color: DX.ivory, fontSize: 15, textAlign: 'center' },
  alert: { color: DX.redLight, fontSize: 15, fontWeight: '800' },
  gold: { minHeight: 50, borderRadius: 14, borderWidth: 1.5, borderColor: DX.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  goldText: { color: DX.goldLight, fontSize: 16, letterSpacing: 0.5 },
  ghost: { minHeight: 42, borderRadius: 12, borderWidth: 1.2, borderColor: DX.goldDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, backgroundColor: 'rgba(11,9,7,0.6)' },
  ghostText: { color: DX.goldLight, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  lobbyHero: { height: 190, borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderColor: DX.gold, justifyContent: 'flex-end', padding: 16, gap: 4 },
  lobbyMode: { color: DX.gold, fontSize: 13, letterSpacing: 1.5 },
  lobbyTitle: { color: DX.goldLight, fontSize: 18, lineHeight: 24 },
  lobbyLine: { color: DX.ivory, fontSize: 13 },
  codeBox: { alignItems: 'center', gap: 10 },
  codeText: { color: DX.goldLight, fontSize: 32, letterSpacing: 6 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personName: { flex: 1, color: DX.ivory, fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: DX.goldDark, borderRadius: 18, paddingRight: 10, backgroundColor: DX.black, overflow: 'hidden' },
  chipFace: { width: 30, height: 30, borderRadius: 15 },
  chipText: { color: DX.ivory, fontSize: 12.5, fontWeight: '700' },
  option: { gap: 8 },
  sending: { opacity: 0.55 },
  optionTitle: { color: DX.ivory, fontSize: 15, fontWeight: '800' },
  done: { color: '#7BD89B', fontSize: 13, fontWeight: '700' },
  target: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: DX.goldDark, backgroundColor: 'rgba(11,9,7,0.7)' },
  targetOn: { borderColor: DX.gold, backgroundColor: DX.red },
  targetText: { color: DX.ivory, fontSize: 14, fontWeight: '700' },
  clock: { color: DX.goldLight, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  know: { color: DX.ivory, fontSize: 12.5, lineHeight: 17 },
  latest: { borderLeftWidth: 3, borderLeftColor: DX.gold, paddingLeft: 8 },
  latestText: { color: DX.goldLight, fontSize: 14.5, fontWeight: '700' },
  logLine: { color: DX.muted, fontSize: 13, lineHeight: 19 },
  msg: { gap: 2, flex: 1 },
  msgName: { color: DX.gold, fontSize: 12, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.2, borderColor: DX.goldDark, borderRadius: 24, paddingLeft: 14, paddingRight: 4, minHeight: 48, backgroundColor: DX.black },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, color: DX.ivory },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DX.red, borderWidth: 1, borderColor: DX.gold, alignItems: 'center', justifyContent: 'center' },
});
