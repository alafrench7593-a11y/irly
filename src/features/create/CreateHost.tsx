import { useEffect, useMemo, useRef, useState } from 'react';
import { AreaPicker } from '@/components/ui/AreaPicker';
import { Image } from 'expo-image';
import { a11y, t as tx } from '@/i18n';
import { BackHandler, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Extrapolation, FadeIn, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useFrame } from '@/components/layout/AppFrame';
import { Button } from '@/components/ui/Button';
import { DateTimePicker, WhenField, whenText } from '@/components/ui/DateTimePicker';
import { Chip, Field } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Ambient } from '@/components/visual/Ambient';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CATALOG_ENTRIES, CATEGORIES, CATEGORY_BY_ID, guessCategory, ideaPhoto, photoForText, searchCatalog, type CatalogActivity, type CatalogSub, type CategoryKey } from '@/data/catalog/categories';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { photo, type PhotoKey } from '@/data/photos';
import { Photo } from '@/components/visual/Photo';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { useKeyboardHeight } from '@/motion/keyboard';
import { PressableScale } from '@/motion/PressableScale';
import { ease, motion, scale as scaleTokens, spring } from '@/motion/tokens';
import { useCityId, useStore, type MyPlan } from '@/state/store';
import { font, layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { createServerActivity, useGeocoderOn, useMyCommunityOptions } from '@/features/server/activities';
import { useAccount } from '@/features/auth/account';
import { useNow } from '@/lib/useNow';
import { useRouter } from 'expo-router';
import { dropStagedCover, pickPhoto, stageCover } from '@/features/server/covers';
import { useCreateStore, type CreateFormat } from './createStore';
import { clockLabel, instants, localPlanDay, problemOf, type When } from './when';

const PRIVACY: { id: NonNullable<MyPlan['privacy']>; label: string }[] = [
  { id: 'public', label: 'Public' },
  { id: 'connections', label: 'Friends' },
  { id: 'community', label: 'Community' },
  { id: 'invite', label: 'Invite only' },
];
const BUTTON = 52;

/** Suggested prices in the destination's currency. */
const PRICES: Record<'AED' | 'IDR', number[]> = {
  AED: [25, 50, 80, 150, 300],
  IDR: [50_000, 100_000, 250_000, 500_000, 1_000_000],
};
export const formatPrice = (n: number, currency: string) => (n ? `${currency} ${n.toLocaleString('en-US')}` : 'Free');

const FORMAT: Record<CreateFormat, { title: string; cta: string }> = {
  activity: { title: 'What do you want to do?', cta: 'Create activity' },
  sport: { title: 'Which sport?', cta: 'Create sport session' },
  event: { title: 'What is the event?', cta: 'Create event' },
  session: { title: 'What do you want to do?', cta: 'Create session' },
  meetup: { title: 'What kind of meetup?', cta: 'Create meetup' },
  trip: { title: 'Where are you going?', cta: 'Create trip' },
};

type Pick = { categoryId: CategoryKey; sub?: CatalogSub; activity?: CatalogActivity; custom?: string };

/**
 * WHAT DO YOU WANT TO DO? The twelve things people start most, one tap
 * each. A pick with a catalog entry jumps straight to « when », a broad
 * one opens its category, « Other » goes to « name your own ».
 */
const QUICK: { label: string; icon: IconName; entry?: string; category?: CategoryKey }[] = [
  { label: 'Football', icon: 'trophy', entry: 'Football' },
  { label: 'Padel', icon: 'target', entry: 'Padel' },
  { label: 'Dinner', icon: 'utensils', entry: 'Dinner' },
  { label: 'Coffee', icon: 'coffee', entry: 'Coffee' },
  { label: 'Beach', icon: 'palm', entry: 'Beach' },
  { label: 'Gym', icon: 'dumbbell', entry: 'Gym' },
  { label: 'Brunch', icon: 'sunrise', entry: 'Brunch' },
  { label: 'Walk', icon: 'footprints', entry: 'Walk together' },
  { label: 'Party', icon: 'disc', category: 'nightlife' },
  { label: 'Coworking', icon: 'laptop', category: 'networking' },
  { label: 'Travel', icon: 'plane', category: 'travel' },
  { label: 'Other', icon: 'plus' },
];

/** A quick pick shows a photo of the activity itself, never an icon. */
function quickPhoto(q: (typeof QUICK)[number]): PhotoKey {
  return photoForText(q.entry ?? q.label) ?? (q.category ? CATEGORY_BY_ID[q.category].photo : 'girlsOut');
}

/**
 * The server clearly said no (a rule, a check, an ended session): nothing was created.
 * No answer (offline, timeout, aborted, gateway) or a duplicate (an earlier try saved it)
 * is not a refusal: the activity may exist.
 */
function refusedForSure(e: unknown): boolean {
  const m = e instanceof Error ? e.message : '';
  if (!m) return false;
  return !/fetch|network|connection|offline|timed? ?out|timeout|abort|gateway|50[234]|duplicate|23505|server error/i.test(m);
}

function findEntry(label: string) {
  const l = label.toLowerCase();
  return CATALOG_ENTRIES.find((e) => e.label.toLowerCase() === l) ?? searchCatalog(label, 1)[0];
}

/**
 * Create a session, from anything. Step 1: a category (or search the whole
 * catalog, or type your own activity). Step 2: the activity. Step 3: when,
 * where, who can see it. Step 4: how many people. The white Create button
 * grows into the screen on `spring.soft` and becomes the close button.
 */
export function CreateHost() {
  const open = useCreateStore((s) => s.open);
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  if (!mounted) return null;
  return <Composer open={open} onClosed={() => setMounted(false)} />;
}

function Composer({ open, onClosed }: { open: boolean; onClosed: () => void }) {
  const t = useTheme();
  const frame = useFrame();
  const insets = useSafeAreaInsets();
  const hide = useCreateStore((s) => s.hide);
  const preset = useCreateStore((s) => s.preset);
  const origin = useCreateStore((s) => s.origin) ?? { x: frame.width / 2, y: frame.height - layout.tabBarHeight };
  // Created from a community: the activity takes place in that community's emirate.
  const myCity = useCityId();
  const cityId = preset?.cityId && preset.cityId in CITIES ? (preset.cityId as CityId) : myCity;
  const city = CITIES[cityId];
  const postPlan = useStore((s) => s.postPlan);

  const format: CreateFormat = preset?.format ?? 'session';
  const presetCategory = preset?.categoryId ? CATEGORY_BY_ID[preset.categoryId] : undefined;
  const presetSub = presetCategory?.subs.find((x) => x.id === preset?.subId);
  const [pick, setPick] = useState<Pick | null>(
    presetCategory ? { categoryId: presetCategory.id, sub: presetSub, activity: presetSub?.activities?.find((x) => x.id === preset?.activityId) } : null,
  );
  const [step, setStep] = useState(presetCategory ? (presetSub ? 2 : 1) : 0);
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState(PRICES[city.currency][1]);
  const [unlimited, setUnlimited] = useState(false);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');
  // No date or time is chosen for the member: they pick both (in the city's time) before publishing.
  const [when, setWhen] = useState<When | null>(null);
  const [picking, setPicking] = useState(false);
  // Re-read every minute: a time picked earlier that has passed since is shown, never moved.
  const now = useNow();
  const whenProblem = when ? problemOf(when, city.utcOffset ?? 4, now) : null;
  // No neighbourhood is chosen for the member either (it used to be the first one, Deira, silently).
  const [area, setArea] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<NonNullable<MyPlan['privacy']>>(preset?.communityId ? 'community' : 'public');
  // Optional: the community (or group) it belongs to. Not needed to create an activity.
  const [communityId, setCommunityId] = useState<string | null>(preset?.communityId ?? null);
  const myCommunities = useMyCommunityOptions();
  // Optional: an exact address, so the activity can appear on the map once the server matched it.
  const geocoderOn = useGeocoderOn();
  const [address, setAddress] = useState('');
  const [spots, setSpots] = useState(6);
  const [description, setDescription] = useState('');
  const signedIn = Boolean(useAccount());
  // Optional: the creator's own photo instead of the catalogue one.
  const [cover, setCoverUri] = useState<string | null>(null);
  // Signed in, the photo is cleaned and uploaded as soon as it is picked, while the
  // form is still being filled: publishing then only saves the row (one round trip).
  // sent: a publish went out with it. unsure: one of those tries ended without a clear answer
  // (network, timeout…), so the activity may exist with this photo: it is kept for good then.
  const staged = useRef<{ uri: string; path: Promise<string>; failed: boolean; sent: boolean; unsure?: boolean } | null>(null);
  const stage = (uri: string) => {
    const cur = staged.current;
    if (cur?.uri === uri && !cur.failed) return cur.path;
    const job = { uri, path: stageCover(uri), failed: false, sent: false };
    job.path.catch(() => {
      job.failed = true;
    });
    staged.current = job;
    return job.path;
  };
  // A staged photo that is not used (replaced, removed, form closed) is removed from the server.
  // Once a publish was sent with it, it is kept: an unanswered try may have saved the activity with it.
  const unstage = () => {
    const cur = staged.current;
    staged.current = null;
    if (cur && !cur.sent) cur.path.then(dropStagedCover, () => undefined);
  };
  // Closing the form (unmount) drops a photo that was not published.
  useEffect(() => unstage, []);
  const setCover = (uri: string | null) => {
    if (staged.current && staged.current.uri !== uri) unstage();
    setCoverUri(uri);
    if (uri && signedIn) void stage(uri).catch(() => undefined);
  };
  const pickCover = async () => {
    const uri = await pickPhoto();
    if (uri) setCover(uri);
  };

  const D = 2 * Math.hypot(Math.max(origin.x, frame.width - origin.x), Math.max(origin.y, frame.height - origin.y));
  const p = useSharedValue(0);

  useEffect(() => {
    if (open) {
      p.set(withSpring(1, spring.soft));
    } else {
      p.set(
        withTiming(0, { duration: motion.slow, easing: ease.exit }, (fin) => {
          if (fin) scheduleOnRN(onClosed);
        }),
      );
    }
  }, [open, p, onClosed]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) setStep(step - 1);
      else hide();
      return true;
    });
    return () => sub.remove();
  }, [step, hide]);

  const circle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 1], [BUTTON / D, 1], Extrapolation.CLAMP) }],
  }));
  const content = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.45, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0, 1], [24, 0], Extrapolation.CLAMP) }],
  }));
  const closeBtn = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 45}deg` }] }));

  const results = useMemo(() => searchCatalog(query, 8), [query]);
  const category = pick ? CATEGORY_BY_ID[pick.categoryId] : undefined;
  const title = pick?.custom ?? pick?.activity?.label ?? (pick?.sub ? `${tx('{what} session', { what: tx(pick.sub.label) })}` : undefined);
  const place = pick?.activity?.place;

  const chooseCategory = (id: CategoryKey) => {
    setPick({ categoryId: id });
    setStep(1);
  };
  const chooseEntry = (categoryId: CategoryKey, sub: CatalogSub, activity?: CatalogActivity) => {
    haptic('select');
    setPick({ categoryId, sub, activity });
    setQuery('');
    setStep(2);
  };
  const scroller = useRef<ScrollView>(null);
  // The address and description fields sit low on the last step: the list
  // makes room for the keyboard (iOS insets itself) and the button rides above it.
  const keyboard = useKeyboardHeight();
  const chooseQuick = (q: (typeof QUICK)[number]) => {
    haptic('select');
    if (q.entry) {
      const e = findEntry(q.entry);
      if (e) {
        chooseEntry(e.categoryId, e.sub, e.activity);
        return;
      }
    }
    if (q.category) {
      chooseCategory(q.category);
      return;
    }
    scroller.current?.scrollToEnd({ animated: true });
  };
  const chooseCustom = (text: string) => {
    const label = text.trim();
    if (label.length < 3) return;
    haptic('select');
    // IRLY guesses the category; the member can change it on the next step.
    setPick({ categoryId: pick?.categoryId ?? guessCategory(label), custom: label });
    setCustom('');
    setQuery('');
    setStep(2);
  };

  const [publishing, setPublishing] = useState(false);
  const router = useRouter();
  const post = async () => {
    if (!pick || !title || publishing) return;
    const offset = city.utcOffset ?? 4;
    // Checked again at the tap: a time picked earlier may have passed while the form stayed open.
    const problem = when ? problemOf(when, offset, Date.now()) : null;
    if (!when || problem) {
      toast(tx(!when ? 'Pick a date and a start time' : problem === 'past' ? 'This time has passed: pick a later one' : 'The end must be after the start'), 'calendar', 'brand');
      setStep(2);
      return;
    }
    if (!area) {
      toast(tx('Choose a neighbourhood'), 'pin', 'brand');
      setStep(2);
      return;
    }
    const { startsAt, endsAt } = instants(when, offset);
    // Kept on this phone (signed out): the plan stores words ("Tomorrow", "Friday"), at most a week ahead.
    const day = localPlanDay(when, Date.now(), offset);
    if (!signedIn && !day) {
      toast(tx('Sign in to plan more than a week ahead'), 'calendar', 'brand');
      return;
    }
    // "Community" visibility needs a community, otherwise nobody else could see it.
    if (privacy === 'community' && !communityId) {
      toast(tx('Choose the community it is for, or another visibility'), 'users', 'brand');
      return;
    }
    const plan = {
      cityId,
      categoryId: pick.categoryId,
      subId: pick.sub?.id,
      activityId: pick.activity?.id,
      title,
      place: place ?? areaName(city, area),
      note: pick.activity?.note,
      description: description.trim() || undefined,
      privacy,
      day: day ?? 'Today',
      time: clockLabel(when.start),
      spots: unlimited ? 0 : spots,
      areaId: area,
      format,
      price: paid ? price : 0,
      currency: city.currency,
    };
    // Signed out: the plan lives on this phone only, and says so.
    if (!signedIn) {
      postPlan({ ...plan, ...(cover ? { coverUri: cover } : {}) });
      haptic('success');
      toast(tx('{title} saved on this phone. Sign in to share it', { title }), 'send', 'brand');
      hide();
      return;
    }
    // Signed in: the server is the only copy. "Live" only once it really is;
    // a failure keeps the form so the same plan can be sent again (never twice).
    setPublishing(true);
    try {
      const chosen = myCommunities.find((x) => x.id === communityId);
      // Usually uploaded already; still on its way, it is awaited; a failed upload is tried again here.
      // Claimed before waiting: closing the form or removing the photo meanwhile must not delete it.
      const pending = cover ? stage(cover) : null;
      if (cover && staged.current?.uri === cover) staged.current.sent = true;
      const coverPath = pending ? await pending : null;
      const serverId = await createServerActivity(plan, startsAt, { endsAt, coverUri: cover, coverPath, communityId, girlOnly: chosen?.girlOnly || undefined, address: geocoderOn ? address : null });
      // No id: nothing was created (session ended). Never "live" then; the form stays.
      if (!serverId) throw new Error(tx('your session has ended, sign in again'));
      // The photo now belongs to the activity: closing the form must not remove it.
      if (staged.current?.uri === cover) staged.current = null;
      haptic('success');
      toast(tx('{title} is live. Chat created', { title }), 'send', 'brand');
      hide();
      router.push(`/a/${serverId}`);
    } catch (e) {
      // Refused for sure (a rule, a check, the session): nothing was created, so the staged photo
      // is unused again and goes when the form closes or the photo changes. An unanswered try
      // (network, timeout, unknown) may have saved the activity with it: it stays then.
      if (cover && staged.current?.uri === cover) {
        if (refusedForSure(e) && !staged.current.unsure) staged.current.sent = false;
        else staged.current.unsure = true;
      }
      toast(tx('Not published: {why}. Try again', { why: e instanceof Error ? e.message : 'server error' }), 'x', 'live');
    } finally {
      setPublishing(false);
    }
  };

  const canNext = step === 0 ? false : step === 1 ? Boolean(pick?.sub || pick?.custom) : step === 2 ? Boolean(when && !whenProblem && area) : true;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View
        style={[
          styles.circle,
          { width: D, height: D, borderRadius: D / 2, left: origin.x - D / 2, top: origin.y - D / 2, backgroundColor: t.c.bg },
          circle,
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + space[6] }, content]}>
        <Ambient variant="hero" />
        <View style={styles.head}>
          {step > 0 ? (
            <PressableScale haptic="select" scaleTo={0.9} onPress={() => setStep(step - 1)} accessibilityLabel="Previous step" style={styles.back} hitSlop={8}>
              <Icon name="chevronLeft" size={22} color={t.c.text} />
            </PressableScale>
          ) : null}
          <Text variant="overline" tone="secondary">
            {tx('Step {n} / {total}', { n: step + 1, total: 4 })}{category ? ` · ${tx(category.label)}` : ''}
          </Text>
        </View>

        <ScrollView
          ref={scroller}
          contentContainerStyle={{ paddingBottom: 220 + (Platform.OS === 'android' ? keyboard : 0) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {step === 0 ? (
            <View key="s0">
              <Animated.View entering={enter.rise(0, 120)}>
                <Text variant="displayL" style={styles.title}>
                  {FORMAT[format].title}
                </Text>
              </Animated.View>
              <Animated.View entering={enter.rise(1, 120)} style={styles.block}>
                <Field icon="search" placeholder={tx('Padel, brunch, mosque visit, AI founders…')} value={query} onChangeText={setQuery} returnKeyType="search" />
              </Animated.View>
              {query.trim().length >= 2 ? (
                <Animated.View entering={FadeIn.duration(motion.fast)} style={[styles.block, { gap: 6 }]}>
                  {results.map((r) => {
                    const c = CATEGORY_BY_ID[r.categoryId];
                    return (
                      <PressableScale key={`${r.categoryId}-${r.sub.id}-${r.activity?.id ?? ''}`} haptic={false} scaleTo={0.98} onPress={() => chooseEntry(r.categoryId, r.sub, r.activity)} style={styles.result}>
                        <GlassLayer radius={radius.lg} level="thin" />
                        <View style={[styles.dot, { backgroundColor: c.color }]} />
                        <View style={{ flex: 1 }}>
                          <Text variant="label">{r.label}</Text>
                          <Text variant="caption" tone="tertiary">
                            {c.label}
                            {r.activity ? ` · ${r.sub.label}` : ''}
                            {r.activity?.place ? ` · ${r.activity.place}` : ''}
                          </Text>
                        </View>
                        <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
                      </PressableScale>
                    );
                  })}
                  <CustomButton text={query} onPress={() => chooseCustom(query)} />
                </Animated.View>
              ) : (
                <>
                  <View style={styles.quick}>
                    {QUICK.map((q, i) => (
                      <Animated.View key={q.label} entering={enter.pop(Math.min(i, 11), 140)} style={styles.quickCell}>
                        <PressableScale
                          haptic={false}
                          scaleTo={0.92}
                          onPress={() => chooseQuick(q)}
                          accessibilityLabel={q.label}
                          style={styles.quickTile}
                        >
                          <Photo pinned visual={{ photo: quickPhoto(q) }} light={city.light} scrim="strong" style={StyleSheet.absoluteFill} width={240} />
                          <Text variant="label" color="#FFFFFF" numberOfLines={1} style={styles.tileLabel}>
                            {q.label}
                          </Text>
                        </PressableScale>
                      </Animated.View>
                    ))}
                  </View>
                  <Text variant="overline" tone="tertiary" style={styles.or}>
                    Or browse everything
                  </Text>
                  <View style={styles.grid}>
                    {CATEGORIES.map((c, i) => (
                      <Animated.View key={c.id} entering={enter.pop(Math.min(i, 8), 160)} style={styles.cell}>
                        <PressableScale
                          haptic="select"
                          scaleTo={scaleTokens.press}
                          onPress={() => chooseCategory(c.id)}
                          accessibilityLabel={c.label}
                          style={[styles.tile, { boxShadow: t.shadow.card }]}
                        >
                          <Photo pinned visual={{ photo: photoForText(c.label) ?? c.photo }} light={city.light} scrim="strong" style={StyleSheet.absoluteFill} width={480} />
                          <Text variant="titleS" color="#FFFFFF" style={styles.tileLabel}>
                            {c.label}
                          </Text>
                        </PressableScale>
                      </Animated.View>
                    ))}
                  </View>
                  <View style={styles.block}>
                    <Text variant="titleS">Can&apos;t find what you&apos;re looking for?</Text>
                    <Field placeholder={tx('Sunset photography at Palm Jumeirah')} value={custom} onChangeText={setCustom} onSubmitEditing={() => chooseCustom(custom)} returnKeyType="next" />
                    {custom.trim().length >= 3 ? <CustomButton text={custom} onPress={() => chooseCustom(custom)} /> : null}
                  </View>
                </>
              )}
            </View>
          ) : null}

          {step === 1 && category ? (
            <View key={`s1-${category.id}`}>
              <Animated.View entering={enter.rise(0)}>
                <Text variant="displayL" style={styles.title}>
                  {category.label}
                </Text>
              </Animated.View>
              <Animated.View entering={enter.rise(1)} style={styles.block}>
                <View style={styles.wrap}>
                  {category.subs.map((sub) => (
                    <Chip
                      key={sub.id}
                      size="sm"
                      label={sub.label}
                      dot={category.color}
                      selected={pick?.sub?.id === sub.id && !pick.custom}
                      onPress={() => (sub.activities?.length ? setPick({ categoryId: category.id, sub }) : chooseEntry(category.id, sub))}
                    />
                  ))}
                </View>
              </Animated.View>
              {pick?.sub?.activities?.length ? (
                <Animated.View key={pick.sub.id} entering={FadeIn.duration(motion.normal)} style={[styles.block, { gap: 6 }]}>
                  <Text variant="overline" tone="secondary">
                    {pick.sub.label}
                  </Text>
                  <PressableScale haptic={false} scaleTo={0.98} onPress={() => chooseEntry(category.id, pick.sub!)} style={styles.result}>
                        <GlassLayer radius={radius.lg} level="thin" />
                    <View style={[styles.dot, { backgroundColor: category.color }]} />
                    <Text variant="label" style={{ flex: 1 }}>
                      {tx('{what} session', { what: tx(pick.sub.label) })}
                    </Text>
                    <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
                  </PressableScale>
                  {pick.sub.activities.map((act) => (
                    <PressableScale key={act.id} haptic={false} scaleTo={0.98} onPress={() => chooseEntry(category.id, pick.sub!, act)} style={styles.result}>
                        <GlassLayer radius={radius.lg} level="thin" />
                      <View style={[styles.dot, { backgroundColor: category.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text variant="label">{act.label}</Text>
                        {act.place ? (
                          <Text variant="caption" tone="tertiary">
                            {act.place}
                          </Text>
                        ) : null}
                      </View>
                      <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
                    </PressableScale>
                  ))}
                </Animated.View>
              ) : null}
              <View style={styles.block}>
                <Text variant="titleS">{tx('Something else in {category}?', { category: tx(category.label).toLowerCase() })}</Text>
                <Field placeholder={tx('Name your activity')} value={custom} onChangeText={setCustom} onSubmitEditing={() => chooseCustom(custom)} />
                {custom.trim().length >= 3 ? <CustomButton text={custom} onPress={() => chooseCustom(custom)} /> : null}
              </View>
            </View>
          ) : null}

          {step === 2 && category ? (
            <View key="s2" style={{ gap: space[6] }}>
              <Animated.View entering={enter.rise(0)}>
                <Text variant="displayL" style={styles.title}>
                  When and where?
                </Text>
              </Animated.View>
              {pick?.custom ? (
                <Animated.View entering={enter.rise(1)} style={styles.block}>
                  <Text variant="overline" tone="secondary">
                    Category · suggested by IRLY, change it if needed
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {CATEGORIES.map((c) => (
                      <Chip key={c.id} size="sm" label={c.label} dot={c.color} selected={pick.categoryId === c.id} onPress={() => setPick({ ...pick, categoryId: c.id })} />
                    ))}
                  </ScrollView>
                </Animated.View>
              ) : null}
              <Animated.View entering={enter.rise(2)} style={styles.block}>
                <Text variant="overline" tone="secondary">
                  When
                </Text>
                <WhenField value={when} utcOffset={city.utcOffset ?? 4} onPress={() => setPicking(true)} invalid={Boolean(whenProblem)} />
                {whenProblem ? (
                  <Text variant="caption" tone="critical">
                    {whenProblem === 'past' ? tx('This time has already passed in {city}. Pick a later time.', { city: city.name }) : 'The end must be after the start.'}
                  </Text>
                ) : !when ? (
                  <Text variant="caption" tone="secondary">
                    {tx('Pick a date and a start time ({city} time)', { city: city.name })}
                  </Text>
                ) : null}
                <DateTimePicker visible={picking} onClose={() => setPicking(false)} value={when} onConfirm={setWhen} utcOffset={city.utcOffset ?? 4} cityName={city.name} />
              </Animated.View>
              <Animated.View entering={enter.rise(3)} style={styles.block}>
                <Text variant="overline" tone="secondary">
                  {place ? tx('Meeting point near {place}', { place }) : 'Where'}
                </Text>
                <AreaPicker cityId={city.id} value={area} onChange={setArea} />
              </Animated.View>
              <Animated.View entering={enter.rise(4)} style={styles.block}>
                <Text variant="overline" tone="secondary">
                  Who can see it
                </Text>
                <View style={styles.wrap}>
                  {PRIVACY.map((x) => (
                    <Chip key={x.id} size="sm" label={x.label} selected={privacy === x.id} onPress={() => setPrivacy(x.id)} />
                  ))}
                </View>
              </Animated.View>
              {signedIn && myCommunities.length ? (
                <Animated.View entering={enter.rise(5)} style={styles.block}>
                  <Text variant="overline" tone="secondary">
                    In a community (optional)
                  </Text>
                  <View style={styles.wrap}>
                    <Chip size="sm" label={tx('None')} selected={!communityId} onPress={() => (setCommunityId(null), privacy === 'community' && setPrivacy('public'))} />
                    {myCommunities.map((x) => (
                      <Chip key={x.id} size="sm" label={x.groupOf ? `${tx(x.name)} · ${tx(x.groupOf)}` : tx(x.name)} selected={communityId === x.id} onPress={() => setCommunityId(x.id)} />
                    ))}
                  </View>
                </Animated.View>
              ) : null}
              {geocoderOn ? (
                <Animated.View entering={enter.rise(6)} style={styles.block}>
                  <Text variant="overline" tone="secondary">
                    Exact address (optional)
                  </Text>
                  <View style={styles.fieldHost}>
                  <GlassLayer radius={radius.lg} level="thin" />
                  <TextInput
                    value={address}
                    onChangeText={(v) => setAddress(v.slice(0, 200))}
                    placeholder={tx('Building, street, place: to appear on the map')}
                    placeholderTextColor={t.c.textTertiary}
                    style={[styles.address, { color: t.c.text }]}
                    accessibilityLabel={a11y('Exact address')}
                  />
                  </View>
                </Animated.View>
              ) : null}
            </View>
          ) : null}

          {step === 3 && category && title ? (
            <View key="s3" style={{ gap: space[6] }}>
              <Animated.View entering={enter.rise(0)}>
                <Text variant="displayL" style={styles.title}>
                  How many people?
                </Text>
              </Animated.View>
              <Animated.View entering={enter.rise(1)} style={[styles.block, styles.wrap, { justifyContent: 'center' }]}>
                {[2, 4, 10, 50].map((n) => (
                  <Chip key={n} size="sm" label={`${n}`} selected={!unlimited && spots === n} onPress={() => { setUnlimited(false); setSpots(n); }} />
                ))}
                <Chip size="sm" label="Unlimited" selected={unlimited} onPress={() => setUnlimited(true)} />
              </Animated.View>
              <Animated.View entering={enter.rise(1)} style={[styles.block, styles.stepperRow, unlimited ? { opacity: 0.35 } : null]} pointerEvents={unlimited ? 'none' : 'auto'}>
                <PressableScale haptic="select" scaleTo={0.85} onPress={() => setSpots((n) => Math.max(2, n - 1))} style={styles.stepBtn} accessibilityLabel="Fewer spots">
                  <GlassLayer radius={28} level="thin" />
                  <Icon name="minus" size={22} color={t.c.text} />
                </PressableScale>
                <Text variant="displayXL" style={{ minWidth: 90 }} align="center">
                  {spots}
                </Text>
                <PressableScale haptic="select" scaleTo={0.85} onPress={() => setSpots((n) => Math.min(60, n + 1))} style={styles.stepBtn} accessibilityLabel="More spots">
                  <GlassLayer radius={28} level="thin" />
                  <Icon name="plus" size={22} color={t.c.text} />
                </PressableScale>
              </Animated.View>
              <Animated.View entering={enter.rise(2)} style={styles.block}>
                <Text variant="overline" tone="secondary">
                  Price
                </Text>
                <View style={styles.wrap}>
                  <Chip size="sm" label="Free" selected={!paid} onPress={() => setPaid(false)} />
                  <Chip size="sm" label="Paid" icon="banknote" selected={paid} onPress={() => setPaid(true)} />
                </View>
                {paid ? (
                  <Animated.View entering={FadeIn.duration(motion.fast)} style={styles.wrap}>
                    {PRICES[city.currency].map((n) => (
                      <Chip key={n} size="sm" label={formatPrice(n, city.currency)} selected={price === n} onPress={() => setPrice(n)} />
                    ))}
                  </Animated.View>
                ) : null}
              </Animated.View>
              <Animated.View entering={enter.rise(2)} style={styles.block}>
                {/* The session's photo: the app's photo for this activity, or the creator's own. */}
                <PressableScale haptic="select" scaleTo={0.98} onPress={pickCover} style={styles.cover} accessibilityLabel="Change the photo">
                  <Image source={{ uri: cover ?? (pick ? photo(ideaPhoto(pick.categoryId, pick.custom ?? pick.activity?.label ?? '', place, pick.sub?.id), 900) : undefined) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  <View style={[styles.coverPill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                    <Icon name="camera" size={16} color="#FFFFFF" />
                    <Text variant="label" style={{ color: '#FFFFFF' }}>
                      {cover ? 'Your photo' : 'Change the photo'}
                    </Text>
                  </View>
                  {cover ? (
                    <PressableScale haptic="select" disabled={publishing} onPress={() => setCover(null)} style={[styles.coverRemove, { backgroundColor: 'rgba(0,0,0,0.55)' }]} accessibilityLabel="Use the IRLY photo" hitSlop={8}>
                      <Icon name="x" size={16} color="#FFFFFF" strokeWidth={2.6} />
                    </PressableScale>
                  ) : null}
                </PressableScale>
              </Animated.View>
              <Animated.View entering={enter.rise(2)} style={styles.block}>
                <View style={styles.fieldHost}>
                <GlassLayer radius={radius.lg} level="thin" />
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={tx('Add a few words (optional): meeting point, level, what to bring…')}
                  placeholderTextColor={t.c.textTertiary}
                  multiline
                  maxLength={240}
                  style={[styles.desc, { color: t.c.text }]}
                />
                </View>
              </Animated.View>
              <Animated.View entering={enter.rise(3)} style={[styles.summary, { boxShadow: t.shadow.card }]}>
                <GlassLayer radius={radius.xl} />
                <View style={[styles.dot, { backgroundColor: category.color, width: 12, height: 12, borderRadius: 6 }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="cardTitle" style={{ fontSize: 20, lineHeight: 24 }}>
                    {title}
                  </Text>
                  <Text variant="bodyS" tone="secondary">
                    {when ? whenText(when, city.utcOffset ?? 4, now) : tx('Time to pick')} · {place ?? (area ? areaName(city, area) : tx('Neighbourhood to pick'))} · {unlimited ? tx('Unlimited') : tx('{n} spots', { n: spots })} · {formatPrice(paid ? price : 0, city.currency)} · {PRIVACY.find((x) => x.id === privacy)?.label}
                  </Text>
                </View>
              </Animated.View>
              {pick?.activity?.note ? (
                <Animated.View entering={enter.rise(4)} style={styles.note}>
                  <GlassLayer radius={radius.lg} level="thin" />
                  <Icon name="sparkles" size={16} color={t.c.text} />
                  <Text variant="bodyS" style={{ flex: 1 }}>
                    {pick.activity.note}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {step > 0 ? (
          <View style={[styles.footer, { bottom: keyboard ? keyboard + space[3] : layout.tabBarHeight + Math.max(insets.bottom, layout.tabBarBottomGap) + 24 }]}>
            {step < 3 ? (
              <Button label="Next" iconRight="arrowRight" full disabled={!canNext} haptic="select" onPress={() => setStep(step + 1)} />
            ) : (
              <Button label={publishing ? 'Publishing…' : FORMAT[format].cta} icon="send" full haptic={false} loading={publishing} disabled={publishing} onPress={post} />
            )}
          </View>
        ) : null}
      </Animated.View>

      <View style={[styles.closeWrap, { left: origin.x - BUTTON / 2, top: origin.y - BUTTON / 2 }]}>
        <PressableScale haptic="tap" scaleTo={0.9} disabled={publishing} onPress={hide} accessibilityLabel="Close composer" style={[styles.close, { backgroundColor: t.c.brand }]}>
          <Animated.View style={closeBtn}>
            <Icon name="plus" size={24} color={t.c.onBrand} strokeWidth={2.4} />
          </Animated.View>
        </PressableScale>
      </View>
    </View>
  );
}

function CustomButton({ text, onPress }: { text: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} style={[styles.custom, { borderColor: t.c.lineStrong }]} accessibilityLabel={tx('Create custom activity: {name}', { name: text })}>
      <Icon name="wand" size={18} color={t.c.text} />
      <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
        {tx('Create “{what}”', { what: text.trim() })}
      </Text>
      <Icon name="arrowRight" size={16} color={t.c.text} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fieldHost: { borderRadius: radius.lg, overflow: 'hidden' },
  address: { height: 48, paddingHorizontal: 14, fontFamily: font.medium, fontSize: 16 },
  cover: { height: 170, borderRadius: radius.lg, overflow: 'hidden' },
  coverRemove: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  coverPill: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gutter - 4, marginTop: space[5] },
  quickCell: { width: '25%', padding: 4 },
  quickTile: { height: 84, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', padding: 8 },
  tileLabel: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
  or: { paddingHorizontal: space.gutter, marginTop: space[6] },
  circle: { position: 'absolute' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.gutter, height: 44 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { paddingHorizontal: space.gutter, marginTop: space[3], marginBottom: space[5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gutter - 5, marginBottom: space[6] },
  cell: { width: '50%', padding: 5 },
  tile: { height: 96, borderRadius: radius.xl, padding: 14, justifyContent: 'flex-end', overflow: 'hidden' },
  tileIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  block: { paddingHorizontal: space.gutter, gap: 10, marginBottom: space[5] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg, overflow: 'hidden' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  custom: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  stepBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  desc: { minHeight: 90, borderRadius: radius.md, padding: 14, fontFamily: font.medium, fontSize: 15, textAlignVertical: 'top' },
  summary: { marginHorizontal: space.gutter, padding: 18, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' },
  note: { marginHorizontal: space.gutter, padding: 14, borderRadius: radius.lg, flexDirection: 'row', gap: 10, overflow: 'hidden' },
  footer: { position: 'absolute', left: space.gutter, right: space.gutter },
  closeWrap: { position: 'absolute', width: BUTTON, height: BUTTON },
  close: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, alignItems: 'center', justifyContent: 'center' },
});
