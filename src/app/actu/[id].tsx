import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useKnownNews, useNewsItem } from '@/features/cms/feed';
import { NewsArticleView } from '@/features/cms/ui';
import { t as tx } from '@/i18n';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * One news item of the IRLY team (/actu/<id>: from the Home, a link, a
 * notification). The server says whether this account may read it now
 * (published, not deleted; an IRLY Girl item only for IRLY Girl members):
 * otherwise the page says it is no longer available.
 */
export default function NewsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const known = useKnownNews(id);
  const { item, error, retry } = useNewsItem(id);

  return (
    <Page title="IRLY news" overline="From the IRLY team">
      {item ? (
        <NewsArticleView item={item} />
      ) : item === null ? (
        <View style={{ paddingHorizontal: space.gutter, gap: space[3] }} testID="news-gone">
          <Text variant="body" tone="secondary">
            This news item is no longer available.
          </Text>
          <Button label="Back to Home" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      ) : error ? (
        <View style={{ paddingHorizontal: space.gutter, gap: space[3] }}>
          <Text variant="body" tone="secondary">
            {tx(error)}
          </Text>
          <Button label="Try again" variant="secondary" onPress={retry} />
        </View>
      ) : known ? (
        <NewsArticleView item={{ ...known, body: '', gallery_paths: [] }} />
      ) : (
        <ActivityIndicator color={t.c.text} style={{ marginTop: space[6] }} />
      )}
    </Page>
  );
}
