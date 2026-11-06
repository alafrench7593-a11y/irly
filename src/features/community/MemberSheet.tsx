import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { a11y, dateLocale, t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { ROLE_LABEL } from './CommunityPageParts';
import {
  banMember,
  kickMember,
  memberActions,
  restrictMember,
  setMemberRole,
  unbanMember,
  unrestrictMember,
  useSanctions,
  warnMember,
  type Member,
  type MyRights,
  type Sanction,
} from './governance';

/**
 * « Manage this member »: what this manager may do to her, each action
 * confirmed inside the sheet (a second step that says exactly what will
 * happen), and her sanctions in this community. The server checks the same
 * rules again and its refusal is shown as written for members.
 */

type Action = 'coadmin' | 'moderator' | 'member' | 'warn' | 'restrict' | 'kick' | 'ban' | 'unban' | 'unrestrict';
const NEEDS_REASON: Action[] = ['warn', 'restrict', 'kick', 'ban'];
const DESTRUCTIVE: Action[] = ['restrict', 'kick', 'ban'];

export const DURATIONS = [
  { key: '1d', label: '24 hours', ms: 24 * 3600_000 },
  { key: '3d', label: '3 days', ms: 3 * 24 * 3600_000 },
  { key: '7d', label: '7 days', ms: 7 * 24 * 3600_000 },
  { key: '30d', label: '30 days', ms: 30 * 24 * 3600_000 },
] as const;
type DurationKey = (typeof DURATIONS)[number]['key'];

export const untilText = (ms: number) => new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

const active = (s: Sanction, now: number) => s.kind !== 'warning' && (s.until === null || s.until > now);

export function MemberSheet({ communityId, member, rights, myId, onClose, onDone }: { communityId: string; member: Member | null; rights: MyRights; myId: string | null; onClose: () => void; onDone?: () => void }) {
  return (
    <Sheet visible={Boolean(member)} onClose={onClose} title={tx('Manage this member')} scroll>
      {member ? <Body key={member.userId} communityId={communityId} member={member} rights={rights} myId={myId} onClose={onClose} onDone={onDone} /> : null}
    </Sheet>
  );
}

function Body({ communityId, member, rights, myId, onClose, onDone }: { communityId: string; member: Member; rights: MyRights; myId: string | null; onClose: () => void; onDone?: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const reduced = useReducedMotion();
  const now = useNow(60_000);
  const can = memberActions(rights, myId, member);
  const { sanctions, loading: sLoading, error: sError, reload } = useSanctions(communityId, member.userId, can.sanctions);
  const banned = sanctions.some((s) => s.kind === 'ban' && active(s, now));
  const restricted = sanctions.some((s) => s.kind === 'restriction' && active(s, now));
  const [step, setStep] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<DurationKey>('7d');
  const [permanent, setPermanent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSanctions, setShowSanctions] = useState(false);

  const until = now + (DURATIONS.find((d) => d.key === duration)?.ms ?? DURATIONS[2].ms);
  const name = member.name;
  const open = (a: Action) => {
    setStep(a);
    setReason('');
    setError(null);
    setPermanent(false);
    setDuration('7d');
  };

  const run = async () => {
    if (!step || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (step === 'coadmin') await setMemberRole(communityId, member.userId, 'co_admin');
      else if (step === 'moderator') await setMemberRole(communityId, member.userId, 'moderator');
      else if (step === 'member') await setMemberRole(communityId, member.userId, 'member');
      else if (step === 'warn') await warnMember(communityId, member.userId, reason);
      else if (step === 'restrict') await restrictMember(communityId, member.userId, until, reason);
      else if (step === 'kick') await kickMember(communityId, member.userId, reason);
      else if (step === 'ban') await banMember(communityId, member.userId, reason, permanent ? null : until);
      else if (step === 'unban') await unbanMember(communityId, member.userId);
      else if (step === 'unrestrict') await unrestrictMember(communityId, member.userId);
      haptic('success');
      toast(DONE[step], 'check', 'brand');
      reload();
      onDone?.();
      // Removed from the community: nothing more to manage here.
      if (step === 'kick' || step === 'ban') onClose();
      else setStep(null);
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again');
    } finally {
      setBusy(false);
    }
  };

  if (step) {
    const needsReason = NEEDS_REASON.includes(step);
    const ready = !needsReason || reason.trim().length >= 3;
    return (
      <Animated.View key={step} entering={reduced ? undefined : FadeIn.duration(160)} style={{ gap: 14 }}>
        <Text variant="titleS">{tx(TITLE[step])}</Text>
        {step === 'restrict' || (step === 'ban' && !permanent) ? (
          <View style={{ gap: 8 }}>
            <Text variant="label" tone="secondary">
              Until
            </Text>
            <View style={styles.wrap}>
              {DURATIONS.map((d) => (
                <Chip key={d.key} size="sm" label={tx(d.label)} selected={duration === d.key} onPress={() => setDuration(d.key)} />
              ))}
            </View>
            <Text variant="caption" tone="tertiary" raw>
              {untilText(until)}
            </Text>
          </View>
        ) : null}
        {step === 'ban' ? (
          <View style={styles.wrap}>
            <Chip size="sm" icon="clock" label={tx('Temporary')} selected={!permanent} onPress={() => setPermanent(false)} />
            <Chip size="sm" icon="lock" label={tx('Permanent')} selected={permanent} onPress={() => setPermanent(true)} />
          </View>
        ) : null}
        {needsReason ? (
          <TextInput
            value={reason}
            onChangeText={(v) => setReason(v.slice(0, 300))}
            placeholder={tx('Reason (the member will see it)')}
            placeholderTextColor={t.c.textTertiary}
            multiline
            style={[styles.input, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }]}
            accessibilityLabel={a11y('Reason')}
          />
        ) : null}
        <View style={[styles.notice, { borderColor: DESTRUCTIVE.includes(step) ? t.c.live : t.c.line }]}>
          <Text variant="bodyS" tone="secondary">
            {sentence(step, name, permanent ? null : until)}
          </Text>
        </View>
        {error ? (
          <Text variant="bodyS" tone="critical">
            {tx(error)}
          </Text>
        ) : null}
        <Button label={CONFIRM[step]} variant={DESTRUCTIVE.includes(step) ? 'danger' : 'primary'} full loading={busy} disabled={!ready || busy} onPress={() => void run()} />
        <Button label="Back" variant="ghost" full disabled={busy} onPress={() => setStep(null)} />
      </Animated.View>
    );
  }

  const rows: { action: Action; icon: IconName; label: string; show: boolean; danger?: boolean }[] = [
    { action: 'coadmin', icon: 'award', label: 'Name co-admin', show: can.makeCoAdmin },
    { action: 'moderator', icon: 'shield', label: 'Name moderator', show: can.makeModerator },
    { action: 'member', icon: 'user', label: 'Remove role', show: can.removeRole },
    { action: 'warn', icon: 'flag', label: 'Warn', show: can.warn },
    { action: 'restrict', icon: 'clock', label: 'Restrict temporarily', show: can.restrict && !restricted },
    { action: 'unrestrict', icon: 'check', label: 'Lift the restriction', show: can.restrict && restricted },
    { action: 'kick', icon: 'x', label: 'Remove from the community', show: can.kick, danger: true },
    { action: 'ban', icon: 'lock', label: 'Ban', show: can.ban && !banned, danger: true },
    { action: 'unban', icon: 'check', label: 'Lift the ban', show: can.ban && banned },
  ];
  const shown = rows.filter((r) => r.show);

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.who}>
        <Avatar name={name} hue={hueOf(member.userId)} size={48} userId={member.userId} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="titleM" raw numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="tertiary">
            {[tx(ROLE_LABEL[member.role]), banned ? tx('Banned') : null, restricted ? tx('Restricted') : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      <ActionRow
        icon="user"
        label="View profile"
        onPress={() => {
          onClose();
          router.push(`/person/${member.userId}`);
        }}
      />
      {shown.map((r) => (
        <ActionRow key={r.action} icon={r.icon} label={r.label} danger={r.danger} onPress={() => open(r.action)} />
      ))}
      {!shown.length ? (
        <Text variant="bodyS" tone="tertiary">
          {member.userId === myId ? tx('This is you.') : tx('This member’s role is equal to or higher than yours: you cannot act on it.')}
        </Text>
      ) : null}
      {can.sanctions ? (
        <View style={{ gap: 8 }}>
          <ActionRow icon="file" label={showSanctions ? 'Hide the sanctions' : 'See this member’s sanctions'} onPress={() => setShowSanctions((x) => !x)} />
          {showSanctions ? <SanctionList sanctions={sanctions} loading={sLoading} error={sError} /> : null}
        </View>
      ) : null}
    </View>
  );
}

export function SanctionList({ sanctions, loading, error }: { sanctions: Sanction[]; loading: boolean; error: string | null }) {
  const now = useNow(60_000);
  if (loading && !sanctions.length) {
    return (
      <Text variant="bodyS" tone="tertiary">
        Loading…
      </Text>
    );
  }
  if (error && !sanctions.length) {
    return (
      <Text variant="bodyS" tone="critical">
        {tx(error)}
      </Text>
    );
  }
  if (!sanctions.length) {
    return (
      <Text variant="bodyS" tone="tertiary">
        No sanctions in this community.
      </Text>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {sanctions.map((s, i) => (
        <View key={`${s.kind}-${s.createdAt ?? i}-${i}`} style={styles.sanction}>
          <GlassLayer radius={radius.lg} />
          <Text variant="label">{[tx(KIND[s.kind]), s.kind === 'warning' ? null : s.until === null ? tx('Permanent') : s.until > now ? tx('until {date}', { date: untilText(s.until) }) : tx('Ended')].filter(Boolean).join(' · ')}</Text>
          {s.reason ? (
            <Text variant="bodyS" tone="secondary" raw>
              {s.reason}
            </Text>
          ) : null}
          {s.createdAt ? (
            <Text variant="caption" tone="tertiary" raw>
              {untilText(s.createdAt)}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function ActionRow({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  const color = danger ? t.c.live : t.c.text;
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} style={styles.action} accessibilityRole="button" accessibilityLabel={label}>
      <GlassLayer radius={radius.lg} />
      <Icon name={icon} size={18} color={color} />
      <Text variant="label" color={danger ? t.c.live : undefined} style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
    </PressableScale>
  );
}

export const KIND: Record<Sanction['kind'], string> = { ban: 'Ban', restriction: 'Restriction', warning: 'Warning' };

const TITLE: Record<Action, string> = {
  coadmin: 'Name co-admin',
  moderator: 'Name moderator',
  member: 'Remove role',
  warn: 'Warn',
  restrict: 'Restrict temporarily',
  kick: 'Remove from the community',
  ban: 'Ban',
  unban: 'Lift the ban',
  unrestrict: 'Lift the restriction',
};

const CONFIRM: Record<Action, string> = {
  coadmin: 'Confirm: co-admin',
  moderator: 'Confirm: moderator',
  member: 'Confirm: remove the role',
  warn: 'Confirm the warning',
  restrict: 'Confirm the restriction',
  kick: 'Confirm the removal',
  ban: 'Confirm the ban',
  unban: 'Confirm: lift the ban',
  unrestrict: 'Confirm: lift the restriction',
};

const DONE: Record<Action, string> = {
  coadmin: 'Co-admin named',
  moderator: 'Moderator named',
  member: 'Role removed',
  warn: 'Warning sent',
  restrict: 'Member restricted',
  kick: 'Member removed',
  ban: 'Member banned',
  unban: 'Ban lifted',
  unrestrict: 'Restriction lifted',
};

function sentence(a: Action, name: string, until: number | null): string {
  const date = until === null ? '' : untilText(until);
  switch (a) {
    case 'coadmin':
      return tx('{name} becomes co-admin. You choose their permissions in Roles.', { name });
    case 'moderator':
      return tx('{name} becomes moderator: they can moderate posts, the chat and activities.', { name });
    case 'member':
      return tx('{name} stays a member, without a role.', { name });
    case 'warn':
      return tx('{name} gets a warning with your reason. It stays in their record for this community.', { name });
    case 'restrict':
      return tx('Until {date}, {name} cannot post, chat or create activities in this community.', { name, date });
    case 'kick':
      return tx('{name} leaves the community and its chat. They can join again.', { name });
    case 'ban':
      return until === null ? tx('{name} leaves the community and can never join again.', { name }) : tx('{name} leaves the community and cannot join again until {date}.', { name, date });
    case 'unban':
      return tx('{name} can join the community again.', { name });
    case 'unrestrict':
      return tx('{name} can post, chat and create activities again.', { name });
  }
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: radius.lg, overflow: 'hidden' },
  input: { minHeight: 80, borderRadius: radius.lg, borderWidth: 1, padding: 12, fontFamily: font.medium, fontSize: 15, textAlignVertical: 'top' },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: space[3] },
  sanction: { padding: 12, borderRadius: radius.lg, gap: 4, overflow: 'hidden' },
});
