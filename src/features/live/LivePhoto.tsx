import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { TapPhoto } from '@/features/photo/TapPhoto';
import { feedRatio, knownRatio, mediaKey, mediaRatio, rememberRatio } from './liveRatio';

/**
 * A Live photo in the feed (and in the composer's preview, the same frame):
 * the frame follows the photo's own shape, between 4:5 and 1.91:1, and the
 * photo fills it (cropped only past those limits). Tapped, it opens whole, at
 * its real proportions. Loading shows a quiet tile; a photo that cannot be
 * loaded says so with a retry, and never breaks the rest of the feed.
 */
export function LivePhoto({
  url,
  ratio,
  liked,
  onLike,
  onRetry,
  tappable = true,
  kind = 'photo',
  style,
}: {
  /** null: the link could not be made (offline, server). */
  url: string | null;
  /** Width / height when already known (picked or just posted). */
  ratio?: number | null;
  liked?: boolean;
  onLike?: () => void;
  /** Asks for fresh links (the feed reloads). */
  onRetry?: () => void;
  tappable?: boolean;
  /** What the failure message names (a video whose link could not be made shows here too). */
  kind?: 'photo' | 'video';
  style?: StyleProp<ViewStyle>;
}) {
  const [loaded, setLoaded] = useState<{ url: string; ratio: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const own = ratio ?? knownRatio(url) ?? (loaded && url && mediaKey(loaded.url) === mediaKey(url) ? loaded.ratio : null);
  const frame = [styles.frame, style, { aspectRatio: feedRatio(own) }];
  const broken = !url || failed === url;

  if (broken) {
    return (
      <View style={[frame, styles.tile, styles.center]}>
        <Icon name={kind === 'video' ? 'video' : 'image'} size={22} color="rgba(255,255,255,0.8)" />
        <Text variant="caption" color="rgba(255,255,255,0.85)">
          {kind === 'video' ? 'This video could not be loaded' : 'This photo could not be loaded'}
        </Text>
        {onRetry || url ? (
          <Button
            label="Try again"
            size="sm"
            variant="secondary"
            onPress={() => {
              setFailed(null);
              setAttempt((n) => n + 1);
              onRetry?.();
            }}
          />
        ) : null}
      </View>
    );
  }

  const image = (
    <Image
      key={attempt}
      source={{ uri: url, cacheKey: mediaKey(url) }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      transition={150}
      recyclingKey={mediaKey(url)}
      onLoad={(e) => {
        const r = mediaRatio(e.source.width, e.source.height);
        if (!r) return;
        rememberRatio(url, r);
        if (!ratio) setLoaded({ url, ratio: r });
      }}
      onError={() => setFailed(url)}
    />
  );
  if (!tappable) return <View style={[frame, styles.tile]}>{image}</View>;
  return (
    <TapPhoto photo={{ uri: url, ratio: own ?? undefined }} style={[frame, styles.tile]} liked={liked} onLike={onLike}>
      {image}
    </TapPhoto>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden' },
  tile: { backgroundColor: 'rgba(127,127,127,0.18)' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: 'rgba(0,0,0,0.55)' },
});
