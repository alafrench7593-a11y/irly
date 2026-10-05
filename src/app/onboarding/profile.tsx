import * as ImagePicker from 'expo-image-picker';
import { CharCount } from '@/components/ui/CharCount';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { t as tx } from '@/i18n';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Chip, Field } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CITIES } from '@/data/destinations';
import { StepShell } from '@/features/onboarding/StepShell';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore, type Gender } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const LANGUAGES = ['English', 'Français', 'العربية', 'हिन्दी', 'Русский', 'Español', 'Italiano', 'Deutsch', 'Filipino', 'اردو', 'Português', 'Bahasa'];

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'other', label: 'Other' },
];

/**
 * Your profile. A real photo, a short bio and the basics are required:
 * people say yes to meeting a face and a sentence, not an empty card.
 */
export default function ProfileStep() {
  const t = useTheme();
  const router = useRouter();
  const city = CITIES[useCityId()];
  const profile = useStore((s) => s.profile);
  const update = useStore((s) => s.updateProfile);
  const languages = profile.languages ?? [];
  const bio = profile.bio ?? '';

  const pick = async () => {
    // Kept as data (not a blob: or cache file:// URI, which die on reload or
    // when the OS clears its cache) until it is uploaded at sign-in.
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [1, 1] });
    const a = !res.canceled ? res.assets[0] : null;
    if (!a) return;
    // 512 px JPEG as data (~40-80 KB): survives reloads and cache clean-ups,
    // and stays small enough for the persisted store (web quota, Android 2 MB rows).
    try {
      const small = await manipulateAsync(a.uri, [{ resize: { width: 512 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
      update({ photoUri: small.base64 ? `data:image/jpeg;base64,${small.base64}` : small.uri });
    } catch {
      update({ photoUri: a.uri });
    }
  };

  const ok =
    Boolean(profile.photoUri) &&
    (profile.age ?? 0) >= 18 &&
    bio.trim().length >= 10 &&
    Boolean(profile.country?.trim()) &&
    languages.length > 0 &&
    Boolean(profile.gender);

  return (
    <StepShell
      step={2}
      total={4}
      overline={`IRLY ${city.name}`}
      title="Your profile"
      subtitle="A real photo and a few words. That is what makes people say yes to meeting."
      cta="Continue"
      canContinue={ok}
      onContinue={() => router.push('/onboarding/looking')}
    >
      <Animated.View entering={enter.rise(1, 80)} style={styles.photoRow}>
        <PressableScale haptic="select" onPress={pick} scaleTo={0.95} accessibilityLabel={profile.photoUri ? 'Change profile photo' : 'Add a profile photo (required)'}>
          {profile.photoUri ? (
            <Image source={{ uri: profile.photoUri }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={[styles.photo, styles.photoEmpty, { borderColor: t.c.lineStrong }]}>
              <Icon name="camera" size={26} color={t.c.text} />
            </View>
          )}
        </PressableScale>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="titleS">{profile.photoUri ? 'Looking good' : 'Add your photo'}</Text>
          <Text variant="bodyS" tone="secondary">
            Required. Your face, clearly visible. No logos or group photos.
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={enter.rise(2, 80)} style={styles.block}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field
            containerStyle={{ width: 110 }}
            icon="calendar"
            placeholder={tx('Age')}
            keyboardType="number-pad"
            maxLength={2}
            value={profile.age ? String(profile.age) : ''}
            onChangeText={(v) => update({ age: Number(v.replace(/[^0-9]/g, '')) || undefined })}
            accessibilityLabel="Age"
          />
          <Field
            containerStyle={{ flex: 1 }}
            icon="globe"
            placeholder={tx('Country (e.g. France)')}
            value={profile.country ?? ''}
            onChangeText={(country) => update({ country })}
            autoCapitalize="words"
            accessibilityLabel="Country"
          />
        </View>
        {profile.age !== undefined && profile.age < 18 ? (
          <Text variant="caption" tone="critical">
            IRLY is for people 18 and over.
          </Text>
        ) : null}
      </Animated.View>

      <Animated.View entering={enter.rise(3, 80)} style={styles.block}>
        <Text variant="overline" tone="secondary">
          Bio · required
        </Text>
        <TextInput
          value={bio}
          onChangeText={(b) => update({ bio: b })}
          placeholder={tx('French in {city}\nEntrepreneur · Padel · Travel\nAlways down for coffee.', { city: city.name })}
          placeholderTextColor={t.c.textTertiary}
          multiline
          maxLength={160}
          style={[styles.bio, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }]}
          accessibilityLabel="Short bio"
        />
        <CharCount length={bio.trim().length} min={10} max={160} />
      </Animated.View>

      <Animated.View entering={enter.rise(4, 80)} style={styles.block}>
        <Text variant="overline" tone="secondary">
          Languages
        </Text>
        <View style={styles.wrap}>
          {LANGUAGES.map((l) => (
            <Chip
              key={l}
              size="sm"
              label={l}
              selected={languages.includes(l)}
              onPress={() => update({ languages: languages.includes(l) ? languages.filter((x) => x !== l) : [...languages, l] })}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={enter.rise(5, 80)} style={[styles.block, { marginBottom: space[8] }]}>
        <Text variant="overline" tone="secondary">
          I am
        </Text>
        <View style={styles.wrap}>
          {GENDERS.map((g) => (
            <Chip key={g.id} size="sm" label={g.label} selected={profile.gender === g.id} onPress={() => update({ gender: g.id })} />
          ))}
        </View>
        <Text variant="caption" tone="tertiary">
          Women get access to IRLY Girl, a space reserved for women.
        </Text>
      </Animated.View>
    </StepShell>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: space.gutter, marginBottom: space[6] },
  photo: { width: 96, height: 96, borderRadius: 48 },
  photoEmpty: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  block: { paddingHorizontal: space.gutter, gap: 10, marginBottom: space[6] },
  bio: { minHeight: 104, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, fontFamily: font.medium, fontSize: 16, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
