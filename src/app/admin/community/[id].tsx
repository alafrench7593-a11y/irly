import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CATEGORY_LABEL, isAdmin, isContentStaff, loadCommunity, moderate, updateCommunity, type CommunitySheet } from '@/features/admin/api';
import { PhotoPanel } from '@/features/admin/photos';
import { AdminInput, adminStyles, Card, day, Fact, StatePill, StatusPill, useAdminRole, useLoad } from '@/features/admin/ui';
import { t as tx } from '@/i18n';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * One community, for the team: who created and runs it, its texts and photo
 * (content staff edit them), and the decisions admins take on it: suspend
 * (hidden everywhere, restorable), restore, or delete as its owner would.
 * Every change needs a reason and goes to the moderation log.
 */
export default function AdminCommunity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const role = useAdminRole();
  const { data: c, error, reload } = useLoad<CommunitySheet>(() => loadCommunity(id ?? ''), id ?? '');

  if (error || !c) {
    return (
      <Page title="Community">
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
  // Keyed by the saved texts: the form starts again from what the server holds.
  return <Sheet key={`${c.id}|${c.name}|${c.tagline}|${c.description}`} c={c} reload={reload} role={role} />;
}

function Sheet({ c, reload, role }: { c: CommunitySheet; reload: () => void; role: ReturnType<typeof useAdminRole> }) {
  const [name, setName] = useState(c.name);
  const [tagline, setTagline] = useState(c.tagline ?? '');
  const [description, setDescription] = useState(c.description ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done, 'check', 'brand');
      setReason('');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };

  const why = reason.trim();
  const editable = isContentStaff(role) && !c.removed;
  const edited = name.trim() !== c.name || tagline.trim() !== (c.tagline ?? '') || description.trim() !== (c.description ?? '');

  return (
    <Page title={c.name} overline={c.girl_only ? 'IRLY Girl' : tx('Community')}>
      <View style={adminStyles.body}>
        <View style={adminStyles.row}>
          <StatePill state={c.hold ? 'hidden' : c.removed ? 'removed' : 'visible'} />
          {c.official ? (
            <Text variant="caption" tone="secondary">
              Official
            </Text>
          ) : null}
        </View>
        {c.hold ? (
          <Text variant="bodyS" tone="live" raw>
            {tx('Suspended by {name} on {d}: “{reason}”', { name: c.hold.by ?? 'IRLY', d: day(c.hold.at), reason: c.hold.reason })}
          </Text>
        ) : null}

        <Card>
          <Fact label={tx('Community id')} value={c.id} />
          <Fact label={tx('City')} value={c.city_id} />
          <Fact label={tx('Created on')} value={day(c.created_at)} />
          <Fact label={tx('Created by')} value={c.creator?.name ?? null} />
          <Fact label={tx('Runs it')} value={c.admins.map((a) => `${a.name} (${tx(a.role === 'owner' ? 'Owner' : 'Moderator')})`).join(', ') || null} />
          <Fact label={tx('Members')} value={c.member_count} />
          <Fact label={tx('Groups')} value={c.groups || null} />
          <Fact label={tx('Part of')} value={c.parent_name} />
          {c.creator ? <Button size="sm" variant="ghost" label="Creator's sheet" onPress={() => router.push(`/admin/user/${c.creator?.id}`)} /> : null}
        </Card>

        <PhotoPanel kind="community" id={c.id} role={role} onChanged={reload} />

        {editable ? (
          <Card>
            <Text variant="label">Name and texts</Text>
            <AdminInput value={name} onChange={setName} placeholder="Name" label="Name" max={60} />
            <AdminInput value={tagline} onChange={setTagline} placeholder="Tagline" label="Tagline" max={160} />
            <AdminInput value={description} onChange={setDescription} placeholder="Description" label="Description" multiline max={2000} />
          </Card>
        ) : (
          <Card>
            <Text variant="label">Texts</Text>
            {c.tagline ? (
              <Text variant="bodyS" raw>
                {c.tagline}
              </Text>
            ) : null}
            {c.description ? (
              <Text variant="bodyS" tone="secondary" raw>
                {c.description}
              </Text>
            ) : null}
          </Card>
        )}

        {editable || isAdmin(role) ? (
          <Card>
            <Text variant="label">Decision</Text>
            <AdminInput value={reason} onChange={setReason} placeholder="Reason (kept in the moderation log)" label="Reason" />
            <View style={adminStyles.row}>
              {editable && edited ? (
                <Button size="sm" label="Save the texts" disabled={why.length < 3 || name.trim().length < 3 || busy !== null} loading={busy === 'save'} onPress={() => run('save', () => updateCommunity(c.id, name.trim(), tagline.trim(), description.trim(), why), tx('Saved'))} />
              ) : null}
              {isAdmin(role) && c.hold ? (
                <Button size="sm" label="Restore" icon="eye" variant="secondary" disabled={why.length < 3 || busy !== null} loading={busy === 'restore'} onPress={() => run('restore', () => moderate('community', c.id, 'restore', why), tx('Community restored'))} />
              ) : null}
              {isAdmin(role) && !c.removed ? (
                <Button size="sm" label="Suspend" icon="lock" variant="danger" disabled={why.length < 3 || busy !== null} loading={busy === 'hide'} onPress={() => run('hide', () => moderate('community', c.id, 'hide', why), tx('Community suspended'))} />
              ) : null}
            </View>
            {isAdmin(role) && (!c.removed || c.hold) ? (
              confirmDelete ? (
                <View style={{ gap: space[2] }}>
                  <Text variant="bodyS" tone="secondary">
                    Deleting removes the community and its groups from every list and their chats from every inbox, as when its owner deletes it. It cannot be restored from here. Suspending is usually enough.
                  </Text>
                  <View style={adminStyles.row}>
                    <Button size="sm" label="Delete for good" variant="danger" disabled={why.length < 3 || busy !== null} loading={busy === 'delete'} onPress={() => run('delete', () => moderate('community', c.id, 'delete', why), tx('Community deleted'))} />
                    <Button size="sm" label="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} />
                  </View>
                </View>
              ) : (
                <Button size="sm" label="Delete…" variant="ghost" onPress={() => setConfirmDelete(true)} />
              )
            ) : null}
          </Card>
        ) : null}

        {c.reports.length ? (
          <Card>
            <Text variant="label">Reports about this community</Text>
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

