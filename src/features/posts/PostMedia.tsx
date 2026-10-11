import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/ui/Text';
import { LiveVideo } from '@/features/live/LiveVideo';
import { useSignedLinks } from '@/features/server/media';
import { radius } from '@/theme/tokens';

/**
 * A post's photos (swiped one by one, with a counter) or its video (poster
 * until tapped). Links are signed for whoever may read the post; files are
 * cached under their stored path.
 */
export function PostMedia({ paths, kind, thumb, seconds, height = 260 }: { paths: string[]; kind: 'photo' | 'video' | null; thumb?: string | null; seconds?: number | null; height?: number }) {
  const links = useSignedLinks('post-media', [...paths, thumb]);
  const [w, setW] = useState(0);
  const [page, setPage] = useState(0);
  if (!paths.length || !kind) return null;
  if (kind === 'video') {
    const url = links[paths[0]];
    return url ? <LiveVideo url={url} poster={thumb ? links[thumb] : null} seconds={seconds} style={[styles.box, { height }]} /> : <View style={[styles.box, { height }]} />;
  }
  return (
    <View style={[styles.box, { height }]} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => w && setPage(Math.round(e.nativeEvent.contentOffset.x / w))}
        accessibilityLabel={paths.length > 1 ? `${paths.length} photos` : 'Photo'}
      >
        {paths.map((p) => (
          <View key={p} style={{ width: w || 1, height }}>
            {links[p] ? <Image source={{ uri: links[p], cacheKey: p }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
          </View>
        ))}
      </ScrollView>
      {paths.length > 1 ? (
        <View style={styles.count}>
          <Text variant="caption" style={{ color: '#fff' }} raw>
            {`${page + 1}/${paths.length}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,0.12)' },
  count: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)' },
});
