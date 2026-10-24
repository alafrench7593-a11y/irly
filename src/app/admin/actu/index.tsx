import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { PressableScale } from '@/motion/PressableScale';
import { isContentStaff } from '@/features/admin/api';
import { adminStyles, Card, Loadable, NoAccess, useAdminRole, useLoad } from '@/features/admin/ui';
import { loadAdminNews, reorderNews, type AdminNews } from '@/features/cms/api';
import { AUDIENCE_LABEL, ErrorLine, MoveButtons, NewsStatePill } from '@/features/cms/adminUi';
import { NEWS_CATEGORY_LABEL, NEWS_PHOTO } from '@/features/cms/feed';
import { useCmsVisuals } from '@/features/cms/ui';
import { t as tx } from '@/i18n';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Back office › IRLY news: every item the team wrote (drafts, scheduled,
 * published, unpublished), in the order members see them. Content staff and
 * above; the server checks the role again on every call.
 */
export default function AdminNewsList() {
  const role = useAdminRole();
  const { data, error, reload } = useLoad<AdminNews[]>(loadAdminNews, 'admin-news');
  // The order just moved here, until the list is read again.
  const [moved, setMoved] = useState<{ from: AdminNews[] | null; rows: AdminNews[] } | null>(null);
  const rows = moved && moved.from === data ? moved.rows : data;
  const [busy, setBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const move = async (i: number, d: -1 | 1) => {
    if (!rows) return;
    const next = [...rows];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setMoved({ from: data, rows: next });
    setBusy(true);
    setMoveError(null);
    try {
      await reorderNews(next.map((n) => n.id));
      toast('Order saved', 'check', 'brand');
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : 'Could not save');
      setMoved({ from: data, rows });
    } finally {
      setBusy(false);
    }
  };

  if (role !== undefined && !isContentStaff(role)) {
    return (
      <Page title="IRLY news">
        <View style={adminStyles.body}>
          <NoAccess />
        </View>
      </Page>
    );
  }
  return (
    <Page title="IRLY news" subtitle="What the team publishes on the Home of IRLY and IRLY Girl. Drafts stay with the team; members see an item once it is published and its time has come.">
      <View style={adminStyles.body}>
        <Button label="New news item" icon="plus" onPress={() => router.push('/admin/actu/new')} />
        <ErrorLine error={moveError} />
        <Loadable data={rows} error={error} retry={reload} empty={tx('No news yet. Write the first one.')}>
          {(list) => list.map((n, i) => <Row key={n.id} n={n} index={i} busy={busy} onUp={i > 0 ? () => void move(i, -1) : undefined} onDown={i < list.length - 1 ? () => void move(i, 1) : undefined} />)}
        </Loadable>
      </View>
    </Page>
  );
}

function Row({ n, index, busy, onUp, onDown }: { n: AdminNews; index: number; busy: boolean; onUp?: () => void; onDown?: () => void }) {
  const t = useTheme();
  const [visual] = useCmsVisuals([{ path: n.cover_path, key: n.cover_key, fallback: NEWS_PHOTO[n.category] }]);
  return (
    <Card index={index}>
      <View style={styles.row} testID="admin-news-row">
        {/* The item opens from its photo and texts; the move buttons sit beside, not inside (no button in a button on the web). */}
        <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push(`/admin/actu/${n.id}`)} accessibilityRole="button" accessibilityLabel={n.title} style={styles.open}>
          <Photo visual={visual} light="dubai" width={240} pinned style={styles.thumb} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="titleS" numberOfLines={2} raw>
              {n.title}
            </Text>
            <View style={adminStyles.row}>
              <NewsStatePill state={n.state} at={n.publish_at} />
              <Text variant="caption" tone="secondary">
                {`${tx(AUDIENCE_LABEL[n.audience])} · ${tx(NEWS_CATEGORY_LABEL[n.category])}`}
              </Text>
              {n.notify ? <Icon name="bell" size={14} color={n.notified_at ? t.c.textTertiary : t.c.brand} /> : null}
            </View>
          </View>
        </PressableScale>
        <MoveButtons label={n.title} onUp={onUp} onDown={onDown} disabled={busy} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: radius.lg, overflow: 'hidden' },
});
