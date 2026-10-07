import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/**
 * A short, silent, looping film of the city over the hero photo. The photo
 * stays underneath: the film fades in only once it can play, so a slow or
 * missing file never leaves a blank hero.
 */
export function HeroVideo({ uri }: { uri: string }) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEventListener(player, 'statusChange', ({ status }) => setReady(status === 'readyToPlay'));
  if (!ready) {
    // Mounted but invisible until the first frames are there.
    return <VideoView player={player} style={[StyleSheet.absoluteFill, { opacity: 0 }]} contentFit="cover" nativeControls={false} pointerEvents="none" />;
  }
  return (
    <Animated.View entering={FadeIn.duration(900)} style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </Animated.View>
  );
}
