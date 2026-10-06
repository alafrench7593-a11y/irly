import { useEffect, useMemo, useState } from 'react';
import { t as tx } from '@/i18n';
import { BackHandler, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Extrapolation, FadeIn, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useFrame } from '@/components/layout/AppFrame';
import { Button } from '@/components/ui/Button';
import { Chip, Field } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CATEGORIES, CATEGORY_BY_ID, guessCategory, searchCatalog, type CatalogActivity, type CatalogSub, type CategoryKey } from '@/data/catalog/categories';
import { areaName, CITIES } from '@/data/destinations';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { ease, motion, scale as scaleTokens, spring } from '@/motion/tokens';
import { useCityId, useStore, type MyPlan } from '@/state/store';
import { font, layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { createServerActivity } from '@/features/server/activities';
import { useCreateStore, type CreateFormat } from './createStore';

const DAYS = ['Today', 'Tomorrow', 'This weekend', 'Next week'];
const TIMES = ['07:00', '10:00', '12:30', '16:00', '18:00', '19:30', '21:00'];
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
  const cityId = useCityId();
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
  const [day, setDay] = useState(DAYS[0]);
  const [time, setTime] = useState(TIMES[5]);
  const [area, setArea] = useState(city.areas[0].id);
  const [privacy, setPrivacy] = useState<NonNullable<MyPlan['privacy']>>('public');
  const [spots, setSpots] = useState(6);
  const [description, setDescription] = useState('');

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

  const post = () => {
    if (!pick || !title) return;
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
      day,
      time,
      spots: unlimited ? 0 : spots,
      areaId: area,
      format,
      price: paid ? price : 0,
      currency: city.currency,
    };
    postPlan(plan);
    // Signed in: the session also goes to the server, where members can join it.
    createServerActivity(plan).catch((e) => toast(tx('Saved on this phone only: {why}', { why: e instanceof Error ? e.message : 'server error' }), 'x', 'live'));
    haptic('success');
    toast(tx('{title} is live. Chat created', { title }), 'send', 'brand');
    hide();
  };

  const canNext = step === 0 ? false : step === 1 ? Boolean(pick?.sub || pick?.custom) : true;

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

        <ScrollView contentContainerStyle={{ paddingBottom: 220 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                      <PressableScale key={`${r.categoryId}-${r.sub.id}-${r.activity?.id ?? ''}`} haptic={false} scaleTo={0.98} onPress={() => chooseEntry(r.categoryId, r.sub, r.activity)} style={[styles.result, { backgroundColor: t.c.surface }]}>
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
                  <View style={styles.grid}>
                    {CATEGORIES.map((c, i) => (
                      <Animated.View key={c.id} entering={enter.pop(Math.min(i, 8), 160)} style={styles.cell}>
                        <PressableScale
                          haptic="select"
                          scaleTo={scaleTokens.press}
                          onPress={() => chooseCategory(c.id)}
                          accessibilityLabel={c.label}
                          style={[styles.tile, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]}
                        >
                          <View style={[styles.tileIcon, { backgroundColor: `${c.color}1F` }]}>
                            <Icon name={c.icon} size={20} color={c.color} />
                          </View>
                          <Text variant="titleS">{c.label}</Text>
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
                  <PressableScale haptic={false} scaleTo={0.98} onPress={() => chooseEntry(category.id, pick.sub!)} style={[styles.result, { backgroundColor: t.c.surface }]}>
                    <View style={[styles.dot, { backgroundColor: category.color }]} />
                    <Text variant="label" style={{ flex: 1 }}>
                      {tx('{what} session', { what: tx(pick.sub.label) })}
                    </Text>
                    <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
                  </PressableScale>
                  {pick.sub.activities.map((act) => (
                    <PressableScale key={act.id} haptic={false} scaleTo={0.98} onPress={() => chooseEntry(category.id, pick.sub!, act)} style={[styles.result, { backgroundColor: t.c.surface }]}>
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
                <View style={styles.wrap}>
                  {DAYS.map((d) => (
                    <Chip key={d} size="sm" label={d} selected={day === d} onPress={() => setDay(d)} />
                  ))}
                </View>
                <View style={styles.wrap}>
                  {TIMES.map((x) => (
                    <Chip key={x} size="sm" label={x} selected={time === x} onPress={() => setTime(x)} />
                  ))}
                </View>
              </Animated.View>
              <Animated.View entering={enter.rise(3)} style={styles.block}>
                <Text variant="overline" tone="secondary">
                  {place ? tx('Meeting point near {place}', { place }) : 'Where'}
                </Text>
                <View style={styles.wrap}>
                  {city.areas.slice(0, 10).map((a) => (
                    <Chip key={a.id} size="sm" label={a.name} icon="pin" selected={area === a.id} onPress={() => setArea(a.id)} />
                  ))}
                </View>
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
                <PressableScale haptic="select" scaleTo={0.85} onPress={() => setSpots((n) => Math.max(2, n - 1))} style={[styles.stepBtn, { backgroundColor: t.c.overlay }]} accessibilityLabel="Fewer spots">
                  <Icon name="minus" size={22} color={t.c.text} />
                </PressableScale>
                <Text variant="displayXL" style={{ minWidth: 90 }} align="center">
                  {spots}
                </Text>
                <PressableScale haptic="select" scaleTo={0.85} onPress={() => setSpots((n) => Math.min(60, n + 1))} style={[styles.stepBtn, { backgroundColor: t.c.overlay }]} accessibilityLabel="More spots">
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
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={tx('Add a few words (optional): meeting point, level, what to bring…')}
                  placeholderTextColor={t.c.textTertiary}
                  multiline
                  maxLength={240}
                  style={[styles.desc, { color: t.c.text, backgroundColor: t.c.surface }]}
                />
              </Animated.View>
              <Animated.View entering={enter.rise(3)} style={[styles.summary, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]}>
                <View style={[styles.dot, { backgroundColor: category.color, width: 12, height: 12, borderRadius: 6 }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="cardTitle" style={{ fontSize: 20, lineHeight: 24 }}>
                    {title}
                  </Text>
                  <Text variant="bodyS" tone="secondary">
                    {day} · {time} · {place ?? areaName(city, area)} · {unlimited ? tx('Unlimited') : tx('{n} spots', { n: spots })} · {formatPrice(paid ? price : 0, city.currency)} · {PRIVACY.find((x) => x.id === privacy)?.label}
                  </Text>
                </View>
              </Animated.View>
              {pick?.activity?.note ? (
                <Animated.View entering={enter.rise(4)} style={[styles.note, { backgroundColor: t.c.overlay }]}>
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
          <View style={[styles.footer, { bottom: layout.tabBarHeight + Math.max(insets.bottom, layout.tabBarBottomGap) + 24 }]}>
            {step < 3 ? (
              <Button label="Next" iconRight="arrowRight" full disabled={!canNext} haptic="select" onPress={() => setStep(step + 1)} />
            ) : (
              <Button label={FORMAT[format].cta} icon="send" full haptic={false} onPress={post} />
            )}
          </View>
        ) : null}
      </Animated.View>

      <View style={[styles.closeWrap, { left: origin.x - BUTTON / 2, top: origin.y - BUTTON / 2 }]}>
        <PressableScale haptic="tap" scaleTo={0.9} onPress={hide} accessibilityLabel="Close composer" style={[styles.close, { backgroundColor: t.c.brand }]}>
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
    <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} style={[styles.custom, { borderColor: t.c.lineStrong }]} accessibilityLabel={`Create custom activity: ${text}`}>
      <Icon name="wand" size={18} color={t.c.text} />
      <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
        {tx('Create “{what}”', { what: text.trim() })}
      </Text>
      <Icon name="arrowRight" size={16} color={t.c.text} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.gutter, height: 44 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { paddingHorizontal: space.gutter, marginTop: space[3], marginBottom: space[5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gutter - 5, marginBottom: space[6] },
  cell: { width: '50%', padding: 5 },
  tile: { height: 96, borderRadius: radius.xl, padding: 16, justifyContent: 'space-between' },
  tileIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  block: { paddingHorizontal: space.gutter, gap: 10, marginBottom: space[5] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg },
  dot: { width: 10, height: 10, borderRadius: 5 },
  custom: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  stepBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  desc: { minHeight: 90, borderRadius: radius.md, padding: 14, fontFamily: font.medium, fontSize: 15, textAlignVertical: 'top' },
  summary: { marginHorizontal: space.gutter, padding: 18, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', gap: 14 },
  note: { marginHorizontal: space.gutter, padding: 14, borderRadius: radius.lg, flexDirection: 'row', gap: 10 },
  footer: { position: 'absolute', left: space.gutter, right: space.gutter },
  closeWrap: { position: 'absolute', width: BUTTON, height: BUTTON },
  close: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, alignItems: 'center', justifyContent: 'center' },
});
