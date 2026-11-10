import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { blockUser } from '@/features/moderation/moderation';
import { openReport } from '@/features/moderation/reportStore';
import { t as tx } from '@/i18n';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { joinRoom, kickPlayer, startRoom, type GameMessage, type Room } from '../api';
import { ShareGame } from '../ShareGame';
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
export function WerewolfRoom({ room, me, messages, children }: { room: Room; me: string; messages: GameMessage[]; children?: ReactNode }) {
  const { view, failed, reload, skew } = useWwView(room.id, room);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const playing = view && view.phase !== 'lobby' && view.phase !== 'ended';
  // Voice games: my rights are read again when the table changes (lobby) or when the phase, the living or my camp do.
  const voiceSig = !view || view.phase === 'lobby' ? room : `${view.phase}|${view.night}|${view.day}|${(view.players ?? []).map((p) => (p.alive ? 1 : 0)).join('')}|${view.me?.camp}|${(view.me?.pack ?? []).join(',')}`;
  const voice = useVoice(room.id, voiceSig);
  const people = useMemo(() => room.people.map((p) => ({ id: p.id, name: p.name ?? tx('A member') })), [room.people]);
  return (
    <View style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={[styles.scroll, { paddingBottom: playing ? 16 : insets.bottom + 16 }]} keyboardShouldPersistTaps="handled">
        {!view ? (
          <Text style={styles.muted}>{failed ? tx(failed) : tx('Loading…')}</Text>
        ) : view.phase === 'lobby' ? (
          <Lobby room={room} me={me} view={view} onChanged={reload} voice={voice} people={people} />
        ) : (
          <Game room={room} me={me} view={view} messages={messages} skew={skew} onChanged={reload} voice={voice} people={people} />
        )}
        {children}
      </ScrollView>
      {/* What I may do now stays at the bottom of the screen: never a scroll away. */}
      {playing ? (
        <View style={[styles.dock, { paddingBottom: insets.bottom + 10, maxHeight: Math.round(height * 0.42) }]} testID="ww-dock">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dockInner}>
            <VoiceMic voice={voice} />
            <Actions room={room} view={view} name={(s) => (s === undefined ? tx('someone') : ((view.players ?? []).find((p) => p.seat === s)?.name ?? tx('someone')))} onChanged={reload} />
          </ScrollView>
        </View>
      ) : null}
    </View>
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
function Lobby({ room, me, view, onChanged, voice, people }: { room: Room; me: string; view: WwView; onChanged: () => void; voice: Voice; people: { id: string; name: string }[] }) {
  const fonts = useDubaiFonts();
  const host = room.host_id === me;
  const present = room.people.filter((p) => !p.left);
  const irl = room.kind === 'irl';
  const mode = modeOf(view.mode);
  // The host may turn voice on where it really works (an audio server on the project, WebRTC on this device).
  const [voiceOk, setVoiceOk] = useState(false);
  useEffect(() => {
    if (host && !irl && voiceSupported()) voiceConfigured().then(setVoiceOk);
  }, [host, irl]);
  const share = () => {
    const text = room.code ? tx('Join my Loup-Garou game on IRLY with the code {code}: {url}', { code: room.code, url: JOIN_URL + room.code }) : tx('Join my Loup-Garou game on IRLY');
    Share.share({ message: text }).catch(() => undefined);
  };
  return (
    <View style={styles.block}>
      <View style={styles.lobbyHero}>
        <Image source={SCENES[mode].home} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        <LinearGradient colors={['rgba(11,9,7,0.1)', 'rgba(11,9,7,0.9)']} style={StyleSheet.absoluteFill} />
        <Text style={[styles.lobbyMode, serif(fonts, '900')]}>{tx(MODE_NAME[mode]).toUpperCase()}</Text>
        <Text style={[styles.lobbyTitle, serif(fonts, '700')]}>{irl ? tx('In person: everyone joins with their phone') : tx('Waiting for the village')}</Text>
        <Text style={styles.lobbyLine}>{tx('{n} players here. The host starts at 6 or more (up to {max}).', { n: present.length, max: room.max })}</Text>
      </View>
      {room.code ? (
        <Panel>
          <View style={styles.codeBox}>
            {irl ? <Qr value={JOIN_URL + room.code} size={180} /> : null}
            <Text style={styles.muted}>{irl ? tx('Scan, or type the code in IRLY Games') : tx('Code of this private game')}</Text>
            <Text style={[styles.codeText, serif(fonts, '900')]}>{room.code}</Text>
            <GoldButton label={tx('Share')} icon="share" ghost onPress={share} />
          </View>
        </Panel>
      ) : null}
      {!present.some((p) => p.id === me) && room.status === 'waiting' ? <GoldButton label={tx('Join the game')} icon="userPlus" onPress={() => joinRoom(room.id).then(onChanged).catch(fail)} /> : null}
      {host ? (
        <Panel title={tx('Invite players')}>
          <ShareGame room={room} />
        </Panel>
      ) : null}
      {host && !irl && (voiceOk || voice.isVoice) ? (
        <Panel title={tx('How the table talks')}>
          <CommChoice value={voice.isVoice ? 'voice' : 'text'} onChange={(c) => wwSetComm(room.id, c).then(onChanged).catch(fail)} />
        </Panel>
      ) : null}
      <VoiceBar voice={voice} phase="lobby" me={me} people={people} onKick={host ? (id) => kickPlayer(room.id, id).then(onChanged).catch(fail) : undefined} />
      <Deck view={view} editable={host} roomId={room.id} onChanged={onChanged} />
      <Panel title={tx('At the table')}>
        {present.map((p) => (
          <View key={p.id} style={styles.personRow}>
            <Avatar name={p.name ?? '?'} hue={0} userId={p.id} size={36} />
            <Text style={styles.personName} numberOfLines={1}>
              {(p.name ?? tx('A member')) + (p.id === me ? ` (${tx('you')})` : '') + (p.id === room.host_id ? ` · ${tx('Host')}` : '')}
            </Text>
          </View>
        ))}
        <Text style={styles.small}>{tx('Unranked game')}</Text>
      </Panel>
      {host ? <GoldButton label={tx('Start the game')} icon="play" disabled={present.length < 6} onPress={() => startRoom(room.id).then(onChanged).catch(fail)} /> : null}
    </View>
  );
}

/** The deck the game will use; the host adjusts the werewolves and the special cards in Classic (the server checks). Chaos: secret. */
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
function Game({ room, me, view, messages, skew, onChanged, voice, people }: { room: Room; me: string; view: WwView; messages: GameMessage[]; skew: number; onChanged: () => void; voice: Voice; people: { id: string; name: string }[] }) {
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
    wwAct(room.id, stageOption.kind, seat).then(onChanged).catch(fail);
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
          targets={stageOption && alive ? stageOption.targets : []}
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
        <DubaiResult view={view} me={me} room={room} />
      ) : view.me ? (
        <DubaiMyCard id={view.me.card as CardId} startShown={false}>
          <Knowledge view={view} name={name} />
        </DubaiMyCard>
      ) : null}
      <Log view={view} name={name} />
      {room.kind !== 'irl' || ended ? <Chat room={room} view={view} messages={messages} me={me} name={name} /> : null}
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
function Actions({ room, view, name, onChanged }: { room: Room; view: WwView; name: (s?: number) => string; onChanged: () => void }) {
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
        <Option key={o.kind} room={room} view={view} option={o} done={mine.filter((m) => m.kind === o.kind)} name={name} onChanged={onChanged} />
      ))}
      {view.phase !== 'day' && !mine.length ? <GoldButton label={tx(view.phase === 'vote' || view.phase === 'revote' ? 'Abstain' : 'Do nothing')} ghost onPress={() => wwAct(room.id, 'pass').then(onChanged).catch(fail)} /> : null}
      {mine.some((m) => m.kind === 'pass') ? <Text style={styles.small}>{tx('You chose to do nothing')}</Text> : null}
    </View>
  );
}

function Option({ room, view, option, done, name, onChanged }: { room: Room; view: WwView; option: WwOption; done: { target: number | null; target2: number | null }[]; name: (s?: number) => string; onChanged: () => void }) {
  const [first, setFirst] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const send = (a?: number | null, b?: number | null) => {
    haptic('press');
    wwAct(room.id, option.kind, a, b).then(onChanged).catch(fail);
  };
  const chosen = done[0];
  const label = (s: number) => name(s) + (view.pack_votes && option.kind === 'wolf' ? votesFor(view.pack_votes, s) : '');
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(300)} style={styles.option}>
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
        <GoldButton label={tx(option.kind === 'ready' ? 'Ready to vote' : option.kind === 'hint' ? 'Spy tonight' : 'Use my power')} disabled={Boolean(chosen)} onPress={() => send()} />
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
function Log({ view, name }: { view: WwView; name: (s?: number) => string }) {
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
  if (!lines.length) return null;
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
function Chat({ room, view, messages, me, name }: { room: Room; view: WwView; messages: GameMessage[]; me: string; name: (s?: number) => string }) {
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
  const title =
    channel === 'wolves'
      ? view.mode === 'dubai'
        ? tx('Escrocs’ chat (only they read it)')
        : tx('Pack chat (only werewolves read it)')
      : channel === 'dead'
        ? tx('Chat of the dead')
        : tx('Village chat');
  return (
    <Panel title={title}>
      {shown.map((m) => (
        <View key={m.id} style={styles.msg}>
          <Text style={styles.msgName}>{(m.kind === 'bot' ? `${tx('AI')} · ` : '') + nameOf(m) + (m.user_id === me ? ` (${tx('you')})` : '')}</Text>
          <Text style={styles.body}>{m.kind === 'bot' ? botLine(m.body, m.id, m.data, name) : m.body}</Text>
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
            returnKeyType="send"
            maxLength={300}
            accessibilityLabel={tx(channel === 'wolves' ? 'Whisper to the pack' : 'Talk to the village')}
          />
          <PressableScale onPress={send} accessibilityRole="button" accessibilityLabel={tx('Send')} style={styles.sendBtn}>
            <Icon name="send" size={18} color={DX.goldLight} />
          </PressableScale>
        </View>
      ) : (
        <Text style={styles.small}>{tx('The village sleeps: no talking at night')}</Text>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  lobbyMode: { color: DX.gold, fontSize: 13, letterSpacing: 3 },
  lobbyTitle: { color: DX.goldLight, fontSize: 20 },
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
  msg: { gap: 2 },
  msgName: { color: DX.gold, fontSize: 12, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.2, borderColor: DX.goldDark, borderRadius: 24, paddingLeft: 14, paddingRight: 4, minHeight: 48, backgroundColor: DX.black },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, color: DX.ivory },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: DX.red, borderWidth: 1, borderColor: DX.gold, alignItems: 'center', justifyContent: 'center' },
});
