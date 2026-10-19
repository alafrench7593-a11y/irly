import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Divider } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import {
  addCaseNote,
  CATEGORY_LABEL,
  isAdmin,
  KIND_LABEL,
  liftSanction,
  loadCase,
  readReportedMessage,
  removeContent,
  sanction,
  setCaseStatus,
  STATUS_LABEL,
  useStaffRole,
  type CaseDetail,
  type CaseStatus,
  type ContextMessage,
  type SanctionKind,
} from '@/features/admin/api';
import { adminStyles, Card, day, StatusPill } from '@/features/admin/ui';
import { a11y, t as tx } from '@/i18n';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const NEXT: CaseStatus[] = ['reviewing', 'need_info', 'dismissed', 'closed', 'open'];
const DAYS = [1, 3, 7, 30];

/**
 * One report: what was reported, by whom, the history, and the decisions.
 * A private message is never shown here unless the moderator asks for it
 * with a reason (the server logs that read, then returns the reported
 * message and its three neighbours on each side, nothing more).
 */
export default function CaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const role = useStaffRole();
  const [c, setC] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [messages, setMessages] = useState<ContextMessage[] | null>(null);
  const [sKind, setSKind] = useState<SanctionKind>('warning');
  const [sDays, setSDays] = useState(3);
  const [sReason, setSReason] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    loadCase(id)
      .then((x) => {
        setC(x);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, [id]);
  useEffect(load, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done, 'check', 'brand');
      load();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const input = [styles.input, { color: t.c.text, backgroundColor: t.c.overlay }];

  if (error || !c) {
    return (
      <Page title="Report">
        <View style={adminStyles.body}>
          {error ? (
            <>
              <Text variant="body" tone="secondary">
                {tx(error)}
              </Text>
              <Button label="Try again" variant="secondary" onPress={load} />
            </>
          ) : (
            <ActivityIndicator color={t.c.text} />
          )}
        </View>
      </Page>
    );
  }

  const r = c.report;
  const target = r.target_user;
  const activeSanctions = c.sanctions.filter((s) => !s.lifted_at && (!s.ends_at || new Date(s.ends_at) > new Date()));

  return (
    <Page title={tx(CATEGORY_LABEL[r.category] ?? r.category)} overline={tx(KIND_LABEL[r.target_kind] ?? r.target_kind)}>
      <View style={adminStyles.body}>
        <View style={adminStyles.row}>
          <StatusPill status={c.case.status} />
          {c.case.priority === 'high' ? (
            <Text variant="caption" tone="live">
              High priority
            </Text>
          ) : null}
          <Text variant="caption" tone="tertiary" raw>
            {day(r.created_at)}
          </Text>
        </View>

        <Card>
          <Text variant="label">Report</Text>
          <Text variant="bodyS" tone="secondary" raw>
            {tx('By: {name}', { name: r.reporter?.name ?? tx('deleted account') })}
          </Text>
          <Text variant="bodyS" tone="secondary" raw>
            {tx('Reported: {name}', { name: target?.name ?? '—' })}
            {target?.deleted ? ` · ${tx('account deleted')}` : ''}
            {c.others ? ` · ${tx('{n} other reports on this member', { n: c.others })}` : ''}
          </Text>
          {r.details ? (
            <Text variant="body" raw>
              “{r.details}”
            </Text>
          ) : (
            <Text variant="bodyS" tone="tertiary">
              No details given.
            </Text>
          )}
          {target ? <Button label="Member history" icon="user" size="sm" variant="ghost" onPress={() => router.push(`/admin/members?q=${target.id}`)} /> : null}
        </Card>

        {r.target_kind === 'message' ? (
          <Card>
            <Text variant="label">Reported private message</Text>
            {messages ? (
              messages.map((m) => (
                <View key={m.id} style={[styles.msg, { backgroundColor: m.reported ? t.c.overlay : 'transparent', borderColor: m.reported ? t.c.live : t.c.line }]}>
                  <Text variant="caption" tone="tertiary" raw>
                    {m.sender_name ?? '—'} · {day(m.created_at)}
                    {m.removed ? ` · ${tx('removed')}` : ''}
                  </Text>
                  <Text variant="bodyS" raw>
                    {m.body ?? (m.kind === 'image' ? tx('Photo') : '—')}
                  </Text>
                </View>
              ))
            ) : (
              <>
                <Text variant="bodyS" tone="secondary">
                  The conversation stays private. You can read the reported message and the three messages before and after it. Say why: your name, the time and your reason are recorded.
                </Text>
                <TextInput value={reason} onChangeText={(x) => setReason(x.slice(0, 300))} placeholder={tx('Why you need to read it')} placeholderTextColor={t.c.textTertiary} style={input} accessibilityLabel={a11y('Reason')} />
                <Button
                  label="Read the reported message"
                  icon="eye"
                  variant="secondary"
                  loading={busy === 'read'}
                  disabled={reason.trim().length < 5 || busy !== null}
                  onPress={async () => {
                    setBusy('read');
                    try {
                      setMessages(await readReportedMessage(c.case.id, reason.trim()));
                    } catch (e) {
                      toast(e instanceof Error ? e.message : 'Could not load', 'x', 'live');
                    } finally {
                      setBusy(null);
                    }
                  }}
                />
              </>
            )}
          </Card>
        ) : Object.keys(c.target).length ? (
          <Card>
            <Text variant="label">Reported content</Text>
            {Object.entries(c.target)
              .filter(([k, v]) => k !== 'removed' && v)
              .map(([k, v]) => (
                <Text key={k} variant="bodyS" raw>
                  {String(v)}
                </Text>
              ))}
            {c.target.removed ? (
              <Text variant="caption" tone="live">
                Already removed
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <Text variant="label">Decision</Text>
          <TextInput value={note} onChangeText={(x) => setNote(x.slice(0, 2000))} placeholder={tx('Internal note (staff only)')} placeholderTextColor={t.c.textTertiary} style={[input, { height: 80, paddingTop: 10 }]} multiline accessibilityLabel={a11y('Note')} />
          <View style={adminStyles.row}>
            {NEXT.filter((s) => s !== c.case.status).map((s) => (
              <Button key={s} size="sm" variant="secondary" label={STATUS_LABEL[s]} loading={busy === s} disabled={busy !== null} onPress={() => run(s, () => setCaseStatus(c.case.id, s, note.trim()), tx('Status: {s}', { s: tx(STATUS_LABEL[s]) })).then((ok) => ok && setNote(''))} />
            ))}
            <Button size="sm" variant="ghost" label="Add note" disabled={!note.trim() || busy !== null} loading={busy === 'note'} onPress={() => run('note', () => addCaseNote(c.case.id, note.trim()), tx('Note added')).then((ok) => ok && setNote(''))} />
          </View>
          {isAdmin(role) && r.target_kind !== 'profile' && !c.target.removed ? (
            <Button label="Remove the reported content" icon="x" variant="danger" disabled={note.trim().length < 3 || busy !== null} loading={busy === 'remove'} onPress={() => run('remove', () => removeContent(c.case.id, note.trim()), tx('Content removed')).then((ok) => ok && setNote(''))} />
          ) : null}
        </Card>

        {target && !target.role ? (
          <Card>
            <Text variant="label" raw>
              {tx('Sanction for {name}', { name: target.name })}
            </Text>
            <View style={adminStyles.row}>
              {(['warning', 'suspension', ...(isAdmin(role) ? (['ban'] as const) : [])] as SanctionKind[]).map((k) => (
                <Chip key={k} size="sm" label={SANCTION_LABEL[k]} selected={sKind === k} onPress={() => setSKind(k)} />
              ))}
            </View>
            {sKind === 'suspension' ? (
              <View style={adminStyles.row}>
                {DAYS.filter((d) => isAdmin(role) || d <= 7).map((d) => (
                  <Chip key={d} size="sm" label={tx('{n} d', { n: d })} selected={sDays === d} onPress={() => setSDays(d)} />
                ))}
              </View>
            ) : null}
            <TextInput value={sReason} onChangeText={(x) => setSReason(x.slice(0, 1000))} placeholder={tx('Reason (kept in the member history)')} placeholderTextColor={t.c.textTertiary} style={input} accessibilityLabel={a11y('Reason')} />
            <Button
              label={sKind === 'ban' ? 'Ban this member' : sKind === 'suspension' ? 'Suspend this member' : 'Send a warning'}
              variant={sKind === 'warning' ? 'secondary' : 'danger'}
              disabled={sReason.trim().length < 3 || busy !== null}
              loading={busy === 'sanction'}
              onPress={() => run('sanction', () => sanction(target.id, sKind, sReason.trim(), sKind === 'suspension' ? sDays : null, c.case.id), tx('Sanction recorded')).then((ok) => ok && setSReason(''))}
            />
            {activeSanctions.map((s) => (
              <View key={s.id} style={adminStyles.row}>
                <Text variant="bodyS" style={{ flex: 1 }} raw>
                  {tx(SANCTION_LABEL[s.kind])} · {s.ends_at ? tx('until {d}', { d: day(s.ends_at) }) : tx('no end date')}
                </Text>
                {s.kind !== 'ban' || isAdmin(role) ? (
                  <Button size="sm" variant="ghost" label="Lift" disabled={sReason.trim().length < 3 || busy !== null} onPress={() => run('lift', () => liftSanction(s.id, sReason.trim()), tx('Sanction lifted'))} />
                ) : null}
              </View>
            ))}
          </Card>
        ) : target?.role ? (
          <Text variant="bodyS" tone="tertiary">
            This member is on the IRLY team: only someone above them can sanction them, from the Members screen.
          </Text>
        ) : null}

        {c.notes.length || c.history.length ? (
          <Card>
            <Text variant="label">History</Text>
            {[...c.history.map((h) => ({ at: h.at, who: h.by, text: tx(ACTION_LABEL[h.action] ?? h.action) + (h.details?.to ? ` → ${tx(STATUS_LABEL[h.details.to as CaseStatus] ?? String(h.details.to))}` : '') })), ...c.notes.map((n) => ({ at: n.at, who: n.author, text: n.body }))]
              .sort((a, b) => a.at.localeCompare(b.at))
              .map((h, i) => (
                <View key={i} style={{ gap: 2 }}>
                  {i ? <Divider /> : null}
                  <Text variant="caption" tone="tertiary" raw>
                    {day(h.at)} · {h.who ?? 'IRLY'}
                  </Text>
                  <Text variant="bodyS" raw>
                    {h.text}
                  </Text>
                </View>
              ))}
          </Card>
        ) : null}
      </View>
    </Page>
  );
}

const SANCTION_LABEL: Record<SanctionKind, string> = { warning: 'Warning', suspension: 'Suspension', ban: 'Ban' };
const ACTION_LABEL: Record<string, string> = {
  'case.status': 'Status changed',
  'message.read': 'Reported message read',
  'content.removed': 'Content removed',
  'sanction.warning': 'Warning sent',
  'sanction.suspension': 'Member suspended',
  'sanction.ban': 'Member banned',
  'sanction.lifted': 'Sanction lifted',
};

const styles = {
  input: { minHeight: 44, borderRadius: radius.lg, paddingHorizontal: 12, fontFamily: font.medium, fontSize: 15 },
  msg: { padding: 10, gap: 2, borderRadius: radius.md, borderWidth: 1, marginTop: space[1] },
} as const;
