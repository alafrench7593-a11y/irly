import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { isAdmin, liftSanction, memberSanctions, searchMembers, useStaffRole, type MemberRow, type SanctionRow } from '@/features/admin/api';
import { adminStyles, Card, day, Loadable } from '@/features/admin/ui';
import { a11y, t as tx } from '@/i18n';
import { font, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Members: search, their reports, sanctions and history. Emails are shown to admins only (the server decides). */
export default function Members() {
  const q = useLocalSearchParams<{ q?: string }>();
  const [search, setSearch] = useState(q.q ?? '');
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(q.q ?? null);

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    searchMembers(search.trim())
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, [search]);
  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <Page title="Members" subtitle="Most reported first. Open a member to see their sanctions.">
      <View style={adminStyles.body}>
        <Field icon="search" value={search} onChangeText={setSearch} placeholder="First name, username or email" accessibilityLabel="Search members" autoCapitalize="none" />
        <Loadable data={rows} error={error} retry={load} empty="Nobody found.">
          {(list) =>
            list.map((m) => (
              <Card key={m.user_id} onPress={() => setOpen(open === m.user_id ? null : m.user_id)} accessibilityLabel={m.first_name ?? undefined}>
                <Text variant="titleS" raw>
                  {m.first_name ?? '—'}
                  {m.username ? ` · @${m.username}` : ''}
                </Text>
                <Text variant="bodyS" tone="secondary" raw>
                  {[m.email, tx('joined {d}', { d: day(m.created_at) }), tx('{n} reports', { n: m.reports }), m.role ? tx(m.role[0].toUpperCase() + m.role.slice(1)) : null, m.deleted ? tx('account deleted') : null].filter(Boolean).join(' · ')}
                </Text>
                {m.sanction ? (
                  <Text variant="caption" tone="live" raw>
                    {tx(m.sanction === 'ban' ? 'Banned' : m.sanction === 'suspension' ? 'Suspended' : 'Warned')}
                    {m.sanction_ends ? ` · ${tx('until {d}', { d: day(m.sanction_ends) })}` : ''}
                  </Text>
                ) : null}
                {open === m.user_id ? <History user={m.user_id} /> : null}
              </Card>
            ))
          }
        </Loadable>
      </View>
    </Page>
  );
}

function History({ user }: { user: string }) {
  const t = useTheme();
  const role = useStaffRole();
  const [rows, setRows] = useState<SanctionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const load = useCallback(() => {
    memberSanctions(user)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, [user]);
  useEffect(load, [load]);
  return (
    <View style={{ gap: 6, marginTop: 6 }}>
      <Loadable data={rows} error={error} retry={load} empty="No sanction so far.">
        {(list) => (
          <>
            {list.map((s) => {
              const active = !s.lifted_at && (!s.ends_at || new Date(s.ends_at) > new Date());
              return (
                <View key={s.id} style={{ gap: 2 }}>
                  <Text variant="bodyS" raw>
                    {tx(s.kind === 'ban' ? 'Ban' : s.kind === 'suspension' ? 'Suspension' : 'Warning')} · {day(s.created_at)} · {s.by_name ?? 'IRLY'}
                  </Text>
                  <Text variant="caption" tone="secondary" raw>
                    {s.reason}
                    {s.ends_at ? ` · ${tx('until {d}', { d: day(s.ends_at) })}` : ''}
                    {s.lifted_at ? ` · ${tx('lifted {d}', { d: day(s.lifted_at) })}${s.lift_reason ? ` (${s.lift_reason})` : ''}` : ''}
                  </Text>
                  {active && (s.kind !== 'ban' || isAdmin(role)) ? (
                    <View style={adminStyles.row}>
                      <TextInput value={reason} onChangeText={setReason} placeholder={tx('Why lift it')} placeholderTextColor={t.c.textTertiary} style={{ flex: 1, minHeight: 36, borderRadius: radius.md, paddingHorizontal: 10, fontFamily: font.medium, color: t.c.text, backgroundColor: t.c.overlay }} accessibilityLabel={a11y('Reason')} />
                      <Button
                        size="sm"
                        variant="secondary"
                        label="Lift"
                        disabled={reason.trim().length < 3}
                        onPress={() =>
                          liftSanction(s.id, reason.trim())
                            .then(() => {
                              toast(tx('Sanction lifted'), 'check', 'brand');
                              setReason('');
                              load();
                            })
                            .catch((e) => toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live'))
                        }
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </Loadable>
    </View>
  );
}
