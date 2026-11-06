import { Image } from 'expo-image';
import { memo, useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Glass } from '@/components/ui/Glass';
import { Text } from '@/components/ui/Text';
import { t as tx } from '@/i18n';
import { LiveVideo } from '@/features/live/LiveVideo';
import { feedRatio, knownRatio, mediaRatio, rememberRatio } from '@/features/live/liveRatio';
import { TapPhoto } from '@/features/photo/TapPhoto';
import { useSignedLinks } from '@/features/server/media';
import { radius } from '@/theme/tokens';

/**
 * A post's photos (a carousel, swiped one by one, with dots and a counter)
 * or its video (poster until tapped). The frame follows the first photo's
 * own shape within 4:5 … 1.91:1 (the same rule as the Live), remembered by
 * its stored path so it never jumps twice; a fixed `height` keeps the older
 * fixed frame (profile grids). Links are signed for whoever may read the
 * post; files are cached under their stored path. A tap opens the photo
 * whole; a double tap likes (when `onLike` is given).
 */
export const PostMedia = memo(function PostMedia({
  paths,
  kind,
  thumb,
  seconds,
  height,
  liked,
  onLike,
}: {
  paths: string[];
  kind: 'photo' | 'video' | null;
  thumb?: string | null;
  seconds?: number | null;
  /** A fixed frame height; without it the frame follows the media's shape. */
  height?: number;
  liked?: boolean;
  onLike?: () => void;
}) {
  const links = useSignedLinks('post-media', [...paths, thumb]);
  const [w, setW] = useState(0);
  const [page, setPage] = useState(0);
  const first = paths[0];
  // The shape: remembered for this file (an earlier load) or read when the first photo arrives.
  const [ratio, setRatio] = useState<number | null>(() => (first ? knownRatio(`post-media/${first}`) : null));
  const onLayout = useCallback((e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width)), []);
  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => w && setPage(Math.round(e.nativeEvent.contentOffset.x / w)), [w]);
  if (!paths.length || !kind) return null;
  if (kind === 'video') {
    const url = links[paths[0]];
    if (height) return url ? <LiveVideo url={url} poster={thumb ? links[thumb] : null} seconds={seconds} style={[styles.box, { height }]} /> : <View style={[styles.box, { height }]} />;
    return url ? (
      <LiveVideo fit url={url} poster={thumb ? links[thumb] : null} seconds={seconds} style={styles.box} />
    ) : (
      <View style={[styles.box, { width: '100%', aspectRatio: feedRatio(null) }]} />
    );
  }
  const frameH = height ?? (w ? Math.round(w / feedRatio(ratio)) : 0);
  const many = paths.length > 1;
  return (
    <View style={[styles.box, height ? { height } : { width: '100%', aspectRatio: feedRatio(ratio) }]} onLayout={onLayout}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={many}
        onMomentumScrollEnd={onScrollEnd}
        accessibilityLabel={many ? tx('{n} photos', { n: paths.length }) : tx('Photo')}
      >
        {paths.map((p, i) => {
          const url = links[p];
          const img = url ? (
            <Image
              source={{ uri: url, cacheKey: p }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={180}
              recyclingKey={p}
              // The first photo gives the frame its shape (once per file).
              onLoad={
                i === 0
                  ? (e) => {
                      const r = mediaRatio(e.source.width, e.source.height);
                      if (!r) return;
                      rememberRatio(`post-media/${p}`, r);
                      if (!ratio) setRatio(r);
                    }
                  : undefined
              }
            />
          ) : null;
          return (
            <View key={p} style={{ width: w || 1, height: frameH || 1 }}>
              {url ? (
                <TapPhoto photo={{ uri: url, ratio: i === 0 ? (ratio ?? undefined) : undefined }} style={StyleSheet.absoluteFill} liked={liked} onLike={onLike}>
                  {img}
                </TapPhoto>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      {many ? (
        <>
          <View style={styles.count} pointerEvents="none">
            <Glass dark level="thin" border={false} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} />
            <Text variant="caption" style={{ color: '#fff' }} raw>
              {`${page + 1}/${paths.length}`}
            </Text>
          </View>
          <View style={styles.dots} pointerEvents="none">
            {paths.slice(0, 10).map((p, i) => (
              <View key={p} style={[styles.dot, { opacity: i === page ? 1 : 0.5, width: i === page ? 14 : 6 }]} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,0.12)' },
  count: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.35)' },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { height: 6, borderRadius: 3, backgroundColor: '#fff' },
});
