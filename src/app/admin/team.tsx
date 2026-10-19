import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { loadStaff, searchMembers, setRole, type MemberRow, type StaffRole, type StaffRow } from '@/features/admin/api';
import { adminStyles, Card, day, Loadable } from '@/features/admin/ui';
import { t as tx } from '@/i18n';

const ROLES: { value: Exclude<StaffRole, 'owner'>; label: string; help: string }[] = [
  { value: 'admin', label: 'Admin', help: 'Everything except roles: bans, removals, audit log.' },
  { value: 'moderator', label: 'Moderator', help: 'Reports, notes, warnings, suspensions up to 7 days.' },
  { value: 'content', label: 'Content', help: 'Reserved for content tools.' },
];

/** Owner only: who is on the team and with which role. Every change is logged. */
export default function Team() {
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<MemberRow[]>([]);
  const [pick, setPick] = useState<Exclude<StaffRole, 'owner'>>('moderator');

  const load = useCallback(() => {
    loadStaff()
      .then((r) => {
        setStaff(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (search.trim().length < 2) return;
    const id = setTimeout(() => searchMembers(search.trim()).then(setFound, () => setFound([])), 300);
    return () => clearTimeout(id);
  }, [search]);

  const change = (user: string, role: Exclude<StaffRole, 'owner'> | null) =>
    setRole(user, role)
      .then(() => {
        toast(role ? tx('Role given') : tx('Role removed'), 'check', 'brand');
        setSearch('');
        load();
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live'));

  return (
    <Page title="Team and roles" subtitle="Only the owner gives or removes roles. The owner role itself is only given from the server.">
      <View style={adminStyles.body}>
        <Loadable data={staff} error={error} retry={load} empty="Nobody yet.">
          {(list) =>
            list.map((s) => (
              <Card key={s.user_id}>
                <Text variant="titleS" raw>
                  {s.first_name ?? '—'} · {tx(s.role === 'owner' ? 'Owner' : (ROLES.find((r) => r.value === s.role)?.label ?? s.role))}
                </Text>
                {s.granted_at ? (
                  <Text variant="caption" tone="tertiary" raw>
                    {tx('since {d}', { d: day(s.granted_at) })}
                  </Text>
                ) : null}
                {s.role !== 'owner' ? <Button size="sm" variant="ghost" label="Remove role" onPress={() => change(s.user_id, null)} /> : null}
              </Card>
            ))
          }
        </Loadable>
        <Text variant="label" style={{ marginTop: 8 }}>
          Add someone
        </Text>
        <View style={adminStyles.row}>
          {ROLES.map((r) => (
            <Chip key={r.value} size="sm" label={r.label} selected={pick === r.value} onPress={() => setPick(r.value)} />
          ))}
        </View>
        <Text variant="caption" tone="secondary">
          {ROLES.find((r) => r.value === pick)?.help ?? ''}
        </Text>
        <Field icon="search" value={search} onChangeText={setSearch} placeholder="First name, username or email" accessibilityLabel="Search members" autoCapitalize="none" />
        {(search.trim().length < 2 ? [] : found)
          .filter((m) => m.role !== 'owner')
          .map((m) => (
            <Card key={m.user_id}>
              <Text variant="bodyS" raw>
                {m.first_name ?? '—'}
                {m.username ? ` · @${m.username}` : ''}
                {m.email ? ` · ${m.email}` : ''}
              </Text>
              <Button size="sm" variant="secondary" label={tx('Make {role}', { role: tx(ROLES.find((r) => r.value === pick)?.label ?? pick) })} onPress={() => change(m.user_id, pick)} />
            </Card>
          ))}
      </View>
    </Page>
  );
}
