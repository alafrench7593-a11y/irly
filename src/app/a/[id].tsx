import { webLink } from '@/config/app';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { cityWhen } from '@/lib/time';
import { t as tx } from '@/i18n';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionBar } from '@/components/social/ActionBar';
import { Button } from '@/components/ui/Button';
import { Field, IconButton } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Film } from '@/components/visual/Film';
import { Photo } from '@/components/visual/Photo';
import { filmFor } from '@/data/photos';
import { CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { useAccount, useAuthStatus } from '@/features/auth/account';
import { cancelServerActivity, deleteServerActivity, icsFor, joinServerActivity, leaveServerActivity, updateServerActivity, useServerActivity } from '@/features/server/activities';
import { Sheet } from '@/components/ui/Sheet';
import { confirm } from '@/lib/confirm';
import { openReport } from '@/features/moderation/reportStore';
import { hideItem, useEngagement } from '@/features/server/engage';
import { track } from '@/lib/analytics';
import { haptic } from '@/motion/haptics';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// The activity's own city time, wherever the phone is.
const when = (ms: number, cityId: string) => cityWhen(ms, cityId, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * The canonical page of a member activity or event (one id, linked from
 * Home, Discover, the map, chats, the calendar, notifications, shares and
 * the assistant). Join is capacity-safe and opens the activity chat.
 */
export default function ActivityPage() {
  const reducedMotion = useReducedMotion();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount();
  const { detail: a, loading, error, refresh } = useServerActivity(id);
  const eng = useEngagement('activity', a ? [a.id] : []);
  const [busy, setBusy] = useState(false);
  const [managing, setManaging] = useState(false);
  const auth = useAuthStatus();

  useEffect(() => {
    if (a) track(a.format === 'event' ? 'EVENT_VIEW' : 'ACTIVITY_VIEW', { category: a.categoryId });
  }, [a?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (auth === 'unknown') {
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  }
  if (!eng.signedIn) {
    return (
      <Centered>
        <Text variant="titleM" align="center">
          Sign in to see this activity
        </Text>
        <Button label="Sign in" onPress={() => router.push('/account')} />
      </Centered>
    );
  }
  if (loading) {
    return (
      <Centered>
        <ActivityIndicator color={t.c.text} />
      </Centered>
    );
  }
  if (!a && error) {
    return (
      <Centered>
        <Text variant="titleM" align="center">
          Can’t reach IRLY right now
        </Text>
        <Text variant="body" tone="secondary" align="center">
          Check your connection and try again.
        </Text>
        <Button label="Try again" onPress={refresh} />
      </Centered>
    );
  }
  if (!a) {
    return (
      <Centered>
        <Text variant="titleM" align="center">
          This activity is no longer available
        </Text>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </Centered>
    );
  }

  const city = CITIES[a.cityId as CityId];
  const category = CATEGORY_BY_ID[a.categoryId as CategoryKey];
  const going = a.myStatus === 'going';
  const hosting = a.creatorId === account?.userId;
  const full = a.capacity != null && a.going >= a.capacity && !going;
  const isEvent = a.format === 'event';
  const target = { type: 'activity' as const, id: a.id, title: a.title };

  const join = async () => {
    setBusy(true);
    try {
      const res = await joinServerActivity(a.id);
      if (res === 'full') toast('Just filled up', 'x', 'live');
      else {
        haptic('success');
        track(isEvent ? 'EVENT_JOIN' : 'ACTIVITY_JOIN', { category: a.categoryId });
        toast("You're in. It's in your calendar and the chat is open", 'check', 'positive');
      }
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await leaveServerActivity(a.id);
      track('ACTIVITY_LEAVE', { category: a.categoryId });
      toast('You left. Spot released', 'check', 'brand');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not leave', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  const addToCalendar = async () => {
    const ics = icsFor(a);
    if (Platform.OS === 'web') {
      const blob = new Blob([ics], { type: 'text/calendar' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${a.title}.ics`;
      link.click();
    } else {
      await Share.share({ message: `${a.title} · ${when(a.startsAt, a.cityId)} · ${a.placeName ?? areaName(city, a.areaId)}\n${webLink(`/a/${a.id}`)}` });
    }
  };

  const more = () => {
    hideItem(target)
      .then(() => toast("Hidden. We won't suggest it again", 'eye', 'brand'))
      .catch(() => toast('Could not hide it', 'x', 'live'));
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.cover}>
          <Photo visual={{ photo: ideaPhoto((category?.id ?? 'sport') as CategoryKey, a.title, a.placeName ?? undefined), uri: a.coverUrl }} light={city?.light} scrim="strong" style={StyleSheet.absoluteFill} width={1000} recyclingKey={`a-${a.id}`} drift />
          {!a.coverUrl && !reducedMotion && filmFor(ideaPhoto((category?.id ?? 'sport') as CategoryKey, a.title, a.placeName ?? undefined)) ? (
            <Film uri={filmFor(ideaPhoto((category?.id ?? 'sport') as CategoryKey, a.title, a.placeName ?? undefined))!} dim={0.4} />
          ) : null}
          <View style={[styles.coverText, { paddingBottom: space[5] }]}>
            <Text variant="overline" color="#FFFFFF">
              {[tx(isEvent ? 'Event' : (category?.label ?? 'Activity')), a.girlOnly ? 'IRLY Girl' : null].filter(Boolean).join(' · ')}
            </Text>
            <Text variant="displayM" color="#FFFFFF">
              {a.title}
            </Text>
          </View>
        </View>

        <Animated.View entering={FadeIn.duration(260)} style={styles.body}>
          {a.cancelled ? (
            <View style={[styles.banner, { backgroundColor: t.c.surface }]}>
              <Icon name="x" size={18} color={t.c.live} />
              <Text variant="body">This activity was cancelled.</Text>
            </View>
          ) : null}
          <ActionBar target={target} eng={eng} />
          <Fact icon="clock" text={when(a.startsAt, a.cityId)} />
          <Fact icon="pin" text={`${a.placeName ? `${a.placeName} · ` : ''}${city ? areaName(city, a.areaId) : a.areaId}`} />
          <Fact icon="users" text={`${a.going}${a.capacity ? ` / ${a.capacity}` : ''} ${tx('going')}${full ? ` · ${tx('Full')}` : ''}`} />
          <Fact icon="banknote" text={a.priceMinor ? `${a.currency} ${(a.priceMinor / 100).toLocaleString('en-US')}` : tx('Free')} />
          {a.creatorName ? <Fact icon="user" text={tx('Hosted by {name}', { name: a.creatorName })} /> : null}
          {a.description ? (
            <Text variant="body" tone="secondary">
              {a.description}
            </Text>
          ) : null}
          <Text variant="caption" tone="tertiary">
            The exact meeting point is shared in the activity chat.
          </Text>
          <View style={styles.row}>
            <Button label="Add to my calendar" icon="calendar" size="sm" variant="secondary" onPress={addToCalendar} />
            <Button label="Not for me" icon="eye" size="sm" variant="ghost" onPress={more} />
            <Button
              label="Report"
              icon="flag"
              size="sm"
              variant="ghost"
              onPress={() => openReport({ kind: 'activity', id: a.id, userId: a.creatorId })}
            />
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 14), backgroundColor: t.c.bg, borderColor: t.c.line }]}>
        {going && a.conversationId ? (
          <>
            <View style={{ flex: 1 }}>
              <Button label="Open chat" icon="message" full onPress={() => router.push(`/messages/${a.conversationId}`)} />
            </View>
            {hosting ? null : <Button label="Leave" variant="secondary" loading={busy} onPress={leave} />}
          </>
        ) : a.cancelled ? (
          <Button label="Cancelled" disabled full onPress={() => undefined} />
        ) : (
          <Button label={full ? 'Full' : isEvent ? 'Join event' : 'Join'} icon="plus" full disabled={full} loading={busy} onPress={join} />
        )}
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="chevronLeft" label="Back" variant="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        {hosting ? <IconButton icon="settings" label="Manage your activity" variant="glass" onPress={() => setManaging(true)} /> : null}
      </View>
      {hosting ? (
        <HostSheet
          visible={managing}
          onClose={() => setManaging(false)}
          a={a}
          onCancelled={() => {
            toast('Cancelled. Participants were notified', 'check', 'brand');
            refresh();
          }}
          onDeleted={() => {
            toast('Activity deleted', 'check', 'brand');
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * The organiser's tools: edit (name, place, description), cancel, delete.
 * One write to the server; every screen showing the activity (lists, map,
 * calendar, chat title, search) follows through the sync channel.
 */
function HostSheet({ visible, onClose, a, onCancelled, onDeleted }: { visible: boolean; onClose: () => void; a: { id: string; title: string; placeName: string | null; description: string | null; cancelled: boolean }; onCancelled: () => void; onDeleted: () => void }) {
  const [title, setTitle] = useState(a.title);
  const [place, setPlace] = useState(a.placeName ?? '');
  const [about, setAbout] = useState(a.description ?? '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving || title.trim().length < 3) return;
    setSaving(true);
    try {
      await updateServerActivity(a.id, { title, placeName: place.trim() || null, description: about.trim() || null });
      haptic('success');
      toast('Saved. Everyone sees the new version', 'check', 'brand');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Your activity" subtitle="You organise it">
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Field value={title} onChangeText={setTitle} placeholder="Name" accessibilityLabel="Name" maxLength={80} />
        <Field value={place} onChangeText={setPlace} placeholder="Place (e.g. Kite Beach, court 3)" accessibilityLabel="Place" icon="pin" maxLength={120} />
        <Field value={about} onChangeText={setAbout} placeholder="Description" accessibilityLabel="Description" multiline maxLength={1000} />
        <Button label="Save changes" icon="check" full loading={saving} disabled={saving || title.trim().length < 3} onPress={save} />
        {!a.cancelled ? (
          <Button
            label="Cancel activity"
            icon="x"
            variant="secondary"
            full
            onPress={() =>
              confirm('Cancel this activity? Participants will be notified.', () =>
                cancelServerActivity(a.id)
                  .then(() => {
                    onClose();
                    onCancelled();
                  })
                  .catch(() => toast('Could not cancel', 'x', 'live')),
              'Cancel activity')
            }
          />
        ) : null}
        <Button
          label="Delete activity"
          icon="x"
          variant="danger"
          full
          onPress={() =>
            confirm('Delete this activity? It disappears for everyone, with its chat.', () =>
              deleteServerActivity(a.id)
                .then(() => {
                  onClose();
                  onDeleted();
                })
                .catch((e) => toast(e instanceof Error ? e.message : 'Could not delete', 'x', 'live')),
            )
          }
        />
      </View>
    </Sheet>
  );
}

function Fact({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={18} color={t.c.textSecondary} />
      <Text variant="body" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <View style={[styles.centered, { backgroundColor: t.c.bg }]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { height: 360, justifyContent: 'flex-end' },
  coverText: { paddingHorizontal: space.gutter, gap: 6 },
  body: { padding: space.gutter, gap: 14 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: space.gutter, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  top: { position: 'absolute', left: space.gutter, right: space.gutter, top: 0, flexDirection: 'row', justifyContent: 'space-between' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: space.gutter },
});
