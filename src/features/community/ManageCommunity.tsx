import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
import { a11y, t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { cityWhen, timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { MemberList, ROLE_LABEL } from './CommunityPageParts';
import { useCommunity, useCommunityActivities, type CommunityActivity } from './data';
import {
  canSeeAudit,
  isManager,
  moderateActivity,
  PERM_KEYS,
  setPermissions,
  transferOwnership,
  unbanMember,
  unrestrictMember,
  useAuditLog,
  useCoAdminPermissions,
  useCommunityStats,
  useMembersList,
  useMyRights,
  useSanctions,
  type AuditEntry,
  type CommunityStats,
  type Member,
  type MyRights,
  type PermKey,
  type Permissions,
  type Sanction,
} from './governance';
import { KIND, MemberSheet, untilText } from './MemberSheet';

/**
 * « Manage the community »: members, roles, moderation, activities, stats
 * and history, each section only for those whose rights allow it
 * (community_my_rights). The server decides; refusals are shown in words.
 */

type Section = 'members' | 'roles' | 'moderation' | 'activities' | 'stats' | 'history';
const SECTIONS: { key: Section; label: string; allowed: (r: MyRights) => boolean }[] = [
  { key: 'members', label: 'Members', allowed: (r) => r.canManageMembers || r.canModerate },
  { key: 'roles', label: 'Roles', allowed: (r) => r.canRoles },
  { key: 'moderation', label: 'Moderation', allowed: (r) => r.canModerate || r.canManageMembers },
  { key: 'activities', label: 'Activities', allowed: (r) => r.canModerate },
  { key: 'stats', label: 'Statistics', allowed: (r) => r.canStats },
  { key: 'history', label: 'History', allowed: canSeeAudit },
];

const PERM_LABEL: Record<PermKey, string> = {
  members: 'Manage members',
  moderation: 'Moderation',
  announcements: 'Announcements',
  activities: 'Activities',
  settings: 'Settings',
  stats: 'Statistics',
  roles: 'Roles',
};

export function ManageCommunityScreen({ id }: { id: string }) {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { detail: c } = useCommunity(id);
  const { rights, loading, error, reload } = useMyRights(id);
  const allowed = SECTIONS.filter((s) => s.allowed(rights));
  const [picked, setPicked] = useState<Section | null>(null);
  const section = allowed.find((s) => s.key === picked)?.key ?? allowed[0]?.key ?? null;
  const reduced = useReducedMotion();

  return (
    <Page title="Manage the community">
      <View style={{ gap: space[5] }}>
        {c ? (
          <Text variant="titleS" tone="secondary" raw style={styles.pad}>
            {c.name}
          </Text>
        ) : null}
        {!account ? (
          <View style={[styles.pad, { gap: 10 }]}>
            <Text variant="body" tone="secondary">
              Sign in to manage this community
            </Text>
            <Button label="Sign in" icon="user" onPress={() => router.push('/account')} />
          </View>
        ) : loading ? (
          <View style={[styles.pad, { gap: 10 }]}>
            <Skeleton height={34} radius={17} width="70%" />
            <Skeleton height={64} radius={radius.lg} />
            <Skeleton height={64} radius={radius.lg} />
          </View>
        ) : error ? (
          <View style={[styles.pad, { gap: 10 }]}>
            <Text variant="body" tone="secondary">
              {tx(error)}
            </Text>
            <Button label="Try again" variant="secondary" onPress={reload} />
          </View>
        ) : !isManager(rights) || !section ? (
          <View style={[styles.pad, styles.empty, { overflow: 'hidden' }]}>
            <GlassLayer radius={radius.xl} />
            <Icon name="lock" size={22} color={t.c.textSecondary} />
            <Text variant="body" tone="secondary" align="center">
              Only the community’s team can manage it.
            </Text>
            <Button label="Back to the community" variant="secondary" onPress={() => router.replace(`/c/${id}`)} />
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.pad, { gap: 8 }]}>
              {allowed.map((s) => (
                <Chip key={s.key} label={tx(s.label)} selected={section === s.key} onPress={() => setPicked(s.key)} />
              ))}
            </ScrollView>
            <Animated.View key={section} entering={reduced ? undefined : FadeIn.duration(180)} style={{ gap: space[4] }}>
              {section === 'members' ? <MembersSection communityId={id} rights={rights} /> : null}
              {section === 'roles' ? <RolesSection communityId={id} communityName={c?.name ?? ''} rights={rights} /> : null}
              {section === 'moderation' ? <ModerationSection communityId={id} /> : null}
              {section === 'activities' ? <ActivitiesSection communityId={id} cityId={c?.cityId ?? 'dubai'} /> : null}
              {section === 'stats' ? <StatsSection communityId={id} /> : null}
              {section === 'history' ? <HistorySection communityId={id} /> : null}
            </Animated.View>
          </>
        )}
      </View>
    </Page>
  );
}

/* ───────── Members ───────── */

function MembersSection({ communityId, rights }: { communityId: string; rights: MyRights }) {
  const myId = useAccount()?.userId ?? null;
  const [member, setMember] = useState<Member | null>(null);
  return (
    <>
      <MemberList communityId={communityId} onPick={setMember} />
      <MemberSheet communityId={communityId} member={member} rights={rights} myId={myId} onClose={() => setMember(null)} />
    </>
  );
}

/* ───────── Roles ───────── */

function RolesSection({ communityId, communityName, rights }: { communityId: string; communityName: string; rights: MyRights }) {
  const myId = useAccount()?.userId ?? null;
  const owner = rights.role === 'owner';
  const { members, loading, error } = useMembersList(communityId, '');
  const { perms, reload } = useCoAdminPermissions(communityId, owner);
  const team = members.filter((m) => m.role === 'co_admin' || m.role === 'moderator');
  const [member, setMember] = useState<Member | null>(null);
  const [transfer, setTransfer] = useState(false);
  return (
    <View style={{ gap: space[4] }}>
      <View style={[styles.pad, { gap: 10 }]}>
        <Text variant="overline" tone="secondary">
          Co-admins and moderators
        </Text>
        {loading && !team.length ? (
          <Skeleton height={64} radius={radius.lg} />
        ) : error && !team.length ? (
          <Text variant="bodyS" tone="secondary">
            {tx(error)}
          </Text>
        ) : !team.length ? (
          <Text variant="bodyS" tone="tertiary">
            No co-admins or moderators yet. Name them from Members.
          </Text>
        ) : (
          team.map((m) => <TeamRow key={m.userId} communityId={communityId} m={m} owner={owner} perms={perms?.[m.userId] ?? null} onManage={() => setMember(m)} onSaved={reload} />)
        )}
      </View>
      {owner ? (
        <View style={[styles.pad, { gap: 8 }]}>
          <Text variant="overline" tone="secondary">
            Ownership
          </Text>
          <Text variant="bodyS" tone="secondary">
            Hand the community over to another member. You stay co-admin with every permission.
          </Text>
          <Button label="Transfer ownership" icon="key" variant="secondary" onPress={() => setTransfer(true)} />
        </View>
      ) : null}
      <MemberSheet communityId={communityId} member={member} rights={rights} myId={myId} onClose={() => setMember(null)} />
      {owner ? <TransferSheet visible={transfer} communityId={communityId} communityName={communityName} onClose={() => setTransfer(false)} /> : null}
    </View>
  );
}

function TeamRow({ communityId, m, owner, perms, onManage, onSaved }: { communityId: string; m: Member; owner: boolean; perms: Permissions | null; onManage: () => void; onSaved: () => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Permissions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = owner && m.role === 'co_admin';
  const current = draft ?? perms;
  const changed = Boolean(draft && perms && PERM_KEYS.some((k) => draft[k] !== perms[k]));
  const save = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setPermissions(communityId, m.userId, draft);
      haptic('success');
      toast('Permissions saved', 'check', 'brand');
      setDraft(null);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={[styles.card, { overflow: 'hidden' }]}>
      <GlassLayer radius={radius.lg} />
      <View style={styles.row}>
        <Avatar name={m.name} hue={hueOf(m.userId)} size={40} userId={m.userId} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="titleS" raw numberOfLines={1}>
            {m.name}
          </Text>
          <Text variant="caption" tone="tertiary">
            {tx(ROLE_LABEL[m.role])}
          </Text>
        </View>
        {editable ? <Chip size="sm" icon="sliders" label={tx('Permissions')} selected={open} onPress={() => setOpen((x) => !x)} /> : null}
        <PressableScale haptic="select" hitSlop={8} onPress={onManage} accessibilityLabel={tx('Manage {name}', { name: m.name })}>
          <Icon name="more" size={18} color={t.c.textSecondary} />
        </PressableScale>
      </View>
      {editable && open ? (
        <View style={{ gap: 4 }}>
          {!current ? (
            <Text variant="bodyS" tone="tertiary">
              Could not read the current permissions. Try again later.
            </Text>
          ) : (
            PERM_KEYS.map((k) => (
              <View key={k} style={styles.toggle}>
                <Text variant="bodyS" style={{ flex: 1 }}>
                  {tx(PERM_LABEL[k])}
                </Text>
                <Switch value={current[k]} disabled={busy} onValueChange={(v) => setDraft({ ...current, [k]: v })} trackColor={{ true: t.c.brand, false: t.c.overlay }} thumbColor="#FFFFFF" accessibilityLabel={a11y(PERM_LABEL[k])} />
              </View>
            ))
          )}
          {error ? (
            <Text variant="bodyS" tone="critical">
              {tx(error)}
            </Text>
          ) : null}
          {current ? <Button label="Save the permissions" size="sm" loading={busy} disabled={!changed || busy} onPress={() => void save()} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** « Transfer ownership »: choose a member, then type the community's name to confirm. */
function TransferSheet({ visible, communityId, communityName, onClose }: { visible: boolean; communityId: string; communityName: string; onClose: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const myId = useAccount()?.userId ?? null;
  const [to, setTo] = useState<Member | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setTo(null);
    setTyped('');
    setError(null);
    onClose();
  };
  const matches = typed.trim().toLocaleLowerCase() === communityName.trim().toLocaleLowerCase() && communityName.trim().length > 0;
  const run = async () => {
    if (!to || !matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await transferOwnership(communityId, to.userId);
      haptic('success');
      toast('Ownership transferred', 'check', 'brand');
      close();
      router.replace(`/c/${communityId}`);
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={close} title={tx('Transfer ownership')} scroll>
      {!to ? (
        <View style={{ gap: 10, marginHorizontal: -space.gutter }}>
          <Text variant="bodyS" tone="secondary" style={styles.pad}>
            Choose the new owner among the members.
          </Text>
          <MemberList communityId={communityId} onPick={setTo} filter={(m) => m.userId !== myId && m.role !== 'owner'} />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <View style={styles.row}>
            <Avatar name={to.name} hue={hueOf(to.userId)} size={44} userId={to.userId} />
            <Text variant="titleS" raw style={{ flex: 1 }} numberOfLines={1}>
              {to.name}
            </Text>
          </View>
          <View style={[styles.notice, { borderColor: t.c.live }]}>
            <Text variant="bodyS" tone="secondary">
              {tx('{name} becomes the owner of the community. You become co-admin with every permission. Only the new owner can give it back.', { name: to.name })}
            </Text>
          </View>
          <Text variant="label" tone="secondary">
            Type the community’s name to confirm
          </Text>
          <Text variant="caption" tone="tertiary" raw>
            {communityName}
          </Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={tx('Community name')}
            placeholderTextColor={t.c.textTertiary}
            style={[styles.input, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }]}
            accessibilityLabel={a11y('Type the community’s name to confirm')}
          />
          {error ? (
            <Text variant="bodyS" tone="critical">
              {tx(error)}
            </Text>
          ) : null}
          <Button label="Transfer ownership" icon="key" variant="danger" full loading={busy} disabled={!matches || busy} onPress={() => void run()} />
          <Button label="Choose someone else" variant="ghost" full disabled={busy} onPress={() => (setTo(null), setTyped(''))} />
        </View>
      )}
    </Sheet>
  );
}

/* ───────── Moderation ───────── */

function ModerationSection({ communityId }: { communityId: string }) {
  const t = useTheme();
  const now = useNow(60_000);
  const { sanctions, loading, error, reload } = useSanctions(communityId);
  const current = sanctions.filter((s) => s.kind !== 'warning' && (s.until === null || s.until > now));
  const [busy, setBusy] = useState<string | null>(null);
  const lift = async (s: Sanction) => {
    const key = `${s.kind}-${s.userId}`;
    if (busy) return;
    setBusy(key);
    try {
      if (s.kind === 'ban') await unbanMember(communityId, s.userId);
      else await unrestrictMember(communityId, s.userId);
      haptic('success');
      toast(s.kind === 'ban' ? 'Ban lifted' : 'Restriction lifted', 'check', 'brand');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong. Try again', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };
  return (
    <View style={[styles.pad, { gap: 10 }]}>
      <Text variant="overline" tone="secondary">
        Current bans and restrictions
      </Text>
      {loading && !sanctions.length ? (
        [0, 1].map((i) => <Skeleton key={i} height={72} radius={radius.lg} />)
      ) : error && !sanctions.length ? (
        <Text variant="bodyS" tone="secondary">
          {tx(error)}
        </Text>
      ) : !current.length ? (
        <View style={[styles.empty, { overflow: 'hidden' }]}>
          <GlassLayer radius={radius.xl} />
          <Icon name="shield" size={22} color={t.c.textSecondary} />
          <Text variant="body" tone="secondary" align="center">
            Nobody is banned or restricted.
          </Text>
        </View>
      ) : (
        current.map((s) => (
          <View key={`${s.kind}-${s.userId}`} style={[styles.card, { overflow: 'hidden' }]}>
            <GlassLayer radius={radius.lg} />
            <View style={styles.row}>
              <Avatar name={s.name} hue={hueOf(s.userId)} size={40} userId={s.userId} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="titleS" raw numberOfLines={1}>
                  {s.name}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {[tx(KIND[s.kind]), s.until === null ? tx('Permanent') : tx('until {date}', { date: untilText(s.until) })].join(' · ')}
                </Text>
              </View>
              <Button label={s.kind === 'ban' ? 'Unban' : 'Lift'} size="sm" variant="secondary" loading={busy === `${s.kind}-${s.userId}`} disabled={busy !== null} onPress={() => void lift(s)} />
            </View>
            {s.reason ? (
              <Text variant="bodyS" tone="secondary" raw>
                {s.reason}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

/* ───────── Activities ───────── */

function ActivitiesSection({ communityId, cityId }: { communityId: string; cityId: string }) {
  const router = useRouter();
  const acts = useCommunityActivities(communityId, false);
  const [target, setTarget] = useState<CommunityActivity | null>(null);
  return (
    <View style={[styles.pad, { gap: 10 }]}>
      <Text variant="bodyS" tone="secondary">
        Any member can propose an activity. Moderating one takes it out of the community (and cancels it if it was for the community only); its content is never changed.
      </Text>
      {acts.loading && !acts.activities.length ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={64} radius={radius.lg} />)
      ) : acts.error && !acts.activities.length ? (
        <Text variant="bodyS" tone="secondary">
          Can’t reach IRLY right now
        </Text>
      ) : !acts.activities.length ? (
        <Text variant="bodyS" tone="tertiary">
          No activities coming up.
        </Text>
      ) : (
        acts.activities.map((a) => (
          <View key={a.id} style={[styles.card, styles.row, { overflow: 'hidden' }]}>
            <GlassLayer radius={radius.lg} />
            <PressableScale haptic="select" style={{ flex: 1, minWidth: 0 }} onPress={() => router.push(`/a/${a.id}`)} accessibilityLabel={a.title}>
              <Text variant="titleS" raw numberOfLines={1}>
                {a.title}
              </Text>
              <Text variant="caption" tone="tertiary" raw>
                {[cityWhen(a.startsAt, cityId), `${a.going} ${tx('going')}`].join(' · ')}
              </Text>
            </PressableScale>
            <Chip size="sm" icon="shield" label={tx('Moderate')} onPress={() => setTarget(a)} />
          </View>
        ))
      )}
      <ModerateSheet activity={target} onClose={() => setTarget(null)} onDone={acts.refresh} />
    </View>
  );
}

function ModerateSheet({ activity, onClose, onDone }: { activity: CommunityActivity | null; onClose: () => void; onDone: () => void }) {
  const t = useTheme();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setReason('');
    setError(null);
    onClose();
  };
  const run = async () => {
    if (!activity || busy) return;
    setBusy(true);
    setError(null);
    try {
      await moderateActivity(activity.id, reason);
      haptic('success');
      toast('Activity moderated', 'check', 'brand');
      onDone();
      close();
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={Boolean(activity)} onClose={close} title={tx('Moderate this activity')} scroll>
      {activity ? (
        <View style={{ gap: 14 }}>
          <Text variant="titleS" raw>
            {activity.title}
          </Text>
          <TextInput
            value={reason}
            onChangeText={(v) => setReason(v.slice(0, 300))}
            placeholder={tx('Reason (the organiser will see it)')}
            placeholderTextColor={t.c.textTertiary}
            multiline
            style={[styles.input, { minHeight: 80, color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }]}
            accessibilityLabel={a11y('Reason')}
          />
          <View style={[styles.notice, { borderColor: t.c.live }]}>
            <Text variant="bodyS" tone="secondary">
              It leaves this community. If it was for the community only, it is cancelled. Its content is not changed.
            </Text>
          </View>
          {error ? (
            <Text variant="bodyS" tone="critical">
              {tx(error)}
            </Text>
          ) : null}
          <Button label="Confirm the moderation" variant="danger" full loading={busy} disabled={reason.trim().length < 3 || busy} onPress={() => void run()} />
          <Button label="Cancel" variant="ghost" full disabled={busy} onPress={close} />
        </View>
      ) : null}
    </Sheet>
  );
}

/* ───────── Statistics ───────── */

const STAT_ROWS: { key: keyof CommunityStats; label: string }[] = [
  { key: 'members', label: 'Members' },
  { key: 'new7d', label: 'New members, 7 days' },
  { key: 'new30d', label: 'New members, 30 days' },
  { key: 'upcomingActivities', label: 'Activities coming up' },
  { key: 'activities30d', label: 'Activities, 30 days' },
  { key: 'participants30d', label: 'Participants, 30 days' },
  { key: 'messages7d', label: 'Chat messages, 7 days' },
  { key: 'openReports', label: 'Open reports' },
];

function StatsSection({ communityId }: { communityId: string }) {
  const { stats, loading, error, reload } = useCommunityStats(communityId);
  const reduced = useReducedMotion();
  if (error && !stats) {
    return (
      <View style={[styles.pad, { gap: 10 }]}>
        <Text variant="bodyS" tone="secondary">
          {tx(error)}
        </Text>
        <Button label="Try again" size="sm" variant="secondary" onPress={reload} />
      </View>
    );
  }
  return (
    <View style={[styles.pad, styles.grid]}>
      {STAT_ROWS.map((s, i) => (
        <Animated.View key={s.key} entering={reduced ? undefined : enter.rise(Math.min(i, 6))} style={[styles.stat, { overflow: 'hidden' }]}>
          <GlassLayer radius={radius.lg} />
          {loading ? (
            <Skeleton height={28} width={56} />
          ) : (
            <Text variant="displayM" raw>
              {stats?.[s.key] === null || stats?.[s.key] === undefined ? '—' : String(stats[s.key])}
            </Text>
          )}
          <Text variant="caption" tone="secondary">
            {tx(s.label)}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

/* ───────── History ───────── */

const ACTION_LABEL: [RegExp, string][] = [
  [/transfer/i, 'Ownership transferred'],
  [/perm/i, 'Permissions changed'],
  [/role/i, 'Role changed'],
  [/unban/i, 'Ban lifted'],
  [/ban/i, 'Ban'],
  [/unrestrict/i, 'Restriction lifted'],
  [/restrict/i, 'Restriction'],
  [/warn/i, 'Warning'],
  [/kick|remove_member/i, 'Removed from the community'],
  [/activity/i, 'Activity moderated'],
  [/message/i, 'Message deleted'],
];
const actionLabel = (a: string) => ACTION_LABEL.find(([re]) => re.test(a))?.[1] ?? null;

function HistorySection({ communityId }: { communityId: string }) {
  const { entries, loading, error } = useAuditLog(communityId);
  const now = useNow(60_000);
  return (
    <View style={[styles.pad, { gap: 8 }]}>
      {loading && !entries.length ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={56} radius={radius.lg} />)
      ) : error && !entries.length ? (
        <Text variant="bodyS" tone="secondary">
          {tx(error)}
        </Text>
      ) : !entries.length ? (
        <Text variant="bodyS" tone="tertiary">
          Nothing in the history yet.
        </Text>
      ) : (
        entries.map((e) => <HistoryRow key={e.id} e={e} now={now} />)
      )}
    </View>
  );
}

function HistoryRow({ e, now }: { e: AuditEntry; now: number }) {
  const label = actionLabel(e.action);
  return (
    <View style={[styles.card, { gap: 4, overflow: 'hidden' }]}>
      <GlassLayer radius={radius.lg} />
      <Text variant="label">{label ? tx(label) : e.action.replace(/_/g, ' ')}</Text>
      <Text variant="caption" tone="tertiary" raw>
        {[e.actorName, e.targetName ? `→ ${e.targetName}` : null, e.createdAt ? timeAgo(Math.max(0, Math.round((now - e.createdAt) / 60000))) : null].filter(Boolean).join(' · ')}
      </Text>
      {e.reason ? (
        <Text variant="bodyS" tone="secondary" raw>
          {e.reason}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { padding: 12, borderRadius: radius.lg, gap: 10 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  empty: { alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.xl },
  input: { minHeight: 46, borderRadius: radius.lg, borderWidth: 1, padding: 12, fontFamily: font.medium, fontSize: 15, textAlignVertical: 'top' },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: space[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1, padding: 14, borderRadius: radius.lg, gap: 6, minHeight: 88 },
});
