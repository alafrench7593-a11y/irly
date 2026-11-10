import { memo, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/ui/Icon';
import { toast } from '@/components/ui/Toast';
import { blockUser } from '@/features/moderation/moderation';
import { openReport } from '@/features/moderation/reportStore';
import { t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { DX, serif, useDubaiFonts } from '../dubai/theme';
import type { Voice } from './useVoice';

const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');

export type VoicePerson = { id: string; name: string };

type Props = {
  voice: Voice;
  /** Where the game is: decides the sentence shown. */
  phase: 'lobby' | 'night' | 'witch' | 'day' | 'vote' | 'revote' | 'ended';
  night?: number;
  alive?: boolean;
  dubai?: boolean;
  me: string;
  /** Everyone at the table (for names). */
  people: VoicePerson[];
  /** The host, in the lobby: may remove someone from the table. */
  onKick?: (id: string) => void;
};

/** The sentence of the moment, straight from what the server allows me. */
function line({ voice, phase, night, alive, dubai }: Pick<Props, 'voice' | 'phase' | 'night' | 'alive' | 'dubai'>): string {
  const on = (c: string) => voice.channels.some((x) => x.channel === c);
  if (phase === 'lobby') return 'Voice lounge: everyone can talk';
  if (phase === 'ended') return 'The game is over: everyone can talk';
  if (alive === false) return 'You have been eliminated. You can no longer take part in the debates.';
  if (on('wolves')) return dubai ? '🎭 Private channel of the Escrocs' : '🐺 Private channel of the pack';
  if (phase === 'night' || phase === 'witch') return (night ?? 1) <= 1 ? 'Dealing the roles… 🤫' : '🌙 The village sleeps…';
  return '☀️ Debate in progress';
}

/**
 * The voice of a voice game: join (listening only), then the microphone
 * (open, or held to talk), the sound, the audio output where the device lets
 * choose, leaving the voice without leaving the game, and for each player
 * heard: mute for me, report, block. Says plainly what is happening:
 * connecting, reconnecting, the village sleeping, eliminated.
 */
export const VoiceBar = memo(function VoiceBar(props: Props) {
  const { voice, phase, alive, me, people, onKick } = props;
  const fonts = useDubaiFonts();
  const reduced = useReducedMotion();
  const [outputsOpen, setOutputsOpen] = useState(false);
  if (!voice.isVoice) return null;
  const sentence = tx(line(props));
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? tx('A member');

  if (!voice.supported || !voice.configured) {
    return (
      <View style={styles.bar} testID="voice-bar">
        <Head fonts={fonts} status="off" label={tx('Voice game')} />
        <Text style={styles.note}>{tx('Voice is not available on this device yet. You can play, vote and write as usual.')}</Text>
      </View>
    );
  }
  if (!voice.joined) {
    return (
      <View style={styles.bar} testID="voice-bar">
        <Head fonts={fonts} status="off" label={tx('Voice game')} />
        <Text style={styles.note}>{sentence}</Text>
        <Pressable
          onPress={() => {
            haptic('press');
            voice.join();
          }}
          accessibilityRole="button"
          accessibilityLabel={tx('Join the voice')}
          style={styles.join}
          testID="voice-join"
        >
          <Icon name="headphones" size={18} color="#221506" />
          <Text style={[styles.joinLabel, serif(fonts, '900')]}>{tx('Join the voice')}</Text>
        </Pressable>
        <Text style={styles.small}>{tx('Your microphone stays off until you turn it on. Nothing is recorded.')}</Text>
      </View>
    );
  }

  const canSpeak = voice.speakOn !== null;
  const push = voice.mode === 'push';
  const micLabel = !canSpeak
    ? alive === false && phase !== 'ended'
      ? tx('Microphone off: you are eliminated')
      : tx('Microphone off: nobody talks now')
    : push
      ? tx('Hold to talk')
      : voice.micOn
        ? tx('Microphone on')
        : tx('Microphone off');
  const statusLabel =
    voice.status === 'connecting' ? tx('Connecting…') : voice.status === 'reconnecting' ? tx('Reconnecting…') : voice.status === 'error' ? tx('Voice is unavailable right now. The game goes on in writing.') : sentence;
  const heard = voice.present.filter((id) => id !== me);
  const menu = (id: string) => {
    const name = nameOf(id);
    const isMuted = voice.muted.includes(id);
    Alert.alert(name, undefined, [
      { text: tx(isMuted ? 'Unmute for me' : 'Mute for me'), onPress: () => voice.toggleMuted(id) },
      { text: tx('Report'), onPress: () => openReport({ kind: 'profile', userId: id }, name) },
      { text: tx('Block'), style: 'destructive', onPress: () => blockUser(id).then(() => (voice.muted.includes(id) ? undefined : voice.toggleMuted(id), toast(tx('{name} is blocked', { name }), 'check'))).catch(fail) },
      ...(onKick ? [{ text: tx('Remove from the table'), style: 'destructive' as const, onPress: () => onKick(id) }] : []),
      { text: tx('Cancel'), style: 'cancel' },
    ]);
  };

  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(260)} style={styles.bar} testID="voice-bar">
      <Head fonts={fonts} status={voice.status} label={statusLabel} live />
      {alive === false && phase !== 'ended' && voice.channels.some((c) => c.channel === 'dead') ? <Text style={styles.small}>{tx('You can still talk with the other eliminated players. The living cannot hear you.')}</Text> : null}
      <View style={styles.controls}>
        {push ? (
          <Pressable
            disabled={!canSpeak}
            onPressIn={() => {
              haptic('select');
              voice.hold(true);
            }}
            onPressOut={() => voice.hold(false)}
            accessibilityRole="button"
            accessibilityLabel={micLabel}
            accessibilityState={{ disabled: !canSpeak, selected: voice.micOn }}
            style={[styles.mic, voice.micOn ? styles.micOn : null, !canSpeak ? styles.disabled : null]}
            testID="voice-mic"
          >
            <Icon name={voice.micOn ? 'mic' : 'micOff'} size={22} color={voice.micOn ? '#221506' : DX.goldLight} />
          </Pressable>
        ) : (
          <Pressable
            disabled={!canSpeak}
            onPress={() => {
              haptic('select');
              voice.toggleMic();
            }}
            accessibilityRole="switch"
            accessibilityLabel={tx('Microphone')}
            accessibilityState={{ disabled: !canSpeak, checked: voice.micOn }}
            style={[styles.mic, voice.micOn ? styles.micOn : null, !canSpeak ? styles.disabled : null]}
            testID="voice-mic"
          >
            <Icon name={voice.micOn ? 'mic' : 'micOff'} size={22} color={voice.micOn ? '#221506' : DX.goldLight} />
          </Pressable>
        )}
        <View style={styles.micCopy}>
          <Text style={styles.micText} numberOfLines={2} testID="voice-mic-label">
            {micLabel}
          </Text>
          {voice.micError ? <Text style={styles.error}>{tx(voice.micError)}</Text> : null}
        </View>
        <Round icon={voice.deaf ? 'volumeOff' : 'volume'} on={!voice.deaf} label={tx(voice.deaf ? 'Sound off. Turn the sound on' : 'Sound on. Turn the sound off')} onPress={voice.toggleDeaf} testID="voice-sound" />
        {voice.outputs.length > 1 ? <Round icon="headphones" on={outputsOpen} label={tx('Audio output')} onPress={() => setOutputsOpen((v) => !v)} testID="voice-output" /> : null}
        <Round icon="logOut" label={tx('Leave the voice')} onPress={voice.leave} testID="voice-leave" />
      </View>
      <View style={styles.modes} accessibilityRole="radiogroup">
        {(['open', 'push'] as const).map((m) => (
          <Pressable key={m} onPress={() => voice.setMode(m)} accessibilityRole="radio" accessibilityState={{ checked: voice.mode === m }} style={[styles.mode, voice.mode === m ? styles.modeOn : null]} testID={`voice-mode-${m}`}>
            <Text style={[styles.modeText, voice.mode === m ? styles.modeTextOn : null]}>{tx(m === 'open' ? 'Open microphone' : 'Push to talk')}</Text>
          </Pressable>
        ))}
      </View>
      {outputsOpen && voice.outputs.length > 1 ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(200)} style={styles.outputs}>
          {voice.outputs.map((o) => (
            <Pressable key={o.id} onPress={() => voice.setOutput(o.id)} accessibilityRole="radio" accessibilityState={{ checked: voice.output === o.id }} style={[styles.mode, voice.output === o.id ? styles.modeOn : null]}>
              <Text style={[styles.modeText, voice.output === o.id ? styles.modeTextOn : null]} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
      {heard.length ? (
        <View style={styles.people}>
          {heard.map((id) => (
            <Person key={id} name={nameOf(id)} speaking={voice.speaking.includes(id)} muted={voice.muted.includes(id) || voice.deaf} onPress={() => menu(id)} />
          ))}
        </View>
      ) : voice.status === 'on' ? (
        <Text style={styles.small}>{tx('Nobody else is in the voice yet.')}</Text>
      ) : null}
    </Animated.View>
  );
});

/**
 * The microphone alone, for the dock at the bottom of the screen: within reach
 * of the thumb while voting or using a power, in both microphone modes.
 */
export const VoiceMic = memo(function VoiceMic({ voice }: { voice: Voice }) {
  if (!voice.isVoice || !voice.joined) return null;
  const canSpeak = voice.speakOn !== null;
  const push = voice.mode === 'push';
  const label = !canSpeak ? tx('Microphone off: nobody talks now') : push ? tx('Hold to talk') : voice.micOn ? tx('Microphone on') : tx('Microphone off');
  return (
    <View style={styles.dockRow} testID="voice-dock">
      <Pressable
        disabled={!canSpeak}
        onPress={push ? undefined : voice.toggleMic}
        onPressIn={push ? () => voice.hold(true) : undefined}
        onPressOut={push ? () => voice.hold(false) : undefined}
        accessibilityRole={push ? 'button' : 'switch'}
        accessibilityLabel={push ? label : tx('Microphone')}
        accessibilityState={push ? { disabled: !canSpeak, selected: voice.micOn } : { disabled: !canSpeak, checked: voice.micOn }}
        style={[styles.mic, styles.micSmall, voice.micOn ? styles.micOn : null, !canSpeak ? styles.disabled : null]}
        testID="voice-dock-mic"
      >
        <Icon name={voice.micOn ? 'mic' : 'micOff'} size={19} color={voice.micOn ? '#221506' : DX.goldLight} />
      </Pressable>
      <Text style={[styles.micText, styles.flex]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

function Head({ fonts, status, label, live }: { fonts: boolean; status: Voice['status']; label: string; live?: boolean }) {
  const color = status === 'on' ? '#6FD08C' : status === 'error' ? DX.redLight : status === 'off' || status === 'silent' ? DX.muted : DX.gold;
  return (
    <View style={styles.head}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.headText, serif(fonts, '700')]} accessibilityLiveRegion={live ? 'polite' : 'none'} testID="voice-status">
        {label}
      </Text>
    </View>
  );
}

function Round({ icon, label, onPress, on, testID }: { icon: IconName; label: string; onPress: () => void; on?: boolean; testID?: string }) {
  return (
    <Pressable
      onPress={() => {
        haptic('select');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={[styles.round, on === false ? styles.roundOff : null]}
      testID={testID}
    >
      <Icon name={icon} size={19} color={on === false ? DX.redLight : DX.goldLight} />
    </Pressable>
  );
}

/** Someone I hear: their name lights up, with a small wave, while they speak. */
const Person = memo(function Person({ name, speaking, muted, onPress }: { name: string; speaking: boolean; muted: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(speaking && !reduced ? withRepeat(withSequence(withTiming(1, { duration: 260 }), withTiming(0.3, { duration: 260 })), -1, false) : withTiming(speaking ? 1 : 0, { duration: 160 }));
  }, [speaking, reduced, w]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.4 + w.get() * 0.6 }] }));
  const b = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - w.get() * 0.5 }] }));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}${speaking ? ` · ${tx('speaking')}` : ''}${muted ? ` · ${tx('muted for you')}` : ''}`} style={[styles.person, speaking ? styles.personOn : null]}>
      {muted ? (
        <Icon name="volumeOff" size={13} color={DX.redLight} />
      ) : (
        <View style={styles.wave}>
          <Animated.View style={[styles.waveBar, speaking ? styles.waveOn : null, a]} />
          <Animated.View style={[styles.waveBar, speaking ? styles.waveOn : null, b]} />
          <Animated.View style={[styles.waveBar, speaking ? styles.waveOn : null, a]} />
        </View>
      )}
      <Text style={[styles.personName, speaking ? styles.personNameOn : null]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bar: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,182,83,0.4)', backgroundColor: 'rgba(20,27,51,0.72)', padding: 12, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  headText: { flex: 1, color: DX.ivory, fontSize: 14, lineHeight: 19 },
  note: { color: DX.muted, fontSize: 13, lineHeight: 18 },
  small: { color: DX.muted, fontSize: 12, lineHeight: 17 },
  error: { color: DX.redLight, fontSize: 12, lineHeight: 16 },
  join: { minHeight: 50, borderRadius: 16, backgroundColor: DX.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  joinLabel: { color: '#221506', fontSize: 15, letterSpacing: 1, textTransform: 'uppercase' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mic: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: DX.gold, backgroundColor: 'rgba(11,9,7,0.6)' },
  micOn: { backgroundColor: DX.goldLight, borderColor: DX.goldLight },
  disabled: { opacity: 0.45 },
  micSmall: { width: 46, height: 46, borderRadius: 23 },
  dockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  flex: { flex: 1 },
  micCopy: { flex: 1, gap: 2 },
  micText: { color: DX.ivory, fontSize: 13, lineHeight: 17 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(226,182,83,0.45)', backgroundColor: 'rgba(11,9,7,0.5)' },
  roundOff: { borderColor: DX.redLight },
  modes: { flexDirection: 'row', gap: 8 },
  outputs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mode: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(226,182,83,0.3)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  modeOn: { backgroundColor: 'rgba(226,182,83,0.18)', borderColor: DX.gold },
  modeText: { color: DX.muted, fontSize: 13 },
  modeTextOn: { color: DX.goldLight, fontWeight: '700' },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(226,182,83,0.25)', backgroundColor: 'rgba(11,9,7,0.45)', maxWidth: 180 },
  personOn: { borderColor: '#BFE3FF', backgroundColor: 'rgba(191,227,255,0.14)' },
  personName: { color: DX.muted, fontSize: 13, flexShrink: 1 },
  personNameOn: { color: DX.ivory, fontWeight: '700' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 14 },
  waveBar: { width: 3, height: 14, borderRadius: 2, backgroundColor: DX.goldDark },
  waveOn: { backgroundColor: '#BFE3FF' },
});
