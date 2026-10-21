import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import { NEWS_CATEGORY_LABEL, NEWS_PHOTO, useHomeFeed } from '@/features/cms/feed';
import { newsDate, useCmsVisuals } from '@/features/cms/ui';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { useAppSpace } from '@/state/appSpace';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Every news item the IRLY team published for this flavour (« All » on the
 * Home's news): the same feed as the Home, no other request.
 */
export default function NewsList() {
  const t = useTheme();
  const router = useRouter();
  const feed = useHomeFeed(useAppSpace());
  const light = CITIES[useCityId()].light;
  const items = useMemo(() => feed?.news ?? [], [feed]);
  const visuals = useCmsVisuals(useMemo(() => items.map((n) => ({ path: n.cover_path, key: n.cover_key, fallback: NEWS_PHOTO[n.category] })), [items]));

  return (
    <Page title="IRLY news" overline="From the IRLY team">
      <View style={styles.list}>
        {feed === null ? (
          <ActivityIndicator color={t.c.text} />
        ) : !items.length ? (
          <Text variant="body" tone="secondary">
            No news yet. The IRLY team posts here when there is something new.
          </Text>
        ) : (
          items.map((n, i) => (
            <PressableScale key={n.id} haptic="select" scaleTo={0.98} onPress={() => router.push(`/actu/${n.id}`)} accessibilityRole="link" accessibilityLabel={n.title} style={styles.row} testID="news-card">
              <GlassLayer radius={radius.xl} />
              <Photo visual={visuals[i]} light={light} width={300} recyclingKey={n.id} style={styles.thumb} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="caption" tone="brand">
                  {`${tx(NEWS_CATEGORY_LABEL[n.category])} · ${newsDate(n.publish_at)}`}
                </Text>
                <Text variant="titleS" numberOfLines={2} raw>
                  {n.title}
                </Text>
                {n.subtitle ? (
                  <Text variant="bodyS" tone="secondary" numberOfLines={2} raw>
                    {n.subtitle}
                  </Text>
                ) : null}
              </View>
              <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
            </PressableScale>
          ))
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.gutter, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.xl, overflow: 'hidden' },
  thumb: { width: 84, height: 84, borderRadius: radius.lg, overflow: 'hidden' },
});
