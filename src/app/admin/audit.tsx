import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { loadJournal, type JournalRow } from '@/features/admin/api';
import { ACTION_LABEL, ITEM_LABEL } from '@/features/admin/labels';
import { adminStyles, Card, day, Loadable, useLoad } from '@/features/admin/ui';
import { t as tx } from '@/i18n';

/** Moderation log: every staff action, newest first (admins and owner). Append-only, kept 24 months. */
export default function AuditLog() {
  const { data, error, reload } = useLoad<JournalRow[]>(() => loadJournal(), 'journal');
  const [older, setOlder] = useState<JournalRow[]>([]);
  const [more, setMore] = useState(true);
  const rows = data ? [...data, ...older] : null;

  return (
    <Page title="Moderation log" subtitle="Who did what, when and why. Nobody can edit or delete these lines, not even from the database.">
      <View style={adminStyles.body}>
        <Loadable data={rows} error={error} retry={reload} empty="Nothing yet.">
          {(list) => (
            <>
              {list.map((a, i) => (
                <Card
                  index={i}
                  key={a.id}
                  onPress={a.case_id ? () => router.push(`/admin/case/${a.case_id}`) : a.target_user ? () => router.push(`/admin/user/${a.target_user}`) : undefined}
                >
                  <Text variant="caption" tone="tertiary" raw>
                    {day(a.at)} · {a.actor_name}
                  </Text>
                  <Text variant="bodyS" raw>
                    {tx(ACTION_LABEL[a.action] ?? a.action)}
                    {a.kind ? ` · ${tx(ITEM_LABEL[a.kind] ?? a.kind)}` : ''}
                    {a.target_name ? ` · ${a.target_name}` : ''}
                  </Text>
                  {a.reason ? (
                    <Text variant="caption" tone="secondary" raw>
                      “{a.reason}”
                    </Text>
                  ) : null}
                </Card>
              ))}
              {more && list.length >= 200 ? (
                <Button
                  label="Load more"
                  variant="ghost"
                  onPress={() =>
                    loadJournal(list[list.length - 1].at).then(
                      (r) => {
                        setOlder((o) => [...o, ...r]);
                        setMore(r.length === 200);
                      },
                      () => setMore(false),
                    )
                  }
                />
              ) : null}
            </>
          )}
        </Loadable>
      </View>
    </Page>
  );
}
