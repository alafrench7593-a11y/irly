import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/destinations';
import { matchApi } from '@/features/girl/api';
import { ACTIVITIES, AVAILABILITY, GOALS, HIDEABLE, INTERESTS, LANGUAGES, LIFESTYLE, SPORTS, TRAVEL } from '@/features/girl/taxonomy';
import { girl } from '@/features/girl/theme';
import { EMPTY_DRAFT, type MatchProfileDraft } from '@/features/girl/types';
import { GButton, GChip, GSection, Wrap } from '@/features/girl/ui';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';

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
export default function GirlProfile() {
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
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Editing an existing profile: start from what is saved.
  useEffect(() => {
    let alive = true;
    matchApi()
      .then((api) => api.getProfile())
      .then((p) => {
        if (alive && p) {
          setDraft(p);
          setEditing(true);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends keyof MatchProfileDraft>(k: K, v: MatchProfileDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

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

  const pickPhoto = async () => {
    if (draft.photoUris.length >= 6) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 5] });
    if (!res.canceled && res.assets[0]) set('photoUris', [...draft.photoUris, res.assets[0].uri]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const api = await matchApi();
      await api.saveProfile(draft);
      haptic('success');
      toast(editing ? 'Profile updated' : 'Your IRLY Match profile is live', 'sparkles', 'brand');
      router.replace('/girl');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save. Check your connection and try again.', 'x', 'live');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!valid) return;
    haptic('select');
    if (step < STEPS.length - 1) setStep(step + 1);
    else save();
  };

  return (
    <View style={[styles.root, { backgroundColor: girl.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <PressableScale
          haptic="tap"
          scaleTo={0.9}
          onPress={() => (step > 0 ? setStep(step - 1) : router.back())}
          accessibilityLabel={step > 0 ? 'Previous step' : 'Close'}
          style={styles.round}
        >
          <Icon name={step > 0 ? 'chevronLeft' : 'x'} size={20} color={girl.ink} />
        </PressableScale>
        <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.bar, { backgroundColor: i <= step ? girl.ink : girl.blush }]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.gutter, paddingBottom: 140, gap: space[6] }} keyboardShouldPersistTaps="handled">
        <Animated.View key={step} entering={FadeIn.duration(260)} exiting={FadeOut.duration(120)} style={{ gap: space[6] }}>
          <View style={{ gap: 6 }}>
            <Text variant="overline" color={girl.rose}>
              {editing ? 'Edit your profile' : 'Your IRLY Match profile'} · {STEPS[step]}
            </Text>
            <Text variant="displayM" color={girl.ink}>
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
                    <Animated.View key={uri} entering={enter.pop(i)} style={styles.photo}>
                      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <PressableScale
                        haptic="tap"
                        scaleTo={0.9}
                        onPress={() => set('photoUris', draft.photoUris.filter((x) => x !== uri))}
                        accessibilityLabel={`Remove photo ${i + 1}`}
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
                      <Icon name="plus" size={22} color={girl.ink} />
                      <Text variant="caption" color={girl.inkSoft}>
                        Add
                      </Text>
                    </PressableScale>
                  ) : null}
                </View>
              </GSection>
              <GSection title="A few words" hint="What would you tell a new friend over coffee?">
                <TextInput
                  value={draft.bio}
                  onChangeText={(v) => set('bio', v.slice(0, 300))}
                  multiline
                  placeholder="New in Dubai, padel addict, always planning the next trip…"
                  placeholderTextColor={girl.inkFaint}
                  style={styles.input}
                  accessibilityLabel="Bio"
                />
                <Text variant="caption" color={girl.inkFaint} align="right">
                  {draft.bio.length}/300
                </Text>
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
                    {([-1, 0, 1] as const).map((v) => {
                      const on = draft.lifestyle[dim.id] === v;
                      return (
                        <PressableScale
                          key={v}
                          haptic="select"
                          scaleTo={0.97}
                          onPress={() => set('lifestyle', { ...draft.lifestyle, [dim.id]: on ? undefined : v })}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          style={[styles.segItem, on ? { backgroundColor: girl.ink } : null]}
                        >
                          <Text variant="caption" color={on ? '#FFFFFF' : girl.ink} align="center" numberOfLines={2}>
                            {v === -1 ? dim.left : v === 0 ? dim.middle : dim.right}
                          </Text>
                        </PressableScale>
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
              <GSection title={`Where you like to go in ${city.name}`} hint="Neighbourhoods only. Your exact location is never shared.">
                <Wrap>
                  {city.areas.map((a) => (
                    <GChip key={a.id} small label={a.name} selected={draft.areas.includes(a.id)} onPress={() => set('areas', toggle(draft.areas, a.id, 5))} />
                  ))}
                </Wrap>
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
                label="Show when I am active"
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
        {!valid && hint ? (
          <Text variant="caption" color={girl.inkSoft} align="center">
            {hint}
          </Text>
        ) : null}
        <GButton
          label={step < STEPS.length - 1 ? 'Continue' : editing ? 'Save changes' : 'Start matching'}
          icon={step < STEPS.length - 1 ? undefined : 'sparkles'}
          disabled={!valid}
          loading={saving}
          onPress={next}
        />
      </View>
    </View>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleS" color={girl.ink}>
          {label}
        </Text>
        <Text variant="bodyS" color={girl.inkSoft}>
          {hint}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: girl.ink, false: girl.blush }} thumbColor="#FFFFFF" accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.gutter },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: girl.surface, alignItems: 'center', justifyContent: 'center' },
  progress: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: '30.5%', aspectRatio: 4 / 5, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: girl.cream },
  addPhoto: { alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: girl.blushStrong },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(58,42,42,0.6)', alignItems: 'center', justifyContent: 'center' },
  mainTag: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: 'rgba(58,42,42,0.6)', justifyContent: 'center' },
  input: { minHeight: 110, borderRadius: radius.lg, padding: 14, backgroundColor: girl.surface, color: girl.ink, fontFamily: font.medium, fontSize: 15, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: radius.lg, backgroundColor: girl.cream },
  segItem: { flex: 1, minHeight: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.xl, backgroundColor: girl.surface },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: girl.blush },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: 12, gap: 8, backgroundColor: girl.bg },
});
