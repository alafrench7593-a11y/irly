import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { adminStyles, Card } from '@/features/admin/ui';
import { setTaskDone } from '@/features/crm/api';
import { contactName, PRIORITY_LABEL, today, type Task } from '@/features/crm/model';
import { crmStyles, CrmGate, CrmLoad, Filter, shortDate, Tag, useCrm, useTeam } from '@/features/crm/ui';
import { t as tx } from '@/i18n';

type Quick = 'today' | 'late' | 'open' | 'mine' | 'done';
const QUICK: { value: Quick; label: string }[] = [
  { value: 'today', label: 'Due today' },
  { value: 'late', label: 'Late' },
  { value: 'open', label: 'To do' },
  { value: 'done', label: 'Done' },
];
const RANK = { urgent: 0, high: 1, normal: 2, low: 3 } as const;

/**
 * Tasks and follow-ups: today's, late ones, open ones. Marking one done is
 * the only change made from the list. Nothing here sends a message or an
 * email to anyone.
 */
export default function Tasks() {
  const q = useLocalSearchParams<{ filter?: string }>();
  return (
    <Page overline="CRM" title="Tasks and follow-ups" subtitle="What to do, for whom, by when. Nothing is sent automatically.">
      <View style={adminStyles.body}>
        <CrmGate>
          <List quick0={QUICK.some((x) => x.value === q.filter) ? (q.filter as Quick) : 'open'} />
        </CrmGate>
      </View>
    </Page>
  );
}

function List({ quick0 }: { quick0: Quick }) {
  const { data, error, reload } = useCrm();
  const team = useTeam();
  const [quick, setQuick] = useState<Quick | 'all'>(quick0);
  const [who, setWho] = useState('all');
  // Tasks saved here since the last load, shown over the loaded list.
  const [saved, setSaved] = useState<Record<string, Task>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const tasks = data?.tasks.map((t) => saved[t.id] ?? t) ?? null;

  const toggle = (t: Task) => {
    if (busy) return;
    setBusy(t.id);
    setTaskDone(t.id, !t.done_at)
      .then((next) => {
        setSaved((all) => ({ ...all, [t.id]: next }));
        toast(tx(next.done_at ? 'Task done' : 'Task reopened'), 'check', 'brand');
      })
      .catch((e) => toast(tx(e instanceof Error ? e.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(null));
  };

  return (
    <CrmLoad data={data} error={error} retry={reload}>
      {(d) => {
        const day = today();
        const rows = (tasks ?? [])
          .filter((t) => (quick === 'done' ? t.done_at : quick === 'all' ? true : !t.done_at))
          .filter((t) => quick !== 'today' || t.due_on === day)
          .filter((t) => quick !== 'late' || (t.due_on !== null && t.due_on < day))
          .filter((t) => who === 'all' || (who === 'none' ? !t.assignee_id : t.assignee_id === who))
          .sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999') || RANK[a.priority] - RANK[b.priority]);
        const late = (tasks ?? []).filter((t) => !t.done_at && t.due_on !== null && t.due_on < day).length;
        const due = (tasks ?? []).filter((t) => !t.done_at && t.due_on === day).length;
        return (
          <>
            <Button label="New task" icon="plus" full onPress={() => router.push('/admin/crm/task')} />
            {late || due ? (
              <Text variant="bodyS" tone={late ? 'live' : 'secondary'} raw>
                {[late ? tx('{n} late', { n: late }) : null, due ? tx('{n} due today', { n: due }) : null].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            <Filter options={QUICK} value={quick} onChange={setQuick} />
            {team.length ? (
              <View style={crmStyles.wrap}>
                <Chip size="sm" label="Everyone" selected={who === 'all'} onPress={() => setWho('all')} />
                <Chip size="sm" label="Not assigned" selected={who === 'none'} onPress={() => setWho('none')} />
                {team.map((m) => (
                  <Chip key={m.user_id} size="sm" raw label={m.first_name ?? '—'} selected={who === m.user_id} onPress={() => setWho(m.user_id)} />
                ))}
              </View>
            ) : null}
            {rows.length ? (
              rows.map((t, i) => {
                const c = d.contacts.find((x) => x.id === t.contact_id);
                const p = d.partnerships.find((x) => x.id === t.partnership_id);
                const isLate = !t.done_at && t.due_on !== null && t.due_on < day;
                return (
                  <Card key={t.id} index={i} onPress={() => router.push(`/admin/crm/task?id=${t.id}`)} accessibilityLabel={t.title}>
                    <View style={crmStyles.row}>
                      <Text variant="titleS" style={{ flex: 1 }} tone={t.done_at ? 'tertiary' : 'primary'} raw>
                        {t.title}
                      </Text>
                      <Tag label={PRIORITY_LABEL[t.priority]} tone={t.priority === 'urgent' || t.priority === 'high' ? 'live' : 'secondary'} />
                    </View>
                    <Text variant="bodyS" tone="secondary" raw>
                      {[c ? contactName(c) : null, p?.title, team.find((m) => m.user_id === t.assignee_id)?.first_name].filter(Boolean).join(' · ')}
                    </Text>
                    {t.due_on ? (
                      <Text variant="caption" tone={isLate ? 'live' : 'tertiary'} raw>
                        {isLate ? tx('Late since {d}', { d: shortDate(t.due_on) }) : tx('Due {d}', { d: shortDate(t.due_on) })}
                      </Text>
                    ) : null}
                    <Button size="sm" variant={t.done_at ? 'ghost' : 'secondary'} icon={t.done_at ? undefined : 'check'} label={t.done_at ? 'Reopen' : 'Mark as done'} loading={busy === t.id} onPress={() => toggle(t)} />
                  </Card>
                );
              })
            ) : (
              <Text variant="body" tone="secondary">
                {d.tasks.length ? 'Nothing here.' : 'No task yet.'}
              </Text>
            )}
          </>
        );
      }}
    </CrmLoad>
  );
}
