import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CATEGORY_LABEL, isAdmin, loadContentItem, moderate, type ContentItem, type ContentKind } from '@/features/admin/api';
import { ITEM_LABEL } from '@/features/admin/labels';
import { PhotoPanel } from '@/features/admin/photos';
import { AdminInput, adminStyles, Card, day, Fact, StatePill, StatusPill, useAdminRole, useLoad } from '@/features/admin/ui';
import { t as tx } from '@/i18n';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const KINDS: ContentKind[] = ['activity', 'community_post', 'comment', 'irl_post'];

/**
 * One activity, post, comment or live: its words, its author, the reports
 * about it, and the admins' decisions (hide: soft and restorable; restore;
 * delete: final, the words kept 12 months for moderation). A reason is required.
 */
export default function AdminItem() {
  const p = useLocalSearchParams<{ kind?: string; id?: string }>();
  const kind = (KINDS.includes(p.kind as ContentKind) ? p.kind : 'activity') as ContentKind;
  const id = p.id ?? '';
  const t = useTheme();
  const role = useAdminRole();
  const { data: c, error, reload } = useLoad<ContentItem>(() => loadContentItem(kind, id), `${kind}|${id}`);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (key: string, action: 'hide' | 'restore' | 'delete', done: string) => {
    setBusy(key);
    try {
      await moderate(kind, id, action, reason.trim());
      toast(done, 'check', 'brand');
      setReason('');
      setConfirmDelete(false);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };

  if (error || !c) {
    return (
      <Page title={ITEM_LABEL[kind]}>
        <View style={adminStyles.body}>
          {error ? (
            <>
              <Text variant="body" tone="secondary">
                {tx(error)}
              </Text>
              <Button label="Try again" variant="secondary" onPress={reload} />
            </>
          ) : (
            <ActivityIndicator color={t.c.text} />
          )}
        </View>
      </Page>
    );
  }

  const hidden = Boolean(c.hold && !c.hold.final);
  const state = c.gone ? 'deleted' : hidden ? 'hidden' : c.cancelled ? 'cancelled' : c.deleted ? 'deleted' : 'visible';
  const why = reason.trim();

  return (
    <Page title={c.title ?? tx(ITEM_LABEL[kind])} overline={c.girl_only ? 'IRLY Girl' : tx(ITEM_LABEL[kind])}>
      <View style={adminStyles.body}>
        <View style={adminStyles.row}>
          <StatePill state={state} />
        </View>
        {c.hold ? (
          <Text variant="bodyS" tone="live" raw>
            {tx(c.hold.final ? 'Deleted by {name} on {d}: “{reason}”' : 'Hidden by {name} on {d}: “{reason}”', { name: c.hold.by ?? 'IRLY', d: day(c.hold.at), reason: c.hold.reason })}
          </Text>
        ) : null}

        <Card>
          {c.body ? (
            <Text variant="body" raw>
              {c.body}
            </Text>
          ) : (
            <Text variant="bodyS" tone="tertiary">
              No text.
            </Text>
          )}
          <Fact label={tx('Author')} value={c.author_name ?? null} />
          <Fact label={tx('Posted')} value={c.created_at ? day(c.created_at) : null} />
          <Fact label={tx('Starts')} value={c.starts_at ? day(c.starts_at) : null} />
          <Fact label={tx('Place')} value={[c.place, c.city].filter(Boolean).join(', ') || null} />
          <Fact label={tx('Community')} value={c.community ?? null} />
          <Fact label={tx('Going')} value={c.going ?? null} />
          <Fact label={tx('Media')} value={c.media ? String(c.media) : null} />
          <Fact label={tx('Id')} value={c.id} />
          {c.author_id ? <Button size="sm" variant="ghost" label="Author's sheet" onPress={() => router.push(`/admin/user/${c.author_id}`)} /> : null}
        </Card>

        {kind !== 'comment' && !c.gone ? <PhotoPanel kind={kind} id={id} role={role} onChanged={reload} /> : null}

        {isAdmin(role) && !c.gone ? (
          <Card>
            <Text variant="label">Decision</Text>
            <AdminInput value={reason} onChange={setReason} placeholder="Reason (kept in the moderation log)" label="Reason" />
            <View style={adminStyles.row}>
              {hidden ? (
                <Button size="sm" label="Restore" icon="eye" variant="secondary" disabled={why.length < 3 || busy !== null} loading={busy === 'restore'} onPress={() => run('restore', 'restore', tx('Restored'))} />
              ) : state === 'visible' || (kind === 'activity' && state === 'cancelled') ? (
                <Button size="sm" label={kind === 'activity' ? 'Suspend (hide)' : 'Hide'} icon="lock" variant="danger" disabled={why.length < 3 || busy !== null} loading={busy === 'hide'} onPress={() => run('hide', 'hide', tx('Hidden'))} />
              ) : null}
              {!confirmDelete ? <Button size="sm" label="Delete…" variant="ghost" onPress={() => setConfirmDelete(true)} /> : null}
            </View>
            {confirmDelete ? (
              <View style={{ gap: space[2] }}>
                <Text variant="bodyS" tone="secondary">
                  Deleting is final: the item goes for everyone (people going to an activity are told). Its words are kept 12 months for moderation. Hiding is usually enough.
                </Text>
                <View style={adminStyles.row}>
                  <Button size="sm" label="Delete for good" variant="danger" disabled={why.length < 3 || busy !== null} loading={busy === 'delete'} onPress={() => run('delete', 'delete', tx('Deleted'))} />
                  <Button size="sm" label="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} />
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}

        {c.reports.length ? (
          <Card>
            <Text variant="label">Reports about it</Text>
            {c.reports.map((r, i) => (
              <View key={r.case_id} style={{ gap: 4 }}>
                {i ? <Divider /> : null}
                <View style={adminStyles.row}>
                  <StatusPill status={r.status} />
                  <Text variant="bodyS" style={{ flex: 1 }} raw>
                    {tx(CATEGORY_LABEL[r.category] ?? r.category)} · {day(r.created_at)}
                  </Text>
                </View>
                <Button size="sm" variant="ghost" label="Open the report" onPress={() => router.push(`/admin/case/${r.case_id}`)} />
              </View>
            ))}
          </Card>
        ) : null}
      </View>
    </Page>
  );
}
