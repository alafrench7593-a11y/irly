import { AreaPicker } from '@/components/ui/AreaPicker';
import { CharCount } from '@/components/ui/CharCount';
import { t as tx, a11y } from '@/i18n';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { FEATURES } from '@/lib/features';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, FadeOut, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming, ZoomOut, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { usePhotoSource } from '@/components/ui/PhotoSourceSheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/destinations';
import { ACCESS_LIMIT, GirlClosed, GirlGate, GirlLoading, isGirlRefusal, safeBack, withLimit } from '@/features/girl/access';
import { matchApi } from '@/features/girl/api';
import { ACTIVITIES, AVAILABILITY, GOALS, HIDEABLE, INTERESTS, LANGUAGES, LIFESTYLE, SPORTS, TRAVEL } from '@/features/girl/taxonomy';
import { girl, girlType } from '@/features/girl/theme';
import { EMPTY_DRAFT, type MatchProfileDraft } from '@/features/girl/types';
import { GButton, GChip, GSection, Wrap } from '@/features/girl/ui';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { spring } from '@/motion/tokens';
import { PressableScale } from '@/motion/PressableScale';
import { friendlyError } from '@/lib/supabase';
import { useCityId, useStore } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';
import { Flavor } from '@/theme/flavor';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Ambient } from '@/components/visual/Ambient';

/** Signup languages (native names) → IRLY Match language ids. */
const SIGNUP_LANG: Record<string, string> = { English: 'en', Français: 'fr', العربية: 'ar', हिन्दी: 'hi', Русский: 'ru', Español: 'es', Italiano: 'it', Deutsch: 'de', Bahasa: 'id' };

const STEPS = ['Photos', 'Looking for', 'Interests', 'Sports & plans', 'Lifestyle', 'Practical', 'Privacy'] as const;

const AGE_RANGES: { label: string; min: number; max: number }[] = [
  { label: '18–25', min: 18, max: 25 },
  { label: '21–30', min: 21, max: 30 },
  { label: '25–35', min: 25, max: 35 },
  { label: '30–40', min: 30, max: 40 },
  { label: '35+', min: 35, max: 99 },
  { label: 'Any age', min: 18, max: 99 },
];

const toggle = (list: string[], id: string, max = 99) =>
  list.includes(id) ? list.filter((x) => x !== id) : list.length >= max ? list : [...list, id];

/**
 * IRLY Match profile: seven short steps, only what helps find friends.
 * Pre-filled from signup (photo, bio, languages). Every step says why it
 * is asked; the last one decides what stays private.
 */
const GIRL_PICKER = { ink: girl.ink, soft: girl.inkSoft, surface: girl.surface, accent: girl.rose, line: girl.line };

/** IRLY Match is coming soon: its onboarding and profile wait, IRLY Girl opens instead. */
function GirlProfileScreenGateInner() {
  return FEATURES.girlMatch ? <GirlProfileScreen /> : <Redirect href="/girl" />;
}

function GirlProfileScreen() {
  return (
    <GirlGate>
      <GirlProfile />
    </GirlGate>
  );
}

function GirlProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const signup = useStore((s) => s.profile);
  const [draft, setDraft] = useState<MatchProfileDraft>(() => ({
    ...EMPTY_DRAFT,
    bio: signup.bio ?? '',
    photoUris: signup.photoUri ? [signup.photoUri] : [],
    languages: (signup.languages ?? []).map((l) => SIGNUP_LANG[l]).filter(Boolean) as string[],
    areas: [],
  }));
  const [step, setStep] = useState(0);
  // Which way the steps move: forward slides in from the right, back from the left.
  const [dir, setDir] = useState<1 | -1>(1);
  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(to);
  };
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Editing an existing profile: start from what is saved. Until that read succeeds nothing is saved:
  // a blank draft saved after a failed read would replace the real profile.
  const [loaded, setLoaded] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [loadTry, setLoadTry] = useState(0);
  const touched = useRef(false);
  useEffect(() => {
    let alive = true;
    // Bounded: past the limit the screen offers Try again instead of waiting.
    withLimit(
      matchApi().then((api) => api.getProfile()),
      ACCESS_LIMIT,
    )
      .then((p) => {
        if (!alive) return;
        // Already typing: what the member typed stays.
        if (p && !touched.current) {
          setDraft(p);
          setEditing(true);
        }
        setLoaded('ok');
      })
      .catch(() => alive && setLoaded('failed'));
    return () => {
      alive = false;
    };
  }, [loadTry]);

  const set = <K extends keyof MatchProfileDraft>(k: K, v: MatchProfileDraft[K]) => {
    touched.current = true;
    setDraft((d) => ({ ...d, [k]: v }));
  };

  const valid = useMemo(() => {
    switch (step) {
      case 0:
        return draft.photoUris.length >= 1;
      case 1:
        return draft.goals.length >= 1;
      case 2:
        return draft.interests.length >= 3;
      case 3:
        return draft.sports.length + draft.activities.length >= 1;
      case 5:
        return draft.languages.length >= 1;
      default:
        return true;
    }
  }, [step, draft]);

  const hint = ['Add at least one photo', 'Pick at least one', 'Pick at least three', 'Pick at least one', '', 'Pick at least one language', ''][step];

  // Library or camera, from the shared photo sheet. Photos are uploaded with the profile (saveProfile).
  const photos = usePhotoSource({ aspect: [4, 5], quality: 0.8, front: true, subtitle: 'Clear, friendly, recent. Up to 6.' });
  const bioFocus = useSharedValue(0);
  const focusBio = (v: number) => bioFocus.set(withTiming(v, { duration: 180 }));
  const pickPhoto = async () => {
    if (draft.photoUris.length >= 6) return;
    const picked = await photos.pick();
    if (!picked) return;
    touched.current = true;
    setDraft((d) => (d.photoUris.length >= 6 || d.photoUris.includes(picked.uri) ? d : { ...d, photoUris: [...d.photoUris, picked.uri] }));
  };

  const save = async () => {
    if (loaded !== 'ok') {
      toast(loaded === 'failed' ? 'Could not load your profile. Check your connection and try again.' : 'Loading your profile…', 'x', 'live');
      if (loaded === 'failed') {
        setLoaded('loading');
        setLoadTry((n) => n + 1);
      }
      return;
    }
    setSaving(true);
    try {
      const api = await matchApi();
      await api.saveProfile(draft);
      haptic('success');
      toast(editing ? 'Profile updated' : 'Your IRLY Match profile is live', 'sparkles', 'brand');
      router.replace('/girl/match');
    } catch (e) {
      if (isGirlRefusal(e)) router.replace('/girl');
      else toast(friendlyError(e instanceof Error ? e.message : 'Could not save. Check your connection and try again.'), 'x', 'live');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!valid) return;
    haptic('select');
    if (step < STEPS.length - 1) go(step + 1);
    else save();
  };

  // Nothing to fill in before the saved profile is known: a blank form would hide it, and saving it would replace it.
  if (loaded === 'loading') return <GirlLoading label="Loading your profile…" />;
  if (loaded === 'failed')
    return (
      <GirlClosed
        reason="error"
        onRetry={() => {
          setLoaded('loading');
          setLoadTry((n) => n + 1);
        }}
      />
    );

  return (
    <View style={[styles.root, { backgroundColor: girl.bg, paddingTop: insets.top + 8 }]}>
      <Ambient variant="quiet" />
      <View style={styles.head}>
        <PressableScale
          haptic="tap"
          scaleTo={0.9}
          onPress={() => (step > 0 ? go(step - 1) : safeBack(router, '/'))}
          accessibilityLabel={step > 0 ? 'Previous step' : 'Close'}
          style={styles.round}
        >
          <GlassLayer radius={20} level="thin" />
          <Icon name={step > 0 ? 'chevronLeft' : 'x'} size={20} color={girl.ink} />
        </PressableScale>
        <View style={styles.progress} accessibilityLabel={tx('Step {n} of {total}', { n: step + 1, total: STEPS.length })}>
          {STEPS.map((s, i) => (
            <ProgressBar key={s} done={i <= step} />
          ))}
        </View>
        <Text variant="label" raw color={girl.inkSoft} style={styles.count}>
          {`${step + 1}/${STEPS.length}`}
        </Text>
      </View>

      {/* The bio field and the Continue button stay above the keyboard. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: 140, gap: space[6] }} keyboardShouldPersistTaps="handled">
        <Animated.View
          key={step}
          entering={(dir > 0 ? FadeInRight : FadeInLeft).springify(520).dampingRatio(0.92)}
          exiting={FadeOut.duration(120)}
          style={{ gap: space[6] }}
        >
          <View style={{ gap: 6 }}>
            <Text variant="overline" color={girl.rose}>
              {editing ? 'Edit your profile' : 'Your IRLY Match profile'} · {STEPS[step]}
            </Text>
            <Text variant="displayM" color={girl.ink} style={girlType.display}>
              {
                [
                  'Show yourself',
                  'What kind of friends?',
                  'What are you into?',
                  'What do you like to do?',
                  'Your rhythm',
                  'The practical bits',
                  'You decide what shows',
                ][step]
              }
            </Text>
          </View>

          {step === 0 ? (
            <>
              <GSection title="Photos" hint="Up to 6. Clear, friendly, recent. Group photos are fine as the second one.">
                <View style={styles.photos}>
                  {draft.photoUris.map((uri, i) => (
                    <Animated.View key={uri} entering={enter.pop(i)} exiting={ZoomOut.duration(160)} style={styles.photo}>
                      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <PressableScale
                        haptic="tap"
                        scaleTo={0.9}
                        onPress={() => set('photoUris', draft.photoUris.filter((x) => x !== uri))}
                        accessibilityLabel={tx('Remove photo {n}', { n: i + 1 })}
                        style={styles.remove}
                      >
                        <Icon name="x" size={14} color="#FFFFFF" />
                      </PressableScale>
                      {i === 0 ? (
                        <View style={styles.mainTag}>
                          <Text variant="caption" color="#FFFFFF">
                            Main
                          </Text>
                        </View>
                      ) : null}
                    </Animated.View>
                  ))}
                  {draft.photoUris.length < 6 ? (
                    <PressableScale haptic="select" scaleTo={0.96} onPress={pickPhoto} accessibilityLabel="Add a photo" style={[styles.photo, styles.addPhoto]}>
                      <GlassLayer radius={radius.lg} level="thin" />
                      <View style={styles.addIcon}>
                        <Icon name="camera" size={18} color={girl.rose} />
                      </View>
                      <Text variant="caption" color={girl.inkSoft}>
                        {draft.photoUris.length ? 'Add' : 'Add a photo'}
                      </Text>
                    </PressableScale>
                  ) : null}
                </View>
              </GSection>
              <GSection title="A few words" hint="What would you tell a new friend over coffee?">
                <FocusPane focus={bioFocus} invalid={draft.bio.trim().length > 0 && draft.bio.trim().length < 10}>
                <TextInput
                  onFocus={() => focusBio(1)}
                  onBlur={() => focusBio(0)}
                  value={draft.bio}
                  onChangeText={(v) => set('bio', v.slice(0, 300))}
                  maxLength={300}
                  multiline
                  placeholder={tx('New in {city}, padel addict, always planning the next trip…', { city: CITIES[cityId]?.name ?? 'Dubai' })}
                  placeholderTextColor={girl.inkFaint}
                  style={styles.input}
                  accessibilityLabel={a11y('Bio')}
                />
                </FocusPane>
                <CharCount length={draft.bio.trim().length} min={10} max={300} color={girl.inkFaint} warn={girl.rose} />
              </GSection>
            </>
          ) : null}

          {step === 1 ? (
            <GSection title="Friendship goals" hint="Shown on your profile, and used to match you with girls looking for the same.">
              <Wrap>
                {GOALS.map((o) => (
                  <GChip key={o.id} label={o.label} icon={o.icon} selected={draft.goals.includes(o.id)} onPress={() => set('goals', toggle(draft.goals, o.id))} />
                ))}
              </Wrap>
            </GSection>
          ) : null}

          {step === 2 ? (
            <GSection title="Interests" hint="Pick 3 to 8. The more honest, the better your matches.">
              <Wrap>
                {INTERESTS.map((o) => (
                  <GChip key={o.id} label={o.label} icon={o.icon} selected={draft.interests.includes(o.id)} onPress={() => set('interests', toggle(draft.interests, o.id, 8))} />
                ))}
              </Wrap>
            </GSection>
          ) : null}

          {step === 3 ? (
            <>
              <GSection title="Sports" hint="Anything you play or would love to try with someone.">
                <Wrap>
                  {SPORTS.map((o) => (
                    <GChip key={o.id} label={o.label} selected={draft.sports.includes(o.id)} onPress={() => set('sports', toggle(draft.sports, o.id))} />
                  ))}
                </Wrap>
              </GSection>
              <GSection title="Favourite plans">
                <Wrap>
                  {ACTIVITIES.map((o) => (
                    <GChip key={o.id} label={o.label} selected={draft.activities.includes(o.id)} onPress={() => set('activities', toggle(draft.activities, o.id))} />
                  ))}
                </Wrap>
              </GSection>
            </>
          ) : null}

          {step === 4 ? (
            <View style={{ gap: space[5] }}>
              {LIFESTYLE.map((dim) => (
                <View key={dim.id} style={{ gap: 8 }}>
                  <Text variant="label" color={girl.inkSoft}>
                    {dim.left} · {dim.right}
                  </Text>
                  <View style={styles.segment}>
                    <GlassLayer radius={radius.lg} level="thin" />
                    {([-1, 0, 1] as const).map((v) => {
                      const on = draft.lifestyle[dim.id] === v;
                      return (
                        <SegItem
                          key={v}
                          on={on}
                          label={v === -1 ? dim.left : v === 0 ? dim.middle : dim.right}
                          onPress={() => set('lifestyle', { ...draft.lifestyle, [dim.id]: on ? undefined : v })}
                        />
                      );
                    })}
                  </View>
                </View>
              ))}
              <Text variant="caption" color={girl.inkFaint}>
                Skip any you are unsure about. Tap again to clear.
              </Text>
            </View>
          ) : null}

          {step === 5 ? (
            <>
              <GSection title="Languages">
                <Wrap>
                  {LANGUAGES.map((o) => (
                    <GChip key={o.id} small label={o.label} selected={draft.languages.includes(o.id)} onPress={() => set('languages', toggle(draft.languages, o.id))} />
                  ))}
                </Wrap>
              </GSection>
              <GSection title={tx('Where you like to go in {city}', { city: city.name })} hint="Neighbourhoods only. Your exact location is never shared.">
                <AreaPicker cityId={city.id} value={draft.areas} multiple max={5} placeholder="Pick up to 5 neighbourhoods" onChange={(id) => set('areas', toggle(draft.areas, id, 5))} palette={GIRL_PICKER} />
              </GSection>
              <GSection title="When you are usually free">
                <Wrap>
                  {AVAILABILITY.map((o) => (
                    <GChip key={o.id} small label={o.label} selected={draft.availability.includes(o.id)} onPress={() => set('availability', toggle(draft.availability, o.id))} />
                  ))}
                </Wrap>
              </GSection>
              <GSection title="Trips you dream of">
                <Wrap>
                  {TRAVEL.map((o) => (
                    <GChip key={o.id} small label={o.label} selected={draft.travel.includes(o.id)} onPress={() => set('travel', toggle(draft.travel, o.id))} />
                  ))}
                </Wrap>
              </GSection>
              <GSection title="Ages you'd like to meet">
                <Wrap>
                  {AGE_RANGES.map((r) => (
                    <GChip
                      key={r.label}
                      small
                      label={r.label}
                      selected={draft.ageMin === r.min && draft.ageMax === r.max}
                      onPress={() => setDraft((d) => ({ ...d, ageMin: r.min, ageMax: r.max }))}
                    />
                  ))}
                </Wrap>
              </GSection>
            </>
          ) : null}

          {step === 6 ? (
            <View style={{ gap: space[4] }}>
              <ToggleRow
                label="Show me in IRLY Match"
                hint="Turn off to take a break. Your matches and chats stay."
                value={draft.visible}
                onChange={(v) => set('visible', v)}
              />
              <ToggleRow
                label="Show when I'm active"
                hint="Others see 'Active now'. Off by default."
                value={draft.showActive}
                onChange={(v) => set('showActive', v)}
              />
              <GSection title="Keep private" hint="Hidden fields are never shown and never used to filter you.">
                <Wrap>
                  {HIDEABLE.map((h) => (
                    <GChip
                      key={h.id}
                      icon="lock"
                      label={h.label}
                      selected={draft.hiddenFields.includes(h.id)}
                      onPress={() => set('hiddenFields', toggle(draft.hiddenFields, h.id))}
                    />
                  ))}
                </Wrap>
              </GSection>
              <View style={styles.note}>
                <Icon name="shield" size={16} color={girl.rose} />
                <Text variant="bodyS" color={girl.ink} style={{ flex: 1 }}>
                  Only women can see IRLY Girl profiles. You can block, report, hide or unmatch anyone at any time.
                </Text>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <GlassLayer radius={0} level="thick" />
        {!valid && hint ? (
          <Animated.View key={hint} entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
            <Text variant="caption" color={girl.inkSoft} align="center">
              {hint}
            </Text>
          </Animated.View>
        ) : null}
        <GButton
          label={step < STEPS.length - 1 ? 'Continue' : editing ? 'Save changes' : 'Start matching'}
          icon={step < STEPS.length - 1 ? undefined : 'sparkles'}
          disabled={!valid}
          loading={saving}
          onPress={next}
        />
      </View>
      </KeyboardAvoidingView>
      {photos.sheet}
    </View>
  );
}

/** One step of the progress: the rose fills in from the left as the step is reached. */
function ProgressBar({ done }: { done: boolean }) {
  const p = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(done ? 1 : 0, { duration: 320 }));
  }, [done, p]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

/** A glass field whose edge turns rose while typing, and red while what is typed is not enough yet. */
function FocusPane({ focus, invalid, children }: { focus: SharedValue<number>; invalid?: boolean; children: React.ReactNode }) {
  const edge = useAnimatedStyle(() => ({
    borderColor: invalid ? girl.critical : interpolateColor(focus.value, [0, 1], [girl.line, girl.rose]),
    boxShadow: focus.value > 0.5 ? girl.shadow : girl.shadowSoft,
  }));
  return (
    <Animated.View style={[styles.inputPane, edge]}>
      <GlassLayer radius={radius.lg} level="thin" />
      {children}
    </Animated.View>
  );
}

/** A lifestyle answer: the rose fills in with a spring when it is chosen. */
function SegItem({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.set(withSpring(on ? 1 : 0, spring.press));
  }, [on, p]);
  const fill = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.85 + p.value * 0.15 }] }));
  return (
    <PressableScale haptic="select" scaleTo={0.97} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={styles.segItem}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.segFill, fill]} />
      <Text variant="caption" color={on ? '#FFFFFF' : girl.ink} align="center" numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <GlassLayer radius={radius.xl} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleS" color={girl.ink}>
          {label}
        </Text>
        <Text variant="bodyS" color={girl.inkSoft}>
          {hint}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: girl.rose, false: girl.blushStrong }}
        thumbColor="#FFFFFF"
        // react-native-web paints the "on" thumb teal unless told otherwise.
        {...(Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as object) : {})}
        accessibilityLabel={a11y(label)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.gutter },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  progress: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: girl.blushStrong },
  barFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: girl.rose, borderRadius: 2, transformOrigin: 'left' },
  count: { minWidth: 30, textAlign: 'right', fontVariant: ['tabular-nums'] },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: '30.5%', aspectRatio: 4 / 5, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: girl.cream },
  addPhoto: { alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: girl.blushStrong, backgroundColor: 'transparent' },
  addIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: girl.blush },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(30,22,52,0.6)', alignItems: 'center', justifyContent: 'center' },
  mainTag: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: 'rgba(30,22,52,0.6)', justifyContent: 'center' },
  // The pane shows the focus (rose edge): no browser outline on top of it.
  input: { minHeight: 110, borderRadius: radius.lg, padding: 14, color: girl.ink, fontFamily: font.medium, fontSize: 15, textAlignVertical: 'top', ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }) },
  segment: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: radius.lg },
  inputPane: { borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden' },
  segItem: { flex: 1, minHeight: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, overflow: 'hidden' },
  segFill: { backgroundColor: girl.rose, borderRadius: radius.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.xl, boxShadow: girl.shadowSoft },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: girl.blush },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: 12, gap: 8, overflow: 'hidden' },
});

/** IRLY Girl: the shared components of IRLY, rendered in the Girl flavor (palette, glass, ambient light). */
export default function GirlProfileScreenGate() {
  return (
    <Flavor value="girl">
      <GirlProfileScreenGateInner />
    </Flavor>
  );
}
