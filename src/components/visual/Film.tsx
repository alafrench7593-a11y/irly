import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/**
 * A short, silent, looping film laid over a photo (Home hero, activity
 * header). The photo stays underneath: the film fades in only once it can
 * play, so a slow or missing file never leaves a blank area.
 */
export function Film({ uri, dim = 0 }: { uri: string; /** Darkens the film so white text on top stays readable (0–1). */ dim?: number }) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEventListener(player, 'statusChange', ({ status }) => setReady(status === 'readyToPlay'));
  // No decoding while the app is in the background: pause, then resume on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      try {
        if (s === 'active') player.play();
        else player.pause();
      } catch {
        // The player was released while unmounting: nothing left to pause.
      }
    });
    return () => sub.remove();
  }, [player]);
  if (!ready) {
    // Mounted but invisible until the first frames are there.
    return <VideoView player={player} style={[StyleSheet.absoluteFill, { opacity: 0 }]} contentFit="cover" nativeControls={false} pointerEvents="none" />;
  }
  return (
    <Animated.View entering={FadeIn.duration(900)} style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      {dim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} /> : null}
    </Animated.View>
  );
}
