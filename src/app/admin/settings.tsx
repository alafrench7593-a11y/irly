import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Divider } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { isAdmin, loadSettings, retryEmail, saveSetting, type AdminSettings, type EmailScope } from '@/features/admin/api';
import { AdminInput, adminStyles, Card, day, Fact, NoAccess, useAdminRole, useLoad } from '@/features/admin/ui';
import { t as tx } from '@/i18n';
import { useTheme } from '@/theme/useTheme';

const SCOPES: { value: EmailScope; label: string; help: string }[] = [
  { value: 'important', label: 'Important reports', help: 'Threats, dangerous behaviour, sexual content, hate, and anything several members report.' },
  { value: 'all', label: 'Every report', help: 'One email per report.' },
  { value: 'off', label: 'Off', help: 'No email: reports only appear here.' },
];

/**
 * Admin settings: where report emails go (kept in the database, changed only
 * here, by admins), which reports send one, the link the emails point to,
 * and how sending is going. The email provider's key never comes near the
 * app: it is a secret of the sending job (see docs/ADMIN.md).
 */
export default function AdminSettingsScreen() {
  const t = useTheme();
  const role = useAdminRole();
  const { data: s, error, reload } = useLoad<AdminSettings>(loadSettings, 'settings');

  if (role !== undefined && !isAdmin(role)) {
    return (
      <Page title="Admin settings">
        <View style={adminStyles.body}>
          <NoAccess />
        </View>
      </Page>
    );
  }

  return (
    <Page title="Admin settings" subtitle="Changes are recorded in the moderation log.">
      <View style={adminStyles.body}>
        {error ? (
          <>
            <Text variant="body" tone="secondary">
              {tx(error)}
            </Text>
            <Button label="Try again" variant="secondary" onPress={reload} />
          </>
        ) : !s ? (
          <ActivityIndicator color={t.c.text} />
        ) : (
          <Form key={`${s.report_email_to}|${s.dashboard_url}`} s={s} reload={reload} />
        )}
      </View>
    </Page>
  );
}

/** The settings form, started from what the server holds (keyed by it). */
function Form({ s, reload }: { s: AdminSettings; reload: () => void }) {
  const [to, setTo] = useState(s.report_email_to ?? '');
  const [url, setUrl] = useState(s.dashboard_url);
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      toast(tx('Saved'), 'check', 'brand');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card>
        <Text variant="label">Report emails</Text>
        <Text variant="caption" tone="secondary">
          The moderation address that receives an email for each report below. The email gives the case number, what was reported, the reason, the date and a link to the case: no names, no report text.
        </Text>
        <AdminInput value={to} onChange={setTo} placeholder="Moderation email address" label="Moderation email address" autoCapitalize="none" max={254} />
        <Button size="sm" label="Save the address" disabled={busy !== null || to.trim() === (s.report_email_to ?? '')} loading={busy === 'to'} onPress={() => save('to', () => saveSetting('report_email_to', to.trim()))} />
        {!s.report_email_to ? (
          <Text variant="caption" tone="live">
            No address yet: emails wait until one is set.
          </Text>
        ) : null}
        <Divider />
        <View style={adminStyles.row}>
          {SCOPES.map((x) => (
            <Chip key={x.value} size="sm" label={x.label} selected={s.report_email_scope === x.value} onPress={() => save('scope', () => saveSetting('report_email_scope', x.value))} />
          ))}
        </View>
        <Text variant="caption" tone="secondary">
          {SCOPES.find((x) => x.value === s.report_email_scope)?.help ?? ''}
        </Text>
      </Card>

      <Card>
        <Text variant="label">Back office link</Text>
        <Text variant="caption" tone="secondary">
          Where the web app is served: emails link to this address followed by /admin/case/ and the case number. Opening it asks the person to sign in.
        </Text>
        <AdminInput value={url} onChange={setUrl} placeholder="https://getirly.com/app" label="Back office link" autoCapitalize="none" max={200} />
        <Button size="sm" label="Save the link" disabled={busy !== null || url.trim() === s.dashboard_url} loading={busy === 'url'} onPress={() => save('url', () => saveSetting('dashboard_url', url.trim()))} />
      </Card>

      <Card>
        <Text variant="label">Sending</Text>
        <Fact label={tx('Waiting')} value={s.outbox.pending} />
        <Fact label={tx('Sent')} value={s.outbox.sent} />
        <Fact label={tx('Failed')} value={s.outbox.failed} />
        <Fact label={tx('Last sent')} value={s.outbox.last_sent ? day(s.outbox.last_sent) : tx('Never')} />
        <Text variant="caption" tone="secondary">
          A job sends waiting emails every 10 minutes once its provider key is set (see docs/ADMIN.md). A failed email is tried again with a growing delay, six times.
        </Text>
        {s.outbox.recent.map((o) => (
          <View key={o.id} style={{ gap: 2 }}>
            <Divider />
            <Text variant="caption" tone="tertiary" raw>
              {day(o.created_at)} · {tx(OUT_LABEL[o.status])} · {tx('{n} attempts', { n: o.attempts })}
            </Text>
            {o.last_error ? (
              <Text variant="caption" tone="live" raw>
                {o.last_error}
              </Text>
            ) : null}
            {o.status === 'failed' ? <Button size="sm" variant="ghost" label="Send again" onPress={() => save('retry', () => retryEmail(o.id))} /> : null}
          </View>
        ))}
      </Card>
    </>
  );
}

const OUT_LABEL = { pending: 'Waiting', sending: 'Sending', sent: 'Sent', failed: 'Failed' } as const;
