import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Chip, Segmented } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { usePhotoSource, type PickedPhoto } from '@/components/ui/PhotoSourceSheet';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useT } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import {
  avatarRanges,
  BG_COLORS,
  decodeAvatar,
  defaultAvatar,
  encodeAvatar,
  HAIR_COLORS,
  isAvatar,
  isHeadwear,
  randomAvatar,
  SCARF_COLORS,
  SKIN,
  TOP_COLORS,
  type AvatarConfig,
  type AvatarGender,
} from './avatar';
import { IrlyAvatar } from './IrlyAvatar';

type Props = {
  /** The member's gender: picks the style lists ('other' can switch between both). */
  gender?: AvatarGender;
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
};

type Field = 'skin' | 'hair' | 'hairColor' | 'top' | 'topColor' | 'acc' | 'bg';

const TABS: { id: Field; label: string }[] = [
  { id: 'skin', label: 'Skin' },
  { id: 'hair', label: 'Hair' },
  { id: 'hairColor', label: 'Hair colour' },
  { id: 'top', label: 'Top' },
  { id: 'topColor', label: 'Colour' },
  { id: 'acc', label: 'Extras' },
  { id: 'bg', label: 'Background' },
];

/** Screen-reader names of each swatch ("Hair style 3"). */
const A11Y: Record<Field, string> = {
  skin: 'Skin tone {n}',
  hair: 'Hair style {n}',
  hairColor: 'Hair colour {n}',
  top: 'Top style {n}',
  topColor: 'Top colour {n}',
  acc: 'Extra {n}',
  bg: 'Background {n}',
};

const PREVIEW = 148;
const MINI = 58;
const DOT = 40;

/**
 * Builds an IRLY avatar: a large live preview that springs on every change,
 * a row of tabs, and one row of swatches or mini-portraits per tab. The
 * value is a plain config; callers store `encodeAvatar(value)`.
 */
export const AvatarBuilder = memo(function AvatarBuilder({ gender = 'other', value, onChange }: Props) {
  const t = useTheme();
  const tr = useT();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<Field>('hair');

  const scale = useSharedValue(1);
  const encoded = encodeAvatar(value);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    scale.set(withSequence(withTiming(0.93, { duration: 90 }), withSpring(1, spring.bouncy)));
  }, [encoded, reduced, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const set = useCallback((field: Field, n: number) => onChange({ ...value, [field]: n }), [onChange, value]);

  // 'other' chooses between both style sets; indices are kept when they still exist.
  const switchSet = useCallback(
    (g: AvatarConfig['g']) => {
      if (g === value.g) return;
      const r = avatarRanges(g);
      onChange({ ...value, g, hair: value.hair < r.hair ? value.hair : 0, top: value.top < r.top ? value.top : 0, acc: value.acc < r.acc ? value.acc : 0 });
    },
    [onChange, value],
  );

  const shuffle = useCallback(() => {
    onChange(randomAvatar(gender === 'other' ? (value.g === 'f' ? 'woman' : 'man') : gender, Date.now()));
  }, [gender, onChange, value.g]);

  const headwear = isHeadwear(value);
  const ranges = avatarRanges(value.g);
  const count = ranges[tab];
  const colors: Partial<Record<Field, readonly string[]>> = {
    skin: SKIN,
    hairColor: headwear ? SCARF_COLORS : HAIR_COLORS,
    topColor: TOP_COLORS,
    bg: BG_COLORS,
  };
  const palette = colors[tab];

  return (
    <View style={styles.root}>
      <View style={styles.preview}>
        <Animated.View style={[{ borderRadius: PREVIEW / 2, boxShadow: t.shadow.card }, pop]}>
          <IrlyAvatar config={value} size={PREVIEW} />
        </Animated.View>
        <Button label="Shuffle" icon="repeat" variant="secondary" size="sm" haptic="select" onPress={shuffle} />
      </View>

      {gender === 'other' ? (
        <View style={styles.pad}>
          <Segmented
            options={[
              { value: 'f', label: 'Feminine styles' },
              { value: 'm', label: 'Masculine styles' },
            ]}
            value={value.g}
            onChange={switchSet}
          />
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TABS.map((x) => (
          <Chip
            key={x.id}
            size="sm"
            label={x.id === 'hairColor' && headwear ? 'Scarf colour' : x.label}
            selected={tab === x.id}
            onPress={() => setTab(x.id)}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, styles.swatches]}>
        {Array.from({ length: count }, (_, i) => {
          const selected = value[tab] === i;
          const label = tr(A11Y[tab], { n: i + 1 });
          return (
            <PressableScale
              key={`${tab}-${i}`}
              haptic="select"
              scaleTo={0.9}
              onPress={() => set(tab, i)}
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              style={[styles.ring, { borderRadius: 999, borderColor: selected ? t.c.text : 'transparent' }]}
            >
              {palette ? (
                <View
                  style={{
                    width: DOT,
                    height: DOT,
                    borderRadius: DOT / 2,
                    backgroundColor: palette[i],
                    borderWidth: StyleSheet.hairlineWidth * 2,
                    borderColor: t.c.lineStrong,
                  }}
                />
              ) : (
                <IrlyAvatar config={{ ...value, [tab]: i }} size={MINI} />
              )}
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
});

/* ───────── Appearance: photo or avatar ───────── */

type AppearanceProps = {
  /** The current photo URI or avatar string. */
  value?: string;
  onChange: (photoOrAvatar: string) => void;
  gender?: AvatarGender;
  /** Width the picked photo is resized to (JPEG, kept as data). */
  photoWidth?: number;
  /** Shown under the choice in photo mode. */
  photoHint?: string;
  /**
   * Saves a picked photo at once (edit profile, signed in): the face shows
   * it saving, then a check, or the error with Retry. Without it the photo
   * is only handed to onChange and saved with the rest of the form.
   */
  save?: (photo: string) => Promise<void>;
};

/**
 * "How do you want to appear on IRLY?": a real photo (camera or library)
 * or an IRLY avatar built in a sheet. The value is either a photo URI or an
 * `irly-avatar:v1:` string; both go through the same profile fields.
 */
export const AppearanceChoice = memo(function AppearanceChoice({
  value,
  onChange,
  gender = 'other',
  photoWidth = 512,
  photoHint = 'Required. Your face, clearly visible. No logos or group photos.',
  save,
}: AppearanceProps) {
  const t = useTheme();
  const tr = useT();
  const avatar = isAvatar(value);
  const [mode, setMode] = useState<'photo' | 'avatar'>(avatar ? 'avatar' : 'photo');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AvatarConfig>(() => decodeAvatar(value) ?? defaultAvatar(gender));

  // Library or camera (native, front lens) from the shared photo sheet, cropped square.
  const photos = usePhotoSource({ aspect: [1, 1], front: true, title: 'Profile photo', subtitle: 'Your face, clearly visible.' });
  // Each new pick plays the preview's entrance once (not when its saved link replaces it).
  const [picks, setPicks] = useState(0);
  const [saving, setSaving] = useState<{ state: 'saving' | 'saved' | 'error'; photo: string } | null>(null);

  const persist = useCallback(
    async (photo: string) => {
      if (!save) return;
      setSaving({ state: 'saving', photo });
      try {
        await save(photo);
        haptic('success');
        setSaving({ state: 'saved', photo });
        setTimeout(() => setSaving((s) => (s?.state === 'saved' && s.photo === photo ? null : s)), 1800);
      } catch (e) {
        haptic('error');
        setSaving({ state: 'error', photo });
        toast(e instanceof Error ? e.message : tr('Could not save your photo. Try again.'), 'x', 'live');
      }
    },
    [save, tr],
  );

  const applyPicked = useCallback(
    async (a: PickedPhoto) => {
      // Kept as data (not a blob: or cache file:// URI, which die on reload or
      // when the OS clears its cache) until it is uploaded.
      let photo = a.uri;
      try {
        const small = await manipulateAsync(a.uri, [{ resize: { width: photoWidth } }], { compress: 0.72, format: SaveFormat.JPEG, base64: true });
        photo = small.base64 ? `data:image/jpeg;base64,${small.base64}` : small.uri;
      } catch {
        // The original is still a photo: used as is.
      }
      setPicks((n) => n + 1);
      onChange(photo);
      void persist(photo);
    },
    [onChange, photoWidth, persist],
  );

  const library = async () => {
    const a = await photos.pick();
    if (a) await applyPicked(a);
  };

  const openBuilder = () => {
    setDraft(decodeAvatar(value) ?? defaultAvatar(gender));
    setOpen(true);
  };
  const close = useCallback(() => setOpen(false), []);

  const chooseAvatar = () => {
    setMode('avatar');
    if (!avatar) openBuilder();
  };

  return (
    <View style={styles.choice}>
      <Text variant="titleS">How do you want to appear on IRLY?</Text>
      <View style={styles.cards}>
        <OptionCard icon="camera" label="Use a photo" selected={mode === 'photo'} onPress={() => setMode('photo')} />
        <OptionCard icon="sparkles" label="Create your avatar" selected={mode === 'avatar'} onPress={chooseAvatar} />
      </View>

      <View style={styles.current}>
        <PressableScale
          haptic="select"
          scaleTo={0.95}
          disabled={saving?.state === 'saving'}
          onPress={mode === 'avatar' ? openBuilder : library}
          accessibilityLabel={mode === 'avatar' ? (avatar ? 'Edit your avatar' : 'Create your avatar') : value && !avatar ? 'Change profile photo' : 'Add a profile photo (required)'}
        >
          {value && avatar ? (
            <IrlyAvatar config={value} size={88} />
          ) : value ? (
            <Animated.View key={picks} entering={picks ? ZoomIn.springify(440).dampingRatio(0.7) : undefined}>
              <Image source={{ uri: value }} style={styles.face} contentFit="cover" transition={200} />
            </Animated.View>
          ) : (
            <View style={[styles.face, styles.empty, { borderColor: t.c.lineStrong }]}>
              <Icon name={mode === 'avatar' ? 'sparkles' : 'camera'} size={24} color={t.c.text} />
            </View>
          )}
          {saving?.state === 'saving' ? (
            <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={[styles.face, styles.veil]} accessibilityLabel={tr('Saving your photo…')}>
              <ActivityIndicator color="#FFFFFF" />
            </Animated.View>
          ) : null}
          {saving && saving.state !== 'saving' ? (
            <Animated.View
              key={saving.state}
              entering={ZoomIn.springify(440).dampingRatio(0.6)}
              exiting={ZoomOut.duration(160)}
              style={[styles.status, { backgroundColor: saving.state === 'saved' ? t.c.positive : t.c.critical, borderColor: t.c.bg }]}
            >
              <Icon name={saving.state === 'saved' ? 'check' : 'x'} size={14} color="#FFFFFF" strokeWidth={2.6} />
            </Animated.View>
          ) : null}
        </PressableScale>
        <View style={styles.side}>
          {mode === 'photo' && saving ? (
            <Animated.View key={saving.state} entering={FadeIn.duration(180)}>
              <Text variant="bodyS" tone={saving.state === 'error' ? 'critical' : saving.state === 'saved' ? 'positive' : 'secondary'}>
                {saving.state === 'saving' ? 'Saving your photo…' : saving.state === 'saved' ? 'Photo saved. Everyone sees the new one.' : 'Your photo was not saved.'}
              </Text>
            </Animated.View>
          ) : (
            <Text variant="bodyS" tone="secondary">
              {mode === 'avatar' ? 'An original IRLY avatar, made by you. You can switch to a photo anytime.' : avatar ? 'Pick a photo to replace your avatar.' : photoHint}
            </Text>
          )}
          <View style={styles.actions}>
            {mode === 'avatar' ? (
              <Button label={avatar ? 'Edit your avatar' : 'Create your avatar'} icon="sparkles" variant="secondary" size="sm" onPress={openBuilder} />
            ) : saving?.state === 'error' ? (
              <>
                <Button label="Retry" icon="repeat" size="sm" onPress={() => void persist(saving.photo)} />
                <Button label="Another photo" icon="camera" variant="secondary" size="sm" onPress={library} />
              </>
            ) : (
              <Button
                label={value && !avatar ? 'Change photo' : 'Add a photo'}
                icon="camera"
                variant="secondary"
                size="sm"
                loading={saving?.state === 'saving'}
                onPress={library}
              />
            )}
          </View>
        </View>
      </View>

      {photos.sheet}
      <Sheet visible={open} onClose={close} title="Your IRLY avatar" subtitle="Simple, friendly, yours. Tap to try styles and colours.">
        <AvatarBuilder gender={gender} value={draft} onChange={setDraft} />
        <View style={[styles.pad, { paddingTop: space[5] }]}>
          <Button
            label="Use this avatar"
            icon="check"
            full
            haptic="success"
            onPress={() => {
              onChange(encodeAvatar(draft));
              setMode('avatar');
              setOpen(false);
            }}
          />
        </View>
      </Sheet>
    </View>
  );
});

const OptionCard = memo(function OptionCard({ icon, label, selected, onPress }: { icon: IconName; label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const night = t.mode === 'night';
  const fg = selected ? t.c.onBrand : t.c.text;
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.96}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[
        styles.card,
        selected
          ? { backgroundColor: t.c.brand, borderColor: t.c.brand }
          : { backgroundColor: night ? 'rgba(255,255,255,0.06)' : t.c.surface, borderColor: night ? 'rgba(255,255,255,0.12)' : t.c.line },
      ]}
    >
      <Icon name={icon} size={18} color={fg} />
      <Text variant="label" color={fg} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  root: { gap: space[4] },
  preview: { alignItems: 'center', gap: space[4], paddingTop: space[2] },
  pad: { paddingHorizontal: space.gutter },
  row: { paddingHorizontal: space.gutter, gap: 8, alignItems: 'center' },
  swatches: { gap: 6, minHeight: MINI + 10 },
  ring: { padding: 3, borderWidth: 2 },
  choice: { gap: space[4] },
  cards: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, minHeight: 64, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, gap: 8, justifyContent: 'center' },
  current: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  face: { width: 88, height: 88, borderRadius: 44 },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  veil: { position: 'absolute', top: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  status: { position: 'absolute', right: 0, bottom: 0, width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  side: { flex: 1, gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
