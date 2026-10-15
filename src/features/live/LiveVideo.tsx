import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { forgetLink } from '@/features/server/media';
import { a11y } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { feedRatio, knownRatio, mediaKey, mediaRatio, rememberRatio } from './liveRatio';

/**
 * A Live video: its poster and length until tapped, so opening the feed
 * never downloads a video; tapped, it loads and plays here, with sound and
 * the system controls. A video that cannot be read says so, with a retry.
 *
 * `fit` (opt-in, the Live feed and composer): the frame follows the video's
 * own shape (`ratio`, else its poster's), between 4:5 and 1.91:1, instead of
 * the size given by `style`. Left out, the frame is exactly `style`, as before.
 */
export function LiveVideo({
  url,
  poster,
  seconds,
  style,
  fit = false,
  ratio,
  onRetry,
}: {
  url: string;
  poster?: string | null;
  seconds?: number | null;
  style?: StyleProp<ViewStyle>;
  fit?: boolean;
  /** Width / height of the video as played, when known. */
  ratio?: number | null;
  /** Asks for fresh links (the feed reloads) after a failure. */
  onRetry?: () => void;
}) {
  const [on, setOn] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [posterRatio, setPosterRatio] = useState<{ poster: string; ratio: number } | null>(null);
  const own = fit ? (ratio ?? knownRatio(poster) ?? knownRatio(url) ?? (posterRatio && poster && posterRatio.poster === poster ? posterRatio.ratio : null)) : null;
  return (
    <View style={[styles.box, style, fit ? { width: '100%', aspectRatio: feedRatio(own) } : null]}>
      {on ? (
        <Player
          key={attempt}
          url={url}
          onRetry={() => {
            setAttempt((n) => n + 1);
            // The cached link may be the broken one (expired, revoked): the reload signs a new one.
            forgetLink(url);
            onRetry?.();
          }}
        />
      ) : (
        <PressableScale haptic="select" scaleTo={0.98} onPress={() => setOn(true)} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={a11y('Play the video')}>
          {poster ? (
            <Image
              source={fit ? { uri: poster, cacheKey: mediaKey(poster) } : { uri: poster }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              onLoad={
                fit
                  ? (e) => {
                      const r = mediaRatio(e.source.width, e.source.height);
                      if (!r) return;
                      rememberRatio(poster, r);
                      rememberRatio(url, r);
                      if (!ratio) setPosterRatio({ poster, ratio: r });
                    }
                  : undefined
              }
            />
          ) : null}
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

function Player({ url, onRetry }: { url: string; onRetry: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // A stored video played again (same signed link, kept by the link cache) comes from the
  // phone's cache, not downloaded again. A local file (the composer, my own post) is read as is.
  const player = useVideoPlayer(/^https?:/i.test(url) ? { uri: url, useCaching: true } : url, (p) => {
    p.loop = false;
    p.play();
  });
  useEventListener(player, 'statusChange', ({ status }) => setState(status === 'error' ? 'error' : status === 'readyToPlay' ? 'ready' : 'loading'));
  return (
    <>
      {/* The whole video, never cropped: bars where its shape differs from the frame. */}
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />
      {state === 'loading' ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      {state === 'error' ? (
        <View style={[styles.center, { gap: 10, backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <Text variant="label" color="#fff">
            This video could not be played
          </Text>
          <Button label="Try again" size="sm" variant="secondary" onPress={onRetry} />
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
