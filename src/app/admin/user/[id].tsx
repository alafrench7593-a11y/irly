import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Divider } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import {
  CATEGORY_LABEL,
  deleteAccount,
  isAdmin,
  isModerator,
  KIND_LABEL,
  liftSanction,
  loadUser,
  reactivate,
  sanction,
  suspendUntil,
  type UserSheet,
} from '@/features/admin/api';
import { ACTION_LABEL } from '@/features/admin/labels';
import { PhotoPanel } from '@/features/admin/photos';
import { AdminInput, adminStyles, Card, day, Fact, StatePill, StatusPill, useAdminRole, useLoad } from '@/features/admin/ui';
import { t as tx } from '@/i18n';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const DAYS = [1, 3, 7, 14, 30, 90];

/**
 * One member, for the team: status, what was reported about them, their
 * sanctions and every staff action about them. Suspension (until a date) is
 * the usual answer; a ban and an account deletion are for admins, the
 * deletion only after typing DELETE, through the member's own deletion.
 */
export default function UserSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const role = useAdminRole();
  const { data: u, error, reload } = useLoad<UserSheet>(() => loadUser(id ?? ''), id ?? '');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [now] = useState(() => Date.now());

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done, 'check', 'brand');
      setReason('');
      reload();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (error || !u) {
    return (
      <Page title="Member">
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

  const until = new Date(now + days * 86_400_000);
  const why = reason.trim();
  const canAct = isModerator(role) && !u.role && u.status !== 'deleted';
  const restricted = u.status === 'suspended' || u.status === 'banned';

  return (
    <Page title={u.first_name ?? tx('Member')} overline={u.username ? `@${u.username}` : undefined}>
      <View style={adminStyles.body}>
        <View style={adminStyles.row}>
          <StatePill state={u.status} />
          {u.status_until ? (
            <Text variant="caption" tone="live" raw>
              {tx('until {d}', { d: day(u.status_until) })}
            </Text>
          ) : null}
        </View>

        <Card>
          <Fact label={tx('Member id')} value={u.id} />
          <Fact label={tx('Email')} value={u.email} />
          <Fact label={tx('Joined')} value={day(u.created_at)} />
          <Fact label={tx('City')} value={u.city_id} />
          <Fact label={tx('Team role')} value={u.role ? tx(u.role[0].toUpperCase() + u.role.slice(1)) : null} />
          <Fact label={tx('Verified')} value={u.verified ? tx('Yes') : tx('No')} />
          <Fact
            label={tx('Activity')}
            value={tx('{a} activities · {c} communities run · {p} posts', { a: u.counts.activities, c: u.counts.communities, p: u.counts.posts })}
          />
          <Fact label={tx('Reports')} value={tx('{n} about them · {m} filed', { n: u.counts.reports_about, m: u.counts.reports_filed })} />
        </Card>

        {/* Profile and IRLY Match photos (moderators): removed only, never replaced; verification selfies stay in Profile verifications. */}
        {isModerator(role) && u.status !== 'deleted' ? <PhotoPanel kind="profile" id={u.id} role={role} onChanged={reload} /> : null}

        {u.reports.length ? (
          <Card>
            <Text variant="label">Reports about this member</Text>
            {u.reports.map((r, i) => (
              <View key={r.case_id} style={{ gap: 4 }}>
                {i ? <Divider /> : null}
                <View style={adminStyles.row}>
                  <StatusPill status={r.status} />
                  <Text variant="bodyS" style={{ flex: 1 }} raw>
                    {tx(CATEGORY_LABEL[r.category] ?? r.category)} · {tx(KIND_LABEL[r.target_kind] ?? r.target_kind)} · {day(r.created_at)}
                  </Text>
                </View>
                <Button size="sm" variant="ghost" label="Open the report" onPress={() => router.push(`/admin/case/${r.case_id}`)} />
              </View>
            ))}
          </Card>
        ) : null}

        {canAct ? (
          <Card>
            <Text variant="label">Decision</Text>
            <AdminInput value={reason} onChange={setReason} placeholder="Reason (kept in the member history)" label="Reason" />
            {restricted ? (
              <Button
                label="Reactivate the account"
                icon="check"
                variant="secondary"
                disabled={why.length < 3 || busy !== null || (u.status === 'banned' && !isAdmin(role))}
                loading={busy === 'reactivate'}
                onPress={() => run('reactivate', () => reactivate(u.id, why), tx('Account reactivated'))}
              />
            ) : null}
            <Text variant="caption" tone="secondary">
              Suspension (preferred): the member keeps their account and data but cannot post, message, join or edit until the end date. They can still report and delete their account.
            </Text>
            <View style={adminStyles.row}>
              {DAYS.filter((d) => isAdmin(role) || d <= 7).map((d) => (
                <Chip key={d} size="sm" label={tx('{n} d', { n: d })} selected={days === d} onPress={() => setDays(d)} />
              ))}
            </View>
            <Text variant="bodyS" raw>
              {tx('Ends on {d}', { d: day(until.toISOString()) })}
            </Text>
            <View style={adminStyles.row}>
              <Button size="sm" label="Suspend" icon="lock" variant="danger" disabled={why.length < 3 || busy !== null} loading={busy === 'suspend'} onPress={() => run('suspend', () => suspendUntil(u.id, new Date(Date.now() + days * 86_400_000), why), tx('Member suspended'))} />
              <Button size="sm" label="Send a warning" variant="secondary" disabled={why.length < 3 || busy !== null} loading={busy === 'warn'} onPress={() => run('warn', () => sanction(u.id, 'warning', why, null, null), tx('Warning sent'))} />
              {isAdmin(role) && u.status !== 'banned' ? (
                <Button size="sm" label="Ban" variant="ghost" disabled={why.length < 3 || busy !== null} loading={busy === 'ban'} onPress={() => run('ban', () => sanction(u.id, 'ban', why, null, null), tx('Member banned'))} />
              ) : null}
            </View>
          </Card>
        ) : u.role ? (
          <Text variant="bodyS" tone="tertiary">
            This member is on the IRLY team: change their role first (Team and roles).
          </Text>
        ) : null}

        {u.sanctions.length ? (
          <Card>
            <Text variant="label">Sanctions</Text>
            {u.sanctions.map((s, i) => {
              const active = !s.lifted_at && (!s.ends_at || new Date(s.ends_at) > new Date());
              return (
                <View key={s.id} style={{ gap: 2 }}>
                  {i ? <Divider /> : null}
                  <Text variant="bodyS" raw>
                    {tx(SANCTION[s.kind])} · {day(s.created_at)} · {s.by ?? 'IRLY'}
                  </Text>
                  <Text variant="caption" tone="secondary" raw>
                    {s.reason}
                    {s.ends_at ? ` · ${tx('until {d}', { d: day(s.ends_at) })}` : ''}
                    {s.lifted_at ? ` · ${tx('lifted {d}', { d: day(s.lifted_at) })}${s.lift_reason ? ` (${s.lift_reason})` : ''}` : ''}
                  </Text>
                  {active && canAct && (s.kind !== 'ban' || isAdmin(role)) ? (
                    <Button size="sm" variant="ghost" label="Lift" disabled={why.length < 3 || busy !== null} onPress={() => run('lift', () => liftSanction(s.id, why), tx('Sanction lifted'))} />
                  ) : null}
                </View>
              );
            })}
          </Card>
        ) : null}

        {u.history.length ? (
          <Card>
            <Text variant="label">Team actions about this member</Text>
            {u.history.map((h, i) => (
              <View key={i} style={{ gap: 2 }}>
                {i ? <Divider /> : null}
                <Text variant="caption" tone="tertiary" raw>
                  {day(h.at)} · {h.by}
                </Text>
                <Text variant="bodyS" raw>
                  {tx(ACTION_LABEL[h.action] ?? h.action)}
                  {h.reason ? ` · “${h.reason}”` : ''}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {isAdmin(role) && !u.role && u.status !== 'deleted' ? (
          <Card>
            <Text variant="label">Delete this account</Text>
            {!deleting ? (
              <Button label="Delete the account…" variant="ghost" icon="x" onPress={() => setDeleting(true)} />
            ) : (
              <View style={{ gap: space[2] }}>
                <Text variant="bodyS" raw>
                  {tx('You are about to delete {name} ({id}).', { name: u.first_name ?? '—', id: u.id })}
                </Text>
                <Text variant="bodyS" tone="secondary">
                  This cannot be undone. Their profile, photos, messages, plans and memberships are removed, their stored files are queued for deletion, groups and communities they ran are handed to another member, and they are signed out everywhere. What was reported about them is kept for moderation. A suspension is usually enough.
                </Text>
                <AdminInput value={reason} onChange={setReason} placeholder="Reason (kept in the moderation log)" label="Reason" />
                <AdminInput value={confirm} onChange={setConfirm} placeholder="Type DELETE to confirm" label="Confirmation" autoCapitalize="none" max={10} />
                <View style={adminStyles.row}>
                  <Button
                    label="Delete for good"
                    variant="danger"
                    disabled={confirm !== 'DELETE' || why.length < 3 || busy !== null}
                    loading={busy === 'delete'}
                    onPress={async () => {
                      if (await run('delete', () => deleteAccount(u.id, confirm, why), tx('Account deleted'))) router.back();
                    }}
                  />
                  <Button label="Cancel" variant="ghost" onPress={() => (setDeleting(false), setConfirm(''))} />
                </View>
              </View>
            )}
          </Card>
        ) : null}
      </View>
    </Page>
  );
}

const SANCTION = { warning: 'Warning', suspension: 'Suspension', ban: 'Ban' } as const;
