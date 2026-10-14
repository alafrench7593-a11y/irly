import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
import { NEWS_CATEGORIES, useNews, type NewsCategory, type NewsItem } from '@/features/news/news';
import { toggleSave } from '@/features/server/engage';
import { useIsAdmin } from '@/features/verify/verify';
import { a11y, t as tx } from '@/i18n';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Dubai News & Life: the city's news and practical information, from the
 * sources themselves. Each item shows its date and source and opens the
 * original article. Nothing older than 30 days is shown as news.
 */
export default function NewsScreen() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const cityId = useCityId();
  const admin = useIsAdmin();
  const [category, setCategory] = useState<NewsCategory | null>(null);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState('');
  const news = useNews(cityId, category, query, saved);

  return (
    <Page
      overline="Dubai"
      title="Dubai News & Life"
      subtitle="What's happening in the city, from the sources themselves. Tap to read the full article on their site."
      right={admin ? <Button label="Sources" size="sm" variant="ghost" onPress={() => router.push('/admin/news')} /> : undefined}
    >
      <View style={{ gap: space[4] }}>
        <View style={styles.pad}>
          <View style={[styles.search, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
            <Icon name="search" size={18} color={t.c.textTertiary} />
            <TextInput value={query} onChangeText={setQuery} placeholder={tx('Search the news')} placeholderTextColor={t.c.textTertiary} style={[styles.searchInput, { color: t.c.text }]} accessibilityLabel={a11y('Search the news')} />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
          <Chip size="sm" label={tx('Latest')} selected={!category && !saved} onPress={() => (setCategory(null), setSaved(false))} />
          <Chip size="sm" icon="bookmark" label={tx('Saved')} selected={saved} onPress={() => setSaved(!saved)} />
          {NEWS_CATEGORIES.map((c) => (
            <Chip key={c.id} size="sm" icon={c.icon} label={tx(c.label)} selected={category === c.id} onPress={() => setCategory(category === c.id ? null : c.id)} />
          ))}
        </ScrollView>
        {!account ? (
          <View style={[styles.pad, { gap: 10 }]}>
            <Text variant="body" tone="secondary">
              Sign in to read Dubai News & Life.
            </Text>
            <Button label="Sign in" onPress={() => router.push('/account')} />
          </View>
        ) : news.loading ? (
          <ActivityIndicator color={t.c.text} style={{ marginTop: 24 }} />
        ) : news.error ? (
          <View style={[styles.pad, { gap: 10 }]}>
            <Text variant="body" tone="secondary">
              {tx(news.error)}
            </Text>
            <Button label="Try again" variant="secondary" onPress={news.reload} />
          </View>
        ) : !news.items.length ? (
          <View style={[styles.empty, { backgroundColor: t.c.surface }]}>
            <Icon name="news" size={22} color={t.c.textSecondary} />
            <Text variant="body" tone="secondary" align="center">
              {saved ? 'Nothing saved yet.' : query ? 'Nothing found.' : 'No news yet. Sources are added by the IRLY team; check back soon.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.pad, { gap: 12 }]}>
            {news.items.map((n) => (
              <NewsCard key={n.id} n={n} />
            ))}
            <Text variant="caption" tone="tertiary" align="center">
              News comes from its sources; members’ posts are in communities.
            </Text>
          </View>
        )}
      </View>
    </Page>
  );
}

function NewsCard({ n }: { n: NewsItem }) {
  const t = useTheme();
  const now = useNow();
  const [saved, setSaved] = useState(n.saved);
  const open = () => WebBrowser.openBrowserAsync(n.url).catch(() => toast('Could not open the article', 'x', 'live'));
  const minutes = Math.max(0, Math.round((now - n.publishedAt) / 60000));
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={open} style={[styles.card, { backgroundColor: t.c.surface, borderColor: t.c.line }]} accessibilityRole="link" accessibilityLabel={`${n.title}. ${n.source}`}>
      {n.image ? <Image source={{ uri: n.image }} style={styles.image} contentFit="cover" transition={150} /> : null}
      <View style={{ gap: 6 }}>
        <Text variant="caption" tone="tertiary" raw>
          {[n.sponsored ? tx('Sponsored') : null, n.source, tx(NEWS_CATEGORIES.find((c) => c.id === n.category)?.label ?? ''), timeAgo(minutes)].filter(Boolean).join(' · ')}
        </Text>
        <Text variant="titleS" raw>
          {n.title}
        </Text>
        {n.summary ? (
          <Text variant="bodyS" tone="secondary" numberOfLines={3} raw>
            {n.summary}
          </Text>
        ) : null}
      </View>
      <View style={styles.row}>
        <Text variant="label" style={{ flex: 1 }}>
          {tx('Read on {source}', { source: n.source })}
        </Text>
        <PressableScale
          haptic="select"
          hitSlop={8}
          onPress={() => Share.share({ message: `${n.title} ${n.url}`, url: n.url }).catch(() => undefined)}
          accessibilityLabel={a11y('Share')}
        >
          <Icon name="share" size={18} color={t.c.textTertiary} />
        </PressableScale>
        <PressableScale
          haptic="select"
          hitSlop={8}
          onPress={() => {
            setSaved(!saved);
            toggleSave({ type: 'news', id: n.id })
              .then((now) => {
                // The server toggles: its answer is the truth (saved elsewhere meanwhile, a quick double tap).
                setSaved(now);
                haptic('success');
              })
              .catch(() => {
                setSaved(saved);
                toast('Could not save', 'x', 'live');
              });
          }}
          accessibilityLabel={saved ? a11y('Saved') : a11y('Save')}
        >
          <Icon name="bookmark" size={18} color={saved ? t.c.text : t.c.textTertiary} />
        </PressableScale>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontFamily: font.medium, fontSize: 16 },
  empty: { marginHorizontal: space.gutter, padding: 24, borderRadius: radius.xl, alignItems: 'center', gap: 10 },
  card: { padding: 14, gap: 10, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  image: { height: 160, borderRadius: radius.lg },
});
