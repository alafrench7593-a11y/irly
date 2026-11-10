import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { Alert, Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { blockUser } from '@/features/moderation/moderation';
import { openReport } from '@/features/moderation/reportStore';
import { t as tx } from '@/i18n';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { startRoom, type GameMessage, type Room } from '../api';
import { ACTION_TITLE, CARD_ORDER, campName, cardOf, DUBAI_ORDER, NO_TARGET, SPECIALS, wolvesFor, type CardId, type DubaiCardId } from './cards';
import { botLine, logLine } from './lines';
import { DubaiResult } from './dubai/Result';
import { DubaiMyCard } from './dubai/RoomParts';
import { Stage } from './dubai/Stage';
import { DX } from './dubai/theme';
import { Qr } from './Qr';
import { useWwView, wwAct, wwSay, wwSetComposition, wwSkipDay, wwTraining, type WwOption, type WwPlayer, type WwView } from './api';

const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');
const JOIN_URL = 'https://getirly.com/app/games/join?code=';

/**
 * A Loup-Garou table: the waiting room (code and QR code, the deck), then the
 * game as this player sees it (her card, the night or the day, what she may
 * do, the table, the log, the chat of her channel), then the result with
 * every card revealed. The server decides everything.
 */
export function WerewolfRoom({ room, me, messages }: { room: Room; me: string; messages: GameMessage[] }) {
  const { view, failed, reload, skew } = useWwView(room.id, room);
  if (!view) {
    return (
      <Text tone="tertiary" raw>
        {failed ? tx(failed) : tx('Loading…')}
      </Text>
    );
  }
  if (view.phase === 'lobby') return <Lobby room={room} me={me} view={view} onChanged={reload} />;
  return <Game room={room} me={me} view={view} messages={messages} skew={skew} onChanged={reload} />;
}

// ───────── Waiting room ─────────
function Lobby({ room, me, view, onChanged }: { room: Room; me: string; view: WwView; onChanged: () => void }) {
  const t = useTheme();
  const host = room.host_id === me;
  const present = room.people.filter((p) => !p.left);
  const irl = room.kind === 'irl';
  const share = () => {
    const text = room.code ? tx('Join my Loup-Garou game on IRLY with the code {code}: {url}', { code: room.code, url: JOIN_URL + room.code }) : tx('Join my Loup-Garou game on IRLY');
    Share.share({ message: text }).catch(() => undefined);
  };
  return (
    <View style={styles.block}>
      <Text variant="titleM">{irl ? 'In person: everyone joins with their phone' : 'Waiting for the village'}</Text>
      <Text tone="secondary" raw>
        {tx('{n} players here. The host starts at 6 or more (up to {max}).', { n: present.length, max: room.max })}
      </Text>
      <Text variant="caption" tone="tertiary">
        Unranked game
      </Text>
      {room.code ? (
        <View style={[styles.codeBox, { borderColor: t.c.lineStrong }]}>
          {irl ? <Qr value={JOIN_URL + room.code} size={180} /> : null}
          <Text variant="caption" tone="secondary">
            {irl ? 'Scan, or type the code in IRLY Games' : 'Code of this private game'}
          </Text>
          <Text style={styles.codeText} raw>
            {room.code}
          </Text>
          <Button label="Share" icon="share" size="sm" variant="secondary" onPress={share} />
        </View>
      ) : null}
      <Deck view={view} editable={host} roomId={room.id} onChanged={onChanged} />
      {present.map((p) => (
        <View key={p.id} style={[styles.row, { borderColor: t.c.line }]}>
          <Avatar name={p.name ?? '?'} hue={0} userId={p.id} size={38} />
          <Text variant="titleS" style={{ flex: 1 }} raw>
            {(p.name ?? tx('A member')) + (p.id === me ? ` (${tx('you')})` : '') + (p.id === room.host_id ? ` · ${tx('Host')}` : '')}
          </Text>
        </View>
      ))}
      {host ? <Button label="Start the game" icon="play" disabled={present.length < 6} onPress={() => startRoom(room.id).then(onChanged).catch(fail)} full /> : null}
    </View>
  );
}

/** The deck the game will use; the host adjusts the werewolves and the special cards (the server checks). */
function Deck({ view, editable, roomId, onChanged }: { view: WwView; editable: boolean; roomId: string; onChanged: () => void }) {
  const t = useTheme();
  const comp = view.composition;
  const players = Math.max(view.present ?? 6, 6);
  const save = (next: Record<string, number>) => {
    const specials = SPECIALS.reduce((n, id) => n + (next[id] ?? 0), 0);
    const wolves = next.werewolf ?? 1;
    const villagers = players + (next.thief ? 2 : 0) - specials - wolves;
    if (villagers < 0) return toast(tx('Not enough players for these cards'), 'x', 'live');
    void wwSetComposition(roomId, { ...next, villager: villagers }).then(onChanged).catch(fail);
  };
  return (
    <View style={[styles.deck, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <Text variant="label" tone="secondary" raw>
        {tx('The deck for {n} players{custom}', { n: players, custom: view.custom ? ` · ${tx('set by the host')}` : '' })}
      </Text>
      <View style={styles.cards}>
        {(view.mode === 'dubai' ? DUBAI_ORDER : CARD_ORDER).filter((id) => (comp[id] ?? 0) > 0).map((id) => (
          <View key={id} style={[styles.cardChip, { borderColor: t.c.line }]}>
            <Text raw>{`${cardOf(id).emoji} ${tx(cardOf(id).name)}${(comp[id] ?? 0) > 1 ? ` ×${comp[id]}` : ''}`}</Text>
          </View>
        ))}
      </View>
      {editable && view.mode !== 'dubai' ? (
        <>
          <View style={styles.cards}>
            <Button label="− Werewolf" size="sm" variant="secondary" disabled={(comp.werewolf ?? 1) <= 1} onPress={() => save({ ...comp, werewolf: (comp.werewolf ?? 1) - 1 })} />
            <Button label="+ Werewolf" size="sm" variant="secondary" disabled={((comp.werewolf ?? 1) + 1) * 2 >= players} onPress={() => save({ ...comp, werewolf: (comp.werewolf ?? 1) + 1 })} />
          </View>
          <View style={styles.cards}>
            {SPECIALS.map((id) => {
              const on = (comp[id] ?? 0) > 0;
              return (
                <PressableScale key={id} onPress={() => save({ ...comp, [id]: on ? 0 : 1 })} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={tx(cardOf(id).name)}>
                  <View style={[styles.cardChip, { borderColor: on ? t.c.text : t.c.line, opacity: on ? 1 : 0.5 }]}>
                    <Text variant="caption" raw>{`${cardOf(id).emoji} ${tx(cardOf(id).name)}`}</Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
          <Text variant="caption" tone="tertiary" raw>
            {tx('Default: {n} werewolf(s) for {p} players. Villagers fill the other seats.', { n: wolvesFor(players), p: players })}
          </Text>
        </>
      ) : null}
    </View>
  );
}

// ───────── The game ─────────
function Game({ room, me, view, messages, skew, onChanged }: { room: Room; me: string; view: WwView; messages: GameMessage[]; skew: number; onChanged: () => void }) {
  const night = view.phase === 'night' || view.phase === 'witch';
  const ended = view.phase === 'ended';
  const players = view.players ?? [];
  const name = (s: number | undefined) => (s === undefined ? tx('someone') : (players.find((p) => p.seat === s)?.name ?? tx('someone')));
  const reduced = useReducedMotion();
  const dark = useSharedValue(night ? 1 : 0);
  useEffect(() => {
    dark.set(reduced ? (night ? 1 : 0) : withTiming(night ? 1 : 0, { duration: 900 }));
  }, [night, dark, reduced]);
  const sky = useAnimatedStyle(() => ({ opacity: dark.get() }));
  // Dubaï: the main choice of the moment is made on the table itself (vote, the Escrocs' victim, a power on someone).
  const stageOption =
    view.mode === 'dubai'
      ? ((view.options ?? []).find((o) => o.kind === 'vote' || o.kind === 'wolf') ?? (view.options ?? []).find((o) => o.targets.length > 0 && o.kind !== 'link' && o.kind !== 'steal'))
      : undefined;
  const stageChosen = stageOption ? ((view.mine ?? []).find((m) => m.kind === stageOption.kind)?.target ?? null) : null;
  const stageMarks = useMemo(() => {
    const out: Record<number, string> = {};
    if (view.mode !== 'dubai') return out;
    for (const e of view.log ?? []) {
      const s = typeof e.data.seat === 'number' ? (e.data.seat as number) : undefined;
      if (s === undefined || Number(e.data.day) !== view.day) continue;
      if (e.kind === 'vote_doubled') out[s] = tx('×2 vote');
      if (e.kind === 'immune') out[s] = tx('Immune');
    }
    if (view.pack_votes) for (const v of Object.values(view.pack_votes)) out[v] = `${(out[v] ? `${out[v]} ` : '')}●`;
    return out;
  }, [view.mode, view.log, view.day, view.pack_votes]);

  return (
    <View style={styles.block}>
      {view.mode === 'dubai' && ended ? null : view.mode === 'dubai' ? (
        <Stage
          phase={ended ? 'ended' : night ? 'night' : 'day'}
          title={
            ended
              ? tx('The game is over')
              : night
                ? tx('Night {n}', { n: view.night ?? 1 })
                : view.phase === 'day'
                  ? tx('Day {n}', { n: view.day ?? 1 })
                  : view.phase === 'revote'
                    ? tx('Second round')
                    : tx('Day {n} · vote', { n: view.day ?? 1 })
          }
          subtitle={ended ? undefined : night ? tx('Powers act in secret…') : view.phase === 'day' ? tx('Debate') : tx('Elimination vote')}
          clock={!ended ? <Clock deadline={view.deadline ?? null} skew={skew} color="#F7DE97" /> : undefined}
          players={players}
          mySeat={view.me?.seat}
          targets={stageOption && view.me?.alive ? stageOption.targets : []}
          chosen={stageChosen}
          marks={stageMarks}
          onPick={stageOption ? (seat) => wwAct(room.id, stageOption.kind, seat).then(onChanged).catch(fail) : undefined}
        />
      ) : (
      <View style={styles.skyWrap}>
        <LinearGradient colors={['#F6D365', '#FDA085']} style={StyleSheet.absoluteFill} />
        <Animated.View style={[StyleSheet.absoluteFill, sky]}>
          <LinearGradient colors={['#0B1026', '#2B1B4A']} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={styles.skyInner}>
          <Text style={styles.skyEmoji} raw>
            {ended ? '🏁' : night ? '🌕' : '☀️'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text variant="titleM" color={night ? '#FFFFFF' : '#1B1B1B'} raw>
              {ended
                ? tx('The game is over')
                : night
                  ? tx('Night {n}', { n: view.night ?? 1 })
                  : view.phase === 'day'
                    ? tx('Day {n} · discussion', { n: view.day ?? 1 })
                    : view.phase === 'revote'
                      ? tx('Second round')
                      : tx('Day {n} · vote', { n: view.day ?? 1 })}
            </Text>
            {!ended ? <Clock deadline={view.deadline ?? null} skew={skew} color={night ? '#D8D3FF' : '#3A2B1B'} /> : null}
          </View>
          {view.kind === 'training' ? (
            <View style={styles.badge}>
              <Text variant="caption" color="#FFFFFF" raw>
                {`🤖 ${tx('Unranked')}`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      )}

      {view.me && !(view.mode === 'dubai' && ended) ? <MyCard view={view} name={name} /> : null}
      {ended ? (
        view.mode === 'dubai' ? (
          <DubaiResult view={view} me={me} room={room} />
        ) : (
          <Result view={view} me={me} room={room} />
        )
      ) : (
        <Actions room={room} view={view} name={name} onChanged={onChanged} skip={stageOption?.kind} />
      )}
      {view.mode === 'dubai' ? null : <Table room={room} view={view} me={me} />}
      <View style={view.mode === 'dubai' ? styles.dxPanel : undefined}>
        <Log view={view} name={name} />
      </View>
      {room.kind !== 'irl' || ended ? (
        <View style={view.mode === 'dubai' ? styles.dxPanel : undefined}>
          <Chat room={room} view={view} messages={messages} me={me} name={name} />
        </View>
      ) : null}
      {room.kind === 'irl' && view.phase === 'day' && room.host_id === me ? (
        <Button label="Everyone has talked: vote" icon="arrowRight" onPress={() => wwSkipDay(room.id).then(onChanged).catch(fail)} full />
      ) : null}
    </View>
  );
}

function Clock({ deadline, skew, color }: { deadline: string | null; skew: number; color: string }) {
  const now = useNow(500);
  if (!deadline) return null;
  const left = Math.max(0, Math.ceil((Date.parse(deadline) - (now + skew)) / 1000));
  const m = Math.floor(left / 60);
  const s = left % 60;
  return (
    <Text variant="caption" color={color} raw>
      {`⏳ ${m}:${String(s).padStart(2, '0')}`}
    </Text>
  );
}

/** My card, face down until tapped (nobody looking over the shoulder), with what I know. */
const MyCard = memo(function MyCard({ view, name }: { view: WwView; name: (s?: number) => string }) {
  const t = useTheme();
  const me = view.me!;
  const card = cardOf(me.card);
  // Face down during the game (nobody looking over the shoulder), face up once it is over.
  const [shown, setShown] = useState(view.phase === 'ended');
  const flip = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    flip.set(reduced ? (shown ? 1 : 0) : withTiming(shown ? 1 : 0, { duration: 450 }));
  }, [shown, flip, reduced]);
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { rotateY: `${180 - flip.get() * 180}deg` }], opacity: flip.get() > 0.5 ? 1 : 0 }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { rotateY: `${-flip.get() * 180}deg` }], opacity: flip.get() > 0.5 ? 0 : 1 }));
  const wolves = card.camp === 'wolves';
  if (view.mode === 'dubai') {
    return (
      <DubaiMyCard id={me.card as DubaiCardId} startShown={view.phase === 'ended'}>
        {me.seduced && me.seduced.length ? <Text variant="caption" tone="secondary" align="center" raw>{tx('Seduced: {names}', { names: me.seduced.map(name).join(', ') })}</Text> : null}
        {me.pack && me.pack.length > 1 ? <Text variant="caption" tone="secondary" align="center" raw>{tx('Your accomplices: {names}', { names: me.pack.map(name).join(', ') })}</Text> : null}
        {me.lover !== null && me.lover !== undefined ? <Text variant="caption" tone="secondary" align="center" raw>{tx('In love with {name}', { name: name(me.lover) })}</Text> : null}
        {!me.alive ? <Text variant="caption" tone="live" align="center">You are dead: watch, and talk with the dead</Text> : null}
      </DubaiMyCard>
    );
  }
  return (
    <PressableScale onPress={() => setShown((v) => !v)} accessibilityRole="button" accessibilityLabel={shown ? tx('Hide my card') : tx('Show my card')}>
      <View style={styles.cardBox}>
        <Animated.View style={[styles.card, { backgroundColor: '#1B1430', borderColor: '#5B4A8A' }, back]}>
          <Text style={styles.cardEmoji} raw>
            🃏
          </Text>
          <Text color="#E9E4FF" variant="titleS">
            Tap to see your card
          </Text>
        </Animated.View>
        <Animated.View style={[styles.card, styles.cardFront, { backgroundColor: wolves ? '#3A0D12' : t.c.surface, borderColor: wolves ? '#C0392B' : t.c.lineStrong }, front]}>
          <Text style={styles.cardEmoji} raw>
            {card.emoji}
          </Text>
          <Text variant="titleM" color={wolves ? '#FFFFFF' : undefined} raw>
            {tx(card.name)}
          </Text>
          <Text variant="caption" color={wolves ? '#FFD6D6' : undefined} tone={wolves ? undefined : 'secondary'} align="center" raw>
            {tx(card.power)}
          </Text>
          <Text variant="caption" color={wolves ? '#FFD6D6' : undefined} tone={wolves ? undefined : 'tertiary'} align="center" raw>
            {`${tx(campName(card.camp, view.mode))} · ${tx(card.goal)}`}
          </Text>
          {me.seduced && me.seduced.length ? (
            <Text variant="caption" align="center" raw>
              {tx('Seduced: {names}', { names: me.seduced.map(name).join(', ') })}
            </Text>
          ) : null}
          {me.pack && me.pack.length > 1 ? (
            <Text variant="caption" color="#FFD6D6" align="center" raw>
              {tx('Your pack: {names}', { names: me.pack.map(name).join(', ') })}
            </Text>
          ) : null}
          {me.lover !== null && me.lover !== undefined ? (
            <Text variant="caption" align="center" raw>
              {tx('In love with {name} 💘', { name: name(me.lover) })}
            </Text>
          ) : null}
          {!me.alive ? (
            <Text variant="caption" tone="live" align="center">
              You are dead: watch, and talk with the dead
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </PressableScale>
  );
});

// ───────── What I may do now ─────────
function Actions({ room, view, name, onChanged, skip }: { room: Room; view: WwView; name: (s?: number) => string; onChanged: () => void; skip?: string }) {
  const all = view.options ?? [];
  const options = all.filter((o) => o.kind !== skip);
  const mine = view.mine ?? [];
  if (!view.me?.alive) return null;
  if (skip && !options.length) {
    return (
      <Text tone="secondary" align="center">
        {view.phase === 'vote' || view.phase === 'revote' ? 'Touch a player on the table to vote' : 'Touch a player on the table to choose'}
      </Text>
    );
  }
  if (!options.length) {
    return (
      <Text tone="secondary" align="center">
        {view.phase === 'night' || view.phase === 'witch' ? 'You sleep. The night goes on…' : 'Wait for the others…'}
      </Text>
    );
  }
  return (
    <View style={styles.block}>
      {view.phase === 'witch' && view.victim !== null && view.victim !== undefined ? (
        <Text variant="titleS" raw>
          {tx('The werewolves attacked {name}', { name: name(view.victim) })}
        </Text>
      ) : null}
      {options.map((o) => (
        <Option key={o.kind} room={room} view={view} option={o} done={mine.filter((m) => m.kind === o.kind)} name={name} onChanged={onChanged} />
      ))}
      {view.phase !== 'day' && !mine.length ? <Button label="Do nothing" variant="ghost" size="sm" onPress={() => wwAct(room.id, 'pass').then(onChanged).catch(fail)} /> : null}
      {mine.some((m) => m.kind === 'pass') ? (
        <Text variant="caption" tone="tertiary" align="center">
          You chose to do nothing
        </Text>
      ) : null}
    </View>
  );
}

function Option({ room, view, option, done, name, onChanged }: { room: Room; view: WwView; option: WwOption; done: { target: number | null; target2: number | null }[]; name: (s?: number) => string; onChanged: () => void }) {
  const t = useTheme();
  const [first, setFirst] = useState<number | null>(null);
  const send = (a?: number | null, b?: number | null) => {
    haptic('press');
    wwAct(room.id, option.kind, a, b).then(onChanged).catch(fail);
  };
  const chosen = done[0];
  const dx = view.mode === 'dubai';
  const label = (s: number) => name(s) + (view.pack_votes && option.kind === 'wolf' ? votesFor(view.pack_votes, s) : '');
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={[styles.option, dx ? styles.optionDx : { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <Text variant="titleS" color={dx ? DX.goldLight : undefined}>
        {ACTION_TITLE[option.kind] ?? option.kind}
      </Text>
      {chosen ? (
        <Text variant="caption" tone="positive" raw>
          {option.kind === 'link' ? tx('Chosen: {a} and {b}', { a: name(chosen.target ?? undefined), b: name(chosen.target2 ?? undefined) }) : chosen.target !== null && option.kind !== 'steal' ? tx('Chosen: {name}', { name: name(chosen.target) }) : tx('Done')}
        </Text>
      ) : null}
      {NO_TARGET.has(option.kind) ? (
        <Button label={option.kind === 'ready' ? 'Ready to vote' : option.kind === 'hint' ? 'Spy tonight' : 'Use my power'} size="sm" disabled={Boolean(chosen)} onPress={() => send()} />
      ) : option.kind === 'steal' ? (
        <View style={styles.targets}>
          {(option.cards ?? []).map((c, i) => (
            <Button key={i} label={`${cardOf(c).emoji} ${tx(cardOf(c).name)}`} size="sm" variant="secondary" onPress={() => send(i)} />
          ))}
          <Button label="Keep my card" size="sm" variant="ghost" onPress={() => send(-1)} />
        </View>
      ) : (
        <View style={styles.targets}>
          {option.targets.map((s) => {
            const on = chosen?.target === s || chosen?.target2 === s || first === s;
            return (
              <PressableScale
                key={s}
                onPress={() => {
                  if (option.kind !== 'link') return send(s);
                  if (first === null) return setFirst(s);
                  if (first === s) return setFirst(null);
                  send(first, s);
                  setFirst(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={name(s)}
              >
                <View
                  style={[
                    styles.target,
                    dx ? { borderColor: on ? DX.gold : DX.goldDark, backgroundColor: on ? DX.red : 'rgba(11,9,7,0.6)' } : { borderColor: on ? t.c.text : t.c.line, backgroundColor: on ? t.c.overlay : 'transparent' },
                  ]}
                >
                  <Text variant="caption" color={dx ? DX.ivory : undefined} raw>
                    {label(s)}
                  </Text>
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
  return n ? ` · 🐺×${n}` : '';
};

// ───────── The table ─────────
function Table({ room, view, me }: { room: Room; view: WwView; me: string }) {
  const t = useTheme();
  const showActed = view.phase === 'day' || view.phase === 'vote' || view.phase === 'revote';
  return (
    <View style={styles.grid}>
      {(view.players ?? []).map((p) => (
        <PlayerTile key={p.seat} p={p} room={room} me={me} acted={showActed && p.acted} lineColor={view.mode === 'dubai' ? DX.goldDark : t.c.line} />
      ))}
    </View>
  );
}

function PlayerTile({ p, room, me, acted, lineColor }: { p: WwPlayer; room: Room; me: string; acted: boolean; lineColor: string }) {
  const menu = () => {
    if (p.bot || !p.user_id || p.user_id === me) return;
    Alert.alert(p.name, undefined, [
      { text: tx('Report'), onPress: () => openReport({ kind: 'profile', userId: p.user_id! }, p.name) },
      { text: tx('Block'), style: 'destructive', onPress: () => blockUser(p.user_id!).then(() => toast(tx('{name} is blocked', { name: p.name }), 'check')).catch(fail) },
      { text: tx('Cancel'), style: 'cancel' },
    ]);
  };
  void room;
  return (
    <PressableScale onPress={menu} accessibilityRole="button" accessibilityLabel={p.name} style={[styles.tile, { borderColor: lineColor, opacity: p.alive ? 1 : 0.4 }]}>
      {p.bot ? (
        <View style={styles.botFace}>
          <Text raw>🤖</Text>
        </View>
      ) : (
        <Avatar name={p.name} hue={0} userId={p.user_id} size={36} />
      )}
      <Text variant="caption" numberOfLines={1} raw>
        {`${p.alive ? '' : '💀 '}${p.name}${p.user_id === me ? ` (${tx('you')})` : ''}`}
      </Text>
      {acted ? (
        <Text variant="caption" tone="positive">
          ✓
        </Text>
      ) : null}
    </PressableScale>
  );
}

// ───────── The log ─────────
function Log({ view, name }: { view: WwView; name: (s?: number) => string }) {
  const lines = useMemo(
    () =>
      (view.log ?? [])
        .map((e) => ({ id: e.id, text: logLine(e, name), private: e.audience !== 'all' }))
        .filter((l): l is { id: number; text: string; private: boolean } => Boolean(l.text))
        .slice(-14)
        .reverse(),
    [view.log, name],
  );
  return (
    <View style={styles.block}>
      <Text variant="label" tone="secondary">
        What happened
      </Text>
      {lines.map((l) => (
        <Animated.View key={l.id} entering={FadeIn.duration(400)}>
          <Text variant="caption" tone={l.private ? 'accent' : 'secondary'} raw>
            {(l.private ? '🔒 ' : '• ') + l.text}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

// ───────── Chat (the table by day, the pack at night, the dead) ─────────
function Chat({ room, view, messages, me, name }: { room: Room; view: WwView; messages: GameMessage[]; me: string; name: (s?: number) => string }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const alive = view.me?.alive ?? false;
  const night = view.phase === 'night' || view.phase === 'witch';
  const ended = view.phase === 'ended';
  const channel: 'all' | 'wolves' | 'dead' = ended ? 'all' : !alive ? 'dead' : night && view.me?.pack ? 'wolves' : 'all';
  const canWrite = ended || !alive || (night ? Boolean(view.me?.pack) : true);
  const shown = messages.filter((m) => (m.channel ?? 'all') === channel).slice(-40);
  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    wwSay(room.id, body, channel).catch((e) => {
      setText(body);
      fail(e);
    });
  };
  const nameOf = (m: GameMessage) => (m.seat !== null && m.seat !== undefined ? name(m.seat) : tx('A member'));
  return (
    <View style={[styles.chat, { borderColor: t.c.line }]}>
      <Text variant="label" tone="secondary">
        {channel === 'wolves'
          ? view.mode === 'dubai'
            ? 'Escrocs’ chat (only they read it)'
            : 'Pack chat (only werewolves read it)'
          : channel === 'dead'
            ? 'Chat of the dead'
            : 'Village chat'}
      </Text>
      {shown.map((m) => (
        <View key={m.id} style={styles.msg}>
          <Text variant="caption" tone="secondary" raw>
            {(m.kind === 'bot' ? '🤖 ' : '') + nameOf(m) + (m.user_id === me ? ` (${tx('you')})` : '')}
          </Text>
          <Text raw>{m.kind === 'bot' ? botLine(m.body, m.id, m.data, name) : m.body}</Text>
        </View>
      ))}
      {canWrite ? (
        <View style={[styles.inputRow, { borderColor: t.c.lineStrong, backgroundColor: t.c.surface }]}>
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.slice(0, 300))}
            placeholder={tx(channel === 'wolves' ? 'Whisper to the pack' : 'Talk to the village')}
            placeholderTextColor={t.c.textTertiary}
            style={[styles.input, { color: t.c.text }]}
            onSubmitEditing={send}
            returnKeyType="send"
            maxLength={300}
          />
          <IconButton icon="send" label="Send" onPress={send} />
        </View>
      ) : (
        <Text variant="caption" tone="tertiary">
          The village sleeps: no talking at night
        </Text>
      )}
    </View>
  );
}

// ───────── Result ─────────
function Result({ view, me, room }: { view: WwView; me: string; room: Room }) {
  const t = useTheme();
  const router = useRouter();
  const r = view.result;
  const cards = ((view.log ?? []).find((e) => e.kind === 'game_over')?.data.cards ?? []) as { seat: number; name: string; bot: boolean; card: CardId; alive: boolean; won: boolean }[];
  const mySeat = view.me?.seat;
  const iWon = r?.seats.includes(mySeat ?? -1);
  const dubai = view.mode === 'dubai';
  const title =
    r?.winner === 'village'
      ? dubai
        ? 'The Expats win'
        : 'The village wins'
      : r?.winner === 'wolves'
        ? dubai
          ? 'The Escrocs win'
          : 'The werewolves win'
        : r?.winner === 'lovers'
          ? 'The lovers win'
          : 'Nobody survived';
  const humans = room.people.filter((p) => p.id !== me && !p.blocked);
  const again = () =>
    wwTraining(room.space === 'irly_girl' ? 'girl' : 'mixte', view.size, null, (view.difficulty as 'beginner' | 'intermediate' | 'expert') ?? 'intermediate', view.mode === 'dubai' ? 'dubai' : 'classic')
      .then((id) => router.replace(`/games/${id}`))
      .catch(fail);
  return (
    <View style={styles.block}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text variant="titleL" raw>
          {`${iWon ? '🏆' : '🌑'} ${tx(title)}`}
        </Text>
        <Text tone="secondary">{iWon ? 'You won this game.' : 'You lost this game.'}</Text>
        {view.kind === 'training' ? (
          <Text variant="caption" tone="tertiary">
            Training against AI players: never counted in the ranking.
          </Text>
        ) : (
          <Text variant="caption" tone="tertiary">
            Unranked game
          </Text>
        )}
      </Animated.View>
      <Text variant="label" tone="secondary">
        Every card
      </Text>
      {cards.map((c) => (
        <View key={c.seat} style={[styles.row, { borderColor: t.c.line }]}>
          <Text raw>{cardOf(c.card).emoji}</Text>
          <Text style={{ flex: 1 }} raw>
            {`${c.bot ? '🤖 ' : ''}${c.name} · ${tx(cardOf(c.card).name)}${c.alive ? '' : ' · 💀'}`}
          </Text>
          {c.won ? (
            <Text variant="caption" tone="positive">
              {r?.solo?.includes(c.seat) ? 'Personal victory' : r?.double?.includes(c.seat) ? 'Double victory' : 'Won'}
            </Text>
          ) : null}
        </View>
      ))}
      {humans.length ? (
        <>
          <Text variant="titleS">Want to stay in touch?</Text>
          {humans.map((p) => (
            <View key={p.id} style={[styles.row, { borderColor: t.c.line }]}>
              <Avatar name={p.name ?? '?'} hue={0} userId={p.id} size={40} />
              <Text style={{ flex: 1 }} raw>
                {p.name ?? tx('A member')}
              </Text>
              <Button label="See profile" size="sm" variant="secondary" onPress={() => router.push(`/person/${p.id}`)} />
            </View>
          ))}
        </>
      ) : null}
      {view.kind === 'training' ? <Button label="Train again" icon="repeat" onPress={again} full /> : null}
      <Button label="IRLY Games" variant="secondary" onPress={() => router.replace('/games')} full />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth },
  codeBox: { alignItems: 'center', gap: space[3], padding: space[5], borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed' },
  codeText: { fontSize: 32, lineHeight: 38, letterSpacing: 6, fontWeight: '800' },
  deck: { padding: space[4], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space[3] },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  cardChip: { paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.pill, borderWidth: 1 },
  skyWrap: { borderRadius: radius.xl, overflow: 'hidden', minHeight: 92 },
  skyInner: { flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[5] },
  skyEmoji: { fontSize: 40, lineHeight: 46 },
  badge: { backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.pill },
  cardBox: { height: 210 },
  card: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.xl, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', padding: space[5], gap: space[2], backfaceVisibility: 'hidden' },
  cardFront: {},
  cardEmoji: { fontSize: 46, lineHeight: 54 },
  dxPanel: { borderWidth: 1.5, borderColor: DX.goldDark, borderRadius: 16, backgroundColor: 'rgba(21,16,12,0.95)', padding: 12 },
  optionDx: { backgroundColor: 'rgba(21,16,12,0.95)', borderColor: DX.gold, borderWidth: 1.5 },
  option: { padding: space[4], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space[3] },
  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  target: { paddingHorizontal: space[4], paddingVertical: space[3], borderRadius: radius.pill, borderWidth: 1.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  tile: { width: 74, alignItems: 'center', gap: 4, paddingVertical: space[2], borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  botFace: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(127,127,127,0.18)' },
  chat: { gap: space[3], paddingTop: space[4], borderTopWidth: StyleSheet.hairlineWidth },
  msg: { gap: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], borderWidth: 1, borderRadius: radius.pill, paddingLeft: space[4], paddingRight: space[2], minHeight: 46 },
  input: { flex: 1, fontSize: 16, paddingVertical: space[3] },
});
