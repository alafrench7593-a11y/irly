import { useRouter } from 'expo-router';
import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Rail } from '@/components/cards/Blocks';
import { useFrame } from '@/components/layout/AppFrame';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { PhotoKey } from '@/data/photos';
import type { Visual } from '@/data/types';
import { CITIES } from '@/data/destinations';
import { LiveVideo } from '@/features/live/LiveVideo';
import { useSignedLinks } from '@/features/server/media';
import { dateLocale, t as tx, useLang } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import type { LightId } from '@/theme/lights';
import { useTheme } from '@/theme/useTheme';
import { openDestination } from './go';
import { BANNER_PHOTO, NEWS_CATEGORY_LABEL, NEWS_PHOTO, type Banner, type NewsArticle, type NewsCard } from './feed';
import { entryCount, entryText, type LayoutEntry } from './layout';

/**
 * How the team's content looks in the app: news cards (a rail of photo cards
 * or a list), banners (a carousel or a stack) and the article page. Text the
 * team wrote is shown as written (never translated); the look follows the
 * flavour (IRLY, or IRLY Girl's rose) through the theme, nothing else.
 */

/** A stored file of "cms-media" (or, in the demo, any link) as a photo, with one of IRLY's own photos behind it. */
export function useCmsVisuals(items: { path?: string | null; key?: string | null; fallback: string }[]): Visual[] {
  const paths = useMemo(() => items.map((i) => i.path), [items]);
  const links = useSignedLinks('cms-media', paths);
  return items.map((i) => ({ photo: (i.key || i.fallback) as PhotoKey, uri: i.path ? (links[i.path] ?? null) : null }));
}

export const newsDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

const NewsTile = memo(function NewsTile({ item, visual, width, light }: { item: NewsCard; visual: Visual; width: number; light: LightId }) {
  const router = useRouter();
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push(`/actu/${item.id}`)} accessibilityRole="link" accessibilityLabel={item.title} testID="news-card">
      <Photo visual={visual} light={light} scrim="strong" width={700} pinned style={[styles.tile, { width }]}>
        <View style={styles.tileText}>
          <View style={styles.tileTop}>
            <Text variant="overline" color="rgba(255,255,255,0.9)">
              {NEWS_CATEGORY_LABEL[item.category]}
            </Text>
            {item.video ? <Icon name="play" size={14} color="#FFFFFF" /> : null}
          </View>
          <Text variant="titleM" color="#FFFFFF" numberOfLines={2} raw>
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text variant="caption" color="rgba(255,255,255,0.85)" numberOfLines={2} raw>
              {item.subtitle}
            </Text>
          ) : null}
        </View>
      </Photo>
    </PressableScale>
  );
});

const NewsRow = memo(function NewsRow({ item, visual, light }: { item: NewsCard; visual: Visual; light: LightId }) {
  const router = useRouter();
  const t = useTheme();
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push(`/actu/${item.id}`)} accessibilityRole="link" accessibilityLabel={item.title} testID="news-card" style={styles.row}>
      <GlassLayer radius={radius.xl} />
      <Photo visual={visual} light={light} width={240} pinned style={styles.thumb} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" tone="brand">
          {`${tx(NEWS_CATEGORY_LABEL[item.category])} · ${newsDate(item.publish_at)}`}
        </Text>
        <Text variant="titleS" numberOfLines={2} raw>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text variant="bodyS" tone="secondary" numberOfLines={1} raw>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
    </PressableScale>
  );
});

/** The Home's news: nothing at all when the team published none (never an example item). */
export function NewsSection({ entry, items }: { entry?: LayoutEntry; items: NewsCard[] }) {
  const router = useRouter();
  const lang = useLang();
  const frame = useFrame();
  const light = CITIES[useCityId()].light;
  const shown = useMemo(() => items.slice(0, entryCount(entry, 'news')), [items, entry]);
  const visuals = useCmsVisuals(useMemo(() => shown.map((n) => ({ path: n.cover_path, key: n.cover_key, fallback: NEWS_PHOTO[n.category] })), [shown]));
  if (!shown.length) return null;
  const title = entryText(entry, 'title', lang);
  const line = entryText(entry, 'subtitle', lang);
  const cta = entryText(entry, 'cta_label', lang);
  return (
    <View testID="home-news">
      <SectionHeader
        rawParts={[...(title ? (['title'] as const) : []), ...(line ? (['overline'] as const) : []), ...(cta ? (['action'] as const) : [])]}
        overline={line ?? 'From the IRLY team'}
        title={title ?? 'IRLY news'}
        action={cta ?? 'All'}
        onAction={() => (entry?.cta_url ? openDestination(entry.cta_url) : router.push('/actu'))}
      />
      {entry?.style === 'list' ? (
        <View style={styles.list}>
          {shown.map((n, i) => (
            <NewsRow key={n.id} item={n} visual={visuals[i]} light={light} />
          ))}
        </View>
      ) : (
        <Rail itemWidth={Math.min(300, frame.width * 0.78)}>
          {shown.map((n, i) => (
            <NewsTile key={n.id} item={n} visual={visuals[i]} width={Math.min(300, frame.width * 0.78)} light={light} />
          ))}
        </Rail>
      )}
    </View>
  );
}

const BannerCard = memo(function BannerCard({ b, visual, width, light }: { b: Banner; visual: Visual; width: number; light: LightId }) {
  const opens = Boolean(b.cta_url);
  const body = (
    <Photo visual={visual} light={light} scrim="strong" width={900} pinned style={[styles.banner, { width }]}>
      <View style={styles.bannerText}>
        <Text variant="titleL" color="#FFFFFF" numberOfLines={2} raw>
          {b.title}
        </Text>
        {b.body ? (
          <Text variant="bodyS" color="rgba(255,255,255,0.88)" numberOfLines={2} raw>
            {b.body}
          </Text>
        ) : null}
        {b.cta_label && opens ? (
          <View style={styles.bannerCta}>
            <Text variant="label" color="#FFFFFF" raw>
              {b.cta_label}
            </Text>
            <Icon name="arrowRight" size={14} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
    </Photo>
  );
  return opens ? (
    <PressableScale haptic="select" scaleTo={0.98} onPress={() => openDestination(b.cta_url)} accessibilityRole="link" accessibilityLabel={b.title} testID="home-banner">
      {body}
    </PressableScale>
  ) : (
    <View testID="home-banner" accessible accessibilityLabel={b.title}>
      {body}
    </View>
  );
});

/** The Home's banners, as the team placed them (none: nothing). */
export function BannerSection({ entry, banners, width: given, pad = space.gutter }: { entry?: LayoutEntry; banners: Banner[]; width?: number; pad?: number }) {
  const frame = useFrame();
  const light = CITIES[useCityId()].light;
  const shown = useMemo(() => banners.slice(0, entryCount(entry, 'banners')), [banners, entry]);
  const visuals = useCmsVisuals(useMemo(() => shown.map((b) => ({ path: b.image_path, key: b.image_key, fallback: BANNER_PHOTO })), [shown]));
  if (!shown.length) return null;
  const width = given ?? frame.width - space.gutter * 2;
  if (entry?.style === 'stack' || shown.length === 1) {
    return (
      <View style={[styles.stack, { paddingHorizontal: pad }]} testID="home-banners">
        {shown.map((b, i) => (
          <BannerCard key={b.id} b={b} visual={visuals[i]} width={width} light={light} />
        ))}
      </View>
    );
  }
  return (
    <ScrollView
      testID="home-banners"
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={width + 12}
      snapToAlignment="start"
      contentContainerStyle={{ paddingHorizontal: pad, gap: 12 }}
    >
      {shown.map((b, i) => (
        <BannerCard key={b.id} b={b} visual={visuals[i]} width={width} light={light} />
      ))}
    </ScrollView>
  );
}

/** A news item's page (also the back office's preview): photo, words, gallery, video, button. */
export function NewsArticleView({ item }: { item: NewsArticle }) {
  const t = useTheme();
  const frame = useFrame();
  const light = CITIES[useCityId()].light;
  const files = useMemo(
    () => [{ path: item.cover_path, key: item.cover_key, fallback: NEWS_PHOTO[item.category] }, ...item.gallery_paths.map((p) => ({ path: p, key: null, fallback: NEWS_PHOTO[item.category] }))],
    [item],
  );
  const [cover, ...gallery] = useCmsVisuals(files);
  const video = useSignedLinks('cms-media', useMemo(() => [item.video_path], [item.video_path]));
  const videoUrl = item.video_path ? video[item.video_path] : undefined;
  const cell = (frame.width - space.gutter * 2 - 8) / 2;
  return (
    <View style={{ gap: space[4] }} testID="news-article">
      <Photo visual={cover} light={light} width={1200} pinned style={styles.hero} />
      <View style={styles.pad}>
        <Text variant="caption" tone="brand">
          {`${tx(NEWS_CATEGORY_LABEL[item.category])} · ${newsDate(item.publish_at)}`}
        </Text>
        <Text variant="titleL" raw accessibilityRole="header">
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text variant="bodyL" tone="secondary" raw>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
      {item.body ? (
        <View style={styles.pad}>
          {item.body.split(/\n{2,}/).map((para, i) => (
            <Text key={i} variant="body" raw style={{ marginBottom: space[3] }}>
              {para}
            </Text>
          ))}
        </View>
      ) : null}
      {item.video_path ? (
        <View style={styles.pad}>
          {videoUrl ? (
            <LiveVideo url={videoUrl} style={[styles.video, { backgroundColor: t.c.overlay }]} />
          ) : (
            <View style={[styles.video, { backgroundColor: t.c.overlay }]} />
          )}
        </View>
      ) : null}
      {gallery.length ? (
        <View style={[styles.pad, styles.gallery]}>
          {gallery.map((v, i) => (
            <Photo key={i} visual={v} light={light} width={600} pinned style={{ width: cell, height: cell, borderRadius: radius.lg, overflow: 'hidden' }} />
          ))}
        </View>
      ) : null}
      {item.cta_label && item.cta_url ? (
        <View style={styles.pad}>
          <Button label={item.cta_label} raw icon="arrowRight" full onPress={() => openDestination(item.cta_url)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { height: 210, borderRadius: radius.xl, overflow: 'hidden' },
  tileText: { flex: 1, justifyContent: 'flex-end', padding: 16, gap: 4 },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  list: { paddingHorizontal: space.gutter, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.xl, overflow: 'hidden' },
  thumb: { width: 72, height: 72, borderRadius: radius.lg, overflow: 'hidden' },
  stack: { paddingHorizontal: space.gutter, gap: 12 },
  banner: { height: 160, borderRadius: radius.xl, overflow: 'hidden' },
  bannerText: { flex: 1, justifyContent: 'flex-end', padding: 18, gap: 4 },
  bannerCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  hero: { height: 280 },
  pad: { paddingHorizontal: space.gutter, gap: 6 },
  video: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.xl, overflow: 'hidden' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
