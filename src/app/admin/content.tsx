import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Chip, Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { itemSpaces, loadContent, SPACE_LABEL, type ContentKind, type ContentRow, type Space } from '@/features/admin/api';
import { adminStyles, ago, Card, Loadable, StatePill, useLoad } from '@/features/admin/ui';
import { t as tx } from '@/i18n';

const KINDS: { value: ContentKind; label: string }[] = [
  { value: 'activity', label: 'Activities' },
  { value: 'community_post', label: 'Posts' },
  { value: 'comment', label: 'Comments' },
  { value: 'irl_post', label: 'Lives' },
];
const SPACES: { value: Space | null; label: string }[] = [
  { value: null, label: 'Every space' },
  { value: 'mixte', label: 'IRLY Mixte' },
  { value: 'girl', label: 'IRLY Girl' },
  { value: 'mom', label: 'IRLY Mom Community' },
];
type Row = ContentRow & { space: Space | null };

/** The rows, each with its space (one more request for the whole page). */
async function loadWithSpaces(kind: ContentKind, q: string, filter: string | null): Promise<Row[]> {
  const rows = await loadContent(kind, q, filter);
  const spaces = new Map((await itemSpaces(kind, rows.map((r) => r.id))).map((x) => [x.id, x.space]));
  return rows.map((r) => ({ ...r, space: spaces.get(r.id) ?? null }));
}

const FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'reported', label: 'Reported' },
  { value: 'hidden', label: 'Hidden by the team' },
];

/** Activities, posts, comments and lives: search by words, author or id, then open one to decide. */
export default function AdminContent() {
  const p = useLocalSearchParams<{ kind?: string; filter?: string; space?: string }>();
  const [where, setWhere] = useState<Space | null>(SPACES.some((x) => x.value === p.space) ? (p.space as Space) : null);
  const [kind, setKind] = useState<ContentKind>(KINDS.some((k) => k.value === p.kind) ? (p.kind as ContentKind) : 'activity');
  const [filter, setFilter] = useState<string | null>(p.filter === 'hidden' || p.filter === 'reported' ? p.filter : null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  const { data: all, error, reload } = useLoad<Row[]>(() => loadWithSpaces(kind, q, filter), `${kind}|${q}|${filter}`);
  const data = all && where ? all.filter((r) => r.space === where) : all;

  return (
    <Page title="Activities and posts" subtitle="Newest first. What the team hides disappears from lists, search and the map, and can be restored.">
      <View style={adminStyles.body}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {KINDS.map((k) => (
            <Chip key={k.value} size="sm" label={k.label} selected={kind === k.value} onPress={() => setKind(k.value)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {SPACES.map((x) => (
            <Chip key={String(x.value)} size="sm" label={x.label} selected={where === x.value} onPress={() => setWhere(x.value)} />
          ))}
        </ScrollView>
        {where ? (
          <Text variant="caption" tone="secondary">
            {tx('You are moderating {space}.', { space: tx(SPACE_LABEL[where]) })}
          </Text>
        ) : null}
        <Field icon="search" value={search} onChangeText={setSearch} placeholder="Words, author or id" accessibilityLabel="Search content" autoCapitalize="none" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {FILTERS.map((f) => (
            <Chip key={String(f.value)} size="sm" label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
        <Loadable data={data} error={error} retry={reload} empty="Nothing here.">
          {(list) =>
            list.map((c, i) => (
              <Card index={i} key={c.id} onPress={() => router.push(`/admin/item?kind=${c.kind}&id=${c.id}`)} accessibilityLabel={tx('Open')}>
                <View style={adminStyles.row}>
                  <Text variant="titleS" style={{ flex: 1 }} numberOfLines={1} raw>
                    {c.title ?? c.author_name ?? '—'}
                  </Text>
                  <StatePill state={c.state} />
                </View>
                {c.body ? (
                  <Text variant="bodyS" numberOfLines={2} raw>
                    {c.body}
                  </Text>
                ) : null}
                <Text variant="caption" tone="secondary" raw>
                  {[c.author_name, ago(c.created_at), c.context, c.space ? tx(SPACE_LABEL[c.space]) : c.girl_only ? 'IRLY Girl' : null, c.reports ? (c.reports === 1 ? tx('1 report') : tx('{n} reports', { n: c.reports })) : null].filter(Boolean).join(' · ')}
                </Text>
              </Card>
            ))
          }
        </Loadable>
      </View>
    </Page>
  );
}
