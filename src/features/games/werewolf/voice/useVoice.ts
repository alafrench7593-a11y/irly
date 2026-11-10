import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RemoteParticipant, Room as LkRoom } from 'livekit-client';
import { supabase } from '@/lib/supabase';

/**
 * Voice in a Loup-Garou game.
 *
 * The server decides everything (supabase/migrations/20261117000000_irly_werewolf_voice.sql):
 * which channels I may be in, whether I may speak there, and it closes the
 * audio rooms I no longer belong to. This hook only follows: it asks for my
 * channels' tokens (Edge Function voice-token), joins those audio rooms,
 * leaves the others, and reports who is speaking. Nothing is recorded or kept.
 *
 * The microphone is never opened on its own: joining the voice only listens;
 * the member turns the microphone on, or holds « push to talk ».
 *
 * The audio engine (livekit-client, WebRTC) is loaded only where the device
 * has WebRTC: every browser, and the phone apps from the build that ships the
 * native WebRTC module. Elsewhere `supported` is false and the game goes on
 * in writing.
 */

export type VoiceChannel = { channel: 'all' | 'wolves' | 'dead'; speak: boolean; listen: boolean };
export type VoiceState = { comm: 'text' | 'voice'; channels: VoiceChannel[]; key: string };
export type VoiceStatus = 'off' | 'connecting' | 'on' | 'reconnecting' | 'silent' | 'error';
export type MicMode = 'open' | 'push';
type Token = VoiceChannel & { room: string; token: string };
type TokenReply = { ok?: boolean; configured?: boolean; url?: string; identity?: string; channels?: Token[]; error?: string };
type Conn = { name: string; channel: VoiceChannel['channel']; speak: boolean; room: LkRoom };

/** WebRTC on this device, now. */
export function voiceSupported(): boolean {
  const g = globalThis as { RTCPeerConnection?: unknown; navigator?: { mediaDevices?: { getUserMedia?: unknown } } };
  return typeof g.RTCPeerConnection === 'function' && typeof g.navigator?.mediaDevices?.getUserMedia === 'function';
}

let probed: Promise<boolean> | null = null;
/** Is the audio server set up on this project? Asked once per session; « no » on any failure. */
export function voiceConfigured(): Promise<boolean> {
  if (!supabase) return Promise.resolve(false);
  probed ??= supabase.functions
    .invoke<TokenReply>('voice-token', { body: { probe: true } })
    .then(({ data, error }) => !error && data?.configured === true)
    .catch(() => false);
  return probed;
}

export async function wwVoiceState(roomId: string): Promise<VoiceState> {
  if (!supabase) throw new Error('Sign in to play');
  const { data, error } = await supabase.rpc('ww_voice_state', { p_room: roomId });
  if (error) throw new Error(error.message);
  return data as VoiceState;
}
export async function wwSetComm(roomId: string, comm: 'text' | 'voice'): Promise<void> {
  if (!supabase) throw new Error('Sign in to play');
  const { error } = await supabase.rpc('ww_set_comm', { p_room: roomId, p_comm: comm });
  if (error) throw new Error(error.message);
}
export async function wwComms(rooms: string[]): Promise<Record<string, 'text' | 'voice'>> {
  if (!supabase || !rooms.length) return {};
  const { data, error } = await supabase.rpc('ww_comms', { p_rooms: rooms });
  return error ? {} : ((data ?? {}) as Record<string, 'text' | 'voice'>);
}

async function fetchTokens(roomId: string): Promise<TokenReply> {
  if (!supabase) return { ok: false };
  const { data, error } = await supabase.functions.invoke<TokenReply>('voice-token', { body: { room_id: roomId } });
  if (error) {
    // A refusal (403: no channel for me right now) still carries the server's reason.
    const ctx = (error as { context?: { json?: () => Promise<TokenReply> } }).context;
    const body = ctx?.json ? await ctx.json().catch(() => null) : null;
    return body ?? { ok: false, error: error.message };
  }
  return data ?? { ok: false };
}

export type Voice = ReturnType<typeof useVoice>;

/**
 * @param roomId   the game
 * @param changed  anything that changes when the game does (the view): my rights are read again
 */
export function useVoice(roomId: string, changed: unknown) {
  const [state, setState] = useState<VoiceState | null>(null);
  const [configured, setConfigured] = useState(false);
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('off');
  const [micOn, setMicOn] = useState(false);
  const [mode, setMode] = useState<MicMode>('open');
  const [held, setHeld] = useState(false);
  const [deaf, setDeaf] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<string[]>([]);
  const [present, setPresent] = useState<string[]>([]);
  const [muted, setMuted] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<{ id: string; label: string }[]>([]);
  const [output, setOutputId] = useState<string | null>(null);
  const supported = useMemo(() => voiceSupported(), []);

  const conns = useRef<Map<string, Conn>>(new Map());
  const gen = useRef(0);
  const joinedRef = useRef(false);
  const want = useRef({ mic: false, deaf: false, muted: [] as string[] });
  const resyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const micWanted = joined && (mode === 'open' ? micOn : held);
  // What I want, readable from the audio callbacks. Declared before the effects that apply it.
  useEffect(() => {
    want.current = { mic: micWanted, deaf, muted };
  }, [micWanted, deaf, muted]);

  // My rights, read again whenever the game changes.
  useEffect(() => {
    let live = true;
    wwVoiceState(roomId)
      .then((s) => {
        if (live) setState((prev) => (prev && prev.key === s.key && prev.comm === s.comm ? prev : s));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [roomId, changed]);
  const isVoice = state?.comm === 'voice';
  useEffect(() => {
    if (isVoice) voiceConfigured().then(setConfigured);
  }, [isVoice]);

  const refresh = useCallback(() => {
    const speakers = new Set<string>();
    const here = new Set<string>();
    for (const c of conns.current.values()) {
      for (const p of c.room.activeSpeakers) speakers.add(p.identity);
      for (const p of c.room.remoteParticipants.values()) here.add(p.identity);
    }
    setSpeaking((prev) => (prev.length === speakers.size && prev.every((id) => speakers.has(id)) ? prev : [...speakers]));
    setPresent((prev) => (prev.length === here.size && prev.every((id) => here.has(id)) ? prev : [...here]));
  }, []);

  /** What I hear: nobody when I cut the sound, never someone I muted for myself. */
  const applyListening = useCallback(() => {
    for (const c of conns.current.values()) {
      for (const p of c.room.remoteParticipants.values() as IterableIterator<RemoteParticipant>) {
        const hear = !want.current.deaf && !want.current.muted.includes(p.identity);
        for (const pub of p.audioTrackPublications.values()) pub.setSubscribed(hear);
      }
    }
  }, []);

  /** Opens or closes my microphone where I may speak. False when the device refused the microphone. */
  const pushMic = useCallback(async (): Promise<boolean> => {
    let ok = true;
    for (const c of conns.current.values()) {
      const on = c.speak && want.current.mic;
      if (c.room.localParticipant.isMicrophoneEnabled === on) continue;
      try {
        await c.room.localParticipant.setMicrophoneEnabled(on);
      } catch {
        if (on) ok = false;
      }
    }
    return ok;
  }, []);
  const micResult = useCallback((ok: boolean) => {
    if (ok) {
      setMicError(null);
      return;
    }
    setMicError('The microphone is blocked. Allow it in your settings, then try again.');
    setMicOn(false);
    setHeld(false);
  }, []);

  const closeAll = useCallback(() => {
    gen.current += 1;
    if (resyncTimer.current) clearTimeout(resyncTimer.current);
    for (const c of conns.current.values()) {
      c.room.removeAllListeners();
      // Stops the microphone track too: nothing stays open after leaving.
      c.room.disconnect(true).catch(() => undefined);
    }
    conns.current.clear();
    setSpeaking([]);
    setPresent([]);
  }, []);

  const sync = useCallback(async () => {
    const n = ++gen.current;
    if (!joinedRef.current) return;
    const reply = await fetchTokens(roomId);
    if (n !== gen.current || !joinedRef.current) return;
    const tokens = reply.ok && reply.url ? (reply.channels ?? []) : [];
    // Leave every audio room I am no longer given.
    for (const [name, c] of conns.current) {
      if (tokens.some((t) => t.room === name)) continue;
      c.room.removeAllListeners();
      c.room.disconnect(true).catch(() => undefined);
      conns.current.delete(name);
    }
    if (!tokens.length) {
      refresh();
      setStatus(reply.ok === false && reply.configured === false ? 'error' : reply.error && reply.error !== 'you cannot talk here now' ? 'error' : 'silent');
      return;
    }
    const fresh = tokens.filter((t) => !conns.current.has(t.room));
    for (const t of tokens) {
      const c = conns.current.get(t.room);
      if (c) c.speak = t.speak;
    }
    if (fresh.length) setStatus('connecting');
    const lk = await import('livekit-client');
    for (const t of fresh) {
      if (n !== gen.current) return;
      const room = new lk.Room({ adaptiveStream: false, dynacast: false, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const again = () => {
        if (!joinedRef.current) return;
        if (resyncTimer.current) clearTimeout(resyncTimer.current);
        resyncTimer.current = setTimeout(() => {
          syncRef.current().catch(() => undefined);
        }, 700);
      };
      room
        .on(lk.RoomEvent.ActiveSpeakersChanged, refresh)
        .on(lk.RoomEvent.ParticipantConnected, () => {
          refresh();
          applyListening();
        })
        .on(lk.RoomEvent.ParticipantDisconnected, refresh)
        .on(lk.RoomEvent.TrackPublished, applyListening)
        .on(lk.RoomEvent.TrackSubscribed, (track) => {
          if (track.kind !== lk.Track.Kind.Audio || typeof document === 'undefined') return;
          const el = track.attach();
          el.style.display = 'none';
          document.body.appendChild(el);
        })
        .on(lk.RoomEvent.TrackUnsubscribed, (track) => {
          for (const el of track.detach()) el.remove();
        })
        .on(lk.RoomEvent.Reconnecting, () => setStatus('reconnecting'))
        .on(lk.RoomEvent.Reconnected, () => setStatus('on'))
        // The server closed this room (my rights changed) or the network dropped: ask for my rights again.
        .on(lk.RoomEvent.Disconnected, () => {
          conns.current.delete(t.room);
          refresh();
          again();
        });
      try {
        await room.connect(reply.url!, t.token, { autoSubscribe: true });
      } catch {
        room.removeAllListeners();
        if (n === gen.current) {
          setStatus('error');
          again();
        }
        continue;
      }
      if (n !== gen.current || !joinedRef.current) {
        room.removeAllListeners();
        room.disconnect(true).catch(() => undefined);
        return;
      }
      conns.current.set(t.room, { name: t.room, channel: t.channel, speak: t.speak, room });
      room.startAudio().catch(() => undefined);
    }
    if (n !== gen.current) return;
    applyListening();
    micResult(await pushMic());
    refresh();
    if (conns.current.size) setStatus('on');
  }, [roomId, refresh, applyListening, pushMic, micResult]);
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  // Follow my rights: a new key means new rooms.
  const key = state?.key;
  useEffect(() => {
    if (!joined || !isVoice) return;
    // One tick later: several changes at once (a death at dawn) make one request.
    const timer = setTimeout(() => {
      sync().catch(() => setStatus('error'));
    }, 50);
    return () => clearTimeout(timer);
  }, [joined, isVoice, key, sync]);
  useEffect(() => {
    pushMic()
      .then(micResult)
      .catch(() => undefined);
  }, [micWanted, pushMic, micResult]);
  useEffect(() => {
    applyListening();
  }, [deaf, muted, applyListening]);
  // Leaving the screen leaves the voice.
  useEffect(() => closeAll, [closeAll]);

  const join = useCallback(() => {
    if (!supported) return;
    joinedRef.current = true;
    setMicOn(false);
    setHeld(false);
    setMicError(null);
    setStatus('connecting');
    setJoined(true);
    // Where the browser can name its outputs (and switch between them), offer the choice.
    import('livekit-client')
      .then(async (lk) => {
        const canSwitch = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
        const list = canSwitch ? await lk.Room.getLocalDevices('audiooutput', false) : [];
        setOutputs(list.filter((d) => d.deviceId && d.label).map((d) => ({ id: d.deviceId, label: d.label })));
      })
      .catch(() => undefined);
  }, [supported]);
  const leave = useCallback(() => {
    joinedRef.current = false;
    setJoined(false);
    setMicOn(false);
    setHeld(false);
    closeAll();
    setStatus('off');
  }, [closeAll]);
  const setOutput = useCallback((id: string) => {
    setOutputId(id);
    for (const c of conns.current.values()) c.room.switchActiveDevice('audiooutput', id).catch(() => undefined);
  }, []);
  const toggleMuted = useCallback((identity: string) => setMuted((m) => (m.includes(identity) ? m.filter((x) => x !== identity) : [...m, identity])), []);

  const channels = state?.channels ?? [];
  return {
    /** The host chose a voice game. */
    isVoice,
    /** This device can do voice, and the project has an audio server. */
    supported,
    configured,
    joined,
    status,
    channels,
    /** The channel I may speak on now, if any. */
    speakOn: channels.find((c) => c.speak)?.channel ?? null,
    micOn: micWanted && channels.some((c) => c.speak),
    micError,
    mode,
    deaf,
    speaking,
    present,
    muted,
    outputs,
    output,
    join,
    leave,
    toggleMic: () => setMicOn((v) => !v),
    setMode: (m: MicMode) => {
      setMode(m);
      setMicOn(false);
      setHeld(false);
    },
    hold: setHeld,
    toggleDeaf: () => setDeaf((v) => !v),
    toggleMuted,
    setOutput,
  };
}
