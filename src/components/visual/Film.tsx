import { useEventListener } from 'expo';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { claimPlayback, ownsPlayback, playbackId, releasePlayback } from './playback';

/**
 * A short, silent, looping film laid over a photo (Home hero, activity
 * header). The photo stays underneath: the film fades in only once it can
 * play, so a slow or missing file never leaves a blank area. One film
 * plays at a time (playback.ts): the page on top; a member's video
 * pauses it, and it picks up again when that video stops. A page that is
 * not on screen (another tab, a page pushed over it) holds no film: it
 * stops decoding and plays again when it comes back.
 */
export function Film({ uri, dim = 0 }: { uri: string; /** Darkens the film so white text on top stays readable (0–1). */ dim?: number }) {
  const [ready, setReady] = useState(false);
  const [id] = useState(playbackId);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEventListener(player, 'statusChange', ({ status }) => setReady(status === 'readyToPlay'));
  const shown = useSharedValue(0);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  // Whether the page is on screen (set by the focus effect below).
  const onScreen = useRef(false);
  useEffect(() => {
    if (!ready) return;
    shown.set(withTiming(1, { duration: 900 }));
    // Loaded: it starts here (on the web the first play() comes before the view exists).
    try {
      if (onScreen.current && ownsPlayback(id)) player.play();
    } catch {
      // Released while unmounting.
    }
  }, [ready, shown, player, id]);
  useFocusEffect(
    useCallback(() => {
      onScreen.current = true;
      claimPlayback(
        id,
        'ambient',
        () => player.pause(),
        () => player.play(),
      );
      try {
        // Back on screen: only a film that loaded plays again (one that failed stays on its photo).
        if (ownsPlayback(id) && player.status === 'readyToPlay') player.play();
      } catch {
        // Released while the page was leaving.
      }
      return () => {
        onScreen.current = false;
        try {
          player.pause();
        } catch {
          // Released while unmounting: nothing left to pause.
        }
        releasePlayback(id);
      };
    }, [player, id]),
  );
  // No decoding while the app is in the background: pause, then resume on return (only the film allowed to play).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      try {
        if (s === 'active') {
          if (ownsPlayback(id)) player.play();
        } else player.pause();
      } catch {
        // The player was released while unmounting: nothing left to pause.
      }
    });
    return () => sub.remove();
  }, [player, id]);
  // One view for the whole life of the film (swapping views would restart or stop it): it fades in once it can play.
  return (
    <Animated.View style={[StyleSheet.absoluteFill, fade]} pointerEvents="none">
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      {dim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} /> : null}
    </Animated.View>
  );
}
