import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CharCount } from '@/components/ui/CharCount';
import { Chip, Field } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { a11y, t as tx } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { hueOf } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import {
  ANSWER_MAX,
  applyToCommunity,
  decideApplication,
  MESSAGE_MAX,
  MESSAGE_MIN,
  useApplications,
  withdrawApplication,
  type Application,
  type CommunityAccess,
} from './applications';

/**
 * A private community, for the person at its door and for its team:
 *  - ApplyGate: « Request to join », the form (a message and the team's
 *    questions), « Application pending » with « Withdraw my request ».
 *  - PrivateWall: what stands in place of the posts, the chat, the
 *    activities and the members until she is accepted.
 *  - ApplicationsSection: « Manage → Applications », each request with the
 *    applicant's public profile, her message and answers, Accept and Refuse.
 * The server decides every step; its refusals are shown as written for members.
 */

const agoText = (ms: number | null, now: number) => (ms === null ? '' : timeAgo(Math.max(0, Math.round((now - ms) / 60000))));

/* ───────── the applicant ───────── */

export function ApplyGate({ communityId, communityName, access }: { communityId: string; communityName: string; access: CommunityAccess }) {
  const t = useTheme();
  const now = useNow(60_000);
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const app = access.application;
  const pending = app?.status === 'pending';

  const withdraw = () =>
    confirm('Withdraw your request to join this community?', () => {
      if (busy) return;
      setBusy(true);
      withdrawApplication(communityId)
        .then(() => toast('Request withdrawn', 'check', 'brand'))
        .catch((e) => toast(e instanceof Error ? e.message : 'Something went wrong. Try again', 'x', 'live'))
        .finally(() => setBusy(false));
    }, 'Withdraw my request');

  if (pending) {
    return (
      <View style={[styles.card, { overflow: 'hidden' }]}>
        <GlassLayer radius={radius.xl} />
        <View style={styles.row}>
          <Icon name="clock" size={20} color={t.c.brand} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="titleS">Application pending</Text>
            <Text variant="bodyS" tone="secondary">
              {app?.createdAt ? tx('Sent {ago}. The community’s team will answer; you will be notified.', { ago: agoText(app.createdAt, now) }) : tx('The community’s team will answer; you will be notified.')}
            </Text>
          </View>
        </View>
        <Button label="Withdraw my request" variant="secondary" full loading={busy} onPress={withdraw} />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {app?.status === 'refused' ? (
        <Text variant="bodyS" tone="secondary">
          Your last request was not accepted. You can send a new one.
        </Text>
      ) : null}
      <Button label="Request to join" icon="userPlus" full onPress={() => setForm(true)} />
      <ApplySheet visible={form} onClose={() => setForm(false)} communityId={communityId} communityName={communityName} questions={access.questions} />
    </View>
  );
}

function ApplySheet({ visible, onClose, communityId, communityName, questions }: { visible: boolean; onClose: () => void; communityId: string; communityName: string; questions: string[] }) {
  const [message, setMessage] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = message.trim();
  const answered = questions.every((_, i) => (answers[i] ?? '').trim().length > 0);
  const ready = text.length >= MESSAGE_MIN && answered;

  const send = async () => {
    // One request at a time (the server keeps one pending request too).
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await applyToCommunity(
        communityId,
        text,
        questions.map((_, i) => answers[i] ?? ''),
      );
      haptic('success');
      toast('Request sent', 'check', 'brand');
      setMessage('');
      setAnswers([]);
      onClose();
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={tx('Request to join')} subtitle={communityName} scroll>
      <View style={styles.sheet}>
        <Text variant="bodyS" tone="secondary">
          Only the community’s team reads your message and your answers. They never show on your profile or in a feed.
        </Text>
        <View style={{ gap: 6 }}>
          <Text variant="label">Why would you like to join?</Text>
          <Field value={message} onChangeText={(v) => setMessage(v.slice(0, MESSAGE_MAX))} multiline maxLength={MESSAGE_MAX} placeholder={tx('A few words about you and what brings you here')} accessibilityLabel={a11y('Why would you like to join?')} style={{ minHeight: 110 }} />
          <CharCount length={text.length} min={MESSAGE_MIN} max={MESSAGE_MAX} />
        </View>
        {questions.map((q, i) => (
          <View key={`${i}-${q}`} style={{ gap: 6 }}>
            <Text variant="label" raw>
              {q}
            </Text>
            <Field
              value={answers[i] ?? ''}
              onChangeText={(v) =>
                setAnswers((a) => {
                  const next = questions.map((_, k) => a[k] ?? '');
                  next[i] = v.slice(0, ANSWER_MAX);
                  return next;
                })
              }
              multiline
              maxLength={ANSWER_MAX}
              placeholder={tx('Your answer')}
              accessibilityLabel={q}
            />
          </View>
        ))}
        {error ? (
          <Text variant="bodyS" tone="critical">
            {tx(error)}
          </Text>
        ) : null}
        <Button label="Send my request" icon="send" full loading={busy} disabled={!ready || busy} onPress={() => void send()} />
        <Button label="Cancel" variant="ghost" full disabled={busy} onPress={onClose} />
      </View>
    </Sheet>
  );
}

/** In place of the posts, the chat, the activities and the members of a private community. */
export function PrivateWall({ pending }: { pending: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.wall, { overflow: 'hidden' }]}>
      <GlassLayer radius={radius.xl} />
      <Icon name="lock" size={24} color={t.c.textSecondary} />
      <Text variant="titleM" align="center">
        This community is private
      </Text>
      <Text variant="body" tone="secondary" align="center">
        Only accepted members see its posts, its chat, its activities and its members.
      </Text>
      <Text variant="bodyS" tone="tertiary" align="center">
        {pending ? 'Your request is with the community’s team.' : 'Ask to join: the community’s team reads your request and answers.'}
      </Text>
    </View>
  );
}

/* ───────── the team ───────── */

export function ApplicationsSection({ communityId }: { communityId: string }) {
  const t = useTheme();
  const [view, setView] = useState<'pending' | 'answered'>('pending');
  const { applications, loading, error, reload } = useApplications(communityId, view);
  const now = useNow(60_000);
  const reduced = useReducedMotion();
  return (
    <View style={[styles.pad, { gap: 12 }]}>
      <View style={styles.wrap}>
        <Chip size="sm" icon="clock" label={tx('Pending')} selected={view === 'pending'} onPress={() => setView('pending')} />
        <Chip size="sm" icon="check" label={tx('Answered')} selected={view === 'answered'} onPress={() => setView('answered')} />
      </View>
      {loading && !applications.length ? (
        [0, 1].map((i) => <Skeleton key={i} height={120} radius={radius.lg} />)
      ) : error && !applications.length ? (
        <View style={{ gap: 10 }}>
          <Text variant="bodyS" tone="secondary">
            {tx(error)}
          </Text>
          <Button label="Try again" size="sm" variant="secondary" onPress={reload} />
        </View>
      ) : !applications.length ? (
        <View style={[styles.wall, { overflow: 'hidden' }]}>
          <GlassLayer radius={radius.xl} />
          <Icon name="userCheck" size={22} color={t.c.textSecondary} />
          <Text variant="body" tone="secondary" align="center">
            {view === 'pending' ? tx('No application is waiting.') : tx('No application answered yet.')}
          </Text>
        </View>
      ) : (
        applications.map((a) => (
          <Animated.View key={a.id} entering={reduced ? undefined : FadeIn.duration(160)}>
            <ApplicationCard a={a} now={now} onDone={reload} />
          </Animated.View>
        ))
      )}
    </View>
  );
}

const STATUS_LABEL: Record<Application['status'], string> = { pending: 'Pending', accepted: 'Accepted', refused: 'Refused', withdrawn: 'Withdrawn' };

function ApplicationCard({ a, now, onDone }: { a: Application; now: number; onDone: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState<'accept' | 'refuse' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (accept: boolean) => {
    // One answer at a time from this phone; the server keeps one answer for everyone.
    if (busy) return;
    setBusy(accept ? 'accept' : 'refuse');
    setError(null);
    try {
      const r = await decideApplication(a.id, accept);
      if (!r.decided) {
        // Another admin answered first (or she withdrew): what was decided is said, nothing is redone.
        toast(r.status === 'accepted' ? 'Already accepted by the team' : r.status === 'refused' ? 'Already refused by the team' : 'This request was withdrawn', 'check', 'brand');
      } else {
        haptic('success');
        toast(accept ? tx('{name} is now a member', { name: a.name }) : 'Application refused', 'check', 'brand');
      }
      onDone();
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.card, { overflow: 'hidden' }]}>
      <GlassLayer radius={radius.lg} />
      <PressableScale haptic="select" scaleTo={0.98} style={styles.row} onPress={() => router.push(`/person/${a.userId}`)} accessibilityRole="button" accessibilityLabel={tx('View the profile of {name}', { name: a.name })}>
        <Avatar name={a.name} hue={hueOf(a.userId)} size={44} userId={a.userId} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="titleS" raw numberOfLines={1}>
            {a.name}
          </Text>
          <Text variant="caption" tone="tertiary" raw>
            {[a.status === 'pending' ? null : tx(STATUS_LABEL[a.status]), a.status !== 'pending' && a.decidedByName ? a.decidedByName : null, agoText(a.status === 'pending' ? a.createdAt : (a.decidedAt ?? a.createdAt), now)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Text variant="caption" tone="secondary">
          View profile
        </Text>
        <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
      </PressableScale>
      <Text variant="body" raw>
        {a.message}
      </Text>
      {a.answers.map((x, i) => (
        <View key={i} style={{ gap: 2 }}>
          <Text variant="caption" tone="tertiary" raw>
            {x.q}
          </Text>
          <Text variant="bodyS" raw>
            {x.a}
          </Text>
        </View>
      ))}
      {error ? (
        <Text variant="bodyS" tone="critical">
          {tx(error)}
        </Text>
      ) : null}
      {a.status === 'pending' ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button label="Accept" icon="check" full loading={busy === 'accept'} disabled={busy !== null} onPress={() => void decide(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Refuse" variant="secondary" full loading={busy === 'refuse'} disabled={busy !== null} onPress={() => confirm(tx('Refuse the request of {name}? They will be told.', { name: a.name }), () => void decide(false), 'Refuse')} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { padding: 14, borderRadius: radius.lg, gap: 12 },
  wall: { alignItems: 'center', gap: 12, padding: 24, borderRadius: radius.xl },
  // A sheet pads nothing itself: the form keeps the header's margin and clears the home indicator.
  sheet: { gap: 14, paddingHorizontal: space.gutter + 4, paddingBottom: space[6] },
});
