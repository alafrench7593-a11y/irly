import { webLink } from '@/config/app';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isDemoId } from '@/features/girl/demo';
import { DemoPlanScreen } from '@/features/girl/DemoScreens';
import { cityWhen } from '@/lib/time';
import { t as tx, formatNumber } from '@/i18n';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
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
import { CoverEditor, type CoverLibrary } from '@/components/visual/CoverEditor';
import { isLibraryUrl, libraryFor, libraryKindOf } from '@/features/create/photoLibrary';
import { isContentStaff, useStaffRole } from '@/features/admin/api';
import { setActivityCover } from '@/features/server/covers';
import { cancelServerActivity, deleteServerActivity, icsFor, joinServerActivity, leaveServerActivity, updateServerActivity, useServerActivity } from '@/features/server/activities';
import { Sheet } from '@/components/ui/Sheet';
import { DateTimePicker, WhenField } from '@/components/ui/DateTimePicker';
import { instants, problemOf, whenFrom, type When } from '@/features/create/when';
import { confirm } from '@/lib/confirm';
import { openReport } from '@/features/moderation/reportStore';
import { hideItem, useEngagement } from '@/features/server/engage';
import { track } from '@/lib/analytics';
import { haptic } from '@/motion/haptics';
import { addToPhoneCalendar } from '@/lib/phoneCalendar';
import { useNow } from '@/lib/useNow';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Ambient } from '@/components/visual/Ambient';
import { enter } from '@/motion/enter';
import { SpaceFlavor } from '@/theme/space';

// The activity's own city time, wherever the phone is.
const when = (ms: number, cityId: string) => cityWhen(ms, cityId, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * The canonical page of a member activity or event (one id, linked from
 * Home, Discover, the map, chats, the calendar, notifications, shares and
 * the assistant). Join is capacity-safe and opens the activity chat.
 */
// The demonstration build's IRLY Girl plans (example content, nothing saved).
export default function ActivityRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Opened from IRLY Girl, the page wears the Girl look (cosmetic only, see theme/space).
  return <SpaceFlavor>{isDemoId(id) ? <DemoPlanScreen id={id} /> : <ActivityPage />}</SpaceFlavor>;
}

function ActivityPage() {
  const reducedMotion = useReducedMotion();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount();
  const { detail: a, loading, error, refresh } = useServerActivity(id);
  const contentStaff = isContentStaff(useStaffRole());
  const eng = useEngagement('activity', a ? [a.id] : []);
  const [busy, setBusy] = useState(false);
  // Right after joining: the button confirms ("You're in") until the page knows you are going,
  // and at least a beat, so it never flashes back to Join while the detail refreshes.
  const [confirming, setConfirming] = useState(false);
  const [held, setHeld] = useState(false);
  const [managing, setManaging] = useState(false);
  const now = useNow();
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
        <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
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
        <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Centered>
    );
  }
  if (!a) {
    return (
      <Centered>
        <Text variant="titleM" align="center">
          This activity is no longer available
        </Text>
        <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Centered>
    );
  }

  const city = CITIES[a.cityId as CityId];
  const category = CATEGORY_BY_ID[a.categoryId as CategoryKey];
  const going = a.myStatus === 'going';
  const hosting = a.creatorId === account?.userId;
  const full = a.capacity != null && a.going >= a.capacity && !going;
  // Same cutoff as the server's join: two hours after the start when no end is set.
  const over = (a.endsAt ?? a.startsAt + 2 * 3600_000) < now;
  const isEvent = a.format === 'event';
  const target = { type: 'activity' as const, id: a.id, title: a.title };

  const confirmingNow = confirming && (held || !going);
  // The host can also pick from the IRLY library (the type's photos, as when the activity was created); staff keep the upload.
  const coverLibrary: CoverLibrary | undefined = hosting
    ? {
        urls: libraryFor(libraryKindOf((category?.id ?? 'sport') as CategoryKey, a.title, a.placeName ?? undefined, category?.subs.find((s) => s.id === a.subId)?.label), { girl: t.flavor === 'girl' || a.girlOnly }),
        title: a.title,
        current: isLibraryUrl(a.coverUrl) ? a.coverUrl : null,
        choose: (url) => updateServerActivity(a.id, { libraryCover: url }),
      }
    : undefined;

  const join = async () => {
    // One join at a time (a second tap while the first is on its way does nothing).
    if (busy || confirming) return;
    setBusy(true);
    try {
      const res = await joinServerActivity(a.id);
      if (res === 'full') toast('Just filled up', 'x', 'live');
      else {
        haptic('success');
        track(isEvent ? 'EVENT_JOIN' : 'ACTIVITY_JOIN', { category: a.categoryId });
        toast("You're in. It's in your calendar and the chat is open", 'check', 'positive');
        setConfirming(true);
        setHeld(true);
        setTimeout(() => setHeld(false), 1400);
        // Never stuck on the confirmation if the refresh does not come back.
        setTimeout(() => setConfirming(false), 6000);
      }
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (busy) return;
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
    try {
      const res = await addToPhoneCalendar({
        title: a.title,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        location: `${a.placeName ? `${a.placeName}, ` : ''}${city ? areaName(city, a.areaId) : a.areaId}`,
        url: webLink(`/a/${a.id}`),
        ics: icsFor(a),
      });
      if (res === 'saved') toast('Added to your calendar', 'calendar', 'positive');
    } catch {
      toast('Could not open your calendar', 'x', 'live');
    }
  };

  const more = () => {
    hideItem(target)
      .then(() => toast("Hidden. We won't suggest it again", 'eye', 'brand'))
      .catch(() => toast('Could not hide it', 'x', 'live'));
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.cover}>
          <Photo visual={{ photo: ideaPhoto((category?.id ?? 'sport') as CategoryKey, a.title, a.placeName ?? undefined, a.subId), uri: a.coverUrl }} light={city?.light} scrim="strong" style={StyleSheet.absoluteFill} width={1000} recyclingKey={`a-${a.id}`} drift />
          {!a.coverUrl && !reducedMotion && filmFor(ideaPhoto((category?.id ?? 'sport') as CategoryKey, a.title, a.placeName ?? undefined, a.subId)) ? (
            <Film uri={filmFor(ideaPhoto((category?.id ?? 'sport') as CategoryKey, a.title, a.placeName ?? undefined, a.subId))!} dim={0.4} />
          ) : null}
          {hosting || contentStaff ? (
            <CoverEditor style={[styles.coverEdit, { top: insets.top + 56 }]} hasOwn={Boolean(a.coverUrl)} staff={contentStaff && !hosting} save={(picked) => setActivityCover(a.id, picked)} library={coverLibrary} onChanged={refresh} />
          ) : null}
          <View style={[styles.coverText, { paddingBottom: space[5] }]}>
            <Text variant="overline" color="#FFFFFF">
              {[tx(isEvent ? 'Event' : (category?.label ?? 'Activity')), a.girlOnly ? 'IRLY Girl' : null].filter(Boolean).join(' · ')}
            </Text>
            <Text variant="displayM" color="#FFFFFF" numberOfLines={3} raw>
              {a.title}
            </Text>
          </View>
        </View>

        <Animated.View entering={enter.rise(0, 80)} style={styles.body}>
          {a.cancelled ? (
            <View style={[styles.banner, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
              <GlassLayer radius={radius.lg} />
              <Icon name="x" size={18} color={t.c.live} />
              <Text variant="body">This activity was cancelled.</Text>
            </View>
          ) : null}
          <ActionBar target={target} eng={eng} />
          <Fact index={0} icon="clock" text={when(a.startsAt, a.cityId)} />
          <Fact index={1} icon="pin" text={`${a.placeName ? `${a.placeName} · ` : ''}${city ? areaName(city, a.areaId) : a.areaId}`} />
          <Fact index={2} icon="users" text={`${a.going}${a.capacity ? ` / ${a.capacity}` : ''} ${tx('going')}${full ? ` · ${tx('Full')}` : ''}`} />
          <Fact index={3} icon="banknote" text={a.priceMinor ? `${a.currency} ${formatNumber(a.priceMinor / 100)}` : tx('Free')} />
          {a.creatorName ? <Fact index={4} icon="user" text={tx('Hosted by {name}', { name: a.creatorName })} /> : null}
          {a.description ? (
            <View style={styles.about}>
              <Text variant="overline" tone="secondary">
                About
              </Text>
              <Text variant="body" raw>
                {a.description}
              </Text>
            </View>
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

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 14), backgroundColor: 'transparent', borderColor: 'transparent', overflow: 'hidden' }]}>
        <GlassLayer level="thick" />
        {/* Each state of the action rises in, so joining reads as one gesture: Join → You're in → Open chat. */}
        <Animated.View key={confirmingNow ? 'done' : going ? 'in' : 'out'} entering={reducedMotion ? undefined : enter.rise(0)} style={styles.ctaRow}>
          {confirmingNow ? (
            <Button label="You're in" icon="check" variant="done" full haptic={false} onPress={() => undefined} />
          ) : going && a.conversationId ? (
            <>
              <View style={{ flex: 1 }}>
                <Button label="Open chat" icon="message" full onPress={() => router.push(`/messages/${a.conversationId}`)} />
              </View>
              {hosting ? null : <Button label="Leave" variant="secondary" loading={busy} onPress={leave} />}
            </>
          ) : a.primed && error ? (
            // Just created, but the full detail did not load: offer to try again (never a dead spinner).
            <Button label="Try again" full onPress={refresh} />
          ) : a.primed ? (
            // Just created: the page opened before its chat id arrived (a moment later).
            <Button label="Open chat" icon="message" full loading disabled onPress={() => undefined} />
          ) : a.cancelled ? (
            <Button label="Cancelled" disabled full onPress={() => undefined} />
          ) : over ? (
            <Button label="Ended" disabled full onPress={() => undefined} />
          ) : (
            <Button label={full ? 'Full' : isEvent ? 'Join event' : 'Join'} icon="plus" full disabled={full} loading={busy} onPress={join} />
          )}
        </Animated.View>
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="chevronLeft" label="Back" variant="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        {hosting ? <IconButton icon="settings" label="Manage your activity" variant="glass" onPress={() => setManaging(true)} /> : null}
      </View>
      {hosting ? (
        <HostSheet
          // Its fields start from this activity: another activity gets a fresh sheet.
          key={a.id}
          visible={managing}
          onClose={() => setManaging(false)}
          a={a}
          over={over}
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
function HostSheet({ visible, onClose, a, over, onCancelled, onDeleted }: { visible: boolean; onClose: () => void; a: { id: string; title: string; placeName: string | null; description: string | null; cancelled: boolean; cityId: string; startsAt: number; endsAt: number | null; priceMinor: number; currency: string; capacity: number | null; going: number }; over: boolean; onCancelled: () => void; onDeleted: () => void }) {
  const [title, setTitle] = useState(a.title);
  const [place, setPlace] = useState(a.placeName ?? '');
  const [about, setAbout] = useState(a.description ?? '');
  // Price (0: free) and spots (empty: unlimited), as on the creation form.
  const [price, setPrice] = useState(a.priceMinor ? String(a.priceMinor / 100) : '');
  const [spots, setSpots] = useState(a.capacity ? String(a.capacity) : '');
  // Date and time read back in the activity's city time, as they were saved.
  const city = CITIES[a.cityId as CityId] ?? CITIES.dubai;
  const [when, setWhen] = useState<When>(() => whenFrom(a.startsAt, a.endsAt, city.utcOffset));
  const [picking, setPicking] = useState(false);
  // Set once a time is confirmed in the picker: other edits never move the activity.
  const [timeChanged, setTimeChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving || title.trim().length < 3) return;
    const moved = instants(when, city.utcOffset);
    const problem = timeChanged ? problemOf(when, city.utcOffset, Date.now()) : null;
    if (problem) {
      toast(problem === 'past' ? 'This time has passed: pick a later one' : 'The end must be after the start', 'calendar', 'brand');
      return;
    }
    const priceValue = price.trim() ? Number(price.replace(',', '.')) : 0;
    const spotsValue = spots.trim() ? Math.round(Number(spots)) : null;
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      toast('Enter a price, or leave it empty for free', 'banknote', 'brand');
      return;
    }
    if (spotsValue !== null && (!Number.isFinite(spotsValue) || spotsValue < Math.max(2, a.going) || spotsValue > 1000)) {
      toast(tx('Spots: between {min} and 1000, or empty for unlimited', { min: Math.max(2, a.going) }), 'users', 'brand');
      return;
    }
    setSaving(true);
    try {
      await updateServerActivity(a.id, {
        title,
        placeName: place.trim() || null,
        description: about.trim() || null,
        priceMinor: Math.round(priceValue * 100),
        capacity: spotsValue,
        ...(timeChanged ? { startsAt: moved.startsAt, endsAt: moved.endsAt } : {}),
      });
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
    <Sheet visible={visible} onClose={onClose} title="Your activity" subtitle="You organise it" scroll>
      <View style={{ gap: 12, paddingBottom: 12 }}>
        <Field value={title} onChangeText={setTitle} placeholder="Name" accessibilityLabel="Name" maxLength={80} />
        <Field value={place} onChangeText={setPlace} placeholder="Place (e.g. Kite Beach, court 3)" accessibilityLabel="Place" icon="pin" maxLength={120} />
        <Field value={about} onChangeText={setAbout} placeholder="Description" accessibilityLabel="Description" multiline maxLength={1000} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field value={price} onChangeText={(v) => setPrice(v.replace(/[^0-9.,]/g, '').slice(0, 9))} placeholder={tx('Price in {currency} (empty: free)', { currency: a.currency })} accessibilityLabel="Price" icon="banknote" keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field value={spots} onChangeText={(v) => setSpots(v.replace(/[^0-9]/g, '').slice(0, 4))} placeholder={tx('Spots (empty: unlimited)')} accessibilityLabel="Spots" icon="users" keyboardType="number-pad" />
          </View>
        </View>
        <WhenField value={when} utcOffset={city.utcOffset} onPress={() => setPicking(true)} />
        <DateTimePicker
          visible={picking}
          onClose={() => setPicking(false)}
          value={when}
          onConfirm={(w) => {
            setWhen(w);
            setTimeChanged(true);
          }}
          utcOffset={city.utcOffset}
          cityName={city.name}
        />
        <Button label="Save changes" icon="check" full loading={saving} disabled={saving || title.trim().length < 3} onPress={save} />
        {!a.cancelled && !over ? (
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
                  .catch((e: unknown) => toast(e instanceof Error ? e.message : 'Could not cancel', 'x', 'live')),
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

function Fact({ index, icon, text }: { index: number; icon: IconName; text: string }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : enter.rise(index, 140)} style={styles.fact}>
      <Icon name={icon} size={18} color={t.c.textSecondary} />
      <Text variant="body" style={{ flex: 1 }}>
        {text}
      </Text>
    </Animated.View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.centered, { backgroundColor: t.c.bg }]}>
      <Ambient />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { height: 360, justifyContent: 'flex-end' },
  coverEdit: { position: 'absolute', right: space.gutter },
  coverText: { paddingHorizontal: space.gutter, gap: 6 },
  body: { padding: space.gutter, gap: 14 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  about: { gap: 4 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: space.gutter, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  ctaRow: { flex: 1, flexDirection: 'row', gap: 10 },
  top: { position: 'absolute', left: space.gutter, right: space.gutter, top: 0, flexDirection: 'row', justifyContent: 'space-between' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: space.gutter },
});
