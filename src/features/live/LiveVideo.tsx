import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { a11y } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';

/**
 * A Live video: its poster and length until tapped, so opening the feed
 * never downloads a video; tapped, it loads and plays here, with sound and
 * the system controls. A video that cannot be read says so.
 */
export function LiveVideo({ url, poster, seconds, style }: { url: string; poster?: string | null; seconds?: number | null; style?: StyleProp<ViewStyle> }) {
  const [on, setOn] = useState(false);
  return (
    <View style={[styles.box, style]}>
      {on ? (
        <Player url={url} />
      ) : (
        <PressableScale haptic="select" scaleTo={0.98} onPress={() => setOn(true)} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={a11y('Play the video')}>
          {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
          <View style={styles.center}>
            <View style={styles.play}>
              <Icon name="play" size={26} color="#fff" />
            </View>
          </View>
          {seconds ? (
            <View style={styles.length}>
              <Text variant="caption" color="#fff">
                {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      )}
    </View>
  );
}

function Player({ url }: { url: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });
  useEventListener(player, 'statusChange', ({ status }) => setState(status === 'error' ? 'error' : status === 'readyToPlay' ? 'ready' : 'loading'));
  return (
    <>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />
      {state === 'loading' ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      {state === 'error' ? (
        <View style={styles.center}>
          <Text variant="label" color="#fff">
            This video could not be played
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: '#000' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  play: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  length: { position: 'absolute', right: 10, bottom: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)' },
});
