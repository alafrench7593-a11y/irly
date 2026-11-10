import { useLocalSearchParams, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
import { createRoom, joinByCode, kickPlayer, leaveRoom, moveToken, rollDie, sayInRoom, startRoom, useGamesPresence, useRoom, type GameMessage, type LudoState, type Room } from '@/features/games/api';
import { LudoBoard } from '@/features/games/ludo/Board';
import { WerewolfRoom } from '@/features/games/werewolf/WerewolfRoom';
import { legalTokens, LUDO_COLORS, LUDO_COLOR_NAMES } from '@/features/games/ludo/geometry';
import { blockUser } from '@/features/moderation/moderation';
import { openReport } from '@/features/moderation/reportStore';
import { t as tx } from '@/i18n';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** A crash here shows Try again and a way home, not a blank screen (components/layout/ErrorScreen). */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorScreen {...props} where="game" />;
}

const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');

/**
 * One table: the waiting room (players, code to share, Start for the host),
 * then the board (the server's die and moves, 30 s per action), the chat,
 * and at the end the players, to stay in touch (never an automatic follow).
 */
export default function GameRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const uid = useAccount()?.userId;
  const { room, missing, messages, reload, skew } = useRoom(id);
  useGamesPresence(id);

  if (!uid) {
    return (
      <View style={[styles.center, { backgroundColor: t.c.bg, paddingTop: insets.top }]}>
        <Button label="Sign in" onPress={() => router.push('/account')} />
      </View>
    );
  }
  if (missing) {
    return (
      <View style={[styles.center, { backgroundColor: t.c.bg, paddingTop: insets.top }]}>
        <Text tone="secondary">This game no longer exists</Text>
        <Button label="IRLY Games" onPress={() => router.replace('/games')} />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: room?.game === 'werewolf' ? '#0B0907' : t.c.bg }]}>
      <Header room={room} me={uid} onBack={() => (router.canGoBack() ? router.back() : router.replace('/games'))} />
      {!room ? (
        <View style={styles.center}>
          <Text tone="tertiary">Loading…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space[4] }]} keyboardShouldPersistTaps="handled">
          {room.game === 'werewolf' ? (
            <>
              {room.status === 'abandoned' ? <End room={room} me={uid} /> : <WerewolfRoom room={room} me={uid} messages={messages} />}
              {/* Before the start, the table talks in the shared chat; in the game, the Loup-Garou chat follows the night. */}
              {room.status === 'waiting' && room.kind !== 'irl' ? <Chat room={room} me={uid} messages={messages} /> : null}
            </>
          ) : (
            <>
              {room.status === 'waiting' ? <Lobby room={room} me={uid} onChanged={reload} /> : null}
              {room.status === 'playing' ? <Play room={room} me={uid} skew={skew} onChanged={reload} /> : null}
              {room.status === 'finished' || room.status === 'abandoned' ? <End room={room} me={uid} /> : null}
              <Chat room={room} me={uid} messages={messages} />
            </>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function Header({ room, me, onBack }: { room: Room | null; me: string; onBack: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const mine = room?.people.some((p) => p.id === me && !p.left);
  const leave = () => {
    if (!room) return;
    const running = room.status === 'playing';
    Alert.alert(tx(running ? 'Leave the game?' : 'Leave the table?'), running ? tx('You will be out of this game.') : undefined, [
      { text: tx('Stay'), style: 'cancel' },
      { text: tx('Leave'), style: 'destructive', onPress: () => leaveRoom(room.id).then(onBack).catch(fail) },
    ]);
  };
  return (
    <View style={[styles.header, { paddingTop: insets.top + space[2], borderColor: t.c.line }]}>
      <IconButton icon="chevronLeft" label="Back" onPress={onBack} />
      <View style={{ flex: 1 }}>
        <Text variant="titleS" numberOfLines={1} raw>
          {room?.title ?? (room?.game === 'werewolf' ? tx(room.kind === 'training' ? 'Training' : 'Loup-Garou') : tx('Ludo'))}
        </Text>
        {room ? (
          <Text variant="caption" tone="secondary" raw>
            {room.kind === 'training'
              ? tx('Against {n} AI players', { n: room.max - 1 })
              : [room.visibility === 'private' ? tx('Private') : tx('Public'), room.lang === 'fr' ? 'Français' : 'English', tx('{n}/{max} players', { n: room.players, max: room.max })].join(' · ')}
          </Text>
        ) : null}
      </View>
      {mine && room && (room.status === 'waiting' || room.status === 'playing') ? <Button label="Leave" size="sm" variant="ghost" onPress={leave} /> : null}
    </View>
  );
}

// ───────── Waiting room ─────────
function Lobby({ room, me, onChanged }: { room: Room; me: string; onChanged: () => void }) {
  const t = useTheme();
  const host = room.host_id === me;
  const present = room.people.filter((p) => !p.left);
  const share = () => {
    const text = room.code ? tx('Join my Ludo game on IRLY with the code {code}', { code: room.code }) : tx('Join my Ludo game on IRLY');
    Share.share({ message: text }).catch(() => undefined);
  };
  return (
    <View style={styles.block}>
      <Text variant="titleM">Waiting for players</Text>
      <Text tone="secondary" raw>
        {tx('{n} of {max} seats taken. The host starts when everyone is here (2 players at least).', { n: present.length, max: room.max })}
      </Text>
      {room.code ? (
        <PressableScale onPress={share} accessibilityRole="button" accessibilityLabel={tx('Share the code')} style={[styles.code, { borderColor: t.c.lineStrong }]}>
          <Text variant="caption" tone="secondary">
            Code of this private game
          </Text>
          <Text style={styles.codeText} raw>
            {room.code}
          </Text>
          <Text variant="caption" tone="secondary">
            Tap to share
          </Text>
        </PressableScale>
      ) : null}
      {Array.from({ length: room.max }).map((_, seat) => {
        const p = present.find((x) => x.seat === seat);
        return (
          <View key={seat} style={[styles.seat, { borderColor: t.c.line }]}>
            {p ? <Avatar name={p.name ?? '?'} hue={0} userId={p.id} size={40} /> : <View style={[styles.emptySeat, { borderColor: t.c.lineStrong }]} />}
            <View style={{ flex: 1 }}>
              <Text variant="titleS" raw tone={p ? 'primary' : 'tertiary'}>
                {p ? (p.name ?? tx('A member')) + (p.id === me ? ` (${tx('you')})` : '') : tx('Free seat')}
              </Text>
              {p && p.id === room.host_id ? (
                <Text variant="caption" tone="secondary">
                  Host
                </Text>
              ) : null}
            </View>
            {p && p.id !== me ? <PlayerMenu room={room} person={p} canRemove={host} onChanged={onChanged} /> : null}
          </View>
        );
      })}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button label="Invite" icon="share" variant="secondary" onPress={share} full />
        </View>
        {host ? (
          <View style={{ flex: 1 }}>
            <Button label="Start" icon="play" disabled={present.length < 2} onPress={() => startRoom(room.id).then(onChanged).catch(fail)} full />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PlayerMenu({ room, person, canRemove, onChanged }: { room: Room; person: Room['people'][number]; canRemove: boolean; onChanged: () => void }) {
  const open = () => {
    const name = person.name ?? tx('A member');
    const actions: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: tx('Report'), onPress: () => openReport({ kind: 'profile', userId: person.id }, name) },
      {
        text: tx('Block'),
        style: 'destructive',
        onPress: () =>
          blockUser(person.id)
            .then(() => toast(tx('{name} is blocked', { name }), 'check'))
            .catch(fail),
      },
    ];
    if (canRemove && room.status === 'waiting') {
      actions.unshift({ text: tx('Remove from the table'), style: 'destructive', onPress: () => kickPlayer(room.id, person.id).then(onChanged).catch(fail) });
    }
    actions.push({ text: tx('Cancel'), style: 'cancel' });
    Alert.alert(name, undefined, actions);
  };
  return <IconButton icon="more" label="More" onPress={open} />;
}

// ───────── Playing ─────────
function Play({ room, me, skew, onChanged }: { room: Room; me: string; skew: number; onChanged: () => void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const s = room.state as LudoState;
  const meIdx = s.players.indexOf(me);
  const myTurn = meIdx >= 0 && s.turn === meIdx && !s.out[meIdx];
  const movable = myTurn && s.die ? legalTokens(s.tokens[meIdx], s.die) : [];
  const [busy, setBusy] = useState(false);
  const size = Math.min(width - space.gutter * 2, 460);
  const turnPerson = room.people.find((p) => p.id === s.players[s.turn]);
  const prevTurn = useRef(s.turn);
  useEffect(() => {
    if (myTurn && prevTurn.current !== s.turn) haptic('press');
    prevTurn.current = s.turn;
  }, [myTurn, s.turn]);

  const act = (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    fn()
      .then(onChanged)
      .catch(fail)
      .finally(() => setBusy(false));
  };
  return (
    <View style={styles.block}>
      <View style={styles.players}>
        {s.players.map((pid, idx) => {
          const p = room.people.find((x) => x.id === pid);
          const home = s.tokens[idx].filter((x) => x === 56).length;
          return (
            <View key={pid} style={[styles.chip, { borderColor: idx === s.turn ? LUDO_COLORS[s.colors[idx]] : t.c.line, opacity: s.out[idx] ? 0.4 : 1 }]}>
              <View style={[styles.colorDot, { backgroundColor: LUDO_COLORS[s.colors[idx]] }]} />
              <Text variant="caption" numberOfLines={1} raw style={{ maxWidth: 90 }}>
                {pid === me ? tx('You') : (p?.name ?? tx('A member'))}
              </Text>
              <Text variant="caption" tone="secondary" raw>
                {`${home}/4`}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.boardWrap}>
        <LudoBoard state={s} size={size} movable={movable} me={meIdx} onMove={(k) => act(() => moveToken(room.id, k))} />
      </View>
      <View style={styles.turnRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleS" raw>
            {myTurn ? (s.die ? (movable.length ? tx('Tap a glowing token') : tx('No move: passing…')) : tx('Your turn: roll the die')) : tx("{name}'s turn", { name: turnPerson?.name ?? tx('A member') })}
          </Text>
          <Countdown deadline={room.deadline} skew={skew} />
        </View>
        <Die value={s.die ?? s.last?.roll ?? null} color={LUDO_COLORS[s.colors[s.turn]]} canRoll={myTurn && !s.die && !busy} onRoll={() => act(() => rollDie(room.id))} />
      </View>
      {meIdx >= 0 ? (
        <Text variant="caption" tone="tertiary" raw>
          {tx('You play {color}. A 6 brings a token out and plays again. Stars and start squares are safe.', { color: tx(LUDO_COLOR_NAMES[s.colors[meIdx]]) })}
        </Text>
      ) : null}
    </View>
  );
}

function Countdown({ deadline, skew }: { deadline: string | null; skew: number }) {
  const now = useNow(500);
  if (!deadline) return null;
  const left = Math.max(0, Math.ceil((Date.parse(deadline) - (now + skew)) / 1000));
  return (
    <Text variant="caption" tone={left <= 5 ? 'live' : 'secondary'} raw>
      {tx('{n} s left', { n: left })}
    </Text>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 1],
    [0, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
};

function Die({ value, color, canRoll, onRoll }: { value: number | null; color: string; canRoll: boolean; onRoll: () => void }) {
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  const shown = useRef(value);
  useEffect(() => {
    if (value !== shown.current && value && !reduced) {
      spin.set(0);
      spin.set(withSequence(withTiming(1, { duration: 380 }), withTiming(0, { duration: 0 })));
    }
    shown.current = value;
  }, [value, spin, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }, { scale: 1 + spin.get() * 0.15 }] }));
  const face = (
    <Animated.View style={[styles.die, { borderColor: color, shadowColor: color, opacity: canRoll || value ? 1 : 0.5 }, canRoll && styles.dieReady, style]}>
      {value ? PIPS[value].map(([x, y], i) => <View key={i} style={[styles.pip, { left: 9 + x * 15, top: 9 + y * 15 }]} />) : null}
      {!value && canRoll ? <Icon name="repeat" size={22} color="#111" /> : null}
    </Animated.View>
  );
  // Not this player's roll: the die is only shown (a disabled button would be dimmed).
  if (!canRoll) {
    return (
      <View accessible accessibilityLabel={tx('Die: {n}', { n: value ?? '–' })}>
        {face}
      </View>
    );
  }
  return (
    <PressableScale onPress={onRoll} haptic="press" accessibilityRole="button" accessibilityLabel={tx('Roll the die')}>
      {face}
    </PressableScale>
  );
}

// ───────── End ─────────
function End({ room, me }: { room: Room; me: string }) {
  const t = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const others = room.people.filter((p) => p.id !== me && !p.blocked);
  const winner = room.people.find((p) => p.id === room.winner_id);
  const rematch = () => {
    if (busy) return;
    setBusy(true);
    createRoom(room.space === 'irly_girl' ? 'girl' : 'mixte', { visibility: 'private', max: room.max, lang: room.lang })
      .then(async (r) => {
        // The new code in this table's chat: the others join with one tap.
        if (r.code) await sayInRoom(room.id, `🎲 ${tx('Rematch')} → ${r.code}`).catch(() => undefined);
        router.replace(`/games/${r.id}`);
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  if (room.status === 'abandoned') {
    return (
      <View style={styles.block}>
        <Text variant="titleM">This table closed</Text>
        <Button label="IRLY Games" onPress={() => router.replace('/games')} />
      </View>
    );
  }
  return (
    <View style={styles.block}>
      <Text variant="titleL" raw>
        {room.winner_id === me ? `🏆 ${tx('You won!')}` : `🎉 ${tx('Well played!')}`}
      </Text>
      {winner && winner.id !== me ? (
        <Text tone="secondary" raw>
          {tx('{name} won this game.', { name: winner.name ?? tx('A member') })}
        </Text>
      ) : null}
      {others.length ? (
        <>
          <Text variant="titleS">Want to stay in touch?</Text>
          {others.map((p) => (
            <View key={p.id} style={[styles.seat, { borderColor: t.c.line }]}>
              <Avatar name={p.name ?? '?'} hue={0} userId={p.id} size={44} />
              <View style={{ flex: 1 }}>
                <Text variant="titleS" raw>
                  {p.name ?? tx('A member')}
                </Text>
                {p.place ? (
                  <Text variant="caption" tone="secondary" raw>
                    {tx('Place {n}', { n: p.place })}
                  </Text>
                ) : null}
              </View>
              <Button label="See profile" size="sm" variant="secondary" onPress={() => router.push(`/person/${p.id}`)} />
            </View>
          ))}
        </>
      ) : null}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button label="Rematch" icon="repeat" disabled={busy} onPress={rematch} full />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="IRLY Games" variant="secondary" onPress={() => router.replace('/games')} full />
        </View>
      </View>
    </View>
  );
}

// ───────── Chat ─────────
const REMATCH = /→ ([A-Z2-9]{6})$/;

function systemLine(m: GameMessage, names: Map<string, string>): string {
  const n = (id?: string) => (id ? (names.get(id) ?? tx('A member')) : tx('A member'));
  // Ludo system lines carry member ids (strings).
  const d = (m.data ?? {}) as Record<string, string | undefined>;
  switch (m.body) {
    case 'joined':
      return tx('{name} joined', { name: n(d.user) });
    case 'left':
      return tx('{name} left', { name: n(d.user) });
    case 'start':
      return tx('The game starts. Roll a 6 to bring a token out!');
    case 'captured':
      return tx("{name} captured {other}'s token", { name: n(d.by), other: n(d.of) });
    case 'three_sixes':
      return tx('{name} rolled three 6 in a row: turn over', { name: n(d.user) });
    case 'away':
      return tx('{name} was away too long and left the game', { name: n(d.user) });
    case 'won':
      return tx('{name} wins!', { name: n(d.user) });
    default:
      return '';
  }
}

function Chat({ room, me, messages }: { room: Room; me: string; messages: GameMessage[] }) {
  const t = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const names = useMemo(() => new Map(room.people.map((p) => [p.id, p.id === me ? tx('You') : (p.name ?? tx('A member'))])), [room.people, me]);
  const inRoom = room.people.some((p) => p.id === me && !p.left);
  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    sayInRoom(room.id, body).catch((e) => {
      setText(body);
      fail(e);
    });
  };
  const join = (code: string) =>
    joinByCode(code)
      .then((id) => router.replace(`/games/${id}`))
      .catch(fail);
  return (
    <View style={[styles.chat, { borderColor: t.c.line }]}>
      <Text variant="label" tone="secondary">
        Table chat
      </Text>
      {messages.length === 0 ? (
        <Text variant="caption" tone="tertiary">
          Say hello 👋
        </Text>
      ) : null}
      {messages.slice(-60).map((m) => {
        if (m.kind === 'system') {
          const line = systemLine(m, names);
          return line ? (
            <Text key={m.id} variant="caption" tone="tertiary" raw style={styles.system}>
              {line}
            </Text>
          ) : null;
        }
        const code = m.body.match(REMATCH)?.[1];
        return (
          <View key={m.id} style={styles.msg}>
            <Text variant="caption" tone="secondary" raw>
              {names.get(m.user_id ?? '') ?? tx('A member')}
            </Text>
            <Text raw>{m.body}</Text>
            {code && m.user_id !== me ? <Button label="Join the rematch" size="sm" variant="secondary" onPress={() => join(code)} /> : null}
          </View>
        );
      })}
      {inRoom ? (
        <View style={[styles.inputRow, { borderColor: t.c.lineStrong, backgroundColor: t.c.surface }]}>
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.slice(0, 300))}
            placeholder={tx('Message the table')}
            placeholderTextColor={t.c.textTertiary}
            style={[styles.input, { color: t.c.text }]}
            onSubmitEditing={send}
            returnKeyType="send"
            maxLength={300}
          />
          <IconButton icon="send" label="Send" onPress={send} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[5], padding: space.gutter },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingBottom: space[3], borderBottomWidth: StyleSheet.hairlineWidth },
  scroll: { padding: space.gutter, gap: space[6] },
  block: { gap: space[4] },
  row: { flexDirection: 'row', gap: space[3] },
  code: { alignItems: 'center', padding: space[5], borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', gap: space[2] },
  codeText: { fontSize: 34, lineHeight: 40, letterSpacing: 6, fontWeight: '800' },
  seat: { flexDirection: 'row', alignItems: 'center', gap: space[4], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth },
  emptySeat: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed' },
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.pill, borderWidth: 2 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  boardWrap: { alignItems: 'center' },
  turnRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  die: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  dieReady: { shadowOpacity: 0.9, shadowRadius: 14 },
  pip: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#111111' },
  chat: { gap: space[3], paddingTop: space[4], borderTopWidth: StyleSheet.hairlineWidth },
  system: { textAlign: 'center' },
  msg: { gap: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], borderWidth: 1, borderRadius: radius.pill, paddingLeft: space[4], paddingRight: space[2], minHeight: 46 },
  input: { flex: 1, fontSize: 16, paddingVertical: space[3] },
});
