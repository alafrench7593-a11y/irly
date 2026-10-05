import { useLocalSearchParams, useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useGuides, type Guide, type GuideKind } from '@/features/bali/data';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const KIND: Record<GuideKind, { label: string; icon: 'shield' | 'sparkles' | 'briefcase' }> = {
  official: { label: 'Official information', icon: 'shield' },
  irly_guide: { label: 'IRLY Guide', icon: 'sparkles' },
  third_party: { label: 'Third-party service', icon: 'briefcase' },
};
const title = (s: string) => (s === 'visa' ? 'Visa & stay' : s === 'sim' ? 'SIM / eSIM' : s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()));
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

/**
 * A relocation topic. Official information first (with its source and the
 * date we last checked it), then the IRLY Guide, then third-party services,
 * each clearly labelled. IRLY never invents rules, fees or requirements.
 */
export default function GuideScreen() {
  const t = useTheme();
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: string }>();
  const { data, loading, error } = useGuides('bali', section);
  const order: GuideKind[] = ['official', 'irly_guide', 'third_party'];

  return (
    <Page overline="My Bali move" title={tx(title(section))}>
      <View style={styles.body}>
        {loading ? <ActivityIndicator color={t.c.text} /> : null}
        {error ? (
          <Text variant="body" tone="secondary">
            Could not load this guide. Check your connection.
          </Text>
        ) : null}
        {!loading && !data.length ? (
          <View style={[styles.card, { backgroundColor: t.c.surface }]}>
            <Text variant="body" tone="secondary">
              This guide is being written. Ask your area’s community on IRLY in the meantime.
            </Text>
            <Button label="Communities" icon="users" size="sm" onPress={() => router.push('/communities')} />
          </View>
        ) : null}
        {order.map((k) => {
          const list = data.filter((g) => g.kind === k);
          if (!list.length) return null;
          return (
            <View key={k} style={{ gap: 10 }}>
              <View style={styles.kind}>
                <Icon name={KIND[k].icon} size={16} color={k === 'official' ? t.c.positive : t.c.textSecondary} />
                <Text variant="overline" tone="secondary">
                  {tx(KIND[k].label)}
                </Text>
              </View>
              {list.map((g) => (
                <Article key={g.id} g={g} />
              ))}
            </View>
          );
        })}
        <Text variant="caption" tone="tertiary">
          IRLY is not a legal or immigration adviser. Rules change: always confirm with the official source before you act.
        </Text>
      </View>
    </Page>
  );
}

function Article({ g }: { g: Guide }) {
  const t = useTheme();
  const verified = date(g.lastVerifiedAt);
  return (
    <View style={[styles.card, { backgroundColor: t.c.surface, borderColor: g.kind === 'official' ? t.c.positive : 'transparent' }]}>
      <Text variant="titleS">{tx(g.title)}</Text>
      <Text variant="body" tone="secondary">
        {tx(g.body)}
      </Text>
      {g.sourceName ? (
        <Text variant="caption" tone="tertiary">
          {tx('Source: {name}', { name: g.sourceName })}
          {g.sourceDate ? ` · ${date(g.sourceDate)}` : ''}
        </Text>
      ) : null}
      {g.kind === 'official' ? (
        <Text variant="caption" color={verified ? t.c.positive : t.c.textTertiary}>
          {verified ? tx('Last verified by IRLY: {date}', { date: verified }) : tx('Not verified by IRLY yet: check the official source')}
        </Text>
      ) : null}
      {g.sourceUrl ? <Button label="Open the official source" icon="arrowUpRight" size="sm" variant="secondary" onPress={() => Linking.openURL(g.sourceUrl as string)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[5] },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: { padding: 16, borderRadius: radius.xl, gap: 8, borderWidth: 1 },
});
