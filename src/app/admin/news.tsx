import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { addArticle, loadSources, NEWS_CATEGORIES, saveSource, updateArticle, type NewsCategory, type NewsSource } from '@/features/news/news';
import { a11y, t as tx } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Recent = { id: string; title: string; status: 'published' | 'hidden'; category: NewsCategory; sponsored: boolean; published_at: string; source_id: string | null };

/**
 * IRLY admins: news sources (on only after checking their terms of use;
 * images only when the terms allow it), articles added by hand, and the
 * latest articles to hide, recategorise or label as sponsored.
 */
export default function NewsAdmin() {
  const t = useTheme();
  const now = useNow();
  const [sources, setSources] = useState<NewsSource[] | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    loadSources()
      .then((s) => (setSources(s), setError(null)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
    supabase
      ?.from('news_articles')
      .select('id, title, status, category, sponsored, published_at, source_id')
      .order('fetched_at', { ascending: false })
      .limit(40)
      .then(({ data }) => setRecent((data as Recent[] | null) ?? []));
  }, []);
  useEffect(load, [load]);

  const toggle = (s: NewsSource, patch: Partial<NewsSource>) =>
    saveSource({ ...s, ...patch })
      .then(load)
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live'));

  return (
    <Page title="News sources" subtitle="Turn a source on only after checking that its terms allow showing headlines with a link. Images only when they are allowed too.">
      <View style={styles.body}>
        {error ? (
          <Text variant="body" tone="secondary">
            {tx(error)}
          </Text>
        ) : sources === null ? (
          <ActivityIndicator color={t.c.text} />
        ) : (
          sources.map((s) => (
            <View key={s.id} style={[styles.card, { backgroundColor: t.c.surface }]}>
              <Text variant="titleS" raw>
                {s.name}
              </Text>
              <Text variant="caption" tone="tertiary" raw>
                {[s.feed ?? s.site, tx('{n} articles', { n: s.articles }), s.lastFetchAt ? tx('read {time}', { time: timeAgo(Math.round((now - s.lastFetchAt) / 60000)) }) : null].filter(Boolean).join(' · ')}
              </Text>
              {s.lastError ? (
                <Text variant="caption" tone="live" raw>
                  {s.lastError}
                </Text>
              ) : null}
              {s.notes ? (
                <Text variant="bodyS" tone="secondary" raw>
                  {s.notes}
                </Text>
              ) : null}
              <Toggle label="Terms of use checked" value={s.termsChecked} onChange={(v) => toggle(s, { termsChecked: v, active: v ? s.active : false })} />
              <Toggle label="On (read every hour)" value={s.active} disabled={!s.termsChecked} onChange={(v) => toggle(s, { active: v })} />
              <Toggle label="Show its images" value={s.showImages} disabled={!s.termsChecked} onChange={(v) => toggle(s, { showImages: v })} />
            </View>
          ))
        )}
        <NewSource onDone={load} />
        <NewArticle onDone={load} />
        <Text variant="titleM">Latest articles</Text>
        {recent.map((a) => (
          <View key={a.id} style={[styles.card, { backgroundColor: t.c.surface, opacity: a.status === 'hidden' ? 0.5 : 1 }]}>
            <Text variant="label" raw>
              {a.title}
            </Text>
            <View style={styles.wrap}>
              <Chip size="sm" label={a.status === 'hidden' ? tx('Show') : tx('Hide')} onPress={() => updateArticle(a.id, { status: a.status === 'hidden' ? 'published' : 'hidden' }).then(load)} />
              <Chip size="sm" label={tx('Sponsored')} selected={a.sponsored} onPress={() => updateArticle(a.id, { sponsored: !a.sponsored }).then(load)} />
              {NEWS_CATEGORIES.map((c) => (
                <Chip key={c.id} size="sm" label={tx(c.label)} selected={a.category === c.id} onPress={() => updateArticle(a.id, { category: c.id }).then(load)} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Page>
  );
}

function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.toggle}>
      <Text variant="bodyS" style={{ flex: 1, opacity: disabled ? 0.5 : 1 }}>
        {tx(label)}
      </Text>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: t.c.brand, false: t.c.overlay }} thumbColor="#FFFFFF" accessibilityLabel={a11y(label)} />
    </View>
  );
}

function NewSource({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [site, setSite] = useState('');
  const [feed, setFeed] = useState('');
  const [keywords, setKeywords] = useState('');
  const [category, setCategory] = useState<NewsCategory>('local');
  const input = [styles.input, { color: t.c.text, backgroundColor: t.c.overlay }];
  const add = () =>
    saveSource({ id: null, name, site, feed: feed || null, kind: 'media', category, active: false, termsChecked: false, showImages: false, notes: null, keywords: keywords || null })
      .then(() => {
        setName('');
        setSite('');
        setFeed('');
        setKeywords('');
        onDone();
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live'));
  return (
    <View style={[styles.card, { backgroundColor: t.c.surface }]}>
      <Text variant="titleS">Add a source (off until checked)</Text>
      <TextInput value={name} onChangeText={setName} placeholder={tx('Name')} placeholderTextColor={t.c.textTertiary} style={input} accessibilityLabel={a11y('Name')} />
      <TextInput value={site} onChangeText={setSite} placeholder="https://…" autoCapitalize="none" placeholderTextColor={t.c.textTertiary} style={input} accessibilityLabel={a11y('Website')} />
      <TextInput value={feed} onChangeText={setFeed} placeholder={tx('RSS or Atom feed (optional)')} autoCapitalize="none" placeholderTextColor={t.c.textTertiary} style={input} accessibilityLabel={a11y('Feed')} />
      <TextInput value={keywords} onChangeText={setKeywords} placeholder={tx('Keep only items matching (e.g. dubai|uae)')} autoCapitalize="none" placeholderTextColor={t.c.textTertiary} style={input} accessibilityLabel={a11y('Keywords')} />
      <View style={styles.wrap}>
        {NEWS_CATEGORIES.map((c) => (
          <Chip key={c.id} size="sm" label={tx(c.label)} selected={category === c.id} onPress={() => setCategory(c.id)} />
        ))}
      </View>
      <Button label="Add the source" icon="plus" disabled={name.trim().length < 2 || !/^https?:\/\//.test(site)} onPress={add} />
    </View>
  );
}

function NewArticle({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<NewsCategory>('practical');
  const [sponsored, setSponsored] = useState(false);
  const input = [styles.input, { color: t.c.text, backgroundColor: t.c.overlay }];
  const add = () =>
    addArticle({ title, summary, url, category, sponsored })
      .then(() => {
        setTitle('');
        setSummary('');
        setUrl('');
        setSponsored(false);
        toast('Published', 'check', 'brand');
        onDone();
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not publish', 'x', 'live'));
  return (
    <View style={[styles.card, { backgroundColor: t.c.surface }]}>
      <Text variant="titleS">Add an article by hand</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder={tx('Title')} placeholderTextColor={t.c.textTertiary} style={input} accessibilityLabel={a11y('Title')} />
      <TextInput value={summary} onChangeText={(v) => setSummary(v.slice(0, 600))} placeholder={tx('Short summary')} placeholderTextColor={t.c.textTertiary} style={[input, { height: 80 }]} multiline accessibilityLabel={a11y('Summary')} />
      <TextInput value={url} onChangeText={setUrl} placeholder={tx('Link to the original (https://…)')} autoCapitalize="none" placeholderTextColor={t.c.textTertiary} style={input} accessibilityLabel={a11y('Link')} />
      <View style={styles.wrap}>
        {NEWS_CATEGORIES.map((c) => (
          <Chip key={c.id} size="sm" label={tx(c.label)} selected={category === c.id} onPress={() => setCategory(c.id)} />
        ))}
      </View>
      <Toggle label="Sponsored (labelled for members)" value={sponsored} onChange={setSponsored} />
      <Button label="Publish" icon="send" disabled={title.trim().length < 3 || !/^https?:\/\//.test(url)} onPress={add} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[4] },
  card: { padding: 14, gap: 8, borderRadius: radius.xl },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { height: 44, borderRadius: radius.lg, paddingHorizontal: 12, fontFamily: font.medium, fontSize: 15 },
});
