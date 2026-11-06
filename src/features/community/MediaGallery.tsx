import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type ListRenderItem, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Glass } from '@/components/ui/Glass';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { PhotoKey } from '@/data/photos';
import { LiveVideo } from '@/features/live/LiveVideo';
import { useSignedLinks } from '@/features/server/media';
import { t as tx } from '@/i18n';
import { duration, ease, spring } from '@/motion/tokens';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * A community's photos and videos: a virtualised grid (only the rows on
 * screen are drawn, more load near the end) and a full-screen viewer (swipe
 * between files, pinch or double-tap a photo to zoom, a video shows its
 * poster until played). Server files are read through signed links (the
 * post-media bucket); the demo's are the app's own photos.
 */

export type GalleryItem = {
  key: string;
  kind: 'photo' | 'video';
  /** A stored file (post-media); absent for the demo's photos. */
  path?: string;
  thumbPath?: string | null;
  seconds?: number | null;
  /** The demo: an app photo. */
  photo?: PhotoKey;
  /** The post it belongs to (« Open the post »). */
  postId?: string | null;
};

const GAP = 3;

export function MediaGrid({
  items,
  loading,
  loadingMore = false,
  error,
  onEnd,
  header,
  empty,
  topInset = 0,
  bottomInset = 0,
  onOpenPost,
}: {
  items: GalleryItem[];
  loading: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onEnd?: () => void;
  header?: ReactElement | null;
  empty: ReactElement;
  topInset?: number;
  bottomInset?: number;
  onOpenPost?: (postId: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const cols = width >= 900 ? 5 : width >= 600 ? 4 : 3;
  const cell = width ? Math.floor((width - space.gutter * 2 - GAP * (cols - 1)) / cols) : 0;
  const [open, setOpen] = useState<number | null>(null);
  // Every file's link at once, in one signed request per new page (unchanged files keep theirs).
  const links = useSignedLinks(
    'post-media',
    useMemo(() => items.flatMap((i) => (i.kind === 'video' ? [i.thumbPath, i.path] : [i.path])), [items]),
  );
  const renderItem = useCallback<ListRenderItem<GalleryItem>>(
    ({ item, index }) => <Cell item={item} size={cell} uri={item.kind === 'video' ? (item.thumbPath ? links[item.thumbPath] : undefined) : item.path ? links[item.path] : undefined} onPress={() => setOpen(index)} />,
    [cell, links],
  );
  const skeleton = (
    <View style={[styles.grid, { gap: GAP }]}>
      {Array.from({ length: cols * 4 }, (_, i) => (
        <Skeleton key={i} width={cell || 100} height={cell || 100} radius={4} />
      ))}
    </View>
  );
  return (
    <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width ? (
        <FlatList
          key={`cols-${cols}`}
          data={loading && !items.length ? [] : items}
          numColumns={cols}
          keyExtractor={(i) => i.key}
          renderItem={renderItem}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: space.gutter }}
          contentContainerStyle={{ gap: GAP, paddingTop: topInset, paddingBottom: bottomInset + 24 }}
          getItemLayout={(_, index) => ({ length: cell + GAP, offset: (cell + GAP) * Math.floor(index / cols), index })}
          initialNumToRender={cols * 6}
          maxToRenderPerBatch={cols * 4}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={onEnd}
          onEndReachedThreshold={0.6}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          ListEmptyComponent={loading ? skeleton : error ? <View style={styles.pad}><Text variant="body" tone="secondary">{tx(error)}</Text></View> : empty}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
        />
      ) : null}
      <MediaViewer items={items} index={open} links={links} onClose={() => setOpen(null)} onOpenPost={onOpenPost} />
    </View>
  );
}

const Cell = memo(function Cell({ item, size, uri, onPress }: { item: GalleryItem; size: number; uri?: string; onPress: () => void }) {
  return (
    <PressableScale haptic="select" scaleTo={0.96} onPress={onPress} style={[styles.cell, { width: size, height: size }]} accessibilityLabel={item.kind === 'video' ? tx('Video') : tx('Photo')} accessibilityRole="button">
      {item.photo ? (
        <Photo visual={{ photo: item.photo }} light="dubai" width={300} style={StyleSheet.absoluteFill} recyclingKey={`grid-${item.key}`} />
      ) : uri ? (
        <Image source={{ uri, cacheKey: item.kind === 'video' ? (item.thumbPath ?? undefined) : item.path }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} recyclingKey={item.key} />
      ) : null}
      {item.kind === 'video' ? (
        <View style={styles.badge}>
          <Icon name="play" size={11} color="#fff" />
          {item.seconds ? (
            <Text variant="caption" color="#fff" raw style={{ fontSize: 11 }}>
              {`${Math.floor(item.seconds / 60)}:${String(item.seconds % 60).padStart(2, '0')}`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </PressableScale>
  );
});

/**
 * A few files laid out as the grid, inside a page that already scrolls (the
 * demo's handful of photos): no list of its own, the same tiles and viewer.
 */
export function MediaTiles({ items, empty }: { items: GalleryItem[]; empty: ReactElement }) {
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const cols = width >= 600 ? 4 : 3;
  const cell = width ? Math.floor((width - GAP * (cols - 1)) / cols) : 0;
  if (!items.length) return empty;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={[styles.tiles, { gap: GAP }]}>
      {cell ? items.map((item, i) => <Cell key={item.key} item={item} size={cell} onPress={() => setOpen(i)} />) : null}
      <MediaViewer items={items} index={open} links={{}} onClose={() => setOpen(null)} />
    </View>
  );
}

/** A calm empty gallery. */
export function MediaEmpty({ title, body }: { title: string; body: string }) {
  const t = useTheme();
  return (
    <View style={[styles.empty, { marginHorizontal: space.gutter }]}>
      <GlassLayer radius={radius.xl} />
      <View style={[styles.emptyIcon, { backgroundColor: t.c.overlay }]}>
        <Icon name="image" size={22} color={t.c.textSecondary} />
      </View>
      <Text variant="titleS" align="center">
        {title}
      </Text>
      <Text variant="bodyS" tone="secondary" align="center">
        {body}
      </Text>
    </View>
  );
}

/* ───────── Full-screen viewer ───────── */

type ViewerProps = { items: GalleryItem[]; index: number | null; links: Record<string, string>; onClose: () => void; onOpenPost?: (postId: string) => void };

export function MediaViewer(props: ViewerProps) {
  // Keyed by the file opened: each opening starts on it, unzoomed.
  return <ViewerBody key={props.index ?? 'closed'} {...props} />;
}

function ViewerBody({ items, index, links, onClose, onOpenPost }: ViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(index ?? 0);
  const [zoomed, setZoomed] = useState(false);
  const list = useRef<FlatList<GalleryItem>>(null);
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)));
  const step = (d: number) => {
    const next = Math.min(items.length - 1, Math.max(0, page + d));
    setPage(next);
    list.current?.scrollToIndex({ index: next, animated: true });
  };
  const current = items[page];
  return (
    <Modal visible={index !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.viewer}>
        {index !== null ? (
          <FlatList
            ref={list}
            data={items}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            initialScrollIndex={Math.min(index, Math.max(0, items.length - 1))}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(i) => i.key}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            renderItem={({ item, index: i }) => (
              <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
                {item.kind === 'video' ? (
                  i === page && item.path && links[item.path] ? (
                    <LiveVideo url={links[item.path]} poster={item.thumbPath ? links[item.thumbPath] : null} seconds={item.seconds} fit style={{ width, height: height * 0.8 }} />
                  ) : (
                    <ActivityIndicator color="#fff" />
                  )
                ) : (
                  <ZoomablePhoto item={item} uri={item.path ? links[item.path] : undefined} width={width} height={height} active={i === page} onZoom={setZoomed} />
                )}
              </View>
            )}
          />
        ) : null}
        <View style={[styles.viewerBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <ViewerButton icon="x" label={tx('Close')} onPress={onClose} />
          <Text variant="label" color="#fff" raw>
            {items.length > 1 ? `${page + 1}/${items.length}` : ''}
          </Text>
          {current?.postId && onOpenPost ? (
            <ViewerButton
              icon="message"
              label={tx('Open the post')}
              onPress={() => {
                onClose();
                onOpenPost(current.postId as string);
              }}
            />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
        {Platform.OS === 'web' && items.length > 1 ? (
          <View style={[styles.arrows, { top: height / 2 - 22 }]} pointerEvents="box-none">
            {page > 0 ? <ViewerButton icon="chevronLeft" label={tx('Previous')} onPress={() => step(-1)} /> : <View />}
            {page < items.length - 1 ? <ViewerButton icon="chevronRight" label={tx('Next')} onPress={() => step(1)} /> : <View />}
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

function ViewerButton({ icon, label, onPress }: { icon: 'x' | 'message' | 'chevronLeft' | 'chevronRight'; label: string; onPress: () => void }) {
  return (
    <PressableScale haptic="select" onPress={onPress} style={styles.viewerButton} accessibilityRole="button" accessibilityLabel={label}>
      <Glass dark level="thin" border={false} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
      <Icon name={icon} size={20} color="#fff" />
    </PressableScale>
  );
}

/** A photo that zooms: pinch (1× to 4×), drag while zoomed, double-tap for 2.5× and back. */
function ZoomablePhoto({ item, uri, width, height, active, onZoom }: { item: GalleryItem; uri?: string; width: number; height: number; active: boolean; onZoom: (on: boolean) => void }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const base = useSharedValue(1);
  const tx_ = useSharedValue(0);
  const ty = useSharedValue(0);
  const bx = useSharedValue(0);
  const by = useSharedValue(0);
  useEffect(() => {
    if (active) return;
    scale.set(1);
    base.set(1);
    tx_.set(0);
    ty.set(0);
  }, [active, scale, base, tx_, ty]);
  const settle = (s: number) => {
    'worklet';
    scheduleOnRN(onZoom, s > 1.01);
  };
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.set(Math.min(4, Math.max(1, base.value * e.scale)));
    })
    .onEnd(() => {
      base.set(scale.value);
      if (scale.value <= 1.01) {
        tx_.set(withSpring(0, spring.snappy));
        ty.set(withSpring(0, spring.snappy));
      }
      settle(scale.value);
    });
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      bx.set(tx_.value);
      by.set(ty.value);
    })
    .onUpdate((e) => {
      if (scale.value <= 1.01) return;
      const mx = (width * (scale.value - 1)) / 2;
      const my = (height * (scale.value - 1)) / 2;
      tx_.set(Math.min(mx, Math.max(-mx, bx.value + e.translationX)));
      ty.set(Math.min(my, Math.max(-my, by.value + e.translationY)));
    });
  const double = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1.01 ? 1 : 2.5;
      const anim = (v: number) => (reduced ? v : withTiming(v, { duration: duration.base, easing: ease.standard }));
      scale.set(anim(next));
      base.set(next);
      tx_.set(anim(0));
      ty.set(anim(0));
      settle(next);
    });
  const gesture = Gesture.Simultaneous(pinch, Gesture.Exclusive(double, pan));
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx_.value }, { translateY: ty.value }, { scale: scale.value }] }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View entering={reduced ? undefined : FadeIn.duration(duration.fast)} style={[{ width, height }, style]} accessible accessibilityRole="image" accessibilityLabel={tx('Photo')} accessibilityHint={tx('Double-tap to zoom')}>
        {item.photo ? (
          <Photo visual={{ photo: item.photo }} light="dubai" width={1200} style={StyleSheet.absoluteFill} recyclingKey={`view-${item.key}`} />
        ) : uri ? (
          <Image source={{ uri, cacheKey: item.path }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
        ) : (
          <ActivityIndicator color="#fff" style={StyleSheet.absoluteFill} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gutter },
  tiles: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,0.14)' },
  badge: { position: 'absolute', right: 5, bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.5)' },
  empty: { alignItems: 'center', gap: 10, padding: 28, borderRadius: radius.xl, overflow: 'hidden' },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter },
  viewerButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  arrows: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.gutter },
});
