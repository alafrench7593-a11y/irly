import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { AdminInput, adminStyles, Card, day, useLoad } from '@/features/admin/ui';
import type { StaffRow } from '@/features/admin/api';
import { t as tx } from '@/i18n';
import { loadGirlModerator, loadGirlSelfie, setGirlModerator, setGirlSelfieMode, type GirlModerator, type GirlSelfie } from './moderation';

/**
 * Owner only (Team and roles): the one IRLY Girl safety moderator, chosen
 * among the team, with a reason (both in the moderation log). The server
 * refuses anyone else and keeps one at most.
 */
export function GirlModeratorCard({ staff }: { staff: StaffRow[] }) {
  const { data: loaded, error, reload } = useLoad<{ current: GirlModerator }>(() => loadGirlModerator().then((current) => ({ current })), 'girl-moderator');
  const data = loaded?.current;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const run = (key: string, user: string | null) => {
    if (busy) return;
    if (reason.trim().length < 3) {
      toast('Give a reason', 'x', 'live');
      return;
    }
    setBusy(key);
    setGirlModerator(user, reason.trim())
      .then(() => {
        toast(user ? 'Safety moderator designated' : 'Designation removed', 'check', 'brand');
        setReason('');
        reload();
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live'))
      .finally(() => setBusy(null));
  };
  return (
    <Card>
      <Text variant="label">IRLY Girl safety moderator</Text>
      <Text variant="caption" tone="tertiary">
        One person of the team may view IRLY Girl, read-only, to keep it safe. Each opening is written to the moderation log.
      </Text>
      {error ? (
        <Text variant="bodyS" tone="secondary">
          {tx(error)}
        </Text>
      ) : !loaded ? null : data ? (
        <Text variant="titleS" raw>
          {data.firstName ?? '—'}
          {data.grantedAt ? ` · ${tx('since {d}', { d: day(data.grantedAt) })}` : ''}
          {data.active ? '' : ` · ${tx('not on the team any more')}`}
        </Text>
      ) : (
        <Text variant="bodyS" tone="secondary">
          Nobody is designated.
        </Text>
      )}
      <AdminInput value={reason} onChange={setReason} placeholder="Reason (kept in the log)" label="Reason" max={300} />
      <View style={adminStyles.row}>
        {staff
          .filter((s) => s.user_id !== data?.userId)
          .map((s) => (
            <Chip key={s.user_id} size="sm" raw label={s.first_name ?? '—'} onPress={() => run(s.user_id, s.user_id)} />
          ))}
      </View>
      {data ? <Button size="sm" variant="ghost" label="Remove the designation" loading={busy === 'none'} onPress={() => run('none', null)} /> : null}
    </Card>
  );
}

const MODES: { value: GirlSelfie['mode']; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'on', label: 'Always on' },
  { value: 'off', label: 'Off' },
];

/** Admins (Admin settings): selfie verification for IRLY Girl, automatic from its threshold of members, or forced. */
export function GirlSelfieCard() {
  const { data, error, reload } = useLoad<GirlSelfie>(loadGirlSelfie, 'girl-selfie');
  const [busy, setBusy] = useState(false);
  const pick = (mode: GirlSelfie['mode']) => {
    if (busy || data?.mode === mode) return;
    setBusy(true);
    setGirlSelfieMode(mode)
      .then(() => (toast('Saved', 'check', 'brand'), reload()))
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live'))
      .finally(() => setBusy(false));
  };
  return (
    <Card>
      <Text variant="label">IRLY Girl: selfie verification</Text>
      {error ? (
        <Text variant="bodyS" tone="secondary">
          {tx(error)}
        </Text>
      ) : data ? (
        <>
          <Text variant="bodyS" tone="secondary">
            {data.required ? tx('Required now.') : tx('Not required now.')}{' '}
            {tx('{n} members of {max} (automatic switch).', { n: data.members, max: data.threshold })}
          </Text>
          <View style={adminStyles.row}>
            {MODES.map((m) => (
              <Chip key={m.value} size="sm" label={tx(m.label)} selected={data.mode === m.value} onPress={() => pick(m.value)} />
            ))}
          </View>
          <Text variant="caption" tone="tertiary">
            Automatic: required once IRLY Girl has its threshold of members, and it stays on. Women not verified yet are then asked to verify.
          </Text>
        </>
      ) : null}
    </Card>
  );
}
