import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Text } from '@/components/ui/Text';
import { loadAudit, type AuditRow } from '@/features/admin/api';
import { adminStyles, Card, day, Loadable } from '@/features/admin/ui';
import { t as tx } from '@/i18n';

const ACTION: Record<string, string> = {
  'role.set': 'Role changed',
  'role.owner_granted': 'Owner granted from the server',
  'case.status': 'Report status changed',
  'message.read': 'Reported private message read',
  'content.removed': 'Content removed',
  'sanction.warning': 'Warning sent',
  'sanction.suspension': 'Member suspended',
  'sanction.ban': 'Member banned',
  'sanction.lifted': 'Sanction lifted',
};

/** Every staff action, newest first (admins and owner). Kept 24 months. */
export default function AuditLog() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    loadAudit()
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, []);
  useEffect(load, [load]);
  return (
    <Page title="Audit log" subtitle="Who did what, and when. Nobody can edit or delete these lines from the app.">
      <View style={adminStyles.body}>
        <Loadable data={rows} error={error} retry={load} empty="Nothing yet.">
          {(list) =>
            list.map((a, i) => (
              <Card key={i} onPress={a.case_id ? () => router.push(`/admin/case/${a.case_id}`) : undefined}>
                <Text variant="caption" tone="tertiary" raw>
                  {day(a.at)} · {a.actor_name}
                </Text>
                <Text variant="bodyS" raw>
                  {tx(ACTION[a.action] ?? a.action)}
                  {a.target_name ? ` · ${a.target_name}` : ''}
                  {a.action === 'role.set' ? ` · ${String(a.details.from ?? '—')} → ${String(a.details.to ?? '—')}` : ''}
                  {typeof a.details.reason === 'string' ? ` · “${a.details.reason}”` : ''}
                </Text>
              </Card>
            ))
          }
        </Loadable>
      </View>
    </Page>
  );
}
